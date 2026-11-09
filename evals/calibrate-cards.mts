// Calibrates the card check (decision 2.26) before its verdicts count, like the judge's calibration:
// it checks planted cards, each clearly honest or clearly wrong against the book's catalog facts,
// and must sort at least 11 of 12 correctly (pass = honest, fail = wrong). "Subtle" plants test
// claims about how a book feels, the hard part. Always asks afresh. Costs about 30 cents.
// Writes evals/results/card-calibration.json.
//
//   node --env-file=.env.local --import ./tests/support/resolve.mts evals/calibrate-cards.mts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderBrief } from "@/lib/engine/profile/renderBrief";
import { modelFor } from "@/lib/ai/gateway";
import type { TasteProfile } from "@/lib/contracts/tasteProfile";
import { lookupFacts } from "./judge/catalog";
import { CARD_CHECK_VERSION, checkCards, type CardFields } from "./judge/cardCheck";
import { StopScoringError } from "./judge/errors";

const HERE = path.dirname(fileURLToPath(import.meta.url));
process.env.NO_CACHE = "1";
const { items } = JSON.parse(readFileSync(path.join(HERE, "calibration", "card-calibration.json"), "utf8")) as {
  items: Array<{ caseId: string; title: string; author: string; expect: "pass" | "fail"; kind: string; why: string; card: CardFields }>;
};
const { cases } = JSON.parse(readFileSync(path.join(HERE, "cases", "profile-v1.json"), "utf8")) as { cases: Array<{ id: string; profile: TasteProfile }> };

const results = [];
try {
  for (const item of items) {
    const c = cases.find((x) => x.id === item.caseId);
    if (!c) throw new Error(`Unknown caseId ${item.caseId}`);
    const facts = await lookupFacts(item.title, item.author);
    const check = await checkCards(renderBrief(c.profile), [{ title: item.title, author: item.author, facts, fields: item.card }]);
    const v = check.cards[0];
    const correct = v.honest === item.expect;
    results.push({ ...item, verdict: v.honest, headsUp: v.headsUp, correct, reason: v.reason, factsFound: facts.found });
    console.log(`${correct ? "ok  " : "MISS"} ${item.caseId} "${item.title}" (${item.kind}): expected ${item.expect}, checked ${v.honest}${correct ? "" : `\n     ${v.reason}`}`);
  }
} catch (err) {
  if (!(err instanceof StopScoringError)) throw err;
  console.error(`\nStopped: ${err.message}`);
  process.exitCode = 1;
}
const correct = results.filter((r) => r.correct).length;
const passed = results.length === items.length && correct >= items.length - 1;
mkdirSync(path.join(HERE, "results"), { recursive: true });
writeFileSync(path.join(HERE, "results", "card-calibration.json"), JSON.stringify({ model: modelFor("evalJudge"), cardCheckVersion: CARD_CHECK_VERSION, correct, total: items.length, passed, results }, null, 2));
console.log(`\nCard check calibration: ${correct}/${items.length} ${passed ? "PASSED" : "FAILED: don't trust its verdicts yet"}`);
