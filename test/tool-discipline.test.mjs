// A text leaf answers from its inputs. Its bridge node declares an empty
// toolbox list, and its own instructions say so — the declaration alone is not
// enough, and instructions alone would forbid tools the turn still carries.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const oas = JSON.parse(
  readFileSync(join(__dirname, "..", "cinatra", "oas.json"), "utf8"),
);

function bridgeNodes(node, depth = 0, out = []) {
  if (!node || typeof node !== "object" || depth > 8) return out;
  const refs = node.$referenced_components;
  if (refs && typeof refs === "object") {
    for (const comp of Object.values(refs)) {
      if (!comp || typeof comp !== "object") continue;
      if (
        comp.component_type === "ApiNode" &&
        typeof comp.url === "string" &&
        comp.url.includes("/api/llm-bridge")
      ) {
        out.push(comp);
      }
      bridgeNodes(comp, depth + 1, out);
    }
  }
  return out;
}

const bridges = bridgeNodes(oas);

test("every bridge node declares an explicit, empty toolbox list", () => {
  assert.ok(bridges.length > 0);
  for (const node of bridges) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(node.data || {}, "toolbox_ids"),
      "an omitted list makes the host attach its default toolbox to the turn",
    );
    assert.deepEqual(node.data.toolbox_ids, []);
  }
});

test("and says so in its own instructions", () => {
  const disclaimer =
    /NO MCP primitives|MUST NOT call any (MCP|tool)|Never call any tool|Do NOT call any (MCP )?tool|Do not call any tool|no MCP primitives/i;
  for (const node of bridges) {
    assert.match(node.data.system, disclaimer);
  }
});
