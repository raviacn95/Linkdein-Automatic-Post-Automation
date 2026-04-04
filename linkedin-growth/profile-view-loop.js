"use strict";

/**
 * Profile View Loop Automation
 * ----------------------------
 * Opens profile URLs in a temporary tab and closes each tab.
 * Repeats for configured count (default 100).
 */

const fs = require("fs");
const path = require("path");
const {
  humanDelay,
  launchBrowser,
  ensureLoggedIn,
  persistSession,
  loadGrowthConfig,
  readJsonSafe,
  writeJsonSafe,
  STATE_DIR
} = require("./helpers");

const PROFILE_VIEW_HISTORY_FILE = path.join(STATE_DIR, "profile-view-history.json");

function parseProfileUrlsFromFile(filePath) {
  if (!filePath) return [];
  const abs = path.resolve(path.join(__dirname, ".."), filePath);
  if (!fs.existsSync(abs)) return [];
  const text = fs.readFileSync(abs, "utf8");
  return text
    .split(/\r?\n|,|;/)
    .map((line) => line.trim())
    .filter((url) => url.startsWith("https://www.linkedin.com/in/") || url.startsWith("https://www.linkedin.com/company/"));
}

function dedup(arr) {
  return [...new Set((arr || []).map((x) => String(x || "").trim()).filter(Boolean))];
}

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameFromUrl(url) {
  const clean = String(url || "").split("?")[0];
  const slug = clean.split("/").filter(Boolean).pop() || "";
  return slug.replace(/-/g, " ").trim();
}

async function readProfileName(page) {
  const selectors = [
    "h1.text-heading-xlarge",
    "h1.inline.t-24.v-align-middle.break-words",
    "h1"
  ];
  for (const selector of selectors) {
    const text = await page.locator(selector).first().innerText().catch(() => "");
    if (String(text || "").trim()) return String(text).trim();
  }
  return "";
}

async function detectRelationshipStatus(page) {
  try {
    const connected = await page
      .locator("button:has-text('Connected'), span:has-text('Connected')")
      .first()
      .count();
    if (connected > 0) return "connected";

    const following = await page
      .locator("button:has-text('Following'), span:has-text('Following')")
      .first()
      .count();
    if (following > 0) return "following";
  } catch {
    // ignore and return unknown
  }
  return "unknown";
}

async function discoverProfileCandidatesFromFeed(page, rounds, maxUrls, refreshCycles) {
  const cap = Math.max(20, Number(maxUrls || 200));
  const cycles = Math.max(1, Number(refreshCycles || 1));
  const collected = new Map();

  for (let cycle = 0; cycle < cycles && collected.size < cap; cycle += 1) {
    if (cycle === 0) {
      await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });
    } else {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(async () => {
        await page.goto("https://www.linkedin.com/feed/", {
          waitUntil: "domcontentloaded",
          timeout: 60000
        });
      });
    }
    await humanDelay(page, 1500, 3000);

    for (let i = 0; i < rounds && collected.size < cap; i += 1) {
      const links = await page
        .locator("a[href*='linkedin.com/in/'], a[href*='linkedin.com/company/']")
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            href: node.href || "",
            text: (node.textContent || "").trim()
          }))
        )
        .catch(() => []);

      links.forEach((item) => {
        const clean = String(item.href || "").split("?")[0];
        if (clean.startsWith("https://www.linkedin.com/in/") || clean.startsWith("https://www.linkedin.com/company/")) {
          if (!collected.has(clean)) {
            collected.set(clean, String(item.text || "").trim());
          }
        }
      });

      await page.mouse.wheel(0, 900);
      await humanDelay(page, 900, 1700);
    }
  }

  return Array.from(collected.entries()).slice(0, cap).map(([url, nameHint]) => ({ url, nameHint }));
}

async function runProfileViewLoop() {
  const config = loadGrowthConfig();
  const cfg = config.profileViewLoop || {};

  if (!cfg.enabled) {
    console.log("[ProfileView] Disabled in growth-config.json — skipping.");
    return { skipped: true };
  }

  const repetitions = Math.max(1, Number(cfg.repetitions || 100));
  const minViewMs = Number(cfg.minViewSeconds || 3) * 1000;
  const maxViewMs = Number(cfg.maxViewSeconds || 8) * 1000;
  const discoveryRounds = Math.max(1, Number(cfg.discoveryScrollRounds || 10));
  const discoveryRefreshCycles = Math.max(1, Number(cfg.discoveryRefreshCycles || 2));
  const recentHistoryLimit = Math.max(20, Number(cfg.recentHistoryLimit || 200));
  const skipConnectedOrFollowing = cfg.skipConnectedOrFollowing !== false;

  const urlsFromConfig = Array.isArray(cfg.profileUrls) ? cfg.profileUrls : [];
  const urlsFromFile = parseProfileUrlsFromFile(cfg.profileUrlsFilePath);
  const baseUrls = dedup([...urlsFromConfig, ...urlsFromFile]);
  let candidateQueue = baseUrls.map((url) => ({ url, nameHint: nameFromUrl(url) }));

  console.log("\n=== LinkedIn Profile View Loop ===");
  console.log(`  URLs loaded: ${baseUrls.length}`);
  console.log(`  Repetitions: ${repetitions}`);

  const history = readJsonSafe(PROFILE_VIEW_HISTORY_FILE, {
    sessions: [],
    relationshipCache: {},
    recentProfileNames: [],
    recentProfileUrls: []
  });
  if (!history.relationshipCache || typeof history.relationshipCache !== "object") {
    history.relationshipCache = {};
  }
  const recentNames = new Set((history.recentProfileNames || []).map((n) => normalizeName(n)).filter(Boolean));
  const recentUrls = new Set((history.recentProfileUrls || []).map((u) => String(u || "").trim()).filter(Boolean));

  const stats = {
    opened: 0,
    closed: 0,
    skippedKnown: 0,
    skippedDetected: 0,
    skippedRecent: 0,
    discovered: 0
  };

  const { browser, context, page } = await launchBrowser(false);

  try {
    const loggedIn = await ensureLoggedIn(page, context);
    if (!loggedIn) {
      return { error: "not_logged_in" };
    }

    if (candidateQueue.length === 0 || cfg.useFeedProfileDiscovery === true) {
      const discovered = await discoverProfileCandidatesFromFeed(
        page,
        discoveryRounds,
        repetitions * 2,
        discoveryRefreshCycles
      );
      const existing = new Set(candidateQueue.map((c) => c.url));
      discovered.forEach((item) => {
        if (!existing.has(item.url)) {
          candidateQueue.push(item);
          existing.add(item.url);
        }
      });
      stats.discovered += discovered.length;
      console.log(`  Discovered ${discovered.length} profile URL(s) from feed.`);
    }

    if (candidateQueue.length === 0) {
      console.log("[ProfileView] No profile URLs found from config/file/feed discovery.");
      return { skipped: true, reason: "no_urls" };
    }

    let guard = 0;
    const maxGuard = Math.max(repetitions * 12, candidateQueue.length * 6);

    while (stats.opened < repetitions && guard < maxGuard) {
      guard += 1;

      if (candidateQueue.length === 0) {
        const refreshed = await discoverProfileCandidatesFromFeed(
          page,
          discoveryRounds,
          repetitions,
          discoveryRefreshCycles
        );
        const seen = new Set();
        refreshed.forEach((item) => {
          if (!seen.has(item.url)) {
            candidateQueue.push(item);
            seen.add(item.url);
          }
        });
        stats.discovered += refreshed.length;
        console.log(`  Refreshed feed and discovered ${refreshed.length} additional profile URL(s).`);
        if (candidateQueue.length === 0) {
          break;
        }
      }

      const candidate = candidateQueue.shift();
      const url = candidate.url;
      const nameHintNorm = normalizeName(candidate.nameHint || nameFromUrl(url));

      if (recentUrls.has(url) || (nameHintNorm && recentNames.has(nameHintNorm))) {
        stats.skippedRecent += 1;
        continue;
      }

      const cachedStatus = history.relationshipCache[url];
      if (skipConnectedOrFollowing && (cachedStatus === "connected" || cachedStatus === "following")) {
        stats.skippedKnown += 1;
        continue;
      }

      const tab = await context.newPage();
      try {
        await tab.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        const relationship = await detectRelationshipStatus(tab);
        if (relationship !== "unknown") {
          history.relationshipCache[url] = relationship;
        }

        if (skipConnectedOrFollowing && (relationship === "connected" || relationship === "following")) {
          recentUrls.add(url);
          if (nameHintNorm) recentNames.add(nameHintNorm);
          stats.skippedDetected += 1;
          continue;
        }

        const profileName = await readProfileName(tab);
        const normalizedProfileName = normalizeName(profileName || candidate.nameHint || nameFromUrl(url));
        recentUrls.add(url);
        if (normalizedProfileName) recentNames.add(normalizedProfileName);

        stats.opened += 1;
        await humanDelay(tab, minViewMs, maxViewMs);
      } catch {
        // ignore and continue
      } finally {
        try {
          await tab.close();
          stats.closed += 1;
        } catch {
          // ignore
        }
      }

      if (stats.opened > 0 && stats.opened % 10 === 0) {
        console.log(`  Progress: ${stats.opened}/${repetitions}`);
      }
    }

    if (stats.opened < repetitions) {
      console.log(
        `  Completed with fewer views (${stats.opened}/${repetitions}) due to connected/following skips.`
      );
    }
  } finally {
    history.sessions = history.sessions || [];
    history.sessions.push({
      date: new Date().toISOString(),
      repetitions,
      opened: stats.opened,
      closed: stats.closed,
      skippedKnown: stats.skippedKnown,
      skippedDetected: stats.skippedDetected,
      skippedRecent: stats.skippedRecent,
      discovered: stats.discovered
    });
    if (history.sessions.length > 200) {
      history.sessions = history.sessions.slice(-200);
    }
    history.recentProfileUrls = Array.from(recentUrls).slice(-recentHistoryLimit);
    history.recentProfileNames = Array.from(recentNames).slice(-recentHistoryLimit);
    writeJsonSafe(PROFILE_VIEW_HISTORY_FILE, history);
    await persistSession(context);
    await browser.close();
  }

  console.log(
    `[ProfileView] Done. Opened: ${stats.opened}, Closed: ${stats.closed}, ` +
    `SkippedKnown: ${stats.skippedKnown}, SkippedDetected: ${stats.skippedDetected}, ` +
    `SkippedRecent: ${stats.skippedRecent}, Discovered: ${stats.discovered}`
  );
  return stats;
}

module.exports = { runProfileViewLoop };

if (require.main === module) {
  runProfileViewLoop().catch(console.error);
}
