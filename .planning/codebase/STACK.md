# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- JSON — Agent flow definition (`cinatra/oas.json`), package manifest (`package.json`)
- Markdown — Skill/system-prompt definition (`skills/blog-draft-writer-agent/SKILL.md`)

**Secondary:**
- TypeScript — TypeScript config is present (`tsconfig.json`, targeting `src/`) but no `src/` directory exists in the extracted repo; TypeScript sources live in the cinatra monorepo and are compiled there. The config targets ES2023, ESNext modules, strict mode.
- JavaScript (ESM) — `extension-kind-gate.mjs` (zero-dependency validation script)

## Runtime

**Environment:**
- Node.js 24 (declared in `.github/workflows/ci.yml` via `actions/setup-node@v4`)

**Package Manager:**
- pnpm (managed via corepack, declared in `.npmrc`)
- Lockfile: not committed (CI runs `--no-frozen-lockfile`)

## Frameworks

**Core:**
- Cinatra agentspec 26.1.0 — agent flow runtime; the `cinatra/oas.json` defines the full flow graph using `StartNode`, `ApiNode`, `BranchingNode`, `FlowNode`, `InputMessageNode`, `OutputMessageNode`, and `EndNode` components.

**Testing:**
- Not applicable — this is a source-mirror repo; tests run in the cinatra monorepo.

**Build/Dev:**
- TypeScript compiler (tsc) — used in the monorepo; CI skips standalone typecheck because first-party `@cinatra-ai/*` peers are not registry-published.
- `extension-kind-gate.mjs` — standalone zero-dependency validation script that runs OAS shape checks in CI (`kind-gates` job).

## Key Dependencies

**Critical:**
- `@cinatra-ai/context-selection-agent` ^0.1.1 — runtime agent dependency declared under `cinatra.agentDependencies` in `package.json`; provides the HITL context-selection UI renderer (`@cinatra-ai/context-selection-agent:context-selector`) invoked by the `context_draftContext` subflow.

**Infrastructure:**
- OpenAI (gpt-5.5) — preferred LLM provider/model declared in `cinatra/oas.json` under `metadata.cinatra.llm`; invoked via Cinatra's internal `/api/llm-bridge` endpoint.

## Configuration

**Environment:**
- `CINATRA_BASE_URL` — template variable referenced in all `ApiNode` URLs (`{{CINATRA_BASE_URL}}/api/llm-bridge`, `{{CINATRA_BASE_URL}}/api/context-resolve`, `{{CINATRA_BASE_URL}}/api/context-finalize`). Injected at runtime by the Cinatra platform; not present as a `.env` file in this repo.

**Build:**
- `tsconfig.json` — standalone strict TypeScript config; `rootDir: src`, `outDir: dist`, ES2023 target, ESNext modules, `bundler` module resolution.
- `.npmrc` — pnpm settings (existence noted; contents not read).
- `package.json` — `cinatra` manifest block declares `apiVersion`, `kind: agent`, `type: flow`, `riskLevel: low`, `hasApprovalGates: true`, `toolAccess: []`, produces `@cinatra-ai/blog-post-artifact`.

## Platform Requirements

**Development:**
- Node.js 24, corepack/pnpm
- Must be consumed inside the cinatra monorepo workspace; standalone install is blocked (host-internal `@cinatra-ai/*` peers are not published to any registry).

**Production:**
- Cinatra platform — agent is deployed as a managed flow; invoked via the Cinatra runner which substitutes `{{CINATRA_BASE_URL}}` and routes LLM calls through `/api/llm-bridge`.

---

*Stack analysis: 2026-06-09*
