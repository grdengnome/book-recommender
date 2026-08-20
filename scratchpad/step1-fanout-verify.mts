// Step 1 verification: exercise the new multi-subject fan-out in searchBooks.ts
// against case-3 and case-8's real subject sets (from docs/eval-log.md /
// scratchpad/query-log.json), before vs after, per the build-sequence request.
import { searchBooks } from "../lib/tools/searchBooks";

function printPool(label: string, pool: { title: string; author: string }[]) {
  console.log(`\n${label} — poolSize=${pool.length}`);
  pool.slice(0, 15).forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. ${c.title} — ${c.author}`));
  if (pool.length > 15) console.log(`  ... (${pool.length - 15} more)`);
}

console.log("########## BEFORE (single subject, as current production behavior was) ##########");
const c3Before = await searchBooks({ query: "literary fiction beautifully written", subjects: ["literary_fiction"] });
printPool("case-3 BEFORE — subjects=[literary_fiction] only", c3Before.pool);

const c8Before = await searchBooks({ query: "atmospheric setting morally complex characters", subjects: ["literary_fiction"] });
printPool("case-8 BEFORE — subjects=[literary_fiction] only", c8Before.pool);

console.log("\n\n########## AFTER (multi-subject fan-out, new behavior) ##########");
const c3After = await searchBooks({
  query: "literary fiction beautifully written",
  subjects: ["translated_literature", "fiction", "literary_fiction"],
});
printPool("case-3 AFTER — subjects=[translated_literature, fiction, literary_fiction]", c3After.pool);

const c8After = await searchBooks({
  query: "atmospheric setting morally complex characters",
  subjects: ["literary_fiction", "psychological_fiction"],
});
printPool("case-8 AFTER — subjects=[literary_fiction, psychological_fiction]", c8After.pool);

console.log("\n\n########## Cross-case convergence check (the thing multi-subject was NOT expected to fix) ##########");
function overlap(a: { title: string; author: string }[], b: { title: string; author: string }[]) {
  const keyOf = (c: { title: string; author: string }) => `${c.title.toLowerCase()}::${c.author.toLowerCase()}`;
  const setA = new Set(a.map(keyOf));
  const shared = b.filter((c) => setA.has(keyOf(c)));
  return shared;
}
const beforeOverlap = overlap(c3Before.pool, c8Before.pool);
const afterOverlap = overlap(c3After.pool, c8After.pool);
console.log(`BEFORE: case-3 vs case-8 shared titles: ${beforeOverlap.length} -> ${beforeOverlap.map((c) => c.title).join(", ")}`);
console.log(`AFTER:  case-3 vs case-8 shared titles: ${afterOverlap.length} -> ${afterOverlap.map((c) => c.title).join(", ")}`);

console.log("\n\n########## translated_literature spot-check (flagged as possibly returning 0 works at some offset) ##########");
const tlCheck = await searchBooks({ query: "translated masterpiece", subjects: ["translated_literature"] });
console.log(`translated_literature-only pool size: ${tlCheck.poolSize} (0 would confirm the flagged concern)`);
