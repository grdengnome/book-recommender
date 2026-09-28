// Offline check (2026-09-26, feat/verify-pick-descriptions): a book found in BOTH sources
// keeps both IDs through mergeCandidatePools -> recordSeenCandidates -> checkPickGrounding,
// and toModelPool strips them. Uses the real modules; synthetic input (IDs are the real
// American Gods records from hc-single-book-lookup-657.json).
// Usage: node scratchpad/id-plumbing-check.mts
import { mergeCandidatePools, toModelPool } from "../lib/merge/mergeCandidatePools.ts";
import { recordSeenCandidates, checkPickGrounding, formatPickSources } from "../lib/merge/pickGrounding.ts";

const ol = [
  { title: "American Gods", author: "Neil Gaiman", subjects: ["fantasy"], olWorkKey: "/works/OL679360W" },
  { title: "Kokoro", author: "Natsume Sōseki", subjects: ["japanese_literature"], olWorkKey: "/works/OL1174972W" },
];
const hc = [
  { title: "American Gods", author: "Neil Gaiman", subjects: ["Mythology"], usersCount: 5000, hcBookId: 657 },
  { title: "Some HC Only Book", author: "A. Writer", subjects: ["dark"], usersCount: 10, hcBookId: 42 },
];

const { pool } = mergeCandidatePools(ol, hc);
const seen = new Map();
recordSeenCandidates(seen, pool);
const picks = JSON.stringify([
  { title: "American Gods", author: "Neil Gaiman" },
  { title: "Kokoro", author: "Natsume Sōseki" },
  { title: "Some HC Only Book", author: "A. Writer" },
]);
const g = checkPickGrounding(picks, seen);
console.log("status:", g.status);
if (g.status !== "unparseable") console.log(formatPickSources(g.picks));

const modelKeys = new Set(toModelPool(pool).map((c) => Object.keys(c).join(",")));
console.log("toModelPool key sets:", [...modelKeys]);
