// Pins the draft writer's ONE person-visible field. Before this conversion the
// `idea` input was an object of title/summary/outline and the form dissected it
// into sub-fields; the plan gives the writer one plain-text idea and nothing
// else a person sees, with only the runtime plumbing hidden behind it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const oas = JSON.parse(readFileSync(join(root, "cinatra", "oas.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const start = oas.$referenced_components.start;
const startIdea = start.inputs.find((i) => i.title === "idea");

test("the idea input is ONE plain-text field, not an object with sub-fields", () => {
  assert.equal(startIdea.type, "string");
  assert.equal(startIdea.json_schema?.properties, undefined);
  assert.equal(startIdea.json_schema?.required, undefined);
  assert.equal(startIdea.json_schema?.["x-object-text-property"], undefined);
  assert.equal(startIdea.json_schema["x-multiline"], true);
  assert.equal(typeof startIdea.json_schema["x-placeholder"], "string");
});

test("the top-level flow input agrees with the start node", () => {
  const flowIdea = oas.inputs.find((i) => i.title === "idea");
  assert.equal(flowIdea.type, "string");
  assert.equal(flowIdea.json_schema?.properties, undefined);
});

test("a missing idea parks the run: idea is required and carries NO default", () => {
  assert.deepEqual(start.metadata.cinatra.required, ["idea"]);
  assert.equal(
    Object.prototype.hasOwnProperty.call(startIdea, "default"),
    false,
    "a defaulted idea would let a run start with no idea at all",
  );
});

test("everything but the idea is hidden — the form shows one field", () => {
  const hidden = start.metadata.cinatra.hidden;
  const visible = start.inputs
    .map((i) => i.title)
    .filter((t) => !hidden.includes(t));
  assert.deepEqual(visible, ["idea"]);
});

test("the prompt takes the idea as plain text and never dissects it", () => {
  const system = oas.$referenced_components.write.data.system;
  for (const dissected of ["idea.title", "idea.summary", "idea.outline"]) {
    assert.equal(
      system.includes(dissected),
      false,
      `the prompt must not read ${dissected} — the idea arrives as one piece of plain text`,
    );
  }
  assert.ok(/plain text/i.test(system), "the prompt must say the idea is plain text");
  assert.ok(
    /Title: /.test(system),
    "the prompt must know the idea generator's `Title: ` first line",
  );
});

test("the post binding and the produces entry are typed", () => {
  const content = oas.$referenced_components.end.outputs.find((o) => o.title === "content");
  assert.equal(content.cinatra.artifact.objectTypeId, "@cinatra-ai/blog-post-artifact:post");
  assert.deepEqual(manifest.cinatra.produces, [
    {
      extension: "@cinatra-ai/blog-post-artifact",
      objectTypeId: "@cinatra-ai/blog-post-artifact:post",
    },
  ]);
});

test("the writer declares the idea kind it READS as a dependency edge", () => {
  const names = manifest.cinatra.dependencies
    .filter((d) => d.kind === "artifact")
    .map((d) => d.packageName)
    .sort();
  assert.deepEqual(names, [
    "@cinatra-ai/blog-idea-artifact",
    "@cinatra-ai/blog-post-artifact",
  ]);
});
