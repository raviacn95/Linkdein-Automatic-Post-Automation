"use strict";

/**
 * LinkedIn Engagement Automation
 * ---------------------------------
 * Finds posts by industry hashtags and:
 *   - Likes relevant posts (up to maxLikesPerSession)
 *   - Leaves natural comments on a subset (up to maxCommentsPerSession)
 *
 * History is stored in .auth/engagement-history.json to avoid
 * re-engaging with the same posts across runs.
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

const ENGAGEMENT_HISTORY_FILE = path.join(STATE_DIR, "engagement-history.json");

// ── Comment building ──────────────────────────────────────────────────────────

function resolveCommentTemplate(template, hashtag) {
  const topic = hashtag
    .replace(/^#/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
  return template.replace(/#{topic}/g, topic);
}

function pickComment(templates, hashtag) {
  const template = templates[randomBetween(0, templates.length - 1)];
  return resolveCommentTemplate(template, hashtag);
}

// ── Core engagement for a single hashtag ─────────────────────────────────────

async function engageWithHashtag(page, hashtag, cfg, history, stats) {
  const maxLikes = cfg.maxLikesPerSession;
  const maxComments = cfg.maxCommentsPerSession;
  const minDelay = (cfg.delayBetweenActionsMinSec || 35) * 1000;
  const maxDelay = (cfg.delayBetweenActionsMaxSec || 90) * 1000;

  const tag = hashtag.replace("#", "");
  const url = `https://www.linkedin.com/feed/hashtag/?keywords=${encodeURIComponent(tag)}`;
  console.log(`  Navigating to hashtag: ${hashtag}`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await humanDelay(page, 2000, 4000);
  await humanScroll(page, 2);

  const postCards = await page
    .locator(".feed-shared-update-v2, [data-urn*='activity']")
    .all();
  console.log(`  Found ${postCards.length} post(s) in ${hashtag} feed`);

  let liked = 0;
  let commented = 0;

  for (let i = 0; i < postCards.length; i++) {
    if (stats.likes >= maxLikes && stats.comments >= maxComments) break;

    const card = postCards[i];
    await humanMouseJitter(page);

    // Get post URN for deduplication
    let urn = "";
    try {
      urn = (await card.getAttribute("data-urn")) || "";
    } catch { /* not all cards expose data-urn */ }

    if (urn && history.engaged.includes(urn)) {
      continue;
    }

    try {
      await card.scrollIntoViewIfNeeded();
    } catch { /* ignore */ }
    await humanDelay(page, 800, 1500);

    // ── Like ───────────────────────────────────────────────────────────────
    if (stats.likes < maxLikes) {
      try {
        const likeBtn = card
          .locator("button[aria-label*='Like'], button[aria-label*='React']")
          .first();
        const isPressed = await likeBtn.getAttribute("aria-pressed").catch(() => "false");
        if (isPressed !== "true" && await likeBtn.isVisible().catch(() => false)) {
          await likeBtn.click();
          stats.likes += 1;
          liked += 1;
          if (urn) history.engaged.push(urn);
          console.log(`    Liked post ${i + 1} (session total: ${stats.likes})`);
          await humanDelay(page, minDelay, maxDelay);
        }
      } catch { /* like btn not reachable */ }
    }

    // ── Comment (every ~3rd post) ──────────────────────────────────────────
    const shouldComment =
      stats.comments < maxComments &&
      i % 3 === 0 &&
      cfg.commentTemplates &&
      cfg.commentTemplates.length > 0;

    if (shouldComment) {
      try {
        const commentBtn = card
          .locator("button[aria-label*='comment'], button[aria-label*='Comment']")
          .first();
        if (await commentBtn.isVisible().catch(() => false)) {
          await commentBtn.click();
          await humanDelay(page, 1500, 3000);

          const commentBox = page
            .locator(
              ".comments-comment-texteditor .ql-editor, " +
              ".comments-comment-box--cr .ql-editor"
            )
            .last();
          const commentText = pickComment(cfg.commentTemplates, hashtag);
          await commentBox.click();
          await commentBox.pressSequentially(commentText, {
            delay: randomBetween(30, 70)
          });
          await humanDelay(page, 1000, 2000);

          const submitBtn = page
            .locator(
              "button.comments-comment-box__submit-button, " +
              "button[aria-label='Post comment']"
            )
            .last();
          if (await submitBtn.isVisible().catch(() => false)) {
            await submitBtn.click();
            stats.comments += 1;
            commented += 1;
            console.log(
              `    Commented: "${commentText.slice(0, 60)}..."`
            );
            // Wait longer after commenting to avoid spam signals
            await humanDelay(page, minDelay * 2, maxDelay * 2);
          }
        }
      } catch { /* comment flow not accessible */ }
    }
  }

  return { liked, commented };
}

// ── Main entry ────────────────────────────────────────────────────────────────

async function runEngagement() {
  const config = loadGrowthConfig();
  const cfg = config.engagement;

  if (!cfg.enabled) {
    console.log("[Engagement] Disabled in growth-config.json — skipping.");
    return { skipped: true };
  }

  const history = readJsonSafe(ENGAGEMENT_HISTORY_FILE, { engaged: [], sessions: [] });
  if (!Array.isArray(history.engaged)) history.engaged = [];

  console.log("\n=== LinkedIn Engagement Automation ===");
  const stats = { likes: 0, comments: 0 };
  const { browser, context, page } = await launchBrowser(false);

  try {
    const loggedIn = await ensureLoggedIn(page, context);
    if (!loggedIn) {
      console.error(
        "[Engagement] Not logged in to LinkedIn. " +
        "Run 'npm run linkedin:post' first to authenticate."
      );
      return { error: "not_logged_in" };
    }

    console.log("[Engagement] Session verified. Starting hashtag engagement...");

    const hashtags = cfg.hashtags || [];
    for (const hashtag of hashtags) {
      if (stats.likes >= cfg.maxLikesPerSession && stats.comments >= cfg.maxCommentsPerSession) {
        break;
      }
      try {
        const result = await engageWithHashtag(page, hashtag, cfg, history, stats);
        console.log(`  ${hashtag}: liked=${result.liked}, commented=${result.commented}`);
      } catch (err) {
        console.error(`  [Engagement] Error on ${hashtag}:`, err.message);
      }
      await humanDelay(page, 5000, 10000);
    }
  } finally {
    // Prune history to last 500 URNs to keep file size manageable
    if (history.engaged.length > 500) {
      history.engaged = history.engaged.slice(-500);
    }
    history.sessions = history.sessions || [];
    history.sessions.push({
      date: new Date().toISOString(),
      likes: stats.likes,
      comments: stats.comments
    });
    if (history.sessions.length > 100) {
      history.sessions = history.sessions.slice(-100);
    }
    writeJsonSafe(ENGAGEMENT_HISTORY_FILE, history);
    await persistSession(context);
    await browser.close();
  }

  console.log(
    `\n[Engagement] Done. Likes: ${stats.likes}, Comments: ${stats.comments}`
  );
  return stats;
}

module.exports = { runEngagement };

if (require.main === module) {
  runEngagement().catch(console.error);
}
