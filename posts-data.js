/* ================================================================
   AUTO-GENERATED POSTS
   Regenerate with: npm run posts:generate
   ================================================================ */

// eslint-disable-next-line no-unused-vars
const ALL_POSTS = [
  {
    id: 1, category: "JavaScript",
    title: "Unlocking the Power of ES6 Classes and Inheritance",
    tags: ["javascript","es6","classes","inheritance"],
    excerpt: "Let's dive into how ES6 classes can streamline your code and enhance your object-oriented programming skills.",
    sourceUrl: "",
    createdAt: "2026-04-01T03:26:03.488Z",
    content: "## Core Concept Have you ever felt overwhelmed by JavaScript's prototypal inheritance? ES6 classes bring a simpler and more intuitive way to work with objects! What if I told you that understanding classes could significantly improve your code structure? ## Key Rules - Use the `class` keyword to define a new class. - Inherit properties and methods with the `extends` keyword. - Use the `super()` function to call the constructor of the parent class. ## 💡 Try This ```js class Animal { constructor(name) { this.name = name; } speak() { console.log(`${this.name} makes a noise.`); } } class Dog extends Animal { speak() { console.log(`${this.name} barks.`); } } ``` ## ❓ Quick Quiz Q: What keyword do you use to create a subclass in ES6? A: `extends` ## 🔑 Key Takeaway Embrace ES6 classes to write cleaner and more maintainable JavaScript code!"
  },
  {
    id: 2, category: "Playwright",
    title: "Mastering Authentication State with storageState in Playwright",
    tags: ["playwright","testing","automation","web development"],
    excerpt: "Explore how to effectively manage authentication states in your Playwright tests using storageState.",
    sourceUrl: "",
    createdAt: "2026-04-01T03:25:14.682Z",
    content: "## Core Concept Have you ever struggled with managing authentication in your automated tests? Using `storageState` in Playwright can simplify your life by preserving the session across tests. ## Key Rules - Always save the storage state after logging in successfully. - Load the storage state before running tests that require authentication. - Keep your storage files organized by environment or user type for clarity. ## 💡 Try This ```js // Save storage state after login await page.context().storageState({ path: 'auth.json' }); // Load storage state before tests const context = await browser.newContext({ storageState: 'auth.json' }); ``` ## ❓ Quick Quiz Q: What command do you use to save the authentication state? A: `page.context().storageState()` ## 🔑 Key Takeaway Utilizing `storageState` can streamline your test setup and make authentication management a breeze!"
  }
];
