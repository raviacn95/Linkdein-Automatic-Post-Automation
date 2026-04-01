/* ================================================================
   AUTO-GENERATED POSTS
   Regenerate with: npm run posts:generate
   ================================================================ */

// eslint-disable-next-line no-unused-vars
const ALL_POSTS = [
  {
    id: 1, category: "JavaScript",
    title: "Understanding Prototypal Inheritance and the Prototype Chain",
    tags: ["javascript","prototypal inheritance","programming","web development"],
    excerpt: "Dive into the fascinating world of prototypal inheritance in JavaScript. Let's unravel the prototype chain together!",
    sourceUrl: "",
    createdAt: "2026-04-01T16:26:07.168Z",
    content: "## Core Concept Have you ever wondered how JavaScript objects inherit properties? Prototypal inheritance allows one object to access properties and methods of another object — but how does that play out in practice? ## Key Rules - All JavaScript objects have a prototype. - The prototype chain is a series of links between objects. - Properties or methods not found on an object can be looked up on its prototype. ## 💡 Try This ```js const animal = { eats: true }; const rabbit = Object.create(animal); rabbit.hops = true; console.log(rabbit.eats); // true ``` ## ❓ Quick Quiz Q: What does the `Object.create` method do? A: It creates a new object with the specified prototype object. ## 🔑 Key Takeaway Mastering prototypal inheritance can unlock powerful patterns in your JavaScript projects!"
  },
  {
    id: 2, category: "JavaScript",
    title: "Understanding WeakMap, WeakRef, and Memory Management in JavaScript",
    tags: ["javascript","memory management","weakmap","weakref"],
    excerpt: "Let's dive into how WeakMap and WeakRef can enhance your memory management strategies in JavaScript.",
    sourceUrl: "",
    createdAt: "2026-04-01T16:25:18.432Z",
    content: "## Core Concept Have you ever struggled with memory leaks in your JavaScript applications? WeakMap and WeakRef might just be your new best friends in managing memory effectively. ## Key Rules - WeakMap holds weak references to its keys, allowing for garbage collection when keys are no longer needed. - WeakRef creates a weak reference to an object, which can be collected if there are no other strong references. - Use these tools to prevent memory bloat, especially in large applications with dynamic data. ## 💡 Try This ```js let obj = {}; let weakMap = new WeakMap(); weakMap.set(obj, 'data'); obj = null; // Now the WeakMap can be garbage collected ``` ## ❓ Quick Quiz Q: What does WeakMap do with its keys when there are no strong references? A: It allows them to be garbage collected. ## 🔑 Key Takeaway Utilize WeakMap and WeakRef to optimize memory management and keep your applications running smoothly."
  }
];
