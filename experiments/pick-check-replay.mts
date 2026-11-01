// Replays the step-3 pick check on the FROZEN inputs in pick-check-replay-inputs.json
// (built by pick-check-build-replay-inputs.mts), N runs per case, and scores each pick
// against the expected verdict. No lookups happen here — only the checker call varies.
// Usage: node --env-file=.env.local scratchpad/pick-check-replay.mts [runs] [label]
//   REPLAY_MODEL=<model id>  swap the checker model in the outgoing request body only
//                            (the CHECK_MODEL constant in lib/ is left untouched)
//   RESCORE=<label>          re-score a saved pick-check-replay-<label>.json, no API calls
//   INPUTS=<file>            frozen inputs file (default scratchpad/pick-check-replay-inputs.json)
//   EXPECT=gated             score for the gated checker: only Izzo rewritten, every
//                            other pick "unchanged" (any status except rewritten)
//   REPLAY_NO_TIMEOUT=1      drop the checker's abort signal, to measure a slower model's
//                            real latency instead of recording CHECK_TIMEOUT_MS timeouts
import { register } from "node:module";
import { readFileSync, writeFileSync } from "fs";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        try { return await next(specifier, context); }
        catch (err) {
          if (specifier.startsWith(".") && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier + ".ts", context);
          throw err;
        }
      }`),
);
const { checkPickDescriptions } = await import("../lib/verify/checkPickDescriptions.ts");

// Target from the 2026-09-26 request: the real errors rewritten every run, everything
// else confirmed every run.
// Corrected 2026-09-26: Paris Trout's original blurb calls it "the small Georgia town of
// the title", but Paris Trout is the protagonist, not the town — a real error.
const EXPECTED: Record<string, "rewritten" | "confirmed" | "unchanged"> =
  process.env.EXPECT === "gated"
    ? { "Garlic, mint & sweet basil": "rewritten" }
    : { "Garlic, mint & sweet basil": "rewritten", "Adrian Mole": "rewritten", "Paris Trout": "rewritten" };
const DEFAULT_EXPECTED = process.env.EXPECT === "gated" ? "unchanged" : "confirmed";
const onTarget = (status: string, expected: string) =>
  expected === "unchanged" ? status !== "rewritten" : status === expected;

// Swap the model in Anthropic request bodies (and record per-call latency + served model).
const callLog: { ms: number; model: string; stop?: string; usage?: unknown }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  if (!String(input).startsWith("https://api.anthropic.com/") || typeof init?.body !== "string") return realFetch(input, init);
  const body = JSON.parse(init.body);
  if (process.env.REPLAY_MODEL) body.model = process.env.REPLAY_MODEL;
  const t0 = performance.now();
  const next: RequestInit = { ...init, body: JSON.stringify(body) };
  if (process.env.REPLAY_NO_TIMEOUT) delete next.signal;
  const res = await realFetch(input, next);
  const d = await res.clone().json().catch(() => null);
  callLog.push({ ms: Math.round(performance.now() - t0), model: d?.model ?? body.model, stop: d?.stop_reason, usage: d?.usage });
  return res;
};

const inputs = JSON.parse(readFileSync(process.env.INPUTS ?? "scratchpad/pick-check-replay-inputs.json", "utf8"));
const runs = Number(process.argv[2] ?? 3);
const label = process.env.RESCORE ?? process.argv[3] ?? "replay";

const table = new Map<string, { expected: string; got: string[]; ms: number[] }>();
let detail: unknown[] = [];

type Detail = { run: number; case: string; checkMs: number; error?: string; picks: { title: string; status: string; reason: string }[] };
function score(d: Detail) {
  for (const p of d.picks) {
    const key = `${d.case} | ${p.title}`;
    const row = table.get(key) ?? { expected: EXPECTED[p.title] ?? DEFAULT_EXPECTED, got: [], ms: [] };
    row.got.push(p.status);
    row.ms.push(d.checkMs);
    table.set(key, row);
    if (!onTarget(p.status, row.expected)) console.log(`run ${d.run} MISS "${p.title}": ${p.status} — ${p.reason}`);
    if (p.title === "Paris Trout") console.log(`run ${d.run} Paris Trout ${p.status}: ${p.reason}`);
  }
}

if (process.env.RESCORE) {
  detail = JSON.parse(readFileSync(`scratchpad/pick-check-replay-${process.env.RESCORE}.json`, "utf8"));
  (detail as Detail[]).forEach(score);
}

for (let run = 1; run <= (process.env.RESCORE ? 0 : runs); run++) {
  // Cases run concurrently within a run, as independent requests would.
  const results = await Promise.all(
    inputs.map(async (c: { id: string; tasteDescription: string; recommendations: string; metadata: unknown[] }) => {
      const t0 = performance.now();
      const r = await checkPickDescriptions(process.env.ANTHROPIC_API_KEY!, c.tasteDescription, c.recommendations, c.metadata as never);
      return { ...r, wallMs: Math.round(performance.now() - t0) };
    }),
  );
  results.forEach((r, i) => {
    detail.push({ run, case: inputs[i].id, ...r });
    console.log(`run ${run} ${inputs[i].id}: checkCalled=${r.checkCalled} checkMs=${r.checkMs} step wall=${r.wallMs}ms`);
    if (r.error) console.log(`run ${run} ${inputs[i].id}: CHECK FAILED — ${r.error}`);
    score({ run, case: inputs[i].id, ...r } as Detail);
  });
}

console.log(`\n${label}: ${process.env.RESCORE ? "re-scored from saved runs" : `${runs} runs per case`}`);
let hits = 0;
let total = 0;
for (const [title, row] of table) {
  const ok = row.got.filter((g) => onTarget(g, row.expected)).length;
  hits += ok;
  total += row.got.length;
  console.log(`${ok === row.got.length ? "PASS" : "MISS"}  ${title.padEnd(62)} expected ${row.expected.padEnd(9)} got ${row.got.join(", ")}`);
}
const allMs = [...new Set(detail.map((d) => (d as { checkMs: number }).checkMs))].sort((a, b) => a - b);
console.log(`\n${hits}/${total} verdicts on target; check call ms: min ${allMs[0]} median ${allMs[Math.floor(allMs.length / 2)]} max ${allMs.at(-1)}`);
if (callLog.length) {
  const ms = callLog.map((c) => c.ms).sort((a, b) => a - b);
  console.log(`served model(s): ${[...new Set(callLog.map((c) => c.model))].join(", ")}; ${callLog.length} calls; stop reasons: ${[...new Set(callLog.map((c) => c.stop))].join(", ")}`);
  console.log(`API call latency ms (incl. any that would have timed out): ${ms.join(", ")}`);
  const out = callLog.map((c) => (c.usage as { output_tokens?: number })?.output_tokens ?? 0);
  console.log(`output tokens per call: ${out.join(", ")}`);
}
if (!process.env.RESCORE) writeFileSync(`scratchpad/pick-check-replay-${label}.json`, JSON.stringify(detail, null, 2));
