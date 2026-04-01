const { runLinkedInAutomation } = require("./linkedin-automation");
const { loadConfig } = require("./generate-posts-from-pdf");

function minutesToMs(minutes) {
  return Math.max(0, Number(minutes) * 60 * 1000);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function jitteredInterval(baseMs, jitterPercent) {
  const pct = Math.max(0, Math.min(50, Number(jitterPercent || 20)));
  const jitter = Math.floor(baseMs * (pct / 100));
  return randomBetween(baseMs - jitter, baseMs + jitter);
}

async function runScheduler() {
  const config = loadConfig();
  const scheduler = config.scheduler || {};
  const baseIntervalMs = minutesToMs(scheduler.intervalMinutes);
  const jitterPercent = Number(scheduler.intervalJitterPercent || 20);
  const runImmediately = Boolean(scheduler.runImmediately);
  const maxRuns = Number(scheduler.maxRuns || 0);

  if (!scheduler.enabled) {
    console.log("Scheduler is disabled in automation-config.json");
    return;
  }

  if (!Number.isFinite(baseIntervalMs) || baseIntervalMs <= 0) {
    throw new Error("scheduler.intervalMinutes must be greater than 0 in automation-config.json");
  }

  if (Number.isNaN(maxRuns) || maxRuns < 0) {
    throw new Error("scheduler.maxRuns must be 0 or a positive integer.");
  }

  let runCount = 0;

  const executeCycle = async () => {
    runCount += 1;
    console.log(`Scheduler cycle ${runCount} started at ${new Date().toLocaleString()}`);

    try {
      await runLinkedInAutomation();
      console.log(`Scheduler cycle ${runCount} completed.`);
    } catch (error) {
      console.error(`Scheduler cycle ${runCount} failed:`, error.message || error);
    }

    if (maxRuns > 0 && runCount >= maxRuns) {
      console.log(`Reached maxRuns=${maxRuns}. Scheduler stopping.`);
      process.exit(0);
    }
  };

  if (runImmediately) {
    await executeCycle();
  }

  // Use recursive setTimeout with jittered delay instead of fixed setInterval
  const scheduleNext = () => {
    const nextMs = jitteredInterval(baseIntervalMs, jitterPercent);
    const nextMin = Math.round(nextMs / 60000);
    console.log(`Scheduler active. Next run in ~${nextMin} minute(s).`);
    setTimeout(async () => {
      try {
        await executeCycle();
      } catch (error) {
        console.error("Unexpected scheduler error:", error.message || error);
      }
      scheduleNext();
    }, nextMs);
  };

  scheduleNext();
}

runScheduler().catch((error) => {
  console.error("Scheduler failed:", error.message || error);
  process.exit(1);
});
