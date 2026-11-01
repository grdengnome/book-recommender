// Step 3b Part 1 — investigate whether case-8's ranks-16-30 problem (loose single-tag
// matches at relevance=1, mainstream-commercial titles) is specific to the `reflective`
// tag or a general pattern, across all four Step 2 tag sets. Mirrors preparePool.ts's
// fetch + rank logic directly (same query, same RAW_FETCH_LIMIT=100, same tag-relevance
// sum, same dedup key), read-only — no changes to the module itself.
import { readFileSync } from "fs";
const envLocal = readFileSync("/workspaces/book-recommender/.env.local", "utf8");
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const token = process.env.HARDCOVER_API_TOKEN;
const endpoint = "https://api.hardcover.app/v1/graphql";
const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
const RAW_FETCH_LIMIT = 100; // matches preparePool.ts

async function hcGql(query: string, variables: Record<string, unknown>) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

interface TaggableCountRow {
  count: number;
  tag: { tag: string } | null;
  book: { title: string; users_count: number; contributions: { author: { name: string } | null }[] } | null;
}

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
        book { title users_count contributions(limit: 1) { author { name } } }
      }
    }`;
  const data = await hcGql(query, { tagIds, limit: RAW_FETCH_LIMIT });
  return data.taggable_counts;
}

interface RankedBook {
  title: string;
  author: string;
  matchedTags: string[];
  tagRelevanceSum: number;
}

function rankByTagRelevance(rows: TaggableCountRow[]): RankedBook[] {
  const byBook = new Map<string, RankedBook>();
  for (const row of rows) {
    if (!row.book?.title) continue;
    const author = row.book.contributions[0]?.author?.name;
    if (!author) continue;
    const tagName = row.tag?.tag;
    const key = `${row.book.title.trim().toLowerCase()}::${author.trim().toLowerCase()}`;
    const existing = byBook.get(key);
    if (existing) {
      existing.tagRelevanceSum += row.count;
      if (tagName && !existing.matchedTags.includes(tagName)) existing.matchedTags.push(tagName);
    } else {
      byBook.set(key, { title: row.book.title, author, matchedTags: tagName ? [tagName] : [], tagRelevanceSum: row.count });
    }
  }
  return [...byBook.values()].sort((a, b) => b.tagRelevanceSum - a.tagRelevanceSum);
}

const CASES = [
  { id: "case-1", tags: ["reflective", "Literature", "Emotional", "classics"], tagIds: [2157, 3107, 774, 3434] },
  { id: "case-6", tags: ["Literature", "fiction", "psychology", "classics"], tagIds: [3107, 352, 500, 3434] },
  { id: "case-8", tags: ["Literature", "mysterious", "challenging", "reflective"], tagIds: [3107, 25510, 25511, 2157] },
  { id: "case-9", tags: ["nonfiction", "memoir", "thriller", "History"], tagIds: [146, 406, 14121, 2027] },
];

for (const c of CASES) {
  console.log(`\n\n########## ${c.id} — tags: ${c.tags.join(", ")} ##########`);
  const rows = await fetchTaggableCounts(c.tagIds);
  const ranked = rankByTagRelevance(rows);
  console.log(`Total ranked candidates: ${ranked.length}`);

  // Distribution by relevance score, split by 1-tag vs 2+-tag matches
  const byRelevance = new Map<number, { single: number; multi: number }>();
  for (const b of ranked) {
    const bucket = byRelevance.get(b.tagRelevanceSum) ?? { single: 0, multi: 0 };
    if (b.matchedTags.length >= 2) bucket.multi++;
    else bucket.single++;
    byRelevance.set(b.tagRelevanceSum, bucket);
  }
  console.log("\nRelevance-score distribution (relevance : single-tag-match count / multi-tag-match count):");
  for (const score of [...byRelevance.keys()].sort((a, b) => b - a)) {
    const { single, multi } = byRelevance.get(score)!;
    console.log(`  relevance=${score}: ${single} single-tag, ${multi} multi-tag`);
  }

  // Show every rank with title/author/tags so genre-fit can be eyeballed at each tier
  console.log("\nFull ranked list:");
  ranked.forEach((b, i) => {
    console.log(`  ${String(i + 1).padStart(3)}. [rel=${b.tagRelevanceSum}, tags=${b.matchedTags.join("/")}] ${b.title} — ${b.author}`);
  });
}
