// Full eval-set re-run for the grounded-picks enforcement change (2026-09-20,
// branch feat/enforce-grounded-picks). Same 11 cases and same sequential, evalTag-per-case
// method as scratchpad/run-eval.mjs — the CASES array is read out of that file rather than
// retyped, so the inputs are guaranteed identical to prior runs.
//
// Additionally parses the dev server's console log (route.ts's grounding-check output and
// mergeCandidatePools stats) per case, to record: attempt count, each final pick's source
// (openlibrary / hardcover), any grounding-check failure detail, and pool sizes.
//
// Usage: dev server must be running with its stdout redirected to DEV_LOG.
//   DEV_LOG=/path/to/dev.log node scratchpad/run-eval-grounded.mjs
// Optional: CASE_IDS=case-3,case-4 (subset, run in that order), TAG_PREFIX=groundedfix
// (evalTag prefix, keeps query-log entries separable from other runs), OUT=<file name in
// scratchpad/> (results file; default eval-run-grounded-2026-09-20.json).
import fs from "fs";

const PORT = process.env.PORT || 3000;
const API_URL = `http://localhost:${PORT}/api/recommend`;
const DEV_LOG = process.env.DEV_LOG;
if (!DEV_LOG) throw new Error("DEV_LOG (path to the dev server's redirected stdout) is required");

const src = fs.readFileSync(new URL("./run-eval.mjs", import.meta.url), "utf8");
const CASES = eval(src.match(/const CASES = (\[[\s\S]*?\n\]);/)[1]);
if (CASES.length !== 11) throw new Error(`expected 11 cases, got ${CASES.length}`);
const CASE_IDS = process.env.CASE_IDS ? process.env.CASE_IDS.split(",") : CASES.map((c) => c.id);
const RUN_CASES = CASE_IDS.map((id) => CASES.find((c) => c.id === id) ?? (() => { throw new Error(`unknown case ${id}`); })());
const TAG_PREFIX = process.env.TAG_PREFIX || "grounded";

const PICK_LINE = /^  "(.*)" — (.*): (openlibrary\+hardcover|hardcover\+openlibrary|openlibrary|hardcover|NONE \(not in any retrieved pool\))$/;

// Turns one request's slice of dev-server log lines into structured attempt records.
function parseAttempts(lines) {
  const attempts = [];
  let cur = null;
  let mergesThisAttempt = [];
  for (const line of lines) {
    let m;
    if ((m = line.match(/^mergeCandidatePools: .*merged total=(\d+)/))) {
      mergesThisAttempt.push(Number(m[1]));
    } else if ((m = line.match(/^recommend: pick sources \(attempt (\d+)\/(\d+)\)/))) {
      cur = { attempt: Number(m[1]), outcome: "grounded", picks: [], searchRounds: mergesThisAttempt.length, mergedPoolSizes: mergesThisAttempt };
      attempts.push(cur);
      mergesThisAttempt = [];
    } else if ((m = line.match(/^recommend: GROUNDING CHECK FAILED \(attempt (\d+)\/(\d+)\) — (.*)$/))) {
      cur = { attempt: Number(m[1]), outcome: /could not be parsed/.test(m[3]) ? "unparseable" : "ungrounded", picks: [], searchRounds: mergesThisAttempt.length, mergedPoolSizes: mergesThisAttempt };
      attempts.push(cur);
      mergesThisAttempt = [];
    } else if ((m = line.match(PICK_LINE)) && cur) {
      cur.picks.push({ title: m[1], author: m[2], source: m[3] });
    }
  }
  return attempts;
}

const outPath = new URL(`./${process.env.OUT || "eval-run-grounded-2026-09-20.json"}`, import.meta.url);
const results = [];
const runStart = Date.now();

for (const c of RUN_CASES) {
  const before = fs.readFileSync(DEV_LOG, "utf8").split("\n").length;
  const t0 = Date.now();
  let status, body, fetchError;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tasteDescription: c.tasteDescription, evalTag: `${TAG_PREFIX}-${c.id}` }),
    });
    status = res.status;
    body = await res.json();
  } catch (err) {
    fetchError = String(err);
  }
  const seconds = Math.round((Date.now() - t0) / 1000);
  await new Promise((r) => setTimeout(r, 700)); // let the server flush its log lines

  const logLines = fs.readFileSync(DEV_LOG, "utf8").split("\n").slice(before - 1)
    .filter((l) => /^mergeCandidatePools:|^recommend:|^  ".*: |Hardcover|POST \/api\/recommend/.test(l));
  const attempts = parseAttempts(logLines);

  const result = {
    id: c.id, label: c.label, tasteDescription: c.tasteDescription,
    httpStatus: status ?? null, seconds, fetchError: fetchError ?? null,
    attemptCount: attempts.length,
    attempts,
    finalOutcome: status === 200 ? "returned" : status === 502 ? "clean-502" : "error",
    recommendations: status === 200 ? body.recommendations : null,
    finalRoundUsage: status === 200 ? body?.raw?.usage ?? null : null, // last API round only, NOT a per-request total
    errorBody: status === 200 ? null : body ?? null,
    logLines,
  };
  results.push(result);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2)); // write after every case
  const last = attempts[attempts.length - 1];
  console.log(`[${c.id}] HTTP ${status} ${seconds}s attempts=${attempts.length} ` +
    (last ? last.picks.map((p) => `${p.title} <${p.source}>`).join(" | ") : "(no attempt records parsed)"));
}

console.log(`\nDONE total ${Math.round((Date.now() - runStart) / 1000)}s — wrote scratchpad/${process.env.OUT || "eval-run-grounded-2026-09-20.json"}`);
