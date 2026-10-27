// The brand-voice slot of the draft writer (cinatra-ai/cinatra#4314, for the
// one brand-voice pick of cinatra-ai/cinatra#3035).
//
// The blog pipeline asks a person ONCE for the brand voice, as a list of the
// organisation's stored brand-voice artifacts with exactly one required pick,
// and hands that pick down to every step that declares a brand-voice slot. The
// host does that only for a child slot it can satisfy:
//
//   - the install check (cinatra `src/lib/extension-host-compat.ts`,
//     `checkOneCarrier`) refuses a line unless the parent's slot accepts every
//     kind the child's slot accepts, the parent's bounds sit inside the child's,
//     and both resolve the same way;
//   - the loader (cinatra `docker/wayflow/context_subflow_injection.py`) hands a
//     pick only to a slot the definition DECLARES and does not carry an
//     author-placed resolution subflow for, and wires it to the input named
//     `<slotId>ContextSlotBindings` when the definition declares more than one
//     slot (a bare `contextSlotBindings` input is then refused).
//
// Before this change the writer's only slot, `draftContext`, mixed brand voice
// with blog ideas and took up to five picks, so no single brand-voice pick could
// satisfy it. These tests read the SHIPPED flow file and manifest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const oas = JSON.parse(readFileSync(join(root, "cinatra", "oas.json"), "utf8"));
const refs = oas.$referenced_components;
const slots = oas.metadata?.cinatra?.contextSlots ?? [];

const BRAND_VOICE = "@cinatra-ai/brand-voice-artifact";
const PACKAGE = "@cinatra-ai/blog-draft-writer-agent";
const brandVoiceSlot = () => slots.find((s) => s.slotId === "brandVoice");

// The pick the blog pipeline makes: one required brand-voice artifact.
const PIPELINE_PICK = {
  slotId: "brandVoice",
  acceptedArtifactExtensions: [BRAND_VOICE],
  selectionMode: "interactive",
  resolutionMode: "override",
  minItems: 1,
  maxItems: 1,
};

// The three rules of the host's install check, in the host's own terms.
function installConflicts(parent, child) {
  const conflicts = [];
  const accepted = new Set(parent.acceptedArtifactExtensions);
  const unaccepted = child.acceptedArtifactExtensions.filter((e) => !accepted.has(e));
  if (unaccepted.length > 0) conflicts.push(`the child accepts ${unaccepted.join(", ")}`);
  const bounds = (s) => ({ min: s.minItems ?? 0, max: s.maxItems ?? Infinity });
  const p = bounds(parent);
  const c = bounds(child);
  if (p.min < c.min || p.max > c.max) conflicts.push("the pick falls outside the child's bounds");
  if (parent.resolutionMode !== child.resolutionMode) conflicts.push("the resolution modes differ");
  if (child.readableOnly === true && parent.readableOnly !== true) conflicts.push("read-only slot");
  return conflicts;
}

test("the writer declares a brand-voice slot of its own: brand voice only, at most one pick", () => {
  const slot = brandVoiceSlot();
  assert.ok(slot, "no context slot `brandVoice` is declared");
  assert.deepEqual(slot.acceptedArtifactExtensions, [BRAND_VOICE]);
  assert.equal(slot.selectionMode, "interactive");
  assert.equal(slot.resolutionMode, "override", "one brand voice, never a stack of them");
  assert.equal(slot.maxItems, 1);
  // Optional when the writer runs on its own, so a person with no stored brand
  // voice can still draft; the pipeline's own pick is the required one.
  assert.equal(slot.minItems, 0);
});

test("brand voice is asked for once: no other slot of the writer accepts it", () => {
  const others = slots.filter(
    (s) => s.slotId !== "brandVoice" && s.acceptedArtifactExtensions.includes(BRAND_VOICE),
  );
  assert.deepEqual(
    others.map((s) => s.slotId),
    [],
    "a second slot that offers brand voice would ask for it twice",
  );
});

test("the pipeline's single required brand-voice pick passes the host's install check for this slot", () => {
  const slot = brandVoiceSlot();
  assert.ok(slot, "no context slot `brandVoice` is declared");
  assert.deepEqual(installConflicts(PIPELINE_PICK, slot), []);
});

test("the brand-voice slot is declared only, so a parent can satisfy it", () => {
  // An author-placed subflow for the slot is a marker the loader never hands a
  // parent's pick to: the writer would pause again inside the pipeline.
  const marker = Object.values(refs).filter(
    (c) =>
      typeof c?.metadata?.cinatra?.purpose === "string" &&
      c.metadata.cinatra.purpose.endsWith("-context-resolution-for-brandVoice"),
  );
  assert.deepEqual(marker.map((c) => c.id), []);
  assert.equal(refs["context-brandVoice-subflow"], undefined);
  assert.equal(refs["context_brandVoice"], undefined);
  assert.equal(oas.metadata.cinatra.packageName, PACKAGE, "the loader finds the slot's owner by package");
});

test("the read step takes the brand-voice pick by the slot's own input name, as text", () => {
  // The loader feeds the pick to the step that takes `brandVoiceContextSlotBindings`
  // (cinatra `docker/wayflow/context_subflow_injection.py`, `_consumer_edges_for_slot`).
  // When a parent satisfies the slot, `_ensure_input` gives this flow's start node
  // that input as a string, and the typed graph refuses an edge from a string into
  // an array, so the read step takes it as a string. Run alone, the injected list
  // step's array is cast to that string.
  const input = (refs.read_brand_voice?.inputs ?? []).find((i) => i.title === "brandVoiceContextSlotBindings");
  assert.ok(input, "the read step has no brand-voice input");
  assert.equal(input.type, "string");
  assert.equal(input.json_schema, undefined, "a string input carries no array schema");
  const takers = Object.entries(refs)
    .filter(([, c]) => c?.component_type !== "Flow")
    .filter(([, c]) => (c?.inputs ?? []).some((i) => i.title === "brandVoiceContextSlotBindings"))
    .map(([id]) => id);
  assert.deepEqual(takers, ["read_brand_voice"], "only the read step takes the pick");
  // Two slots: the loader refuses a bare `contextSlotBindings` input.
  for (const [id, c] of Object.entries(refs)) {
    if (c?.component_type === "Flow") continue;
    const bare = (c?.inputs ?? []).some((i) => i.title === "contextSlotBindings");
    assert.equal(bare, false, `${id} still takes the bare contextSlotBindings input`);
  }
});

test("the idea context still reaches the writing step from its own resolution step", () => {
  const edge = oas.data_flow_connections.find(
    (e) =>
      e.source_node.$component_ref === "context_draftContext" &&
      e.destination_node.$component_ref === "write",
  );
  assert.ok(edge, "the draftContext resolution no longer feeds the write step");
  assert.equal(edge.source_output, "contextSlotBindings");
  assert.equal(edge.destination_input, "draftContextContextSlotBindings");
  assert.match(refs.write.data.user, /\{\{ draftContextContextSlotBindings \}\}/);
});

test("the read step reads the picked brand voice's text through this pack's declared tool", () => {
  // The pick names a stored artifact and carries none of its text, and reading an
  // artifact's content is this pack's own job: the host's passthrough runs the
  // tool this pack declares, `brand_voice_text`, with the content read bound to
  // the run (cinatra `src/lib/extension-scoped-tools.ts`).
  const read = refs.read_brand_voice;
  assert.ok(read, "the flow has no read step");
  assert.equal(read.component_type, "ApiNode");
  assert.equal(read.url, "{{CINATRA_BASE_URL}}/api/agents/passthrough");
  assert.equal(read.http_method, "POST");
  assert.deepEqual(read.data, {
    tool: "extension_tool",
    input: { name: "brand_voice_text", input: { bindings: "{{ brandVoiceContextSlotBindings }}" } },
    agent_run_id: "{{ cinatra_run_id }}",
  });
  const out = read.outputs.find((o) => o.title === "brandVoiceText");
  assert.ok(out, "the read step gives no brandVoiceText");
  assert.equal(out.type, "string");
  assert.ok(
    oas.data_flow_connections.some(
      (e) =>
        e.source_node.$component_ref === "start" &&
        e.source_output === "cinatra_run_id" &&
        e.destination_node.$component_ref === "read_brand_voice" &&
        e.destination_input === "cinatra_run_id",
    ),
    "the read step is not given the run",
  );
});

test("the writing step writes from the brand voice's text, after it is read", () => {
  const titles = refs.write.inputs.map((i) => i.title);
  assert.ok(!titles.includes("brandVoiceContextSlotBindings"), "the write step still takes the references");
  const input = refs.write.inputs.find((i) => i.title === "brandVoiceText");
  assert.ok(input, "the write step takes no brand-voice text");
  assert.equal(input.type, "string");
  const edges = oas.data_flow_connections.filter((e) => e.destination_node.$component_ref === "write" && e.destination_input === "brandVoiceText");
  assert.deepEqual(
    edges.map((e) => [e.source_node.$component_ref, e.source_output]),
    [["read_brand_voice", "brandVoiceText"]],
  );
  assert.match(refs.write.data.user, /\{\{ brandVoiceText \}\}/);
  assert.doesNotMatch(refs.write.data.user + refs.write.data.system, /brandVoiceContextSlotBindings/);
  const into = (id) => oas.control_flow_connections.filter((e) => e.to_node.$component_ref === id).map((e) => e.from_node.$component_ref);
  assert.deepEqual(into("write"), ["read_brand_voice"], "the write step runs right after the read");
  assert.deepEqual(into("read_brand_voice"), ["context_draftContext"], "the read runs after the step's own context");
});
