const { generateCompletion: openaiComplete } = require("../openaiApi");
const { generateCompletion: groqComplete } = require("../groqApi");

const SYSTEM = `You write ORIGINAL LearnHub tutorials for JavaScript, Playwright, or TypeScript.
Rules:
- Teach the topic in your own words. Do NOT copy source page prose.
- Use Markdown with ## and ### headings, short paragraphs, and one fenced code example.
- Include: Core idea, practical rules, a Try This snippet, a Quick Quiz (Q/A), Key takeaway.
- Mention the official source URL once at the end as "Further reading: <url>" for attribution only.
- No scraping how-to. No plagiarized paragraphs. Output markdown only (no JSON wrapper).`;

function templateLesson(source, raw) {
  const outline = safeJson(raw.outline_json, []);
  const codes = safeJson(raw.code_signals_json, []);
  const topic = source.topic;
  const code =
    codes[0] ||
    (source.category === "Playwright"
      ? `await page.getByRole('button', { name: 'Submit' }).click();`
      : source.category === "TypeScript"
        ? `type User = { id: number; name: string };\nconst u: User = { id: 1, name: 'Ada' };`
        : `const values = [1, 2, 3].map((n) => n * 2);`);

  const bullets = outline.slice(0, 5).map((h) => `- Build intuition around: ${h}`).join("\n") ||
    `- Focus on the real-world use of ${topic}`;

  return `## Core idea
${topic} shows up constantly in production work. This lesson turns the official docs outline into a practical mental model you can reuse in interviews and day-to-day coding.

${raw.description ? `Context signal from docs: ${raw.description.slice(0, 220)}` : ""}

## Practical rules
${bullets}
- Prefer clear names and small examples over memorizing every API edge case.
- Verify behavior with a tiny snippet before wiring it into a large suite.

## Try this
\`\`\`js
${code}
\`\`\`

## Quick quiz
Q: What is the first thing you should clarify about ${topic}?
A: The exact problem it solves and the smallest example that proves you understand it.

## Key takeaway
Master ${topic} by explaining it out loud, writing one minimal example, and only then reading deeper docs sections.

Further reading: ${source.url}`;
}

function safeJson(raw, fallback) {
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

async function callAi(config, userPrompt) {
  const order = config.ai?.providerOrder || ["groq", "openai"];
  const maxTokens = config.ai?.maxTokens || 1800;
  for (const provider of order) {
    try {
      if (provider === "groq") {
        const key = process.env.GROQ_API_KEY;
        if (!key) continue;
        return await groqComplete(key, process.env.GROQ_MODEL || "llama-3.1-8b-instant", SYSTEM, userPrompt, maxTokens);
      }
      if (provider === "openai") {
        const key = process.env.OPENAI_API_KEY;
        if (!key) continue;
        return await openaiComplete(key, process.env.OPENAI_MODEL || "gpt-4o-mini", SYSTEM, userPrompt, maxTokens);
      }
    } catch (e) {
      console.warn(`[transform] ${provider} failed: ${e.message}`);
    }
  }
  return null;
}

async function transformToLesson(source, raw, config) {
  const outline = safeJson(raw.outline_json, []);
  const codes = safeJson(raw.code_signals_json, []);
  const tags = safeJson(source.tags_json, []);

  const userPrompt = `Category: ${source.category}
Topic: ${source.topic}
Level: ${source.level}
Official source URL (attribute only): ${source.url}
Extracted title: ${raw.title || source.topic}
Extracted description: ${raw.description || ""}
Outline signals:
${outline.map((x) => `- ${x}`).join("\n") || "- (none)"}
Code signals (inspire an ORIGINAL example; do not paste copyrighted tutorials):
${codes.map((c, i) => `Snippet ${i + 1}:\n${c}`).join("\n\n") || "(none)"}

Write an original LearnHub markdown lesson now.`;

  let content = null;
  if (config.ai?.enabled !== false) {
    content = await callAi(config, userPrompt);
  }
  if (!content || content.length < 200) {
    content = templateLesson(source, raw);
  }

  const title = `${source.topic}`.replace(/\s+/g, " ").trim();
  const excerpt = `Original LearnHub lesson on ${source.topic} — practical rules, a try-this snippet, and a quick quiz. Inspired by official docs (not a republish).`;

  return {
    sourceId: source.id,
    rawPageId: raw.id,
    title,
    category: source.category,
    level: source.level || config.publish?.defaultLevel || "intermediate",
    tags: tags.length ? tags : [source.category.toLowerCase()],
    excerpt,
    content: content.trim(),
    sourceUrl: source.url,
    checksum: raw.checksum || "",
  };
}

module.exports = { transformToLesson, templateLesson };
