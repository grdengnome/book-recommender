// Diagnostic only — inspects ranks 16-30 of the tag-match-relevance ranking that
// lib/hardcover/preparePool.ts computes internally (fetchTaggableCounts ->
// rankByTagRelevance) but never exposes past WORKING_POOL_SIZE=15. Mirrors that
// module's query and ranking logic exactly (same RAW_FETCH_LIMIT=100, same sum-
// across-matched-tags, same title::author dedup key) without touching the module
// itself or its behavior — this is a read of what it already computes, not a
// change to what it does.
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

async function hcGql(query, variables) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function fetchTaggableCounts(tagIds) {
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
  const data = await hcGql(query, { tagIds, limit: RAW_FETCH_LIMIT });
  return data.taggable_counts;
}

function rankByTagRelevance(rows) {
  const byBook = new Map();
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
      byBook.set(key, {
        title: row.book.title,
        author,
        matchedTags: tagName ? [tagName] : [],
        tagRelevanceSum: row.count,
        usersCount: row.book.users_count,
      });
    }
  }
  return [...byBook.values()].sort((a, b) => b.tagRelevanceSum - a.tagRelevanceSum);
}

const INPUTS = {
  A: { label: "Input A (tag 899 only)", tagIds: [899] },
  B: { label: "Input B (7-tag set)", tagIds: [899, 2795, 138, 148, 206, 192, 207] },
};

for (const [key, { label, tagIds }] of Object.entries(INPUTS)) {
  console.log(`\n\n########## ${key}: ${label} — ranks 16-30 ##########`);
  const rows = await fetchTaggableCounts(tagIds);
  const ranked = rankByTagRelevance(rows);
  console.log(`Total distinct books ranked from this pull: ${ranked.length} (raw rows pulled: ${rows.length}, limited by RAW_FETCH_LIMIT=${RAW_FETCH_LIMIT})`);
  const slice = ranked.slice(15, 30);
  if (slice.length === 0) {
    console.log("  (no entries beyond rank 15 — ranked list is shorter than 16)");
  }
  slice.forEach((b, i) => {
    console.log(
      `  ${String(i + 16).padStart(2)}. ${b.title} — ${b.author}  [subjects: ${b.matchedTags.join(", ") || "(none)"}]  tagRelevanceSum: ${b.tagRelevanceSum}  (usersCount: ${b.usersCount})`
    );
  });
  await new Promise((r) => setTimeout(r, 500));
}
