"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

const STATE_DIR = path.join(__dirname, "..", ".auth");
const STORAGE_STATE_FILE = path.join(STATE_DIR, "linkedin-state.json");

// ── Timing helpers ────────────────────────────────────────────────────────────

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanDelay(page, minMs, maxMs) {
  await page.waitForTimeout(randomBetween(minMs, maxMs));
}

async function humanScroll(page, times) {
  const scrolls = times || randomBetween(1, 3);
  for (let s = 0; s < scrolls; s++) {
    await page.mouse.wheel(0, randomBetween(150, 400));
    await humanDelay(page, 400, 1000);
  }
  await page.mouse.wheel(0, -randomBetween(200, 500));
  await humanDelay(page, 300, 700);
}

async function humanMouseJitter(page) {
  const x = randomBetween(200, 900);
  const y = randomBetween(150, 500);
  await page.mouse.move(x, y, { steps: randomBetween(5, 15) });
  await humanDelay(page, 200, 600);
}

// ── Browser launch (reuses existing LinkedIn session) ─────────────────────────

async function launchBrowser(headless) {
  const storageState = fs.existsSync(STORAGE_STATE_FILE) ? STORAGE_STATE_FILE : undefined;
  const browser = await chromium.launch({ headless: headless === true, channel: "msedge" });
  const context = await browser.newContext(storageState ? { storageState } : {});
  const page = await context.newPage();
  return { browser, context, page };
}

async function persistSession(context) {
  if (!context) return;
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  await context.storageState({ path: STORAGE_STATE_FILE });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function askWithTimeout(question, timeoutMs) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(null);
    }, timeoutMs);

    rl.question(question, (answer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rl.close();
      resolve(answer);
    });
  });
}

// ── Login verification ────────────────────────────────────────────────────────

async function verifyLoggedIn(page) {
  try {
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await humanDelay(page, 1500, 3000);

    const url = page.url();
    if (url.includes("/login") || url.includes("/checkpoint") || url.includes("/uas/")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function waitForManualLogin(page, context, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });
      await humanDelay(page, 1500, 3000);
    } catch {
      // Keep polling until timeout.
    }

    if (await verifyLoggedIn(page)) {
      await persistSession(context);
      return true;
    }

    await page.waitForTimeout(5000);
  }

  return false;
}

async function ensureLoggedIn(page, context) {
  const loggedIn = await verifyLoggedIn(page);
  if (loggedIn) {
    await persistSession(context);
    return true;
  }

  const manualLoginTimeoutMs = 3 * 60 * 1000;
  console.log("Manual login required. Complete LinkedIn login in the opened browser within 3 minutes.");
  console.log("Waiting for authentication...");

  const verifiedAfterLogin = await Promise.race([
    waitForManualLogin(page, context, manualLoginTimeoutMs),
    askWithTimeout("Press Enter after LinkedIn feed is visible (auto-timeout in 3 minutes)...", manualLoginTimeoutMs).then(async (answer) => {
      if (answer === null) {
        return false;
      }
      const verified = await verifyLoggedIn(page);
      if (verified) {
        await persistSession(context);
      }
      return verified;
    }),
    new Promise((resolve) => {
      setTimeout(() => resolve(false), manualLoginTimeoutMs);
    })
  ]);

  if (!verifiedAfterLogin) {
    console.error("LinkedIn login was not completed within 3 minutes.");
    return false;
  }

  await persistSession(context);
  return true;
}

// ── Config & JSON helpers ─────────────────────────────────────────────────────

function loadGrowthConfig() {
  const configPath = path.join(__dirname, "growth-config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("growth-config.json not found in linkedin-growth/");
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function readJsonSafe(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonSafe(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

module.exports = {
  randomBetween,
  humanDelay,
  humanScroll,
  humanMouseJitter,
  launchBrowser,
  persistSession,
  ensureLoggedIn,
  verifyLoggedIn,
  loadGrowthConfig,
  readJsonSafe,
  writeJsonSafe,
  STATE_DIR,
  STORAGE_STATE_FILE
};
