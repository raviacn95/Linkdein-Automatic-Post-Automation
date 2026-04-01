/* ================================================================
   AUTO-GENERATED POSTS
   Regenerate with: npm run posts:generate
   ================================================================ */

// eslint-disable-next-line no-unused-vars
const ALL_POSTS = [
  {
    id: 1, category: "JavaScript",
    title: "Understanding the Non-null Assertion Operator in TypeScript",
    tags: ["typescript","programming","developer tips"],
    excerpt: "Discover how to use the Non-null Assertion Operator effectively in TypeScript.",
    sourceUrl: "",
    createdAt: "2026-04-01T14:26:03.427Z",
    content: "## Core Concept Have you ever found yourself frustrated by TypeScript's strict null checks? The Non-null Assertion Operator (the `!` symbol) can help you overcome some of those hurdles. But is it always the right choice? ## Key Rules - Use it when you're certain a value won't be null or undefined. - Avoid overusing it as it can lead to runtime errors if you're wrong. - Combine it with proper checks to ensure your code is robust. ## 💡 Try This ```js let myValue: string | null = getValue(); let safeValue: string = myValue!; console.log(safeValue); ``` ## ❓ Quick Quiz Q: What does the Non-null Assertion Operator do? A: It tells TypeScript that a value is not null or undefined, bypassing the compiler's checks. ## 🔑 Key Takeaway Use the Non-null Assertion Operator judiciously to improve code safety without sacrificing clarity."
  },
  {
    id: 2, category: "JavaScript",
    title: "Understanding Local Storage and Session Storage in JavaScript",
    tags: ["javascript","web development","local storage","session storage"],
    excerpt: "Dive into the differences between Local Storage and Session Storage and how to use them effectively.",
    sourceUrl: "",
    createdAt: "2026-04-01T14:25:15.507Z",
    content: "## Core Concept Have you ever wondered how to store data on the client side? Local Storage and Session Storage are great tools that let you do just that, but they serve different purposes. Which one do you think you’d use more often? ## Key Rules - **Local Storage** persists even after the browser is closed. - **Session Storage** is cleared when the tab or window is closed. - Both are key-value pairs but have different lifetimes and scopes. ## 💡 Try This ```js // Storing data in Local Storage localStorage.setItem('username', 'JohnDoe'); // Storing data in Session Storage sessionStorage.setItem('sessionID', '123456'); ``` ## ❓ Quick Quiz Q: What happens to data in Session Storage when the tab is closed? A: It gets cleared. ## 🔑 Key Takeaway Choose Local Storage for persistent data and Session Storage for temporary session data!"
  }
];
