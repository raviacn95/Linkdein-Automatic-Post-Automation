const fs = require("fs");
const path = require("path");
const vm = require("vm");
const readline = require("readline");
const { chromium } = require("playwright");
const { createCanvas } = require("canvas");

const { generatePostsFromConfig, loadConfig } = require("./generate-posts-from-pdf");
const { getUniquePolls } = require("./poll-generator");
// ── LinkedIn Poll Posting Automation ─────────────────────────────────────────
async function postLinkedInPolls(options = {}) {
  const config = loadConfig();
  const linkedinCfg = config.linkedin || {};
  const delayMinSec = Number(linkedinCfg.delayBetweenPostsMinSec || 30);
  const delayMaxSec = Number(linkedinCfg.delayBetweenPostsMaxSec || 90);
  const prePostMinSec = Number(linkedinCfg.prePostDelayMinSec || 2);
  const prePostMaxSec = Number(linkedinCfg.prePostDelayMaxSec || 5);

  // Load poll history to avoid duplicates
  const POLL_HISTORY_FILE = path.join(STATE_DIR, "poll-history.json");
  let pollHistory = [];
  if (fs.existsSync(POLL_HISTORY_FILE)) {
    try {
      pollHistory = JSON.parse(fs.readFileSync(POLL_HISTORY_FILE, "utf8"));
    } catch { pollHistory = []; }
  }
  // Get unique polls, avoiding last 200 questions
  const polls = getUniquePolls(5, pollHistory.map(p => p.question));
  if (!polls.length) throw new Error("No unique polls available");

  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false, channel: "msedge" });
  const context = await browser.newContext(
    fs.existsSync(STORAGE_STATE_FILE) ? { storageState: STORAGE_STATE_FILE } : {}
  );
  const page = await context.newPage();

  try {
    await ensureLoggedIn(page, context);

    for (let i = 0; i < polls.length; i++) {
      const poll = polls[i];
      // Go to LinkedIn feed with retry
      let gotoTries = 0, gotoSuccess = false;
      while (gotoTries < 3 && !gotoSuccess) {
        try {
          await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 90000 });
          gotoSuccess = true;
        } catch (e) {
          await page.waitForTimeout(3000);
          gotoTries++;
        }
      }
      if (!gotoSuccess) {
        console.error("Failed to load LinkedIn feed after retries. Skipping poll.");
        continue;
      }
      await humanDelay(page, prePostMinSec * 1000, prePostMaxSec * 1000);

      // Open poll composer with retry and fallback selectors
      const composerSelectors = [
        'div[role="button"]:has-text("Start a post")',
        'button[aria-label*="Start a post"]',
        'button:has-text("Start a post")',
        'button:has-text("Create a post")',
        'div[role="button"]:has-text("Create a post")'
      ];
      let composerTries = 0, openedComposer = false;
      while (composerTries < 3 && !openedComposer) {
        openedComposer = await clickFirstVisible(page, composerSelectors);
        if (!openedComposer) {
          await page.waitForTimeout(2000);
          composerTries++;
        }
      }
      if (!openedComposer) {
        await page.screenshot({ path: `poll-composer-fail-${i}.png` });
        console.error("Could not open LinkedIn post composer. Skipping poll.");
        continue;
      }
      await humanDelay(page, 1200, 2500);

      // Click the '+' sign to expand more options (retry)
      let plusTries = 0, plusClicked = false;
      while (plusTries < 2 && !plusClicked) {
        const plusButton = page.locator('button:has(svg[data-test-icon="add-medium"])').first();
        try {
          await plusButton.waitFor({ timeout: 8000 });
          await plusButton.click();
          await humanDelay(page, 500, 1200);
          plusClicked = true;
        } catch (e) {
          plusTries++;
        }
      }

      // Click the Poll button with robust selectors and retry
      const pollSelectors = [
        'button:has(svg[data-test-icon="analytics-medium"])',
        'button[aria-label*="Poll"]',
        'button:has-text("Poll")',
        'button[title*="Poll"]',
        'button[data-control-name*="poll"]'
      ];
      let pollBtnTries = 0, pollBtnClicked = false;
      while (pollBtnTries < 3 && !pollBtnClicked) {
        let pollButton = null;
        for (const sel of pollSelectors) {
          pollButton = page.locator(sel).first();
          try {
            await pollButton.waitFor({ timeout: 12000 });
            await pollButton.click();
            pollBtnClicked = true;
            break;
          } catch (e) {
            // Try next selector
          }
        }
        if (!pollBtnClicked) {
          await page.waitForTimeout(2000);
          pollBtnTries++;
        }
      }
      if (!pollBtnClicked) {
        await page.screenshot({ path: `poll-btn-fail-${i}.png` });
        console.error("Could not find/click Poll button. Skipping poll.");
        continue;
      }
      await humanDelay(page, 800, 1800);



      // Wait for poll dialog to fully render
      await page.waitForTimeout(2000);

      // Try robust selectors for poll question textarea
      let qInput = page.locator('textarea[placeholder*="your question" i],textarea[placeholder*="question" i]').first();
      try {
        await qInput.waitFor({ timeout: 12000 });
      } catch (e) {
        // Fallback: any visible textarea in the dialog
        qInput = page.locator('form textarea').first();
        try {
          await qInput.waitFor({ timeout: 6000 });
        } catch (e2) {
          // Take screenshot for debugging
          await page.screenshot({ path: 'poll-dialog-debug.png' });
          throw new Error('Poll question textarea not found. Screenshot saved as poll-dialog-debug.png');
        }
      }
      await qInput.fill(poll.question);

      // Shuffle answers, trim to 30 chars, ensure unique and non-empty
      let allAnswers = [poll.correct, ...poll.distractors]
        .map(ans => String(ans).slice(0, 30).trim())
        .filter(ans => ans.length > 0);
      // Ensure uniqueness
      allAnswers = Array.from(new Set(allAnswers));
      // If less than 4 unique, pad with generic distractors
      const genericDistractors = ["Option A", "Option B", "Option C", "Option D", "Other"]; 
      while (allAnswers.length < 4) {
        const next = genericDistractors[allAnswers.length % genericDistractors.length];
        if (!allAnswers.includes(next)) allAnswers.push(next);
      }
      // Shuffle
      allAnswers = allAnswers.sort(() => Math.random() - 0.5);

      // Wait for option fields to render
      await page.waitForTimeout(1000);

      // Try robust selectors for option fields
      let optionInputs = [];
      try {
        // Scope to poll dialog/form: find the closest form to the question textarea
        const pollForm = await qInput.evaluateHandle(node => node.closest('form'));
        optionInputs = await page.locator('input[placeholder^="E.g."]', pollForm).all();
        if (optionInputs.length < 2) throw new Error('Not enough option fields');
      } catch (e) {
        // Fallback: any visible input fields in the poll form
        const pollForm = await qInput.evaluateHandle(node => node.closest('form'));
        optionInputs = await page.locator('input[type="text"]', pollForm).all();
        if (optionInputs.length < 2) {
          await page.screenshot({ path: 'poll-options-debug.png' });
          throw new Error('Poll option input fields not found. Screenshot saved as poll-options-debug.png');
        }
      }

      // Fill first two options
      for (let j = 0; j < 2; j++) {
        await optionInputs[j].fill(allAnswers[j] || "");
      }

      // Click '+ Add option' for the next two
      for (let j = 2; j < 4; j++) {
        const addOptionBtn = page.locator('button:has-text("Add option")').first();
        await addOptionBtn.waitFor({ timeout: 8000 });
        await addOptionBtn.click();
        // Wait for the new input to appear (longer wait for robustness)
        await page.waitForTimeout(2000);
        // Debug: log all input fields and their visibility after clicking Add option
        const pollForm = await qInput.evaluateHandle(node => node.closest('form'));
        let allInputs = await page.locator('input', pollForm).all();
        let debugInputs = [];
        for (const inp of allInputs) {
          const placeholder = await inp.getAttribute('placeholder');
          const visible = await inp.isVisible();
          debugInputs.push({ placeholder, visible });
        }
        console.log(`All poll option inputs after Add option (j=${j}):`, debugInputs);
        await page.screenshot({ path: `poll-options-debug-allinputs-${j}.png` });
        // Wait until the number of visible option inputs increases
        let tries = 0;
        let found = false;
        while (tries < 10) {
          let allInputs = await page.locator('input[placeholder^="E.g."]', pollForm).all();
          optionInputs = [];
          for (const inp of allInputs) {
            if (await inp.isVisible()) optionInputs.push(inp);
          }
          if (optionInputs.length > j) { found = true; break; }
          await page.waitForTimeout(400);
          tries++;
        }
        // Log for debugging
        console.log(`Detected ${optionInputs.length} visible option inputs after Add option (j=${j})`);
        if (!found) {
          await page.screenshot({ path: `poll-options-debug-${j}.png` });
          throw new Error(`Poll option input field ${j+1} not found. Screenshot saved as poll-options-debug-${j}.png`);
        }
        await optionInputs[j].fill(allAnswers[j] || "");
      }

      // --- Validation: Check for LinkedIn poll errors before clicking 'Done' ---
      let retryCount = 0;
      let pollValid = false;
      while (retryCount < 3 && !pollValid) {
        await page.waitForTimeout(800);
        const pollForm = await qInput.evaluateHandle(node => node.closest('form'));
        const errorMessages = await page.locator('[class*="error" i], [class*="Error" i], [role="alert"], .artdeco-inline-feedback').allTextContents();
        const hasError = errorMessages.some(msg => msg && msg.trim().length > 0 && !msg.includes('modal window'));
        if (!hasError) {
          pollValid = true;
          break;
        }
        console.log('LinkedIn poll validation error detected:', errorMessages);
        await page.screenshot({ path: `poll-validation-error-retry${retryCount+1}.png` });
        // Regenerate answers and refill
        allAnswers = [poll.correct, ...poll.distractors, 'Option A', 'Option B', 'Option C', 'Option D', 'Other']
          .map(ans => String(ans).slice(0, 30).trim())
          .filter(ans => ans.length > 0);
        allAnswers = Array.from(new Set(allAnswers)).sort(() => Math.random() - 0.5).slice(0, 4);
        for (let j = 0; j < 4; j++) {
          await optionInputs[j].fill('');
          await page.waitForTimeout(200);
          await optionInputs[j].fill(allAnswers[j] || '');
        }
        retryCount++;
      }
      if (!pollValid) {
        throw new Error('Poll validation error detected after retries. Please check poll options for compliance.');
      }

      // Optionally set poll duration (skip for default)

  // Click 'Done' after filling 4 options
      // Use a stable locator for the 'Done' button (role=button, text=Done, enabled)
      const doneBtn = page.getByRole('button', { name: /^done$/i, exact: true });
      try {
        await doneBtn.waitFor({ state: 'visible', timeout: 30000 });
        await page.waitForFunction(
          (el) => el && !el.disabled && el.offsetParent !== null,
          await doneBtn.elementHandle(),
          { timeout: 30000 }
        );
      } catch (e) {
        await page.screenshot({ path: 'poll-done-btn-debug.png' });
        throw new Error('Done button did not become enabled after 30s. Screenshot saved as poll-done-btn-debug.png');
      }
      await humanDelay(page, 400, 900);
      await doneBtn.click();
      await humanDelay(page, 1200, 2500);

  // Post the poll
  const postBtn = page.locator('button:has-text("Post")').last();
  await postBtn.waitFor({ timeout: 10000 });
  await humanDelay(page, 500, 1200);
  await postBtn.click();
  await humanDelay(page, 2500, 5000);

      // Wait between polls
      if (i < polls.length - 1) {
        const waitMs = randomBetween(delayMinSec * 1000, delayMaxSec * 1000);
        await page.waitForTimeout(waitMs);
      }
      // Add to poll history and save (keep last 200)
      pollHistory.push({ question: poll.question, postedAt: new Date().toISOString() });
      if (pollHistory.length > 200) pollHistory = pollHistory.slice(-200);
      fs.writeFileSync(POLL_HISTORY_FILE, JSON.stringify(pollHistory, null, 2), "utf8");
    }
    await context.storageState({ path: STORAGE_STATE_FILE });
  } finally {
    if (!options.keepBrowserOpen) {
      try {
        await Promise.race([
          browser.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("browser.close timeout")), 10000))
        ]);
      } catch (closeErr) {
        try { browser.process()?.kill("SIGKILL"); } catch {}
      }
    }
  }
}

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

// Move mouse to a random area on the page — simulates real cursor movement
async function humanMouseJitter(page) {
  const x = randomBetween(200, 900);
  const y = randomBetween(150, 500);
  await page.mouse.move(x, y, { steps: randomBetween(5, 15) });
  await humanDelay(page, 200, 600);
}

async function humanScroll(page) {
  const scrolls = randomBetween(1, 3);
  for (let s = 0; s < scrolls; s++) {
    await page.mouse.wheel(0, randomBetween(150, 400));
    await humanDelay(page, 400, 1000);
  }
  // Scroll back up
  await page.mouse.wheel(0, -randomBetween(200, 500));
  await humanDelay(page, 300, 700);
}

async function humanType(page, editor, text) {
  // Type in natural-looking chunks — realistic speed to avoid bot detection
  const chunkSize = randomBetween(100, 250);
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    await editor.pressSequentially(chunk, { delay: randomBetween(8, 25) });
    if (i + chunkSize < text.length) {
      // Brief "thinking" pause between chunks like a real person
      await humanDelay(page, 150, 500);
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
    ],
    dsa: [
      "Interview rejections happen not because you can't code — but because you pick the wrong data structure.",
      "Brute-force solutions pass small inputs but TLE on real constraints every time.",
      "Skipping Big O analysis is why good devs still fail system-scale problems."
    ],
    "system design": [
      "Most system design interviews fail at requirements — not architecture.",
      "Designing without estimating scale leads to solutions that look good on paper but break in production.",
      "Ignoring failure modes in your architecture is the fastest way to get rejected at senior interviews."
    ]
  };
  const topicPainPoints = painPointByTopic[topic] || painPointByTopic.javascript;
  const painPoint = topicPainPoints[Math.floor(Math.random() * topicPainPoints.length)];

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

  // ── Randomly pick one of 8 LinkedIn post style templates ────────────────
  const slug = String(post.title || "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const websiteLink = "https://raviacn95.github.io/Linkdein-Automatic-Post-Automation/#post/" + slug;

  const styleIndex = Math.floor(Math.random() * 8);

  let bodyText;

  if (styleIndex === 0) {
    // ── 1. Authority Explainer ───────────────────────────────────────────
    const insight = firstLines(concept, 2);
    const badPattern = tryCode ? "❌ Common mistake:\n" + firstLines(tryCode, 2) : "";
    const goodPattern = tryCode ? "✅ Better approach:\n" + firstLines(tryCode, 3) : "";
    bodyText = [
      painPoint, "",
      separator, "",
      "🚀 " + (post.title || ""), "",
      insight, "",
      badPattern ? badPattern + "\n" : "",
      goodPattern ? goodPattern + "\n" : "",
      "Why it matters:",
      rules ? rules : "",
      "", "👉 " + (firstLines(takeaway, 1) || post.excerpt || ""),
      "", hashtags, "", separator, "",
      "🔗 Full guide with examples:", websiteLink
    ].filter(Boolean).join("\n");

  } else if (styleIndex === 1) {
    // ── 2. SEO Blog Style ────────────────────────────────────────────────
    const def = firstLines(concept, 3);
    const benefits = rules ? rules.split("\n").filter(l => l.trim()).slice(0, 2).map(l => "✔ " + l.replace(/^[•\-]\s*/, "")).join("\n") : "";
    bodyText = [
      "📈 " + (post.title || ""), "",
      post.excerpt || "", "",
      hashtags, "",
      separator, "",
      def, "",
      benefits ? "Key Benefits:\n" + benefits : "",
      "", "When to Use:",
      firstLines(concept, 1),
      "", "👉 " + (firstLines(takeaway, 1) || post.excerpt || ""),
      "", separator, "",
      "🔗 Read the full guide:", websiteLink
    ].filter(Boolean).join("\n");

  } else if (styleIndex === 2) {
    // ── 3. Problem → Solution → Framework ───────────────────────────────
    const problem = firstLines(concept, 2);
    const solution = firstLines(takeaway, 2) || firstLines(concept, 2);
    const framework = rules ? rules.split("\n").filter(l => l.trim()).map((l, i) => (i + 1) + ". " + l.replace(/^[•\-]\s*/, "")).slice(0, 3).join("\n") : "";
    bodyText = [
      "🎯 " + (post.title || ""), "",
      hashtags, "",
      separator, "",
      "❗ Problem:", problem, "",
      "💡 Solution:", solution, "",
      framework ? "Framework:\n" + framework : "",
      "", "👉 " + (firstLines(takeaway, 1) || post.excerpt || ""),
      "", separator, "",
      "🔗 Full breakdown with code:", websiteLink
    ].filter(Boolean).join("\n");

  } else if (styleIndex === 3) {
    // ── 4. Myth Busting ──────────────────────────────────────────────────
    const myth = firstLines(concept, 1);
    const reality = firstLines(takeaway, 2) || firstLines(concept, 2);
    const correct = tryCode ? "✅ Correct Approach:\n" + firstLines(tryCode, 3) : "";
    bodyText = [
      "🔥 " + (post.title || ""), "",
      hashtags, "",
      separator, "",
      '❌ Myth: "' + myth + '"', "",
      "✅ Reality:", reality, "",
      correct ? correct + "\n" : "",
      "When it actually works:",
      firstLines(concept, 2),
      "", "👉 " + (firstLines(takeaway, 1) || post.excerpt || ""),
      "", separator, "",
      "🔗 Deep dive here:", websiteLink
    ].filter(Boolean).join("\n");

  } else if (styleIndex === 4) {
    // ── 5. Deep Insight Breakdown ────────────────────────────────────────
    const insight = firstLines(concept, 3);
    const pros = rules ? rules.split("\n").filter(l => l.trim()).slice(0, 2).map(l => "✔ " + l.replace(/^[•\-]\s*/, "")).join("\n") : "";
    const cons = "✖ Avoid when: " + (firstLines(concept, 1) || "context is oversimplified");
    bodyText = [
      "🧠 " + (post.title || ""), "",
      post.excerpt || "", "",
      hashtags, "",
      separator, "",
      insight, "",
      "Trade-offs:",
      pros ? pros : "",
      cons, "",
      quizText ? "❓ Quick Quiz\n" + quizText + "\n" : "",
      "👉 " + (firstLines(takeaway, 1) || post.excerpt || ""),
      "", separator, "",
      "🔗 Full expert breakdown:", websiteLink
    ].filter(Boolean).join("\n");

  } else if (styleIndex === 5) {
    // ── 6. Storytelling Format ───────────────────────────────────────────
    const setup = firstLines(concept, 2);
    const problem = firstLines(concept, 1);
    const turningPoint = firstLines(takeaway, 1) || "We rethought the entire approach."
    const outcome = firstLines(takeaway, 2) || "Performance improved dramatically.";
    bodyText = [
      "⚡ " + (post.title || ""), "",
      hashtags, "",
      separator, "",
      "Story: " + setup, "",
      "Problem: " + problem, "",
      "Turning Point: " + turningPoint, "",
      tryCode ? "New Approach:\n" + firstLines(tryCode, 3) + "\n" : "",
      "Outcome: " + outcome,
      "", "👉 Lesson: " + (firstLines(concept, 1) || post.excerpt || ""),
      "", separator, "",
      "🔗 Read the full story:", websiteLink
    ].filter(Boolean).join("\n");

  } else if (styleIndex === 6) {
    // ── 7. Practical Guide / How-To ──────────────────────────────────────
    const steps = rules ? rules.split("\n").filter(l => l.trim()).slice(0, 3).map((l, i) =>
      "Step " + (i + 1) + ": " + l.replace(/^[•\-]\s*/, "")
    ).join("\n") : "";
    bodyText = [
      "🛠️ " + (post.title || ""), "",
      post.excerpt || "", "",
      hashtags, "",
      separator, "",
      "Goal: " + firstLines(concept, 1), "",
      steps ? steps : "",
      "",
      tryCode ? "Code:\n" + firstLines(tryCode, 4) + "\n" : "",
      "Common Mistakes:",
      quizText ? quizText : "✖ Skipping edge case validation",
      "", "👉 " + (firstLines(takeaway, 1) || post.excerpt || ""),
      "", separator, "",
      "🔗 Complete step-by-step guide:", websiteLink
    ].filter(Boolean).join("\n");

  } else {
    // ── 8. Comparison Post ───────────────────────────────────────────────
    const ruleLines = rules ? rules.split("\n").filter(l => l.trim()) : [];
    const optionA = ruleLines[0] ? "Option A: " + ruleLines[0].replace(/^[•\-]\s*/, "") : "";
    const optionB = ruleLines[1] ? "Option B: " + ruleLines[1].replace(/^[•\-]\s*/, "") : "";
    const verdict = firstLines(takeaway, 1) || firstLines(concept, 1);
    bodyText = [
      "📊 " + (post.title || ""), "",
      post.excerpt || "", "",
      hashtags, "",
      separator, "",
      optionA, "✔ Pros: simpler, widely supported", "✖ Cons: may not scale", "",
      optionB, "✔ Pros: flexible, powerful", "✖ Cons: more complex", "",
      "When to use each:",
      ruleLines[0] ? "→ A: " + ruleLines[0].replace(/^[•\-]\s*/, "") : "",
      ruleLines[1] ? "→ B: " + ruleLines[1].replace(/^[•\-]\s*/, "") : "",
      "", "👉 Verdict: " + verdict,
      "", separator, "",
      "🔗 Full comparison with examples:", websiteLink
    ].filter(Boolean).join("\n");
  }

  const parts = [
    painPoint,
    "",
    separator,
    "",
    bodyText
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
    tosca:      { bg1: "#0f172a", bg2: "#1e293b", accent: "#fb7185", accent2: "#f43f5e", text: "#f1f5f9", badge: "#881337" },
    dsa:        { bg1: "#0f172a", bg2: "#1e293b", accent: "#4ade80", accent2: "#22c55e", text: "#f1f5f9", badge: "#14532d" },
    "system design": { bg1: "#0f172a", bg2: "#1e293b", accent: "#fb923c", accent2: "#f97316", text: "#f1f5f9", badge: "#7c2d12" }
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
  // Browse feed briefly like a real user before posting
  await humanScroll(page);
  await humanMouseJitter(page);
  await humanDelay(page, 800, 2000);

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
  await humanDelay(page, 1200, 2500);

  // ── Upload image if provided (with retry) ──
  if (imagePath && fs.existsSync(imagePath)) {
    let imageUploaded = false;
    for (let attempt = 1; attempt <= 2 && !imageUploaded; attempt++) {
      try {
        if (attempt > 1) {
          console.log("  Retrying image upload (attempt " + attempt + ")...");
          await humanDelay(page, 1500, 2500);
        }

        // Click the media/photo button in the composer toolbar
        // LinkedIn uses share-promoted-detour-button with data-test-icon="image-medium"
        const mediaClicked = await clickFirstVisible(page, [
          'button:has(svg[data-test-icon="image-medium"])',
          'button.share-promoted-detour-button:has(svg[data-test-icon="image-medium"])',
          '.share-promoted-detour-button:has(svg[data-test-icon="image-medium"])',
          'button[aria-label*="Add media"]',
          'button[aria-label*="Add a photo"]',
          'button[aria-label*="photo"]',
          'button[aria-label*="image"]',
          'button[aria-label*="Media"]',
          'button[aria-label*="media"]',
          'button[aria-label*="Photo"]',
          'button[aria-label*="Image"]'
        ]);

        if (mediaClicked) {
          console.log("  Media button clicked successfully.");
          await humanDelay(page, 1500, 3000);
        } else {
          console.log("  Media button not found, looking for file input directly...");
        }

        // Directly set files on the hidden <input type="file"> element
        // This bypasses the filechooser event which is unreliable with LinkedIn
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.waitFor({ state: "attached", timeout: 12000 });
        await fileInput.setInputFiles(imagePath);
        console.log("  Uploaded workflow image: " + path.basename(imagePath));
        imageUploaded = true;
        await humanDelay(page, 3000, 5000);

        // Click Done/Next if there's a media confirmation step
        await clickFirstVisible(page, [
          'button:has-text("Done")',
          'button:has-text("Next")',
          'button[aria-label="Done"]',
          'button[aria-label="Next"]'
        ]);
        await humanDelay(page, 1200, 2500);
      } catch (imgErr) {
        console.log("  Image upload attempt " + attempt + " failed: " + (imgErr.message || imgErr));
      }
    }
    if (!imageUploaded) {
      console.log("  WARNING: Image upload failed after 2 attempts, posting text only.");
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
  await humanDelay(page, 400, 900);

  // Type like a human — in chunks with small pauses
  await humanType(page, editor, text);

  // Pause before clicking Post (reviewing like a human)
  await humanMouseJitter(page);
  await humanDelay(page, 1500, 3500);

  const postButton = page.locator('button:has-text("Post")').last();
  await postButton.waitFor({ timeout: 10000 });
  await humanDelay(page, 500, 1200);
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
  await humanDelay(page, 2500, 5000);
}

async function postToLinkedInWithRetry(page, text, imagePath) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await postToLinkedIn(page, text, imagePath);
      return;
    } catch (err) {
      const msg = err.message || String(err);
      // Don't retry duplicate posts
      if (msg.includes("DUPLICATE_POST")) throw err;

      console.log(`  Attempt ${attempt}/${maxAttempts} failed: ${msg}`);

      // Save debug screenshot on failure
      try {
        const screenshotDir = path.join(__dirname, ".auth");
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
        const screenshotPath = path.join(screenshotDir, `fail-attempt-${attempt}-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath }).catch(() => {});
        console.log(`  Debug screenshot: ${path.basename(screenshotPath)}`);
      } catch {}

      if (attempt < maxAttempts) {
        // Exponential backoff: 2s, 4s
        const backoff = 2000 * attempt;
        console.log(`  Retrying in ${backoff / 1000}s...`);
        await page.waitForTimeout(backoff);
        // Navigate back to feed for clean retry
        await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(1500);
      } else {
        throw err;
      }
    }
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

  let candidates;
  if (unposted.length > 0) {
    // Prefer newest unposted posts first, but keep the full queue so duplicates can fall through.
    candidates = [...unposted].reverse();
    console.log("Prepared " + candidates.length + " unposted candidate(s) for LinkedIn.");
  } else {
    // All posts already posted — pick random ones for re-sharing
    candidates = [...allPosts].sort(() => Math.random() - 0.5);
    console.log("All posts already posted. Re-sharing from " + candidates.length + " random candidate(s).");
  }

  if (candidates.length === 0) {
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
    let attempted = 0;

    if (dailyLog.count >= MAX_POSTS_PER_DAY) {
      console.log(`Daily limit reached (${dailyLog.count}/${MAX_POSTS_PER_DAY}). Skipping this cycle.`);
      return;
    }

    for (let i = 0; i < candidates.length && posted < requestedCount; i += 1) {
      if (getDailyPostCount().count >= MAX_POSTS_PER_DAY) {
        console.log(`Daily limit reached (${MAX_POSTS_PER_DAY}). Stopping.`);
        break;
      }

      const post = candidates[i];
      const text = buildLinkedInText(post);
      attempted += 1;

      const dupCheck = isDuplicateOfHistory(text, history);
      if (dupCheck.match) {
        console.log(`Skipped (${Math.round(dupCheck.similarity * 100)}% similar to "${dupCheck.matchedTitle}"): ${post.title}`);
        continue;
      }

      console.log(`Posting ${posted + 1}/${requestedCount} (candidate ${attempted}/${candidates.length}): ${post.title}`);

      // Generate workflow PNG for this topic
      let imagePath = null;
      try {
        imagePath = generateWorkflowPng(post);
        console.log("  Generated workflow image: " + path.basename(imagePath));
      } catch (imgErr) {
        console.log("  Workflow image generation failed: " + (imgErr.message || imgErr));
      }

      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 })
        .catch(async () => {
          // Retry navigation once on network failure
          console.log("  Feed navigation failed, retrying...");
          await page.waitForTimeout(2000);
          await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 60000 });
        });

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
        // Log and continue with remaining posts instead of crashing
        console.error(`Failed to post "${post.title}": ${postError.message || postError}`);
        continue;
      }

      // Configurable randomized delay between posts
      if (posted < requestedCount && i < candidates.length - 1) {
        const waitMs = randomBetween(delayMinSec * 1000, delayMaxSec * 1000);
        console.log(`  Waiting ${Math.round(waitMs / 1000)}s before next post...`);
        await page.waitForTimeout(waitMs);
      }
    }

    console.log(`Automation finished. Posted ${posted}/${requestedCount} after checking ${attempted} candidate(s).`);
    await context.storageState({ path: STORAGE_STATE_FILE });
  } finally {
    if (!options.keepBrowserOpen) {
      try {
        // Give browser.close() 10 seconds max, then force kill
        await Promise.race([
          browser.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("browser.close timeout")), 10000))
        ]);
      } catch (closeErr) {
        console.log("Browser close failed, force killing:", closeErr.message || closeErr);
        try { browser.process()?.kill("SIGKILL"); } catch {}
      }
    }
  }
}


if (require.main === module) {
  const mode = process.argv[2];
  if (mode === "polls") {
    postLinkedInPolls().then(() => process.exit(0)).catch((error) => {
      console.error("Poll automation failed:", error.message || error);
      process.exit(1);
    });
  } else {
    runLinkedInAutomation().then(() => process.exit(0)).catch((error) => {
      console.error("Automation failed:", error.message || error);
      process.exit(1);
    });
  }
}

module.exports = {
  runLinkedInAutomation,
  postLinkedInPolls
};
