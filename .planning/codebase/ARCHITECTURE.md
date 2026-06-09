<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                        Caller / Orchestrator                 │
│  (upstream pipeline: blog-idea-generator, web-research-agent)│
└──────────────────────────────┬──────────────────────────────┘
                               │ idea, tone, length, audience,
                               │ voice, referenceContent, sources
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  StartNode ("Inputs")                        │
│          `cinatra/oas.json` → $referenced_components.start   │
│  Required: idea  |  Hidden: all optional fields              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          FlowNode: context_draftContext                      │
│     (embeds context-draftContext-subflow)                    │
│  → POST /api/context-resolve                                 │
│  → BranchingNode: interactive vs autonomous                  │
│  → HITL gate (context-selection-agent:context-selector)      │
│  → POST /api/context-finalize                                │
│  Outputs: contextSlotBindings[]                              │
└──────────────────────────────┬──────────────────────────────┘
                               │ contextSlotBindings
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              ApiNode "write" ("Write draft via /api/llm-bridge") │
│          `cinatra/oas.json` → $referenced_components.write   │
│  POST {{CINATRA_BASE_URL}}/api/llm-bridge                    │
│  agent_id: "blog-draft-writer-agent"                         │
│  system/user prompt → SKILL.md (auto-discovered by bridge)   │
│  LLM: OpenAI gpt-5.5                                         │
│  Outputs: draft (object), notes (string)                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              EndNode ("End")                                 │
│          `cinatra/oas.json` → $referenced_components.end     │
│  Outputs: draft {title, excerpt, content, sourcesUsed?}      │
│           notes (operator summary string)                    │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| StartNode (start) | Declares all inputs; enforces `idea` as required | `cinatra/oas.json` |
| FlowNode (context_draftContext) | Resolves optional context artifacts (brand-voice, blog-idea) via HITL or autonomous sub-flow | `cinatra/oas.json` |
| ApiNode (write) | Calls the LLM bridge with assembled prompt; auto-loads SKILL.md as system prompt | `cinatra/oas.json` |
| EndNode (end) | Collects and exposes `draft` and `notes` outputs | `cinatra/oas.json` |
| SKILL.md | System prompt / behavioural spec for the LLM; defines 5-step recipe, constraints, return shape | `skills/blog-draft-writer-agent/SKILL.md` |
| extension-kind-gate.mjs | Zero-dependency CI pre-publish sanity gate; scans OAS for banned CRM primitives | `extension-kind-gate.mjs` |

## Pattern Overview

**Overall:** Stateless LLM-only leaf agent implemented as a Cinatra Flow (directed acyclic graph of nodes). No in-process business logic — all generation is delegated to an LLM via `/api/llm-bridge`.

**Key Characteristics:**
- Pure generation leaf — no tool calls, no web search, no CRM reads/writes
- Context artifacts (brand voice, blog ideas) are injected via an interactive or autonomous context-resolution sub-flow before the LLM call
- Deterministic control flow: start → context-resolve → write → end (linear, with an internal branch inside the context sub-flow)
- All agent behaviour is specified declaratively: the OAS defines the flow graph; SKILL.md defines the LLM prompt instructions

## Layers

**Flow Definition Layer:**
- Purpose: Declares the node graph, inputs/outputs, control-flow edges, data-flow edges, and LLM call parameters
- Location: `cinatra/oas.json`
- Contains: StartNode, FlowNode (context sub-flow), ApiNode, EndNode, and all edge wiring
- Depends on: Cinatra runtime (`{{CINATRA_BASE_URL}}/api/llm-bridge`, `/api/context-resolve`, `/api/context-finalize`)
- Used by: Cinatra platform at execution time

**Prompt / Behavioural Spec Layer:**
- Purpose: Defines the 5-step recipe executed by the LLM (parse inputs → plan arc → write draft → write excerpt → populate sourcesUsed)
- Location: `skills/blog-draft-writer-agent/SKILL.md`
- Contains: Input spec, tool discipline rules, step-by-step instructions, length table, title/excerpt constraints, error handling, return shape
- Depends on: Nothing (plain text — consumed by the LLM bridge auto-discovery mechanism via `agent_id: "blog-draft-writer-agent"`)
- Used by: ApiNode `write` at runtime; SKILL.md is auto-discovered by the bridge

**Package Manifest Layer:**
- Purpose: Declares Cinatra extension metadata, artifact production, and runtime agent dependency
- Location: `package.json`
- Contains: `cinatra.packageType: "agent"`, `cinatra.produces: [@cinatra-ai/blog-post-artifact]`, `cinatra.agentDependencies: @cinatra-ai/context-selection-agent`
- Depends on: Nothing at build time
- Used by: Cinatra marketplace, CI gate

**CI Gate Layer:**
- Purpose: Pre-publish sanity check — scans `cinatra/oas.json` LLM-visible strings for retired CRM primitives
- Location: `extension-kind-gate.mjs`
- Contains: `validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `runGate` (all pure, exported, testable)
- Depends on: Node.js builtins only (`fs`, `path`)
- Used by: `.github/workflows/ci.yml` (`kind-gates` job)

## Data Flow

### Primary Request Path

1. Caller provides `idea` (required), plus optional `tone`, `length`, `referenceContent`, `audience`, `voice`, `sources` → StartNode (`cinatra/oas.json` `$referenced_components.start`)
2. All inputs forwarded to FlowNode `context_draftContext` (also receives `cinatra_run_id`, `projectId`) → sub-flow calls `POST /api/context-resolve`
3. Context sub-flow branches: if `selectionMode == "autonomous"` → finalize immediately; else → emit context payload to HITL gate → user selects artifacts → `POST /api/context-finalize`
4. `contextSlotBindings[]` returned to ApiNode `write`
5. ApiNode `write` calls `POST {{CINATRA_BASE_URL}}/api/llm-bridge` with assembled user prompt (all inputs + `contextSlotBindings`) and system prompt (SKILL.md); LLM: OpenAI gpt-5.5 (`cinatra/oas.json` `$referenced_components.write`)
6. LLM executes 5-step recipe from SKILL.md and returns JSON `{draft: {title, excerpt, content, sourcesUsed?}, notes}` (`skills/blog-draft-writer-agent/SKILL.md`)
7. `draft` and `notes` forwarded to EndNode and returned to caller (`cinatra/oas.json` `$referenced_components.end`)

### Context Resolution Sub-Flow

1. `POST /api/context-resolve` → candidates, slotMeta, selectedRefs, selectionMode, resolutionMode
2. BranchingNode routes on `selectionMode`
3. Interactive path: OutputMessageNode emits candidate payload → InputMessageNode (HITL gate, renderer: `@cinatra-ai/context-selection-agent:context-selector`) → `POST /api/context-finalize` with user response
4. Autonomous path: skip HITL gate → `POST /api/context-finalize` with pre-resolved `selectedRefs`
5. Both paths produce `contextSlotBindings[]`

**State Management:**
- Stateless end-to-end. No database, no cache, no session. All state is passed through the flow's data edges within a single execution run.

## Key Abstractions

**BlogIdea:**
- Purpose: Required input struct from the upstream blog-idea-generator producer
- Shape: `{title: string, summary: string, outline: string[]}`
- Used in: SKILL.md Step 1; StartNode input `idea`

**BlogDraft:**
- Purpose: The generated output artifact
- Shape: `{title: string, excerpt: string, content: string, sourcesUsed?: string[]}`
- Produced as: `@cinatra-ai/blog-post-artifact` (declared in `package.json` `cinatra.produces`)

**contextSlotBindings:**
- Purpose: Resolved artifact references (brand-voice, blog-idea) injected into the LLM prompt as `{{ contextSlotBindings }}`
- Accepted artifact extensions: `@cinatra-ai/brand-voice-artifact`, `@cinatra-ai/blog-idea-artifact`
- Slot config: `draftContext`, selectionMode `interactive`, resolutionMode `accumulate`, 0–5 items

**Context Slot (draftContext):**
- Purpose: Optional pre-loaded context artifacts the LLM can incorporate during draft generation
- Location: `cinatra/oas.json` `metadata.cinatra.contextSlots`

## Entry Points

**Flow Entry:**
- Location: `cinatra/oas.json`, `start_node.$component_ref: "start"`
- Triggers: Cinatra platform dispatches an execution run with `idea` (required) + optional fields
- Responsibilities: Validates required inputs; routes data to context sub-flow then to the write ApiNode

**CI Gate Entry:**
- Location: `extension-kind-gate.mjs` `main()` function
- Triggers: `node extension-kind-gate.mjs --package-root .` in GitHub Actions `kind-gates` job (`.github/workflows/ci.yml`)
- Responsibilities: Loads `package.json`, dispatches to `validateAgent` for `cinatra.kind == "agent"`, scans OAS for banned primitives, exits 0/1

## Architectural Constraints

- **Threading:** Not applicable — no in-process execution. The agent is a declarative flow spec; the Cinatra runtime executes it.
- **Global state:** None. No module-level singletons. The extension-kind-gate.mjs exports pure functions; `main()` only runs when invoked directly.
- **Circular imports:** None. No import graph — the only JS file (`extension-kind-gate.mjs`) uses only Node builtins.
- **No tool calls:** SKILL.md and OAS both explicitly forbid MCP tool calls. The LLM bridge is instructed "Do NOT call any MCP tool."
- **LLM model pinning:** Preferred model is `gpt-5.5` via OpenAI; declared in both `cinatra/oas.json` `metadata.cinatra.llm` and the ApiNode `write` `cinatra_llm` field.
- **Source mirror:** This repo is an extracted monorepo mirror. Host-internal `@cinatra-ai/*` dependencies are declared as optional peer dependencies only and cannot be resolved standalone — CI skips install/typecheck/test for source-mirror repos.

## Anti-Patterns

### Calling MCP tools from the write node

**What happens:** Adding a `toolboxes` key to the ApiNode `write` metadata or referencing `web_search` / CRM primitives in the prompt
**Why it's wrong:** This agent is a stateless generation leaf; tool calls introduce latency, side effects, and violate the `cinatra.toolAccess: []` contract. The OAS metadata comment explicitly documents this as "codex-locked decision #5."
**Do this instead:** Chain `@cinatra-ai/web-research-agent` upstream in the caller's orchestration; pass research results via `referenceContent`.

### Putting first-party deps in dependencies/devDependencies

**What happens:** Adding `@cinatra-ai/*` packages to `dependencies` or `devDependencies` in `package.json`
**Why it's wrong:** These packages are not published to any registry; the CI gate (`extension-kind-gate.mjs`-adjacent logic in `ci.yml`) explicitly checks for this and exits 2 on violation.
**Do this instead:** Declare them as `peerDependencies` with `peerDependenciesMeta[pkg].optional: true`.

## Error Handling

**Strategy:** Never throw from the LLM. Return the JSON envelope always.

**Patterns:**
- Degenerate input (`idea` is empty/invalid): return `{draft: {title:"", excerpt:"", content:""}, notes: "idea_was_empty_or_invalid — cannot draft"}`
- Missing optional fields: apply declared defaults (`tone: "informative"`, `length: "medium"`, `referenceContent/audience/voice: ""`, `sources: []`)
- Unparseable `length`: fall back to `"medium"` and record in `notes`
- CI gate errors: `validateAgent` returns a `string[]` of violation messages; gate exits 1 with all violations listed

## Cross-Cutting Concerns

**Logging:** Operator-readable `notes` string in every response. No structured server-side logging in this repo (handled by Cinatra platform).
**Validation:** `idea` is the only required field; enforced at StartNode level (`metadata.cinatra.required: ["idea"]`). All other fields have defaults.
**Authentication:** Not applicable at this layer — the Cinatra platform handles auth before dispatching the flow.

---

*Architecture analysis: 2026-06-09*
