# Testing Patterns

**Analysis Date:** 2026-06-09

## Overview

This repo is a **Cinatra agent extension source mirror**. It contains no application TypeScript source files (`src/` is absent). The only testable runtime code is `extension-kind-gate.mjs` — a self-contained ESM script that validates agent/workflow extension packages.

There is no test framework configured (no `jest.config.*`, `vitest.config.*`, or `test` script in `package.json`). Functional validation is entirely handled by CI gates.

## Test Framework

**Runner:** Not applicable — no automated test suite present in this repo.

**Assertion Library:** Not applicable.

**Run Commands:**
```bash
# No test script — CI skips `pnpm test` with --if-present
corepack pnpm test --if-present   # exits 0 (no-op)
```

Note: Per `ci.yml`, standalone repos (no first-party `@cinatra-ai/*` peers) run `pnpm test --if-present`. This repo is a source mirror with first-party peers, so standalone tests are explicitly skipped: "the cinatra monorepo runs these."

## CI Validation Gates (Functional Equivalent of Tests)

The repo uses two CI jobs as the primary quality gate:

### Job 1: `build` (`.github/workflows/ci.yml`)

Steps and what they validate:
1. **Classify + first-party dep shape check** — runs inline `node -e` script to ensure `@cinatra-ai/*` packages are `peerDependencies` only (not `dependencies`/`devDependencies`), and all first-party peers are marked `optional: true` in `peerDependenciesMeta`. Exits 2 on violation.
2. **Install** — skipped for source mirrors (first-party peers not resolvable standalone).
3. **Typecheck** — skipped for source mirrors; also skipped if no `.ts`/`.tsx` files are tracked (content-only extension). Falls back to `npx tsc --noEmit` if `typescript` is not a local dep.
4. **Pack (dry run)** — `npm pack --dry-run` validates package shape and publish payload without resolving peers.

### Job 2: `kind-gates` (`.github/workflows/ci.yml`)

Runs `node extension-kind-gate.mjs --package-root .` after the `build` job passes.

For `kind: "agent"` packages this gate:
- Parses `cinatra/oas.json` (parse failure = error)
- Walks all `system`, `user`, and `description` string fields in the OAS
- Scans for banned/retired CRM primitive tokens (e.g., `contacts_list`, `accounts_get`, `lists_create` — full list in `extension-kind-gate.mjs` lines 65-71)
- Scans for banned entity type hints (e.g., `@cinatra-ai/entity-accounts:account`)
- Scans for `objects_list` over CRM entity types
- Reports violations with field name, token, and remediation hint; exits 1 on any violation

## Gate Script Testability

`extension-kind-gate.mjs` is authored with unit-testability in mind:
- All validation logic is exported as named pure functions
- `main()` is NOT exported and only runs when the script is invoked directly

Exported functions that could be unit tested:
```javascript
import {
  parseArgs,          // arg parsing
  validateAgent,      // agent OAS scan (returns string[] errors)
  validateWorkflowPackageShape, // package.json shape check
  validateBpmnSanity, // XML well-formedness + BPMN shape
  findWorkflowSidecars, // recursive BPMN sidecar finder
  validateWorkflow,   // full workflow validation
  runGate,            // dispatch by kind
} from "./extension-kind-gate.mjs";
```

No test files exist for these functions in this extracted repo — the monorepo owns the test suite for the gate script.

## Test File Organization

**Location:** No test files present in this repo.

**Naming:** Not applicable.

## Mocking

**Framework:** Not applicable — no test suite.

**Patterns:** The gate script functions are pure (no I/O side effects beyond `readFileSync`), making them straightforward to test with fixture files or string inputs without mocking.

## Fixtures and Factories

**Test Data:** Not applicable — no test suite.

**Potential fixture pattern** (if tests were added):
- Provide sample `oas.json` files with valid/invalid content to `validateAgent()`
- Provide sample BPMN XML strings to `validateBpmnSanity()`
- Provide sample `package.json` objects to `validateWorkflowPackageShape()`

## Coverage

**Requirements:** None enforced (no coverage tooling configured).

## Test Types

**Unit Tests:** Not present. All validation is done via CI gate execution.

**Integration Tests:** Not present.

**E2E Tests:** Not applicable.

## What CI Actually Validates

| Check | How | File |
|-------|-----|------|
| First-party dep shape | Inline `node -e` in CI | `.github/workflows/ci.yml` |
| TypeScript compilation | `tsc --noEmit` | `.github/workflows/ci.yml` |
| npm package publish shape | `npm pack --dry-run` | `.github/workflows/ci.yml` |
| OAS retired-primitive scan | `extension-kind-gate.mjs` | `extension-kind-gate.mjs` |
| OAS JSON parse validity | `extension-kind-gate.mjs` | `extension-kind-gate.mjs` |

## How to Run the Gate Locally

```bash
node extension-kind-gate.mjs --package-root .
# Exit 0 = pass. Exit 1 = violations printed to stderr.
```

---

*Testing analysis: 2026-06-09*
