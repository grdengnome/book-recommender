// Open Library + Hardcover candidate pool merge — spec.md Section 5b, per the merge
// architecture decided 2026-08-15 (docs/progress-log.md; memory
// project-hardcover-taste-signal-investigation) and the ordering strategy decided
// 2026-08-16: supplement, not filter/re-rank; dedup on exact normalized title +
// author-lastname (not fuzzy); `users_count` scoped narrowly to merge-time
// tiebreaking, never as a pool-wide ranking or filtering signal.
//
// Both input pools arrive already ranked and shuffled by their own pipelines
// (searchBooks.ts for Open Library, preparePool.ts's prepareHardcoverPool for
// Hardcover) — this module does no sorting or filtering of its own, only dedup +
// metadata merge + source tracking.
import type { BookCandidate } from "../tools/searchBooks";
import type { HardcoverBookCandidate } from "../hardcover/preparePool";

// Step 1: shape check. BookCandidate is { title, author, subjects } and
// HardcoverBookCandidate is { title, author, subjects, usersCount } — the three
// core fields already match with no alignment needed; usersCount is Hardcover-only
// engagement metadata, not part of the shared shape, consumed here for tiebreaking
// only and never copied onto Open-Library-only records.

export type PoolSource = "openlibrary" | "hardcover";

export interface MergedBookCandidate {
  title: string;
  author: string;
  subjects: string[];
  sources: PoolSource[];
}

export interface MergeStats {
  openLibraryRawPoolSize: number;
  hardcoverRawPoolSize: number;
  duplicatesRemoved: number;
  mergedTotal: number;
  openLibraryPct: number; // % of final pool with an Open Library record contributing (sole or shared)
  hardcoverPct: number; // % of final pool with a Hardcover record contributing (sole or shared)
}

export interface MergeCandidatePoolsResult {
  pool: MergedBookCandidate[];
  stats: MergeStats;
}

// Same normalization as the Aug 15 dedup decision and its validating test
// (scratchpad/hardcover-ol-overlap-test.mjs) — exact match, not fuzzy.
function normTitle(title: string): string {
  return (title ?? "")
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normAuthorLastName(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase().replace(/[^\w]/g, "");
}

function dedupKey(title: string, author: string): string {
  return `${normTitle(title)}|${normAuthorLastName(author)}`;
}

// Union subjects from both sources on a match, deduped case-insensitively,
// first-seen casing kept. Not a ranking decision — just avoiding literal repeats.
function mergeSubjects(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const s of [...a, ...b]) {
    const key = s.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }
  return merged;
}

interface MergeEntry {
  record: MergedBookCandidate;
  usersCount: number; // highest users_count seen for this canonical record so far
}

function computeStats(
  openLibraryRawPoolSize: number,
  hardcoverRawPoolSize: number,
  pool: MergedBookCandidate[],
): MergeStats {
  const mergedTotal = pool.length;
  const duplicatesRemoved = openLibraryRawPoolSize + hardcoverRawPoolSize - mergedTotal;
  const openLibraryCount = pool.filter((r) => r.sources.includes("openlibrary")).length;
  const hardcoverCount = pool.filter((r) => r.sources.includes("hardcover")).length;
  const pct = (count: number) => (mergedTotal === 0 ? 0 : Math.round((count / mergedTotal) * 1000) / 10);
  return {
    openLibraryRawPoolSize,
    hardcoverRawPoolSize,
    duplicatesRemoved,
    mergedTotal,
    openLibraryPct: pct(openLibraryCount),
    hardcoverPct: pct(hardcoverCount),
  };
}

// Step 4: lightweight, reusable per-call log — not a one-off diagnostic. Composition
// is expected to shift call to call as Open Library's retrieval varies, so this
// prints every time rather than only when something looks off.
function logMergeStats(stats: MergeStats): void {
  console.log(
    `mergeCandidatePools: OL raw=${stats.openLibraryRawPoolSize}, HC raw=${stats.hardcoverRawPoolSize}, ` +
      `duplicates removed=${stats.duplicatesRemoved}, merged total=${stats.mergedTotal}, ` +
      `OL%=${stats.openLibraryPct}%, HC%=${stats.hardcoverPct}%`,
  );
}

export function mergeCandidatePools(
  openLibraryPool: BookCandidate[],
  hardcoverPool: HardcoverBookCandidate[],
): MergeCandidatePoolsResult {
  // Step 2: dedup on exact normalized title + author-lastname; merge metadata across
  // both sources on a match rather than discarding either record. Building the index
  // from the Open Library pass first, then folding Hardcover in, preserves each
  // source's own already-shuffled relative order — Hardcover-only additions land
  // after the Open Library entries; no new ordering is introduced (step 3).
  const byKey = new Map<string, MergeEntry>();

  for (const c of openLibraryPool) {
    const key = dedupKey(c.title, c.author);
    byKey.set(key, {
      record: { title: c.title, author: c.author, subjects: [...c.subjects], sources: ["openlibrary"] },
      usersCount: 0, // Open Library carries no comparable engagement count
    });
  }

  for (const c of hardcoverPool) {
    const key = dedupKey(c.title, c.author);
    const existing = byKey.get(key);
    if (existing) {
      // Tie-break which raw title/author string becomes canonical using
      // users_count — the one use of it permitted by the merge decision, never
      // for ranking or filtering the pool itself. Open Library is treated as 0,
      // so Hardcover's formatting wins whenever it has a nonzero count.
      const hcWins = c.usersCount > existing.usersCount;
      if (hcWins) {
        existing.record.title = c.title;
        existing.record.author = c.author;
      }
      existing.record.subjects = mergeSubjects(existing.record.subjects, c.subjects);
      existing.record.sources = ["openlibrary", "hardcover"];
      existing.usersCount = Math.max(existing.usersCount, c.usersCount);
    } else {
      byKey.set(key, {
        record: { title: c.title, author: c.author, subjects: [...c.subjects], sources: ["hardcover"] },
        usersCount: c.usersCount,
      });
    }
  }

  const pool = [...byKey.values()].map((v) => v.record);
  const stats = computeStats(openLibraryPool.length, hardcoverPool.length, pool);
  logMergeStats(stats);

  return { pool, stats };
}
