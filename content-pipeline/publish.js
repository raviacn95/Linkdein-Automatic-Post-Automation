const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadPostsFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    return { abs, posts: [], raw: "const ALL_POSTS = [];\n" };
  }
  const raw = fs.readFileSync(abs, "utf8");
  const ctx = {};
  vm.runInNewContext(raw.replace(/\bconst ALL_POSTS\b/, "var ALL_POSTS"), ctx);
  const posts = Array.isArray(ctx.ALL_POSTS) ? ctx.ALL_POSTS : [];
  return { abs, posts, raw };
}

function nextPostId(posts) {
  let max = 0;
  for (const p of posts) {
    const id = Number(p.id) || 0;
    if (id > max) max = id;
  }
  return max + 1;
}

function isDuplicateTitle(posts, title) {
  const t = String(title || "").toLowerCase().trim();
  return posts.some((p) => String(p.title || "").toLowerCase().trim() === t);
}

function isDuplicateSource(posts, sourceUrl) {
  const u = String(sourceUrl || "").toLowerCase();
  return posts.some((p) => String(p.sourceUrl || "").toLowerCase() === u);
}

function serializePosts(posts) {
  return (
    "/* ================================================================\n" +
    "   AUTO-GENERATED / PIPELINE-UPDATED POSTS\n" +
    "   Regenerate with: npm run hub:pipeline\n" +
    "   ================================================================ */\n\n" +
    "const ALL_POSTS = " +
    JSON.stringify(posts, null, 2) +
    ";\n"
  );
}

function publishLesson(postsFile, lesson, mirrorFiles = []) {
  const { abs, posts } = loadPostsFile(postsFile);
  if (isDuplicateTitle(posts, lesson.title) || isDuplicateSource(posts, lesson.sourceUrl)) {
    return { published: false, reason: "duplicate", postId: null };
  }
  const postId = nextPostId(posts);
  const post = {
    id: postId,
    category: lesson.category,
    title: lesson.title,
    tags: lesson.tags,
    excerpt: lesson.excerpt,
    sourceUrl: lesson.sourceUrl,
    createdAt: new Date().toISOString(),
    level: lesson.level,
    content: lesson.content,
    pipeline: true,
  };
  // Newest first
  const next = [post, ...posts];
  const body = serializePosts(next);
  fs.writeFileSync(abs, body, "utf8");
  for (const mirror of mirrorFiles) {
    const mAbs = path.resolve(mirror);
    fs.mkdirSync(path.dirname(mAbs), { recursive: true });
    fs.writeFileSync(mAbs, body, "utf8");
  }
  return { published: true, reason: "ok", postId };
}

module.exports = {
  loadPostsFile,
  publishLesson,
  nextPostId,
  isDuplicateTitle,
  isDuplicateSource,
};
