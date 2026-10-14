// Builds sample.json: every final pick from the saved eval runs, plus a seeded
// random sample of 150 pool books from query-log.json (picks excluded).
// Usage: node scratchpad/cover-research/build-sample.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = new URL("..", import.meta.url).pathname; // scratchpad/
const RUNS = [
  "eval-run-grounded-2026-09-20.json",
  "eval-run-grounded-fix-verify-2026-09-20.json",
  "eval-run-postfix-2026-09-23.json",
];
const POOL_SAMPLE_SIZE = 150;
const SEED = 20261014;

const key = (b) => `${b.title.trim().toLowerCase()}|${b.author.trim().toLowerCase()}`;

const picks = new Map();
const runsFound = [];
for (const f of RUNS) {
  if (!existsSync(DIR + f)) { runsFound.push({ file: f, found: false }); continue; }
  runsFound.push({ file: f, found: true });
  for (const c of JSON.parse(readFileSync(DIR + f, "utf8"))) {
    if (c.finalOutcome !== "returned") continue;
    const final = c.attempts.filter((a) => a.outcome === "grounded").at(-1);
    for (const p of final?.picks ?? []) {
      const k = key(p);
      if (!picks.has(k)) picks.set(k, { title: p.title, author: p.author, tag: "pick", from: [] });
      picks.get(k).from.push(`${f.replace(".json", "")}#${c.id}`);
    }
  }
}

const pool = new Map();
for (const line of readFileSync(DIR + "query-log.json", "utf8").split("\n")) {
  if (!line.trim()) continue;
  for (const b of JSON.parse(line).pool ?? []) {
    if (!b?.title || !b?.author) continue;
    const k = key(b);
    if (!picks.has(k) && !pool.has(k)) pool.set(k, { title: b.title, author: b.author, tag: "pool" });
  }
}

// mulberry32 + Fisher–Yates on the insertion-ordered list, so the sample is repeatable.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const poolList = [...pool.values()];
for (let i = poolList.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [poolList[i], poolList[j]] = [poolList[j], poolList[i]];
}

const out = {
  builtWith: { seed: SEED, poolSampleSize: POOL_SAMPLE_SIZE, uniquePoolBooks: pool.size, runs: runsFound },
  books: [...picks.values(), ...poolList.slice(0, POOL_SAMPLE_SIZE)],
};
writeFileSync(new URL("sample.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(`picks ${picks.size}, pool sample ${Math.min(POOL_SAMPLE_SIZE, poolList.length)} of ${pool.size} unique`, runsFound);
