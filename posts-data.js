/* ================================================================
   AUTO-GENERATED POSTS
   Regenerate with: npm run posts:generate
   ================================================================ */

// eslint-disable-next-line no-unused-vars
const ALL_POSTS = [
  {
    id: 1, category: "JavaScript",
    title: "DefinitelyTyped and @types Packages: What You Need to Know",
    tags: ["typescript","definitelytyped","@types","javascript","development"],
    excerpt: "Explore the importance of DefinitelyTyped and @types packages in your TypeScript projects.",
    sourceUrl: "",
    createdAt: "2026-04-01T18:26:03.413Z",
    content: "## Core Concept Have you ever struggled with type definitions in TypeScript? DefinitelyTyped and @types can be your best friends in making the transition smoother. ## Key Rules - Always check if a package has its own type definitions before looking for @types. - Use DefinitelyTyped for community-maintained types that aren't included in the package. - Keep your @types packages updated to avoid compatibility issues. ## 💡 Try This ```js import { SomeType } from '@types/some-package'; const myVar: SomeType = {...}; ``` ## ❓ Quick Quiz Q: What is the primary purpose of DefinitelyTyped? A: To provide high-quality type definitions for popular JavaScript libraries. ## 🔑 Key Takeaway Utilizing DefinitelyTyped and @types packages can dramatically improve your TypeScript experience!"
  },
  {
    id: 2, category: "Playwright",
    title: "Mastering Playwright Assertions: toHaveText and toContainText",
    tags: ["playwright","testing","javascript","assertions"],
    excerpt: "Unlock the power of assertions in Playwright with toHaveText and toContainText! Let's dive in.",
    sourceUrl: "",
    createdAt: "2026-04-01T18:25:14.258Z",
    content: "## Core Concept Assertions are a game changer in Playwright testing. Have you ever struggled to verify text on a page? Understanding toHaveText and toContainText can streamline your testing process! ## Key Rules - Use `toHaveText` for exact matches to ensure the text is precisely what you expect. - Utilize `toContainText` when checking if a string is part of a larger text — flexibility is key! - Always consider case sensitivity; it matters in your assertions. ## 💡 Try This ```js await expect(page.locator('h1')).toHaveText('Welcome to My Site'); await expect(page.locator('p')).toContainText('your journey begins'); ``` ## ❓ Quick Quiz Q: When would you use `toContainText` instead of `toHaveText`? A: Use `toContainText` when you want to check for a substring within a larger text. ## 🔑 Key Takeaway Choose the right assertion to make your tests clearer and more effective!"
  }
];
