// Step 3b Part 2 verification: before (hard rank cutoff at 30) vs after
// (relevance>=2 floor, size-capped at 30) for case-8's real tag set, using the
// actual prepareHardcoverPool() export now that preparePool.ts has been changed.
import { readFileSync } from "fs";
const envLocal = readFileSync("/workspaces/book-recommender/.env.local", "utf8");
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

import { prepareHardcoverPool } from "../lib/hardcover/preparePool";

// case-8's real tag IDs from Step 2: Literature, mysterious, challenging, reflective
const CASE_8_TAG_IDS = [3107, 25510, 25511, 2157];

const result = await prepareHardcoverPool(CASE_8_TAG_IDS);
console.log(`AFTER (relevance>=2 floor, cap=30) — case-8 pool size: ${result.poolSize}`);
console.log("(Step 3's raw distribution run showed only 10 of case-8's 91 candidates clear relevance>=2, so a poolSize of 10 here is expected, not a bug.)\n");
result.pool.forEach((b, i) => console.log(`  ${String(i + 1).padStart(2)}. ${b.title} — ${b.author} [${b.subjects.join(", ")}]`));

console.log(`\nBEFORE (hard rank cutoff at 30, from Step 3's raw distribution run) would have been 30 candidates, ranks 16-30 all relevance=1 via 'reflective' alone:`);
console.log("  e.g. Darkest Fear (Harlan Coben), The Associate (John Grisham), Why I'm Not Afraid of Ghosts (R. L. Stine), Skipping Christmas (John Grisham), Stolen Prey (John Sandford) — all cut by the floor now.");
