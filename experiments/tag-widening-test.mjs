// THROWAWAY, read-only diagnostic. Does not modify mapTasteToTags.ts,
// preparePool.ts, tagVocabulary.ts, or any production file. Because those are
// TypeScript modules and this repo has no ts-node/tsx runtime available, the
// tag-selection and pool-prep logic below is reimplemented verbatim from what
// was just read in lib/hardcover/mapTasteToTags.ts and
// lib/hardcover/preparePool.ts (same constants, same query, same ranking/floor
// logic) rather than imported. HARDCOVER_TAG_VOCABULARY's data is extracted
// directly from tagVocabulary.ts's source text (read, not copied by hand) so
// the real 153-tag list is used, not a hand-typed subset.

import fs from "fs";

const apiKey = fs.readFileSync(".env.local","utf8").match(/^ANTHROPIC_API_KEY=(.*)$/m)[1].trim();
const hcToken = fs.readFileSync(".env.local","utf8").match(/^HARDCOVER_API_TOKEN=(.*)$/m)[1].trim();

// --- extract real vocabulary from tagVocabulary.ts (read-only) ---
const vocabSrc = fs.readFileSync("lib/hardcover/tagVocabulary.ts", "utf8");
const vocabMatch = vocabSrc.match(/export const HARDCOVER_TAG_VOCABULARY:.*?=\s*(\[[\s\S]*?\]);/);
if (!vocabMatch) throw new Error("Could not extract HARDCOVER_TAG_VOCABULARY");
const HARDCOVER_TAG_VOCABULARY = eval(vocabMatch[1]);
console.log(`Loaded ${HARDCOVER_TAG_VOCABULARY.length} real vocabulary tags from tagVocabulary.ts`);

// --- constants, copied verbatim from preparePool.ts ---
const RAW_FETCH_LIMIT = 100;
const WORKING_POOL_SIZE = 30;
const RELEVANCE_FLOOR = 2;
const HARDCOVER_ENDPOINT = "https://api.hardcover.app/v1/graphql";

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// --- reimplemented from mapTasteToTags.ts ---
function buildPrompt(tasteDescription, candidateNames, minTags, maxTags) {
  return `A reader described the kind of book they want like this:

"${tasteDescription}"

Here is a list of tags from a book-tagging platform. Pick ${minTags}-${maxTags} tags from this exact list that best represent this reader's taste:

${candidateNames.map((name) => `- ${name}`).join("\n")}

Many of these tags are broad, generic descriptors ("dark", "mysterious", "fiction") that could technically apply to a huge range of books. Others are much more specific to a particular texture, theme, or trope. When a more specific tag on the list genuinely fits the reader's description, prefer it over a broader one that only loosely applies — the goal is tags that distinguish this taste input from a different one, not tags that are safe to apply to almost anything. Don't force a fit: if nothing on the list is a good match for some aspect of the description, it's fine to leave that aspect unrepresented rather than reaching for a loosely-related tag.

Respond with ONLY a JSON array of the tag strings you picked, copied exactly as they appear in the list above — no prose before or after it.`;
}

function extractJsonArraySpan(responseText) {
  let searchFrom = 0;
  while (true) {
    const start = responseText.indexOf("[", searchFrom);
    if (start === -1) break;
    let depth = 0;
    for (let i = start; i < responseText.length; i++) {
      const ch = responseText[i];
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          const candidate = responseText.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed)) return candidate;
          } catch {}
          break;
        }
      }
    }
    searchFrom = start + 1;
  }
  throw new Error(`No JSON array found in response: ${responseText}`);
}

async function mapTasteToHardcoverTags(tasteDescription, minTags, maxTags) {
  const shuffledVocabulary = shuffle([...HARDCOVER_TAG_VOCABULARY]);
  const prompt = buildPrompt(tasteDescription, shuffledVocabulary.map((t) => t.tag), minTags, maxTags);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic API error: ${JSON.stringify(data)}`);
  const textBlock = data.content?.find((b) => b.type === "text");
  const span = extractJsonArraySpan(textBlock?.text ?? "[]");
  const selected = JSON.parse(span).filter((t) => typeof t === "string");

  const byName = new Map(HARDCOVER_TAG_VOCABULARY.map((t) => [t.tag, t]));
  const matched = selected.map((name) => byName.get(name)).filter((t) => t !== undefined);
  return { tagIds: matched.map((t) => t.id), tagNames: matched.map((t) => t.tag) };
}

// --- reimplemented from preparePool.ts ---
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

async function preparePoolFull(tagIds) {
  const rows = await fetchTaggableCounts(tagIds);
  const ranked = rankByTagRelevance(rows); // full ranked list, no floor/cap yet
  return ranked;
}

// --- test cases (same taste inputs as prior diagnostics) ---
const CASES = [
  { id: "case-1", tasteDescription:
    "My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book." },
  { id: "case-3", tasteDescription: "Just something good to read." },
  { id: "case-6", tasteDescription:
    "I love literary fiction — character studies, beautiful prose, morally complicated people. I will not read fantasy under any circumstances: no magic systems, no invented worlds." },
];

const results = [];
for (const c of CASES) {
  const baseline = await mapTasteToHardcoverTags(c.tasteDescription, 2, 4);
  const widened = await mapTasteToHardcoverTags(c.tasteDescription, 5, 8);

  const baselineRanked = await preparePoolFull(baseline.tagIds);
  const widenedRanked = await preparePoolFull(widened.tagIds);

  const baselineKeys = new Set(baselineRanked.map((b) => b.key));
  const baselinePoolSizeCapped = baselineRanked.filter((b) => b.tagRelevanceSum >= RELEVANCE_FLOOR).slice(0, WORKING_POOL_SIZE).length;
  const widenedPoolSizeCapped = widenedRanked.filter((b) => b.tagRelevanceSum >= RELEVANCE_FLOOR).slice(0, WORKING_POOL_SIZE).length;
  const widenedPassFloorUncapped = widenedRanked.filter((b) => b.tagRelevanceSum >= RELEVANCE_FLOOR).length;

  const newCandidates = widenedRanked.filter((b) => !baselineKeys.has(b.key));
  const newPassed = newCandidates.filter((b) => b.tagRelevanceSum >= RELEVANCE_FLOOR).length;
  const newNoise = newCandidates.length - newPassed;

  const row = {
    id: c.id,
    baselineTags: baseline.tagNames,
    widenedTags: widened.tagNames,
    baselinePoolSizeCapped,
    widenedPoolSizeCapped,
    widenedPassFloorUncapped,
    newCandidatesTotal: newCandidates.length,
    newPassed,
    newNoise,
  };
  console.log(JSON.stringify(row));
  results.push(row);
}

fs.writeFileSync("scratchpad/tag-widening-test-results.json", JSON.stringify(results, null, 2));
console.log("done");
