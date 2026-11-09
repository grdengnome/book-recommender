// Finds a book's Hardcover record by title and author (decision 2.26). Hardcover's API refuses
// title pattern queries (_ilike), so this uses its search endpoint, keeps only hits whose title
// and author match (bookMatch.ts), then fetches every matching record and keeps the most-read
// one: Hardcover often holds several records of one book (editions, re-imports), and a
// duplicate's handful of readers would misrepresent it.
//
// Shared by the engine (Hardcover evidence for a pick's card, when the pick came from Open
// Library) and the eval judge's catalog lookups. A caller can wrap the API calls (the eval paces
// and retries them); the engine passes a timeout.
import { authorsMatch, mainTitle, titlesMatch } from "@/lib/engine/sources/bookMatch";
import { hcGraphql } from "@/lib/engine/sources/hardcover/preparePool";

export interface HardcoverBookRecord {
  id: number;
  title: string;
  users_count: number | null;
  pages: number | null;
  release_year: number | null;
  description: string | null;
  contributions: Array<{ author: { name: string } | null }>;
  cached_tags: Record<string, Array<{ tag?: string }>> | null;
}

type Gql = <T>(query: string, variables: Record<string, unknown>) => Promise<T>;

interface Hit {
  document: { id: number | string; title: string; author_names?: string[] };
}

export function hardcoverTags(b: Pick<HardcoverBookRecord, "cached_tags">, category: "Genre" | "Mood"): string[] {
  return (b.cached_tags?.[category] ?? []).map((t) => t?.tag).filter((t): t is string => typeof t === "string");
}

export async function findHardcoverBook(
  title: string,
  author: string,
  opts: { signal?: AbortSignal; gql?: Gql } = {},
): Promise<HardcoverBookRecord | undefined> {
  if (!process.env.HARDCOVER_API_TOKEN) throw new Error("HARDCOVER_API_TOKEN is not set");
  const gql: Gql = opts.gql ?? (<T,>(q: string, v: Record<string, unknown>) => hcGraphql<T>(q, v, opts.signal));
  const found = await gql<{ search: { results: { hits?: Hit[] } } }>(
    `query Find($q: String!) { search(query: $q, query_type: "Book", per_page: 10) { results } }`,
    { q: `${mainTitle(title)} ${author}` },
  );
  const ids = (found.search?.results?.hits ?? [])
    .filter((h) => titlesMatch(h.document.title, title) && authorsMatch(author, h.document.author_names ?? []))
    .map((h) => Number(h.document.id));
  if (!ids.length) return undefined;
  const data = await gql<{ books: HardcoverBookRecord[] }>(
    `query Books($ids: [Int!]) { books(where: { id: { _in: $ids } }, order_by: { users_count: desc }, limit: 10) { id title users_count pages release_year description contributions { author { name } } cached_tags } }`,
    { ids },
  );
  return [...data.books].sort((a, b) => (b.users_count ?? 0) - (a.users_count ?? 0))[0];
}
