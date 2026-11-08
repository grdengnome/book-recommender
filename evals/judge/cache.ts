// Remembers paid eval answers so they're never bought twice (Nov 7 plan): the same question gets
// the same answer for free, and an unchanged pick can't change grade by chance between scorings.
// A key covers everything the answer depends on (the judge's version and model, the brief, the
// checks, each pick and its catalog facts), so any change asks again.
//
// Stored in evals/results/cache/ (gitignored, like all eval output). NO_CACHE=1 asks the judge
// afresh (still saving the new answers), for measuring its own randomness; plain Claude's answers
// stay fixed so the comparison doesn't move meanwhile. Run one scoring at a time: two at once
// would each keep only their own new answers.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "results", "cache");
const stores = new Map<string, Record<string, unknown>>();

function file(kind: string) {
  return path.join(process.env.EVAL_CACHE_DIR || DEFAULT_DIR, `${kind}.json`);
}

function store(kind: string): Record<string, unknown> {
  const f = file(kind);
  let s = stores.get(f);
  if (!s) {
    s = {};
    if (existsSync(f)) {
      try {
        s = JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>;
      } catch {
        // An unreadable file never breaks a scoring: it's set aside and answers are asked afresh.
        const aside = `${f}.unreadable-${Date.now()}`;
        renameSync(f, aside);
        console.warn(`[eval cache] ${path.basename(f)} couldn't be read; moved it to ${path.basename(aside)} and starting empty`);
      }
    }
    stores.set(f, s);
  }
  return s;
}

export const cacheKey = (parts: unknown) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

// Returns the remembered answer for this key, or runs `ask`, remembers its answer and returns it.
// `reused` says which happened, so the scorecard can show how many paid calls a scoring made.
// Options: `fresh` asks even when an answer is remembered; `keep: false` doesn't remember the new
// answer (used when the question was asked on incomplete evidence, so it's asked again next time).
export async function remember<T>(
  kind: string,
  parts: unknown,
  ask: () => Promise<T>,
  opts: { fresh?: boolean; keep?: boolean } = {},
): Promise<{ value: T; reused: boolean }> {
  const key = cacheKey(parts);
  const s = store(kind);
  if (!opts.fresh && key in s) return { value: s[key] as T, reused: true };
  const value = await ask();
  if (opts.keep === false) return { value, reused: false };
  s[key] = value;
  // Written to a temporary file, then swapped in, so stopping mid-write can't leave a broken file.
  const f = file(kind);
  mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(s));
  renameSync(tmp, f);
  return { value, reused: false };
}
