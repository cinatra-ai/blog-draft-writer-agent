// The flow document and the manifest must say the same thing about what this
// agent produces: same extension, same exact type. A flow that declared less
// than its manifest, or nothing at all, left a reader guessing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const oas = JSON.parse(readFileSync(join(root, "cinatra", "oas.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

test("the flow's produces mirrors the manifest's, typed", () => {
  assert.deepEqual(oas.metadata.cinatra.produces, manifest.cinatra.produces);
  for (const entry of oas.metadata.cinatra.produces) {
    assert.equal(typeof entry.objectTypeId, "string");
    assert.ok(entry.objectTypeId.length > 0);
  }
});
