// Hardcover candidate pool prep — spec.md Section 5b (Hardcover supplements Open
// Library's pool; it does not filter or re-rank OL's results, per the merge decision
// logged 2026-08-15 / memory project-hardcover-taste-signal-investigation).
//
// Ranking strategy: tag-match relevance, not `users_count desc`. The 2026-08-16
// ordering investigation (scratchpad/hardcover-order-candidates-raw.json) tested
// users_count desc, rating desc, release_date desc, no-sort+shuffle, and tag-match
// relevance against the same 2 eval inputs — users_count desc reproduced the exact
// platform-wide popularity convergence (1984, Harry Potter, Animal Farm...) that
// this project has been fighting since July; rating desc and release_date desc each
// surfaced their own noise (near-1-user 5.0 ratings; near-all-2026 releases).
// Tag-match relevance — sum of `taggable_counts.count` (how many users applied THAT
// specific tag to THAT book) across the queried tag IDs — was the one that tracked
// the actual query rather than platform-wide or single-axis noise. Decided, not
// re-litigated here.
//
const HARDCOVER_ENDPOINT = "https://api.hardcover.app/v1/graphql";
const RAW_FETCH_LIMIT = 100; // taggable_counts rows pulled before summing/dedup — matches the depth used in the ordering test

// PROVISIONAL — only top-15 raw results were verified junk-free in the Aug 16
// ordering test (scratchpad/hardcover-order-candidates-raw.json). Revisit once
// top-30 is verified junk-free, or once eval output shows thin variety.
const WORKING_POOL_SIZE = 15;

interface TaggableCountRow {
  count: number;
  tag: { tag: string } | null;
  book: {
    title: string;
    users_count: number;
    contributions: { author: { name: string } | null }[];
  } | null;
}

interface RankedBook {
  title: string;
  author: string;
  matchedTags: string[];
  tagRelevanceSum: number;
  usersCount: number;
}

// Same shape as lib/tools/searchBooks.ts's BookCandidate (title, author, subjects) so
// a later merge step can dedupe across sources without a translation layer. usersCount
// is the one piece of ranking metadata kept — reserved for merge-time tiebreaking, not
// exposed to the model as a visible ranking signal (see step 6 of this pipeline).
export interface HardcoverBookCandidate {
  title: string;
  author: string;
  subjects: string[];
  usersCount: number;
}

export interface PreparePoolResult {
  pool: HardcoverBookCandidate[];
  poolSize: number;
}

async function hcGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = process.env.HARDCOVER_API_TOKEN;
  if (!token) throw new Error("HARDCOVER_API_TOKEN is not set");
  const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

  const res = await fetch(HARDCOVER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data as T;
}

// Step 1: retrieve books via the Hardcover tag query for the queried tags.
// Queries `taggable_counts` directly (root-queryable) rather than `books`, since it
// carries the per-(book, tag) `count` that step 2's ranking needs — `books` has no
// such field itself.
async function fetchTaggableCounts(tagIds: number[]): Promise<TaggableCountRow[]> {
  const query = `
    query BooksByTags($tagIds: [Int!], $limit: Int!) {
      taggable_counts(
        where: { tag_id: { _in: $tagIds }, taggable_type: { _eq: "Book" } }
        order_by: { count: desc }
        limit: $limit
      ) {
        count
        tag { tag }
        book {
          title
          users_count
          contributions(limit: 1) { author { name } }
        }
      }
    }`;
  const data = await hcGraphql<{ taggable_counts: TaggableCountRow[] }>(query, {
    tagIds,
    limit: RAW_FETCH_LIMIT,
  });
  return data.taggable_counts;
}

// Step 2: rank by tag-match relevance — sum matched-tag counts per book, descending.
// A book can appear once per matched tag it carries, so this also does the per-book
// dedup within this source (title+author key) before the pool ever reaches a
// cross-source merge.
function rankByTagRelevance(rows: TaggableCountRow[]): RankedBook[] {
  const byBook = new Map<string, RankedBook>();
  let droppedForNoAuthor = 0;

  for (const row of rows) {
    if (!row.book?.title) continue;
    const author = row.book.contributions[0]?.author?.name;
    if (!author) {
      droppedForNoAuthor++;
      continue;
    }
    const tagName = row.tag?.tag;

    const key = `${row.book.title.trim().toLowerCase()}::${author.trim().toLowerCase()}`;
    const existing = byBook.get(key);
    if (existing) {
      existing.tagRelevanceSum += row.count;
      if (tagName && !existing.matchedTags.includes(tagName)) existing.matchedTags.push(tagName);
    } else {
      byBook.set(key, {
        title: row.book.title,
        author,
        matchedTags: tagName ? [tagName] : [],
        tagRelevanceSum: row.count,
        usersCount: row.book.users_count,
      });
    }
  }

  if (droppedForNoAuthor > 0) {
    console.log(`prepareHardcoverPool: dropped ${droppedForNoAuthor} row(s) with no author`);
  }

  return [...byBook.values()].sort((a, b) => b.tagRelevanceSum - a.tagRelevanceSum);
}

// Step 4: Fisher-Yates shuffle — same algorithm as searchBooks.ts's position-bias
// mitigation. Order varies per call; which books qualified (step 2/3) does not.
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function prepareHardcoverPool(tagIds: number[]): Promise<PreparePoolResult> {
  const rows = await fetchTaggableCounts(tagIds); // 1: retrieve
  const ranked = rankByTagRelevance(rows); // 2: rank by tag-match relevance
  const truncated = ranked.slice(0, WORKING_POOL_SIZE); // 3: truncate to working pool size
  const shuffled = shuffle(truncated); // 4: shuffle within the truncated pool

  // 5+6: normalize to BookCandidate-compatible shape; strip ranking metadata
  // (tagRelevanceSum, matched-tag list beyond 2, raw ordering) except usersCount,
  // which is kept for merge-time tiebreaking only, not as a visible ranking field.
  const pool: HardcoverBookCandidate[] = shuffled.map((b) => ({
    title: b.title,
    author: b.author,
    subjects: b.matchedTags.slice(0, 2),
    usersCount: b.usersCount,
  }));

  return { pool, poolSize: pool.length };
}
