#!/usr/bin/env node
/**
 * LearnHub content pipeline
 * Playwright fetch (signals) → SQLite → original lesson → website-posts-data.js
 *
 * Usage:
 *   npm run hub:pipeline
 *   npm run hub:pipeline -- --limit 2
 *   npm run hub:pipeline -- --seed-only
 */
const fs = require("fs");
const path = require("path");

const {
  openDb,
  upsertSource,
  insertRawPage,
  insertLesson,
  markLessonPublished,
  listSourcesNeedingFetch,
  latestRawForSource,
} = require("./db");
const { fetchPageSignals } = require("./fetch");
const { transformToLesson } = require("./transform");
const { publishLesson } = require("./publish");

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, rel), "utf8"));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const out = { limit: null, seedOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit") out.limit = Number(argv[++i]) || 1;
    if (argv[i] === "--seed-only") out.seedOnly = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadJson("config.json");
  const { seeds } = loadJson("seeds.json");
  const dbPath = path.resolve(process.cwd(), config.dbPath);
  const db = openDb(dbPath);

  console.log(`[pipeline] db=${dbPath}`);
  console.log(`[pipeline] seeding ${seeds.length} allowlisted sources…`);
  for (const seed of seeds) {
    if (!config.categories.includes(seed.category)) {
      console.warn(`[pipeline] skip unsupported category ${seed.category}: ${seed.url}`);
      continue;
    }
    upsertSource(db, seed);
  }
  if (args.seedOnly) {
    console.log("[pipeline] seed-only done");
    return;
  }

  const limit = args.limit || config.maxPagesPerRun || 3;
  const todo = listSourcesNeedingFetch(db, limit);
  console.log(`[pipeline] fetching up to ${todo.length} source(s)…`);

  for (const source of todo) {
    console.log(`[fetch] ${source.category} · ${source.topic}`);
    console.log(`        ${source.url}`);
    const page = await fetchPageSignals(source.url, {
      headless: config.headless !== false,
      userAgent: config.userAgent,
    });
    const rawId = insertRawPage(db, source.id, page);
    if (page.status !== "fetched") {
      console.warn(`        ERROR: ${page.error}`);
      continue;
    }
    console.log(`        ok title="${page.title}" outline=${page.outline.length} checksum=${page.checksum}`);

    const raw = latestRawForSource(db, source.id) || { id: rawId, ...page, outline_json: JSON.stringify(page.outline), code_signals_json: JSON.stringify(page.codeSignals) };
    // normalize shape for transform
    const rawRow = {
      id: raw.id || rawId,
      title: raw.title || page.title,
      description: raw.description || page.description,
      outline_json: raw.outline_json || JSON.stringify(page.outline || []),
      code_signals_json: raw.code_signals_json || JSON.stringify(page.codeSignals || []),
      checksum: raw.checksum || page.checksum,
    };

    const minOutline = config.publish?.requireMinOutlineItems ?? 0;
    const outlineLen = JSON.parse(rawRow.outline_json || "[]").length;
    if (outlineLen < minOutline) {
      console.warn(`        skip transform: outline too short (${outlineLen})`);
      continue;
    }

    console.log(`        transforming → original lesson…`);
    const lesson = await transformToLesson(source, rawRow, config);
    const lessonId = insertLesson(db, lesson);
    const result = publishLesson(config.postsFile, lesson, config.mirrorPostsFiles || []);
    if (result.published) {
      markLessonPublished(db, lessonId, result.postId);
      console.log(`        published post #${result.postId} → ${config.postsFile}`);
    } else {
      console.log(`        not published (${result.reason})`);
    }

    await sleep(config.requestDelayMs || 1000);
  }

  console.log("[pipeline] done");
}

main().catch((err) => {
  console.error("[pipeline] fatal:", err);
  process.exit(1);
});
