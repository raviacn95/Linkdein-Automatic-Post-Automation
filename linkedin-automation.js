const fs = require("fs");
const path = require("path");
const vm = require("vm");
const readline = require("readline");
const { chromium } = require("playwright");
const { generatePostsFromConfig, loadConfig } = require("./generate-posts-from-pdf");

const POSTS_FILE = path.join(__dirname, "posts-data.js");
const STATE_DIR = path.join(__dirname, ".auth");
const STORAGE_STATE_FILE = path.join(STATE_DIR, "linkedin-state.json");
const POST_HISTORY_FILE = path.join(STATE_DIR, "post-history.json");
const DAILY_LOG_FILE = path.join(STATE_DIR, "daily-post-count.json");

// Defaults — overridden by automation-config.json → safetyLimits
let MAX_HISTORY = 50;
let SIMILARITY_THRESHOLD = 0.6;
let MAX_POSTS_PER_DAY = 10;

// ── Human-like helpers ───────────────────────────────────────────────────────

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanDelay(page, minMs, maxMs) {
  const delay = randomBetween(minMs, maxMs);
  await page.waitForTimeout(delay);
}

async function humanScroll(page) {
  const scrolls = randomBetween(1, 3);
  for (let s = 0; s < scrolls; s++) {
    await page.mouse.wheel(0, randomBetween(150, 400));
    await humanDelay(page, 500, 1500);
  }
  // Scroll back up
  await page.mouse.wheel(0, -randomBetween(200, 500));
  await humanDelay(page, 400, 900);
}

async function humanType(page, editor, text) {
  // Type in chunks to simulate real typing behavior
  const chunkSize = randomBetween(80, 200);
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    await editor.pressSequentially(chunk, { delay: randomBetween(5, 20) });
    if (i + chunkSize < text.length) {
      await humanDelay(page, 200, 600);
    }
  }
}

function getDailyPostCount() {
  const today = new Date().toISOString().slice(0, 10);
  if (!fs.existsSync(DAILY_LOG_FILE)) return { date: today, count: 0 };
  try {
    const data = JSON.parse(fs.readFileSync(DAILY_LOG_FILE, "utf8"));
    return data.date === today ? data : { date: today, count: 0 };
  } catch {
    return { date: today, count: 0 };
  }
}

function incrementDailyPostCount() {
  const log = getDailyPostCount();
  log.count += 1;
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(DAILY_LOG_FILE, JSON.stringify(log, null, 2), "utf8");
  return log;
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

// ── Post History & Similarity ────────────────────────────────────────────────

function loadPostHistory() {
  if (!fs.existsSync(POST_HISTORY_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(POST_HISTORY_FILE, "utf8"));
    return Array.isArray(data) ? data.slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function savePostHistory(history) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(POST_HISTORY_FILE, JSON.stringify(history.slice(-MAX_HISTORY), null, 2), "utf8");
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function computeSimilarity(textA, textB) {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }
  // Jaccard similarity
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function isDuplicateOfHistory(postText, history) {
  for (const entry of history) {
    const sim = computeSimilarity(postText, entry.text);
    if (sim >= SIMILARITY_THRESHOLD) {
      return { match: true, similarity: sim, matchedTitle: entry.title };
    }
  }
  return { match: false };
}

function addToHistory(history, title, text) {
  history.push({ title, text, postedAt: new Date().toISOString() });
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

function loadAllPosts() {
  const source = fs.readFileSync(POSTS_FILE, "utf8");
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__ALL_POSTS = ALL_POSTS;`, sandbox);
  const posts = sandbox.__ALL_POSTS;

  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error("No posts found in posts-data.js");
  }

  return posts;
}

function buildLinkedInText(post) {
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const hashtags = tags.map((t) => `hashtag#${String(t).replace(/\s+/g, "")}`).join(" ");

  const topic = String(post.category || "JavaScript").toLowerCase();
  const painPointByTopic = {
    playwright: [
      "Tests keep failing after tiny UI changes and your team wastes hours debugging selectors."
    ],
    javascript: [
      "Debugging inconsistent runtime behavior steals time from feature delivery."
    ],
    typescript: [
      "Type errors slip through because strict mode is off and any is everywhere."
    ],
    both: [
      "Quality gaps between test and release pipelines cause last-minute firefighting."
    ],
    mcp: [
      "AI test workflows fail when tool context is incomplete or inconsistent."
    ],
    tosca: [
      "Model-based suites become brittle when app changes are not reflected quickly."
    ]
  };
  const painPoint = (painPointByTopic[topic] || painPointByTopic.javascript)[0];

  const separator = "\u2500".repeat(30);

  // Extract short summary sections from content
  const rawContent = String(post.content || "");

  function extractSection(heading) {
    // Match ## heading or ## emoji heading variants
    const pattern = new RegExp("##\\s*(?:[\\u{1F4A1}\\u{2753}\\u{1F511}]\\s*)?" + heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?(?=\\n##\\s|$)", "u");
    const m = rawContent.match(pattern);
    if (!m) return "";
    return m[0]
      .replace(/^##\s*[^\n]*\n?/, "")
      .replace(/```\w*\n?/g, "")
      .replace(/```/g, "")
      .replace(/\*\*/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\r\n/g, "\n")
      .replace(/\n\s*-\s+/g, "\n\n\u2022 ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const coreConcept = extractSection("Core Concept");
  const keyRules = extractSection("Key Rules");
  const tryThis = extractSection("Try This");
  const quickQuiz = extractSection("Quick Quiz");
  const keyTakeaway = extractSection("Key Takeaway");

  // Build concise LinkedIn body
  const bodyParts = [];
  if (coreConcept) bodyParts.push("Core Concept " + coreConcept);
  if (keyRules) bodyParts.push("Key Rules\n\n" + keyRules);
  if (tryThis) bodyParts.push("\uD83D\uDCA1 Try This " + tryThis);
  if (quickQuiz) {
    let quiz = quickQuiz
      .replace(/\s*(Q:\s)/g, "\n\nQ: ")
      .replace(/\s*(A:\s)/g, "\n\nA: ")
      .trim();
    bodyParts.push("\u2753 Quick Quiz\n\n" + quiz);
  }
  if (keyTakeaway) bodyParts.push("\uD83D\uDD11 Key Takeaway " + keyTakeaway);

  // Fallback: if no sections extracted, use excerpt as body
  const body = bodyParts.length > 0 ? bodyParts.join("\n\n") : String(post.excerpt || "");

  const parts = [
    painPoint,
    "",
    separator,
    "",
    post.title || "",
    "",
    post.excerpt || "",
    "",
    hashtags,
    "",
    separator,
    "",
    body
  ];

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
}

async function ensureLoggedIn(page, context) {
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });

  if (page.url().includes("/login") || page.url().includes("/checkpoint")) {
    console.log("Manual login required. Sign in in the opened browser, then press Enter here.");
    await ask("Press Enter after LinkedIn feed is visible...");
    await context.storageState({ path: STORAGE_STATE_FILE });
    console.log(`Saved session to ${STORAGE_STATE_FILE}`);
  }
}

async function clickFirstVisible(page, selectors) {
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if (await el.count()) {
      try {
        await el.click({ timeout: 4000 });
        return true;
      } catch {
        // Try next selector.
      }
    }
  }
  return false;
}

async function postToLinkedIn(page, text) {
  // Simulate browsing the feed briefly before posting
  await humanScroll(page);
  await humanDelay(page, 1000, 3000);

  const openedComposer = await clickFirstVisible(page, [
    'div[role="button"]:has-text("Start a post")',
    'button[aria-label*="Start a post"]',
    'button:has-text("Start a post")',
    'button:has-text("Create a post")',
    'div[role="button"]:has-text("Create a post")'
  ]);

  if (!openedComposer) {
    throw new Error("Could not open LinkedIn post composer.");
  }

  // Wait for composer to animate open
  await humanDelay(page, 1500, 3000);

  const editorCandidates = [
    'div[role="textbox"][contenteditable="true"]',
    'div[role="textbox"]',
    'div[aria-label*="Text editor"]',
    'div.ql-editor[contenteditable="true"]',
    'div[data-placeholder*="What do you want to talk about"]'
  ];

  let editor = null;
  for (const selector of editorCandidates) {
    const candidate = page.locator(selector).first();
    try {
      await candidate.waitFor({ timeout: 5000 });
      editor = candidate;
      break;
    } catch {
      // Try next editor selector.
    }
  }

  if (!editor) {
    throw new Error("Could not find LinkedIn post editor.");
  }

  await editor.click();
  await humanDelay(page, 500, 1200);

  // Type like a human — in chunks with small pauses
  await humanType(page, editor, text);

  // Pause before clicking Post (like a human reviewing)
  await humanDelay(page, 2000, 5000);

  const postButton = page.locator('button:has-text("Post")').last();
  await postButton.waitFor({ timeout: 10000 });
  await humanDelay(page, 500, 1500);
  await postButton.click();

  // Check for duplicate post warning within 4 seconds
  const duplicateWarning = page.locator('text="It appears that this post has already been shared"');
  const isDuplicate = await duplicateWarning.isVisible({ timeout: 4000 }).catch(() => false);
  if (isDuplicate) {
    const dismissSelectors = [
      'button[aria-label="Dismiss"]',
      'button:has-text("Discard")',
      'button:has-text("Cancel")',
      'button[aria-label="Close"]'
    ];
    for (const sel of dismissSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click().catch(() => {});
        break;
      }
    }
    throw new Error("DUPLICATE_POST");
  }

  // Wait for post to publish
  await humanDelay(page, 3000, 6000);
}

async function postToLinkedInWithRetry(page, text) {
  try {
    await postToLinkedIn(page, text);
    return;
  } catch (firstError) {
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    await postToLinkedIn(page, text);
    console.log(`Recovered after retry: ${firstError.message || firstError}`);
  }
}

async function runLinkedInAutomation(options = {}) {
  const config = loadConfig();

  // Load safety limits from config
  const safety = config.safetyLimits || {};
  MAX_HISTORY = Number(safety.maxHistory || 50);
  SIMILARITY_THRESHOLD = Number(safety.similarityThreshold || 0.6);
  MAX_POSTS_PER_DAY = Number(safety.maxPostsPerDay || 10);

  // Load timing config
  const linkedinCfg = config.linkedin || {};
  const delayMinSec = Number(linkedinCfg.delayBetweenPostsMinSec || 30);
  const delayMaxSec = Number(linkedinCfg.delayBetweenPostsMaxSec || 90);
  const prePostMinSec = Number(linkedinCfg.prePostDelayMinSec || 2);
  const prePostMaxSec = Number(linkedinCfg.prePostDelayMaxSec || 5);

  if (config.contentGeneration?.autoGenerateOnEveryRun) {
    await generatePostsFromConfig({ silent: false });
  }

  const allPosts = loadAllPosts();
  const requestedCount = Number(process.env.POST_COUNT || linkedinCfg.postCount || 1);

  if (Number.isNaN(requestedCount) || requestedCount < 1) {
    throw new Error("POST_COUNT must be a positive integer.");
  }

  // Prefer posts NOT yet in LinkedIn history (newest first)
  const history = loadPostHistory();
  const unposted = allPosts.filter((post) => {
    const text = buildLinkedInText(post);
    return !isDuplicateOfHistory(text, history).match;
  });

  let selected;
  if (unposted.length > 0) {
    // Take the newest unposted posts (end of array = most recently generated)
    selected = unposted.slice(-requestedCount).reverse();
    console.log("Selected " + selected.length + " unposted post(s) for LinkedIn.");
  } else {
    // All posts already posted — pick random ones for re-sharing
    const shuffled = [...allPosts].sort(() => Math.random() - 0.5);
    selected = shuffled.slice(0, requestedCount);
    console.log("All posts already posted. Re-sharing " + selected.length + " random post(s).");
  }

  if (selected.length === 0) {
    throw new Error("No posts available to post.");
  }

  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: false, channel: "msedge" });
  const context = await browser.newContext(
    fs.existsSync(STORAGE_STATE_FILE) ? { storageState: STORAGE_STATE_FILE } : {}
  );
  const page = await context.newPage();

  try {
    await ensureLoggedIn(page, context);

    const history = loadPostHistory();
    const dailyLog = getDailyPostCount();
    let posted = 0;

    if (dailyLog.count >= MAX_POSTS_PER_DAY) {
      console.log(`Daily limit reached (${dailyLog.count}/${MAX_POSTS_PER_DAY}). Skipping this cycle.`);
      return;
    }

    for (let i = 0; i < selected.length; i += 1) {
      if (getDailyPostCount().count >= MAX_POSTS_PER_DAY) {
        console.log(`Daily limit reached (${MAX_POSTS_PER_DAY}). Stopping.`);
        break;
      }

      const post = selected[i];
      const text = buildLinkedInText(post);

      const dupCheck = isDuplicateOfHistory(text, history);
      if (dupCheck.match) {
        console.log(`Skipped (${Math.round(dupCheck.similarity * 100)}% similar to "${dupCheck.matchedTitle}"): ${post.title}`);
        continue;
      }

      console.log(`Posting ${posted + 1}/${selected.length}: ${post.title}`);
      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });

      // Configurable pre-post delay
      await humanDelay(page, prePostMinSec * 1000, prePostMaxSec * 1000);

      try {
        await postToLinkedInWithRetry(page, text);
        addToHistory(history, post.title, text);
        savePostHistory(history);
        incrementDailyPostCount();
        posted += 1;
      } catch (postError) {
        if ((postError.message || "").includes("DUPLICATE_POST")) {
          console.log(`Skipped (LinkedIn duplicate): ${post.title}`);
          addToHistory(history, post.title, text);
          savePostHistory(history);
          continue;
        }
        throw postError;
      }

      // Configurable randomized delay between posts
      if (i < selected.length - 1) {
        const waitMs = randomBetween(delayMinSec * 1000, delayMaxSec * 1000);
        console.log(`  Waiting ${Math.round(waitMs / 1000)}s before next post...`);
        await page.waitForTimeout(waitMs);
      }
    }

    console.log(`Automation finished. Posted ${posted}/${selected.length}.`);
    await context.storageState({ path: STORAGE_STATE_FILE });
  } finally {
    if (!options.keepBrowserOpen) {
      await browser.close();
    }
  }
}

if (require.main === module) {
  runLinkedInAutomation().catch((error) => {
    console.error("Automation failed:", error.message || error);
    process.exit(1);
  });
}

module.exports = {
  runLinkedInAutomation
};
