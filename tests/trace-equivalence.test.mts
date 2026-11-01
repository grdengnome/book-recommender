// Offline check (feat/engine-trace): proves the debug trace only watches. Sends eval case 1's
// taste description through the real /api/recommend route with tracing off, then on, and checks
// that every request the engine sends — above all, every body sent to the model — is
// byte-for-byte identical, and so is the response. No network and no API spend: the shared
// harness (tests/support/offlineEngine.ts) answers every request with canned replies.
//
// Also checks: no file is written with tracing off, or on Vercel even with ENGINE_TRACE=1;
// all ten stage keys are present; the model input the trace recorded equals what was sent;
// no key or header ends up in the file, and a leaked key value is redacted.
//
// Usage: node --import ./tests/support/resolve.mts tests/trace-equivalence.test.mts [copy-trace-to.json]
// Run it WITHOUT --env-file: the harness sets fake keys itself and must not see the real ones.
import { readFileSync, copyFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  FAKE_ANTHROPIC_KEY, FAKE_HARDCOVER_TOKEN, ROOT, run, setLeakTitle, traceDir, type Captured,
} from "./support/offlineEngine";

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => results.push([name, ok, detail]);
const isModel = (r: Captured) => r.url.startsWith("https://api.anthropic.com/");

const off = await run({ ENGINE_TRACE: undefined, VERCEL: undefined });
const on = await run({ ENGINE_TRACE: "1", VERCEL: undefined });
const vercel = await run({ ENGINE_TRACE: "1", VERCEL: "1" });

const offModel = off.requests.filter(isModel), onModel = on.requests.filter(isModel);
check("same number of model calls, off vs on", offModel.length === onModel.length, `${offModel.length} vs ${onModel.length}`);
const firstDiff = offModel.findIndex((r, i) => r.url !== onModel[i]?.url || r.body !== onModel[i]?.body);
check("every model input byte-identical, off vs on", firstDiff === -1,
  firstDiff === -1 ? `${offModel.length} bodies, ${offModel.reduce((n, r) => n + (r.body?.length ?? 0), 0)} bytes total` : `first difference at model call ${firstDiff + 1}`);
const allSame = off.requests.length === on.requests.length && off.requests.every((r, i) => r.url === on.requests[i].url && r.body === on.requests[i].body);
check("every catalog request identical too, off vs on", allSame, `${off.requests.length - offModel.length} catalog requests`);
check("response identical, off vs on", off.status === on.status && off.responseText === on.responseText, `HTTP ${off.status}`);
check("no trace file with ENGINE_TRACE off", off.newTraces.length === 0);
check("exactly one trace file with ENGINE_TRACE=1", on.newTraces.length === 1, on.newTraces[0] ?? "");
check("no trace file on Vercel even with ENGINE_TRACE=1", vercel.newTraces.length === 0);

const tracePath = path.join(traceDir, on.newTraces[0]);
const traceText = readFileSync(tracePath, "utf8");
const trace = JSON.parse(traceText);
const expectedStages = ["A_tag_picking", "B_hardcover_pool", "C_model_search_loop", "D_open_library_search", "E_merge", "F_grounding_check", "G_pick_lookup", "W_card_writing", "H_description_check", "I_response"];
check("all ten stage keys present, in order", JSON.stringify(Object.keys(trace.stages)) === JSON.stringify(expectedStages));
check("every stage recorded something", expectedStages.every((k) => trace.stages[k].length > 0),
  expectedStages.map((k) => `${k[0]}:${trace.stages[k].length}`).join(" "));

// The model input the trace recorded is exactly what was sent, call for call.
const tracedModelBodies = expectedStages.flatMap((k) => trace.stages[k]).filter((e: any) => e.kind === "model_call")
  .sort((a: any, b: any) => a.atMs - b.atMs).map((e: any) => JSON.stringify(e.request));
const sentBodies = onModel.map((r) => r.body!);
check("trace's recorded model inputs equal what was sent", tracedModelBodies.length === sentBodies.length && sentBodies.every((b) => tracedModelBodies.includes(b)),
  `${tracedModelBodies.length} recorded`);

const secretsAbsent = ![FAKE_ANTHROPIC_KEY, FAKE_HARDCOVER_TOKEN].some((s) => traceText.includes(s)) && !/x-api-key|authorization|anthropic-version/i.test(traceText);
check("no API key, token, or request header in the trace", secretsAbsent);
const callCosts = expectedStages.flatMap((k) => trace.stages[k]).filter((e: any) => e.kind === "model_call").map((e: any) => e.costUsd);
const summed = Math.round(callCosts.reduce((n: number, c: number) => n + c, 0) * 1e6) / 1e6;
check("every model call priced; total = sum of calls", callCosts.every((c: unknown) => typeof c === "number") && summed === trace.cost.totalUsd,
  `${callCosts.length} calls, total $${trace.cost.totalUsd}`);

// Redaction backstop: if a key value ever reached the data, it's scrubbed from the file.
setLeakTitle(`Leaked ${FAKE_ANTHROPIC_KEY}`);
const leak = await run({ ENGINE_TRACE: "1", VERCEL: undefined });
setLeakTitle(null);
const leakText = readFileSync(path.join(traceDir, leak.newTraces[0]), "utf8");
check("a leaked key value is redacted from the file", !leakText.includes(FAKE_ANTHROPIC_KEY) && leakText.includes("[redacted ANTHROPIC_API_KEY]"));

for (const [name, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
console.log(`trace file: ${(statSync(tracePath).size / 1024).toFixed(0)} KB, ${tracePath}`);
if (process.argv[2]) {
  copyFileSync(tracePath, path.resolve(ROOT, process.argv[2]));
  console.log(`copied to ${process.argv[2]}`);
}
process.exitCode = results.every(([, ok]) => ok) ? 0 : 1;
