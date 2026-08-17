// Runs prepareHardcoverPool (lib/hardcover/preparePool.ts) against the same 2 eval
// inputs used in the Aug 16 ordering test, as the final pre-merge check requested
// this session. Loads HARDCOVER_API_TOKEN from .env.local (never printed).
import { readFileSync } from "fs";
import { prepareHardcoverPool } from "../lib/hardcover/preparePool.ts";

const envLocal = readFileSync("/workspaces/book-recommender/.env.local", "utf8");
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const INPUTS: Record<string, { label: string; tagIds: number[] }> = {
  A: { label: "Input A (Literary Fiction tag only)", tagIds: [899] },
  B: {
    label: "Input B (7-tag: lit fic + psych genres + moods)",
    tagIds: [899, 2795, 138, 148, 206, 192, 207],
  },
};

for (const [key, { label, tagIds }] of Object.entries(INPUTS)) {
  console.log(`\n\n########## ${key}: ${label} ##########`);
  console.log(`Tag IDs: [${tagIds.join(", ")}]`);
  const { pool, poolSize } = await prepareHardcoverPool(tagIds);
  console.log(`poolSize: ${poolSize} (WORKING_POOL_SIZE check: ${poolSize === 15 ? "MATCHES 15" : "MISMATCH"})`);
  pool.forEach((b, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${b.title} — ${b.author}  [subjects: ${b.subjects.join(", ") || "(none)"}] (usersCount: ${b.usersCount})`);
  });
  await new Promise((r) => setTimeout(r, 500));
}
