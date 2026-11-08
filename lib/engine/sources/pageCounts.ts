// Page counts for candidate books (decision 2.25), so a reader's length request can be enforced
// in code before the model chooses. One batched request per catalog: Open Library for books with
// a work key (the median page count across its editions), Hardcover for books found only there.
// Run only when the reader asked for a length. Counts are remembered in memory for a day, like
// subject lists, so repeat searches don't ask again.
//
// A failed or slow lookup leaves those books' length unknown, which the length filter treats
// like any unknown length: left out. Hard rules fail closed (decision 2.25).
import { hcGraphql } from "@/lib/engine/sources/hardcover/preparePool";

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const USER_AGENT = "book-recommender/0.1 (https://github.com/grdengnome/book-recommender)";
const LOOKUP_TIMEOUT_MS = 4000;
const BATCH = 100; // keys per Open Library request, well inside its URL limits
const REMEMBER_MS = 24 * 60 * 60 * 1000;

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
  if (!m || Date.now() - m.at > REMEMBER_MS) return undefined;
  return m.pages;
}

async function openLibraryPages(workKeys: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  for (let i = 0; i < workKeys.length; i += BATCH) {
    const batch = workKeys.slice(i, i + BATCH);
    const url = new URL(OPEN_LIBRARY_SEARCH_URL);
    url.searchParams.set("q", `key:(${batch.map((k) => `"${k}"`).join(" OR ")})`);
    url.searchParams.set("fields", "key,number_of_pages_median");
    url.searchParams.set("limit", String(batch.length));
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Open Library page counts: HTTP ${res.status}`);
    const data = (await res.json()) as { docs?: Array<{ key?: string; number_of_pages_median?: number }> };
    for (const k of batch) out.set(k, null);
    for (const d of data.docs ?? []) if (d.key) out.set(d.key, typeof d.number_of_pages_median === "number" ? d.number_of_pages_median : null);
  }
  return out;
}

async function hardcoverPages(ids: number[]): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>();
  if (!process.env.HARDCOVER_API_TOKEN) return out;
  const data = await hcGraphql<{ books: Array<{ id: number; pages: number | null }> }>(
    `query Pages($ids: [Int!]) { books(where: { id: { _in: $ids } }) { id pages } }`,
    { ids },
    AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  );
  for (const id of ids) out.set(id, null);
  for (const b of data.books) out.set(b.id, typeof b.pages === "number" && b.pages > 0 ? b.pages : null);
  return out;
}

// Returns each target's page count (undefined = unknown) in the same order, plus a report.
export async function pageCounts(targets: PageCountTarget[]): Promise<{ pages: Array<number | undefined>; report: PageCountReport }> {
  const report: PageCountReport = { asked: targets.length, known: 0, errors: [] };
  const needOl = [...new Set(targets.filter((t) => t.olWorkKey && remembered(olKey(t.olWorkKey)) === undefined).map((t) => t.olWorkKey!))];
  // Hardcover is asked only for books with no Open Library record.
  const needHc = [...new Set(targets.filter((t) => !t.olWorkKey && t.hcBookId !== undefined && remembered(hcKey(t.hcBookId)) === undefined).map((t) => t.hcBookId!))];

  await Promise.all([
    needOl.length
      ? (async () => {
          const start = performance.now();
          try {
            for (const [k, p] of await openLibraryPages(needOl)) memo.set(olKey(k), { pages: p, at: Date.now() });
          } catch (err) {
            report.errors.push(err instanceof Error ? err.message : String(err));
          }
          report.openLibraryMs = Math.round(performance.now() - start);
        })()
      : undefined,
    needHc.length
      ? (async () => {
          const start = performance.now();
          try {
            for (const [id, p] of await hardcoverPages(needHc)) memo.set(hcKey(id), { pages: p, at: Date.now() });
          } catch (err) {
            report.errors.push(err instanceof Error ? err.message : String(err));
          }
          report.hardcoverMs = Math.round(performance.now() - start);
        })()
      : undefined,
  ]);

  const pages = targets.map((t) => {
    // Open Library's median wins when present; Hardcover fills in for books only it has.
    const ol = t.olWorkKey ? remembered(olKey(t.olWorkKey)) : undefined;
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
