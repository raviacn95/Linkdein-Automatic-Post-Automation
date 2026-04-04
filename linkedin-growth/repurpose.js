"use strict";

/**
 * Content Repurposing Engine
 * ---------------------------
 * Reads posts from posts-data.js and creates repurposed versions:
 *   - Adds a "♻️ Revisiting a key concept:" header
 *   - Auto-detects relevant hashtags from post content
 *   - Returns ready-to-post objects for the orchestrator to publish
 *
 * Tracks repurpose history in .auth/repurpose-history.json
 * so the same post is not repurposed more than once per interval.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { loadGrowthConfig, readJsonSafe, writeJsonSafe, STATE_DIR } = require("./helpers");

const REPURPOSE_HISTORY_FILE = path.join(STATE_DIR, "repurpose-history.json");
const POSTS_FILE = path.join(__dirname, "..", "posts-data.js");

// ── Load source posts ─────────────────────────────────────────────────────────

function loadAllPosts() {
  if (!fs.existsSync(POSTS_FILE)) return [];
  const code = fs.readFileSync(POSTS_FILE, "utf8");
  const sandbox = { console };
  try {
    vm.createContext(sandbox);
    vm.runInContext(`${code}\n;globalThis.__ALL_POSTS = ALL_POSTS;`, sandbox);
    return Array.isArray(sandbox.__ALL_POSTS) ? sandbox.__ALL_POSTS : [];
  } catch {
    return [];
  }
}

// ── Hashtag auto-detection ────────────────────────────────────────────────────

function detectHashtags(post, extraHashtags) {
  const content = ((post.content || "") + " " + (post.title || "")).toLowerCase();
  const detected = [];

  if (content.includes("playwright"))              detected.push("#Playwright");
  if (content.includes("typescript"))              detected.push("#TypeScript");
  if (content.includes("javascript"))              detected.push("#JavaScript");
  if (content.includes("automat"))                 detected.push("#TestAutomation");
  if (content.includes("sap"))                     detected.push("#SAPTesting");
  if (content.includes("api test"))                detected.push("#APITesting");
  if (content.includes("ci/cd") ||
      content.includes("github actions") ||
      content.includes("azure devops"))            detected.push("#CICD");
  if (content.includes("selenium"))                detected.push("#Selenium");
  if (content.includes("performance") ||
      content.includes("load test"))               detected.push("#PerformanceTesting");

  return [...new Set([...detected, ...(extraHashtags || [])])].slice(0, 5);
}

// ── Repurpose a single post ───────────────────────────────────────────────────

function repurposePost(post, extraHashtags) {
  const hashtags = detectHashtags(post, extraHashtags);
  const hashtagLine = hashtags.length > 0 ? "\n\n" + hashtags.join(" ") : "";

  return {
    title: post.title || "Repurposed Post",
    content: `♻️ Revisiting a key concept:\n\n${post.content || ""}${hashtagLine}`,
    level: post.level || "beginner",
    sourceUrl: post.sourceUrl || "",
    repurposedAt: new Date().toISOString(),
    originalId: post.id || post.title
  };
}

// ── Filter posts due for repurposing ─────────────────────────────────────────

function getPostsDueForRepurpose(allPosts, history, intervalDays, maxCount) {
  const now = Date.now();
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

  const repurposedMap = {};
  (history.repurposed || []).forEach((r) => {
    repurposedMap[r.id] = new Date(r.repurposedAt).getTime();
  });

  return allPosts
    .filter((post) => {
      const id = post.id || post.title;
      const lastRepurposed = repurposedMap[id];
      if (!lastRepurposed) return true;
      return now - lastRepurposed > intervalMs;
    })
    .slice(0, maxCount);
}

// ── Main entry ────────────────────────────────────────────────────────────────

async function runRepurpose() {
  const config = loadGrowthConfig();
  const cfg = config.repurpose;

  if (!cfg.enabled) {
    console.log("[Repurpose] Disabled in growth-config.json — skipping.");
    return { skipped: true, posts: [] };
  }

  console.log("\n=== LinkedIn Content Repurpose Engine ===");

  const allPosts = loadAllPosts();
  if (allPosts.length === 0) {
    console.log("[Repurpose] No posts found in posts-data.js.");
    return { posts: [] };
  }

  const history = readJsonSafe(REPURPOSE_HISTORY_FILE, { repurposed: [] });
  if (!Array.isArray(history.repurposed)) history.repurposed = [];

  const due = getPostsDueForRepurpose(
    allPosts,
    history,
    cfg.repurposeIntervalDays || 7,
    cfg.maxPostsToRepurpose || 3
  );

  if (due.length === 0) {
    console.log("[Repurpose] No posts are due for repurposing yet.");
    return { posts: [] };
  }

  const repurposed = due.map((post) =>
    repurposePost(post, cfg.extraHashtags || [])
  );

  // Record in history
  repurposed.forEach((r) => {
    history.repurposed.push({ id: r.originalId, repurposedAt: r.repurposedAt });
  });
  if (history.repurposed.length > 500) {
    history.repurposed = history.repurposed.slice(-500);
  }
  writeJsonSafe(REPURPOSE_HISTORY_FILE, history);

  console.log(`[Repurpose] ${repurposed.length} post(s) queued:`);
  repurposed.forEach((r, i) =>
    console.log(`  ${i + 1}. "${r.title}"`)
  );

  return { posts: repurposed };
}

module.exports = { runRepurpose };

if (require.main === module) {
  runRepurpose()
    .then((result) => {
      if (result.posts && result.posts.length > 0) {
        console.log("\nSample repurposed content preview:");
        console.log("─────────────────────────────────────────");
        console.log(result.posts[0].content.slice(0, 400));
        console.log("─────────────────────────────────────────");
      }
    })
    .catch(console.error);
}
