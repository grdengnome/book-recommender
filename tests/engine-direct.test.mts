// The engine can be called directly, without a web request (decision 14.5): recommend() in
// lib/engine/recommend.ts returns the same answer the /api/recommend route sends. Runs offline
// with the shared harness's canned catalog and model replies.
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { CASE_1, ROOT, seedRandom } from "./support/offlineEngine";
import { recommend } from "@/lib/engine/recommend";

test("recommend() returns the same answer as the web route, with no web request", async () => {
  const golden = JSON.parse(readFileSync(path.join(ROOT, "tests", "golden", "engine-requests.json"), "utf8"));
  seedRandom(20261017);
  const realLog = console.log, realError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    const result = await recommend({ tasteDescription: CASE_1, evalTag: "trace-check-case-1" });
    assert.equal(result.status, golden.response.status);
    assert.deepEqual(result.body, golden.response.body);
  } finally {
    console.log = realLog;
    console.error = realError;
  }
});
