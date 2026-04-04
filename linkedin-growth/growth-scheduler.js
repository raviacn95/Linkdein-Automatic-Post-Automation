"use strict";

/**
 * LinkedIn Full Growth Scheduler
 * --------------------------------
 * Runs a complete cycle on a timed interval:
 *   Phase 1: Post new content  (linkedin-automation.js)
 *   Phase 2: Growth activities (engagement, connections, analytics, repurpose)
 *
 * Configure the cycle interval via growth-config.json → scheduler.fullCycleIntervalHours
 * Default: every 4 hours with ±10% jitter to avoid bot-detection patterns.
 *
 * Usage:
 *   node linkedin-growth/growth-scheduler.js
 *   npm run linkedin:growth:schedule
 */

const { runGrowth } = require("./growth-orchestrator");
const { loadGrowthConfig } = require("./helpers");

// Import existing post automation
let runLinkedInAutomation = null;
try {
  ({ runLinkedInAutomation } = require("../linkedin-automation"));
} catch {
  // Optional — growth runs fine without posting
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Full cycle: post + grow ───────────────────────────────────────────────────

async function runFullCycle(cycleNumber) {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log(`║  Full Cycle #${String(cycleNumber).padEnd(3)} — ${new Date().toLocaleString().padEnd(31)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝");

  // Phase 1 — Publish posts
  if (runLinkedInAutomation) {
    console.log("\n──── Phase 1: Publish Content ─────────────────────────────");
    try {
      await runLinkedInAutomation();
    } catch (err) {
      console.error("[Scheduler] Post automation error:", err.message);
    }
  } else {
    console.log("[Scheduler] Post automation not available — skipping Phase 1.");
  }

  // Phase 2 — Growth activities
  console.log("\n──── Phase 2: Growth Activities ───────────────────────────");
  try {
    await runGrowth();
  } catch (err) {
    console.error("[Scheduler] Growth automation error:", err.message);
  }

  console.log(`\n[Scheduler] Cycle #${cycleNumber} complete at ${new Date().toLocaleString()}`);
}

// ── Scheduler loop ────────────────────────────────────────────────────────────

async function startGrowthScheduler() {
  let config;
  try {
    config = loadGrowthConfig();
  } catch (err) {
    console.error("[Scheduler] Cannot load growth-config.json:", err.message);
    process.exit(1);
  }

  const sch = config.scheduler || {};
  const baseIntervalMs = (sch.fullCycleIntervalHours || 4) * 3600000;
  const jitterMs = Math.floor(baseIntervalMs * 0.1); // ±10%

  console.log("╔══════════════════════════════════════════╗");
  console.log("║   LinkedIn Full Growth Scheduler         ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`  Cycle interval: ${sch.fullCycleIntervalHours || 4}h ±10% jitter`);
  console.log(`  Started:        ${new Date().toLocaleString()}\n`);

  let cycleNumber = 0;

  // Run immediately on start
  cycleNumber += 1;
  await runFullCycle(cycleNumber).catch(console.error);

  // Schedule subsequent cycles with jitter
  const scheduleNext = () => {
    const delay = randomBetween(baseIntervalMs - jitterMs, baseIntervalMs + jitterMs);
    const nextRun = new Date(Date.now() + delay);
    console.log(
      `\n[Scheduler] Next cycle in ${formatDuration(delay)} ` +
      `(~${nextRun.toLocaleString()})`
    );
    setTimeout(async () => {
      cycleNumber += 1;
      await runFullCycle(cycleNumber).catch(console.error);
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}

startGrowthScheduler().catch((err) => {
  console.error(err);
  process.exit(1);
});
