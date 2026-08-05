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
      subject: input.subject,
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

export const searchBooksToolDefinition = {
  name: "search_books",
  description:
    "Search for real, existing books to ground recommendations in actual candidates rather than relying solely on trained knowledge. Runs a free-text relevance search and a controlled-vocabulary subject search in parallel and merges them into one deduplicated, shuffled, unordered candidate pool — order carries no meaning and must not influence which picks you favor. Call it again with broader or different terms if the pool comes back thin (under ~15-20 candidates) before falling back to trained knowledge.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description:
          "Free-text search terms describing the kind of book to find, e.g. \"quiet character study morally ambiguous\". Passed to Open Library's relevance-ranked search. Keep it short — 2-5 keywords, not a full descriptive sentence: Open Library's matching is stricter than a general web search, and longer, more sentence-like phrases tend to return zero results.",
      },
      subject: {
        type: "string",
        description:
          "A genre/subject guess in Open Library's controlled vocabulary, e.g. \"psychological_fiction\" or \"translated_literature\". Lowercase, underscores instead of spaces. Passed to a separate, stricter subject-tag search — give your best guess even if uncertain.",
      },
    },
    required: ["query", "subject"],
  },
};

interface RawCandidate {
  workId?: string;
  title: string;
  author: string;
  subjects: string[];
}

export interface BookCandidate {
  title: string;
  author: string;
  subjects: string[];
}

export interface SearchBooksResult {
  pool: BookCandidate[];
  poolSize: number;
}

export interface SearchBooksInput {
  query: string;
  subject: string;
}

async function fetchSearchResults(query: string): Promise<RawCandidate[]> {
  const url = new URL(OPEN_LIBRARY_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "key,title,author_name,subject");
  url.searchParams.set("limit", String(RESULTS_PER_CALL));

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return [];
    const data = await res.json();
    const docs: unknown[] = Array.isArray(data?.docs) ? data.docs : [];
    return docs
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
  } catch {
    return [];
  }
}

async function fetchSubjectResults(subject: string): Promise<RawCandidate[]> {
  const slug = subject.trim().toLowerCase().replace(/\s+/g, "_");
  if (!slug) return [];
  const url = `${OPEN_LIBRARY_SUBJECTS_URL}/${encodeURIComponent(slug)}.json?limit=${RESULTS_PER_CALL}`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return [];
    const data = await res.json();
    const works: unknown[] = Array.isArray(data?.works) ? data.works : [];
    return works
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
  } catch {
    return [];
  }
}

function dedupeKey(c: RawCandidate): string {
  if (c.workId) return c.workId;
  return `${c.title.trim().toLowerCase()}::${c.author.trim().toLowerCase()}`;
}

function mergeAndDedupe(a: RawCandidate[], b: RawCandidate[]): RawCandidate[] {
  const merged = new Map<string, RawCandidate>();
  for (const candidate of [...a, ...b]) {
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
): Promise<SearchBooksResult> {
  const [searchResults, subjectResults] = await Promise.all([
    fetchSearchResults(input.query),
    fetchSubjectResults(input.subject),
  ]);

  const merged = mergeAndDedupe(searchResults, subjectResults);
  const shuffled = shuffle(merged);

  // Strip work IDs and any other ranking/origin metadata — the model sees
  // only title, author, and a tag or two, never which call or rank a result came from.
  const pool: BookCandidate[] = shuffled.map((c) => ({
    title: c.title,
    author: c.author,
    subjects: c.subjects.slice(0, 2),
  }));

  logSearchBooksCall(input, pool);

  return { pool, poolSize: pool.length };
}
