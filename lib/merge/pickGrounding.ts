// Grounding enforcement for final picks — spec.md Section 5b/5c, tightened on 2026-09-20:
// all 3 picks must come from a retrieved candidate pool, no trained-knowledge fallback.
// A prompt instruction alone is not a guarantee (the same-day test request returned two
// picks absent from both pools), so route.ts runs this check in code on every generation
// and retries rather than returning an ungrounded pick.
//
// Matching uses its OWN key (groundingKey below), deliberately more tolerant than the
// merge's dedupKey (mergeCandidatePools.ts, left untouched). The first version reused
// dedupKey and the full eval re-run (docs/eval-log.md, 2026-09-20) showed it falsely
// rejecting legitimately grounded picks — 5 of 5 rejections in that run — for two reasons
// the merge's dedup tolerates by accident but a pass/fail check cannot:
//   1. Unicode form: Open Library stores "Sátántangó" decomposed (a + U+0301), the model
//      writes it precomposed (U+00E1); dedupKey's `[^\w\s]` strip erases precomposed
//      accents but keeps decomposed base letters, so identical-looking titles keyed apart.
//   2. Subtitles: OL titles can carry a long subtitle the model drops (or vice versa).
// This tolerance is one-directional in purpose: it only widens what counts as the *same
// book*, never what counts as a book that was retrieved — every key still has to exist
// in a pool the model was actually shown.
import type { MergedBookCandidate, PoolSource } from "./mergeCandidatePools";

// NFKD splits precomposed letters into base + combining marks (and folds compatibility
// forms); dropping the marks makes NFC "á", NFD "a"+U+0301 and plain "a" compare equal.
function foldDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}/gu, "");
}

// Title up to the first colon or parenthesis, so a dropped (or added) subtitle or
// parenthetical doesn't change the key. If cutting would leave nothing (title starts
// with one of those characters), the whole title is used instead.
function titleKey(title: string): string {
  const folded = foldDiacritics(title ?? "").toLowerCase();
  const beforeSubtitle = folded.split(/[:(]/)[0];
  const base = beforeSubtitle.trim() ? beforeSubtitle : folded;
  return base
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "") // keep letters/digits of any script, not just \w
    .replace(/\s+/g, " ")
    .trim();
}

// Last whitespace-separated token, same as the merge's author rule, but keeping letters
// of any script — the merge's `[^\w]` strip reduces a non-Latin name (e.g. 夏目漱石) to
// an empty string.
function authorKey(author: string): string {
  const tokens = foldDiacritics(author ?? "").toLowerCase().trim().split(/\s+/);
  return tokens[tokens.length - 1].replace(/[^\p{L}\p{N}]/gu, "");
}

// null when either half is empty: an empty/missing title or author is genuinely
// unmatched, never a wildcard. (With the merge's key, an emptied author half made
// "kokoro|" match any pick titled "Kokoro" whatever its author.)
function groundingKey(title: string, author: string): string | null {
  const t = titleKey(title);
  const a = authorKey(author);
  return t && a ? `${t}|${a}` : null;
}

// groundingKey -> the pool record a pick would match, unioned across every search_books
// round of one generation (the model may pick from any round's pool). Sources are unioned;
// each ID is first-seen-wins and filled in from a later round if the first record lacked
// it. Because groundingKey is more tolerant than dedupKey, two distinct pool records (e.g.
// subtitle variants) can share one key — in that case the IDs come from whichever was
// seen first.
export type SeenCandidates = Map<string, MergedBookCandidate>;

export function recordSeenCandidates(seen: SeenCandidates, pool: MergedBookCandidate[]): void {
  for (const c of pool) {
    const key = groundingKey(c.title, c.author);
    if (key === null) continue; // an unkeyable candidate can never ground a pick
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...c, subjects: [...c.subjects], sources: [...c.sources] });
      continue;
    }
    for (const s of c.sources) if (!existing.sources.includes(s)) existing.sources.push(s);
    existing.olWorkKey ??= c.olWorkKey;
    existing.hcBookId ??= c.hcBookId;
  }
}

export interface CheckedPick {
  title: string;
  author: string;
  sources: PoolSource[]; // empty = not found in any retrieved pool
  record: MergedBookCandidate | null; // the matched pool record (with IDs); null = not found
}

// "unparseable" is a failure too: a response that can't be verified can't be returned.
export type GroundingResult =
  | { status: "grounded"; picks: CheckedPick[] }
  | { status: "ungrounded"; picks: CheckedPick[] }
  | { status: "unparseable" };

export function checkPickGrounding(
  recommendationsText: string,
  seen: SeenCandidates,
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
    const key = groundingKey(title, author);
    const record = key === null ? null : (seen.get(key) ?? null);
    return { title, author, sources: record ? [...record.sources] : [], record };
  });
  const allGrounded = picks.every((p) => p.sources.length > 0);
  return { status: allGrounded ? "grounded" : "ungrounded", picks };
}

// Same per-call console convention as logMergeStats. Printed on every attempt, pass or
// fail, so source attribution stays visible for every run. Each matched pick's IDs go on
// their own following line, so the pick line itself keeps the exact format the eval
// driver parses (scratchpad/run-eval-grounded.mjs, PICK_LINE).
export function formatPickSources(picks: CheckedPick[]): string {
  return picks
    .map((p) => {
      const line = `  "${p.title}" — ${p.author}: ${p.sources.length ? p.sources.join("+") : "NONE (not in any retrieved pool)"}`;
      if (!p.record) return line;
      const ol = p.record.olWorkKey ?? "none";
      const hc = p.record.hcBookId ?? "none";
      return `${line}\n    ids: ol=${ol} hc=${hc}`;
    })
    .join("\n");
}
