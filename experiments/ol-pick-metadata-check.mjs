// Read-only diagnostic (2026-09-26): for the 33 final picks in the Sept 23 v0 baseline
// (eval-run-postfix-2026-09-23.json), resolve each to an Open Library work and report
// (1) whether the work record has a non-empty description, (2) the full subject list,
// and (3) how many subjects the search.json `subject` field — the one searchBooks.ts
// already fetches and truncates to 2 — carries for that same work.
// Output: scratchpad/ol-pick-metadata-check-results.json
import { readFileSync, writeFileSync } from "fs";

const UA = "book-recommender/0.1 (https://github.com/grdengnome/book-recommender)";
const run = JSON.parse(readFileSync("scratchpad/eval-run-postfix-2026-09-23.json", "utf8"));

const picks = [];
for (const c of run) {
  const grounded = c.attempts.filter((a) => a.outcome === "grounded");
  for (const p of grounded.at(-1).picks) picks.push({ case: c.id, title: p.title, author: p.author });
}

const norm = (s) => (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return await res.json();
    } catch {}
    await sleep(1500);
  }
  return null;
}

// Same endpoint + fields as searchBooks.ts's fetchSearchResults, searched by title
// (+ author) so we land on the same work record the pool entry came from.
async function resolve(pick) {
  for (const q of [`${pick.title} ${pick.author}`, pick.title]) {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("q", q);
    url.searchParams.set("fields", "key,title,author_name,subject");
    url.searchParams.set("limit", "20");
    const data = await getJson(url);
    const docs = data?.docs ?? [];
    const exact = docs.find((d) => norm(d.title) === norm(pick.title) && (d.author_name ?? []).some((a) => norm(a) === norm(pick.author)));
    const titleOnly = docs.find((d) => norm(d.title) === norm(pick.title));
    const hit = exact ?? titleOnly;
    if (hit) return { doc: hit, match: exact ? "title+author" : "title-only", query: q };
  }
  return null;
}

const results = [];
for (const pick of picks) {
  const r = await resolve(pick);
  if (!r) {
    results.push({ ...pick, resolved: false });
    console.log(`UNRESOLVED  ${pick.case} | ${pick.title}`);
    continue;
  }
  const work = await getJson(`https://openlibrary.org${r.doc.key}.json`);
  const desc = typeof work?.description === "string" ? work.description : work?.description?.value ?? "";
  const searchSubjects = r.doc.subject ?? [];
  const row = {
    ...pick,
    resolved: true,
    match: r.match,
    workKey: r.doc.key,
    hasDescription: desc.trim().length > 0,
    descriptionLength: desc.trim().length,
    workSubjects: work?.subjects ?? [],
    searchSubjectCount: searchSubjects.length,
    searchSubjects,
  };
  results.push(row);
  console.log(`${row.hasDescription ? "DESC" : "----"}  ${r.match.padEnd(12)} search-subjects=${String(row.searchSubjectCount).padStart(3)}  ${pick.case} | ${pick.title} (${r.doc.key})`);
  await sleep(300);
}

writeFileSync("scratchpad/ol-pick-metadata-check-results.json", JSON.stringify(results, null, 2));
const resolved = results.filter((r) => r.resolved);
console.log(`\nresolved ${resolved.length}/${results.length}`);
console.log(`non-empty description: ${resolved.filter((r) => r.hasDescription).length}/${resolved.length}`);
const counts = resolved.map((r) => r.searchSubjectCount).sort((a, b) => a - b);
console.log(`search.json subject counts: min=${counts[0]} median=${counts[Math.floor(counts.length / 2)]} max=${counts.at(-1)}; >2: ${counts.filter((n) => n > 2).length}/${counts.length}`);
