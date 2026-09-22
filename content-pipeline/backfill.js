#!/usr/bin/env node
/** Backfill lessons from already-fetched raw_pages that have no lesson yet. */
const fs = require("fs");
const path = require("path");
const { openDb, insertLesson, markLessonPublished } = require("./db");
const { transformToLesson } = require("./transform");
const { publishLesson } = require("./publish");
const { fetchPageSignals } = require("./fetch");
const { insertRawPage, upsertSource } = require("./db");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const { seeds } = JSON.parse(fs.readFileSync(path.join(__dirname, "seeds.json"), "utf8"));
const db = openDb(path.resolve(config.dbPath));

async function main() {
  for (const seed of seeds) upsertSource(db, seed);

  // Re-fetch broken/promise URL and node if needed
  const forceUrls = new Set([
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise",
  ]);

  for (const seed of seeds) {
    if (!forceUrls.has(seed.url)) continue;
    const source = db.prepare("SELECT * FROM sources WHERE url = ?").get(seed.url);
    console.log("[refetch]", seed.topic);
    const page = await fetchPageSignals(seed.url, { headless: true, userAgent: config.userAgent });
    insertRawPage(db, source.id, page);
  }

  const pending = db
    .prepare(
      `SELECT s.*, r.id AS raw_id, r.title, r.description, r.outline_json, r.code_signals_json, r.checksum, r.status
       FROM sources s
       JOIN raw_pages r ON r.id = (
         SELECT id FROM raw_pages WHERE source_id = s.id AND status = 'fetched' ORDER BY id DESC LIMIT 1
       )
       WHERE NOT EXISTS (SELECT 1 FROM lessons l WHERE l.source_id = s.id)
         AND COALESCE(json_array_length(r.outline_json), 0) >= ?`
    )
    .all(config.publish?.requireMinOutlineItems ?? 1);

  // Fallback without json_array_length if unavailable
  let rows = pending;
  if (!rows.length) {
    const all = db
      .prepare(
        `SELECT s.*, r.id AS raw_id, r.title, r.description, r.outline_json, r.code_signals_json, r.checksum, r.status
         FROM sources s
         JOIN raw_pages r ON r.id = (
           SELECT id FROM raw_pages WHERE source_id = s.id AND status = 'fetched' ORDER BY id DESC LIMIT 1
         )
         WHERE NOT EXISTS (SELECT 1 FROM lessons l WHERE l.source_id = s.id)`
      )
      .all();
    rows = all.filter((r) => {
      try {
        return JSON.parse(r.outline_json || "[]").length >= (config.publish?.requireMinOutlineItems ?? 1);
      } catch {
        return false;
      }
    });
  }

  console.log(`[backfill] ${rows.length} source(s)`);
  for (const source of rows) {
    if (/page not found/i.test(source.title || "")) {
      console.log("skip 404", source.topic);
      continue;
    }
    const rawRow = {
      id: source.raw_id,
      title: source.title,
      description: source.description,
      outline_json: source.outline_json,
      code_signals_json: source.code_signals_json,
      checksum: source.checksum,
    };
    console.log("transform", source.topic);
    const lesson = await transformToLesson(source, rawRow, config);
    const lessonId = insertLesson(db, lesson);
    const result = publishLesson(config.postsFile, lesson, config.mirrorPostsFiles || []);
    console.log(" ->", result);
    if (result.published) markLessonPublished(db, lessonId, result.postId);
  }

  if (config.autoDeploy !== false) {
    console.log("[backfill] auto-deploy → https://raviacn95.github.io/");
    require("child_process").execFileSync(
      process.execPath,
      [path.join(__dirname, "deploy-pages.js")],
      { cwd: process.cwd(), stdio: "inherit" }
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
