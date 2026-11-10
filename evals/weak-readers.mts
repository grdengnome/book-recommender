// Free helper (no model calls): lists the readers in a scored run whose picks missed, to choose
// a narrow test set (decision 3.13). A reader is "weak" when any pick is below good or misses a
// strong or weighed preference ("no" or "partly"; "can't tell" doesn't count). Prints a CASE_IDS
// line ready to paste, plus the strongest readers as controls.
//   SCORED=profile-v1-run1-rescored2-scored.json LIMIT=10 CONTROLS=3 node --import ./tests/support/resolve.mts evals/weak-readers.mts
import { readFileSync } from "node:fs";
import path from "node:path";

const file = process.env.SCORED;
if (!file) throw new Error("Set SCORED to a scored file in evals/results/");
const raw = JSON.parse(readFileSync(path.join("evals/results", file), "utf8"));
// Scored files hold { engineRuns, baseline, ... }; the first engine run is the one read.
const engine = raw.engineRuns?.[0];
if (!engine) throw new Error(`${file} has no engine run`);
const controls = Number(process.env.CONTROLS ?? 3);
// Most readers miss at least one preference, so the test takes the weakest LIMIT of them.
const limit = Number(process.env.LIMIT ?? 10);

type V = { verdict: string };
const rows = (engine.cases as Array<{ id: string; doorway: string; score: { picks: Array<{ relevance: string; strong: V[]; weighed: V[] }> } | null }>)
  .filter((c) => c.score)
  .map((c) => {
    const picks = c.score!.picks;
    const belowGood = picks.filter((p) => p.relevance === "fail" || p.relevance === "weak").length;
    const missed = picks.reduce((n, p) => n + [...p.strong, ...p.weighed].filter((v) => v.verdict === "no" || v.verdict === "partly").length, 0);
    return { id: c.id, doorway: c.doorway, belowGood, missed };
  });

const unscored = (engine.cases as Array<{ id: string; score: unknown }>).filter((c) => !c.score).map((c) => c.id);
// Weakest first: picks below good, then preference misses.
const ranked = [...rows].sort((a, b) => b.belowGood - a.belowGood || b.missed - a.missed);
const weak = ranked.filter((r) => r.belowGood > 0 || r.missed > 0).slice(0, limit);
// Controls: the strongest readers not already in the test (clean ones first, then the least weak).
const strong = ranked.filter((r) => !weak.includes(r)).reverse().slice(0, controls);

console.log("reader    | doorway    | picks below good | preference misses");
for (const r of ranked) console.log(`${r.id.padEnd(9)} | ${r.doorway.padEnd(10)} | ${String(r.belowGood).padEnd(16)} | ${r.missed}${weak.includes(r) ? "  test" : strong.includes(r) ? "  control" : ""}`);
if (unscored.length) console.log(`\nNot scored in that file (left out): ${unscored.join(", ")}`);
console.log(`\n${weak.length} weakest readers + ${strong.length} controls`);
console.log(`CASE_IDS=${[...weak, ...strong].map((r) => r.id).join(",")}`);
