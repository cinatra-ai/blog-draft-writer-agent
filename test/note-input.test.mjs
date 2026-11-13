// The optional, hidden `note` input of the blog draft writer
// (cinatra-ai/cinatra#4264).
//
// A caller that wants the draft written again with a reviewer's words (a note
// on what to change) hands those words to the writer as `note`. The input is
// plain plumbing: a canonical string, empty by default, hidden from the form,
// wired from the start node to the writing node and to no one else. When it
// carries words the writer treats them as revision instructions; when it is
// empty the writer drafts as before. These tests read the SHIPPED flow file and
// manifest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const oas = JSON.parse(readFileSync(join(root, "cinatra", "oas.json"), "utf8"));
const readme = readFileSync(join(root, "README.md"), "utf8");
const refs = oas.$referenced_components;
const start = refs.start;
const write = refs.write;

const CANONICAL = { title: "note", type: "string", default: "" };
const fromStart = (output) =>
  oas.data_flow_connections.filter(
    (c) => c.source_node.$component_ref === "start" && c.source_output === output,
  );
const into = (node, input) =>
  oas.data_flow_connections.filter(
    (c) => c.destination_node.$component_ref === node && c.destination_input === input,
  );

test("the flow and its start node both declare `note` as a canonical, empty-by-default string", () => {
  for (const [where, inputs] of [
    ["flow", oas.inputs],
    ["start node", start.inputs],
  ]) {
    const found = inputs.filter((i) => i.title === "note");
    assert.equal(found.length, 1, `${where} declares note exactly once`);
    // Canonical: the title, the string type and the empty default - no schema, no format.
    assert.deepEqual(found[0], CANONICAL, `${where} input is the canonical string`);
  }
});

test("`note` is hidden and never required, so the form still shows the idea alone", () => {
  assert.ok(start.metadata.cinatra.hidden.includes("note"), "note is hidden");
  assert.ok(!start.metadata.cinatra.required.includes("note"), "note is not required");
  assert.deepEqual(start.metadata.cinatra.required, ["idea"]);
  const visible = start.inputs
    .map((i) => i.title)
    .filter((t) => !start.metadata.cinatra.hidden.includes(t));
  assert.deepEqual(visible, ["idea"]);
});

test("the start node's `note` has one consumer: the writing node's `note`", () => {
  const edges = fromStart("note");
  assert.equal(edges.length, 1, "no fan-out from start.note");
  assert.equal(edges[0].destination_node.$component_ref, "write");
  assert.equal(edges[0].destination_input, "note");
  assert.equal(into("write", "note").length, 1, "one edge into write.note");
});

test("the writing node takes `note` as a string with an empty default and reads it in its turn", () => {
  const port = write.inputs.filter((i) => i.title === "note");
  assert.equal(port.length, 1);
  assert.equal(port[0].type, "string");
  assert.equal(port[0].default, "");
  assert.match(write.data.user, /\{\{ note \}\}/);
});

test("a given note is read as revision instructions, an empty one changes nothing", () => {
  const system = write.data.system;
  assert.match(system, /- `note: string`/, "the inputs list names `note`");
  assert.match(system, /revision instructions/i);
  assert.match(system, /When `note` is not empty/);
  assert.match(system, /When `note` is empty/);
  // The note never turns into output text: it steers the draft, it is not
  // content, and it is no reason to leave the output contract.
  assert.match(system, /never (quote|copy|reproduce)[^.\n]*`note`|`note`[^.\n]*never (quote|copy|reproduce)/i);
});

test("the manifest and the README say the note is an optional, hidden input", () => {
  assert.match(pkg.description, /optional/i);
  assert.match(pkg.description, /`note`|note input/i);
  assert.match(readme, /`note`/);
});
