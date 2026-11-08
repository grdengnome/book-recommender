// Calibrates the judge before its scores count (decision 3.8): it scores planted picks (clearly
// wrong and clearly great books for readers in profile-v1) and must put at least 9 of 10 in the
// expected bucket. Costs about $0.20. Writes evals/results/calibration.json, which the scorecard
// shows.
//
//   node --env-file=.env.local --import ./tests/support/resolve.mts evals/calibrate.mts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderBrief } from "@/lib/engine/profile/renderBrief";
import { modelFor } from "@/lib/ai/gateway";
import type { TasteProfile } from "@/lib/contracts/tasteProfile";
import { lookupFacts } from "./judge/catalog";
import { StopScoringError } from "./judge/errors";
import { GOOD_OR_BETTER, JUDGE_VERSION, judgeCase, type CaseChecks } from "./judge/judge";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Calibration measures the judge itself, so it always asks afresh, never from remembered answers.
process.env.NO_CACHE = "1";
const { items } = JSON.parse(readFileSync(path.join(HERE, "calibration", "judge-calibration.json"), "utf8")) as {
  items: Array<{ caseId: string; title: string; author: string; expect: "wrong" | "great"; why: string }>;
};
const { cases } = JSON.parse(readFileSync(path.join(HERE, "cases", "profile-v1.json"), "utf8")) as {
  cases: Array<{ id: string; profile: TasteProfile; checks: CaseChecks }>;
};

const results = [];
for (const item of items) {
  const c = cases.find((x) => x.id === item.caseId);
  if (!c) throw new Error(`Unknown caseId ${item.caseId}`);
  const facts = await lookupFacts(item.title, item.author);
  let score;
  try {
    score = await judgeCase({ brief: renderBrief(c.profile), checks: c.checks, picks: [{ title: item.title, author: item.author, card: "", facts }] });
  } catch (err) {
    if (err instanceof StopScoringError) throw err;
    // One failed call doesn't throw away the rest of the paid run; it counts as a miss.
    const error = err instanceof Error ? err.message : String(err);
    results.push({ ...item, relevance: null, correct: false, reason: `not scored: ${error}` });
    console.log(`MISS ${item.caseId} "${item.title}": not scored (${error})`);
    continue;
  }
  const relevance = score.picks[0].relevance;
  const correct = item.expect === "great" ? GOOD_OR_BETTER.includes(relevance) : !GOOD_OR_BETTER.includes(relevance);
  results.push({ ...item, relevance, correct, reason: score.picks[0].relevanceReason });
  console.log(`${correct ? "ok  " : "MISS"} ${item.caseId} "${item.title}": expected ${item.expect}, judged ${relevance}`);
}
const correct = results.filter((r) => r.correct).length;
const passed = correct >= Math.ceil(items.length * 0.9);
mkdirSync(path.join(HERE, "results"), { recursive: true });
writeFileSync(path.join(HERE, "results", "calibration.json"), JSON.stringify({ model: modelFor("evalJudge"), judgeVersion: JUDGE_VERSION, correct, total: items.length, passed, results }, null, 2));
console.log(`\nJudge calibration: ${correct}/${items.length} ${passed ? "PASSED" : "FAILED: don't trust its scores yet"}`);
