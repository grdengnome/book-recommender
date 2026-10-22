// search_books — spec.md Section 5b. Grounds recommendations in real, retrieved
// candidates instead of the model's own narrow "go-to" pool (see docs/eval-log.md,
// 2026-07-08, for the evidence that motivated this).

// --- TEMPORARY DIAGNOSTIC LOGGING (2026-08-03 query-tracing session) ---
// Traces what query/subject pairs the model actually generates per eval case, to
// check whether structurally different taste inputs converge on similar search
// terms. Observation only — does not touch retrieval, dedupe, or shuffle logic
// below. Remove once the query-log.json results have been reviewed.
import { appendFileSync, mkdirSync } from "fs";
import path from "path";
import { noopTrace, type RequestTrace } from "../trace/requestTrace";

let currentLogTag: string | null = null;

// Called by the eval driver (via route.ts's optional evalTag passthrough) before
// each case, so every search_books call made during that case's tool loop is
// tagged. Never called in normal (non-eval) request handling, where it stays null.
export function setSearchBooksLogTag(tag: string | null): void {
  currentLogTag = tag;
}

const QUERY_LOG_PATH = path.join(process.cwd(), "scratchpad", "query-log.json");

// Newline-delimited JSON, not a single JSON array — search_books calls within a
// round can run concurrently (route.ts fires tool_use blocks via Promise.all), and
// synchronous line-appends avoid a read-modify-write race across those calls.
// `pool` is logged in full (title + author) so cross-case title repeats can be
// checked against the actual raw candidates each call saw, not just the count.
function logSearchBooksCall(input: SearchBooksInput, pool: BookCandidate[]): void {
  try {
    mkdirSync(path.dirname(QUERY_LOG_PATH), { recursive: true });
    const entry = {
      tag: currentLogTag,
      timestamp: new Date().toISOString(),
      query: input.query,
      subjects: input.subjects,
      poolSize: pool.length,
      pool: pool.map((c) => ({ title: c.title, author: c.author })),
    };
    appendFileSync(QUERY_LOG_PATH, JSON.stringify(entry) + "\n");
  } catch {
    // Diagnostic logging must never break the actual tool call.
  }
}
// --- END TEMPORARY DIAGNOSTIC LOGGING ---

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const OPEN_LIBRARY_SUBJECTS_URL = "https://openlibrary.org/subjects";
const USER_AGENT = "book-recommender/0.1 (https://github.com/grdengnome/book-recommender)";
const RESULTS_PER_CALL = 100;

// Speed (fix PR 1, 2026-10-21): no lookup waits longer than this. Across 127 traced lookups
// p95 was 3.0s, but one took 10.0s and one 30.7s, and the slowest lookup holds up the
// whole request. A timed-out lookup is reported as failed and contributes no books, like
// any other failed lookup; the rest of the call's lookups still count.
const LOOKUP_TIMEOUT_MS = 5000;

// Speed (fix PR 1, 2026-10-21): subject lists are cached for 24h in Next's Data Cache
// (fetch `next.revalidate`; this app doesn't use Cache Components). They're ordered by
// edition count and change slowly, and the same subjects recur across readers: over the
// search log (Aug 20 – Oct 21), 56% of subject lookups repeated one from a different eval
// case within 24h. Free-text search isn't cached; its queries rarely repeat.
const SUBJECT_CACHE_SECONDS = 24 * 60 * 60;

export const searchBooksToolDefinition = {
  name: "search_books",
  description:
    "Search for real, existing books and get back a candidate pool. Every recommendation you make must be selected from a pool returned by this tool — a book that is not in a returned pool cannot be recommended. Runs a free-text relevance search plus a controlled-vocabulary subject search against every subject you list, then merges everything into one deduplicated, shuffled, unordered candidate pool — order carries no meaning and must not influence which picks you favor. Call it again with broader or different terms if the pool comes back thin (under ~15-20 candidates); never fill a thin pool from trained knowledge.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description:
          "Free-text search terms describing the kind of book to find, e.g. \"quiet character study morally ambiguous\". Passed to Open Library's relevance-ranked search. Keep it short — 2-5 keywords, not a full descriptive sentence: Open Library's matching is stricter than a general web search, and longer, more sentence-like phrases tend to return zero results.",
      },
      subjects: {
        type: "array",
        items: { type: "string" },
        description:
          "One or more genre/subject guesses in Open Library's controlled vocabulary, e.g. [\"psychological_fiction\", \"translated_literature\"]. Lowercase, underscores instead of spaces. Each is queried separately and merged into the pool — list a few different angles on the taste input (2-3 is usually enough) rather than just one, since a single subject guess tends to produce a narrower, more repetitive pool. Give your best guesses even if uncertain.",
      },
    },
    required: ["query", "subjects"],
  },
};

interface RawCandidate {
  workId?: string;
  title: string;
  author: string;
  subjects: string[];
}

// How one Open Library request went — reported to the trace only (searchBooks passes a
// reporter only when tracing is on). Failures still return [] to the caller as before.
interface LookupReport {
  lookup: string; // "search" or "subject:<slug>"
  status: "ok" | "http_error" | "failed";
  httpStatus?: number;
  error?: string;
  ms: number;
  rawCount: number; // records returned before dropping ones with no title or author
  results: RawCandidate[];
}
type LookupReporter = (report: LookupReport) => void;

// olWorkKey is internal plumbing (e.g. "/works/OL1174972W"), carried so a final pick can
// be traced back to its Open Library work record. Never model-facing: route.ts strips it
// (via mergeCandidatePools.ts's toModelPool) before the pool goes into a tool_result.
export interface BookCandidate {
  title: string;
  author: string;
  subjects: string[];
  olWorkKey?: string;
}

export interface SearchBooksResult {
  pool: BookCandidate[];
  poolSize: number;
}

export interface SearchBooksInput {
  query: string;
  subjects: string[];
}

function lookupError(err: unknown): string {
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return `timeout after ${LOOKUP_TIMEOUT_MS}ms`;
  }
  return err instanceof Error ? err.message : String(err);
}

async function fetchSearchResults(query: string, report?: LookupReporter): Promise<RawCandidate[]> {
  const url = new URL(OPEN_LIBRARY_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "key,title,author_name,subject");
  url.searchParams.set("limit", String(RESULTS_PER_CALL));
  const start = performance.now();
  const done = (r: Omit<LookupReport, "lookup" | "ms">) =>
    report?.({ lookup: "search", ms: Math.round(performance.now() - start), ...r });

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!res.ok) {
      done({ status: "http_error", httpStatus: res.status, rawCount: 0, results: [] });
      return [];
    }
    const data = await res.json();
    const docs: unknown[] = Array.isArray(data?.docs) ? data.docs : [];
    const results = docs
      .map((doc): RawCandidate | null => {
        const d = doc as {
          key?: string;
          title?: string;
          author_name?: string[];
          subject?: string[];
        };
        if (!d.title || !d.author_name?.[0]) return null;
        return {
          workId: d.key,
          title: d.title,
          author: d.author_name[0],
          subjects: (d.subject ?? []).slice(0, 2),
        };
      })
      .filter((c): c is RawCandidate => c !== null);
    done({ status: "ok", httpStatus: res.status, rawCount: docs.length, results });
    return results;
  } catch (err) {
    done({ status: "failed", error: lookupError(err), rawCount: 0, results: [] });
    return [];
  }
}

async function fetchSubjectResults(subject: string, report?: LookupReporter): Promise<RawCandidate[]> {
  const slug = subject.trim().toLowerCase().replace(/\s+/g, "_");
  if (!slug) return [];
  const url = `${OPEN_LIBRARY_SUBJECTS_URL}/${encodeURIComponent(slug)}.json?limit=${RESULTS_PER_CALL}`;
  const start = performance.now();
  const done = (r: Omit<LookupReport, "lookup" | "ms">) =>
    report?.({ lookup: `subject:${slug}`, ms: Math.round(performance.now() - start), ...r });

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      next: { revalidate: SUBJECT_CACHE_SECONDS },
    });
    if (!res.ok) {
      done({ status: "http_error", httpStatus: res.status, rawCount: 0, results: [] });
      return [];
    }
    const data = await res.json();
    const works: unknown[] = Array.isArray(data?.works) ? data.works : [];
    const results = works
      .map((work): RawCandidate | null => {
        const w = work as {
          key?: string;
          title?: string;
          authors?: { name?: string }[];
        };
        if (!w.title || !w.authors?.[0]?.name) return null;
        return {
          workId: w.key,
          title: w.title,
          author: w.authors[0].name,
          subjects: [slug],
        };
      })
      .filter((c): c is RawCandidate => c !== null);
    done({ status: "ok", httpStatus: res.status, rawCount: works.length, results });
    return results;
  } catch (err) {
    done({ status: "failed", error: lookupError(err), rawCount: 0, results: [] });
    return [];
  }
}

function dedupeKey(c: RawCandidate): string {
  if (c.workId) return c.workId;
  return `${c.title.trim().toLowerCase()}::${c.author.trim().toLowerCase()}`;
}

function mergeAndDedupe(groups: RawCandidate[][]): RawCandidate[] {
  const merged = new Map<string, RawCandidate>();
  for (const candidate of groups.flat()) {
    const key = dedupeKey(candidate);
    if (!merged.has(key)) merged.set(key, candidate);
  }
  return [...merged.values()];
}

// Fisher-Yates. This is the core position-bias mitigation from spec.md 5b —
// candidates must arrive in no particular order, every time, no exceptions.
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function searchBooks(
  input: SearchBooksInput,
  trace: RequestTrace = noopTrace,
): Promise<SearchBooksResult> {
  const start = performance.now();
  const reports: LookupReport[] = [];
  const report: LookupReporter | undefined = trace.enabled ? (r) => reports.push(r) : undefined;
  const [searchResults, ...subjectResultGroups] = await Promise.all([
    fetchSearchResults(input.query, report),
    ...input.subjects.map((subject) => fetchSubjectResults(subject, report)),
  ]);

  const merged = mergeAndDedupe([searchResults, ...subjectResultGroups]);
  const shuffled = shuffle(merged);

  // Strip ranking/origin metadata — the model sees only title, author, and a tag or
  // two, never which call or rank a result came from. The work key is kept internally
  // for pick tracing; it is removed before the model sees the pool (route.ts).
  const pool: BookCandidate[] = shuffled.map((c) => ({
    title: c.title,
    author: c.author,
    subjects: c.subjects.slice(0, 2),
    ...(c.workId ? { olWorkKey: c.workId } : {}),
  }));

  logSearchBooksCall(input, pool);

  if (trace.enabled) {
    // Which lookup(s) found each book — the attribution scratchpad/attribute-pool-sources.mjs
    // otherwise has to reconstruct by re-running queries.
    const foundBy = new Map<string, string[]>();
    for (const r of reports) {
      for (const c of r.results) {
        const labels = foundBy.get(dedupeKey(c)) ?? [];
        if (!labels.includes(r.lookup)) labels.push(r.lookup);
        foundBy.set(dedupeKey(c), labels);
      }
    }
    trace.add("D", {
      kind: "result",
      input,
      ms: Math.round(performance.now() - start),
      lookups: reports.map(({ results, ...rest }) => ({ ...rest, keptCount: results.length })),
      keptBeforeDedup: reports.reduce((n, r) => n + r.results.length, 0),
      poolSize: pool.length,
      pool: shuffled.map((c, i) => ({ ...pool[i], foundBy: foundBy.get(dedupeKey(c)) ?? [] })),
    });
  }

  return { pool, poolSize: pool.length };
}
