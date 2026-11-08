// Remembers paid eval answers so they're never bought twice (Nov 7 plan): the same question gets
// the same answer for free, and an unchanged pick can't change grade by chance between scorings.
// A key covers everything the answer depends on (the judge's version and model, the brief, the
// checks, each pick and its catalog facts), so any change asks again.
//
// Stored in evals/results/cache/ (gitignored, like all eval output). NO_CACHE=1 asks fresh every
// time (still saving the new answers), for measuring the judge's own randomness.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
    s = existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>) : {};
    stores.set(f, s);
  }
  return s;
}

export const cacheKey = (parts: unknown) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

// Returns the remembered answer for this key, or runs `ask`, remembers its answer and returns it.
// `reused` says which happened, so the scorecard can show how many paid calls a scoring made.
export async function remember<T>(kind: string, parts: unknown, ask: () => Promise<T>): Promise<{ value: T; reused: boolean }> {
  const key = cacheKey(parts);
  const s = store(kind);
  if (process.env.NO_CACHE !== "1" && key in s) return { value: s[key] as T, reused: true };
  const value = await ask();
  s[key] = value;
  const f = file(kind);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(s));
  return { value, reused: false };
}
