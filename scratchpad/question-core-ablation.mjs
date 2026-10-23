// Question-value (ablation) test driver (2026-10-23, branch experiment/question-core). For each
// case in ABLATION (question-core-cases.mjs): two runs with all answers, then one run per
// removed answer, through the live /api/recommend route. Needs the dev server with
// ENGINE_TRACE=1; each request's trace is tagged qc1023-<case>-<variant>. Spend is read from
// the traces after each run; a run that could push the total past SPEND_CAP isn't started.
// Writes experiments/2026-10-23-question-core/ablation-runs.json.
// Usage: node scratchpad/question-core-ablation.mjs   (optional CASE_IDS=case-1,case-5)
import fs from "fs";
import { CASES, ABLATION, toTasteDescription } from "./question-core-cases.mjs";

const PORT = process.env.PORT || 3000;
const SPEND_CAP = Number(process.env.SPEND_CAP || 2.5);
const TRACES = new URL("./traces/", import.meta.url).pathname;
const OUT_DIR = new URL("./experiments/2026-10-23-question-core/", import.meta.url).pathname;
fs.mkdirSync(OUT_DIR, { recursive: true });

const without = (answers, variant) => {
  const a = { ...answers };
  for (const field of variant.split("+")) delete a[field];
  return a;
};

// Spend so far: every qc1023 trace on disk.
const spent = () => fs.readdirSync(TRACES).filter((f) => f.includes("-qc1023-"))
  .reduce((n, f) => n + JSON.parse(fs.readFileSync(TRACES + f, "utf8")).cost.totalUsd, 0);

const ids = process.env.CASE_IDS ? process.env.CASE_IDS.split(",") : Object.keys(ABLATION);
const runs = [];
let maxCost = 0.11; // most expensive single run seen so far (start from the Oct 22 maximum)
for (const id of ids) {
  const answers = CASES.find((c) => c.id === id);
  for (const variant of ["full-a", "full-b", ...ABLATION[id].map((v) => `minus-${v}`)]) {
    const before = spent();
    if (before + maxCost > SPEND_CAP) {
      console.log(`STOP: spent $${before.toFixed(3)}; the next run could pass $${SPEND_CAP}`);
      fs.writeFileSync(OUT_DIR + "ablation-runs.json", JSON.stringify(runs, null, 1));
      process.exit(0);
    }
    const input = variant.startsWith("minus-") ? without(answers, variant.slice(6)) : answers;
    const tasteDescription = toTasteDescription(input);
    const evalTag = `qc1023-${id}-${variant}`;
    const start = Date.now();
    const res = await fetch(`http://localhost:${PORT}/api/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tasteDescription, evalTag }),
    });
    const body = await res.json();
    const cost = spent() - before;
    maxCost = Math.max(maxCost, cost);
    runs.push({ id, variant, evalTag, tasteDescription, status: res.status, ms: Date.now() - start, cost, picks: body.picks ?? null, error: body.error ?? null });
    console.log(`[${evalTag}] HTTP ${res.status} ${((Date.now() - start) / 1000).toFixed(1)}s $${cost.toFixed(3)} total $${spent().toFixed(3)} | ${body.picks?.map((p) => p.title).join(" | ") ?? body.error?.code}`);
    fs.writeFileSync(OUT_DIR + "ablation-runs.json", JSON.stringify(runs, null, 1));
  }
}
console.log(`DONE ${runs.length} runs, total $${spent().toFixed(3)}`);
