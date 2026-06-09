# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**Cinatra Platform Internal APIs:**
- `/api/llm-bridge` — Core LLM invocation endpoint. The `write` ApiNode POSTs to `{{CINATRA_BASE_URL}}/api/llm-bridge` with the system prompt (derived from `skills/blog-draft-writer-agent/SKILL.md`), the user prompt template, `agent_id: "blog-draft-writer-agent"`, and preferred LLM config. The bridge auto-discovers the SKILL.md via `agent_id`.
  - SDK/Client: Direct HTTP POST via Cinatra `ApiNode` (no SDK wrapper)
  - Auth: Managed by Cinatra platform (injected at runtime)

- `/api/context-resolve` — Context resolution endpoint. POSTed by the `ctx-draftContext-resolve_context` ApiNode inside the `context-draftContext` subflow. Resolves artifact candidates for the `draftContext` context slot given `parentRunId`, `parentPackageName`, `slotId`, and `projectId`.
  - SDK/Client: Direct HTTP POST via Cinatra `ApiNode`
  - Auth: Managed by Cinatra platform

- `/api/context-finalize` — Context finalization endpoint. Called by both the `ctx-draftContext-finalize_interactive` (interactive HITL path) and `ctx-draftContext-finalize_autonomous` (autonomous path) ApiNodes. Returns `contextSlotBindings` consumed by the `write` node.
  - SDK/Client: Direct HTTP POST via Cinatra `ApiNode`
  - Auth: Managed by Cinatra platform

**LLM Provider:**
- OpenAI gpt-5.5 — declared as `preferredProvider: "openai"`, `preferredModel: "gpt-5.5"` in both the flow-level `metadata.cinatra.llm` block and the `write` node's `cinatra_llm` field (`cinatra/oas.json`). Invoked indirectly through `/api/llm-bridge`; the agent itself makes no direct OpenAI API calls.
  - Auth: Managed by the Cinatra platform; no API key in this repo.

## Data Storage

**Databases:**
- Not applicable — this is a stateless, LLM-only leaf agent. No database reads or writes occur.

**File Storage:**
- Not applicable — no file storage integration.

**Caching:**
- None — explicitly stateless by design (`SKILL.md`: "This is a STATELESS LLM-only agent").

## Authentication & Identity

**Auth Provider:**
- Cinatra platform — all API calls use `{{CINATRA_BASE_URL}}` with authentication managed transparently by the Cinatra runner. No auth tokens, API keys, or credentials are declared in this repo.

## Monitoring & Observability

**Error Tracking:**
- None detected in this repo. Error handling is defensive within the LLM prompt layer (`SKILL.md` error handling section) — the agent never throws and always returns a JSON envelope.

**Logs:**
- Operator-readable notes returned in the `notes` output field of the agent response. The `write` node surfaces LLM notes to the caller.

## CI/CD & Deployment

**Hosting:**
- Cinatra platform — the agent is deployed as a managed Cinatra flow. This repo is a source mirror extracted from the cinatra monorepo.

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`, `.github/workflows/release.yml`)
  - `build` job: Node 24, corepack, first-party dep shape validation, conditional install/typecheck/test, `npm pack --dry-run`.
  - `kind-gates` job: runs `extension-kind-gate.mjs --package-root .` to validate `cinatra/oas.json` agent OAS shape.
  - Triggers: push and PR to `main`.

## Environment Configuration

**Required env vars:**
- `CINATRA_BASE_URL` — base URL for all internal Cinatra API calls; injected at runtime by the Cinatra platform. Not configured in this repo.

**Secrets location:**
- No secrets files present in this repo. Auth and environment injection are managed entirely by the Cinatra platform runner.

## Webhooks & Callbacks

**Incoming:**
- None — the agent is invoked synchronously as a flow by the Cinatra runner.

**Outgoing:**
- None — no webhooks dispatched. The agent produces a `draft` object and `notes` string returned to the caller via the Cinatra flow output (`EndNode`).

## Agent Dependencies

**Runtime Agent Dependency:**
- `@cinatra-ai/context-selection-agent` ^0.1.1 — provides the HITL context-selector UI (`@cinatra-ai/context-selection-agent:context-selector`). Invoked at the `ctx-draftContext-context_select_gate` `InputMessageNode` inside the `context-draftContext` subflow when `selectionMode` is not `"autonomous"`.

## Artifact Contracts

**Consumes (context slot `draftContext`):**
- `@cinatra-ai/brand-voice-artifact` — optional brand voice artifact injected via context slot.
- `@cinatra-ai/blog-idea-artifact` — optional blog idea artifact injected via context slot.
- Slot config: `selectionMode: interactive`, `resolutionMode: accumulate`, 0-5 items, defined in `cinatra/oas.json` under `metadata.cinatra.contextSlots`.

**Produces:**
- `@cinatra-ai/blog-post-artifact` — declared in both `package.json` (`cinatra.produces`) and `cinatra/oas.json` (`metadata.cinatra.produces`).

---

*Integration audit: 2026-06-09*
