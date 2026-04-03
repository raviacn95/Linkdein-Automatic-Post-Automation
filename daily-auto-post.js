/**
 * Self-Healing Daily Auto-Post Scheduler
 *
 * Posts one article to LinkedIn every day with:
 *  - Automatic retry on failure (up to 3 attempts with exponential backoff)
 *  - Session recovery if browser/auth breaks
 *  - Crash resilience — restarts the cycle on unhandled errors
 *  - Daily scheduling with configurable post time
 *  - Logs all activity for debugging
 */

const fs = require("fs");
const path = require("path");
const { runLinkedInAutomation } = require("./linkedin-automation");
const { loadConfig } = require("./generate-posts-from-pdf");

const STATE_DIR = path.join(__dirname, ".auth");
const DAILY_STATE_FILE = path.join(STATE_DIR, "daily-auto-post-state.json");
const LOG_FILE = path.join(STATE_DIR, "daily-auto-post.log");

// ── Helpers ──────────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString();
}

function log(msg) {
  const line = `[${timestamp()}] ${msg}`;
  console.log(line);
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
  } catch { /* ignore logging errors */ }
}

function loadState() {
  try {
    if (fs.existsSync(DAILY_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(DAILY_STATE_FILE, "utf8"));
    }
  } catch { /* corrupt state — reset */ }
  return { lastPostDate: null, consecutiveFailures: 0, totalPosts: 0, totalFailures: 0 };
}

function saveState(state) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(DAILY_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Self-Healing Post Runner ─────────────────────────────────────────────────

async function postWithRetry(maxRetries = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(`Attempt ${attempt}/${maxRetries} — starting LinkedIn post...`);

    try {
      // Force only 1 post per run
      process.env.POST_COUNT = "1";
      await runLinkedInAutomation();
      log(`Post succeeded on attempt ${attempt}.`);
      return true;
    } catch (err) {
      lastError = err;
      const errMsg = err.message || String(err);
      log(`Attempt ${attempt} failed: ${errMsg}`);

      // Self-healing: clear browser state if auth/session issue
      if (errMsg.includes("logged in") || errMsg.includes("auth") || errMsg.includes("session") || errMsg.includes("navigation")) {
        log("Detected possible auth/session issue — clearing storage state for fresh login next attempt.");
        const storageFile = path.join(STATE_DIR, "linkedin-state.json");
        try {
          if (fs.existsSync(storageFile)) {
            const backup = storageFile + ".bak-" + Date.now();
            fs.copyFileSync(storageFile, backup);
            fs.unlinkSync(storageFile);
            log(`Backed up and removed storage state (backup: ${path.basename(backup)})`);
          }
        } catch (cleanErr) {
          log(`Failed to clean storage state: ${cleanErr.message}`);
        }
      }

      // Self-healing: kill any orphaned browser processes
      if (errMsg.includes("browser") || errMsg.includes("Target closed") || errMsg.includes("timeout")) {
        log("Detected browser issue — waiting for cleanup before retry.");
        await sleep(5000);
      }

      if (attempt < maxRetries) {
        // Exponential backoff: 30s, 90s, 270s
        const backoffMs = 30000 * Math.pow(3, attempt - 1);
        const jitter = randomBetween(0, 10000);
        const waitMs = backoffMs + jitter;
        log(`Retrying in ${Math.round(waitMs / 1000)}s (exponential backoff)...`);
        await sleep(waitMs);
      }
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

// ── Daily Scheduler Loop ─────────────────────────────────────────────────────

async function runDailyLoop() {
  log("═══════════════════════════════════════════════════════════");
  log("Daily Auto-Post Scheduler started (self-healing enabled)");
  log("═══════════════════════════════════════════════════════════");

  const config = loadConfig();
  const maxRetries = 3;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const state = loadState();
    const today = todayString();

    // Check if we already posted today
    if (state.lastPostDate === today) {
      log(`Already posted today (${today}). Sleeping until next check...`);
      // Check again in 1 hour (in case date rolled over or manual reset)
      await sleep(60 * 60 * 1000);
      continue;
    }

    log(`No post yet for ${today}. Starting post cycle...`);

    try {
      await postWithRetry(maxRetries);

      // Success — update state
      state.lastPostDate = today;
      state.consecutiveFailures = 0;
      state.totalPosts = (state.totalPosts || 0) + 1;
      saveState(state);

      log(`Daily post complete. Total posts to date: ${state.totalPosts}`);
      log(`Next post scheduled for tomorrow.`);

    } catch (err) {
      // All retries exhausted
      state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
      state.totalFailures = (state.totalFailures || 0) + 1;
      saveState(state);

      log(`ALL ${maxRetries} ATTEMPTS FAILED: ${err.message || err}`);
      log(`Consecutive failures: ${state.consecutiveFailures}`);

      if (state.consecutiveFailures >= 3) {
        log("WARNING: 3+ consecutive days of failures. Check auth, network, or LinkedIn changes.");
        log("Self-healing: will clear session and retry tomorrow with fresh state.");
        const storageFile = path.join(STATE_DIR, "linkedin-state.json");
        try {
          if (fs.existsSync(storageFile)) {
            fs.copyFileSync(storageFile, storageFile + ".bak-" + Date.now());
            fs.unlinkSync(storageFile);
            log("Cleared stored session for fresh login tomorrow.");
          }
        } catch { /* ignore */ }
      }

      // Mark today as attempted so we don't hammer LinkedIn
      state.lastPostDate = today;
      saveState(state);
      log("Marked today as attempted. Will retry tomorrow.");
    }

    // Sleep until next day + random offset (post between 8:00-10:00 AM next day)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0); // Base: 8 AM
    const randomOffsetMs = randomBetween(0, 2 * 60 * 60 * 1000); // 0-2 hours jitter
    const sleepMs = Math.max(60000, tomorrow.getTime() - now.getTime() + randomOffsetMs);
    const sleepHours = (sleepMs / 3600000).toFixed(1);

    log(`Sleeping ${sleepHours} hours until next post window...`);
    log("───────────────────────────────────────────────────────────");

    await sleep(sleepMs);
  }
}

// ── Entry Point ──────────────────────────────────────────────────────────────

// Crash resilience: restart on unhandled errors
process.on("uncaughtException", (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.message || err}`);
  log("Restarting scheduler in 60s...");
  setTimeout(() => {
    runDailyLoop().catch((e) => {
      log(`FATAL: ${e.message || e}`);
      process.exit(1);
    });
  }, 60000);
});

process.on("unhandledRejection", (reason) => {
  log(`UNHANDLED REJECTION: ${reason}`);
  // Don't crash — the loop will handle it
});

runDailyLoop().catch((error) => {
  log(`FATAL: ${error.message || error}`);
  process.exit(1);
});
