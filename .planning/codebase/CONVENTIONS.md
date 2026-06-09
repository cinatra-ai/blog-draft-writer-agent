# Coding Conventions

**Analysis Date:** 2026-06-09

## Repo Type

This is a **Cinatra agent extension repo** — a content-only source mirror with no application TypeScript source files. The primary artifacts are:
- `skills/blog-draft-writer-agent/SKILL.md` — LLM system prompt (Markdown)
- `cinatra/oas.json` — agent flow definition (JSON)
- `extension-kind-gate.mjs` — self-contained CI validation script (ESM JavaScript)
- `package.json` — Cinatra manifest + npm package descriptor

## Naming Patterns

**Files:**
- Skill prompt files: `SKILL.md` (uppercase, inside `skills/<agent-name>/`)
- Gate script: `extension-kind-gate.mjs` (kebab-case, `.mjs` ESM extension)
- Flow definitions: `cinatra/oas.json` (lowercase, inside `cinatra/`)
- CI workflows: `.github/workflows/<name>.yml` (kebab-case)

**Agent/Package IDs:**
- npm package name: `@cinatra-ai/<slug>` where slug is kebab-case (e.g., `@cinatra-ai/blog-draft-writer-agent`)
- Agent ID (`agent_id` in OAS): matches the slug without scope (e.g., `blog-draft-writer-agent`)
- Flow ID (`id` in `oas.json`): `<agent-slug>-flow` (e.g., `blog-draft-writer-agent-flow`)
- Node IDs in OAS: snake_case (e.g., `context_draftContext`, `write`, `end`)
- Data flow edge names: `<from-node>_<output>_to_<to-node>_<input>` (e.g., `start_idea_to_write_idea`)

**OAS Component refs:**
- Context subflow nodes use prefix `ctx-<slotId>-` (e.g., `ctx-draftContext-start`)
- Context slot IDs: camelCase (e.g., `draftContext`)

**JavaScript (gate script):**
- Function names: camelCase (e.g., `parseArgs`, `validateAgent`, `walkLlmStrings`, `scanOasString`)
- Constants: UPPER_SNAKE_CASE for sets and regex (e.g., `BANNED_PRIMITIVES`, `LLM_VISIBLE_FIELDS`, `BPMN_MODEL_NS`)
- Variables: camelCase

## Code Style

**Formatting (extension-kind-gate.mjs):**
- 2-space indentation
- Double quotes for strings
- No trailing semicolons (convention is omitted — actually semicolons ARE present)
- Arrow functions preferred over `function` keyword for callbacks
- Destructuring used for object returns (e.g., `const { kind, errors } = runGate(...)`)

**Module System:**
- ESM (`"type": "module"` in `package.json`)
- `import { ... } from "node:fs"` — `node:` protocol prefix required for builtins
- No external dependencies in the gate script (self-contained constraint)

**TypeScript Config:**
- `strict: true` with `noImplicitAny: false` (strict mode with one explicit relaxation)
- `target: ES2023`, `module: ESNext`, `moduleResolution: bundler`
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `isolatedModules: true`
- Source maps and declaration maps enabled

## SKILL.md Authoring Conventions

**Structure:**
- YAML front matter: `name` and `description` fields
- Sections use `##` headings
- Numbered steps for sequential procedures
- Tables for structured data (e.g., length/word-count mapping)
- Code blocks for JSON output shapes

**Agent behavior rules in SKILL.md:**
- Never throw — always return the JSON envelope
- Degenerate-input handling documented with explicit JSON example
- Default values for every optional input explicitly stated
- Return shape pinned to exact JSON structure with comments on optional fields

**Prompt discipline in OAS:**
- `system` field: concise role statement + key constraints (no tool calls, return format)
- `user` field: template string with `{{ variable }}` Jinja-style placeholders
- Banned primitives (retired CRM APIs) must never appear in `system`/`user`/`description` fields — enforced by `extension-kind-gate.mjs`

## Import Organization

**In extension-kind-gate.mjs:**
1. Node built-in imports with `node:` prefix (`node:fs`, `node:path`)
2. No third-party imports (self-contained constraint)

## Error Handling

**Gate script pattern:**
- Functions return `string[]` errors (pure, no throws)
- `main()` collects errors and calls `process.exit(1)` on violations
- Try/catch wraps all `readFileSync` and `JSON.parse` calls; errors are pushed to the errors array
- `validateAgent` and `validateWorkflow` are pure functions that accumulate errors then return

**SKILL.md agent error handling:**
- Agent must never throw; always return the JSON envelope
- Degenerate input → return `{ draft: { title: "", excerpt: "", content: "" }, notes: "idea_was_empty_or_invalid — cannot draft" }`
- Unparseable `length` → treat as `"medium"`, document fallback in `notes`
- Missing optional fields → apply documented defaults silently

## Logging

**Gate script:** Uses `console.log` for pass messages and `console.error` for violations. GitHub Actions `::error::` annotation syntax used in CI shell steps.

## Comments

**When to Comment:**
- File-level block comments explain purpose, scope, and constraints (gate script has extensive header comment)
- Inline comments explain non-obvious decisions (e.g., why `pnpm dlx` is avoided, why first-party peers are optional)
- OAS node `metadata.cinatra.description` fields carry design rationale (e.g., why `toolboxes` is omitted)

**Style:** `//` single-line comments preferred. Block comments (`/* */`) not used.

## Module Design

**Exports (extension-kind-gate.mjs):**
- Named exports for all pure functions: `parseArgs`, `validateAgent`, `validateWorkflowPackageShape`, `validateBpmnSanity`, `findWorkflowSidecars`, `validateWorkflow`, `runGate`
- `main()` is NOT exported — called only when invoked directly (guarded by `invokedDirectly` check)
- This allows the gate to be unit-tested by importing individual functions

## Cinatra Manifest Conventions

**package.json `cinatra` block required fields for agents:**
- `apiVersion: "cinatra.ai/v1"`
- `kind: "agent"`
- `packageType: "agent"`
- `manifestVersion: 1`
- `type: "flow"` (for flow-based agents)
- `riskLevel`: one of `"low"` / `"medium"` / `"high"`
- `hasApprovalGates: boolean`
- `toolAccess: []` (empty array for pure LLM-only agents)
- `produces`: array of `{ extension: "@cinatra-ai/<artifact-extension>" }`
- `agentDependencies`: object mapping package names to semver ranges

**First-party peer dependency rule:**
- `@cinatra-ai/*` packages MUST be `peerDependencies` only, never `dependencies` or `devDependencies`
- All first-party peers must have `peerDependenciesMeta.<pkg>.optional: true`
- This constraint is enforced by CI (`ci.yml` classify step)

---

*Convention analysis: 2026-06-09*
