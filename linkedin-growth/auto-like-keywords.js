"use strict";

/**
 * Auto Like by Keywords
 * ---------------------
 * Likes feed posts whose text contains any configured keyword.
 * Keywords can come from:
 *   1) growth-config.json -> autoLikeKeywords.words
 *   2) CSV/TXT file path (e.g. exported from Excel)
 */

const fs = require("fs");
const path = require("path");
const {
  humanDelay,
  humanScroll,
  humanMouseJitter,
  launchBrowser,
  ensureLoggedIn,
  persistSession,
  loadGrowthConfig,
  readJsonSafe,
  writeJsonSafe,
  STATE_DIR
} = require("./helpers");

const AUTO_LIKE_HISTORY_FILE = path.join(STATE_DIR, "auto-like-history.json");

function normalizeKeyword(value) {
  return String(value || "").trim().toLowerCase();
}

function loadKeywords(cfg) {
  const inConfig = Array.isArray(cfg.words) ? cfg.words : [];
  let fromFile = [];

  if (cfg.keywordFilePath) {
    const filePath = path.resolve(path.join(__dirname, ".."), cfg.keywordFilePath);
    if (fs.existsSync(filePath)) {
      const text = fs.readFileSync(filePath, "utf8");
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".csv") {
        fromFile = text
          .split(/\r?\n/)
          .map((line) => line.split(",")[0])
          .filter(Boolean);
      } else {
        fromFile = text
          .split(/\r?\n|,|;/)
          .map((line) => line.trim())
          .filter(Boolean);
      }
    }
  }

  return [...new Set([...inConfig, ...fromFile].map(normalizeKeyword).filter(Boolean))];
}

function findMatchedKeyword(postText, keywords) {
  const hay = String(postText || "").toLowerCase();
  for (const keyword of keywords) {
    if (hay.includes(keyword)) return keyword;
  }
  return null;
}

async function runAutoLikeKeywords() {
  const config = loadGrowthConfig();
  const cfg = config.autoLikeKeywords || {};

  if (!cfg.enabled) {
    console.log("[AutoLike] Disabled in growth-config.json — skipping.");
    return { skipped: true };
  }

  const keywords = loadKeywords(cfg);
  if (keywords.length === 0) {
    console.log("[AutoLike] No keywords found. Add words or keywordFilePath in config.");
    return { skipped: true, reason: "no_keywords" };
  }

  console.log("\n=== LinkedIn Auto Like by Keywords ===");
  console.log(`  Loaded ${keywords.length} keyword(s).`);

  const maxLikes = Number(cfg.maxLikesPerSession || 20);
  const minDelay = Number(cfg.delayBetweenLikesMinSec || 20) * 1000;
  const maxDelay = Number(cfg.delayBetweenLikesMaxSec || 45) * 1000;
  const feedScrollRounds = Number(cfg.feedScrollRounds || 5);

  const history = readJsonSafe(AUTO_LIKE_HISTORY_FILE, { likedUrns: [], sessions: [] });
  if (!Array.isArray(history.likedUrns)) history.likedUrns = [];

  const stats = { checked: 0, matched: 0, liked: 0 };
  const { browser, context, page } = await launchBrowser(false);

  try {
    const loggedIn = await ensureLoggedIn(page, context);
    if (!loggedIn) {
      return { error: "not_logged_in" };
    }

    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await humanDelay(page, 1500, 3000);

    for (let i = 0; i < feedScrollRounds; i += 1) {
      await humanScroll(page, 1);
      await humanDelay(page, 800, 1600);
    }

    const posts = await page.locator(".feed-shared-update-v2, [data-urn*='activity']").all();
    console.log(`  Scanned ${posts.length} feed post candidate(s).`);

    for (let i = 0; i < posts.length; i += 1) {
      if (stats.liked >= maxLikes) break;

      const post = posts[i];
      stats.checked += 1;

      let urn = "";
      try {
        urn = (await post.getAttribute("data-urn")) || "";
      } catch {
        // ignore
      }
      if (urn && history.likedUrns.includes(urn)) continue;

      let text = "";
      try {
        text = await post.innerText();
      } catch {
        // ignore
      }

      const matchedKeyword = findMatchedKeyword(text, keywords);
      if (!matchedKeyword) continue;
      stats.matched += 1;

      try {
        const likeBtn = post
          .locator("button[aria-label*='Like'], button[aria-label*='React']")
          .first();
        const isPressed = await likeBtn.getAttribute("aria-pressed").catch(() => "false");
        if (isPressed === "true") continue;
        if (!(await likeBtn.isVisible().catch(() => false))) continue;

        await humanMouseJitter(page);
        await post.scrollIntoViewIfNeeded().catch(() => {});
        await humanDelay(page, 600, 1400);

        await likeBtn.click();
        stats.liked += 1;
        if (urn) history.likedUrns.push(urn);

        console.log(
          `  Liked ${stats.liked}/${maxLikes} (matched keyword: "${matchedKeyword}")`
        );
        await humanDelay(page, minDelay, maxDelay);
      } catch {
        // skip if click fails
      }
    }
  } finally {
    if (history.likedUrns.length > 2000) {
      history.likedUrns = history.likedUrns.slice(-2000);
    }
    history.sessions = history.sessions || [];
    history.sessions.push({
      date: new Date().toISOString(),
      checked: stats.checked,
      matched: stats.matched,
      liked: stats.liked
    });
    if (history.sessions.length > 200) {
      history.sessions = history.sessions.slice(-200);
    }
    writeJsonSafe(AUTO_LIKE_HISTORY_FILE, history);
    await persistSession(context);
    await browser.close();
  }

  console.log(
    `[AutoLike] Done. Checked: ${stats.checked}, Matched: ${stats.matched}, Liked: ${stats.liked}`
  );
  return stats;
}

module.exports = { runAutoLikeKeywords };

if (require.main === module) {
  runAutoLikeKeywords().catch(console.error);
}
