// Step 4: run the real Open Library + Hardcover merge for the first time against
// real data, using case-3 and case-8 — the documented convergence pair from the
// Aug 4 2026 narrow-pool investigation. Exercises the full pipeline as it now
// stands after Steps 1-3b: searchBooks.ts's multi-subject fan-out, mapTasteToTags's
// one-shot tag mapping, preparePool.ts's relevance-floored pool (rel>=2, cap 30),
// and mergeCandidatePools.ts (built 2026-08-16, never run against real data before).
import { readFileSync } from "fs";
const envLocal = readFileSync("/workspaces/book-recommender/.env.local", "utf8");
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

import { searchBooks } from "../lib/tools/searchBooks";
import { mapTasteToHardcoverTags } from "../lib/hardcover/mapTasteToTags";
import { prepareHardcoverPool } from "../lib/hardcover/preparePool";
import { mergeCandidatePools } from "../lib/merge/mergeCandidatePools";

const CASES = [
  {
    id: "case-3",
    tasteDescription: "Just something good to read.",
    // Real subject set from the Aug 4 query-log for this case's literary-fiction guess,
    // fanned out per Step 1 (translated_literature + fiction + literary_fiction).
    olQuery: "literary fiction beautifully written",
    olSubjects: ["translated_literature", "fiction", "literary_fiction"],
  },
  {
    id: "case-8",
    tasteDescription:
      "I'm looking for something with a really granular, immersive sense of place — I want to feel like I'm actually there — and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture.",
    olQuery: "atmospheric setting morally complex characters",
    olSubjects: ["literary_fiction", "psychological_fiction"],
  },
];

for (const c of CASES) {
  console.log(`\n\n########## ${c.id} ##########`);
  console.log(`taste: "${c.tasteDescription}"`);

  const olResult = await searchBooks({ query: c.olQuery, subjects: c.olSubjects });
  console.log(`\nOpen Library raw pool: ${olResult.poolSize}`);

  const tagResult = await mapTasteToHardcoverTags(c.tasteDescription);
  console.log(`Hardcover tags selected: ${JSON.stringify(tagResult.tagNames)}`);

  const hcResult = await prepareHardcoverPool(tagResult.tagIds);
  console.log(`Hardcover raw pool: ${hcResult.poolSize}`);

  const merged = mergeCandidatePools(olResult.pool, hcResult.pool);

  console.log(`\nMerged pool (${merged.pool.length} total):`);
  merged.pool.forEach((b, i) => {
    console.log(`  ${String(i + 1).padStart(3)}. [${b.sources.join("+")}] ${b.title} — ${b.author} (${b.subjects.join(", ")})`);
  });

  console.log(`\nStats: ${JSON.stringify(merged.stats, null, 2)}`);
}
