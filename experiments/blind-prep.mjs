// THROWAWAY, read-only. Reconstructs case-1's exact baseline/widened Hardcover
// pools from the tag sets already selected in tag-widening-test-results.json
// (re-fetching Hardcover deterministically by tag ID, not re-calling the LLM
// tag-selector, so this reproduces the SAME pools already reported, not a
// fresh/different run). Builds a blinded comparison list + a hidden key file.
// Does not touch any production file.

import fs from "fs";

const hcToken = fs.readFileSync(".env.local","utf8").match(/^HARDCOVER_API_TOKEN=(.*)$/m)[1].trim();
const HARDCOVER_ENDPOINT = "https://api.hardcover.app/v1/graphql";
const RAW_FETCH_LIMIT = 100;
const RELEVANCE_FLOOR = 2;

const vocabSrc = fs.readFileSync("lib/hardcover/tagVocabulary.ts", "utf8");
const vocabMatch = vocabSrc.match(/export const HARDCOVER_TAG_VOCABULARY:.*?=\s*(\[[\s\S]*?\]);/);
const VOCAB = eval(vocabMatch[1]);
const idByName = new Map(VOCAB.map(t => [t.tag, t.id]));

const priorResults = JSON.parse(fs.readFileSync("scratchpad/tag-widening-test-results.json", "utf8"));
const case1 = priorResults.find(r => r.id === "case-1");
const baselineTagIds = case1.baselineTags.map(n => idByName.get(n));
const widenedTagIds = case1.widenedTags.map(n => idByName.get(n));

async function hcGraphql(query, variables) {
  const auth = hcToken.startsWith("Bearer ") ? hcToken : `Bearer ${hcToken}`;
  const res = await fetch(HARDCOVER_ENDPOINT, {
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
        book { title users_count contributions(limit: 1) { author { name } } }
      }
    }`;
  const data = await hcGraphql(query, { tagIds, limit: RAW_FETCH_LIMIT });
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
      byBook.set(key, { key, title: row.book.title, author, matchedTags: tagName ? [tagName] : [], tagRelevanceSum: row.count });
    }
  }
  return [...byBook.values()].sort((a, b) => b.tagRelevanceSum - a.tagRelevanceSum);
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const baselineRows = await fetchTaggableCounts(baselineTagIds);
const widenedRows = await fetchTaggableCounts(widenedTagIds);
const baselineRanked = rankByTagRelevance(baselineRows).filter(b => b.tagRelevanceSum >= RELEVANCE_FLOOR);
const widenedRanked = rankByTagRelevance(widenedRows).filter(b => b.tagRelevanceSum >= RELEVANCE_FLOOR);

const baselineKeys = new Set(baselineRanked.map(b => b.key));
const widenedOnly = widenedRanked.filter(b => !baselineKeys.has(b.key));

console.error(`sanity check: baseline=${baselineRanked.length} (expect ~17), widenedOnly=${widenedOnly.length} (expect ~56)`);

const sample15 = shuffle(widenedOnly).slice(0, 15);

const combined = [
  ...baselineRanked.map(b => ({ ...b, origin: "baseline" })),
  ...sample15.map(b => ({ ...b, origin: "widened" })),
];
const shuffledCombined = shuffle(combined);

const blindedList = [];
const hiddenKey = {};
shuffledCombined.forEach((b, i) => {
  const id = `A${i + 1}`;
  blindedList.push({ id, title: b.title, author: b.author, tags: b.matchedTags.slice(0, 2) });
  hiddenKey[id] = b.origin;
});

fs.writeFileSync("scratchpad/blind-key.json", JSON.stringify(hiddenKey, null, 2));
fs.writeFileSync("scratchpad/blind-list.json", JSON.stringify(blindedList, null, 2));
console.error(`Wrote blinded list (${blindedList.length} items) and hidden key.`);
