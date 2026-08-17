// Investigation-only: test candidate Hardcover `books` orderings other than
// users_count desc (which reproduces the popularity-convergence bug this
// project has fought since July — see docs/progress-log.md + memory
// project_hardcover_taste_signal_investigation).
//
// Real sortable fields confirmed via schema introspection
// (hardcover-introspect-orderby.mjs -> scratchpad/hardcover-orderby-schema.json):
// books_order_by supports rating, release_date/release_year, users_count,
// ratings_count, reviews_count, etc. `taggable_counts` (root-queryable) has a
// per-(book,tag) `count` field -- the number of users who applied THAT specific
// tag to THAT book -- which is a genuine tag-relevance signal distinct from a
// book's overall users_count.
//
// Same 2 eval inputs + same tag IDs as last session's hardcover-ol-overlap-test.mjs
// so results are directly comparable:
//   Input A: tags [899] (Literary Fiction)
//   Input B: tags [899, 2795, 138, 148, 206, 192, 207] (lit fic + psych genres + mood tags)
import { readFileSync, writeFileSync } from "fs";
const envLocal = readFileSync("/workspaces/book-recommender/.env.local", "utf8");
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const token = process.env.HARDCOVER_API_TOKEN;
const endpoint = "https://api.hardcover.app/v1/graphql";
const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

async function hcGql(query, variables, maxRetries = 6) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {
      const wait = 1500 * (attempt + 1);
      console.error(`Rate limited, waiting ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) {
      throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 300)}`);
    }
    if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
    if (json.data === undefined) throw new Error(`No data (status ${res.status}): ${text.slice(0, 300)}`);
    return json.data;
  }
  throw new Error("Exceeded retries due to rate limiting");
}

const INPUTS = {
  A: { label: "Input A (vague: 'just something good to read')", tagIds: [899] },
  B: { label: "Input B (texture: 'granular sense of place, moral ambiguity')", tagIds: [899, 2795, 138, 148, 206, 192, 207] },
};

const DISPLAY_N = 15;
const WIDE_POOL_N = 100; // for the no-sort+shuffle strategy, pull wide before shuffling

// --- Strategy 1: current baseline, users_count desc (for reference/comparison) ---
async function strategyUsersCountDesc(tagIds) {
  const q = `
  query($tagIds: [Int!], $limit: Int!) {
    books(where: { taggings: { tag_id: { _in: $tagIds } } }, order_by: { users_count: desc }, limit: $limit) {
      title
      rating
      release_date
      users_count
      contributions(limit: 1) { author { name } }
    }
  }`;
  const data = await hcGql(q, { tagIds, limit: DISPLAY_N });
  return data.books.map(b => fmt(b));
}

// --- Strategy 2: no explicit sort, wide pool then shuffle client-side ---
async function strategyNoSortShuffled(tagIds) {
  const q = `
  query($tagIds: [Int!], $limit: Int!) {
    books(where: { taggings: { tag_id: { _in: $tagIds } } }, limit: $limit) {
      title
      rating
      release_date
      users_count
      contributions(limit: 1) { author { name } }
    }
  }`;
  const data = await hcGql(q, { tagIds, limit: WIDE_POOL_N });
  const pool = data.books.map(b => fmt(b));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DISPLAY_N);
}

// --- Strategy 3: rating desc (quality signal, not popularity) ---
async function strategyRatingDesc(tagIds) {
  const q = `
  query($tagIds: [Int!], $limit: Int!) {
    books(
      where: { taggings: { tag_id: { _in: $tagIds } }, rating: { _is_null: false } }
      order_by: { rating: desc }
      limit: $limit
    ) {
      title
      rating
      release_date
      users_count
      contributions(limit: 1) { author { name } }
    }
  }`;
  const data = await hcGql(q, { tagIds, limit: DISPLAY_N });
  return data.books.map(b => fmt(b));
}

// --- Strategy 4: recency, release_date desc ---
async function strategyRecencyDesc(tagIds) {
  const q = `
  query($tagIds: [Int!], $limit: Int!) {
    books(
      where: { taggings: { tag_id: { _in: $tagIds } }, release_date: { _is_null: false } }
      order_by: { release_date: desc }
      limit: $limit
    ) {
      title
      rating
      release_date
      users_count
      contributions(limit: 1) { author { name } }
    }
  }`;
  const data = await hcGql(q, { tagIds, limit: DISPLAY_N });
  return data.books.map(b => fmt(b));
}

// --- Strategy 5: tag-match relevance, via taggable_counts.count (per-tag applied-count),
// summed across the matched tags per book, desc. This is the "how strongly is this
// book tagged with what we searched for" signal, distinct from overall book popularity.
async function strategyTagRelevance(tagIds) {
  const q = `
  query($tagIds: [Int!], $limit: Int!) {
    taggable_counts(
      where: { tag_id: { _in: $tagIds }, taggable_type: { _eq: "Book" } }
      order_by: { count: desc }
      limit: $limit
    ) {
      count
      tag_id
      book {
        title
        rating
        release_date
        users_count
        contributions(limit: 1) { author { name } }
      }
    }
  }`;
  // pull a wider raw set since multiple rows (one per tag) can point at the same book
  const data = await hcGql(q, { tagIds, limit: WIDE_POOL_N });
  const byBook = new Map();
  for (const row of data.taggable_counts) {
    if (!row.book) continue;
    const key = `${row.book.title}|${row.book.contributions?.[0]?.author?.name ?? ""}`;
    const existing = byBook.get(key);
    if (existing) {
      existing.tagRelevanceSum += row.count;
    } else {
      byBook.set(key, { ...fmt(row.book), tagRelevanceSum: row.count });
    }
  }
  return [...byBook.values()]
    .sort((a, b) => b.tagRelevanceSum - a.tagRelevanceSum)
    .slice(0, DISPLAY_N);
}

function fmt(b) {
  return {
    title: b.title,
    author: b.contributions?.[0]?.author?.name ?? "",
    rating: b.rating,
    release_date: b.release_date,
    users_count: b.users_count,
  };
}

function printTable(label, rows) {
  console.log(`\n  ${label}`);
  rows.forEach((r, i) => {
    const extra = r.tagRelevanceSum !== undefined ? ` [tag-sum:${r.tagRelevanceSum}]` : "";
    console.log(
      `    ${String(i + 1).padStart(2)}. ${r.title} — ${r.author}  (rating:${r.rating ?? "—"}, users:${r.users_count ?? "—"}, released:${r.release_date ?? "—"})${extra}`
    );
  });
}

const results = {};
for (const [key, { label, tagIds }] of Object.entries(INPUTS)) {
  console.log(`\n\n########## ${label} ##########`);
  console.log(`Tag IDs: [${tagIds.join(", ")}]`);

  results[key] = {};

  const usersCount = await strategyUsersCountDesc(tagIds);
  printTable("STRATEGY: users_count desc (baseline / current bug)", usersCount);
  results[key].users_count_desc = usersCount;
  await new Promise(r => setTimeout(r, 400));

  const noSort = await strategyNoSortShuffled(tagIds);
  printTable(`STRATEGY: no explicit sort, wide pool (n=${WIDE_POOL_N}) then shuffled`, noSort);
  results[key].no_sort_shuffled = noSort;
  await new Promise(r => setTimeout(r, 400));

  const ratingDesc = await strategyRatingDesc(tagIds);
  printTable("STRATEGY: rating desc", ratingDesc);
  results[key].rating_desc = ratingDesc;
  await new Promise(r => setTimeout(r, 400));

  const recency = await strategyRecencyDesc(tagIds);
  printTable("STRATEGY: release_date desc (recency)", recency);
  results[key].recency_desc = recency;
  await new Promise(r => setTimeout(r, 400));

  const tagRelevance = await strategyTagRelevance(tagIds);
  printTable("STRATEGY: tag-match relevance (sum of taggable_counts.count across matched tags, desc)", tagRelevance);
  results[key].tag_relevance = tagRelevance;
  await new Promise(r => setTimeout(r, 400));
}

writeFileSync("scratchpad/hardcover-order-candidates-raw.json", JSON.stringify(results, null, 2));
console.log("\n\nRaw results saved to scratchpad/hardcover-order-candidates-raw.json");
