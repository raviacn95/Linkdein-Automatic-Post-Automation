"use strict";

/**
 * LinkedIn Growth Orchestrator
 * -----------------------------
 * Runs all growth modules in sequence, respecting per-module intervals
 * so they are not re-run more frequently than configured.
 *
 * Modules:
 *   1. Analytics  — daily follower / impressions snapshot
 *   2. Engagement — like & comment on hashtag posts
 *   3. Connections — send personalised connection requests
 *   4. Repurpose  — prepare older posts for re-publishing
 *
 * Usage:
 *   node linkedin-growth/growth-orchestrator.js          # respects intervals
 *   node linkedin-growth/growth-orchestrator.js --force  # forces all modules
 */

const path = require("path");
const { runEngagement }  = require("./engagement");
const { runAutoLikeKeywords } = require("./auto-like-keywords");
const { runProfileViewLoop } = require("./profile-view-loop");
const { runConnections } = require("./connections");
const { runAnalytics }   = require("./analytics");
const { runRepurpose }   = require("./repurpose");
const { loadGrowthConfig, readJsonSafe, writeJsonSafe, STATE_DIR } = require("./helpers");

const GROWTH_STATE_FILE = path.join(STATE_DIR, "growth-state.json");

// ── Interval tracking ─────────────────────────────────────────────────────────

function msUntilNextRun(key, intervalHours) {
  const state = readJsonSafe(GROWTH_STATE_FILE, {});
  const lastRun = state[key] ? new Date(state[key]).getTime() : 0;
  const elapsed = Date.now() - lastRun;
  return Math.max(0, intervalHours * 3600000 - elapsed);
}

function isDue(key, intervalHours) {
  return msUntilNextRun(key, intervalHours) === 0;
}

function markRun(key) {
  const state = readJsonSafe(GROWTH_STATE_FILE, {});
  state[key] = new Date().toISOString();
  writeJsonSafe(GROWTH_STATE_FILE, state);
}

// ── Summary printer ───────────────────────────────────────────────────────────

function printSummary(results) {
  console.log("\n┌──────────────────────────────────────────┐");
  console.log("│             Growth Run Summary           │");
  console.log("└──────────────────────────────────────────┘");

  const a = results.analytics;
  if (a && a.skipped) {
    console.log(`  Analytics   — DISABLED`);
  } else if (a && !a.error) {
    console.log(
      `  Analytics   — Followers: ${a.followers ?? "N/A"} | ` +
      `Views: ${a.profileViews ?? "N/A"} | ` +
      `Impressions: ${a.postImpressions ?? "N/A"}`
    );
  }

  const e = results.engagement;
  if (e && e.skipped) {
    console.log(`  Engagement  — DISABLED`);
  } else if (e && !e.error) {
    console.log(`  Engagement  — Likes: ${e.likes}, Comments: ${e.comments}`);
  }

  const al = results.autoLikeKeywords;
  if (al && al.skipped) {
    console.log(`  AutoLike    — DISABLED`);
  } else if (al && !al.error) {
    console.log(`  AutoLike    — Checked: ${al.checked}, Matched: ${al.matched}, Liked: ${al.liked}`);
  }

  const pv = results.profileViewLoop;
  if (pv && pv.skipped) {
    console.log(`  ProfileView — DISABLED`);
  } else if (pv && !pv.error) {
    console.log(`  ProfileView — Opened: ${pv.opened}, Closed: ${pv.closed}`);
  }

  const c = results.connections;
  if (c && c.skipped) {
    console.log(`  Connections — DISABLED`);
  } else if (c && !c.error) {
    console.log(`  Connections — Requests sent: ${c.sent}`);
  }

  const r = results.repurpose;
  if (r && r.skipped) {
    console.log(`  Repurpose   — DISABLED`);
  } else if (r && r.posts && r.posts.length > 0) {
    console.log(`  Repurpose   — ${r.posts.length} post(s) queued`);
  }
}

// ── Main orchestration ────────────────────────────────────────────────────────

async function runGrowth({ forceAll = false } = {}) {
  let config;
  try {
    config = loadGrowthConfig();
  } catch (err) {
    console.error("[Growth] Cannot load growth-config.json:", err.message);
    process.exitCode = 1;
    return;
  }

  const sch = config.scheduler || {};
  const results = {};

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║     LinkedIn Growth Automation Suite     ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`  Started: ${new Date().toLocaleString()}\n`);

  // 1 ─ Analytics (runs daily by default)
  if (config.analytics && config.analytics.enabled) {
    const analyticsHrs = sch.analyticsIntervalHours || 24;
    if (forceAll || isDue("analytics", analyticsHrs) || sch.runAnalyticsImmediately) {
      try {
        results.analytics = await runAnalytics();
        markRun("analytics");
      } catch (err) {
        console.error("[Growth] Analytics error:", err.message);
        results.analytics = { error: err.message };
      }
    } else {
      const mins = Math.ceil(msUntilNextRun("analytics", analyticsHrs) / 60000);
      console.log(`[Analytics] Next run in ${mins} min — skipping.`);
    }
  } else {
    console.log(`[Analytics] Disabled in config — skipping.`);
    results.analytics = { skipped: true };
  }

  // 2 ─ Engagement (every N hours)
  if (config.engagement && config.engagement.enabled) {
    const engagementHrs = sch.engagementIntervalHours || 4;
    if (forceAll || isDue("engagement", engagementHrs) || sch.runEngagementImmediately) {
      try {
        results.engagement = await runEngagement();
        markRun("engagement");
      } catch (err) {
        console.error("[Growth] Engagement error:", err.message);
        results.engagement = { error: err.message };
      }
    } else {
      const mins = Math.ceil(msUntilNextRun("engagement", engagementHrs) / 60000);
      console.log(`[Engagement] Next run in ${mins} min — skipping.`);
    }
  } else {
    console.log(`[Engagement] Disabled in config — skipping.`);
    results.engagement = { skipped: true };
  }

  // 3 ─ Auto-Like Keywords (every N hours)
  if (config.autoLikeKeywords && config.autoLikeKeywords.enabled) {
    const autoLikeHrs = sch.autoLikeIntervalHours || 4;
    if (forceAll || isDue("autoLikeKeywords", autoLikeHrs) || sch.runAutoLikeImmediately) {
      try {
        results.autoLikeKeywords = await runAutoLikeKeywords();
        markRun("autoLikeKeywords");
      } catch (err) {
        console.error("[Growth] AutoLike error:", err.message);
        results.autoLikeKeywords = { error: err.message };
      }
    } else {
      const mins = Math.ceil(msUntilNextRun("autoLikeKeywords", autoLikeHrs) / 60000);
      console.log(`[AutoLike] Next run in ${mins} min — skipping.`);
    }
  } else {
    console.log(`[AutoLike] Disabled in config — skipping.`);
    results.autoLikeKeywords = { skipped: true };
  }

  // 4 ─ Profile View Loop (every N hours)
  if (config.profileViewLoop && config.profileViewLoop.enabled) {
    const profileViewHrs = sch.profileViewIntervalHours || 12;
    if (forceAll || isDue("profileViewLoop", profileViewHrs) || sch.runProfileViewImmediately) {
      try {
        results.profileViewLoop = await runProfileViewLoop();
        markRun("profileViewLoop");
      } catch (err) {
        console.error("[Growth] ProfileView error:", err.message);
        results.profileViewLoop = { error: err.message };
      }
    } else {
      const mins = Math.ceil(msUntilNextRun("profileViewLoop", profileViewHrs) / 60000);
      console.log(`[ProfileView] Next run in ${mins} min — skipping.`);
    }
  } else {
    console.log(`[ProfileView] Disabled in config — skipping.`);
    results.profileViewLoop = { skipped: true };
  }

  // 5 ─ Connections (every N hours)
  if (config.connections && config.connections.enabled) {
    const connectionHrs = sch.connectionIntervalHours || 8;
    if (forceAll || isDue("connections", connectionHrs) || sch.runConnectionsImmediately) {
      try {
        results.connections = await runConnections();
        markRun("connections");
      } catch (err) {
        console.error("[Growth] Connections error:", err.message);
        results.connections = { error: err.message };
      }
    } else {
      const mins = Math.ceil(msUntilNextRun("connections", connectionHrs) / 60000);
      console.log(`[Connections] Next run in ${mins} min — skipping.`);
    }
  } else {
    console.log(`[Connections] Disabled in config — skipping.`);
    results.connections = { skipped: true };
  }

  // 6 ─ Repurpose (weekly by default)
  if (config.repurpose && config.repurpose.enabled) {
    const repurposeHrs = sch.repurposeIntervalHours || 168;
    if (forceAll || isDue("repurpose", repurposeHrs)) {
      try {
        results.repurpose = await runRepurpose();
        markRun("repurpose");
      } catch (err) {
        console.error("[Growth] Repurpose error:", err.message);
        results.repurpose = { error: err.message };
      }
    } else {
      const hrs = Math.ceil(msUntilNextRun("repurpose", repurposeHrs) / 3600000);
      console.log(`[Repurpose] Next run in ${hrs}h — skipping.`);
    }
  } else {
    console.log(`[Repurpose] Disabled in config — skipping.`);
    results.repurpose = { skipped: true };
  }

  printSummary(results);
  console.log(`\n  Finished: ${new Date().toLocaleString()}`);
  return results;
}

module.exports = { runGrowth };

if (require.main === module) {
  const forceAll = process.argv.includes("--force");
  runGrowth({ forceAll }).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
