/* ================================================================
   PROMPT SUGGESTIONS — curated + FlowGPT sync
   AIPromptIndex: https://aipromptindex.io/
   FlowGPT: https://flowgpt.com/
   Regenerate extras: npm run hub:prompts:sync
   ================================================================ */

const PROMPT_SUGGESTIONS = [
  {
    "id": "api-docs-from-code",
    "title": "API documentation from code",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptindex.io/best/coding-prompts/",
    "tools": [
      "Cursor",
      "Copilot"
    ],
    "tags": [
      "api",
      "documentation",
      "openapi"
    ],
    "prompt": "You are a senior API documentation engineer.\nGiven the selected code, produce developer-ready docs in this structure:\n1) Overview (what the API does in 2 sentences)\n2) Auth & base URL\n3) Endpoints table (method, path, purpose)\n4) Request/response JSON examples\n5) Error codes and retry guidance\n6) Minimal curl + TypeScript fetch examples\nRules: do not invent endpoints not in the code; mark unknowns as TODO; prefer OpenAPI-friendly field names."
  },
  {
    "id": "cursor-refactor",
    "title": "Safe refactor assistant",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptindex.io/best/coding-prompts/",
    "tools": [
      "Cursor"
    ],
    "tags": [
      "refactor",
      "clean-code"
    ],
    "prompt": "Refactor the selected code for readability and maintainability without changing behavior.\nDeliver:\n1) Brief risk assessment\n2) Refactored code\n3) List of invariants you preserved\n4) Suggested unit tests for the risky edges\nConstraints: no drive-by renames across the repo; keep public APIs stable; explain any unavoidable signature change."
  },
  {
    "id": "cursor-tests",
    "title": "Comprehensive test writer",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptindex.io/best/coding-prompts/",
    "tools": [
      "Cursor"
    ],
    "tags": [
      "testing",
      "tdd"
    ],
    "prompt": "Write a thorough test suite for the selected module.\nInclude: happy path, edge cases, error paths, and one concurrency/timing case if relevant.\nUse the project's existing test framework and naming style.\nDo not mock what you can exercise cheaply; mock only external I/O.\nOutput only test code plus a one-line setup note if fixtures are required."
  },
  {
    "id": "debug-detective",
    "title": "Debug error detective",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptindex.io/best/coding-prompts/",
    "tools": [
      "Cursor",
      "ChatGPT"
    ],
    "tags": [
      "debugging",
      "errors"
    ],
    "prompt": "Act as a debugging detective.\nGiven the error message, stack trace, and recent change context:\n1) Rank top 3 root causes with likelihood\n2) Smallest repro steps\n3) Exact files/functions to inspect\n4) A minimal fix patch outline\n5) A regression test that would have caught it\nAsk for missing evidence only if blocked."
  },
  {
    "id": "git-conventional-commit",
    "title": "Conventional commit from diff",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptindex.io/best/coding-prompts/",
    "tools": [
      "Cursor"
    ],
    "tags": [
      "git",
      "commits"
    ],
    "prompt": "Analyze the git diff and propose ONE conventional commit message.\nFormat: type(scope): summary\nThen a short body focused on WHY.\nTypes: feat|fix|docs|refactor|test|chore|perf|ci\nDo not mention AI. Prefer specificity over buzzwords."
  },
  {
    "id": "security-review-prompt",
    "title": "Security review checklist",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptindex.io/best/coding-prompts/",
    "tools": [
      "Cursor",
      "Copilot"
    ],
    "tags": [
      "security",
      "code-review"
    ],
    "prompt": "Review the selected code for security issues only.\nCheck: injection, XSS, authz gaps, secret leakage, insecure deserialization, SSRF, path traversal, weak crypto, missing rate limits, unsafe file uploads, and logging of PII/tokens.\nOutput a severity-ordered table: Finding | Location | Impact | Fix.\nIf none found, say so and list residual risks."
  },
  {
    "id": "rag-eval-prompt",
    "title": "RAG evaluation designer",
    "source": "FlowGPT",
    "sourceUrl": "https://flowgpt.com/",
    "tools": [
      "Cursor",
      "ChatGPT"
    ],
    "tags": [
      "rag",
      "genai",
      "evaluation"
    ],
    "prompt": "Design a practical RAG evaluation plan for this feature.\nInclude: golden questions, faithfulness checks, context precision/recall, failure taxonomy, and a CI gate threshold.\nProvide 5 sample Q/A goldens and the metric definitions in plain language.\nAssume we can use Ragas-style metrics and human spot checks."
  },
  {
    "id": "mcp-tool-designer",
    "title": "MCP tool schema designer",
    "source": "FlowGPT",
    "sourceUrl": "https://flowgpt.com/",
    "tools": [
      "Cursor"
    ],
    "tags": [
      "mcp",
      "agents",
      "tools"
    ],
    "prompt": "Design a Model Context Protocol (MCP) tool for the described capability.\nProvide: tool name, JSON schema for arguments, auth/least-privilege notes, timeout/retry policy, and 3 adversarial test prompts (injection attempts).\nKeep the tool narrowly scoped; refuse broad shell/file powers unless justified."
  },
  {
    "id": "playwright-flake-hunter",
    "title": "Playwright flake hunter",
    "source": "FlowGPT",
    "sourceUrl": "https://flowgpt.com/",
    "tools": [
      "Cursor"
    ],
    "tags": [
      "playwright",
      "testing",
      "flakes"
    ],
    "prompt": "You are a Playwright reliability engineer.\nGiven a flaky test and logs/trace notes:\n1) Identify race conditions (network, animation, navigation)\n2) Replace waitForTimeout with web-first assertions/locators\n3) Propose a stable locator strategy (role-first)\n4) Suggest trace-on-first-retry CI policy\nReturn a patched test snippet only after the diagnosis."
  },
  {
    "id": "llm-prompt-harden",
    "title": "Harden a system prompt",
    "source": "FlowGPT",
    "sourceUrl": "https://flowgpt.com/",
    "tools": [
      "ChatGPT",
      "Claude",
      "Cursor"
    ],
    "tags": [
      "prompt-engineering",
      "guardrails"
    ],
    "prompt": "Rewrite the provided system prompt to be safer and clearer.\nAdd: role boundaries, tool-use rules, refusal policy, output schema, and anti-injection reminders.\nKeep it concise (<400 words). Show before/after only if asked; default to the improved prompt alone."
  },
  {
    "id": "docker-compose-prod",
    "title": "Docker Compose for multi-service apps",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptindex.io/best/coding-prompts/",
    "tools": [
      "Cursor"
    ],
    "tags": [
      "docker",
      "devops"
    ],
    "prompt": "Generate a production-minded docker-compose.yml for the described services.\nInclude: healthchecks, resource limits, non-root users where practical, named volumes, .env via env_file (never bake secrets), and a brief README of ports.\nCall out what still belongs in Kubernetes for real prod."
  },
  {
    "id": "ci-cd-gha",
    "title": "GitHub Actions CI/CD builder",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptindex.io/best/coding-prompts/",
    "tools": [
      "Copilot",
      "Cursor"
    ],
    "tags": [
      "ci-cd",
      "github-actions"
    ],
    "prompt": "Create a GitHub Actions workflow for this repo's stack.\nMust include: dependency caching, matrix (if useful), lint/test, build artifact, and a gated deploy job using environment protection.\nUse OIDC/secrets best practices; never echo secrets. Comment each job's purpose briefly."
  },
  {
    "id": "lib-layered-coding-concept-explainer-b8c0643d",
    "title": "Layered Coding Concept Explainer",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/layered-coding-concept-explainer-b8c0643d",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "tutorial",
      "analogy",
      "code_example",
      "key_takeaways",
      "misconceptions",
      "structured_output"
    ],
    "prompt": "Instructs the AI to act as an expert coding tutor and teach a specified topic using a structured format: Layer 1 (ELI5 analogy), Layer 2 (detailed explanation with code example), L…"
  },
  {
    "id": "lib-claude-md-file-generator-for-ai-coders-1a794a97",
    "title": "CLAUDE.md File Generator for AI Coders",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/claude-md-file-generator-for-ai-coders-1a794a97",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "claude.md",
      "ai_coding_agents",
      "markdown",
      "git_workflow",
      "testing",
      "deployment"
    ],
    "prompt": "Instructs the model to generate a concise, production-ready CLAUDE.md project instruction file for AI coding agents based on provided project details, following strict principles a…"
  },
  {
    "id": "lib-claude-code-configuration-and-usage-guide-12b113",
    "title": "Claude Code Configuration and Usage Guide",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/claude-code-configuration-and-usage-guide-12b11324",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "markdown",
      "yaml-frontmatter",
      "claude",
      "agent",
      "configuration",
      "template"
    ],
    "prompt": "Provides a comprehensive reference for configuring and using Claude Code including CLAUDE.md templates, thinking keywords, debugging steps, and best practices for iterative develop…"
  },
  {
    "id": "lib-coding-project-blueprint-generator-765249b4",
    "title": "Coding Project Blueprint Generator",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/coding-project-blueprint-generator-765249b4",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "markdown",
      "agent",
      "plan_generation",
      "cold_start"
    ],
    "prompt": "Converts a one-line objective into a step-by-step construction plan with self-contained context briefs for each step, enabling independent execution by fresh coding agents across m…"
  },
  {
    "id": "lib-professional-code-review-expert-1553cf5c",
    "title": "Professional Code Review Expert",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/professional-code-review-expert-1553cf5c",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "code_review",
      "best_practices",
      "optimization",
      "professional_tone",
      "template"
    ],
    "prompt": "Acts as a code review professional to evaluate provided code snippets in a specified language for quality, efficiency, adherence to standards, optimizations, and maintainability, p…"
  },
  {
    "id": "lib-coding-problem-logic-builder-7e84075a",
    "title": "Coding Problem Logic Builder",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/coding-problem-logic-builder-7e84075a",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "hints",
      "step_by_step",
      "no_solution",
      "tutoring"
    ],
    "prompt": "The prompt instructs the model to act as a logic-building tool that guides users through coding problems step by step using hints and suggestions, without providing the full soluti…"
  },
  {
    "id": "lib-image-first-website-design-coder-0e987915",
    "title": "Image-First Website Design Coder",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/image-first-website-design-coder-0e987915",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "image_generation",
      "website_design",
      "section_images",
      "design_system",
      "codex",
      "frontend_code"
    ],
    "prompt": "Instructs the model to generate website design images first, deeply analyze them for text, typography, spacing, colors, and components, then implement matching frontend code while…"
  },
  {
    "id": "lib-javascript-codebase-continuation-assistant-05efb",
    "title": "JavaScript Codebase Continuation Assistant",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/javascript-codebase-continuation-assistant-05efb811",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "javascript",
      "best_practices",
      "code_snippets",
      "documentation",
      "placeholders"
    ],
    "prompt": "The prompt instructs the model to act as a Continue Coding Assistant that reviews existing code, provides suggestions and code snippets to extend functionality, and ensures code fo…"
  },
  {
    "id": "lib-multi-language-code-translator-86601f9b",
    "title": "Multi-Language Code Translator",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/multi-language-code-translator-86601f9b",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "programming",
      "translation",
      "template",
      "comments"
    ],
    "prompt": "The prompt instructs the model to act as a code translator that converts code from ${sourceLanguage} to ${targetLanguage}, analyzes syntax and semantics, preserves functionality an…"
  },
  {
    "id": "lib-manim-chain-rule-explainer-code-c5cd53c6",
    "title": "Manim Chain Rule Explainer Code",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/manim-chain-rule-explainer-code-c5cd53c6",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "manim",
      "python",
      "chain_rule"
    ],
    "prompt": "Create Manim code that explains the chain rule in an easy way."
  },
  {
    "id": "lib-typescript-type-system-architect-90fe7527",
    "title": "TypeScript Type System Architect",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/typescript-type-system-architect-90fe7527",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "typescript",
      "generics",
      "conditional_types",
      "discriminated_unions",
      "branded_types",
      "type_guards"
    ],
    "prompt": "Instructs the model to act as a senior TypeScript expert specializing in types, generics, and type-level programming, following a task-oriented workflow to analyze, design, impleme…"
  },
  {
    "id": "lib-advanced-typescript-type-safety-expert-2b0ab484",
    "title": "Advanced TypeScript Type Safety Expert",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/advanced-typescript-type-safety-expert-2b0ab484",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "typescript",
      "generics",
      "decorators",
      "strict_mode",
      "tsconfig",
      "utility_types"
    ],
    "prompt": "Act as a TypeScript expert for advanced typing, generics, and enterprise patterns. Define runtime targets, model types, implement with compiler safeguards, and output strongly-type…"
  },
  {
    "id": "lib-enterprise-typescript-type-safety-expert-4b3b691",
    "title": "Enterprise TypeScript Type Safety Expert",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/enterprise-typescript-type-safety-expert-4b3b6910",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "typescript",
      "generics",
      "strict_types",
      "decorators",
      "enterprise"
    ],
    "prompt": "You are a TypeScript expert specializing in advanced typing and enterprise-grade development. It provides instructions, focus areas, approach steps, and output requirements for han…"
  },
  {
    "id": "lib-typescript-advanced-types-expert-7275db15",
    "title": "TypeScript Advanced Types Expert",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/typescript-advanced-types-expert-7275db15",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "typescript",
      "generics",
      "type-safety",
      "decorators",
      "enterprise"
    ],
    "prompt": "You are a TypeScript expert specializing in advanced typing and enterprise-grade development. It defines when to use the skill, instructions for modeling types and enforcing safegu…"
  },
  {
    "id": "lib-comprehensive-typescript-codebase-reviewer-bbf7a",
    "title": "Comprehensive TypeScript Codebase Reviewer",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/comprehensive-typescript-codebase-reviewer-bbf7a7b5",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "typescript",
      "code_review",
      "type_safety",
      "null_handling",
      "error_handling",
      "async"
    ],
    "prompt": "Acts as an expert TypeScript code reviewer to perform an exhaustive analysis of a provided codebase across categories including type safety, null handling, error handling, async is…"
  },
  {
    "id": "lib-zustand-typescript-store-creator-ea5b192d",
    "title": "Zustand TypeScript Store Creator",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/zustand-typescript-store-creator-ea5b192d",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "zustand",
      "typescript",
      "middleware",
      "frontend",
      "store_pattern"
    ],
    "prompt": "Instructs creation of Zustand stores using subscribeWithSelector middleware, separate MyState and MyActions interfaces, individual selectors, and external subscriptions, with steps…"
  },
  {
    "id": "lib-fp-ts-type-selection-reference-b1e2a737",
    "title": "fp-ts Type Selection Reference",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/fp-ts-type-selection-reference-b1e2a737",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "fp-ts",
      "typescript",
      "option",
      "either",
      "taskeither",
      "reference"
    ],
    "prompt": "Provides a decision tree for choosing between Option, Either, Task, TaskEither and related fp-ts types, plus common imports, one-line patterns, and match examples for TypeScript."
  },
  {
    "id": "lib-zustand-typescript-store-generator-fe0f666a",
    "title": "Zustand TypeScript Store Generator",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/zustand-typescript-store-generator-fe0f666a",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "typescript",
      "zustand",
      "middleware",
      "react",
      "state-management"
    ],
    "prompt": "Instructs the model to create Zustand stores following established patterns with proper TypeScript types and middleware such as subscribeWithSelector, including templates for separ…"
  },
  {
    "id": "lib-zustand-typescript-store-generator-d5b75621",
    "title": "Zustand TypeScript Store Generator",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/zustand-typescript-store-generator-d5b75621",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "zustand",
      "typescript",
      "middleware",
      "selectors"
    ],
    "prompt": "Instructs the model to create Zustand stores by copying a template, using subscribeWithSelector middleware, separating state and actions into TypeScript interfaces, and exporting s…"
  },
  {
    "id": "lib-fp-ts-type-selection-quick-reference-eaebd825",
    "title": "fp-ts Type Selection Quick Reference",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/fp-ts-type-selection-quick-reference-eaebd825",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "fp-ts",
      "typescript",
      "functional_programming",
      "option",
      "either",
      "taskeither"
    ],
    "prompt": "Provides a decision tree for choosing fp-ts types such as Option, Either, Task, and TaskEither along with common imports, one-line patterns, and pattern matching examples."
  },
  {
    "id": "lib-root-cause-code-debugger-5e23adfa",
    "title": "Root Cause Code Debugger",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/root-cause-code-debugger-5e23adfa",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "debugging",
      "root_cause_analysis",
      "error_handling",
      "troubleshooting"
    ],
    "prompt": "The prompt instructs the model to act as an expert debugger that captures error messages and stack traces, identifies reproduction steps, isolates failure locations, implements min…"
  },
  {
    "id": "lib-code-debugger-root-cause-analyst-6766e0bd",
    "title": "Code Debugger Root Cause Analyst",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/code-debugger-root-cause-analyst-6766e0bd",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "debugging",
      "root_cause_analysis",
      "error_handling",
      "stack_trace"
    ],
    "prompt": "The prompt instructs the model to act as an expert debugger that captures error messages and stack traces, identifies reproduction steps, isolates failure locations, implements min…"
  },
  {
    "id": "lib-code-error-root-cause-debugger-d4cc2026",
    "title": "Code Error Root Cause Debugger",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/code-error-root-cause-debugger-d4cc2026",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "debugging",
      "error_analysis",
      "root_cause",
      "markdown",
      "yaml"
    ],
    "prompt": "Instructs the model to act as an expert debugger by capturing error messages and stack traces, identifying reproduction steps, isolating failure locations, implementing minimal fix…"
  },
  {
    "id": "lib-systematic-debugging-process-guide-dd45e673",
    "title": "Systematic Debugging Process Guide",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/systematic-debugging-process-guide-dd45e673",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "process",
      "phases",
      "systematic",
      "markdown",
      "yaml-frontmatter"
    ],
    "prompt": "Instructs the model to follow a four-phase systematic debugging process (root cause investigation, pattern analysis, hypothesis testing, and implementation) before proposing any fi…"
  },
  {
    "id": "lib-high-school-programming-debug-tutor-32bc5466",
    "title": "High School Programming Debug Tutor",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/high-school-programming-debug-tutor-32bc5466",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "spanish",
      "tutoring",
      "debugging",
      "programming",
      "step-by-step",
      "hint-based"
    ],
    "prompt": "The prompt instructs the model to act as a programming tutor for secondary school students, prohibiting direct solutions or corrected code, and to guide users toward self-discovery…"
  },
  {
    "id": "lib-makepad-debugging-and-reference-materials-4c1ec7",
    "title": "Makepad Debugging and Reference Materials",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/makepad-debugging-and-reference-materials-4c1ec795",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "makepad",
      "rust",
      "debugging",
      "api_reference"
    ],
    "prompt": "Provides reference materials for Makepad debugging, code quality, common errors with fixes, debug tips, and related resources."
  },
  {
    "id": "lib-phase-gated-debugging-protocol-enforcer-085d1cb5",
    "title": "Phase-Gated Debugging Protocol Enforcer",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/phase-gated-debugging-protocol-enforcer-085d1cb5",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "debugging",
      "protocol",
      "phase-gated",
      "verification",
      "5-whys"
    ],
    "prompt": "Instructs the model to follow a strict 5-phase debugging protocol (Reproduce, Isolate, Root Cause, Fix, Verify) that blocks all source code edits until the root cause is confirmed…"
  },
  {
    "id": "lib-hard-bug-diagnosis-discipline-8f143c85",
    "title": "Hard Bug Diagnosis Discipline",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/hard-bug-diagnosis-discipline-8f143c85",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "debugging",
      "workflow",
      "reproduction",
      "hypothesis_testing",
      "instrumentation",
      "regression_testing"
    ],
    "prompt": "The prompt defines a six-phase disciplined diagnosis process for hard bugs and performance regressions: build a feedback loop, reproduce, hypothesise, instrument, fix with regressi…"
  },
  {
    "id": "lib-spa-frontend-debugger-expert-2d2aa8a8",
    "title": "SPA Frontend Debugger Expert",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/spa-frontend-debugger-expert-2d2aa8a8",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "spa",
      "angular",
      "react",
      "vite",
      "vercel",
      "netlify"
    ],
    "prompt": "Acts as a senior frontend engineer specialized in debugging Single Page Applications, analyzing user-provided problem descriptions, frameworks, deployments, and errors. Identifies…"
  },
  {
    "id": "lib-makepad-debugging-and-reference-guide-0361e9dc",
    "title": "Makepad Debugging and Reference Guide",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/makepad-debugging-and-reference-guide-0361e9dc",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "makepad",
      "rust",
      "debugging",
      "reference",
      "layout"
    ],
    "prompt": "Provides reference materials for Makepad debugging, common errors with fixes, debug tips, quick navigation tables, and external resources."
  },
  {
    "id": "lib-plain-english-security-concept-explainer-0e0627d",
    "title": "Plain-English Security Concept Explainer",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/plain-english-security-concept-explainer-0e0627df",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "plain_english",
      "education",
      "physical_analogies",
      "structured_output"
    ],
    "prompt": "The prompt directs the AI to explain one security concept in plain English using physical-world analogies, structured into sections: Core Idea, Physical-World Analogy, Why We Need…"
  },
  {
    "id": "lib-security-bluebook-policy-builder-80db2346",
    "title": "Security Bluebook Policy Builder",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/security-bluebook-policy-builder-80db2346",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "security",
      "policy",
      "bluebook",
      "workflow",
      "must-should-can"
    ],
    "prompt": "Builds a minimal security policy document called a Blue Book for apps handling sensitive data, using MUST/SHOULD/CAN language with explicit assumptions, scope, and go/no-go gates.…"
  },
  {
    "id": "lib-security-bluebook-policy-builder-7a373de5",
    "title": "Security Bluebook Policy Builder",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/security-bluebook-policy-builder-7a373de5",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "security",
      "policy",
      "bluebook",
      "workflow",
      "template",
      "must-should-can"
    ],
    "prompt": "Builds a minimal security policy as a single Blue Book document using MUST/SHOULD/CAN language, explicit assumptions, scope, and security gates. Gathers up to six inputs if missing…"
  },
  {
    "id": "lib-security-blue-book-policy-builder-a7d1255b",
    "title": "Security Blue Book Policy Builder",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/security-blue-book-policy-builder-a7d1255b",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "security",
      "policy",
      "bluebook",
      "workflow",
      "template"
    ],
    "prompt": "Builds a minimal security policy document called a Blue Book for sensitive apps using MUST/SHOULD/CAN language. Gathers limited inputs if needed, fills a template with explicit ass…"
  },
  {
    "id": "lib-secure-network-infrastructure-engineer-4e201ccc",
    "title": "Secure Network Infrastructure Engineer",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/secure-network-infrastructure-engineer-4e201ccc",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "network_engineering",
      "aws",
      "azure",
      "zero_trust",
      "sase",
      "configuration"
    ],
    "prompt": "The prompt directs the model to act as a Network Engineer skilled in high-security network design, configuration, troubleshooting, optimization, and cloud infrastructures like AWS…"
  },
  {
    "id": "lib-secure-environment-variable-management-skill-954",
    "title": "Secure Environment Variable Management Skill",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/secure-environment-variable-management-skill-954a598e",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "security",
      "environment_variables",
      "secrets",
      "claude"
    ],
    "prompt": "Provides guidance and patterns for secure environment variable management ensuring secrets are never exposed in Claude sessions, terminals, logs, or git commits, with instructions…"
  },
  {
    "id": "lib-secure-user-login-code-generator-befa2de2",
    "title": "Secure User Login Code Generator",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/secure-user-login-code-generator-befa2de2",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "turkish",
      "user_login",
      "password_hashing",
      "salt",
      "backend_security",
      "frontend_security"
    ],
    "prompt": "Instructs to write code featuring user login with passwords stored salted and protected strongly in the database, and robust security measures for both backend and frontend."
  },
  {
    "id": "lib-latino-fenaspe-security-guard-image-01bb6ddc",
    "title": "Latino FENASPE Security Guard Image",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/latino-fenaspe-security-guard-image-01bb6ddc",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "latino",
      "private_security_guard",
      "tactical_helmet",
      "bulletproof_vest",
      "communication_radio",
      "fenaspe"
    ],
    "prompt": "The prompt asks the model to create an image of a Latino private security guard wearing a tactical helmet and bulletproof vest with a communication radio and 'FENASPE' prominently…"
  },
  {
    "id": "lib-claude-secure-environment-variable-manager-87ccd",
    "title": "Claude Secure Environment Variable Manager",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/claude-secure-environment-variable-manager-87ccd239",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "claude",
      "skill",
      "security",
      "environment_variables",
      "secrets"
    ],
    "prompt": "Provides guidance and patterns for secure environment variable management ensuring secrets are never exposed in Claude sessions, terminals, logs, or git commits."
  },
  {
    "id": "lib-threat-modeling-security-expert-14c9f89c",
    "title": "Threat Modeling Security Expert",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/threat-modeling-security-expert-14c9f89c",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "security",
      "threat_modeling",
      "stride",
      "pasta",
      "attack_trees",
      "data_flow_diagrams"
    ],
    "prompt": "Defines an expert role in threat modeling methodologies including STRIDE, PASTA, and attack trees for security architecture reviews and risk assessment. It lists capabilities, usag…"
  },
  {
    "id": "lib-playwright-web-app-testing-toolkit-3e9edf82",
    "title": "Playwright Web App Testing Toolkit",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/playwright-web-app-testing-toolkit-3e9edf82",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "playwright",
      "javascript",
      "screenshots",
      "console_logs",
      "form_interaction",
      "responsive_design"
    ],
    "prompt": "This prompt describes a skill for testing and debugging local web applications using Playwright, covering browser automation, verification, debugging, usage examples, guidelines, c…"
  },
  {
    "id": "lib-playwright-spreadsheet-data-entry-automator-bac1",
    "title": "Playwright Spreadsheet Data Entry Automator",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/playwright-spreadsheet-data-entry-automator-bac11024",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "playwright",
      "spreadsheets",
      "automation",
      "testing",
      "data_integrity"
    ],
    "prompt": "The prompt directs the AI to act as a Software Implementor AI Agent that reads customer spreadsheets, automates data entry into a software system using Playwright scripts, executes…"
  },
  {
    "id": "lib-playwright-web-app-testing-toolkit-4c09c3ae",
    "title": "Playwright Web App Testing Toolkit",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/playwright-web-app-testing-toolkit-4c09c3ae",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "javascript",
      "node.js",
      "screenshots",
      "console_logs",
      "form_interaction",
      "responsive_design"
    ],
    "prompt": "Defines a skill for testing and debugging local web applications using Playwright, covering browser automation, verification, debugging, usage examples, guidelines, common patterns…"
  },
  {
    "id": "lib-playwright-local-webapp-testing-scripts-8a3b44fc",
    "title": "Playwright Local Webapp Testing Scripts",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/playwright-local-webapp-testing-scripts-8a3b44fc",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "playwright",
      "python",
      "automation",
      "webapp"
    ],
    "prompt": "Instructs the model to write native Python Playwright scripts for testing local web applications, following a decision tree that distinguishes static HTML from dynamic apps and usi…"
  },
  {
    "id": "lib-wisdom-filled-extraordinary-persona-actor-6145cc",
    "title": "Wisdom-Filled Extraordinary Persona Actor",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/wisdom-filled-extraordinary-persona-actor-6145ccf4",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "role_playing",
      "persona",
      "wisdom"
    ],
    "prompt": "Instructs the model to always act like one fill with wisdom and be extraordinary."
  },
  {
    "id": "lib-investor-and-competitor-idea-critic-673040ff",
    "title": "Investor and Competitor Idea Critic",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/investor-and-competitor-idea-critic-673040ff",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "roleplay",
      "investor",
      "competitor",
      "feedback"
    ],
    "prompt": "Instructs the model to act as an investor deciding whether to fund the user's idea and as a competitor trying to destroy the idea."
  },
  {
    "id": "lib-lyrics-to-music-composer-2af9b8c7",
    "title": "Lyrics-to-Music Composer",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/lyrics-to-music-composer-2af9b8c7",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "music",
      "composer",
      "lyrics",
      "poem",
      "instruments",
      "synthesizers"
    ],
    "prompt": "The prompt instructs the model to act as a composer that creates music for provided song lyrics using instruments or tools like synthesizers and samplers to produce melodies and ha…"
  },
  {
    "id": "lib-language-literary-excerpts-critic-d258141a",
    "title": "Language Literary Excerpts Critic",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/language-literary-excerpts-critic-d258141a",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "literature",
      "shakespeare",
      "analysis",
      "criticism",
      "theme",
      "characterization"
    ],
    "prompt": "The prompt instructs the model to act as a language literary critic, analyzing provided literature excerpts under given context based on genre, theme, plot structure, characterizat…"
  },
  {
    "id": "lib-magician-role-play-for-disappearing-watch-trick-",
    "title": "Magician Role-Play for Disappearing Watch Trick",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/magician-role-play-for-disappearing-watch-trick-5cea1e4a",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "roleplay",
      "magician",
      "deception",
      "misdirection",
      "entertainment"
    ],
    "prompt": "The prompt instructs the model to act as a magician performing entertaining tricks using deception and misdirection for a given audience and suggestions. The initial request is to…"
  },
  {
    "id": "lib-comprehensive-architecture-expert-advisor-e5a8aa",
    "title": "Comprehensive Architecture Expert Advisor",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/comprehensive-architecture-expert-advisor-e5a8aa52",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "architecture",
      "architectural_design",
      "structural_engineering",
      "sustainable_design",
      "building_codes"
    ],
    "prompt": "The prompt instructs the model to role-play as an expert in architecture across multiple subfields including design, history, engineering, materials, sustainability, project manage…"
  },
  {
    "id": "lib-llamaindex-rag-framework-guide-0f742af9",
    "title": "LlamaIndex RAG Framework Guide",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/llamaindex-rag-framework-guide-0f742af9",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "python",
      "llamaindex",
      "rag",
      "agents",
      "vector-store",
      "data-connectors"
    ],
    "prompt": "Provides installation instructions, code examples, core concepts, and advanced patterns for using LlamaIndex to build RAG applications with LLMs, data connectors, indices, query en…"
  },
  {
    "id": "lib-vector-database-engineer-for-rag-systems-7c1a9c9",
    "title": "Vector Database Engineer for RAG Systems",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/vector-database-engineer-for-rag-systems-7c1a9c97",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "pinecone",
      "weaviate",
      "qdrant",
      "milvus",
      "pgvector",
      "rag"
    ],
    "prompt": "Defines an expert role in vector databases, embeddings, and semantic search using tools like Pinecone and pgvector. Specifies usage conditions, workflow steps, capabilities, best p…"
  },
  {
    "id": "lib-langchain-agents-rag-and-tools-guide-29195d25",
    "title": "LangChain Agents RAG and Tools Guide",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/langchain-agents-rag-and-tools-guide-29195d25",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "python",
      "langchain",
      "rag",
      "agents",
      "llm",
      "tool_calling"
    ],
    "prompt": "The prompt provides installation steps, code samples, and explanations for using LangChain to build LLM applications including agents, chains, memory, RAG pipelines, vector stores,…"
  },
  {
    "id": "lib-qdrant-vector-similarity-search-guide-a468642f",
    "title": "Qdrant Vector Similarity Search Guide",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/qdrant-vector-similarity-search-guide-a468642f",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "qdrant",
      "rust",
      "python",
      "vector-search",
      "hybrid-search",
      "rag"
    ],
    "prompt": "Provides installation instructions, code examples, core concepts, search operations, RAG integrations, multi-vector support, quantization, and best practices for using the Qdrant v…"
  },
  {
    "id": "lib-writing-fragments-grilling-session-08647161",
    "title": "Writing Fragments Grilling Session",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/writing-fragments-grilling-session-08647161",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "markdown",
      "fragments",
      "interview",
      "raw_material"
    ],
    "prompt": "Runs a relentless interview to extract heterogeneous writing fragments from the user and appends them to a single markdown file. Preserves user edits, separates fragments with hori…"
  },
  {
    "id": "lib-visual-clutter-text-cleaner-9a92fffd",
    "title": "Visual Clutter Text Cleaner",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/visual-clutter-text-cleaner-9a92fffd",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "text_cleaning",
      "remove_symbols",
      "remove_frames",
      "remove_repetitions",
      "semantic_extraction"
    ],
    "prompt": "The prompt instructs the model to act as a tool for cleaning text overloaded with service symbols, frames, repetitions, technical inserts, and superfluous characters by removing th…"
  },
  {
    "id": "lib-vector-database-engineer-expert-cc54a9ed",
    "title": "Vector Database Engineer Expert",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/vector-database-engineer-expert-cc54a9ed",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "pinecone",
      "weaviate",
      "qdrant",
      "milvus",
      "pgvector",
      "rag"
    ],
    "prompt": "Defines an expert role in vector databases, embedding strategies, and semantic search implementation using tools like Pinecone, Weaviate, Qdrant, Milvus, and pgvector. Specifies us…"
  },
  {
    "id": "lib-three-js-repulsive-particle-nebula-scene-60f8176",
    "title": "Three.js Repulsive Particle Nebula Scene",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/three-js-repulsive-particle-nebula-scene-60f81766",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "javascript",
      "three.js",
      "shader_material",
      "points",
      "repulsion",
      "bloom_pass"
    ],
    "prompt": "Create a Three.js scene featuring a Points system with 15,000 particles using a custom ShaderMaterial for glow effect. Implement repulsion logic where particles fly away from the m…"
  },
  {
    "id": "lib-concise-complex-text-summarizer-012fc28f",
    "title": "Concise Complex Text Summarizer",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/concise-complex-text-summarizer-012fc28f",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "text_summarization",
      "role_prompt",
      "concise_summary",
      "neutral_tone",
      "max_length_limit",
      "placeholder"
    ],
    "prompt": "The prompt instructs the model to act as an expert text summarizer that distills complex texts into concise summaries no longer than 100 words, extracting core essence, key points,…"
  },
  {
    "id": "lib-rumi-poem-jung-spirit-essay-writer-1cdd16cf",
    "title": "Rumi Poem Jung Spirit Essay Writer",
    "source": "AIPromptIndex",
    "sourceUrl": "https://aipromptslibrary.sh/prompts/rumi-poem-jung-spirit-essay-writer-1cdd16cf",
    "tools": [
      "Cursor",
      "ChatGPT",
      "Claude"
    ],
    "tags": [
      "rumi",
      "jung",
      "poetry",
      "psychology",
      "thesis",
      "citations"
    ],
    "prompt": "Act as a college-level essay writer to analyze themes in Rumi's poem 'Crack my shell, Steal my pearl' connecting them to Jung's concept of spirit, discuss Jung's unconscious versus…"
  }
];
