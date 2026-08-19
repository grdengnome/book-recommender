// Tests whether Open Library's /subjects/{slug}.json endpoint actually supports
// offset-based pagination, or whether higher offsets just re-return page 1
// (or return an overlapping/degenerate set) — before relying on it to build
// a larger candidate pool for the Open Library + Hardcover merge.
async function fetchSubjectPage(slug, offset, limit = 20) {
  const url = `https://openlibrary.org/subjects/${slug}.json?limit=${limit}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const json = await res.json();
  return {
    url,
    work_count: json.work_count,
    returned: json.works?.length ?? 0,
    works: (json.works ?? []).map(w => ({ key: w.key, title: w.title })),
  };
}

function overlap(a, b) {
  const keysA = new Set(a.map(w => w.key));
  const keysB = new Set(b.map(w => w.key));
  const shared = [...keysA].filter(k => keysB.has(k));
  return { shared, sharedCount: shared.length, aCount: keysA.size, bCount: keysB.size };
}

console.log("=== literary_fiction: offset pagination test ===");
const lf0 = await fetchSubjectPage("literary_fiction", 0);
const lf20 = await fetchSubjectPage("literary_fiction", 20);
const lf40 = await fetchSubjectPage("literary_fiction", 40);

console.log(`work_count (total in subject): ${lf0.work_count}`);
for (const [label, page] of [["offset=0", lf0], ["offset=20", lf20], ["offset=40", lf40]]) {
  console.log(`\n${label} (${page.returned} returned):`);
  console.log(page.works.map(w => `  ${w.key}  ${w.title}`).join("\n"));
}

console.log("\n--- Overlap analysis ---");
const ov_0_20 = overlap(lf0.works, lf20.works);
const ov_0_40 = overlap(lf0.works, lf40.works);
const ov_20_40 = overlap(lf20.works, lf40.works);
console.log(`offset=0 vs offset=20: ${ov_0_20.sharedCount}/${ov_0_20.aCount} shared`);
if (ov_0_20.sharedCount) console.log(`  shared keys: ${ov_0_20.shared.join(", ")}`);
console.log(`offset=0 vs offset=40: ${ov_0_40.sharedCount}/${ov_0_40.aCount} shared`);
if (ov_0_40.sharedCount) console.log(`  shared keys: ${ov_0_40.shared.join(", ")}`);
console.log(`offset=20 vs offset=40: ${ov_20_40.sharedCount}/${ov_20_40.aCount} shared`);
if (ov_20_40.sharedCount) console.log(`  shared keys: ${ov_20_40.shared.join(", ")}`);

console.log("\n\n=== historical_fiction: single-subject vs merged pool test ===");
const hf0 = await fetchSubjectPage("historical_fiction", 0);
console.log(`work_count: ${hf0.work_count}`);
console.log(hf0.works.map(w => `  ${w.key}  ${w.title}`).join("\n"));

const ov_lf_hf = overlap(lf0.works, hf0.works);
console.log(`\n--- literary_fiction (offset=0) vs historical_fiction (offset=0) overlap ---`);
console.log(`${ov_lf_hf.sharedCount}/${ov_lf_hf.aCount} shared`);
if (ov_lf_hf.sharedCount) console.log(`  shared keys: ${ov_lf_hf.shared.join(", ")}`);

const mergedPool = new Set([...lf0.works.map(w => w.key), ...hf0.works.map(w => w.key)]);
console.log(`\nliterary_fiction alone: ${lf0.works.length} unique works`);
console.log(`merged (literary_fiction + historical_fiction): ${mergedPool.size} unique works`);
console.log(`pool growth from merging: +${mergedPool.size - lf0.works.length} (${Math.round(100 * (mergedPool.size - lf0.works.length) / lf0.works.length)}%)`);
