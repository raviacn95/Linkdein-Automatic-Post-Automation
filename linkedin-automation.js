const fs = require("fs");
const path = require("path");
const vm = require("vm");
const readline = require("readline");
const { chromium } = require("playwright");
const { createCanvas } = require("canvas");
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
  const rawContent = String(post.content || "");

  // ── Helpers ──────────────────────────────────────────
  function stripMd(text) {
    return text
      .replace(/```\w*\n?/g, "").replace(/```/g, "")
      .replace(/\*\*/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\r\n/g, "\n")
      .trim();
  }

  function extractSection(heading) {
    const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp("##\\s*(?:[\\u{1F4A1}\\u{2753}\\u{1F511}]\\s*)?" + esc + "[\\s\\S]*?(?=\\n##\\s|$)", "u");
    const m = rawContent.match(pattern);
    if (!m) return "";
    return stripMd(m[0].replace(/^##\s*[^\n]*\n?/, ""))
      .replace(/\n\s*-\s+/g, "\n\u2022 ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function firstLines(text, maxLines) {
    if (!text) return "";
    const lines = text.split("\n").filter((l) => l.trim());
    return lines.slice(0, maxLines).join("\n").trim();
  }

  function extractFirstCodeBlock() {
    const m = rawContent.match(/```\w*\n([\s\S]*?)```/);
    return m ? m[1].trim() : "";
  }

  function extractQA() {
    const qMatch = rawContent.match(/Q:\s*([^\n]+)/);
    const aMatch = rawContent.match(/A:\s*([^\n]+)/);
    if (qMatch && aMatch) return { q: qMatch[1].trim(), a: aMatch[1].trim() };
    // Try FAQ sections
    const faqMatch = rawContent.match(/###\s*([^\n?]+\?)\s*\n+([\s\S]*?)(?=\n###|\n##|$)/);
    if (faqMatch) return { q: faqMatch[1].trim(), a: stripMd(faqMatch[2]).split("\n")[0].trim() };
    return null;
  }

  // ── Build concise body sections (2-3 lines each) ────
  // Core Concept: first paragraph from "What is" or "How to Use" or first content paragraph
  let concept = extractSection("Core Concept");
  if (!concept) concept = extractSection("What is");
  if (!concept) concept = extractSection("How to Use");
  if (!concept) {
    // Fallback: first meaningful lines from content
    concept = stripMd(rawContent).replace(/^##[^\n]*\n?/, "").trim();
  }
  concept = firstLines(concept, 3);

  // Key Rules: from "Key Rules" or "Best Practices" — pick 3 bullet points
  let rules = extractSection("Key Rules");
  if (!rules) rules = extractSection("Best Practices");
  if (rules) {
    const bullets = rules.match(/[\u2022\-]\s*[^\n]+/g) || [];
    rules = bullets.slice(0, 3).map((b) => b.replace(/^[\-]\s*/, "\u2022 ")).join("\n\n");
  }

  // Try This: first code snippet, trimmed to 3 lines
  let tryCode = extractSection("Try This");
  if (!tryCode) {
    const code = extractFirstCodeBlock();
    tryCode = code ? firstLines(code, 3) : "";
  } else {
    tryCode = firstLines(tryCode, 3);
  }

  // Quick Quiz: first Q&A pair
  let quizText = "";
  const qa = extractQA();
  if (qa) {
    quizText = "Q: " + qa.q + "\n\nA: " + qa.a;
  }

  // Key Takeaway: from "Key Takeaway" or "Conclusion" — 2 lines
  let takeaway = extractSection("Key Takeaway");
  if (!takeaway) takeaway = extractSection("Conclusion");
  takeaway = firstLines(takeaway, 2);

  // ── Assemble ─────────────────────────────────────────
  const body = [];
  if (concept) body.push("Core Concept " + concept);
  if (rules) body.push("Key Rules\n\n" + rules);
  if (tryCode) body.push("\uD83D\uDCA1 Try This " + tryCode);
  if (quizText) body.push("\u2753 Quick Quiz\n\n" + quizText);
  if (takeaway) body.push("\uD83D\uDD11 Key Takeaway " + takeaway);

  // Final fallback
  const bodyText = body.length > 0 ? body.join("\n\n") : String(post.excerpt || "");

  // Build website deep link
  const slug = String(post.title || "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const websiteLink = "https://raviacn95.github.io/Linkdein-Automatic-Post-Automation/#post/" + slug;

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
    bodyText,
    "",
    separator,
    "",
    "\uD83D\uDD17 Read the full guide with code examples & step-by-step instructions:",
    websiteLink
  ];

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
}

// ── Workflow PNG Image Generator ─────────────────────────────────────────────

const WORKFLOW_IMAGES_DIR = path.join(__dirname, ".workflow-images");

function generateWorkflowPng(post) {
  if (!fs.existsSync(WORKFLOW_IMAGES_DIR)) fs.mkdirSync(WORKFLOW_IMAGES_DIR, { recursive: true });

  const title = String(post.title || "Topic Overview");
  const category = String(post.category || "JavaScript");
  const rawContent = String(post.content || "");
  const tags = Array.isArray(post.tags) ? post.tags.slice(0, 5) : [];

  // Extract 4-6 key workflow steps from content headings
  const headings = [];
  const hMatches = rawContent.matchAll(/^##\s+(.+)$/gm);
  for (const m of hMatches) {
    const h = m[1].replace(/[*`#]/g, "").trim();
    if (h && !h.startsWith("FAQ") && !h.startsWith("Related") && !h.startsWith("Conclusion")) {
      headings.push(h.length > 35 ? h.substring(0, 32) + "..." : h);
    }
    if (headings.length >= 5) break;
  }
  // Fallback steps if content has no headings
  if (headings.length < 3) {
    headings.length = 0;
    headings.push("Understand Concept", "Write Code", "Test & Validate", "Deploy & Monitor");
  }

  // ── Canvas Setup ──
  const W = 1200, H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ── Color scheme by category ──
  const schemes = {
    playwright: { bg1: "#0f172a", bg2: "#1e293b", accent: "#22d3ee", accent2: "#06b6d4", text: "#f1f5f9", badge: "#164e63" },
    javascript: { bg1: "#0f172a", bg2: "#1e293b", accent: "#fbbf24", accent2: "#f59e0b", text: "#f1f5f9", badge: "#78350f" },
    typescript: { bg1: "#0f172a", bg2: "#1e293b", accent: "#3b82f6", accent2: "#2563eb", text: "#f1f5f9", badge: "#1e3a5f" },
    both:       { bg1: "#0f172a", bg2: "#1e293b", accent: "#a78bfa", accent2: "#8b5cf6", text: "#f1f5f9", badge: "#4c1d95" },
    mcp:        { bg1: "#0f172a", bg2: "#1e293b", accent: "#34d399", accent2: "#10b981", text: "#f1f5f9", badge: "#065f46" },
    tosca:      { bg1: "#0f172a", bg2: "#1e293b", accent: "#fb7185", accent2: "#f43f5e", text: "#f1f5f9", badge: "#881337" }
  };
  const c = schemes[category.toLowerCase()] || schemes.javascript;

  // ── Background gradient ──
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, c.bg1);
  grad.addColorStop(1, c.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid pattern
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // ── Category badge ──
  ctx.fillStyle = c.badge;
  roundRect(ctx, 40, 30, ctx.measureText(category.toUpperCase()).width + 60, 36, 18);
  ctx.fill();
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillStyle = c.accent;
  ctx.textAlign = "center";
  ctx.fillText(category.toUpperCase(), 40 + (ctx.measureText(category.toUpperCase()).width + 60) / 2, 53);

  // ── Title ──
  ctx.textAlign = "left";
  ctx.fillStyle = c.text;
  ctx.font = "bold 28px Arial, sans-serif";
  const titleLines = wrapText(ctx, title, W - 100);
  let ty = 95;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, 40, ty);
    ty += 36;
  }

  // ── Accent underline ──
  const uGrad = ctx.createLinearGradient(40, ty, 300, ty);
  uGrad.addColorStop(0, c.accent);
  uGrad.addColorStop(1, "transparent");
  ctx.fillStyle = uGrad;
  ctx.fillRect(40, ty, 260, 3);

  // ── Workflow flow boxes ──
  const boxY = ty + 35;
  const boxH = 50;
  const gap = 16;
  const totalSteps = headings.length;
  const maxBoxW = Math.min(180, (W - 80 - gap * (totalSteps - 1)) / totalSteps);
  const totalW = totalSteps * maxBoxW + (totalSteps - 1) * gap;
  let bx = (W - totalW) / 2;

  for (let i = 0; i < totalSteps; i++) {
    const x = bx + i * (maxBoxW + gap);

    // Box with rounded corners
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, x, boxY, maxBoxW, boxH, 10);
    ctx.fill();

    // Border
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, boxY, maxBoxW, boxH, 10);
    ctx.stroke();

    // Step number circle
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(x + 20, boxY + boxH / 2, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.bg1;
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), x + 20, boxY + boxH / 2 + 5);

    // Step label
    ctx.fillStyle = c.text;
    ctx.font = "12px Arial, sans-serif";
    ctx.textAlign = "left";
    const label = headings[i].length > 18 ? headings[i].substring(0, 16) + ".." : headings[i];
    ctx.fillText(label, x + 38, boxY + boxH / 2 + 4);

    // Arrow between boxes
    if (i < totalSteps - 1) {
      const arrowX = x + maxBoxW + 2;
      const arrowY = boxY + boxH / 2;
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY - 5);
      ctx.lineTo(arrowX + gap - 4, arrowY);
      ctx.lineTo(arrowX, arrowY + 5);
      ctx.fill();
    }
  }

  // ── Crux summary line ──
  const summaryY = boxY + boxH + 40;
  const excerpt = String(post.excerpt || "").substring(0, 120);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "italic 16px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(excerpt + (post.excerpt && post.excerpt.length > 120 ? "..." : ""), W / 2, summaryY);

  // ── Tags row ──
  const tagY = summaryY + 35;
  ctx.font = "13px Arial, sans-serif";
  ctx.textAlign = "center";
  let tagStr = tags.map((t) => "#" + t).join("  ");
  ctx.fillStyle = c.accent2;
  ctx.fillText(tagStr, W / 2, tagY);

  // ── Bottom branding bar ──
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(0, H - 50, W, 50);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "13px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("raviacn95.github.io/Linkdein-Automatic-Post-Automation", 40, H - 22);
  ctx.textAlign = "right";
  ctx.fillStyle = c.accent;
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText("Ravi \u2022 Learning Hub", W - 40, H - 22);

  // ── Save ──
  const slug = title.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase().substring(0, 60);
  const imgPath = path.join(WORKFLOW_IMAGES_DIR, slug + ".png");
  fs.writeFileSync(imgPath, canvas.toBuffer("image/png"));
  return imgPath;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
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

async function postToLinkedIn(page, text, imagePath) {
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

  // ── Upload image if provided ──
  if (imagePath && fs.existsSync(imagePath)) {
    try {
      // Click the media/photo button in the composer toolbar
      const mediaClicked = await clickFirstVisible(page, [
        'button[aria-label*="Add media"]',
        'button[aria-label*="Add a photo"]',
        'button[aria-label*="photo"]',
        'button[aria-label*="image"]',
        'button[aria-label*="Media"]'
      ]);

      if (mediaClicked) {
        await humanDelay(page, 1000, 2000);
      }

      // Use file chooser to upload
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 8000 }),
        mediaClicked
          ? clickFirstVisible(page, [
              'button:has-text("Select from computer")',
              'button:has-text("Upload from computer")',
              'button:has-text("select files to share")',
              'label:has-text("Select")',
              'input[type="file"]'
            ])
          : Promise.resolve()
      ]).catch(() => [null]);

      if (fileChooser) {
        await fileChooser.setFiles(imagePath);
        console.log("  Uploaded workflow image: " + path.basename(imagePath));
        await humanDelay(page, 2000, 4000);

        // Click Done/Next if there's a media confirmation step
        await clickFirstVisible(page, [
          'button:has-text("Done")',
          'button:has-text("Next")',
          'button[aria-label="Done"]'
        ]);
        await humanDelay(page, 1000, 2000);
      } else {
        console.log("  Image upload: no file chooser detected, posting text only.");
      }
    } catch (imgErr) {
      console.log("  Image upload skipped: " + (imgErr.message || imgErr));
    }
  }

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

async function postToLinkedInWithRetry(page, text, imagePath) {
  try {
    await postToLinkedIn(page, text, imagePath);
    return;
  } catch (firstError) {
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    await postToLinkedIn(page, text, imagePath);
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

      // Generate workflow PNG for this topic
      let imagePath = null;
      try {
        imagePath = generateWorkflowPng(post);
        console.log("  Generated workflow image: " + path.basename(imagePath));
      } catch (imgErr) {
        console.log("  Workflow image generation failed: " + (imgErr.message || imgErr));
      }

      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });

      // Configurable pre-post delay
      await humanDelay(page, prePostMinSec * 1000, prePostMaxSec * 1000);

      try {
        await postToLinkedInWithRetry(page, text, imagePath);
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
