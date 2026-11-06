// Looks up a book's catalog facts for the judge (decision 3.8), independently of the engine: the
// judge must never rely on its memory of a book. Open Library search by title and author gives the
// description, subjects, page count and first year; Hardcover (when HARDCOVER_API_TOKEN is set)
// gives how many readers have it, a popularity signal for non-obviousness. A book that can't be
// found is reported as not found: for the plain-Claude baseline that's a real-and-correct risk.
import { hcGraphql } from "@/lib/engine/sources/hardcover/preparePool";

const OL = "https://openlibrary.org";
const UA = "book-recommender-evals/0.1 (https://github.com/grdengnome/book-recommender)";
const TIMEOUT_MS = 8000;

export interface CatalogFacts {
  found: boolean;
  title?: string;
  author?: string;
  firstYear?: number;
  pages?: number;
  subjects: string[];
  description: string;
  coverUrl?: string;
  hardcoverReaders?: number;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
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

async function hardcoverReaders(title: string): Promise<number | undefined> {
  if (!process.env.HARDCOVER_API_TOKEN) return undefined;
  try {
    const data = await hcGraphql<{ books: Array<{ users_count: number | null }> }>(
      `query Readers($title: String!) { books(where: { title: { _eq: $title } }, order_by: { users_count: desc }, limit: 1) { users_count } }`,
      { title },
      AbortSignal.timeout(TIMEOUT_MS),
    );
    return data.books[0]?.users_count ?? undefined;
  } catch {
    return undefined;
  }
}

export async function lookupFacts(title: string, author: string): Promise<CatalogFacts> {
  const params = new URLSearchParams({
    title,
    author,
    fields: "key,title,author_name,first_publish_year,number_of_pages_median,subject,cover_i",
    limit: "5",
  });
  let docs: OlDoc[] = [];
  try {
    docs = ((await getJson(`${OL}/search.json?${params}`)) as { docs?: OlDoc[] }).docs ?? [];
  } catch {
    docs = [];
  }
  // Prefer an exact-ish title match; the search is fuzzy.
  const wanted = norm(title);
  const doc = docs.find((d) => norm(d.title) === wanted) ?? docs.find((d) => norm(d.title).startsWith(wanted)) ?? docs[0];
  if (!doc) return { found: false, subjects: [], description: "", hardcoverReaders: await hardcoverReaders(title) };

  let description = "";
  try {
    const work = (await getJson(`${OL}${doc.key}.json`)) as { description?: string | { value?: string } };
    description = typeof work.description === "string" ? work.description : work.description?.value ?? "";
  } catch {
    description = "";
  }
  return {
    found: true,
    title: doc.title,
    author: doc.author_name?.[0],
    firstYear: doc.first_publish_year,
    pages: doc.number_of_pages_median,
    subjects: (doc.subject ?? []).slice(0, 30),
    description: description.slice(0, 1200),
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
    hardcoverReaders: await hardcoverReaders(doc.title),
  };
}
