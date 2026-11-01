// Golden-request check: proves an engine refactor changed nothing the outside world can see.
// Runs eval case 1 through the real /api/recommend route offline (tests/support/offlineEngine.ts)
// and compares every outgoing request (address, method, headers, whether it has a timeout, body)
// and the final response with the saved copy in tests/golden/engine-requests.json.
//
// Requests are compared as a sorted set rather than in send order: the engine runs several calls
// at once, and a refactor may legitimately change which parallel call leaves first.
//
// If a change is MEANT to alter what the engine sends (a prompt edit, a new model), refresh the
// copy deliberately and review its diff in the pull request:
//   UPDATE_GOLDEN=1 npm test
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROOT, run } from "./support/offlineEngine";

const GOLDEN_PATH = path.join(ROOT, "tests", "golden", "engine-requests.json");

const parse = (text: string | null) => {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

test("engine sends exactly the saved requests and returns the saved response", async () => {
  const result = await run({ ENGINE_TRACE: undefined, VERCEL: undefined });
  const requests = result.requests
    .map((r) => ({ url: r.url, method: r.method, headers: r.headers, hasTimeout: r.hasTimeout, body: parse(r.body) }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const actual = JSON.stringify({ requests, response: { status: result.status, body: parse(result.responseText) } }, null, 2) + "\n";

  if (process.env.UPDATE_GOLDEN === "1") {
    mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
    writeFileSync(GOLDEN_PATH, actual);
    return;
  }
  assert.ok(existsSync(GOLDEN_PATH), "No saved copy yet: run UPDATE_GOLDEN=1 npm test");
  assert.equal(actual, readFileSync(GOLDEN_PATH, "utf8"), "The engine's requests or response changed. If intended, run UPDATE_GOLDEN=1 npm test and review the diff.");
});
