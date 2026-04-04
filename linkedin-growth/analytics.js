"use strict";

/**
 * LinkedIn Analytics Tracker
 * ---------------------------
 * Navigates to LinkedIn dashboard and creator analytics pages,
 * scrapes follower count, profile views, post impressions, search
 * appearances, and connections count.
 *
 * Saves:
 *   - JSON time-series: .auth/analytics-history.json
 *   - CSV log:          .auth/analytics-history.csv  (Excel-ready)
 */

const fs = require("fs");
const path = require("path");
const {
  humanDelay,
  humanScroll,
  launchBrowser,
  persistSession,
  ensureLoggedIn,
  loadGrowthConfig,
  readJsonSafe,
  writeJsonSafe,
  STATE_DIR
} = require("./helpers");

const ANALYTICS_JSON_FILE = path.join(STATE_DIR, "analytics-history.json");
const ANALYTICS_CSV_FILE  = path.join(STATE_DIR, "analytics-history.csv");

// ── CSV helper ────────────────────────────────────────────────────────────────

function appendCsvRow(csvPath, row) {
  const cols = [
    row.date,
    row.followers,
    row.profileViews,
    row.postImpressions,
    row.searchAppearances,
    row.connections
  ].map((v) => (v == null ? "" : String(v)));

  const line = cols.join(",") + "\n";

  if (!fs.existsSync(csvPath)) {
    const header = "date,followers,profileViews,postImpressions,searchAppearances,connections\n";
    fs.writeFileSync(csvPath, header + line, "utf8");
  } else {
    fs.appendFileSync(csvPath, line, "utf8");
  }
}

function parseStatNumber(text) {
  if (!text) return null;
  const match = text.match(/[\d,]+/);
  return match ? parseInt(match[0].replace(/,/g, ""), 10) : null;
}

// ── Scraping routines ─────────────────────────────────────────────────────────

async function scrapeConnections(page, data) {
  try {
    await page.goto(
      "https://www.linkedin.com/mynetwork/invite-connect/connections/",
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await humanDelay(page, 2000, 3500);

    const text = await page
      .locator(".mn-connections__header h1, .t-black--light")
      .first()
      .innerText()
      .catch(() => "");

    data.connections = parseStatNumber(text);
    if (data.connections) {
      console.log(`  Connections: ${data.connections}`);
    }
  } catch { /* analytics page may vary */ }
}

async function scrapeDashboard(page, data) {
  try {
    await page.goto(
      "https://www.linkedin.com/dashboard/",
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await humanDelay(page, 2500, 4000);
    await humanScroll(page, 1);

    // Profile views
    const viewsText = await page
      .locator(
        ".profile-nav-item--profile-views span, " +
        "[data-view-name='profile-card-profile-views'] .t-bold, " +
        ".pv-dashboard-analytics__pv-value"
      )
      .first()
      .innerText()
      .catch(() => "");
    data.profileViews = parseStatNumber(viewsText);
    if (data.profileViews) console.log(`  Profile Views: ${data.profileViews}`);

    // Search appearances
    const searchText = await page
      .locator(
        "[data-view-name='profile-card-search-appearances'] .t-bold, " +
        ".pv-dashboard-analytics__sa-value"
      )
      .first()
      .innerText()
      .catch(() => "");
    data.searchAppearances = parseStatNumber(searchText);
    if (data.searchAppearances) {
      console.log(`  Search Appearances: ${data.searchAppearances}`);
    }
  } catch { /* dashboard layout can vary */ }
}

async function scrapeCreatorAnalytics(page, data) {
  try {
    // Try the creator analytics page first
    await page.goto(
      "https://www.linkedin.com/analytics/creator/",
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await humanDelay(page, 3000, 5000);
    await humanScroll(page, 2);

    // Follower count
    const followerText = await page
      .locator(
        "[data-test-analytics-section='follower-count'] .t-bold, " +
        ".analytics-creator-growth-card .t-statistic, " +
        ".analytics-overview-follower-count"
      )
      .first()
      .innerText()
      .catch(() => "");
    data.followers = parseStatNumber(followerText);
    if (data.followers) console.log(`  Followers: ${data.followers}`);

    // Post impressions
    const impressionText = await page
      .locator(
        "[data-test-analytics-section='impressions'] .t-bold, " +
        ".analytics-impressions-count"
      )
      .first()
      .innerText()
      .catch(() => "");
    data.postImpressions = parseStatNumber(impressionText);
    if (data.postImpressions) {
      console.log(`  Post Impressions: ${data.postImpressions}`);
    }

  } catch { /* creator analytics is only unlocked for pages with followers */ }

  // Fallback: try page analytics URL
  if (data.followers == null) {
    try {
      await page.goto(
        "https://www.linkedin.com/me/",
        { waitUntil: "domcontentloaded", timeout: 30000 }
      );
      await humanDelay(page, 2000, 3500);

      const followerText = await page
        .locator(".pv-top-card--list .t-normal, .follower-count-info span")
        .first()
        .innerText()
        .catch(() => "");
      data.followers = parseStatNumber(followerText);
    } catch { /* ignore */ }
  }
}

// ── Main entry ────────────────────────────────────────────────────────────────

async function runAnalytics() {
  const config = loadGrowthConfig();
  const cfg = config.analytics;

  if (!cfg.enabled) {
    console.log("[Analytics] Disabled in growth-config.json — skipping.");
    return { skipped: true };
  }

  console.log("\n=== LinkedIn Analytics Tracker ===");
  const { browser, context, page } = await launchBrowser(false);

  const data = {
    date: new Date().toISOString(),
    followers: null,
    profileViews: null,
    postImpressions: null,
    searchAppearances: null,
    connections: null
  };

  try {
    const loggedIn = await ensureLoggedIn(page, context);
    if (!loggedIn) {
      console.error(
        "[Analytics] Not logged in to LinkedIn. " +
        "Run 'npm run linkedin:post' first to authenticate."
      );
      return { error: "not_logged_in" };
    }

    console.log("[Analytics] Session verified. Scraping metrics...");

    await scrapeConnections(page, data);
    await scrapeDashboard(page, data);
    await scrapeCreatorAnalytics(page, data);

    // ── Persist JSON time-series ─────────────────────────────────────────
    const history = readJsonSafe(ANALYTICS_JSON_FILE, { snapshots: [] });
    if (!Array.isArray(history.snapshots)) history.snapshots = [];
    history.snapshots.push(data);
    if (history.snapshots.length > 365) {
      history.snapshots = history.snapshots.slice(-365);
    }
    writeJsonSafe(ANALYTICS_JSON_FILE, history);

    // ── Append CSV row ───────────────────────────────────────────────────
    const csvPath = cfg.outputCsvPath
      ? path.join(path.dirname(__dirname), cfg.outputCsvPath)
      : ANALYTICS_CSV_FILE;

    appendCsvRow(csvPath, {
      date: data.date.slice(0, 10),
      followers: data.followers,
      profileViews: data.profileViews,
      postImpressions: data.postImpressions,
      searchAppearances: data.searchAppearances,
      connections: data.connections
    });

    console.log(`\n[Analytics] Snapshot saved to ${csvPath}`);
    console.log("─────────────────────────────────────────");
    console.log(`  Followers:          ${data.followers ?? "N/A"}`);
    console.log(`  Profile Views:      ${data.profileViews ?? "N/A"}`);
    console.log(`  Post Impressions:   ${data.postImpressions ?? "N/A"}`);
    console.log(`  Search Appearances: ${data.searchAppearances ?? "N/A"}`);
    console.log(`  Connections:        ${data.connections ?? "N/A"}`);
    console.log("─────────────────────────────────────────");

    return data;
  } finally {
    await persistSession(context);
    await browser.close();
  }
}

// ── Print historical trend ────────────────────────────────────────────────────

function printTrend() {
  const history = readJsonSafe(ANALYTICS_JSON_FILE, { snapshots: [] });
  const snaps = history.snapshots;
  if (snaps.length < 2) {
    console.log("Not enough data for trend. Run analytics a few times first.");
    return;
  }
  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  const days = Math.round(
    (new Date(last.date) - new Date(first.date)) / (86400 * 1000)
  );
  console.log(`\n=== Follower Trend (${days} days) ===`);
  console.log(
    `  ${first.date.slice(0, 10)}: ${first.followers ?? "N/A"} followers`
  );
  console.log(
    `  ${last.date.slice(0, 10)}: ${last.followers ?? "N/A"} followers`
  );
  if (first.followers != null && last.followers != null) {
    const diff = last.followers - first.followers;
    console.log(`  Change: ${diff >= 0 ? "+" : ""}${diff}`);
  }
}

module.exports = { runAnalytics, printTrend };

if (require.main === module) {
  const showTrend = process.argv.includes("--trend");
  if (showTrend) {
    printTrend();
  } else {
    runAnalytics().catch(console.error);
  }
}
