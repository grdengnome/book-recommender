// The eval runner: sends a set of eval cases to the live /api/recommend route, one at a time,
// and prints a summary. Costs money (about $0.09 per case), so it's run deliberately.
//
// Cases live in evals/cases/<set>.json (see evals/README.md for the format). Settings:
//   SET=legacy-v0             which case set to run (default legacy-v0)
//   CASE_IDS=case-1,case-5    run only these cases, in this order
//   TAG_PREFIX=gateway1101    prefix for each request's eval tag, so its logs and traces are separable
//   OUT=my-run.json           results file name in evals/results/ (default <set>-<tag prefix or "run">.json)
//   PORT=3000                 where the dev server is running
//   MAX_USD=3                 spend limit: stop after the case that takes the run's total past this
//                             (default 5; needs ENGINE_TRACE=1 on the server, which is where costs come from)
//   SMOKE=2                   smoke test (decision 3.14): run only the first N cases, then stop so
//                             their time and cost can be checked before the rest
//   RESUME=1                  continue a run: keep the results already in the output file and run
//                             only the cases not in it (e.g. after a smoke test, same OUT/TAG_PREFIX)
//
// Start the dev server first, with tracing on so time, cost and models are in the summary:
//   ENGINE_TRACE=1 npm run dev
// then, in a second terminal:
//   SET=legacy-v0 CASE_IDS=case-1 TAG_PREFIX=check node evals/run.mjs
import fs from "fs";

const SET = process.env.SET || "legacy-v0";
const PORT = process.env.PORT || 3000;
const API_URL = `http://localhost:${PORT}/api/recommend`;
const TAG_PREFIX = process.env.TAG_PREFIX ? `${process.env.TAG_PREFIX}-` : "";
const TRACE_DIR = new URL("../.local/traces/", import.meta.url);

const setPath = new URL(`./cases/${SET}.json`, import.meta.url);
if (!fs.existsSync(setPath)) {
  const sets = fs.readdirSync(new URL("./cases/", import.meta.url)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  throw new Error(`No case set "${SET}". Available: ${sets.join(", ")}`);
}
const { cases } = JSON.parse(fs.readFileSync(setPath, "utf8"));

const wanted = process.env.CASE_IDS ? process.env.CASE_IDS.split(",").map((id) => id.trim()).filter(Boolean) : null;
const unknown = (wanted ?? []).filter((id) => !cases.some((c) => c.id === id));
if (unknown.length) throw new Error(`Unknown CASE_IDS for set ${SET}: ${unknown.join(", ")}`);
const toRun = wanted ? wanted.map((id) => cases.find((c) => c.id === id)) : cases;

// The newest trace written for this eval tag, if tracing was on: { totalMs, totalUsd, models }.
function readTrace(evalTag) {
  try {
    const name = fs.readdirSync(TRACE_DIR).filter((f) => f.includes(`-${evalTag}-`)).sort().pop();
    if (!name) return null;
    const trace = JSON.parse(fs.readFileSync(new URL(name, TRACE_DIR), "utf8"));
    return { totalMs: trace.totalMs, totalUsd: trace.cost?.totalUsd ?? null, models: Object.keys(trace.cost?.byModel ?? {}) };
  } catch {
    return null;
  }
}

async function runCase(c) {
  const evalTag = `${TAG_PREFIX}${c.id}`;
  const start = performance.now();
  let res, data;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // A case holds a taste profile (decision 2.24) or a legacy paragraph.
      body: JSON.stringify(c.profile ? { profile: c.profile, evalTag } : { tasteDescription: c.tasteDescription, evalTag }),
    });
    data = await res.json();
  } catch (err) {
    throw new Error(`Couldn't reach ${API_URL}. Is the dev server running? (${err.message})`);
  }
  const driverMs = Math.round(performance.now() - start);
  const trace = readTrace(evalTag);
  if (!res.ok) {
    console.error(`[${c.id}] ERROR`, data);
    return { id: c.id, label: c.label, error: data, driverMs, trace };
  }
  console.log(`[${c.id}] done — ${data.picks.map((p) => p.title).join(" | ")}`);
  return { id: c.id, label: c.label, picks: data.picks, driverMs, trace };
}

fs.mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
const outName = process.env.OUT || `${SET}-${process.env.TAG_PREFIX || "run"}.json`;
const outPath = new URL(`./results/${outName}`, import.meta.url);

const MAX_USD = Number(process.env.MAX_USD ?? 5);
const SMOKE = process.env.SMOKE ? Number(process.env.SMOKE) : null;
if (!(MAX_USD > 0)) throw new Error("MAX_USD must be a positive number of dollars");
if (SMOKE !== null && !(Number.isInteger(SMOKE) && SMOKE > 0)) throw new Error("SMOKE must be a whole number of cases, e.g. SMOKE=2");

const results = [];
if (process.env.RESUME && fs.existsSync(outPath)) {
  const previous = JSON.parse(fs.readFileSync(outPath, "utf8"));
  if (previous.set !== SET) throw new Error(`${outName} is from set ${previous.set}, not ${SET}`);
  results.push(...previous.results.filter((r) => toRun.some((c) => c.id === r.id) && !r.error));
  if (results.length) console.log(`Resuming: keeping ${results.length} finished case(s) from ${outName}`);
}
const spent = () => results.reduce((sum, r) => sum + (typeof r.trace?.totalUsd === "number" ? r.trace.totalUsd : 0), 0);
const pending = toRun.filter((c) => !results.some((r) => r.id === c.id)).slice(0, SMOKE ?? Infinity);
let stoppedForSpend = false;
for (const c of pending) {
  // Sequential on purpose: keeps the module-level log tag in searchBooks.ts unambiguous,
  // so no two cases' search_books calls are ever in flight at once.
  results.push(await runCase(c));
  // Written after every case so a crash mid-run doesn't lose completed results.
  fs.writeFileSync(outPath, JSON.stringify({ set: SET, ranAt: new Date().toISOString(), results }, null, 2));
  const last = results[results.length - 1];
  if (typeof last.trace?.totalUsd !== "number") console.warn(`[${c.id}] no cost recorded: start the server with ENGINE_TRACE=1, or the spend limit can't work`);
  if (spent() >= MAX_USD && c !== pending[pending.length - 1]) {
    stoppedForSpend = true;
    console.warn(`\nSpend limit reached: $${spent().toFixed(2)} of MAX_USD=$${MAX_USD}. Stopping. Continue with RESUME=1 (and a higher MAX_USD) if that's intended.`);
    break;
  }
}

// Summary: no reader data and no keys, safe to paste into a PR or chat.
const secs = (ms) => (typeof ms === "number" ? `${(ms / 1000).toFixed(1)}s` : "–");
console.log(`\nSummary (set ${SET})`);
console.log("case      | status | picks | server time | driver time | cost   | models");
for (const r of results) {
  const status = r.error ? "ERROR" : "ok";
  const picks = r.picks ? r.picks.length : 0;
  const cost = typeof r.trace?.totalUsd === "number" ? `$${r.trace.totalUsd.toFixed(3)}` : "–";
  console.log(`${r.id.padEnd(9)} | ${status.padEnd(6)} | ${String(picks).padEnd(5)} | ${secs(r.trace?.totalMs).padEnd(11)} | ${secs(r.driverMs).padEnd(11)} | ${cost.padEnd(6)} | ${(r.trace?.models ?? []).join(", ")}`);
}
const times = results.map((r) => r.trace?.totalMs ?? r.driverMs).sort((a, b) => a - b);
const mid = Math.floor(times.length / 2);
const median = times.length ? (times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2) : null;
const costs = results.map((r) => r.trace?.totalUsd).filter((x) => typeof x === "number");
const ok = results.filter((r) => !r.error && r.picks?.length === 3).length;
console.log(
  `\n${ok}/${results.length} cases returned 3 picks · median time ${secs(median)}` +
    (costs.length ? ` · total cost $${costs.reduce((a, b) => a + b, 0).toFixed(3)}` : " · cost: start the dev server with ENGINE_TRACE=1 to see it"),
);
console.log(`Wrote evals/results/${outName}`);
const left = toRun.filter((c) => !results.some((r) => r.id === c.id)).length;
if (SMOKE !== null && !stoppedForSpend && left) {
  console.log(`\nSmoke test done (${SMOKE} case(s)); ${left} left. If the time and cost above look right, run the same command without SMOKE and with RESUME=1 to continue.`);
}
