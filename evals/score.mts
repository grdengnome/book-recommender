// Scores eval runs against the readiness bar (docs/quality/readiness-bar.md, decision 3.8).
// Reads the results files evals/run.mjs wrote, looks up every pick's catalog facts, has the judge
// score each reader's picks, optionally runs the plain-Claude baseline and a second judge, then
// prints the scorecard and writes a scored JSON file and a review page to evals/results/.
// Costs money (the judge is Opus) only for questions it hasn't answered before: a first scoring of
// 21 readers is about $1 plus about $1 for plain Claude; rescoring unchanged picks is free.
//
//   node --env-file=.env.local --import ./tests/support/resolve.mts evals/score.mts
// Settings:
//   RUNS=profile-v1-run1.json,profile-v1-run2.json   results files in evals/results/ (required)
//   BASELINE=1        also run and score plain Claude on the same readers
//   SECOND_JUDGE=5    cross-check this many readers with the second judge (default 5; 0 = off)
//   REFRESH_FACTS=1   look every book up in the catalogs again instead of reusing saved facts
//   NO_CACHE=1        ask the judge afresh instead of reusing remembered answers (to measure its
//                     randomness); by default an identical question is answered from evals/results/cache/
//   OUT=baseline-nov  name for the scored file and review page (default: first run's name)
//
// One failed judge call never loses a paid run: that reader is recorded as unscored with the
// error, and the scored file is saved as each run finishes. Out of API credit, it stops at once;
// answers so far are remembered, so the rerun only pays for the rest.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderBrief } from "@/lib/engine/profile/renderBrief";
import { modelFor } from "@/lib/ai/gateway";
import type { TasteProfile } from "@/lib/contracts/tasteProfile";
import { CATALOG_VERSION, lookupFacts, type CatalogFacts } from "./judge/catalog";
import { remember } from "./judge/cache";
import { JUDGE_VERSION, judgeCase, type CaseChecks } from "./judge/judge";
import { plainClaudePicks } from "./judge/baseline";
import { checkCards } from "./judge/cardCheck";
import { judgeAgreement, scorecard, type ScoredCase, type ScoredRun } from "./judge/scorecard";
import { reviewPage } from "./judge/review";
import { StopScoringError } from "./judge/errors";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(HERE, "results");

interface CaseDef {
  id: string;
  label: string;
  profile?: TasteProfile;
  tasteDescription?: string;
  checks?: CaseChecks;
}
interface EnginePick { title: string; author: string; hook?: string; why?: string; angleHeading?: string; angleText?: string; mood?: string; coverUrl?: string | null; pages?: number | null }
interface RunResult { id: string; picks?: EnginePick[]; error?: unknown; driverMs?: number; trace?: { totalMs?: number; totalUsd?: number | null } | null }

const NO_CHECKS: CaseChecks = { hardRules: [], strong: [], weighed: [], nonObviousRequired: false };
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

// Catalog facts are saved and reused (evals/results/cache/facts.json) while the lookup rules are
// unchanged: rescoring sees exactly the same evidence (reader counts drift daily, which would
// otherwise change every judge question) and skips the slow lookups. Failed lookups, or ones
// missing Hardcover's evidence, aren't kept. REFRESH_FACTS=1 looks every book up again.
const factsMemo = new Map<string, Promise<CatalogFacts>>();
function facts(title: string, author: string): Promise<CatalogFacts> {
  const key = `${title}|${author}`.toLowerCase();
  let f = factsMemo.get(key);
  if (!f) {
    f = remember("facts", { v: CATALOG_VERSION, title, author }, () => lookupFacts(title, author), {
      fresh: process.env.REFRESH_FACTS === "1",
      keep: (x) => x.status !== "error" && !x.hardcoverError,
    }).then((r) => {
      // A failed lookup is retried for the next pick that needs it, not reused within the run.
      if (r.value.status === "error" || r.value.hardcoverError) factsMemo.delete(key);
      return r.value;
    });
    factsMemo.set(key, f);
  }
  return f;
}

// A few readers at a time: fast, without hammering the catalogs or the API.
async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

const runFiles = (process.env.RUNS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (!runFiles.length) throw new Error("Set RUNS to one or more results files in evals/results/, e.g. RUNS=profile-v1-run1.json");
// The second judge only means something as a different model: the same model would agree with
// itself (and answer from the same remembered verdicts), so it's skipped then.
const sameJudge = modelFor("evalSecondJudge") === modelFor("evalJudge");
if (sameJudge) console.warn("Second judge skipped: it's set to the same model as the judge");
const secondN = sameJudge ? 0 : Number(process.env.SECOND_JUDGE ?? 5);
const out = process.env.OUT || runFiles[0].replace(/\.json$/, "");

const runsRaw = runFiles.map((f) => JSON.parse(readFileSync(path.join(RESULTS, f), "utf8")) as { set: string; results: RunResult[] });
const setName = runsRaw[0].set;
if (runsRaw.some((r) => r.set !== setName)) throw new Error("All RUNS must be from the same case set");
const { cases } = JSON.parse(readFileSync(path.join(HERE, "cases", `${setName}.json`), "utf8")) as { cases: CaseDef[] };
const byId = new Map(cases.map((c) => [c.id, c]));
const briefOf = (c: CaseDef) => (c.profile ? renderBrief(c.profile) : c.tasteDescription ?? "");
const briefs = Object.fromEntries(cases.map((c) => [c.id, briefOf(c)]));

async function scoreEngineRun(name: string, results: RunResult[]): Promise<ScoredRun> {
  const known = results.filter((r) => {
    if (byId.has(r.id)) return true;
    console.warn(`[${name}] skipping ${r.id}: not in case set ${setName} (an older results file?)`);
    return false;
  });
  const scored = await pool(known, 3, async (r, i): Promise<ScoredCase> => {
    const def = byId.get(r.id)!;
    const checks = def.checks ?? NO_CHECKS;
    const enginePicks = r.picks ?? [];
    const picks = await Promise.all(enginePicks.map(async (p) => ({
      title: p.title,
      author: p.author,
      card: [p.hook, p.why, p.angleText].filter(Boolean).join(" "),
      coverUrl: p.coverUrl ?? null,
      pages: p.pages ?? null,
      facts: await facts(p.title, p.author),
    })));
    const traced = typeof r.trace?.totalMs === "number";
    const base: ScoredCase = {
      id: r.id, label: def.label, doorway: def.profile?.doorway ?? "", checks, ok: enginePicks.length === 3,
      error: r.error ? JSON.stringify(r.error).slice(0, 200) : undefined,
      serverMs: traced ? r.trace!.totalMs! : r.driverMs ?? null, timeFrom: traced ? "trace" : "driver",
      costUsd: r.trace?.totalUsd ?? null, picks, score: null,
    };
    if (!picks.length) return base;
    // The review page shows the full card; the judge sees only the one-line "why", the same amount
    // of text plain Claude gives, so the comparison is about the books chosen, not the writing.
    const judgePicks = picks.map((p, k) => ({ ...p, card: enginePicks[k].why ?? "" }));
    try {
      base.score = await judgeCase({ brief: briefOf(def), checks, picks: judgePicks });
      if (secondN > 0 && i < secondN) base.second = await judgeCase({ brief: briefOf(def), checks, picks: judgePicks, job: "evalSecondJudge" });
      // The card check reads each whole card (hook, why, angle, mood word), engine picks only.
      if (enginePicks.every((p) => p.hook && p.why)) {
        base.cardCheck = await checkCards(briefOf(def), picks.map((p, k) => ({
          ...p,
          fields: { hook: enginePicks[k].hook ?? "", why: enginePicks[k].why ?? "", angleHeading: enginePicks[k].angleHeading ?? "", angleText: enginePicks[k].angleText ?? "", mood: enginePicks[k].mood ?? "" },
        })));
      }
      console.log(`[${name}] ${r.id} scored${base.score.reused ? " (remembered)" : ""}`);
    } catch (err) {
      if (err instanceof StopScoringError) throw err;
      base.judgeError = errText(err);
      console.error(`[${name}] ${r.id} NOT scored: ${base.judgeError}`);
    }
    return base;
  });
  return { name, kind: "engine", set: setName, cases: scored };
}

async function scoreBaseline(ids: Set<string>): Promise<ScoredRun> {
  const scored = await pool(cases.filter((c) => ids.has(c.id)), 3, async (def): Promise<ScoredCase> => {
    const checks = def.checks ?? NO_CHECKS;
    const base: ScoredCase = { id: def.id, label: def.label, doorway: def.profile?.doorway ?? "", checks, ok: false, picks: [], score: null };
    try {
      const { picks: raw, ms, reused } = await plainClaudePicks(briefOf(def));
      base.picksReused = reused;
      base.picks = await Promise.all(raw.map(async (p) => ({ title: p.title, author: p.author, card: p.why, facts: await facts(p.title, p.author) })));
      base.ok = base.picks.length === 3;
      base.serverMs = ms;
      base.score = await judgeCase({ brief: briefOf(def), checks, picks: base.picks });
      console.log(`[plain Claude] ${def.id} scored${base.score.reused ? " (remembered)" : ""}`);
    } catch (err) {
      if (err instanceof StopScoringError) throw err;
      base.judgeError = errText(err);
      console.error(`[plain Claude] ${def.id} NOT scored: ${base.judgeError}`);
    }
    return base;
  });
  return { name: "plain Claude", kind: "baseline", set: setName, cases: scored };
}

const calPath = path.join(RESULTS, "calibration.json");
const cal = existsSync(calPath) ? (JSON.parse(readFileSync(calPath, "utf8")) as { correct: number; total: number; passed: boolean; model: string; judgeVersion?: string }) : null;
const judgeModel = modelFor("evalJudge");
const calibration = !cal
  ? "Judge calibration: not run (run evals/calibrate.mts first)"
  : cal.model !== judgeModel
    ? `Judge calibration: STALE (calibrated ${cal.model}, judging with ${judgeModel}; rerun evals/calibrate.mts)`
    : cal.judgeVersion !== JUDGE_VERSION
      ? "Judge calibration: STALE (the judge's instructions changed since it was calibrated; rerun evals/calibrate.mts)"
      : `Judge calibration: ${cal.correct}/${cal.total} (${cal.passed ? "passed" : "FAILED: don't trust these scores"}, ${cal.model})`;

const engineRuns: ScoredRun[] = [];
let baseline: ScoredRun | undefined;
function save() {
  const rows = scorecard(engineRuns, baseline);
  const agree = judgeAgreement(engineRuns);
  const agreement = agree.compared ? `Second judge (${modelFor("evalSecondJudge")}) agreed on ${agree.agreed}/${agree.compared} picks (good+ or not)` : "Second judge: not run";
  writeFileSync(path.join(RESULTS, `${out}-scored.json`), JSON.stringify({ engineRuns, baseline, rows, calibration, agreement }, null, 2));
  writeFileSync(path.join(RESULTS, `${out}-review.html`), reviewPage({ title: `Readiness: ${setName}`, rows, engineRuns, baseline, briefs, calibration, agreement }));
  return { rows, agreement };
}

try {
  for (const [i, raw] of runsRaw.entries()) {
    engineRuns.push(await scoreEngineRun(runFiles[i].replace(/\.json$/, ""), raw.results));
    save();
  }
  if (process.env.BASELINE === "1") {
    // Plain Claude answers exactly the readers the engine runs covered.
    baseline = await scoreBaseline(new Set(engineRuns.flatMap((r) => r.cases.map((c) => c.id))));
  }
} catch (err) {
  if (!(err instanceof StopScoringError)) throw err;
  // Every answer already paid for is remembered, so the rerun after a top-up only pays for the rest.
  console.error(`\nStopped: ${err.message}`);
  process.exit(1);
}
const { rows, agreement } = save();

// Scorecard summary: no reader data, safe to paste into a PR or chat.
console.log(`\nScorecard (${setName}; ${engineRuns.map((r) => r.name).join(", ")})`);
console.log(calibration);
console.log(agreement);
for (const r of rows) {
  const marks = r.pass.map((p) => (p === null ? "–" : p ? "PASS" : "MISS")).join(" / ");
  console.log(`${r.group.padEnd(8)} ${r.name.padEnd(34)} ${marks.padEnd(12)} ${r.values.join(" | ")}`);
}
console.log(`\nWrote evals/results/${out}-scored.json and ${out}-review.html`);
