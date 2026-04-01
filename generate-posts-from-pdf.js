const fs = require("fs");
const path = require("path");
const readline = require("readline");
const pdf = require("pdf-parse");
const vm = require("vm");

const CONFIG_FILE = path.join(__dirname, "automation-config.json");

const TOPIC_LIBRARY = [
  {
    topic: "Playwright",
    category: "Playwright",
    titleSeed: "Playwright Reliable E2E",
    tags: ["playwright", "testing", "automation"],
    core: [
      "Playwright auto-waits for actionable state before clicks, types, and assertions.",
      "Locator-first design keeps tests stable as UI structure evolves.",
      "Tracing and video artifacts make flaky failures diagnosable in CI."
    ],
    rules: [
      "Prefer role and test-id locators over brittle CSS chains.",
      "Keep one user intent per test for faster triage.",
      "Use retries for flaky infrastructure, not bad selectors."
    ],
    workflow: "1. Install Playwright and configure browsers.\n2. Write a test spec targeting a user flow.\n3. Use locators to find elements by role or test-id.\n4. Add assertions to verify expected outcomes.\n5. Run tests locally and review trace on failure.\n6. Integrate into CI pipeline for every PR.",
    architecture: "Playwright launches a browser process via CDP or WebSocket. The Node.js test runner sends commands through a protocol bridge. Each test gets an isolated BrowserContext with its own cookies and storage. The auto-wait engine polls element state before executing actions. Traces, screenshots, and videos are captured at the context level and saved as artifacts.",
    tryThis: "await page.getByRole('button', { name: 'Save' }).click();\nawait expect(page.getByText('Saved')).toBeVisible();",
    quizQ: "Why is getByRole usually more robust than nth-child selectors?",
    quizA: "It targets user-facing semantics and survives many layout changes.",
    takeaway: "Reliable tests come from intent-driven locators and observable assertions."
  },
  {
    topic: "TypeScript",
    category: "TypeScript",
    titleSeed: "TypeScript Safer Refactors",
    tags: ["typescript", "types", "javascript"],
    core: [
      "TypeScript catches type mismatches during development before runtime.",
      "Union types and narrowing model real-world data variability safely.",
      "Interfaces and utility types keep contracts explicit across modules."
    ],
    rules: [
      "Use strict mode and avoid any in business logic.",
      "Model API responses with exact interfaces.",
      "Use unknown at boundaries, then narrow deliberately."
    ],
    workflow: "1. Define interfaces for your data shapes.\n2. Enable strict mode in tsconfig.json.\n3. Type function parameters and return values.\n4. Use union types for variables with multiple states.\n5. Add type guards at system boundaries.\n6. Refactor confidently — the compiler catches mismatches.",
    architecture: "TypeScript source is parsed into an AST by the compiler. The type checker walks the AST, resolving symbols and verifying constraints. Type inference flows forward through expressions and narrows via control flow analysis. The emitter produces plain JavaScript with types erased. Declaration files (.d.ts) preserve type information for consumers.",
    tryThis: "type Status = 'open' | 'closed';\nfunction isOpen(s: Status) { return s === 'open'; }\nconsole.log(isOpen('open'));",
    quizQ: "When should unknown be preferred over any?",
    quizA: "At external boundaries where validation and narrowing are required.",
    takeaway: "Strong typing turns refactors from risky guesswork into confident change."
  },
  {
    topic: "Azure DevOps",
    category: "Both",
    titleSeed: "Azure DevOps Pipeline Quality",
    tags: ["azuredevops", "cicd", "devops"],
    core: [
      "Azure DevOps pipelines standardize build, test, and release steps.",
      "Branch policies enforce quality gates before merge.",
      "Artifacts and environments provide traceable deployment flow."
    ],
    rules: [
      "Run lint, unit, and E2E checks in separate jobs.",
      "Fail fast on validation errors to save compute time.",
      "Version artifacts and promote across environments."
    ],
    workflow: "1. Create a YAML pipeline with trigger rules.\n2. Define build stages: install, lint, test, package.\n3. Configure branch policies requiring successful builds.\n4. Publish build artifacts to Azure Artifacts.\n5. Set up release environments with approval gates.\n6. Monitor deployments with dashboards and alerts.",
    architecture: "A commit triggers the pipeline agent pool. The orchestrator schedules jobs across available agents. Each job runs in an isolated workspace with cached dependencies. Tasks execute sequentially within a job, sharing the workspace. Artifacts are published to a feed and promoted through release stages with environment-specific approvals.",
    tryThis: "trigger:\n- main\n\npool:\n  vmImage: ubuntu-latest\n\nsteps:\n- script: npm ci && npm test",
    quizQ: "Why should artifacts be immutable between test and production stages?",
    quizA: "Immutability guarantees the exact tested build is what gets deployed.",
    takeaway: "Predictable delivery needs policy gates, reproducible builds, and clear promotion paths."
  },
  {
    topic: "JavaScript",
    category: "JavaScript",
    titleSeed: "JavaScript Core Patterns",
    tags: ["javascript", "variables", "basics"],
    core: [
      "JavaScript block scoping with let and const prevents accidental leaks.",
      "Pure functions improve testability and composability.",
      "Array methods like map, filter, and reduce simplify data transformations."
    ],
    rules: [
      "Use const by default and let when reassignment is needed.",
      "Avoid mutating shared objects inside utility functions.",
      "Write small focused functions with clear input-output behavior."
    ],
    workflow: "1. Identify the data structures your feature needs.\n2. Define pure functions for each transformation step.\n3. Compose functions using array methods or pipes.\n4. Handle errors at the boundary, not inside helpers.\n5. Write unit tests for each function.\n6. Refactor for readability once tests pass.",
    architecture: "JavaScript code is parsed into an AST by the engine (V8/SpiderMonkey). The interpreter generates bytecode for immediate execution. Hot paths are detected by the profiler and compiled to optimized machine code by the JIT compiler. The event loop processes the call stack, microtask queue, and macrotask queue in order. Garbage collection reclaims memory from unreachable objects using generational marking.",
    tryThis: "const nums = [1, 2, 3, 4];\nconst evens = nums.filter((n) => n % 2 === 0);\nconsole.log(evens);",
    quizQ: "What is the practical difference between let and const?",
    quizA: "Both are block-scoped; const prevents reassignment of the binding.",
    takeaway: "Modern JavaScript is clearer and safer with immutable-first patterns."
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// TOPIC_SEEDS — 100 unique subtopics for concurrent AI worker generation
// 34 Playwright · 33 JavaScript · 33 TypeScript
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_SEEDS = [
  // ── Playwright (34) ── Beginner → Intermediate → Advanced ────────────────
  { topic: "Playwright", subtopic: "Page Navigation and URL Control",              category: "Playwright",  tags: ["playwright","testing","e2e","navigation"], level: "beginner" },
  { topic: "Playwright", subtopic: "Locators: getByRole Best Practices",           category: "Playwright",  tags: ["playwright","locators","accessibility","testing"], level: "beginner" },
  { topic: "Playwright", subtopic: "Locators: getByText and getByLabel",           category: "Playwright",  tags: ["playwright","locators","ui","testing"], level: "beginner" },
  { topic: "Playwright", subtopic: "Locators: getByTestId Custom Attributes",      category: "Playwright",  tags: ["playwright","locators","testid","best-practices"], level: "beginner" },
  { topic: "Playwright", subtopic: "Auto-Waiting: Eliminating Flaky Sleeps",       category: "Playwright",  tags: ["playwright","auto-wait","flakiness","reliability"], level: "beginner" },
  { topic: "Playwright", subtopic: "Assertions: toBeVisible and toBeHidden",       category: "Playwright",  tags: ["playwright","assertions","visibility","testing"], level: "beginner" },
  { topic: "Playwright", subtopic: "Assertions: toHaveText and toContainText",     category: "Playwright",  tags: ["playwright","assertions","text","testing"], level: "beginner" },
  { topic: "Playwright", subtopic: "Assertions: toHaveValue and toBeChecked",      category: "Playwright",  tags: ["playwright","assertions","forms","testing"], level: "beginner" },
  { topic: "Playwright", subtopic: "Screenshots and Visual Regression Testing",    category: "Playwright",  tags: ["playwright","screenshots","visual","regression"], level: "beginner" },
  { topic: "Playwright", subtopic: "Video Recording in E2E Tests",                 category: "Playwright",  tags: ["playwright","video","debugging","ci"], level: "beginner" },
  { topic: "Playwright", subtopic: "Dialog Handling: alert confirm prompt",        category: "Playwright",  tags: ["playwright","dialogs","alerts","testing"], level: "beginner" },
  { topic: "Playwright", subtopic: "Soft Assertions for Non-blocking Checks",      category: "Playwright",  tags: ["playwright","soft-assertions","debugging","testing"], level: "intermediate" },
  { topic: "Playwright", subtopic: "Trace Viewer and Debugging Failures",          category: "Playwright",  tags: ["playwright","trace","debugging","ci"], level: "intermediate" },
  { topic: "Playwright", subtopic: "Test Fixtures: Setup and Teardown",            category: "Playwright",  tags: ["playwright","fixtures","setup","testing"], level: "intermediate" },
  { topic: "Playwright", subtopic: "beforeEach afterEach beforeAll afterAll Hooks",category: "Playwright",  tags: ["playwright","hooks","lifecycle","testing"], level: "intermediate" },
  { topic: "Playwright", subtopic: "Page Object Model Pattern",                    category: "Playwright",  tags: ["playwright","pom","patterns","architecture"], level: "intermediate" },
  { topic: "Playwright", subtopic: "API Testing with Playwright request",          category: "Playwright",  tags: ["playwright","api","testing","automation"], level: "intermediate" },
  { topic: "Playwright", subtopic: "Network Interception and Request Mocking",     category: "Playwright",  tags: ["playwright","network","mocking","testing"], level: "intermediate" },
  { topic: "Playwright", subtopic: "Authentication State with storageState",       category: "Playwright",  tags: ["playwright","auth","session","storagestate"], level: "intermediate" },
  { topic: "Playwright", subtopic: "File Upload Testing Strategies",               category: "Playwright",  tags: ["playwright","file-upload","forms","testing"], level: "intermediate" },
  { topic: "Playwright", subtopic: "iFrame Testing Strategies",                    category: "Playwright",  tags: ["playwright","iframe","web","testing"], level: "intermediate" },
  { topic: "Playwright", subtopic: "Multiple Tabs and New Page Handling",          category: "Playwright",  tags: ["playwright","tabs","multi-page","testing"], level: "intermediate" },
  { topic: "Playwright", subtopic: "Environment Variables in playwright.config",   category: "Playwright",  tags: ["playwright","config","environment","setup"], level: "intermediate" },
  { topic: "Playwright", subtopic: "Multi-Browser Testing Chrome Firefox WebKit",  category: "Playwright",  tags: ["playwright","browsers","cross-browser","testing"], level: "advanced" },
  { topic: "Playwright", subtopic: "Mobile Emulation and Responsive Testing",      category: "Playwright",  tags: ["playwright","mobile","emulation","responsive"], level: "advanced" },
  { topic: "Playwright", subtopic: "Geolocation and Browser Permissions",          category: "Playwright",  tags: ["playwright","geolocation","permissions","testing"], level: "advanced" },
  { topic: "Playwright", subtopic: "Parallel Test Execution and Sharding",         category: "Playwright",  tags: ["playwright","parallel","sharding","performance"], level: "advanced" },
  { topic: "Playwright", subtopic: "Retry Strategies and Flakiness Control",       category: "Playwright",  tags: ["playwright","retries","flakiness","reliability"], level: "advanced" },
  { topic: "Playwright", subtopic: "playwright.config.ts Full Overview",           category: "Playwright",  tags: ["playwright","config","typescript","setup"], level: "advanced" },
  { topic: "Playwright", subtopic: "CI/CD Integration with GitHub Actions",        category: "Playwright",  tags: ["playwright","ci","github-actions","devops"], level: "advanced" },
  { topic: "Playwright", subtopic: "Custom Reporters and Test Results",            category: "Playwright",  tags: ["playwright","reporters","results","testing"], level: "advanced" },
  { topic: "Playwright", subtopic: "Accessibility Testing with Playwright",        category: "Playwright",  tags: ["playwright","accessibility","axe","a11y"], level: "advanced" },
  { topic: "Playwright", subtopic: "Web Components and Shadow DOM Testing",        category: "Playwright",  tags: ["playwright","shadow-dom","components","testing"], level: "advanced" },
  { topic: "Playwright", subtopic: "Component Testing with Playwright CT",         category: "Playwright",  tags: ["playwright","component-testing","ct","react"], level: "advanced" },
  // ── JavaScript (33) ── Beginner → Intermediate → Advanced ────────────────
  { topic: "JavaScript", subtopic: "var vs let vs const Scoping Rules",            category: "JavaScript",  tags: ["javascript","variables","scope","es6"], level: "beginner" },
  { topic: "JavaScript", subtopic: "Arrow Functions vs Regular Functions",         category: "JavaScript",  tags: ["javascript","arrow-functions","es6","functions"], level: "beginner" },
  { topic: "JavaScript", subtopic: "Template Literals and Tagged Templates",       category: "JavaScript",  tags: ["javascript","template-literals","strings","es6"], level: "beginner" },
  { topic: "JavaScript", subtopic: "Array and Object Destructuring",               category: "JavaScript",  tags: ["javascript","destructuring","arrays","objects"], level: "beginner" },
  { topic: "JavaScript", subtopic: "Spread and Rest Operators",                    category: "JavaScript",  tags: ["javascript","spread","rest","es6"], level: "beginner" },
  { topic: "JavaScript", subtopic: "Default Function Parameters",                  category: "JavaScript",  tags: ["javascript","functions","parameters","defaults"], level: "beginner" },
  { topic: "JavaScript", subtopic: "Array.map() for Data Transformation",          category: "JavaScript",  tags: ["javascript","map","arrays","functional"], level: "beginner" },
  { topic: "JavaScript", subtopic: "Array.filter() for Conditional Selection",     category: "JavaScript",  tags: ["javascript","filter","arrays","functional"], level: "beginner" },
  { topic: "JavaScript", subtopic: "Array.find() and findIndex()",                 category: "JavaScript",  tags: ["javascript","find","arrays","search"], level: "beginner" },
  { topic: "JavaScript", subtopic: "JSON.parse and JSON.stringify",                category: "JavaScript",  tags: ["javascript","json","serialization","data"], level: "beginner" },
  { topic: "JavaScript", subtopic: "Local Storage and Session Storage",            category: "JavaScript",  tags: ["javascript","storage","browser","web"], level: "beginner" },
  { topic: "JavaScript", subtopic: "Promises: then catch finally",                 category: "JavaScript",  tags: ["javascript","promises","async","es6"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "async/await Clean Async Code",                 category: "JavaScript",  tags: ["javascript","async","await","asynchronous"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "Promise.all race allSettled any",              category: "JavaScript",  tags: ["javascript","promise","concurrency","async"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "Array.reduce() for Accumulation",              category: "JavaScript",  tags: ["javascript","reduce","arrays","functional"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "Array.flat() and flatMap()",                   category: "JavaScript",  tags: ["javascript","flat","arrays","es2019"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "Object.keys() values() and entries()",         category: "JavaScript",  tags: ["javascript","objects","iteration","es6"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "Object.assign() and Object Spread",            category: "JavaScript",  tags: ["javascript","objects","merging","spread"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "Closures and Lexical Scope",                   category: "JavaScript",  tags: ["javascript","closures","scope","functions"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "ES6 Classes and Inheritance",                  category: "JavaScript",  tags: ["javascript","classes","es6","oop"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "ES Modules import and export",                 category: "JavaScript",  tags: ["javascript","modules","import","export"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "Error Handling try catch finally",             category: "JavaScript",  tags: ["javascript","errors","try-catch","debugging"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "Fetch API and HTTP Requests",                  category: "JavaScript",  tags: ["javascript","fetch","http","api"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "Regular Expressions in JavaScript",            category: "JavaScript",  tags: ["javascript","regex","patterns","strings"], level: "intermediate" },
  { topic: "JavaScript", subtopic: "Prototypal Inheritance and Prototype Chain",   category: "JavaScript",  tags: ["javascript","prototype","inheritance","oop"], level: "advanced" },
  { topic: "JavaScript", subtopic: "Nullish Coalescing and Optional Chaining",     category: "JavaScript",  tags: ["javascript","nullish","optional-chaining","es2020"], level: "advanced" },
  { topic: "JavaScript", subtopic: "Event Loop Call Stack and Microtasks",         category: "JavaScript",  tags: ["javascript","event-loop","async","microtasks"], level: "advanced" },
  { topic: "JavaScript", subtopic: "setTimeout and setInterval Patterns",          category: "JavaScript",  tags: ["javascript","timers","async","patterns"], level: "advanced" },
  { topic: "JavaScript", subtopic: "Map and Set Data Structures",                  category: "JavaScript",  tags: ["javascript","map","set","data-structures"], level: "advanced" },
  { topic: "JavaScript", subtopic: "WeakMap WeakRef and Memory Management",        category: "JavaScript",  tags: ["javascript","weakmap","memory","advanced"], level: "advanced" },
  { topic: "JavaScript", subtopic: "Generators and Iterators",                     category: "JavaScript",  tags: ["javascript","generators","iterators","advanced"], level: "advanced" },
  { topic: "JavaScript", subtopic: "Proxy and Reflect API",                        category: "JavaScript",  tags: ["javascript","proxy","reflect","metaprogramming"], level: "advanced" },
  { topic: "JavaScript", subtopic: "Short-Circuit Evaluation and Logical Assignment",category: "JavaScript",tags: ["javascript","logical","operators","es2021"], level: "advanced" },
  // ── TypeScript (33) ── Beginner → Intermediate → Advanced ────────────────
  { topic: "TypeScript", subtopic: "Basic Types string number boolean any",        category: "TypeScript",  tags: ["typescript","types","basics","javascript"], level: "beginner" },
  { topic: "TypeScript", subtopic: "Interfaces vs Type Aliases",                   category: "TypeScript",  tags: ["typescript","interfaces","types","design"], level: "beginner" },
  { topic: "TypeScript", subtopic: "Union Types and Intersection Types",           category: "TypeScript",  tags: ["typescript","union","intersection","types"], level: "beginner" },
  { topic: "TypeScript", subtopic: "Enums Numeric String and Const",               category: "TypeScript",  tags: ["typescript","enums","constants","types"], level: "beginner" },
  { topic: "TypeScript", subtopic: "Tuple Types and Labeled Tuples",               category: "TypeScript",  tags: ["typescript","tuples","arrays","types"], level: "beginner" },
  { topic: "TypeScript", subtopic: "Strict Mode Configuration",                    category: "TypeScript",  tags: ["typescript","strict","config","best-practices"], level: "beginner" },
  { topic: "TypeScript", subtopic: "tsconfig.json Key Compiler Options",           category: "TypeScript",  tags: ["typescript","tsconfig","compiler","setup"], level: "beginner" },
  { topic: "TypeScript", subtopic: "Type Assertions as and satisfies",             category: "TypeScript",  tags: ["typescript","assertions","satisfies","safety"], level: "beginner" },
  { topic: "TypeScript", subtopic: "Non-null Assertion Operator",                  category: "TypeScript",  tags: ["typescript","non-null","assertion","safety"], level: "beginner" },
  { topic: "TypeScript", subtopic: "keyof and typeof Operators",                   category: "TypeScript",  tags: ["typescript","keyof","typeof","type-level"], level: "beginner" },
  { topic: "TypeScript", subtopic: "DefinitelyTyped and @types Packages",          category: "TypeScript",  tags: ["typescript","definitelytyped","types","npm"], level: "beginner" },
  { topic: "TypeScript", subtopic: "Type Narrowing and Type Guards",               category: "TypeScript",  tags: ["typescript","narrowing","guards","safety"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "Generics Type Parameters and Constraints",     category: "TypeScript",  tags: ["typescript","generics","constraints","reusable"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "Generic Functions and Interfaces",             category: "TypeScript",  tags: ["typescript","generics","functions","patterns"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "Partial and Required Utility Types",           category: "TypeScript",  tags: ["typescript","partial","required","utility"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "Pick and Omit Utility Types",                  category: "TypeScript",  tags: ["typescript","pick","omit","utility"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "Readonly and ReadonlyArray",                   category: "TypeScript",  tags: ["typescript","readonly","immutable","safety"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "Record Type for Object Maps",                  category: "TypeScript",  tags: ["typescript","record","maps","objects"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "Exclude Extract and NonNullable",              category: "TypeScript",  tags: ["typescript","exclude","extract","utility"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "ReturnType and Parameters Utilities",          category: "TypeScript",  tags: ["typescript","returntype","parameters","inference"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "abstract Classes and Methods",                 category: "TypeScript",  tags: ["typescript","abstract","classes","oop"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "Access Modifiers public private protected",    category: "TypeScript",  tags: ["typescript","access","modifiers","encapsulation"], level: "intermediate" },
  { topic: "TypeScript", subtopic: "Conditional Types with extends",               category: "TypeScript",  tags: ["typescript","conditional","types","advanced"], level: "advanced" },
  { topic: "TypeScript", subtopic: "Mapped Types and Index Signatures",            category: "TypeScript",  tags: ["typescript","mapped","index-signature","types"], level: "advanced" },
  { topic: "TypeScript", subtopic: "Template Literal Types",                       category: "TypeScript",  tags: ["typescript","template-literal","string","types"], level: "advanced" },
  { topic: "TypeScript", subtopic: "Infer Keyword in Conditional Types",           category: "TypeScript",  tags: ["typescript","infer","conditional","advanced"], level: "advanced" },
  { topic: "TypeScript", subtopic: "Discriminated Unions Pattern",                 category: "TypeScript",  tags: ["typescript","discriminated","unions","patterns"], level: "advanced" },
  { topic: "TypeScript", subtopic: "Declaration Merging",                          category: "TypeScript",  tags: ["typescript","declaration","merging","modules"], level: "advanced" },
  { topic: "TypeScript", subtopic: "Function Overloads",                           category: "TypeScript",  tags: ["typescript","overloads","functions","signatures"], level: "advanced" },
  { topic: "TypeScript", subtopic: "Decorators Class and Method",                  category: "TypeScript",  tags: ["typescript","decorators","metadata","advanced"], level: "advanced" },
  { topic: "TypeScript", subtopic: "Path Aliases and Module Resolution",           category: "TypeScript",  tags: ["typescript","paths","modules","config"], level: "advanced" },
  { topic: "TypeScript", subtopic: "Type Declaration Files .d.ts",                 category: "TypeScript",  tags: ["typescript","declaration","dts","types"], level: "advanced" },
  { topic: "TypeScript", subtopic: "Migrating JavaScript to TypeScript",           category: "TypeScript",  tags: ["typescript","migration","javascript","gradual"], level: "advanced" }
];

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function loadConfig() {
  const defaults = {
    scheduler: {
      enabled: true,
      intervalMinutes: 60,
      intervalJitterPercent: 20,
      runImmediately: true,
      maxRuns: 0
    },
    linkedin: {
      postCount: 2,
      startIndex: 0,
      delayBetweenPostsMinSec: 30,
      delayBetweenPostsMaxSec: 90,
      prePostDelayMinSec: 2,
      prePostDelayMaxSec: 5
    },
    safetyLimits: {
      maxPostsPerDay: 10,
      similarityThreshold: 0.6,
      maxHistory: 50
    },
    contentGeneration: {
      sourceMode: "topics",
      targetPostCount: 100,
      pdfPath: "",
      promptForPdfPath: true,
      defaultCategory: "JavaScript",
      autoGenerateOnEveryRun: true,
      topicPool: ["Playwright", "TypeScript", "Azure DevOps", "JavaScript"],
      tags: ["javascript", "automation"],
      outputFile: "posts-data.js"
    },
    aiGeneration: {
      enabled: false,
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      apiKeyEnvVar: "OPENAI_API_KEY",
      systemPrompt: "Generate high-quality technical social posts as valid JSON only."
    }
  };

  if (!fs.existsSync(CONFIG_FILE)) {
    return defaults;
  }

  const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  return {
    ...defaults,
    ...parsed,
    scheduler: {
      ...defaults.scheduler,
      ...(parsed.scheduler || {})
    },
    linkedin: {
      ...defaults.linkedin,
      ...(parsed.linkedin || {})
    },
    safetyLimits: {
      ...defaults.safetyLimits,
      ...(parsed.safetyLimits || {})
    },
    contentGeneration: {
      ...defaults.contentGeneration,
      ...(parsed.contentGeneration || {})
    },
    aiGeneration: {
      ...defaults.aiGeneration,
      ...(parsed.aiGeneration || {})
    }
  };
}

function normalizeSentence(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f]/g, "")
    .trim();
}

function splitIntoSentences(text) {
  return normalizeSentence(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function extractCodeBlocks(rawText) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim());
  const codeLines = lines.filter((line) =>
    /\b(function|const|let|var|if|for|while|return|=>|console\.log|class|import|export)\b/.test(line)
  );

  const blocks = [];
  for (let i = 0; i < codeLines.length; i += 3) {
    const snippet = codeLines.slice(i, i + 3).join("\n");
    if (snippet.length > 0) {
      blocks.push(snippet);
    }
  }
  return blocks;
}

function buildDetailedContent({ topic, subtopic, core, rules, workflow, architecture, tryThis, quizQ, quizA, takeaway }) {
  const lang = (topic || "").toLowerCase() === "typescript" ? "ts" : "js";
  const topicName = subtopic || topic || "this concept";
  return [
    "## How to Use " + topicName + " Quickly?",
    "",
    core,
    "",
    "Here is a quick example to get started:",
    "",
    "```" + lang,
    tryThis,
    "```",
    "",
    "## What is " + topicName + "?",
    "",
    core,
    "",
    "Understanding this concept is essential for writing reliable, maintainable code. It forms the foundation for many advanced patterns you will encounter in production applications.",
    "",
    "When applied correctly, it improves code readability and reduces bugs during development and maintenance cycles.",
    "",
    "## When to Use " + topicName + "?",
    "",
    "You should use this approach when:",
    "",
    "- Building features that depend on " + (rules[0] || "structured patterns").toLowerCase(),
    "- Working with teams where " + (rules[1] || "consistent approaches").toLowerCase(),
    "- Validating that " + (rules[2] || "code behaves as expected").toLowerCase(),
    "- Refactoring existing code for better structure",
    "- Writing tests that need predictable behavior",
    "",
    "## Step by Step Guide with Examples",
    "",
    workflow || "1. Identify the problem scope.\n2. Choose the right tool or pattern.\n3. Implement a minimal solution.\n4. Validate with tests.\n5. Refactor and optimize.\n6. Document the approach for your team.",
    "",
    "```" + lang,
    tryThis,
    "```",
    "",
    "This example demonstrates the core pattern. Each step builds on the previous one to create a complete solution.",
    "",
    "## Method Comparison",
    "",
    "| Approach | When to Use | Key Benefit | Complexity |",
    "| --- | --- | --- | --- |",
    "| " + (rules[0] || "Pattern A") + " | Default scenarios | Simplicity | Low |",
    "| " + (rules[1] || "Pattern B") + " | Complex workflows | Flexibility | Medium |",
    "| " + (rules[2] || "Pattern C") + " | Enterprise scale | Robustness | High |",
    "",
    "## Best Practices",
    "",
    "- " + rules[0],
    "- " + rules[1],
    "- " + rules[2],
    "- Always validate inputs at system boundaries before processing",
    "- Write tests that cover both happy paths and edge cases",
    "- Document trade-offs when choosing between approaches",
    "",
    "### Common Mistakes to Avoid",
    "",
    "- Skipping validation which leads to silent failures in production",
    "- Over-engineering simple solutions when a straightforward approach works",
    "- Ignoring error handling at integration boundaries",
    "- Not writing tests for edge cases and boundary conditions",
    "",
    "## Common Issues and Fixes",
    "",
    "### Why does unexpected behavior occur?",
    "",
    "This usually happens when inputs are not validated or when assumptions about state are incorrect. Always verify the current state before performing operations.",
    "",
    "### Why does the output not match expectations?",
    "",
    "Check that your configuration and parameters match the expected format. Review the documentation for any required setup steps you may have missed.",
    "",
    "## Advanced Scenarios",
    "",
    "### " + topicName + " in Complex Workflows",
    "",
    architecture || "The input enters the system, passes through parsing and validation layers, gets processed by the core engine, and the result is returned to the caller. Each layer is decoupled for testability.",
    "",
    "### Integration with Other Patterns",
    "",
    "When combining this with other patterns, ensure each component has clear boundaries and responsibilities. This makes the system easier to test and maintain.",
    "",
    "## Real World Use Cases",
    "",
    "### Use Case: Production Application",
    "",
    "In production applications, this pattern helps maintain consistency across the codebase while enabling teams to work independently on different features.",
    "",
    "### Use Case: CI/CD Pipeline",
    "",
    "Integrating this approach into your CI/CD pipeline ensures quality gates are met before deployment, reducing the risk of production issues.",
    "",
    "## FAQs",
    "",
    "### What is " + topicName + "?",
    "",
    core,
    "",
    "### When should I use " + topicName + "?",
    "",
    "Use it when you need " + (rules[0] || "structured, reliable patterns").toLowerCase() + ". It is especially valuable in team environments and production codebases.",
    "",
    "### What are the best practices for " + topicName + "?",
    "",
    rules[0] + " " + rules[1] + " " + rules[2],
    "",
    "### " + quizQ,
    "",
    quizA,
    "",
    "### What are common mistakes with " + topicName + "?",
    "",
    "The most common mistake is not validating inputs at boundaries. Always ensure data is in the expected format before processing.",
    "",
    "## Conclusion",
    "",
    takeaway + " In this guide, you learned the fundamentals of " + topicName + ", step by step implementation, best practices, and how to avoid common mistakes. As a next step, try applying these patterns in your own projects and combine them with related concepts."
  ].join("\n");
}

function generatedTimestamp(baseTime, index) {
  return new Date(baseTime - index * 60000).toISOString();
}

function createTopicPosts(cfg) {
  const target = Number(cfg.targetPostCount || 100);
  const topicPool = Array.isArray(cfg.topicPool) && cfg.topicPool.length > 0 ? cfg.topicPool : ["JavaScript"];
  const selectedTopicTemplates = TOPIC_LIBRARY.filter((entry) => topicPool.includes(entry.topic));
  const templates = selectedTopicTemplates.length > 0 ? selectedTopicTemplates : TOPIC_LIBRARY;
  const nowSeed = Date.now();
  const baseTime = Date.now();

  const posts = [];
  for (let i = 0; i < target; i += 1) {
    const tpl = templates[i % templates.length];
    const rotation = (i + nowSeed) % tpl.core.length;
    const core = tpl.core[rotation];
    const rules = [
      tpl.rules[rotation % tpl.rules.length],
      tpl.rules[(rotation + 1) % tpl.rules.length],
      tpl.rules[(rotation + 2) % tpl.rules.length]
    ];

    const title = `${tpl.titleSeed} ${i + 1}`;
    const excerpt = core.length > 140 ? `${core.slice(0, 137)}...` : core;
    const tags = Array.from(new Set([...(cfg.tags || []), ...tpl.tags])).slice(0, 6);

    const levels = ["beginner", "intermediate", "advanced"];
    posts.push({
      id: i + 1,
      category: tpl.category || cfg.defaultCategory || "JavaScript",
      title,
      tags,
      excerpt,
      sourceUrl: "",
      createdAt: generatedTimestamp(baseTime, i),
      level: levels[i % 3],
      content: buildDetailedContent({
        topic: tpl.topic,
        subtopic: tpl.titleSeed,
        core,
        rules,
        workflow: tpl.workflow,
        architecture: tpl.architecture,
        tryThis: tpl.tryThis,
        quizQ: tpl.quizQ,
        quizA: tpl.quizA,
        takeaway: tpl.takeaway
      })
    });
  }

  return posts;
}

function generatePostsFromText(rawText, cfg) {
  const sentencePool = splitIntoSentences(rawText);
  const codePool = extractCodeBlocks(rawText);
  const target = Number(cfg.targetPostCount || 100);
  const tags = Array.isArray(cfg.tags) && cfg.tags.length > 0 ? cfg.tags : ["javascript", "automation"];
  const posts = [];
  const baseTime = Date.now();

  if (sentencePool.length === 0) {
    throw new Error("PDF content looks empty after parsing. Use a text-based PDF with selectable text.");
  }

  for (let i = 0; i < target; i += 1) {
    const core = sentencePool[i % sentencePool.length];
    const rules = [
      sentencePool[(i + 1) % sentencePool.length] || "Prefer small reusable functions.",
      sentencePool[(i + 2) % sentencePool.length] || "Validate inputs and expected outputs.",
      sentencePool[(i + 3) % sentencePool.length] || "Keep naming explicit and consistent."
    ];
    const quizQ = sentencePool[(i + 4) % sentencePool.length] || "What test case would fail first?";
    const quizA = sentencePool[(i + 5) % sentencePool.length] || "Start with empty, invalid, and boundary inputs.";
    const takeaway = sentencePool[(i + 6) % sentencePool.length] || "Capture reusable patterns and validate behavior with examples.";
    const code = codePool.length > 0 ? codePool[i % codePool.length] : "const result = values.filter(Boolean);\nconsole.log(result);";

    const titleWords = normalizeSentence(core)
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 7)
      .join(" ");

    const title = `Generated Insight ${i + 1}: ${titleWords || "Practical Concept"}`;
    const excerpt = core.length > 140 ? `${core.slice(0, 137)}...` : core;

    posts.push({
      id: i + 1,
      category: cfg.defaultCategory || "JavaScript",
      title,
      tags,
      excerpt,
      sourceUrl: "",
      createdAt: generatedTimestamp(baseTime, i),
      content: buildDetailedContent({
        topic: cfg.defaultCategory || "JavaScript",
        subtopic: titleWords || "Practical Concept",
        core,
        rules,
        tryThis: code,
        quizQ,
        quizA,
        takeaway
      })
    });
  }

  return posts;
}

/* ── Accumulation helpers ─────────────────────────────── */
function loadExistingPosts(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const source = fs.readFileSync(filePath, "utf8");
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(source + "\n;globalThis.__ALL_POSTS = ALL_POSTS;", sandbox);
    const posts = sandbox.__ALL_POSTS;
    return Array.isArray(posts) ? posts : [];
  } catch (err) {
    console.warn("Could not load existing posts: " + (err.message || err));
    return [];
  }
}

function tokenizeTitle(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
}

function titleSimilarity(a, b) {
  const tA = new Set(tokenizeTitle(a));
  const tB = new Set(tokenizeTitle(b));
  if (tA.size === 0 || tB.size === 0) return 0;
  let inter = 0;
  for (const w of tA) { if (tB.has(w)) inter++; }
  const union = new Set([...tA, ...tB]).size;
  return union > 0 ? inter / union : 0;
}

function isDuplicatePost(newPost, existingPosts, threshold) {
  const t = threshold || 0.75;
  for (const ep of existingPosts) {
    if (titleSimilarity(newPost.title, ep.title) >= t) return true;
  }
  return false;
}

function mergeAndDedupPosts(existingPosts, newPosts, threshold) {
  const merged = [...existingPosts];
  let added = 0;
  for (const np of newPosts) {
    if (!isDuplicatePost(np, merged, threshold)) {
      merged.push(np);
      added++;
    } else {
      console.log("  Skipped duplicate: " + np.title);
    }
  }
  // Re-assign sequential IDs
  merged.forEach((p, i) => { p.id = i + 1; });
  console.log("  Merged: " + added + " new + " + existingPosts.length + " existing = " + merged.length + " total posts.");
  return merged;
}

function toPostsDataJs(posts) {
  const lines = [];
  lines.push("/* ================================================================");
  lines.push("   AUTO-GENERATED POSTS");
  lines.push("   Regenerate with: npm run posts:generate");
  lines.push("   ================================================================ */");
  lines.push("");
  lines.push("// eslint-disable-next-line no-unused-vars");
  lines.push("const ALL_POSTS = [");

  posts.forEach((post, index) => {
    lines.push("  {");
    lines.push(`    id: ${post.id}, category: ${JSON.stringify(post.category)},`);
    lines.push(`    title: ${JSON.stringify(post.title)},`);
    lines.push(`    tags: ${JSON.stringify(post.tags)},`);
    lines.push(`    excerpt: ${JSON.stringify(post.excerpt)},`);
    lines.push(`    sourceUrl: ${JSON.stringify(post.sourceUrl || "")},`);
    lines.push(`    createdAt: ${JSON.stringify(post.createdAt || generatedTimestamp(Date.now(), index))},`);
    lines.push(`    level: ${JSON.stringify(post.level || "beginner")},`);
    lines.push(`    content: ${JSON.stringify(post.content)}`);
    lines.push(index === posts.length - 1 ? "  }" : "  },");
  });

  lines.push("];\n");
  return lines.join("\n");
}

async function resolvePdfPath(cfg) {
  const cliPath = process.argv[2] ? process.argv[2].trim() : "";
  if (cliPath) {
    return path.resolve(__dirname, cliPath);
  }

  if (cfg.promptForPdfPath || !cfg.pdfPath) {
    const entered = await ask("Enter PDF path to generate posts from: ");
    if (!entered) {
      throw new Error("No PDF path provided.");
    }
    return path.resolve(__dirname, entered);
  }

  return path.resolve(__dirname, cfg.pdfPath);
}

function stripCodeFence(text) {
  const trimmed = String(text || "").trim();
  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    return trimmed.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

function normalizeAiPost(post, index, cfg) {
  const title = normalizeSentence(post.title || `Generated Insight ${index + 1}`);
  const excerpt = normalizeSentence(post.excerpt || "");
  // Preserve line breaks in content — only normalize control chars and convert literal \n
  const rawContent = String(post.content || "")
    .replace(/\\n/g, "\n")
    .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f]/g, "")
    .trim();
  const category = normalizeSentence(post.category || cfg.defaultCategory || "JavaScript");
  const tags = Array.isArray(post.tags) && post.tags.length > 0
    ? post.tags.map((t) => normalizeSentence(t.toLowerCase())).filter(Boolean).slice(0, 8)
    : (cfg.tags || ["javascript", "automation"]);

  return {
    id: index + 1,
    category,
    title,
    tags,
    excerpt: excerpt || rawContent.slice(0, 140),
    sourceUrl: normalizeSentence(post.sourceUrl || ""),
    createdAt: normalizeSentence(post.createdAt || generatedTimestamp(Date.now(), index)),
    level: normalizeSentence(post.level || "beginner"),
    content: rawContent
  };
}

async function createAiPosts(cfg, aiCfg) {
  const apiKey = process.env[aiCfg.apiKeyEnvVar || "OPENAI_API_KEY"];
  if (!aiCfg.enabled || !apiKey) {
    return null;
  }

  const target = Number(cfg.targetPostCount || 100);
  const topicPool = Array.isArray(cfg.topicPool) && cfg.topicPool.length > 0
    ? cfg.topicPool.join(", ")
    : "Playwright, TypeScript, Azure DevOps, JavaScript";

  const userPrompt = [
    `Create ${target} detailed technical posts.`,
    `Topics should come from: ${topicPool}.`,
    "Return strict JSON only, no markdown.",
    "Schema: [{id, category, title, tags, excerpt, content}]",
    "content must include markdown sections exactly:",
    "## Core Concept",
    "## Key Rules",
    "## Try This",
    "## Quick Quiz",
    "## Key Takeaway"
  ].join("\n");

  const response = await fetch(aiCfg.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: aiCfg.model,
      temperature: 0.7,
      messages: [
        { role: "system", content: aiCfg.systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("AI response did not contain content.");
  }

  const parsed = JSON.parse(stripCodeFence(text));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AI response JSON is not a non-empty array.");
  }

  return parsed.slice(0, target).map((post, index) => normalizeAiPost(post, index, cfg));
}

// ─────────────────────────────────────────────────────────────────────────────
// FREE AI GENERATION — Groq (llama-3.1-8b-instant) or Google Gemini free tier
// Get a free key: https://console.groq.com  |  https://aistudio.google.com
// Set env var GROQ_API_KEY or GEMINI_API_KEY before running.
// ─────────────────────────────────────────────────────────────────────────────

function buildPostPrompt(seed) {
  const level = seed.level || "beginner";
  const levelGuide = {
    beginner: "Explain like teaching a first-year student. Use simple language, analogies, and everyday examples. No jargon without explaining it.",
    intermediate: "Assume the reader knows basics. Focus on patterns, best practices, and real-world gotchas. Include production-ready examples.",
    advanced: "Write for a senior/architect audience. Cover system design, scalability, trade-offs, and enterprise patterns. Include architecture decisions."
  };
  return (
    "You are a senior " + seed.topic + " expert and technical writer creating a COMPREHENSIVE, SEO-optimized tutorial guide.\n" +
    "Topic: \"" + seed.subtopic + "\"\n" +
    "Level: " + level.toUpperCase() + "\n" +
    "Audience: " + levelGuide[level] + "\n\n" +
    "WRITING RULES (mandatory):\n" +
    "- Write a DETAILED tutorial (2000-3000 words minimum in the content field).\n" +
    "- Conversational tone — like a senior dev teaching a teammate.\n" +
    "- Short paragraphs (2-3 lines max) for readability.\n" +
    "- Multiple code examples throughout (not just one).\n" +
    "- Include comparison tables using markdown pipe tables where relevant.\n" +
    "- Use H2 (##) and H3 (###) headings liberally for SEO structure.\n" +
    "- Include inline Q&A (Is X different from Y?) after relevant sections.\n" +
    "- Bold important terms with **term**.\n" +
    "- Every section should teach something actionable.\n\n" +
    "Return ONLY a valid JSON object (no markdown fences, no extra text).\n" +
    "Schema: { \"title\": string, \"tags\": string[], \"excerpt\": string, \"content\": string, \"level\": \"" + level + "\" }\n\n" +
    "The title MUST be an SEO-friendly guide title like: \"" + seed.subtopic + " Guide with Examples\"\n" +
    "The excerpt must be 1-2 sentences summarizing what readers will learn.\n\n" +
    "The content field must use \\n for line breaks. Add a BLANK LINE (\\n\\n) between every section.\n" +
    "Follow this EXACT section layout (EVERY section is REQUIRED):\n\n" +
    "## How to Use " + seed.subtopic + " Quickly?\\n\\n" +
    "<1-2 sentence intro + a quick code example showing the simplest usage>\\n\\n" +
    "```" + (seed.topic === "TypeScript" ? "ts" : "js") + "\\n<3-5 line quick example>\\n```\\n\\n" +
    "## What is " + seed.subtopic + "?\\n\\n" +
    "<3-4 paragraphs explaining the concept in detail. What it is, why it exists, how it works at a high level. Reference official docs concepts.>\\n\\n" +
    "## When to Use " + seed.subtopic + "?\\n\\n" +
    "<Bullet list of 4-6 real scenarios where this is useful>\\n\\n" +
    "### Is " + seed.subtopic + " different from [related concept]?\\n\\n" +
    "<2-3 sentence comparison answering a common confusion>\\n\\n" +
    "## Step by Step Guide with Examples\\n\\n" +
    "<Numbered steps 1-6 explaining how to implement this. Each step has a brief explanation + code snippet.>\\n\\n" +
    "```" + (seed.topic === "TypeScript" ? "ts" : "js") + "\\n<8-15 line complete code example>\\n```\\n\\n" +
    "<Explain what the code does line by line in 2-3 sentences>\\n\\n" +
    "## Method Comparison\\n\\n" +
    "<A markdown pipe table comparing 3-4 related methods/approaches with columns: Method | When to Use | Triggers Events | Speed>\\n\\n" +
    "| Method | When to Use | Key Behavior | Speed |\\n" +
    "| --- | --- | --- | --- |\\n" +
    "<3-4 rows of real comparisons>\\n\\n" +
    "## Common Patterns and Variations\\n\\n" +
    "<Show 2-3 different code patterns/variations of this concept with ### sub-headings and code blocks>\\n\\n" +
    "## Best Practices\\n\\n" +
    "<5-6 bullet points of actionable best practices>\\n\\n" +
    "### Common Mistakes to Avoid\\n\\n" +
    "<4-5 bullet points of mistakes with brief explanation>\\n\\n" +
    "## Common Issues and Fixes\\n\\n" +
    "### Why does [common problem] happen?\\n\\n" +
    "<Problem explanation + incorrect code example + correct code example for 2-3 issues>\\n\\n" +
    "```" + (seed.topic === "TypeScript" ? "ts" : "js") + "\\n// Incorrect\\n<wrong code>\\n\\n// Correct\\n<right code>\\n```\\n\\n" +
    "## Advanced Scenarios\\n\\n" +
    "<2-3 advanced use cases with ### sub-headings, each with explanation and code example>\\n\\n" +
    "## Real World Use Cases\\n\\n" +
    "<3-4 practical examples with ### sub-headings showing real usage with brief code snippets>\\n\\n" +
    "## FAQs\\n\\n" +
    "### <SEO question 1>?\\n\\n<2-3 sentence answer>\\n\\n" +
    "### <SEO question 2>?\\n\\n<2-3 sentence answer>\\n\\n" +
    "### <SEO question 3>?\\n\\n<2-3 sentence answer>\\n\\n" +
    "### <SEO question 4>?\\n\\n<2-3 sentence answer>\\n\\n" +
    "### <SEO question 5>?\\n\\n<2-3 sentence answer>\\n\\n" +
    "## Conclusion\\n\\n" +
    "<3-4 sentence wrap-up summarizing what was covered and suggesting next steps>"
  );
}

async function callGroq(prompt, apiKey, model) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: model || "llama-3.1-8b-instant",
      temperature: 0.75,
      messages: [
        { role: "system", content: "You are a technical content expert. Return valid JSON only — no markdown fences, no explanation." },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error("Groq API " + response.status + ": " + errText);
  }
  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || "");
}

async function callGemini(prompt, apiKey, model) {
  const modelId = model || "gemini-1.5-flash";
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelId + ":generateContent?key=" + apiKey;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.75, responseMimeType: "application/json" }
    })
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error("Gemini API " + response.status + ": " + errText);
  }
  const data = await response.json();
  return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "");
}

async function callGitHubModels(prompt, apiKey, model) {
  const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      temperature: 0.75,
      messages: [
        { role: "system", content: "You are a technical content expert. Return valid JSON only — no markdown fences, no explanation." },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error("GitHub Models API " + response.status + ": " + errText);
  }
  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || "");
}

async function callFreeAi(prompt, freeAiCfg) {
  const provider = String(freeAiCfg.provider || "groq").toLowerCase();
  if (provider === "gemini") {
    const apiKey = process.env[freeAiCfg.gemini?.apiKeyEnvVar || "GEMINI_API_KEY"] || "";
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set.");
    return callGemini(prompt, apiKey, freeAiCfg.gemini?.model);
  }
  if (provider === "copilot" || provider === "github") {
    const apiKey = process.env[freeAiCfg.copilot?.apiKeyEnvVar || "GITHUB_TOKEN"] || "";
    if (!apiKey) throw new Error("GITHUB_TOKEN environment variable is not set. Get a free PAT from https://github.com/settings/tokens");
    return callGitHubModels(prompt, apiKey, freeAiCfg.copilot?.model);
  }
  // Default: Groq
  const apiKey = process.env[freeAiCfg.groq?.apiKeyEnvVar || "GROQ_API_KEY"] || "";
  if (!apiKey) throw new Error("GROQ_API_KEY environment variable is not set.");
  return callGroq(prompt, apiKey, freeAiCfg.groq?.model);
}

function parseFreeAiResponse(rawText, seed, index, cfg) {
  const cleaned = stripCodeFence(rawText.trim());
  let obj;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found in AI response.");
    obj = JSON.parse(match[0]);
  }
  return normalizeAiPost(
    {
      ...obj,
      category: seed.category,
      level: obj.level || seed.level || "beginner",
      tags: Array.isArray(obj.tags) && obj.tags.length > 0 ? obj.tags : seed.tags
    },
    index,
    cfg
  );
}

function createFallbackPost(seed, index, cfg) {
  const tpl = TOPIC_LIBRARY.find((t) => t.topic === seed.topic) || TOPIC_LIBRARY[index % TOPIC_LIBRARY.length];
  const rotation = index % tpl.core.length;
  const core = tpl.core[rotation];
  const rules = [
    tpl.rules[rotation % tpl.rules.length],
    tpl.rules[(rotation + 1) % tpl.rules.length],
    tpl.rules[(rotation + 2) % tpl.rules.length]
  ];
  return {
    id: index + 1,
    category: seed.category,
    title: seed.subtopic,
    tags: seed.tags,
    excerpt: core.length > 140 ? core.slice(0, 137) + "..." : core,
    sourceUrl: "",
    createdAt: generatedTimestamp(Date.now(), index),
    level: seed.level || "beginner",
    content: buildDetailedContent({ topic: seed.topic, subtopic: seed.subtopic, core, rules, workflow: tpl.workflow, architecture: tpl.architecture, tryThis: tpl.tryThis, quizQ: tpl.quizQ, quizA: tpl.quizA, takeaway: tpl.takeaway })
  };
}

async function createFreeAiPostsWithWorkers(cfg, freeAiCfg) {
  const target = Number(cfg.targetPostCount || 4);
  const concurrency = Math.min(Number(freeAiCfg.concurrentWorkers || 5), 10);
  const batchDelayMs = Number(freeAiCfg.batchDelayMs || 2000);

  // Randomly pick 'target' seeds from the full 100 pool so each run gets fresh topics
  const shuffled = [...TOPIC_SEEDS].sort(() => Math.random() - 0.5);
  const seeds = shuffled.slice(0, target);
  const results = [];

  console.log("Free AI workers: " + seeds.length + " posts | " + concurrency + " concurrent | provider: " + (freeAiCfg.provider || "groq"));

  for (let i = 0; i < seeds.length; i += concurrency) {
    const batch = seeds.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (seed, batchIdx) => {
        const index = i + batchIdx;
        const prompt = buildPostPrompt(seed);
        const raw = await callFreeAi(prompt, freeAiCfg);
        return parseFreeAiResponse(raw, seed, index, cfg);
      })
    );

    settled.forEach((result, batchIdx) => {
      const index = i + batchIdx;
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        const reason = result.reason?.message || String(result.reason);
        console.warn("  Worker " + (index + 1) + " failed (" + seeds[index].subtopic + "): " + reason + " — using template fallback.");
        results.push(createFallbackPost(seeds[index], index, cfg));
      }
    });

    const done = Math.min(i + concurrency, seeds.length);
    process.stdout.write("  Progress: " + done + "/" + seeds.length + "\r");

    if (i + concurrency < seeds.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
    }
  }

  console.log("\n  All workers finished.");
  return results;
}

async function generatePostsFromConfig(options = {}) {
  const config = loadConfig();
  const cfg = config.contentGeneration;
  const aiCfg = config.aiGeneration || {};
  const freeAiCfg = config.freeAiGeneration || {};
  const mode = ["pdf", "ai"].includes(cfg.sourceMode) ? cfg.sourceMode : "topics";
  const outputPath = path.resolve(__dirname, cfg.outputFile || "posts-data.js");

  let posts;
  const useFreeAi = freeAiCfg.enabled && cfg.autoGenerateOnEveryRun && mode !== "pdf";

  if (useFreeAi) {
    try {
      posts = await createFreeAiPostsWithWorkers(cfg, freeAiCfg);
    } catch (err) {
      console.warn("Free AI generation failed: " + (err.message || err) + ". Falling back to topic templates.");
      posts = createTopicPosts(cfg);
    }
  } else if (mode === "pdf") {
    const pdfPath = await resolvePdfPath(cfg);
    if (!fs.existsSync(pdfPath)) {
      throw new Error("PDF not found at: " + pdfPath);
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const parsed = await pdf(pdfBuffer);
    posts = generatePostsFromText(parsed.text || "", cfg);
  } else if (mode === "ai") {
    const aiPosts = await createAiPosts(cfg, aiCfg);
    if (aiPosts && aiPosts.length > 0) {
      posts = aiPosts;
    } else {
      posts = createTopicPosts(cfg);
    }
  } else {
    posts = createTopicPosts(cfg);
  }

  const effectiveMode = useFreeAi ? "free-ai (" + (freeAiCfg.provider || "groq") + ")" : mode;

  // Accumulate: load existing posts, merge with dedup, then write
  const existingPosts = loadExistingPosts(outputPath);
  const dedupThreshold = cfg.dedupThreshold || 0.75;
  const allPosts = mergeAndDedupPosts(existingPosts, posts, dedupThreshold);
  fs.writeFileSync(outputPath, toPostsDataJs(allPosts), "utf8");

  if (!options.silent) {
    console.log("Generated " + posts.length + " new posts using '" + effectiveMode + "' mode.");
    console.log("Total posts on website: " + allPosts.length);
    console.log("Output: " + outputPath);
  }

  return { posts: allPosts, mode: effectiveMode, outputPath, config };
}

if (require.main === module) {
  generatePostsFromConfig().catch((error) => {
    console.error("Generation failed:", error.message || error);
    process.exit(1);
  });
}

module.exports = {
  generatePostsFromConfig,
  loadConfig
};
