// Looks up a book's catalog facts for the judge (decision 3.8), independently of the engine: the
// judge must never rely on its memory of a book. Open Library first (description, subjects, page
// count, first year), then Hardcover when Open Library has no match (the engine picks from both),
// plus Hardcover's reader count as a popularity signal for non-obviousness.
//
// A match needs both the title and the author's surname to agree, so a made-up title can't borrow
// another book's facts. A network failure is reported as an error (and retried, and never cached
// by the caller), never as "this book doesn't exist".
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hcGraphql } from "@/lib/engine/sources/hardcover/preparePool";
import { findHardcoverBook, hardcoverTags, type HardcoverBookRecord } from "@/lib/engine/sources/hardcover/findBook";

// A fingerprint of this file: saved catalog facts are reused only while the lookup rules are
// unchanged, so a fix here re-looks-up every book.
export const CATALOG_VERSION = createHash("sha256").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex").slice(0, 10);

const OL = "https://openlibrary.org";
const UA = "book-recommender-evals/0.1 (https://github.com/grdengnome/book-recommender)";
const TIMEOUT_MS = 8000;

export interface CatalogFacts {
  status: "found" | "not_found" | "error";
  found: boolean; // status === "found"
  source?: "openlibrary" | "hardcover";
  title?: string;
  author?: string;
  firstYear?: number;
  pages?: number;
  subjects: string[];
  // Hardcover readers' genre and mood tags ("Juvenile", "Horror", "Cozy"): often the clearest
  // evidence for audience and avoid rules, especially for lesser-known books with thin subjects.
  tags: string[];
  description: string;
  coverUrl?: string;
  hardcoverReaders?: number;
  // Set when the Hardcover lookup itself failed (not when the book just isn't there), so a broken
  // Hardcover connection shows on the scorecard instead of silently thinning the evidence.
  hardcoverError?: string;
  error?: string;
}

// Title and author matching lives in shared engine code (decision 2.26): the engine's card
// evidence and this checker must agree on which record is the same book.
export { authorsMatch, authorsMatchStrict, mainTitle, norm, titlesMatch } from "@/lib/engine/sources/bookMatch";
import { authorsMatch, authorsMatchStrict, mainTitle, titlesMatch } from "@/lib/engine/sources/bookMatch";

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      // A refusal (400–499 other than 429 "slow down") won't change on retry: fail at once.
      if (/(status|HTTP) 4(?!29)\d\d/.test(err instanceof Error ? err.message : String(err))) break;
      if (attempt === 2) break; // no point waiting after the last try
      const slowDown = /(status|HTTP) 429/.test(err instanceof Error ? err.message : String(err));
      await new Promise((r) => setTimeout(r, (slowDown ? 10_000 : 1000) * 2 ** attempt));
    }
  }
  throw last;
}

async function getJson(url: string): Promise<unknown> {
  return withRetry(async () => {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  });
}

interface OlDoc {
  key: string;
  title: string;
  author_name?: string[];
  // Romanised spellings: Open Library often lists a translated author in their own script first
  // (夏目漱石, Михаил Булгаков), with "Natsume Sōseki" or "Mikhail Bulgakov" only here.
  author_alternative_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  cover_i?: number;
}

type HcBook = HardcoverBookRecord;

const hcTags = (b?: HcBook) => (b ? [...hardcoverTags(b, "Genre"), ...hardcoverTags(b, "Mood")].slice(0, 25) : []);

// Catalogs file a subtitle separately from the main title, so a search sent with the subtitle
// ("Salt: A World History") can miss the book entirely. Open Library searches try the title as
// given, then the main title alone; titlesMatch and authorsMatch still decide what's a match.
const searchTitles = (title: string) => [...new Set([title, mainTitle(title)])].filter(Boolean);

// Hardcover allows about 60 requests a minute; the scorer looks up several picks at once, so its
// calls go out one at a time, at least a second apart (the rescore hit "429 Too Many Requests").
const HC_GAP_MS = 1100;
let hcQueue: Promise<unknown> = Promise.resolve();
function hcPaced<T>(fn: () => Promise<T>): Promise<T> {
  const turn = hcQueue.then(() => fn());
  hcQueue = turn.catch(() => undefined).then(() => new Promise((r) => setTimeout(r, HC_GAP_MS)));
  return turn;
}

// Finding the record is shared with the engine (findBook.ts); here its calls are paced and
// retried.
export async function hardcoverBook(title: string, author: string): Promise<HcBook | undefined> {
  return findHardcoverBook(title, author, {
    gql: <T,>(q: string, v: Record<string, unknown>) => withRetry(() => hcPaced(() => hcGraphql<T>(q, v, AbortSignal.timeout(TIMEOUT_MS)))),
  });
}

// Open Library's own author search is strict about spelling ("Natsume Soseki" vs "Sōseki", a
// translator listed first), so a last try searches by title alone and matches the author in code,
// where accents are already ignored.
async function openLibraryDoc(title: string, author: string): Promise<OlDoc | undefined> {
  const tries: Array<{ params: Record<string, string>; strict: boolean }> = [
    ...searchTitles(title).map((t) => ({ params: { title: t, author, limit: "10" }, strict: false })),
    // Last try: title alone, so the author check in code is the strict one.
    { params: { title: mainTitle(title), limit: "30" }, strict: true },
  ];
  for (const { params: p, strict } of tries) {
    const params = new URLSearchParams({ ...p, fields: "key,title,author_name,author_alternative_name,first_publish_year,number_of_pages_median,subject,cover_i" });
    const docs = ((await getJson(`${OL}/search.json?${params}`)) as { docs?: OlDoc[] }).docs ?? [];
    const match = strict ? authorsMatchStrict : authorsMatch;
    const doc = docs.find((d) => titlesMatch(d.title, title) && match(author, [...(d.author_name ?? []), ...(d.author_alternative_name ?? [])]));
    if (doc) return doc;
  }
  return undefined;
}

export async function lookupFacts(title: string, author: string): Promise<CatalogFacts> {
  const empty = { subjects: [], tags: [], description: "" };
  try {
    const doc = await openLibraryDoc(title, author);
    let hardcoverError: string | undefined;
    const hc = await hardcoverBook(title, author).catch((err) => {
      hardcoverError = (err instanceof Error ? err.message : String(err)).slice(0, 200);
      return undefined;
    });

    if (doc) {
      let description = "";
      try {
        const work = (await getJson(`${OL}${doc.key}.json`)) as { description?: string | { value?: string } };
        description = typeof work.description === "string" ? work.description : work.description?.value ?? "";
      } catch {
        description = "";
      }
      return {
        status: "found", found: true, source: "openlibrary",
        title: doc.title, author: doc.author_name?.[0], firstYear: doc.first_publish_year, pages: doc.number_of_pages_median,
        subjects: (doc.subject ?? []).slice(0, 30), tags: hcTags(hc), description: (description || hc?.description || "").slice(0, 1200),
        coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
        hardcoverReaders: hc?.users_count ?? undefined, hardcoverError,
      };
    }
    if (hc) {
      return {
        status: "found", found: true, source: "hardcover",
        title: hc.title, author: hc.contributions[0]?.author?.name, firstYear: hc.release_year ?? undefined, pages: hc.pages ?? undefined,
        ...empty, tags: hcTags(hc), description: (hc.description ?? "").slice(0, 1200), hardcoverReaders: hc.users_count ?? undefined,
      };
    }
    return { status: "not_found", found: false, ...empty, hardcoverError };
  } catch (err) {
    return { status: "error", found: false, ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}
