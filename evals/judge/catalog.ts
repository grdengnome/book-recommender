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

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const surname = (name: string) => norm(name).split(" ").pop() ?? "";

// Titles match when their main titles agree after normalising: a subtitle after ":", "(", a dash
// or " - " is ignored ("Salt: A World History" matches "Salt"; "Salt Fat Acid Heat" doesn't).
export const mainTitle = (t: string) => t.split(/\s*[:(—–]\s*|\s+-\s+/)[0];
export function titlesMatch(a: string, b: string): boolean {
  return norm(mainTitle(a)) === norm(mainTitle(b)) || norm(a) === norm(b);
}

export function authorsMatch(wanted: string, candidates: string[]): boolean {
  const s = surname(wanted);
  return !!s && candidates.some((c) => norm(c).split(" ").includes(s));
}

// A stricter author check for a search that had no author filter (title alone), where a common
// title plus a common surname could pick the wrong book. A candidate matches when either:
// - every part of the wanted name appears, in any order ("Kurlansky, Mark"; "Sōseki Natsume";
//   "García Márquez, Gabriel"), or
// - the surname appears and the first given name's initial agrees ("J.R.R. Tolkien" and
//   "John Ronald Reuel Tolkien"; "Ursula K. Le Guin" and "Ursula Le Guin").
// Accents, capitals, punctuation and hyphens are already ignored by norm().
export function authorsMatchStrict(wanted: string, candidates: string[]): boolean {
  // Co-authors ("Amal El-Mohtar and Max Gladstone"): any one of them matching is enough.
  const people = wanted.split(/\s*(?:,|&|\band\b)\s*/i).filter((p) => p.trim().split(/\s+/).length > 1);
  if (people.length > 1) return people.some((p) => authorsMatchStrict(p, candidates));
  const w = norm(wanted).split(" ").filter(Boolean);
  if (!w.length) return false;
  const s = w[w.length - 1];
  return candidates.some((cand) => {
    const c = norm(cand).split(" ").filter(Boolean);
    if (w.every((t) => c.includes(t))) return true;
    if (w.length < 2 || !c.includes(s)) return false;
    // "Surname, Given" lists the given names after the comma; otherwise they come first.
    const given = cand.includes(",") ? norm(cand.split(",").slice(1).join(" ")).split(" ").filter(Boolean) : c.filter((t) => t !== s);
    return given.length > 0 && given[0][0] === w[0][0];
  });
}

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

interface HcBook {
  title: string;
  users_count: number | null;
  pages: number | null;
  release_year: number | null;
  description: string | null;
  contributions: Array<{ author: { name: string } | null }>;
  cached_tags: Record<string, Array<{ tag?: string }>> | null;
}

const hcTags = (b?: HcBook) =>
  b ? ["Genre", "Mood"].flatMap((k) => (b.cached_tags?.[k] ?? []).map((t) => t.tag).filter((t): t is string => typeof t === "string")).slice(0, 25) : [];

// Catalogs file a subtitle separately from the main title, so a search sent with the subtitle
// ("Salt: A World History") can miss the book entirely. Open Library searches try the title as
// given, then the main title alone; titlesMatch and authorsMatch still decide what's a match.
const searchTitles = (title: string) => [...new Set([title, mainTitle(title)])].filter(Boolean);

// Hardcover's API refuses title pattern queries (_ilike), so the book is found with its search
// endpoint (title + author, the same call the cover research used), matched in code, then its
// tags and reader count are fetched by id.
// Hardcover allows about 60 requests a minute; the scorer looks up several picks at once, so its
// calls go out one at a time, at least a second apart (the rescore hit "429 Too Many Requests").
const HC_GAP_MS = 1100;
let hcQueue: Promise<unknown> = Promise.resolve();
function hcPaced<T>(fn: () => Promise<T>): Promise<T> {
  const turn = hcQueue.then(() => fn());
  hcQueue = turn.catch(() => undefined).then(() => new Promise((r) => setTimeout(r, HC_GAP_MS)));
  return turn;
}

interface HcHit { document: { id: number | string; title: string; author_names?: string[] } }
async function hardcoverBook(title: string, author: string): Promise<HcBook | undefined> {
  if (!process.env.HARDCOVER_API_TOKEN) throw new Error("HARDCOVER_API_TOKEN is not set");
  const found = await withRetry(() => hcPaced(() =>
    hcGraphql<{ search: { results: { hits?: HcHit[] } } }>(
      `query Find($q: String!) { search(query: $q, query_type: "Book", per_page: 10) { results } }`,
      { q: `${mainTitle(title)} ${author}` },
      AbortSignal.timeout(TIMEOUT_MS),
    ),
  ));
  // Hardcover often holds several records of one book (editions, re-imports). Every matching
  // record is fetched and the most-read one wins, so a famous book's real reader count is what
  // the judge sees, not a duplicate's handful (which would make it look like a discovery).
  const ids = (found.search?.results?.hits ?? [])
    .filter((h) => titlesMatch(h.document.title, title) && authorsMatch(author, h.document.author_names ?? []))
    .map((h) => Number(h.document.id));
  if (!ids.length) return undefined;
  const data = await withRetry(() => hcPaced(() =>
    hcGraphql<{ books: HcBook[] }>(
      `query Books($ids: [Int!]) { books(where: { id: { _in: $ids } }, order_by: { users_count: desc }, limit: 10) { title users_count pages release_year description contributions { author { name } } cached_tags } }`,
      { ids },
      AbortSignal.timeout(TIMEOUT_MS),
    ),
  ));
  return [...data.books].sort((a, b) => (b.users_count ?? 0) - (a.users_count ?? 0))[0];
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
