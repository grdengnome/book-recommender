// Looks up a book's catalog facts for the judge (decision 3.8), independently of the engine: the
// judge must never rely on its memory of a book. Open Library first (description, subjects, page
// count, first year), then Hardcover when Open Library has no match (the engine picks from both),
// plus Hardcover's reader count as a popularity signal for non-obviousness.
//
// A match needs both the title and the author's surname to agree, so a made-up title can't borrow
// another book's facts. A network failure is reported as an error (and retried, and never cached
// by the caller), never as "this book doesn't exist".
import { hcGraphql } from "@/lib/engine/sources/hardcover/preparePool";

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
  description: string;
  coverUrl?: string;
  hardcoverReaders?: number;
  error?: string;
}

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const surname = (name: string) => norm(name).split(" ").pop() ?? "";

// Titles match when their main titles agree after normalising: a subtitle after ":", "(", a dash
// or " - " is ignored ("Salt: A World History" matches "Salt"; "Salt Fat Acid Heat" doesn't).
const mainTitle = (t: string) => t.split(/\s*[:(—–]\s*|\s+-\s+/)[0];
export function titlesMatch(a: string, b: string): boolean {
  return norm(mainTitle(a)) === norm(mainTitle(b)) || norm(a) === norm(b);
}

export function authorsMatch(wanted: string, candidates: string[]): boolean {
  const s = surname(wanted);
  return !!s && candidates.some((c) => norm(c).split(" ").includes(s));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
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
}

async function hardcoverBook(title: string, author: string): Promise<HcBook | undefined> {
  if (!process.env.HARDCOVER_API_TOKEN) return undefined;
  const data = await withRetry(() =>
    hcGraphql<{ books: HcBook[] }>(
      `query Book($title: String!) { books(where: { title: { _ilike: $title } }, order_by: { users_count: desc }, limit: 10) { title users_count pages release_year description contributions { author { name } } } }`,
      { title },
      AbortSignal.timeout(TIMEOUT_MS),
    ),
  );
  return data.books.find((b) => titlesMatch(b.title, title) && authorsMatch(author, b.contributions.map((c) => c.author?.name ?? "")));
}

export async function lookupFacts(title: string, author: string): Promise<CatalogFacts> {
  const empty = { subjects: [], description: "" };
  try {
    const params = new URLSearchParams({ title, author, fields: "key,title,author_name,first_publish_year,number_of_pages_median,subject,cover_i", limit: "10" });
    const docs = ((await getJson(`${OL}/search.json?${params}`)) as { docs?: OlDoc[] }).docs ?? [];
    const doc = docs.find((d) => titlesMatch(d.title, title) && authorsMatch(author, d.author_name ?? []));
    const hc = await hardcoverBook(title, author).catch(() => undefined);

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
        subjects: (doc.subject ?? []).slice(0, 30), description: (description || hc?.description || "").slice(0, 1200),
        coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
        hardcoverReaders: hc?.users_count ?? undefined,
      };
    }
    if (hc) {
      return {
        status: "found", found: true, source: "hardcover",
        title: hc.title, author: hc.contributions[0]?.author?.name, firstYear: hc.release_year ?? undefined, pages: hc.pages ?? undefined,
        ...empty, description: (hc.description ?? "").slice(0, 1200), hardcoverReaders: hc.users_count ?? undefined,
      };
    }
    return { status: "not_found", found: false, ...empty };
  } catch (err) {
    return { status: "error", found: false, ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}
