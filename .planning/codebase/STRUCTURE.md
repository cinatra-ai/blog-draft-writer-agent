# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
blog-draft-writer-agent/
├── cinatra/
│   └── oas.json                    # Flow definition: nodes, edges, LLM call config
├── skills/
│   └── blog-draft-writer-agent/
│       └── SKILL.md                # LLM system prompt / behavioural spec (5-step recipe)
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Standalone CI: build, typecheck, kind gate
│       └── release.yml             # Release workflow
├── .planning/
│   └── codebase/                   # GSD codebase map documents (this directory)
├── extension-kind-gate.mjs         # Zero-dependency CI gate: OAS retired-primitive scan
├── package.json                    # Cinatra extension manifest + npm metadata
├── tsconfig.json                   # TypeScript config (targets src/ — currently no src/)
├── .npmrc                          # npm/pnpm registry config (note existence; not read)
├── LICENSE                         # Apache-2.0
└── README.md                       # Project overview
```

## Directory Purposes

**`cinatra/`:**
- Purpose: Cinatra platform-consumed artifacts
- Contains: `oas.json` — the complete Cinatra Flow specification (agentspec v26.1.0). Defines the StartNode, context sub-flow (FlowNode), write ApiNode, EndNode, and all control-flow / data-flow edges.
- Key files: `cinatra/oas.json`

**`skills/blog-draft-writer-agent/`:**
- Purpose: LLM behavioural specification auto-discovered by the `/api/llm-bridge` via `agent_id: "blog-draft-writer-agent"`
- Contains: `SKILL.md` — the system prompt. Defines input parsing, draft writing recipe, length conventions, title/excerpt constraints, inline citation rules, error handling, and the return JSON shape.
- Key files: `skills/blog-draft-writer-agent/SKILL.md`

**`.github/workflows/`:**
- Purpose: GitHub Actions CI/CD pipelines
- Contains: `ci.yml` (baseline gate: classify repo, install, typecheck, test, pack dry-run, OAS agent gate); `release.yml` (release automation)
- Key files: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents consumed by gsd-plan-phase and gsd-execute-phase
- Contains: ARCHITECTURE.md, STRUCTURE.md (and any future codebase map documents)
- Generated: Yes (by gsd-map-codebase)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `cinatra/oas.json`: Flow entry point — `start_node.$component_ref: "start"`. This is what the Cinatra runtime executes.
- `extension-kind-gate.mjs`: CI entry point — `main()` is called when invoked directly (`node extension-kind-gate.mjs --package-root .`)

**Configuration:**
- `package.json`: Extension manifest. `cinatra` block defines `packageType: "agent"`, `kind`, `produces`, `agentDependencies`, `riskLevel`, `hasApprovalGates`, `toolAccess`.
- `tsconfig.json`: TypeScript compiler config targeting `src/` (ES2023, ESNext modules, strict). Currently no `src/` exists — applies if TypeScript sources are added.
- `.npmrc`: Registry/auth config. Note: contains credentials — not read.

**Core Logic:**
- `cinatra/oas.json`: All flow logic, LLM call parameters, context slot config, HITL gate wiring
- `skills/blog-draft-writer-agent/SKILL.md`: All LLM generation logic, constraints, and output schema

**CI Gate:**
- `extension-kind-gate.mjs`: Exported pure functions: `validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `validateWorkflowPackageShape`, `findWorkflowSidecars`, `runGate`, `parseArgs`

## Naming Conventions

**Files:**
- Cinatra OAS spec: `cinatra/oas.json` (fixed name, platform convention)
- Skill/prompt files: `skills/<agent-id>/SKILL.md` (UPPERCASE `SKILL.md`, directory matches agent ID)
- Gate script: `extension-kind-gate.mjs` (kebab-case `.mjs` ES module)
- CI workflows: `.github/workflows/<purpose>.yml` (kebab-case)

**Directories:**
- Extension ID matches npm package slug: `blog-draft-writer-agent` (kebab-case)
- Skills directory mirrors agent ID: `skills/blog-draft-writer-agent/`

**Package naming:**
- npm package: `@cinatra-ai/<slug>` where slug is `<name>-agent` for agent extensions
- Workflow packages would use `<name>-workflow` suffix (enforced by gate regex `WORKFLOW_PACKAGE_NAME_RE`)

## Where to Add New Code

**Modify agent behaviour (prompt changes):**
- Edit: `skills/blog-draft-writer-agent/SKILL.md`

**Modify flow topology (add nodes, change edges, update LLM model):**
- Edit: `cinatra/oas.json` — update `nodes`, `control_flow_connections`, `data_flow_connections`, `$referenced_components`

**Add a new input field:**
1. Add to `cinatra/oas.json` → top-level `inputs[]` array
2. Add to `$referenced_components.start.inputs[]`
3. Add a DataFlowEdge from `start` to `write` in `data_flow_connections`
4. Add to `$referenced_components.write.inputs[]`
5. Add `{{ fieldName }}` to the `write` node's `data.user` template string
6. Update `SKILL.md` Inputs section to document the new field

**Add TypeScript utility code (e.g., tests for extension-kind-gate.mjs):**
- Create `src/` directory (currently absent)
- Place `.ts` files under `src/` — `tsconfig.json` already targets `src/**/*.ts`
- Tests: `src/<module>.test.ts` (no test framework configured yet — add to `package.json` scripts)

**Add a new CI check:**
- Edit `.github/workflows/ci.yml` — append steps to the `kind-gates` job

## Special Directories

**`cinatra/`:**
- Purpose: Platform-consumed flow spec
- Generated: Partially (initially generated from Cinatra studio, then maintained manually)
- Committed: Yes

**`skills/`:**
- Purpose: LLM prompt files auto-discovered by the bridge
- Generated: No (hand-authored)
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning and codebase map documents
- Generated: Yes (by GSD tooling)
- Committed: Yes

---

*Structure analysis: 2026-06-09*
