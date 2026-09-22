/* ================================================================
   APP.JS — LearnHub (fast, paginated, path-aware, dynamic)
   ================================================================ */

const CONTENT_VERSION = 14;
const PAGE_SIZE = 9;
const RECENT_KEY = "learnhub-recent-v1";
const PROGRESS_KEY = "learnhub-progress-v1";

const LEARNING_PATHS = {
  javascript: {
    id: "javascript",
    title: "JavaScript foundations",
    blurb: "Language core, APIs, and patterns you use every day.",
    category: "JavaScript",
  },
  playwright: {
    id: "playwright",
    title: "Playwright E2E track",
    blurb: "Locators, waits, and reliable browser automation.",
    category: "Playwright",
  },
  typescript: {
    id: "typescript",
    title: "TypeScript depth",
    blurb: "Types, generics, and safer refactors at scale.",
    category: "TypeScript",
  },
  scraping: {
    id: "scraping",
    title: "Scraping → LearnHub",
    blurb: "APIs, Actors, and Scrapy pipelines that feed lessons — legally.",
    category: "Scraping",
  },
};

/* ── DOM ─────────────────────────────────────────────── */
const searchInput = document.getElementById("search");
const postsGrid = document.getElementById("posts-grid");
const postCount = document.getElementById("post-count");
const feedTitle = document.getElementById("feed-title");
const homeView = document.getElementById("home-view");
const postView = document.getElementById("post-view");
const heroEl = document.getElementById("hero");
const navLinks = document.getElementById("nav-links");
const hamburger = document.getElementById("hamburger");
const readingProgress = document.getElementById("reading-progress");
const backToTop = document.getElementById("back-to-top");
const paginationEl = document.getElementById("pagination");
const sortSelect = document.getElementById("sort-select");
const clearFiltersBtn = document.getElementById("clear-filters");
const recentRail = document.getElementById("recent-rail");
const pathsGrid = document.getElementById("paths-grid");
const liveStats = document.getElementById("live-stats");
const searchMeta = document.getElementById("search-meta");

const pvBack = document.getElementById("pv-back");
const pvBreadcrumb = document.getElementById("pv-breadcrumb");
const pvMeta = document.getElementById("pv-meta");
const pvTitle = document.getElementById("pv-title");
const pvExcerpt = document.getElementById("pv-excerpt");
const pvTags = document.getElementById("pv-tags");
const pvBody = document.getElementById("pv-body");
const pvToc = document.getElementById("pv-toc");
const pvTocMobileList = document.getElementById("pv-toc-mobile-list");
const relatedGrid = document.getElementById("related-grid");
const shareTwitter = document.getElementById("share-twitter");
const shareLinkedin = document.getElementById("share-linkedin");
const shareCopy = document.getElementById("share-copy");
const nextTutorialBtn = document.getElementById("next-tutorial");

let currentCategory = "All";
let currentLevel = "All";
let currentSort = "level";
let currentPage = 1;
let currentPostId = null;
let searchQuery = "";
let postsCache = null;
let tocObserver = null;
let searchTimer = null;

/* ── Data layer (in-memory — no bloated localStorage sync) ── */
function normalizePosts() {
  if (postsCache) return postsCache;
  const source = Array.isArray(typeof ALL_POSTS !== "undefined" ? ALL_POSTS : []) ? ALL_POSTS : [];
  postsCache = source.map((src, i) => ({
    id: `hub-${src.id ?? i}`,
    sourceId: src.id ?? i,
    title: src.title || "Untitled",
    category: src.category || "JavaScript",
    tags: Array.isArray(src.tags) ? src.tags : [],
    excerpt: src.excerpt || "",
    content: src.content || "",
    sourceUrl: src.sourceUrl || "",
    createdAt: src.createdAt || new Date(Date.now() - i * 60000).toISOString(),
    level: (src.level || "beginner").toLowerCase(),
    contentVersion: CONTENT_VERSION,
    readMins: readTime(src.content || ""),
  }));
  return postsCache;
}

function loadPosts() {
  return normalizePosts();
}

function getRecentIds() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function pushRecent(postId) {
  const next = [postId, ...getRecentIds().filter((id) => id !== postId)].slice(0, 8);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* quota — ignore */
  }
}

function getProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function markRead(postId) {
  const map = getProgress();
  map[postId] = Date.now();
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/* ── Helpers ─────────────────────────────────────────── */
function escapeHtml(t) {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readTime(content) {
  return Math.max(1, Math.ceil(String(content || "").split(/\s+/).filter(Boolean).length / 200));
}

function slugify(text) {
  return String(text)
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function debounce(fn, ms) {
  return (...args) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fn(...args), ms);
  };
}

function categoryClass(cat) {
  return String(cat || "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/* ── Filters / sort / page ───────────────────────────── */
function getFilteredPosts() {
  const q = searchQuery.trim().toLowerCase();
  let list = loadPosts().filter((post) => {
    if (currentCategory !== "All" && post.category !== currentCategory) return false;
    if (currentLevel !== "All" && post.level !== currentLevel) return false;
    if (!q) return true;
    const hay = `${post.title} ${post.excerpt} ${post.content} ${(post.tags || []).join(" ")}`.toLowerCase();
    return hay.includes(q);
  });

  const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
  list = list.slice().sort((a, b) => {
    if (currentSort === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    if (currentSort === "title") return a.title.localeCompare(b.title);
    if (currentSort === "read") return a.readMins - b.readMins;
    const ld = (levelOrder[a.level] || 0) - (levelOrder[b.level] || 0);
    return ld !== 0 ? ld : new Date(b.createdAt) - new Date(a.createdAt);
  });
  return list;
}

/* ── Markdown ────────────────────────────────────────── */
function markdownToHtml(md) {
  const e = escapeHtml(md || "");

  let html = e.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const cls = lang ? ` class="lang-${lang}"` : "";
    return `<div class="code-block"><button type="button" class="copy-code" aria-label="Copy code">Copy</button><pre><code${cls}>${code.trim()}</code></pre></div>`;
  });

  html = html
    .replace(/^###\s+(.*)$/gm, (_m, t) => `<h3 id="${slugify(t)}">${t}</h3>`)
    .replace(/^##\s+(.*)$/gm, (_m, t) => `<h2 id="${slugify(t)}">${t}</h2>`)
    .replace(/^#\s+(.*)$/gm, "<h1>$1</h1>");

  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  html = html.replace(
    /(?:^|\n)(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/g,
    (_m, hdr, _sep, body) => {
      const ths = hdr
        .split("|")
        .filter(Boolean)
        .map((h) => `<th>${h.trim()}</th>`)
        .join("");
      const rows = body
        .trim()
        .split("\n")
        .map((r) => {
          const tds = r
            .split("|")
            .filter(Boolean)
            .map((c) => `<td>${c.trim()}</td>`)
            .join("");
          return `<tr>${tds}</tr>`;
        })
        .join("");
      return `<div class="table-wrap"><table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
  );

  html = html.replace(/(?:^|\n)(\d+\.\s+.+(?:\n\d+\.\s+.+)*)/g, (chunk) => {
    const items = chunk
      .trim()
      .split("\n")
      .map((l) => l.replace(/^\d+\.\s+/, "").trim())
      .filter(Boolean)
      .map((i) => `<li>${i}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  html = html.replace(/(?:^|\n)(-\s+.+(?:\n-\s+.+)*)/g, (chunk) => {
    const items = chunk
      .trim()
      .split("\n")
      .map((l) => l.replace(/^-\s+/, "").trim())
      .filter(Boolean)
      .map((i) => `<li>${i}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  html = html.replace(/(?:^|\n)&gt;\s+(.+)/g, "<blockquote>$1</blockquote>");

  return html
    .split(/\n\n+/)
    .map((block) => {
      const t = block.trim();
      if (!t) return "";
      if (/^<(h[1-3]|ul|ol|pre|table|blockquote|div)/.test(t)) return t;
      return `<p>${t.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

function extractToc(md) {
  const headings = [];
  for (const line of String(md || "").split("\n")) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) headings.push({ level: 3, text: h3[1].trim(), id: slugify(h3[1]) });
    else if (h2) headings.push({ level: 2, text: h2[1].trim(), id: slugify(h2[1]) });
  }
  return headings;
}

function renderTocHtml(headings) {
  if (headings.length < 3) return "";
  return `<h4>On this page</h4><ul>${headings
    .map((h) => {
      const cls = h.level === 3 ? ' class="toc-indent"' : "";
      return `<li${cls}><a href="#${h.id}" class="toc-link">${escapeHtml(h.text)}</a></li>`;
    })
    .join("")}</ul>`;
}

/* ── Live stats / paths / recent ─────────────────────── */
function updateLiveStats() {
  if (!liveStats) return;
  const all = loadPosts();
  const cats = {};
  all.forEach((p) => {
    cats[p.category] = (cats[p.category] || 0) + 1;
  });
  const totalMins = all.reduce((s, p) => s + p.readMins, 0);
  const readMap = getProgress();
  const readCount = Object.keys(readMap).length;
  liveStats.innerHTML = `
    <div class="stat-pill"><strong id="stat-tutorials">${all.length}</strong><span>tutorials</span></div>
    <div class="stat-pill"><strong>${Object.keys(cats).length}</strong><span>tracks</span></div>
    <div class="stat-pill"><strong>${totalMins}</strong><span>min reading</span></div>
    <div class="stat-pill"><strong>${readCount}</strong><span>you've opened</span></div>
  `;
}

function renderPaths() {
  if (!pathsGrid) return;
  const all = loadPosts();
  pathsGrid.innerHTML = Object.values(LEARNING_PATHS)
    .map((path) => {
      const count = all.filter((p) => p.category === path.category).length;
      return `
      <button type="button" class="path-card" data-path="${path.id}" data-category="${escapeHtml(path.category)}">
        <span class="path-count">${count} lessons</span>
        <h3>${escapeHtml(path.title)}</h3>
        <p>${escapeHtml(path.blurb)}</p>
        <span class="path-cta">Open track →</span>
      </button>`;
    })
    .join("");

  pathsGrid.querySelectorAll(".path-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.category || "All";
      currentLevel = "All";
      currentPage = 1;
      updateNavActive();
      document.querySelectorAll(".level-btn").forEach((b) => b.classList.toggle("active", b.dataset.level === "All"));
      goHome(false);
      document.getElementById("tutorials")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderRecent() {
  if (!recentRail) return;
  const ids = getRecentIds();
  const all = loadPosts();
  const posts = ids.map((id) => all.find((p) => p.id === id)).filter(Boolean).slice(0, 6);
  if (!posts.length) {
    recentRail.innerHTML = `<p class="recent-empty">Tutorials you open will show up here for quick resume.</p>`;
    return;
  }
  recentRail.innerHTML = posts
    .map(
      (post) => `
    <button type="button" class="recent-chip" data-id="${escapeHtml(post.id)}">
      <span class="recent-cat">${escapeHtml(post.category)}</span>
      <span class="recent-title">${escapeHtml(post.title)}</span>
    </button>`
    )
    .join("");
  recentRail.querySelectorAll(".recent-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const post = all.find((p) => p.id === chip.dataset.id);
      if (post) openPost(post);
    });
  });
}

function updateNavCounts() {
  const all = loadPosts();
  const counts = { All: all.length };
  all.forEach((p) => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });
  navLinks.querySelectorAll(".nav-link[data-filter]").forEach((link) => {
    const key = link.dataset.filter;
    const n = counts[key] || 0;
    const label = key === "All" ? "All" : key;
    link.innerHTML = n ? `${label} <span class="nav-count">${n}</span>` : label;
    if (key !== "All" && n === 0) link.classList.add("is-empty");
    else link.classList.remove("is-empty");
  });
}

/* ── Home rendering ──────────────────────────────────── */
function renderHome() {
  const posts = getFilteredPosts();
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pagePosts = posts.slice(start, start + PAGE_SIZE);

  postCount.textContent = `${posts.length} tutorial${posts.length !== 1 ? "s" : ""}${
    posts.length > PAGE_SIZE ? ` · page ${currentPage}/${totalPages}` : ""
  }`;

  const categoryLabels = {
    All: "All tutorials",
    JavaScript: "JavaScript tutorials",
    Playwright: "Playwright tutorials",
    TypeScript: "TypeScript tutorials",
    Scraping: "Scraping tutorials",
    MCP: "MCP tutorials",
    TOSCA: "TOSCA tutorials",
  };
  feedTitle.textContent = categoryLabels[currentCategory] || "All tutorials";

  if (searchMeta) {
    searchMeta.textContent = searchQuery
      ? `Showing results for “${searchQuery.trim()}”`
      : "Filter by topic, level, or sort — press / to search";
  }

  if (clearFiltersBtn) {
    const dirty =
      currentCategory !== "All" || currentLevel !== "All" || searchQuery.trim() || currentSort !== "level";
    clearFiltersBtn.classList.toggle("hidden", !dirty);
  }

  postsGrid.innerHTML = "";

  if (posts.length === 0) {
    postsGrid.innerHTML = `
      <div class="empty-msg">
        <p class="empty-title">No tutorials match</p>
        <p>Try another keyword, clear filters, or open a learning path.</p>
        <button type="button" class="hero-btn hero-btn-primary" id="empty-reset">Reset filters</button>
      </div>`;
    document.getElementById("empty-reset")?.addEventListener("click", resetFilters);
    renderPagination(0, 1);
    return;
  }

  const progress = getProgress();
  const frag = document.createDocumentFragment();

  pagePosts.forEach((post, i) => {
    const card = document.createElement("article");
    card.className = "post-card";
    card.style.animationDelay = `${Math.min(i * 35, 280)}ms`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open ${post.title}`);
    const seen = progress[post.id] ? '<span class="card-seen">Opened</span>' : "";
    card.innerHTML = `
      <div class="card-meta">
        <span class="card-category cat-${categoryClass(post.category)}">${escapeHtml(post.category)}</span>
        <span class="card-level lvl-${post.level}">${post.level.charAt(0).toUpperCase() + post.level.slice(1)}</span>
        <span class="card-read-time">${post.readMins} min</span>
        ${seen}
      </div>
      <h3>${escapeHtml(post.title)}</h3>
      <p class="card-excerpt">${escapeHtml(post.excerpt)}</p>
      <div class="card-tags">${(post.tags || [])
        .slice(0, 4)
        .map((t) => `<span class="card-tag">#${escapeHtml(t)}</span>`)
        .join("")}</div>
      <span class="card-arrow" aria-hidden="true">→</span>
    `;
    const open = () => openPost(post);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    frag.appendChild(card);
  });

  postsGrid.appendChild(frag);
  renderPagination(posts.length, totalPages);
}

function renderPagination(total, totalPages) {
  if (!paginationEl) return;
  if (total <= PAGE_SIZE) {
    paginationEl.innerHTML = "";
    paginationEl.classList.add("hidden");
    return;
  }
  paginationEl.classList.remove("hidden");
  const buttons = [];
  buttons.push(
    `<button type="button" class="page-btn" data-page="prev" ${currentPage <= 1 ? "disabled" : ""}>Prev</button>`
  );
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
      if (buttons[buttons.length - 1] !== '<span class="page-gap">…</span>') {
        buttons.push('<span class="page-gap">…</span>');
      }
      continue;
    }
    buttons.push(
      `<button type="button" class="page-btn ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`
    );
  }
  buttons.push(
    `<button type="button" class="page-btn" data-page="next" ${
      currentPage >= totalPages ? "disabled" : ""
    }>Next</button>`
  );
  paginationEl.innerHTML = buttons.join("");
  paginationEl.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.page;
      if (v === "prev") currentPage = Math.max(1, currentPage - 1);
      else if (v === "next") currentPage = Math.min(totalPages, currentPage + 1);
      else currentPage = Number(v) || 1;
      renderHome();
      document.getElementById("tutorials")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function resetFilters() {
  currentCategory = "All";
  currentLevel = "All";
  currentSort = "level";
  currentPage = 1;
  searchQuery = "";
  if (searchInput) searchInput.value = "";
  if (sortSelect) sortSelect.value = "level";
  updateNavActive();
  document.querySelectorAll(".level-btn").forEach((b) => b.classList.toggle("active", b.dataset.level === "All"));
  renderHome();
}

/* ── Post view ───────────────────────────────────────── */
function openPost(post) {
  currentPostId = post.id;
  pushRecent(post.id);
  markRead(post.id);

  const slug = slugify(post.title);
  history.pushState({ postId: post.id }, post.title, `#post/${slug}`);
  document.title = `${post.title} — LearnHub`;

  homeView.classList.add("hidden");
  heroEl.classList.add("hidden");
  document.getElementById("below-hero")?.classList.add("hidden");
  postView.classList.remove("hidden");
  window.scrollTo(0, 0);

  pvBreadcrumb.innerHTML = `<a href="#" class="breadcrumb-home">Home</a> → <a href="#" class="breadcrumb-cat" data-cat="${escapeHtml(
    post.category
  )}">${escapeHtml(post.category)}</a> → <span>${escapeHtml(post.title)}</span>`;

  const levelLabels = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
  const postDate = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";
  pvMeta.innerHTML = `
    <span class="card-category cat-${categoryClass(post.category)}">${escapeHtml(post.category)}</span>
    <span class="card-level lvl-${post.level}">${levelLabels[post.level] || post.level}</span>
    <span class="card-read-time">${post.readMins} min read</span>
    ${postDate ? `<span class="card-date">By <strong>Ravi</strong> · ${postDate}</span>` : ""}
  `;

  pvTitle.textContent = post.title;
  pvExcerpt.textContent = post.excerpt;
  pvTags.innerHTML = (post.tags || []).map((t) => `<span class="pv-tag">#${escapeHtml(t)}</span>`).join("");
  pvBody.innerHTML = markdownToHtml(post.content);
  wireCopyButtons(pvBody);

  const headings = extractToc(post.content);
  const tocHtml = renderTocHtml(headings);
  pvToc.innerHTML = tocHtml;
  pvTocMobileList.innerHTML = tocHtml;

  document.querySelectorAll(".toc-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const id = link.getAttribute("href").slice(1);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const pageUrl = `${window.location.origin}${window.location.pathname}#post/${slug}`;
  shareTwitter.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(
    pageUrl
  )}`;
  shareLinkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;
  shareCopy.onclick = () => {
    navigator.clipboard.writeText(pageUrl).then(() => {
      shareCopy.textContent = "Copied!";
      setTimeout(() => {
        shareCopy.textContent = "Copy link";
      }, 2000);
    });
  };

  pvBreadcrumb.querySelector(".breadcrumb-home")?.addEventListener("click", (e) => {
    e.preventDefault();
    goHome();
  });
  const catLink = pvBreadcrumb.querySelector(".breadcrumb-cat");
  if (catLink) {
    catLink.addEventListener("click", (e) => {
      e.preventDefault();
      currentCategory = catLink.dataset.cat;
      currentPage = 1;
      updateNavActive();
      goHome();
    });
  }

  wireNextTutorial(post);
  renderRelated(post);
  startTocHighlighting();
  deferAds();
  renderRecent();
  updateLiveStats();
}

function wireNextTutorial(current) {
  if (!nextTutorialBtn) return;
  const list = getFilteredPosts();
  const idx = list.findIndex((p) => p.id === current.id);
  const next = idx >= 0 ? list[idx + 1] || list[0] : null;
  if (!next || next.id === current.id) {
    nextTutorialBtn.classList.add("hidden");
    return;
  }
  nextTutorialBtn.classList.remove("hidden");
  nextTutorialBtn.textContent = `Next: ${next.title}`;
  nextTutorialBtn.onclick = () => openPost(next);
}

function wireCopyButtons(root) {
  root.querySelectorAll(".copy-code").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const code = btn.parentElement?.querySelector("code")?.textContent || "";
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 1600);
      } catch {
        btn.textContent = "Failed";
      }
    });
  });
}

function goHome(scrollTop = true) {
  currentPostId = null;
  postView.classList.add("hidden");
  homeView.classList.remove("hidden");
  heroEl.classList.remove("hidden");
  document.getElementById("below-hero")?.classList.remove("hidden");
  document.title = "JS · Playwright · TypeScript — Learning Hub | Basics to Architect | Free 2026";
  history.pushState(null, "", window.location.pathname + (searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""));
  renderHome();
  renderRecent();
  updateLiveStats();
  if (scrollTop) window.scrollTo(0, 0);
}

function renderRelated(currentPost) {
  const related = loadPosts()
    .filter((p) => p.id !== currentPost.id)
    .map((p) => {
      let score = 0;
      if (p.category === currentPost.category) score += 3;
      if (p.level === currentPost.level) score += 1;
      score += (p.tags || []).filter((t) => (currentPost.tags || []).includes(t)).length * 2;
      return { post: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((r) => r.post);

  relatedGrid.innerHTML = "";
  related.forEach((post) => {
    const card = document.createElement("div");
    card.className = "related-card";
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="rc-cat">${escapeHtml(post.category)} · ${post.readMins} min</div>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.excerpt)}</p>
    `;
    const open = () => openPost(post);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") open();
    });
    relatedGrid.appendChild(card);
  });
}

function startTocHighlighting() {
  if (tocObserver) tocObserver.disconnect();
  const headingEls = pvBody.querySelectorAll("h2[id], h3[id]");
  if (!headingEls.length) return;
  tocObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          pvToc.querySelectorAll("a").forEach((a) => {
            a.classList.toggle("active", a.getAttribute("href") === `#${id}`);
          });
        }
      });
    },
    { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
  );
  headingEls.forEach((el) => tocObserver.observe(el));
}

function updateReadingProgress() {
  if (postView.classList.contains("hidden")) {
    readingProgress.style.width = "0%";
    return;
  }
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) {
    readingProgress.style.width = "0%";
    return;
  }
  readingProgress.style.width = `${Math.min(100, (window.scrollY / docHeight) * 100)}%`;
}

function updateBackToTop() {
  backToTop.classList.toggle("hidden", window.scrollY <= 400);
}

function deferAds() {
  const run = () => {
    try {
      document.querySelectorAll("ins.adsbygoogle").forEach(() => {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      });
    } catch {
      /* ignore */
    }
  };
  if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}

function updateNavActive() {
  navLinks.querySelectorAll(".nav-link[data-filter]").forEach((l) => {
    l.classList.toggle("active", l.dataset.filter === currentCategory);
  });
}

/* ── Events ──────────────────────────────────────────── */
navLinks.addEventListener("click", (e) => {
  const link = e.target.closest(".nav-link");
  if (!link) return;
  if (link.dataset.nav === "anchor") {
    navLinks.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
    return;
  }
  if (!link.dataset.filter) return;
  e.preventDefault();
  currentCategory = link.dataset.filter || "All";
  currentPage = 1;
  updateNavActive();
  navLinks.classList.remove("open");
  hamburger.setAttribute("aria-expanded", "false");
  if (!postView.classList.contains("hidden")) goHome();
  else {
    renderHome();
    document.getElementById("tutorials")?.scrollIntoView({ behavior: "smooth" });
  }
});

document.querySelector(".feed-levels")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".level-btn");
  if (!btn) return;
  document.querySelectorAll(".level-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentLevel = btn.dataset.level || "All";
  currentPage = 1;
  renderHome();
});

const onSearch = debounce(() => {
  searchQuery = searchInput.value || "";
  currentPage = 1;
  renderHome();
}, 180);
searchInput?.addEventListener("input", onSearch);

sortSelect?.addEventListener("change", () => {
  currentSort = sortSelect.value || "level";
  currentPage = 1;
  renderHome();
});

clearFiltersBtn?.addEventListener("click", resetFilters);

hamburger?.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  hamburger.setAttribute("aria-expanded", open ? "true" : "false");
});

pvBack?.addEventListener("click", () => goHome());
backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

window.addEventListener(
  "scroll",
  () => {
    updateReadingProgress();
    updateBackToTop();
  },
  { passive: true }
);

document.querySelectorAll("[data-footer-filter]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    currentCategory = link.dataset.footerFilter || "All";
    currentPage = 1;
    updateNavActive();
    goHome();
    document.getElementById("tutorials")?.scrollIntoView({ behavior: "smooth" });
  });
});

document.getElementById("nav-home")?.addEventListener("click", (e) => {
  e.preventDefault();
  resetFilters();
  goHome();
});

window.addEventListener("keydown", (e) => {
  const tag = (e.target && e.target.tagName) || "";
  if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
    e.preventDefault();
    searchInput?.focus();
    searchInput?.select();
  }
  if (e.key === "Escape") {
    if (document.activeElement === searchInput) searchInput.blur();
    navLinks.classList.remove("open");
    hamburger?.setAttribute("aria-expanded", "false");
  }
});

window.addEventListener("popstate", () => {
  const hash = window.location.hash;
  if (hash.startsWith("#post/")) {
    const slug = hash.replace("#post/", "");
    const post = loadPosts().find((p) => slugify(p.title) === slug);
    if (post) {
      openPost(post);
      return;
    }
  }
  goHome();
});

function handleDeepLink() {
  const hash = window.location.hash;
  if (hash.startsWith("#post/")) {
    const slug = hash.replace("#post/", "");
    const post = loadPosts().find((p) => slugify(p.title) === slug);
    if (post) {
      openPost(post);
      return;
    }
  }
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q && searchInput) {
    searchInput.value = q;
    searchQuery = q;
  }
}

document.querySelectorAll(".faq-item summary").forEach((sum) => {
  sum.addEventListener("click", () => {
    /* native details — no-op hook for analytics later */
  });
});

/* ── Boot ────────────────────────────────────────────── */
normalizePosts();
updateNavCounts();
updateLiveStats();
renderPaths();
renderRecent();
handleDeepLink();
if (postView.classList.contains("hidden")) renderHome();
deferAds();
