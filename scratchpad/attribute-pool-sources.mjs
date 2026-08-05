// Diagnostic (2026-08-04): query-log.json logs each call's final *merged,
// deduped* pool — title/author only, with no record of which source
// (free-text search vs subject endpoint) each title came from. That's by
// design (searchBooks.ts strips origin before the model ever sees it), but
// it means source attribution isn't recoverable from the log alone.
//
// This script re-issues each logged query/subject pair separately against
// Open Library's two endpoints (same request logic as searchBooks.ts's
// fetchSearchResults/fetchSubjectResults) and matches each logged pool
// title against those two fresh source-specific lists by title+author.
// This does NOT re-derive the pool — the pool is taken verbatim from
// tonight's log. It only asks, for each already-logged title, "would this
// have come from the free-text call, the subject call, or both?"
//
// Caveat: the fresh fetch happens now, not at original call time. Open
// Library's free-text relevance ranking can vary run to run; the subject
// endpoint is a stable listing and should be far more reproducible. Titles
// logged in the pool but not found in either fresh source list are reported
// as "unattributed" rather than silently guessed at.

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const OPEN_LIBRARY_SUBJECTS_URL = "https://openlibrary.org/subjects";
const USER_AGENT = "book-recommender/0.1 (https://github.com/grdengnome/book-recommender)";
const RESULTS_PER_CALL = 100;

async function fetchSearchResults(query) {
  const url = new URL(OPEN_LIBRARY_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "key,title,author_name,subject");
  url.searchParams.set("limit", String(RESULTS_PER_CALL));
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const data = await res.json();
  const docs = Array.isArray(data?.docs) ? data.docs : [];
  return docs
    .map((d) => {
      if (!d.title || !d.author_name?.[0]) return null;
      return { title: d.title, author: d.author_name[0] };
    })
    .filter(Boolean);
}

async function fetchSubjectResults(subject) {
  const slug = subject.trim().toLowerCase().replace(/\s+/g, "_");
  if (!slug) return [];
  const url = `${OPEN_LIBRARY_SUBJECTS_URL}/${encodeURIComponent(slug)}.json?limit=${RESULTS_PER_CALL}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const data = await res.json();
  const works = Array.isArray(data?.works) ? data.works : [];
  return works
    .map((w) => {
      if (!w.title || !w.authors?.[0]?.name) return null;
      return { title: w.title, author: w.authors[0].name };
    })
    .filter(Boolean);
}

function key(b) {
  return `${b.title.trim().toLowerCase()}::${b.author.trim().toLowerCase()}`;
}

const fs = await import("fs");
const lines = fs
  .readFileSync(new URL("./query-log.json", import.meta.url), "utf8")
  .trim()
  .split("\n");
const entries = lines.map((l) => JSON.parse(l));

const report = [];

for (const e of entries) {
  const [searchResults, subjectResults] = await Promise.all([
    fetchSearchResults(e.query),
    fetchSubjectResults(e.subject),
  ]);
  const searchKeys = new Set(searchResults.map(key));
  const subjectKeys = new Set(subjectResults.map(key));

  let fromSearchOnly = 0;
  let fromSubjectOnly = 0;
  let fromBoth = 0;
  let unattributed = 0;

  for (const b of e.pool) {
    const k = key(b);
    const inSearch = searchKeys.has(k);
    const inSubject = subjectKeys.has(k);
    if (inSearch && inSubject) fromBoth++;
    else if (inSearch) fromSearchOnly++;
    else if (inSubject) fromSubjectOnly++;
    else unattributed++;
  }

  const total = e.pool.length;
  report.push({
    tag: e.tag,
    query: e.query,
    subject: e.subject,
    loggedPoolSize: total,
    freshSearchResultCount: searchResults.length,
    freshSubjectResultCount: subjectResults.length,
    fromSearchOnly,
    fromSubjectOnly,
    fromBoth,
    unattributed,
    searchContribPct: total ? Math.round(((fromSearchOnly + fromBoth) / total) * 1000) / 10 : 0,
    subjectContribPct: total ? Math.round(((fromSubjectOnly + fromBoth) / total) * 1000) / 10 : 0,
  });
}

console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(
  new URL("./pool-source-attribution.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
