// Investigation-only: isolates pagination vs multi-subject as two candidate fixes
// for the narrow-pool clustering (structurally different taste inputs converging on
// the same titles), per the Aug 15 architecture decision that named both as levers
// but never built either into lib/tools/searchBooks.ts (confirmed today — that file
// still does single free-text + single-subject only).
//
// Test inputs are pulled directly from the real narrowed-eval run already logged in
// scratchpad/query-log.json (the same run docs/eval-log.md's 2026-08-04 entry
// describes): case-3 and case-8 both independently guessed subject="literary_fiction"
// with different free-text queries, and *The Memory of Love* showed up in both raw
// pools as a result (confirmed root cause: subject-endpoint determinism). Real logged
// subject sets used:
//   case-3: translated_literature, fiction, literary_fiction
//   case-4: translated_literature, experimental_fiction, psychological_fiction, magic_realism, world_literature, japanese_literature
//   case-6: psychological_fiction, domestic_fiction
//   case-8: literary_fiction, psychological_fiction
// No new test inputs invented.

const RESULTS_PER_CALL = 100; // matches production RESULTS_PER_CALL in searchBooks.ts

async function fetchSubjectPage(slug, offset, limit = RESULTS_PER_CALL) {
  const url = `https://openlibrary.org/subjects/${slug}.json?limit=${limit}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const json = await res.json();
  return {
    slug,
    offset,
    work_count: json.work_count,
    returned: json.works?.length ?? 0,
    works: (json.works ?? []).map(w => ({ key: w.key, title: w.title, authors: (w.authors ?? []).map(a => a.name).join(", ") })),
  };
}

function overlapKeys(a, b) {
  const keysA = new Set(a.map(w => w.key));
  const keysB = new Set(b.map(w => w.key));
  const shared = [...keysA].filter(k => keysB.has(k));
  return { shared, sharedCount: shared.length, aCount: keysA.size, bCount: keysB.size };
}

function printWorks(label, works, n = 20) {
  console.log(`\n  ${label} (showing ${Math.min(n, works.length)} of ${works.length})`);
  works.slice(0, n).forEach((w, i) => console.log(`    ${String(i + 1).padStart(2)}. ${w.title} — ${w.authors || "(no author listed)"}`));
}

// ===================== STEP 1: offset support + catalog depth =====================
console.log("########## STEP 1: does /subjects/{slug}.json support offset, and how deep does each catalog go? ##########");
const subjectsToCheck = ["literary_fiction", "psychological_fiction", "translated_literature"];
const depthResults = {};
for (const slug of subjectsToCheck) {
  const p0 = await fetchSubjectPage(slug, 0);
  const p100 = await fetchSubjectPage(slug, 100);
  const ov = overlapKeys(p0.works, p100.works);
  depthResults[slug] = { work_count: p0.work_count, p0, p100, overlap: ov };
  console.log(`\n${slug}: work_count (catalog depth) = ${p0.work_count}`);
  console.log(`  offset=0 returned ${p0.returned}, offset=100 returned ${p100.returned}`);
  console.log(`  offset=0 vs offset=100 overlap: ${ov.sharedCount}/${ov.aCount} shared -> offset param ${ov.sharedCount === 0 && p100.returned > 0 ? "WORKS (distinct page)" : p100.returned === 0 ? "returns EMPTY past catalog depth" : "PARTIALLY overlaps"}`);
}

// ===================== STEP 3: pagination in isolation =====================
console.log("\n\n\n########## STEP 3: pagination in isolation — page 1 vs page 2 for the shared/converging subject ##########");
console.log("Using literary_fiction (the subject both case-3 and case-8 independently guessed, per docs/eval-log.md 2026-08-04)");
const lf_page1 = depthResults["literary_fiction"].p0;
const lf_page2 = depthResults["literary_fiction"].p100;
printWorks("literary_fiction — offset=0 (current behavior, page 1)", lf_page1.works);
printWorks("literary_fiction — offset=100 (page 2)", lf_page2.works);

console.log("\nAlso checking psychological_fiction (used by case-6 and case-8) for the same pattern:");
const pf_page1 = depthResults["psychological_fiction"].p0;
const pf_page2 = depthResults["psychological_fiction"].p100;
printWorks("psychological_fiction — offset=0 (page 1)", pf_page1.works, 10);
printWorks("psychological_fiction — offset=100 (page 2)", pf_page2.works, 10);

// ===================== STEP 4: multi-subject in isolation =====================
console.log("\n\n\n########## STEP 4: multi-subject in isolation (no pagination — offset=0 only) ##########");

console.log("\n--- case-3's real subject set: translated_literature + fiction + literary_fiction ---");
const c3_translated = await fetchSubjectPage("translated_literature", 0);
const c3_fiction = await fetchSubjectPage("fiction", 0);
const c3_litfic = lf_page1; // reuse already-fetched literary_fiction offset=0
printWorks("translated_literature (offset=0)", c3_translated.works, 10);
printWorks("fiction (offset=0)", c3_fiction.works, 10);
printWorks("literary_fiction (offset=0)", c3_litfic.works, 10);

const c3_merged = new Map();
for (const w of [...c3_translated.works, ...c3_fiction.works, ...c3_litfic.works]) c3_merged.set(w.key, w);
console.log(`\ncase-3 multi-subject merged unique pool: ${c3_merged.size} (vs ${c3_litfic.works.length} from literary_fiction alone -> +${c3_merged.size - c3_litfic.works.length}, ${Math.round(100 * (c3_merged.size - c3_litfic.works.length) / c3_litfic.works.length)}% growth)`);
console.log(`  translated_literature vs fiction overlap: ${overlapKeys(c3_translated.works, c3_fiction.works).sharedCount}/${c3_translated.works.length}`);
console.log(`  translated_literature vs literary_fiction overlap: ${overlapKeys(c3_translated.works, c3_litfic.works).sharedCount}/${c3_translated.works.length}`);
console.log(`  fiction vs literary_fiction overlap: ${overlapKeys(c3_fiction.works, c3_litfic.works).sharedCount}/${c3_fiction.works.length}`);

console.log("\n--- case-8's real subject set: literary_fiction + psychological_fiction ---");
const c8_litfic = lf_page1;
const c8_psych = pf_page1;
const c8_merged = new Map();
for (const w of [...c8_litfic.works, ...c8_psych.works]) c8_merged.set(w.key, w);
console.log(`case-8 multi-subject merged unique pool: ${c8_merged.size} (vs ${c8_litfic.works.length} from literary_fiction alone -> +${c8_merged.size - c8_litfic.works.length}, ${Math.round(100 * (c8_merged.size - c8_litfic.works.length) / c8_litfic.works.length)}% growth)`);
console.log(`  literary_fiction vs psychological_fiction overlap: ${overlapKeys(c8_litfic.works, c8_psych.works).sharedCount}/${c8_litfic.works.length}`);

// ===================== The actual convergence check =====================
console.log("\n\n\n########## Does multi-subject actually reduce case-3 vs case-8 cross-case convergence (the real documented problem)? ##########");
const singleSubjectOverlap = overlapKeys(c3_litfic.works, c8_litfic.works); // both used literary_fiction alone in the real run
console.log(`Single-subject (both on literary_fiction alone, as actually happened 2026-08-04): ${singleSubjectOverlap.sharedCount}/${singleSubjectOverlap.aCount} shared`);
if (singleSubjectOverlap.sharedCount) console.log(`  shared: ${singleSubjectOverlap.shared.map(k => c3_litfic.works.find(w => w.key === k)?.title).join(", ")}`);

const c3MergedArr = [...c3_merged.values()];
const c8MergedArr = [...c8_merged.values()];
const multiSubjectOverlap = overlapKeys(c3MergedArr, c8MergedArr);
console.log(`\nMulti-subject (case-3's 3-subject pool vs case-8's 2-subject pool): ${multiSubjectOverlap.sharedCount}/${multiSubjectOverlap.aCount} shared`);
if (multiSubjectOverlap.sharedCount) console.log(`  shared: ${multiSubjectOverlap.shared.map(k => c3MergedArr.find(w => w.key === k)?.title).join(", ")}`);

// ===================== Pagination's equivalent check: does adding page 2 reduce convergence? =====================
console.log("\n\n########## Does pagination (adding page 2) reduce case-3 vs case-8 cross-case convergence? ##########");
const c3_litfic_2pages = new Map();
for (const w of [...lf_page1.works, ...lf_page2.works]) c3_litfic_2pages.set(w.key, w);
const c8_litfic_2pages = c3_litfic_2pages; // identical subject+pages, same underlying call
console.log(`Both case-3 and case-8's literary_fiction call, 2 pages deep, are still the SAME underlying subject-endpoint listing (offset=0+100) — pagination doesn't change which subject each case picks, so this can only be assessed indirectly: does going 2 pages deep on the one subject BOTH cases converged on still contain "The Memory of Love" or similarly-clustering titles on page 2?`);
const memoryOfLoveOnPage2 = lf_page2.works.some(w => /memory of love/i.test(w.title));
console.log(`"The Memory of Love" present on literary_fiction page 2 (offset=100)? ${memoryOfLoveOnPage2}`);
