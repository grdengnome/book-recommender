// Step 3 verification: before/after WORKING_POOL_SIZE=15 -> 30 in preparePool.ts.
// Mirrors preparePool.ts's fetch + rank logic directly (same query, same tag-relevance
// sum, same dedup key) so the real pre-truncation, pre-shuffle rank order is visible —
// prepareHardcoverPool() itself only ever exposes the truncated+shuffled result, so a
// true "what would 15 vs 30 have kept" comparison needs the ranking recomputed here,
// same pattern as scratchpad/hardcover-diag-ranks16-30.mjs used for the original test.
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

async function fetchTaggableCounts(tagIds: number[]) {
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
  return data.taggable_counts as {
    count: number;
    tag: { tag: string } | null;
    book: { title: string; users_count: number; contributions: { author: { name: string } | null }[] } | null;
  }[];
}

function rankByTagRelevance(rows: ReturnType<typeof fetchTaggableCounts> extends Promise<infer R> ? R : never) {
  const byBook = new Map<string, { title: string; author: string; matchedTags: string[]; tagRelevanceSum: number; usersCount: number }>();
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
      byBook.set(key, { title: row.book.title, author, matchedTags: tagName ? [tagName] : [], tagRelevanceSum: row.count, usersCount: row.book.users_count });
    }
  }
  return [...byBook.values()].sort((a, b) => b.tagRelevanceSum - a.tagRelevanceSum);
}

// case-8's real tag IDs from the Step 2 verification run: Literature, mysterious, challenging, reflective
const CASE_8_TAG_IDS = [3107, 25510, 25511, 2157];

const rows = await fetchTaggableCounts(CASE_8_TAG_IDS);
const ranked = rankByTagRelevance(rows);

console.log(`Total ranked candidates available: ${ranked.length}`);
console.log("\n########## BEFORE — WORKING_POOL_SIZE=15 (ranks 1-15) ##########");
ranked.slice(0, 15).forEach((b, i) => console.log(`  ${String(i + 1).padStart(2)}. ${b.title} — ${b.author} (relevance=${b.tagRelevanceSum}, tags=${b.matchedTags.join("/")})`));

console.log("\n########## AFTER — WORKING_POOL_SIZE=30 (ranks 1-30) ##########");
ranked.slice(0, 30).forEach((b, i) => console.log(`  ${String(i + 1).padStart(2)}. ${b.title} — ${b.author} (relevance=${b.tagRelevanceSum}, tags=${b.matchedTags.join("/")})`));

console.log("\n########## The 15 NEWLY added candidates (ranks 16-30) ##########");
ranked.slice(15, 30).forEach((b, i) => console.log(`  ${String(i + 16).padStart(2)}. ${b.title} — ${b.author} (relevance=${b.tagRelevanceSum}, tags=${b.matchedTags.join("/")})`));
