// OL-vs-Hardcover overlap test, run before building the merge, per the open
// question flagged in this session's supplement-vs-filter reasoning: is
// Hardcover's tag-matched pool actually diverse from Open Library's pool, or
// does it just re-surface the same books?
//
// Two real eval taste-inputs (docs/eval-set.md), using the actual OL subject
// guesses logged for them in docs/eval-log.md (2026-08-03/04 runs):
//   Input A — case 3, vague ("just something good to read") -> subject: literary_fiction
//   Input B — case 8, texture-match ("granular sense of place, moral ambiguity")
//             -> subjects: literary_fiction + psychological_fiction
//
// For Hardcover, real tags were discovered first (hardcover-tag-discovery.mjs)
// since Hardcover's tag vocabulary has NO tag at all for "atmospheric",
// "moral ambiguity", "sense of place", or "quiet" (checked, zero hits at
// count>50) — that absence is itself part of the result, not a script bug.
// Closest real proxies used: Genre "Literary Fiction"/"psychological fiction"/
// "Psychological thriller", Mood "dark"/"tense"/"reflective"/"mysterious".
//
// Dedup key matches the one proposed for the merge: normalize(title) + "|" +
// normalize(primary_author_lastname), exact match (not fuzzy), per this
// session's part-1 decision.
import { readFileSync, writeFileSync } from "fs";
const envLocal = readFileSync("/workspaces/book-recommender/.env.local", "utf8");
for (const line of envLocal.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const token = process.env.HARDCOVER_API_TOKEN;
const hcEndpoint = "https://api.hardcover.app/v1/graphql";
const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

async function hcGql(query, variables, maxRetries = 6) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(hcEndpoint, {
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

// --- Dedup key (matches part-1 proposal) ---
function normTitle(t) {
  return (t ?? "")
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function normAuthorLastName(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase().replace(/[^\w]/g, "");
}
function dedupKey(title, author) {
  return `${normTitle(title)}|${normAuthorLastName(author)}`;
}

// --- Open Library pulls ---
async function fetchOLSubject(slug, limit = 30) {
  const url = `https://openlibrary.org/subjects/${slug}.json?limit=${limit}`;
  const res = await fetch(url);
  const json = await res.json();
  return (json.works ?? []).map(w => ({
    title: w.title,
    author: w.authors?.[0]?.name ?? "",
    source: `OL:${slug}`,
  }));
}

// --- Hardcover pulls: books carrying ANY of the given tag ids ---
async function fetchHCByTags(tagIds, limit = 30) {
  const q = `
  query BooksByTags($tagIds: [Int!], $limit: Int!) {
    books(
      where: { taggings: { tag_id: { _in: $tagIds } } }
      order_by: { users_count: desc }
      limit: $limit
    ) {
      title
      contributions(limit: 1) { author { name } }
    }
  }`;
  const data = await hcGql(q, { tagIds, limit });
  return (data.books ?? []).map(b => ({
    title: b.title,
    author: b.contributions?.[0]?.author?.name ?? "",
    source: "Hardcover",
  }));
}

function toKeyedMap(pool) {
  const m = new Map();
  for (const b of pool) m.set(dedupKey(b.title, b.author), b);
  return m;
}
function overlapReport(labelA, poolA, labelB, poolB) {
  const mA = toKeyedMap(poolA);
  const mB = toKeyedMap(poolB);
  const shared = [...mA.keys()].filter(k => mB.has(k));
  console.log(`\n${labelA} (${mA.size} unique) vs ${labelB} (${mB.size} unique): ${shared.length} shared`);
  for (const k of shared) console.log(`  SHARED: ${mA.get(k).title} — ${mA.get(k).author}`);
  const merged = new Set([...mA.keys(), ...mB.keys()]);
  console.log(`  merged unique pool: ${merged.size} (vs ${mA.size} from ${labelA} alone -> +${merged.size - mA.size}, ${Math.round(100 * (merged.size - mA.size) / mA.size)}% growth)`);
  return { shared, mergedSize: merged.size };
}

console.log("Fetching Open Library pools...");
const OL_A = await fetchOLSubject("literary_fiction", 30);
const OL_B_lit = await fetchOLSubject("literary_fiction", 30);
const OL_B_psych = await fetchOLSubject("psychological_fiction", 30);
const OL_B = [...OL_B_lit, ...OL_B_psych];

console.log("Fetching Hardcover pools...");
const HC_A = await fetchHCByTags([899], 30); // Literary Fiction only
await new Promise(r => setTimeout(r, 500));
const HC_B = await fetchHCByTags([899, 2795, 138, 148, 206, 192, 207], 30); // + psych genre + dark/tense/reflective/mysterious moods

const results = {};

console.log("\n\n########## INPUT A (vague: 'just something good to read') ##########");
console.log(`OL subject: literary_fiction | HC tags: Literary Fiction (genre only)`);
results.A = overlapReport("OL_A", OL_A, "HC_A", HC_A);

console.log("\n\n########## INPUT B (texture: 'granular sense of place, moral ambiguity') ##########");
console.log(`OL subjects: literary_fiction + psychological_fiction | HC tags: Literary Fiction + psychological fiction/thriller genres + dark/tense/reflective/mysterious moods`);
results.B = overlapReport("OL_B", OL_B, "HC_B", HC_B);

console.log("\n\n########## Cross-check: does A vs B actually diverge on EACH source? ##########");
overlapReport("OL_A", OL_A, "OL_B", OL_B);
overlapReport("HC_A", HC_A, "HC_B", HC_B);

writeFileSync("scratchpad/hardcover-ol-overlap-test-raw.json", JSON.stringify({ OL_A, OL_B, HC_A, HC_B }, null, 1));
console.log("\nRaw pools saved to scratchpad/hardcover-ol-overlap-test-raw.json");
