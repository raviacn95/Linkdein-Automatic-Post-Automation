"use strict";

/**
 * LinkedIn Connection Request Automation
 * ----------------------------------------
 * Searches for targeted profiles (recruiters, SAP consultants, automation
 * engineers) and sends personalized connection requests with a short note.
 *
 * Daily and per-session limits are enforced to stay within LinkedIn's
 * allowance (≈ 100 invitations/week). History is stored in
 * .auth/connections-history.json.
 */

const path = require("path");
const {
  randomBetween,
  humanDelay,
  humanScroll,
  humanMouseJitter,
  launchBrowser,
  persistSession,
  ensureLoggedIn,
  loadGrowthConfig,
  readJsonSafe,
  writeJsonSafe,
  STATE_DIR
} = require("./helpers");

const CONNECTIONS_HISTORY_FILE = path.join(STATE_DIR, "connections-history.json");

// ── Message builder ───────────────────────────────────────────────────────────

function formatMessage(template, name, topic) {
  return template
    .replace(/\{name\}/g, name || "there")
    .replace(/\{topic\}/g, topic || "test automation");
}

// ── Send requests for one keyword ────────────────────────────────────────────

async function sendRequestsForKeyword(page, keyword, cfg, history, stats) {
  const maxPerSession = cfg.maxRequestsPerSession;
  const minDelay = (cfg.delayBetweenRequestsMinSec || 50) * 1000;
  const maxDelay = (cfg.delayBetweenRequestsMaxSec || 120) * 1000;

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = (history.daily || {})[today] || 0;

  if (todayCount + stats.sent >= cfg.maxRequestsPerDay) {
    console.log(
      `  [Connections] Daily limit (${cfg.maxRequestsPerDay}) reached.`
    );
    return { sent: 0, limitReached: true };
  }

  const searchUrl =
    "https://www.linkedin.com/search/results/people/?" +
    `keywords=${encodeURIComponent(keyword)}&origin=CLUSTER_EXPANSION`;

  console.log(`  Searching for: "${keyword}"`);
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await humanDelay(page, 2000, 4000);
  await humanScroll(page, 2);

  const profileCards = await page
    .locator(".entity-result__item, li.reusable-search__result-container")
    .all();
  console.log(`  Found ${profileCards.length} profile(s)`);

  let sent = 0;
  const topics = cfg.topics || ["test automation"];

  for (const card of profileCards) {
    if (stats.sent >= maxPerSession) break;
    if ((history.daily[today] || 0) + stats.sent >= cfg.maxRequestsPerDay) break;

    await humanMouseJitter(page);
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await humanDelay(page, 500, 1200);

    // Extract first name for personalised message
    let firstName = "";
    try {
      const fullName = await card
        .locator(".entity-result__title-text a span[aria-hidden='true']")
        .first()
        .innerText();
      firstName = fullName.trim().split(" ")[0];
    } catch { /* ignore */ }

    // Extract profile URL for deduplication
    let profileUrl = "";
    try {
      profileUrl = (
        (await card
          .locator(".entity-result__title-text a")
          .first()
          .getAttribute("href")) || ""
      ).split("?")[0];
    } catch { /* ignore */ }

    if (profileUrl && history.sent.includes(profileUrl)) {
      continue;
    }

    // Look for a Connect button directly on the card
    try {
      const connectBtn = card
        .locator("button")
        .filter({ hasText: /^Connect$/ })
        .first();
      if (!(await connectBtn.isVisible().catch(() => false))) continue;

      await connectBtn.click();
      await humanDelay(page, 1500, 3000);

      // "Add a note" dialog appears — add personalised message
      const addNoteBtn = page.locator("button[aria-label='Add a note']");
      if (await addNoteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addNoteBtn.click();
        await humanDelay(page, 800, 1500);

        const topic = topics[randomBetween(0, topics.length - 1)];
        const message = formatMessage(cfg.connectionMessage, firstName, topic);

        const noteBox = page.locator("textarea#custom-message");
        await noteBox.fill(message);
        await humanDelay(page, 700, 1400);

        const sendBtn = page.locator("button[aria-label='Send invitation']");
        if (await sendBtn.isVisible().catch(() => false)) {
          await sendBtn.click();
        }
      } else {
        // No "Add a note" option — send without note
        const sendNow = page.locator(
          "button[aria-label='Send without a note'], button[aria-label='Send now']"
        );
        if (await sendNow.isVisible().catch(() => false)) {
          await sendNow.click();
        }
      }

      await humanDelay(page, 500, 1000);

      stats.sent += 1;
      sent += 1;
      if (profileUrl) history.sent.push(profileUrl);

      console.log(
        `    Sent request to ${firstName || "unknown"} (${profileUrl.split("/in/")[1] || "profile"})`
      );
      await humanDelay(page, minDelay, maxDelay);
    } catch { /* connect flow failed — profile may already be connected */ }
  }

  return { sent };
}

// ── Main entry ────────────────────────────────────────────────────────────────

async function runConnections() {
  const config = loadGrowthConfig();
  const cfg = config.connections;

  if (!cfg.enabled) {
    console.log("[Connections] Disabled in growth-config.json — skipping.");
    return { skipped: true };
  }

  const history = readJsonSafe(CONNECTIONS_HISTORY_FILE, { sent: [], daily: {} });
  if (!Array.isArray(history.sent)) history.sent = [];
  if (typeof history.daily !== "object" || Array.isArray(history.daily)) {
    history.daily = {};
  }

  console.log("\n=== LinkedIn Connection Request Automation ===");
  const stats = { sent: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const todayAlready = (history.daily || {})[today] || 0;
  console.log(
    `  Today's requests so far: ${todayAlready} / ${cfg.maxRequestsPerDay}`
  );

  const { browser, context, page } = await launchBrowser(false);

  try {
    const loggedIn = await ensureLoggedIn(page, context);
    if (!loggedIn) {
      console.error(
        "[Connections] Not logged in to LinkedIn. " +
        "Run 'npm run linkedin:post' first to authenticate."
      );
      return { error: "not_logged_in" };
    }

    console.log("[Connections] Session verified. Starting connection requests...");

    for (const keyword of cfg.targetKeywords || []) {
      if (stats.sent >= cfg.maxRequestsPerSession) break;
      try {
        const result = await sendRequestsForKeyword(page, keyword, cfg, history, stats);
        console.log(`  "${keyword}": sent=${result.sent}`);
        if (result.limitReached) break;
      } catch (err) {
        console.error(`  [Connections] Error for "${keyword}":`, err.message);
      }
      await humanDelay(page, 8000, 15000);
    }
  } finally {
    // Persist history
    if (history.sent.length > 1000) history.sent = history.sent.slice(-1000);
    history.daily[today] = (history.daily[today] || 0) + stats.sent;

    // Retain only the last 30 days of daily counts
    const keys = Object.keys(history.daily).sort();
    if (keys.length > 30) {
      keys.slice(0, keys.length - 30).forEach((k) => delete history.daily[k]);
    }

    writeJsonSafe(CONNECTIONS_HISTORY_FILE, history);
    await persistSession(context);
    await browser.close();
  }

  console.log(`\n[Connections] Done. Requests sent this session: ${stats.sent}`);
  return stats;
}

module.exports = { runConnections };

if (require.main === module) {
  runConnections().catch(console.error);
}
