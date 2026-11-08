// Page counts for candidate books (decision 2.25), so a reader's length request can be enforced
// in code before the model chooses. One batched request per catalog: Open Library for books with
// a work key (the median page count across its editions), Hardcover for books found only there.
// Run only when the reader asked for a length. Counts are remembered in memory for a day, like
// subject lists ("no count" for an hour, in case the reply was bad), so repeat searches don't ask
// again. Counts under 20 pages (ebook and audio records) are treated as unknown.
//
// A failed or slow lookup leaves those books' length unknown, which the length filter treats
// like any unknown length: left out. Hard rules fail closed (decision 2.25).
import { hcGraphql } from "@/lib/engine/sources/hardcover/preparePool";

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const USER_AGENT = "book-recommender/0.1 (https://github.com/grdengnome/book-recommender)";
const LOOKUP_TIMEOUT_MS = 4000;
const BATCH = 100; // keys per Open Library request, well inside its URL limits
const REMEMBER_MS = 24 * 60 * 60 * 1000; // a real page count
const REMEMBER_MISSING_MS = 60 * 60 * 1000; // "no count": a shorter memory, in case it was a bad reply
// Counts this low are ebook or audio records, not the book's length: treated as unknown.
const MIN_REAL_PAGES = 20;
const realPages = (p: unknown): number | null => (typeof p === "number" && p >= MIN_REAL_PAGES ? p : null);

export interface PageCountTarget {
  olWorkKey?: string;
  hcBookId?: number;
}

export interface PageCountReport {
  asked: number;
  known: number;
  openLibraryMs?: number;
  hardcoverMs?: number;
  errors: string[];
}

// key → pages (null = the catalog has no count), with when it was learned
const memo = new Map<string, { pages: number | null; at: number }>();
const olKey = (k: string) => `ol:${k}`;
const hcKey = (id: number) => `hc:${id}`;

function remembered(key: string): number | null | undefined {
  const m = memo.get(key);
  if (!m || Date.now() - m.at > (m.pages === null ? REMEMBER_MISSING_MS : REMEMBER_MS)) return undefined;
  return m.pages;
}

function rememberAll(entries: Iterable<[string, number | null]>, replyWasEmpty: boolean) {
  for (const [key, pages] of entries) {
    // An empty reply (an overloaded search) proves nothing about these books: don't remember it.
    if (pages === null && replyWasEmpty) continue;
    memo.set(key, { pages, at: Date.now() });
  }
}

// Batches of keys are fetched at the same time, not one after another. Each batch is remembered
// on its own, so one failed batch doesn't lose the others.
async function openLibraryPages(workKeys: string[], errors: string[]): Promise<void> {
  const batches: string[][] = [];
  for (let i = 0; i < workKeys.length; i += BATCH) batches.push(workKeys.slice(i, i + BATCH));
  await Promise.all(batches.map(async (batch) => {
    try {
      const url = new URL(OPEN_LIBRARY_SEARCH_URL);
      url.searchParams.set("q", `key:(${batch.map((k) => `"${k}"`).join(" OR ")})`);
      url.searchParams.set("fields", "key,number_of_pages_median");
      url.searchParams.set("limit", String(batch.length));
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Open Library page counts: HTTP ${res.status}`);
      const docs = ((await res.json()) as { docs?: Array<{ key?: string; number_of_pages_median?: number }> }).docs ?? [];
      const found = new Map<string, number | null>(batch.map((k) => [olKey(k), null]));
      for (const d of docs) if (d.key) found.set(olKey(d.key), realPages(d.number_of_pages_median));
      rememberAll(found, docs.length === 0);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }));
}

async function hardcoverPages(ids: number[], errors: string[]): Promise<void> {
  if (!process.env.HARDCOVER_API_TOKEN) return;
  try {
    const data = await hcGraphql<{ books: Array<{ id: number; pages: number | null }> }>(
      `query Pages($ids: [Int!], $limit: Int!) { books(where: { id: { _in: $ids } }, limit: $limit) { id pages } }`,
      { ids, limit: ids.length },
      AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    );
    const found = new Map<string, number | null>(ids.map((id) => [hcKey(id), null]));
    for (const b of data.books) found.set(hcKey(b.id), realPages(b.pages));
    rememberAll(found, data.books.length === 0);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
}

// Returns each target's page count (undefined = unknown) in the same order, plus a report.
export async function pageCounts(targets: PageCountTarget[]): Promise<{ pages: Array<number | undefined>; report: PageCountReport }> {
  const report: PageCountReport = { asked: targets.length, known: 0, errors: [] };
  const timed = async (field: "openLibraryMs" | "hardcoverMs", work: () => Promise<void>) => {
    const start = performance.now();
    await work();
    report[field] = Math.round(performance.now() - start);
  };

  // Open Library first, for every book with a work key.
  const needOl = [...new Set(targets.filter((t) => t.olWorkKey && remembered(olKey(t.olWorkKey)) === undefined).map((t) => t.olWorkKey!))];
  if (needOl.length) await timed("openLibraryMs", () => openLibraryPages(needOl, report.errors));

  // Hardcover for books it has that Open Library couldn't size (no record, or no count).
  const olCount = (t: PageCountTarget) => (t.olWorkKey ? remembered(olKey(t.olWorkKey)) : undefined);
  const needHc = [...new Set(targets
    .filter((t) => t.hcBookId !== undefined && typeof olCount(t) !== "number" && remembered(hcKey(t.hcBookId)) === undefined)
    .map((t) => t.hcBookId!))];
  if (needHc.length) await timed("hardcoverMs", () => hardcoverPages(needHc, report.errors));

  const pages = targets.map((t) => {
    const ol = olCount(t);
    if (typeof ol === "number") return ol;
    const hc = t.hcBookId !== undefined ? remembered(hcKey(t.hcBookId)) : undefined;
    return typeof hc === "number" ? hc : undefined;
  });
  report.known = pages.filter((p) => p !== undefined).length;
  return { pages, report };
}

// For tests: forget everything remembered.
export function clearPageCounts(): void {
  memo.clear();
}
