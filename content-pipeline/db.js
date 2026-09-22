const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function openDb(dbPath) {
  ensureDir(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      topic TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'intermediate',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS raw_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      title TEXT,
      description TEXT,
      outline_json TEXT,
      code_signals_json TEXT,
      checksum TEXT,
      status TEXT NOT NULL DEFAULT 'fetched',
      error TEXT,
      FOREIGN KEY (source_id) REFERENCES sources(id)
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      raw_page_id INTEGER,
      post_id INTEGER,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      level TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      source_url TEXT NOT NULL,
      checksum TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      published INTEGER NOT NULL DEFAULT 0,
      UNIQUE(source_id, checksum)
    );

    CREATE INDEX IF NOT EXISTS idx_raw_source ON raw_pages(source_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_published ON lessons(published);
  `);
  return db;
}

function upsertSource(db, seed) {
  db.prepare(
    `INSERT INTO sources (url, category, topic, level, tags_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       category=excluded.category,
       topic=excluded.topic,
       level=excluded.level,
       tags_json=excluded.tags_json`
  ).run(
    seed.url,
    seed.category,
    seed.topic,
    seed.level || "intermediate",
    JSON.stringify(seed.tags || [])
  );
  return db.prepare("SELECT * FROM sources WHERE url = ?").get(seed.url);
}

function insertRawPage(db, sourceId, page) {
  const info = db
    .prepare(
      `INSERT INTO raw_pages
        (source_id, title, description, outline_json, code_signals_json, checksum, status, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sourceId,
      page.title || "",
      page.description || "",
      JSON.stringify(page.outline || []),
      JSON.stringify(page.codeSignals || []),
      page.checksum || "",
      page.status || "fetched",
      page.error || null
    );
  return Number(info.lastInsertRowid);
}

function findLessonByChecksum(db, sourceId, checksum) {
  return db
    .prepare("SELECT * FROM lessons WHERE source_id = ? AND checksum = ?")
    .get(sourceId, checksum);
}

function insertLesson(db, lesson) {
  const existing = findLessonByChecksum(db, lesson.sourceId, lesson.checksum || "");
  if (existing) return existing.id;
  const info = db
    .prepare(
      `INSERT INTO lessons
        (source_id, raw_page_id, post_id, title, category, level, tags_json, excerpt, content, source_url, checksum, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .run(
      lesson.sourceId,
      lesson.rawPageId || null,
      lesson.postId || null,
      lesson.title,
      lesson.category,
      lesson.level,
      JSON.stringify(lesson.tags || []),
      lesson.excerpt,
      lesson.content,
      lesson.sourceUrl,
      lesson.checksum || ""
    );
  return Number(info.lastInsertRowid);
}

function markLessonPublished(db, lessonId, postId) {
  db.prepare("UPDATE lessons SET published = 1, post_id = ? WHERE id = ?").run(postId, lessonId);
}

function listSourcesNeedingFetch(db, limit) {
  return db
    .prepare(
      `SELECT s.* FROM sources s
       WHERE NOT EXISTS (
         SELECT 1 FROM raw_pages r
         WHERE r.source_id = s.id AND r.status = 'fetched'
           AND date(r.fetched_at) = date('now')
       )
       ORDER BY s.id ASC
       LIMIT ?`
    )
    .all(limit);
}

function latestRawForSource(db, sourceId) {
  return db
    .prepare(
      `SELECT * FROM raw_pages
       WHERE source_id = ? AND status = 'fetched'
       ORDER BY id DESC LIMIT 1`
    )
    .get(sourceId);
}

function unpublishedLessons(db) {
  return db.prepare("SELECT * FROM lessons WHERE published = 0 ORDER BY id ASC").all();
}

module.exports = {
  openDb,
  upsertSource,
  insertRawPage,
  insertLesson,
  markLessonPublished,
  listSourcesNeedingFetch,
  latestRawForSource,
  unpublishedLessons,
  findLessonByChecksum,
};
