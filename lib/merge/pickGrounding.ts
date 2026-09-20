// Grounding enforcement for final picks — spec.md Section 5b/5c, tightened on 2026-09-20:
// all 3 picks must come from a retrieved candidate pool, no trained-knowledge fallback.
// A prompt instruction alone is not a guarantee (the same-day test request returned two
// picks absent from both pools), so route.ts runs this check in code on every generation
// and retries rather than returning an ungrounded pick.
//
// Matching is the exact rule the merge itself uses (mergeCandidatePools.ts's dedupKey:
// normalized title + author last name), so "in the pool" here means precisely what it
// means everywhere else — no second, looser definition of a match.
import { dedupKey, type MergedBookCandidate, type PoolSource } from "./mergeCandidatePools";

// dedupKey -> sources that contributed the record, unioned across every search_books
// round of one generation (the model may pick from any round's pool).
export type SeenSources = Map<string, Set<PoolSource>>;

export function recordPoolSources(seen: SeenSources, pool: MergedBookCandidate[]): void {
  for (const c of pool) {
    const key = dedupKey(c.title, c.author);
    const set = seen.get(key) ?? new Set<PoolSource>();
    c.sources.forEach((s) => set.add(s));
    seen.set(key, set);
  }
}

export interface CheckedPick {
  title: string;
  author: string;
  sources: PoolSource[]; // empty = not found in any retrieved pool
}

// "unparseable" is a failure too: a response that can't be verified can't be returned.
export type GroundingResult =
  | { status: "grounded"; picks: CheckedPick[] }
  | { status: "ungrounded"; picks: CheckedPick[] }
  | { status: "unparseable" };

export function checkPickGrounding(
  recommendationsText: string,
  seen: SeenSources,
): GroundingResult {
  let parsed: unknown;
  try {
    const start = recommendationsText.indexOf("[");
    const end = recommendationsText.lastIndexOf("]");
    parsed = JSON.parse(recommendationsText.slice(start, end + 1));
  } catch {
    return { status: "unparseable" };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { status: "unparseable" };

  const picks: CheckedPick[] = parsed.map((p) => {
    const title = typeof p?.title === "string" ? p.title : "";
    const author = typeof p?.author === "string" ? p.author : "";
    return { title, author, sources: [...(seen.get(dedupKey(title, author)) ?? [])] };
  });
  const allGrounded = picks.every((p) => p.sources.length > 0);
  return { status: allGrounded ? "grounded" : "ungrounded", picks };
}

// Same per-call console convention as logMergeStats. Printed on every attempt, pass or
// fail, so source attribution stays visible for every run.
export function formatPickSources(picks: CheckedPick[]): string {
  return picks
    .map((p) => `  "${p.title}" — ${p.author}: ${p.sources.length ? p.sources.join("+") : "NONE (not in any retrieved pool)"}`)
    .join("\n");
}
