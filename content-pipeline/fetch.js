const crypto = require("crypto");
const { chromium } = require("playwright");

function checksum(parts) {
  return crypto.createHash("sha256").update(parts.filter(Boolean).join("\n")).digest("hex").slice(0, 24);
}

/**
 * Fetch allowlisted docs pages and extract teaching signals only
 * (title, outline, short code snippets) — never full page republication.
 */
async function fetchPageSignals(url, { headless = true, userAgent } = {}) {
  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage({
      userAgent:
        userAgent ||
        "LearnHubContentBot/1.0 (+https://raviacn95.github.io/; educational; respectful)",
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));

    const data = await page.evaluate(() => {
      const text = (el) => (el ? (el.textContent || "").trim().replace(/\s+/g, " ") : "");
      const title =
        text(document.querySelector("h1")) ||
        text(document.querySelector("title")) ||
        document.title ||
        "";
      const description =
        document.querySelector('meta[name="description"]')?.getAttribute("content") ||
        text(document.querySelector("p")) ||
        "";
      const outline = Array.from(document.querySelectorAll("h2, h3"))
        .map((h) => text(h))
        .filter((t) => t && t.length < 160)
        .slice(0, 12);
      const codeSignals = Array.from(document.querySelectorAll("pre code, pre"))
        .map((n) => text(n).slice(0, 280))
        .filter(Boolean)
        .slice(0, 4);
      return { title, description: description.slice(0, 400), outline, codeSignals };
    });

    return {
      status: "fetched",
      title: data.title,
      description: data.description,
      outline: data.outline,
      codeSignals: data.codeSignals,
      checksum: checksum([url, data.title, data.outline.join("|"), data.codeSignals.join("|")]),
      error: null,
    };
  } catch (err) {
    return {
      status: "error",
      title: "",
      description: "",
      outline: [],
      codeSignals: [],
      checksum: checksum([url, String(err.message || err)]),
      error: String(err.message || err),
    };
  } finally {
    await browser.close();
  }
}

module.exports = { fetchPageSignals, checksum };
