const fs = require("fs");
const path = require("path");

const POLL_HISTORY_FILE = path.join(__dirname, ".auth", "poll-history.json");
const MAX_POLL_HISTORY = 200;

const PLAYWRIGHT_POLLS = [
  {
    question: "Which Playwright method waits for an element to be visible before interacting?",
    correct: "locator.waitFor()",
    distractors: ["page.pause()", "browser.wait()", "test.waitFor()"]
  },
  {
    question: "What is the best locator for stable Playwright tests?",
    correct: "getByRole",
    distractors: ["nth-child selector", "getElementById", "querySelectorAll"]
  },
  {
    question: "Which file is used to configure Playwright projects?",
    correct: "playwright.config.ts",
    distractors: ["test.config.js", "jest.config.js", "runner.config.json"]
  },
  {
    question: "How do you record a video of a Playwright test run?",
    correct: "Set video: 'on' in context options",
    distractors: ["Enable video in browser settings", "Use page.recordVideo()", "Set record: true in test"]
  },
  {
    question: "Which assertion checks if a checkbox is selected in Playwright?",
    correct: "toBeChecked()",
    distractors: ["toBeSelected()", "isChecked()", "assertChecked()"]
  },
  // Add more Playwright poll templates here
];

const TYPESCRIPT_POLLS = [
  {
    question: "Which keyword is used to define a type alias in TypeScript?",
    correct: "type",
    distractors: ["alias", "typedef", "define"]
  },
  {
    question: "What does 'strict' mode enforce in tsconfig.json?",
    correct: "Stricter type-checking options",
    distractors: ["Faster compilation", "No runtime errors", "Automatic imports"]
  },
  {
    question: "How do you specify a variable can be a string or number?",
    correct: "string | number",
    distractors: ["string & number", "string || number", "type: string, number"]
  },
  {
    question: "Which utility type makes all properties optional?",
    correct: "Partial<T>",
    distractors: ["Optional<T>", "Maybe<T>", "Loose<T>"]
  },
  {
    question: "What is the output type of Array.map in TypeScript?",
    correct: "Array<T>",
    distractors: ["T[]", "List<T>", "Set<T>"]
  },
  // Add more TypeScript poll templates here
];

function loadPollHistory() {
  if (!fs.existsSync(POLL_HISTORY_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(POLL_HISTORY_FILE, "utf8"));
    return Array.isArray(data) ? data.slice(-MAX_POLL_HISTORY) : [];
  } catch {
    return [];
  }
}

function savePollHistory(history) {
  const dir = path.dirname(POLL_HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(POLL_HISTORY_FILE, JSON.stringify(history.slice(-MAX_POLL_HISTORY), null, 2), "utf8");
}

function pollHash(poll) {
  return poll.question + "|" + poll.correct;
}

function getUniquePolls(count = 5) {
  const history = loadPollHistory();
  const usedHashes = new Set(history.map(pollHash));
  const allPolls = [...PLAYWRIGHT_POLLS, ...TYPESCRIPT_POLLS];
  const available = allPolls.filter(p => !usedHashes.has(pollHash(p)));
  const selected = [];
  while (selected.length < count && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    selected.push(available[idx]);
    usedHashes.add(pollHash(available[idx]));
    available.splice(idx, 1);
  }
  // If not enough unique, allow repeats (least recent first)
  while (selected.length < count && history.length > 0) {
    selected.push(history.shift());
  }
  // Update history
  savePollHistory([...history, ...selected]);
  return selected;
}

module.exports = {
  getUniquePolls
};
