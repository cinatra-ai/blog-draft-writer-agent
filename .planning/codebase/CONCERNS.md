# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

**No `src/` directory or TypeScript source files:**
- Issue: `tsconfig.json` declares `rootDir: "src"` and `include: ["src/**/*.ts"]`, but no `src/` directory exists. The config is a shipped template placeholder with no code to compile.
- Files: `tsconfig.json`
- Impact: If a future contributor adds TypeScript source, they need to validate the config is still correct. Currently the typecheck CI step skips because this is a first-party source mirror.
- Fix approach: Either remove `tsconfig.json` until there are TypeScript sources to compile, or document explicitly that it is a forward-looking template.

**`package.json` declares no `test` or `typecheck` script:**
- Issue: `package.json` contains no `scripts` field at all. CI infers skipping based on the presence of first-party `@cinatra-ai/*` peers, not an explicit skip contract in the manifest.
- Files: `package.json`
- Impact: Any standalone CI refactor that removes the first-party detection heuristic would silently succeed with `pnpm test --if-present` returning 0 even if tests were expected.
- Fix approach: Add explicit `scripts` entries (even if they only `echo "skipped"`) to make the intent clear.

**`package.json` missing `peerDependencies` / `peerDependenciesMeta` for `@cinatra-ai/context-selection-agent`:**
- Issue: `cinatra.agentDependencies` and `cinatra.dependencies` declare `@cinatra-ai/context-selection-agent` as a required runtime dependency, but `peerDependencies` and `peerDependenciesMeta` do not exist in `package.json`. The CI gate checks for first-party packages in `peerDependencies` to classify the repo as a "source mirror" — this classification currently relies on `cinatra.dependencies` data, which the gate script ignores.
- Files: `package.json`, `.github/workflows/ci.yml`
- Impact: CI classify script (`node -e '...'`) reads `peerDependencies` only; if it is absent, the script exits 1 (standalone), causing the CI to attempt a standalone install that will fail because the peer is not published to any accessible registry.
- Fix approach: Add `peerDependencies: { "@cinatra-ai/context-selection-agent": "^0.1.1" }` and `peerDependenciesMeta: { "@cinatra-ai/context-selection-agent": { "optional": true } }` to `package.json`.

**`cinatra.packageType` vs `cinatra.kind` mismatch:**
- Issue: `package.json` declares `cinatra.packageType: "agent"` but the `extension-kind-gate.mjs` and CI gate look for `cinatra.kind` (not `cinatra.kind` is absent from `package.json`). The OAS spec (`cinatra/oas.json`) has no top-level `kind` either, while the gate dispatches on `pkg?.cinatra?.kind`.
- Files: `package.json`, `extension-kind-gate.mjs`, `cinatra/oas.json`
- Impact: `runGate()` will fall into the `return { kind, errors: [] }` pass-all branch because `kind` is `undefined`. The agent-specific retired-primitive scan is silently skipped.
- Fix approach: Add `"kind": "agent"` to `package.json`'s `cinatra` block so the gate routes to `validateAgent()`.

## Known Bugs

**CI kind-gate is silently bypassed:**
- Symptoms: `node extension-kind-gate.mjs --package-root .` exits 0 with "no kind-specific gate for kind undefined" rather than running the agent OAS retired-primitive scan.
- Files: `package.json` (missing `cinatra.kind`), `extension-kind-gate.mjs` (lines 358-362)
- Trigger: Running `node extension-kind-gate.mjs --package-root .` in the repo root.
- Workaround: None currently — the agent OAS scan is not being executed in CI.

## Security Considerations

**`referenceContent` prompt injection surface:**
- Risk: The `write` ApiNode in `cinatra/oas.json` interpolates `{{ referenceContent }}` directly into the LLM user prompt with no sanitisation or length cap. A caller can inject arbitrary prompt text (including instructions to override SKILL.md rules, exfiltrate `sources[]` URLs, or call fictitious tools) by embedding adversarial content in `referenceContent`.
- Files: `cinatra/oas.json` (lines 436-437), `skills/blog-draft-writer-agent/SKILL.md`
- Current mitigation: SKILL.md instructs the LLM not to follow tool-call instructions, but this is a soft guardrail only; no server-side filtering exists.
- Recommendations: Apply a character/token length limit on `referenceContent` at the dispatcher level; add a content-safety pre-screen before injecting into the prompt; consider wrapping the value in a clearly delimited block (e.g., `<reference>...</reference>`) that the system prompt instructs the model to treat as passive text only.

**`voice` and `sources` inputs also interpolated without validation:**
- Risk: Same prompt-injection vector as `referenceContent` exists for `voice` (free-form brand instructions) and `sources[].title` / `sources[].url` (used as inline Markdown links). A malicious `sources[].url` could produce links to attacker-controlled domains in the published blog post.
- Files: `cinatra/oas.json` (lines 436-437)
- Current mitigation: None.
- Recommendations: Validate `sources[].url` against an allowlist or at minimum a URL scheme check (`https://` only); sanitise `voice` length.

**`CINATRA_BASE_URL` template variable without input validation:**
- Risk: The OAS uses `{{CINATRA_BASE_URL}}` as a server URL in all three ApiNodes. If this variable is ever injectable from user-controlled input rather than server-side config, it creates an SSRF risk.
- Files: `cinatra/oas.json` (lines 17, 1018, 1155)
- Current mitigation: Assumed to be server-controlled at runtime; no user-controlled path to this variable is visible in the manifest.
- Recommendations: Document that `CINATRA_BASE_URL` must be set server-side only and is never exposed to caller inputs.

**.npmrc present:**
- `.npmrc` exists at repo root. It contains only `auto-install-peers=false` (no auth tokens).

## Performance Bottlenecks

**Unbounded `referenceContent` string passed to LLM:**
- Problem: No length constraint exists on `referenceContent` in the OAS `inputs` schema (it is typed `string` with no `maxLength`). A very large reference document increases LLM inference cost and latency significantly and may exceed context window limits causing a silent truncation.
- Files: `cinatra/oas.json` (line 58), `skills/blog-draft-writer-agent/SKILL.md`
- Cause: No schema-level `maxLength` set on the input; no chunking or summarisation step upstream.
- Improvement path: Add `maxLength` to the OAS input definition for `referenceContent`; or add an upstream summarisation agent in the caller chain before passing to this leaf.

**Context slot resolution adds a synchronous round-trip per run:**
- Problem: Every run routes through the `context_draftContext` subflow (resolve → branch → emit → gate → finalize), which makes at least two API calls to `/api/context-resolve` and `/api/context-finalize` even when no context artifacts are selected (`minItems: 0`). In the common zero-context case this is pure latency overhead.
- Files: `cinatra/oas.json` (lines 113-157 control flow, lines 341-1307 subflow definition)
- Cause: Context resolution is unconditional in the flow topology.
- Improvement path: Add a short-circuit branch that skips the context subflow entirely when the caller passes no `cinatra_run_id` (i.e., no active run context to resolve against).

## Fragile Areas

**OAS `write` node system prompt is hardcoded and diverges from SKILL.md:**
- Files: `cinatra/oas.json` (lines 434-436)
- Why fragile: The `system` field in the `write` ApiNode is a brief inline summary ("Follow the SKILL.md step-by-step"), not the full SKILL.md. Any time SKILL.md is updated, the inline summary may become stale or contradictory. The LLM bridge must auto-discover SKILL.md by `agent_id`; if that discovery fails or is misconfigured, the agent runs on the stub system prompt alone, producing lower-quality or non-conformant output.
- Safe modification: Keep the inline `system` prompt in sync with SKILL.md by automating or linting the extraction script; add a CI check that warns when SKILL.md hash changes without a corresponding OAS update.
- Test coverage: No automated tests verify the output shape or SKILL.md adherence.

**`sourcesUsed` field is OPTIONAL but output schema marks `draft` as opaque `object`:**
- Files: `cinatra/oas.json` (lines 100-109, 511-519)
- Why fragile: Both `draft` output (from `write` and from `end`) are typed as `object` with no sub-schema. Callers cannot statically validate that `draft.title`, `draft.excerpt`, `draft.content`, or `draft.sourcesUsed` are present. A regression in LLM output format (e.g., missing `excerpt`) would pass schema validation silently.
- Safe modification: Add a `json_schema` sub-schema to the `draft` output in `cinatra/oas.json` to enforce `title`, `excerpt`, `content` as required strings.
- Test coverage: None.

**`notes` output typed as `string` but may be absent:**
- Files: `cinatra/oas.json` (lines 538-545), `skills/blog-draft-writer-agent/SKILL.md` (lines 130-143)
- Why fragile: SKILL.md makes `notes` always present in the return JSON, but the EndNode sets `"default": ""`, suggesting callers might receive an empty string when the LLM omits it. Any caller treating an empty `notes` as an error would misfire.
- Safe modification: Document and enforce that `notes` is always a non-empty string; or make it explicitly optional in the OAS.

## Scaling Limits

**Single LLM node with no retry or fallback:**
- Current capacity: One synchronous LLM call via `/api/llm-bridge` using `gpt-5.5`.
- Limit: If the LLM bridge is unavailable or rate-limited, the entire flow fails with no retry logic.
- Scaling path: Add retry / exponential-backoff at the `write` ApiNode level in the flow runtime, or expose a `preferredFallbackModel` field in `cinatra_llm` metadata.

## Dependencies at Risk

**`@cinatra-ai/context-selection-agent` pinned to `*` / `^0.1.1`:**
- Risk: `cinatra.dependencies` uses `"range": "*"` while `cinatra.agentDependencies` uses `"^0.1.1"`. The wildcard allows any version including major breaking changes.
- Impact: Runtime context selection behaviour could silently change if the dependency is updated.
- Files: `package.json` (lines 11-23, 40)
- Migration plan: Align both declarations to `"^0.1.1"` and eliminate the `"range": "*"` wildcard.

## Missing Critical Features

**No input validation for `idea` object shape at the OAS layer:**
- Problem: The OAS `inputs` declares `idea` as `type: "object"` with no `json_schema`. The StartNode marks it as required, but there is no schema enforcement that `title` and (`summary` or `outline`) are present before the LLM is invoked. Invalid ideas reach the LLM, which returns the degenerate-input error branch — a wasted LLM call.
- Blocks: Callers cannot rely on fast-fail validation; every bad `idea` wastes a round-trip.

**No word-count verification step post-LLM:**
- Problem: SKILL.md mandates that the final word count be within ±10% of the target. There is no post-processing node in the flow that verifies this constraint; enforcement is entirely prompt-side.
- Blocks: Length requirement cannot be programmatically guaranteed, leading to inconsistent output for callers with strict length contracts (e.g., CMS character limits).

## Test Coverage Gaps

**Zero test files in the repository:**
- What's not tested: All SKILL.md logic — input parsing, outline synthesis, word count targeting, excerpt generation, `sourcesUsed` filtering, error-handling branches, tone/voice/audience application, `referenceContent` extraction discipline.
- Files: Entire `skills/blog-draft-writer-agent/SKILL.md` logic; `cinatra/oas.json` flow; `extension-kind-gate.mjs` (gate logic is tested externally in the monorepo only).
- Risk: Regressions in LLM instruction fidelity, output schema compliance, or gate logic go undetected until a downstream caller fails at runtime.
- Priority: High — `extension-kind-gate.mjs` is the only executable code in the repo and has no unit tests here; SKILL.md changes have no regression safety net.

**`extension-kind-gate.mjs` not covered by local tests:**
- What's not tested: `validateAgent()`, `validateBpmnSanity()`, `validateWorkflowPackageShape()`, `findWorkflowSidecars()`, `runGate()` — all exported functions.
- Files: `extension-kind-gate.mjs`
- Risk: The agent gate silently bypasses the retired-primitive scan (see Known Bugs above) and there are no local tests to catch this.
- Priority: High.

---

*Concerns audit: 2026-06-09*
