// Builds a deduped book pool from hardcover-cooc-full-list.ndjson, computes pairwise
// co-occurrence for every Tag-category tag pair observed in the pool, and flags pairs
// whose observed co-occurrence is far below what independence would predict.
import { readFileSync, writeFileSync } from "fs";

const lines = readFileSync("scratchpad/hardcover-cooc-full-list.ndjson", "utf8").split("\n").filter(Boolean);

const KNOWN_CLUSTER_TAGS = new Set([
  "Loveable Characters", "Unloveable Characters",
  "Strong Character Development", "Weak Character Development",
  "Diverse Characters", "Not Diverse Characters",
  "Character driven", "Plot driven", "A mix driven", "N/A driven",
  "fast-paced", "medium-paced", "slow-paced",
]);

// book id -> { tagNames: Set, taggings: [{userId, tagName}] }
const bookPool = new Map();

for (const line of lines) {
  const { books } = JSON.parse(line);
  for (const b of books) {
    if (!bookPool.has(b.id)) bookPool.set(b.id, { taggings: [] });
    const entry = bookPool.get(b.id);
    for (const tg of b.taggings) {
      entry.taggings.push({ userId: tg.user_id, tagName: tg.tag.tag, tagId: tg.tag.id });
    }
  }
}

const poolSize = bookPool.size;
process.stderr.write(`Book pool size (deduped): ${poolSize}\n`);

// per-book distinct tag set (book-level presence, for co-occurrence counting)
const bookTagSets = [];
for (const [bookId, entry] of bookPool) {
  const distinctTags = new Set(entry.taggings.map(t => t.tagName));
  bookTagSets.push({ bookId, tags: distinctTags, taggings: entry.taggings });
}

// marginal frequency per tag across the pool
const freq = new Map();
for (const { tags } of bookTagSets) {
  for (const t of tags) freq.set(t, (freq.get(t) || 0) + 1);
}

// pairwise co-occurrence counts (only for pairs that appear in >=1 book together is not required;
// we need full pair space among tags with freq>0, but restrict to pairs involving at least one
// newly-scanned (non-cluster) tag; known-cluster pairs are computed too, as a sanity-check baseline)
const coocCounts = new Map(); // key "A|||B" (sorted) -> count

for (const { tags } of bookTagSets) {
  const arr = [...tags];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const [a, b] = [arr[i], arr[j]].sort();
      const key = `${a}|||${b}`;
      coocCounts.set(key, (coocCounts.get(key) || 0) + 1);
    }
  }
}

// Build candidate pair list: both tags must have pool-freq >= 5 (enough signal to judge),
// and expected co-occurrence under independence >= 2 (otherwise zero-observed is uninformative noise).
const allTagNames = [...freq.keys()];
const candidates = [];
for (let i = 0; i < allTagNames.length; i++) {
  for (let j = i + 1; j < allTagNames.length; j++) {
    const a = allTagNames[i], b = allTagNames[j];
    const fa = freq.get(a), fb = freq.get(b);
    if (fa < 5 || fb < 5) continue;
    const expected = (fa * fb) / poolSize;
    if (expected < 2) continue;
    const [sa, sb] = [a, b].sort();
    const observed = coocCounts.get(`${sa}|||${sb}`) || 0;
    const ratio = observed / expected;
    if (ratio <= 0.15) {
      candidates.push({ a: sa, b: sb, freqA: fa, freqB: fb, expected: +expected.toFixed(2), observed, ratio: +ratio.toFixed(3) });
    }
  }
}

candidates.sort((x, y) => x.ratio - y.ratio || y.expected - x.expected);

// Separate: pairs touching a known cluster tag (baseline / expected-noise, not "new") vs
// pairs where BOTH tags are outside the known cluster (candidates for a genuinely new finding).
const knownBaseline = candidates.filter(c => KNOWN_CLUSTER_TAGS.has(c.a) || KNOWN_CLUSTER_TAGS.has(c.b));
const newFindings = candidates.filter(c => !KNOWN_CLUSTER_TAGS.has(c.a) && !KNOWN_CLUSTER_TAGS.has(c.b));

process.stderr.write(`\nTotal flagged pairs (ratio<=0.15, expected>=2, freq>=5 each): ${candidates.length}\n`);
process.stderr.write(`  - known-cluster-only baseline pairs: ${knownBaseline.length}\n`);
process.stderr.write(`  - new findings (involving >=1 non-cluster tag): ${newFindings.length}\n\n`);

process.stderr.write("=== NEW FINDINGS ===\n");
for (const c of newFindings) {
  process.stderr.write(`${c.a}  <->  ${c.b}   freqA=${c.freqA} freqB=${c.freqB} expected=${c.expected} observed=${c.observed} ratio=${c.ratio}\n`);
}

writeFileSync("scratchpad/hardcover-cooc-analysis-result.json", JSON.stringify({
  poolSize,
  totalTagsWithFreq: allTagNames.length,
  knownBaseline,
  newFindings,
}, null, 2));

// Also dump full bookTagSets + taggings for any book involved in a newFinding pair, for per-user decomposition
const flaggedTagNames = new Set();
for (const c of newFindings) { flaggedTagNames.add(c.a); flaggedTagNames.add(c.b); }

const relevantBooks = bookTagSets
  .filter(({ tags }) => [...tags].some(t => flaggedTagNames.has(t)))
  .map(({ bookId, taggings }) => ({ bookId, taggings }));

writeFileSync("scratchpad/hardcover-cooc-flagged-books.json", JSON.stringify(relevantBooks, null, 1));
process.stderr.write(`\nWrote ${relevantBooks.length} books touching flagged tags for per-user follow-up.\n`);
