#!/usr/bin/env node
/**
 * Deploy LearnHub site files to raviacn95.github.io (user Pages root).
 * Uses a temp clone + push.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "index.html",
  "styles.css",
  "app.js",
  "website-posts-data.js",
  "robots.txt",
  "sitemap.xml",
  "ads.txt",
];

function run(cmd, cwd) {
  console.log(">", cmd);
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

function main() {
  // Prefer learnhub/ mirror if present (repo root may be redirect-only on git)
  const srcDir = fs.existsSync(path.join(ROOT, "learnhub", "index.html"))
    ? path.join(ROOT, "learnhub")
    : ROOT;

  // Sync learnhub from root working copies when root has full site
  const rootIndex = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  if (!/LearnHub moved/i.test(rootIndex) && fs.existsSync(path.join(ROOT, "website-posts-data.js"))) {
    for (const f of FILES) {
      const from = path.join(ROOT, f);
      if (fs.existsSync(from)) {
        fs.mkdirSync(path.join(ROOT, "learnhub"), { recursive: true });
        fs.copyFileSync(from, path.join(ROOT, "learnhub", f));
      }
    }
  }

  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "learnhub-pages-"));
  run(`git clone --depth 1 https://github.com/raviacn95/raviacn95.github.io.git "${dest}"`, os.tmpdir());

  for (const f of FILES) {
    const from = path.join(srcDir, f);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dest, f));
  }

  run("git add -A", dest);
  try {
    run('git commit -m "Auto-deploy LearnHub content pipeline updates."', dest);
    run("git push origin HEAD", dest);
    console.log("[deploy] pushed to https://raviacn95.github.io/");
  } catch {
    console.log("[deploy] nothing new to commit/push");
  }
}

main();
