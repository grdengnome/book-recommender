// Final-pick metadata lookup — step 2 of verifying pick descriptions (branch
// feat/verify-pick-descriptions). The Sept 23 baseline described Izzo's "Garlic, Mint &
// Sweet Basil" (an essay collection) as a noir novel; the grounding check only confirms a
// pick exists in a pool, not that what the model says about it is true. This fetches each
// validated pick's own source records (description + subjects/genres) so a later step can
// check the model's description against them.
//
// LOG ONLY for now: route.ts awaits this and logs the result, but nothing here changes
// the response. It is awaited (not deferred with after()) because step 3 needs the
// results before the response is sent — so it has to be fast and can't fail the request:
// every lookup is capped at LOOKUP_TIMEOUT_MS, all run in parallel, and every failure is
// caught and reported as data rather than thrown.
import type { CheckedPick } from "../merge/pickGrounding";
import { hcGraphql } from "../hardcover/preparePool";

const LOOKUP_TIMEOUT_MS = 5000;
const OPEN_LIBRARY_BASE_URL = "https://openlibrary.org";
const USER_AGENT = "book-recommender/0.1 (https://github.com/grdengnome/book-recommender)";
const DESCRIPTION_PREVIEW_CHARS = 150;

// Hardcover `cached_tags` categories kept. "Tag" is skipped (mostly the forced-choice
// rating-widget tags tagExclusions.ts already filters, plus shelf noise), as is
// "Content Warning" (not a description of what the book is).
const HARDCOVER_TAG_CATEGORIES = ["Genre", "Mood"] as const;

// "ok" = returned a description or at least one subject/genre; "empty" = the request
// succeeded but carried neither; "failed" = error, non-200, or timeout.
export type LookupStatus = "ok" | "empty" | "failed";

interface LookupBase {
  status: LookupStatus;
  ms: number;
  description: string; // "" when absent
  error?: string;
}

export interface OpenLibraryLookup extends LookupBase {
  source: "openlibrary";
  id: string; // work key, e.g. "/works/OL19968899W"
  subjects: string[]; // the work record's full subject list
}

export interface HardcoverLookup extends LookupBase {
  source: "hardcover";
  id: number;
  genres: string[];
  moods: string[];
}

export type SourceLookup = OpenLibraryLookup | HardcoverLookup;

export interface PickMetadata {
  title: string;
  author: string;
  lookups: SourceLookup[]; // empty when the pick carried no IDs
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return `timeout after ${LOOKUP_TIMEOUT_MS}ms`;
  }
  if (!(err instanceof Error)) return String(err);
  // undici reports network failures as a bare "fetch failed"; the useful part (e.g.
  // ECONNRESET, ENOTFOUND) is on `cause`.
  const cause = err.cause as { code?: string; message?: string } | undefined;
  const detail = cause?.code ?? cause?.message;
  return detail ? `${err.message} (${detail})` : err.message;
}

function statusFor(description: string, tags: string[]): LookupStatus {
  return description.trim() || tags.length > 0 ? "ok" : "empty";
}

// Open Library's work `description` is either a plain string or { type, value }.
function olDescription(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && typeof (raw as { value?: unknown }).value === "string") {
    return (raw as { value: string }).value;
  }
  return "";
}

async function lookupOpenLibrary(workKey: string): Promise<OpenLibraryLookup> {
  const start = performance.now();
  const base = { source: "openlibrary" as const, id: workKey };
  try {
    const res = await fetch(`${OPEN_LIBRARY_BASE_URL}${workKey}.json`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const work = await res.json();
    const description = olDescription(work?.description);
    const subjects: string[] = Array.isArray(work?.subjects)
      ? work.subjects.filter((s: unknown): s is string => typeof s === "string")
      : [];
    return {
      ...base,
      status: statusFor(description, subjects),
      ms: Math.round(performance.now() - start),
      description,
      subjects,
    };
  } catch (err) {
    return {
      ...base,
      status: "failed",
      ms: Math.round(performance.now() - start),
      description: "",
      subjects: [],
      error: errorMessage(err),
    };
  }
}

interface CachedTag {
  tag?: string;
}

async function lookupHardcover(bookId: number): Promise<HardcoverLookup> {
  const start = performance.now();
  const base = { source: "hardcover" as const, id: bookId };
  try {
    const data = await hcGraphql<{
      books_by_pk: { description: string | null; cached_tags: Record<string, CachedTag[]> | null } | null;
    }>(
      `query PickMetadata($id: Int!) {
        books_by_pk(id: $id) { description cached_tags }
      }`,
      { id: bookId },
      AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    );
    const book = data.books_by_pk;
    if (!book) throw new Error(`no book with id ${bookId}`);
    const tagNames = (category: (typeof HARDCOVER_TAG_CATEGORIES)[number]) =>
      (book.cached_tags?.[category] ?? [])
        .map((t) => t?.tag)
        .filter((t): t is string => typeof t === "string");
    const description = book.description ?? "";
    const genres = tagNames("Genre");
    const moods = tagNames("Mood");
    return {
      ...base,
      status: statusFor(description, [...genres, ...moods]),
      ms: Math.round(performance.now() - start),
      description,
      genres,
      moods,
    };
  } catch (err) {
    return {
      ...base,
      status: "failed",
      ms: Math.round(performance.now() - start),
      description: "",
      genres: [],
      moods: [],
      error: errorMessage(err),
    };
  }
}

// All lookups for all picks run concurrently; a book with both IDs gets both. Never
// rejects — each lookup catches its own failure.
export async function lookupPickMetadata(picks: CheckedPick[]): Promise<PickMetadata[]> {
  return Promise.all(
    picks.map(async (pick) => {
      const pending: Promise<SourceLookup>[] = [];
      if (pick.record?.olWorkKey) pending.push(lookupOpenLibrary(pick.record.olWorkKey));
      if (pick.record?.hcBookId !== undefined) pending.push(lookupHardcover(pick.record.hcBookId));
      return { title: pick.title, author: pick.author, lookups: await Promise.all(pending) };
    }),
  );
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > DESCRIPTION_PREVIEW_CHARS
    ? `${flat.slice(0, DESCRIPTION_PREVIEW_CHARS)}…`
    : flat;
}

function formatList(items: string[]): string {
  return items.length ? items.join("; ") : "(none)";
}

// Same per-call console convention as formatPickSources. wallMs is measured by the caller
// around the awaited lookup step, so it is the real latency the step adds to the request.
export function formatPickMetadata(results: PickMetadata[], wallMs: number): string {
  const lookupCount = results.reduce((n, r) => n + r.lookups.length, 0);
  const lines = [
    `pickLookup: ${results.length} picks, ${lookupCount} lookups, added wall time=${wallMs}ms (timeout ${LOOKUP_TIMEOUT_MS}ms per lookup)`,
  ];
  for (const r of results) {
    lines.push(`  "${r.title}" — ${r.author}`);
    if (r.lookups.length === 0) lines.push("    no IDs on matched record — no lookups run");
    for (const l of r.lookups) {
      const head = `    ${l.source} ${l.id}: ${l.status} ${l.ms}ms`;
      lines.push(l.error ? `${head} — ${l.error}` : head);
      if (l.status === "failed") continue;
      lines.push(
        l.description.trim()
          ? `      description (${l.description.trim().length} chars): "${preview(l.description)}"`
          : "      description: (none)",
      );
      if (l.source === "openlibrary") {
        lines.push(`      subjects (${l.subjects.length}): ${formatList(l.subjects)}`);
      } else {
        lines.push(`      genres (${l.genres.length}): ${formatList(l.genres)}`);
        lines.push(`      moods (${l.moods.length}): ${formatList(l.moods)}`);
      }
    }
  }
  return lines.join("\n");
}
