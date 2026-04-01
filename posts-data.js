/* ================================================================
   AUTO-GENERATED POSTS
   Regenerate with: npm run posts:generate
   ================================================================ */

// eslint-disable-next-line no-unused-vars
const ALL_POSTS = [
  {
    id: 1, category: "Playwright",
    title: "Environment Variables in playwright.config",
    tags: ["playwright","config","environment","setup"],
    excerpt: "Playwright auto-waits for actionable state before clicks, types, and assertions.",
    sourceUrl: "",
    createdAt: "2026-04-01T17:18:35.073Z",
    content: "## Core Concept\n\nPlaywright auto-waits for actionable state before clicks, types, and assertions.\n\n## Key Rules\n\n- Prefer role and test-id locators over brittle CSS chains.\n\n- Keep one user intent per test for faster triage.\n\n- Use retries for flaky infrastructure, not bad selectors.\n\n## 💡 Try This\n\n```js\nawait page.getByRole('button', { name: 'Save' }).click();\nawait expect(page.getByText('Saved')).toBeVisible();\n```\n\n## ❓ Quick Quiz\n\nQ: Why is getByRole usually more robust than nth-child selectors?\n\nA: It targets user-facing semantics and survives many layout changes.\n\n## 🔑 Key Takeaway\n\nReliable tests come from intent-driven locators and observable assertions."
  },
  {
    id: 2, category: "JavaScript",
    title: "async/await Clean Async Code",
    tags: ["javascript","async","await","asynchronous"],
    excerpt: "Pure functions improve testability and composability.",
    sourceUrl: "",
    createdAt: "2026-04-01T17:17:41.182Z",
    content: "## Core Concept\n\nPure functions improve testability and composability.\n\n## Key Rules\n\n- Avoid mutating shared objects inside utility functions.\n\n- Write small focused functions with clear input-output behavior.\n\n- Use const by default and let when reassignment is needed.\n\n## 💡 Try This\n\n```js\nconst nums = [1, 2, 3, 4];\nconst evens = nums.filter((n) => n % 2 === 0);\nconsole.log(evens);\n```\n\n## ❓ Quick Quiz\n\nQ: What is the practical difference between let and const?\n\nA: Both are block-scoped; const prevents reassignment of the binding.\n\n## 🔑 Key Takeaway\n\nModern JavaScript is clearer and safer with immutable-first patterns."
  }
];
