// Mood-to-catalog check (2026-10-23, branch experiment/question-core). Free: Open Library only,
// no model calls. For each draft "right now" option, fetches the subject lists it plausibly maps
// to, the way the engine does (subjects API, top 100), and records how big each subject is,
// how canon-heavy its top 100 is (edition counts), sample titles, and how often Open Library
// knows a page count (search API, number_of_pages_median) for the length bands.
// Candidate subjects: ones the engine has chosen in query-log.json where they exist, plus a
// hand list. Writes experiments/2026-10-23-question-core/catalog-check.json.
import fs from "fs";

const UA = "book-recommender/0.1 (https://github.com/grdengnome/book-recommender)";
const OPTIONS = {
  cozy: ["cozy_mysteries", "cozy", "feel_good", "friendship_fiction", "small_town_life", "humorous_fiction"],
  dark: ["noir_fiction", "dark", "crime_fiction", "psychological_fiction", "gothic_fiction"],
  funny: ["humorous_fiction", "humorous_stories", "comic_novels", "satire", "wit_and_humor"],
  gripping: ["suspense", "thrillers", "thriller", "detective_and_mystery_stories", "page_turner", "psychological_thrillers"],
  "quiet/reflective": ["literary_fiction", "meditative_fiction", "loneliness", "memory", "domestic_fiction", "quiet"],
  unsettling: ["gothic_fiction", "ghost_stories", "horror", "supernatural", "weird_fiction", "horror_tales"],
  romantic: ["love_stories", "romance", "romance_fiction", "man-woman_relationships", "romantic_comedy"],
  adventurous: ["adventure_stories", "adventure_and_adventurers", "sea_stories", "quests_(expeditions)", "voyages_and_travels"],
};

const get = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const band = (p) => (p < 120 ? "one sitting" : p <= 300 ? "a weekend" : p <= 500 ? "a few weeks" : "long haul");

const out = {};
for (const [option, subjects] of Object.entries(OPTIONS)) {
  out[option] = [];
  for (const slug of subjects) {
    const row = { slug };
    try {
      const d = await get(`https://openlibrary.org/subjects/${encodeURIComponent(slug)}.json?limit=100`);
      const works = d.works ?? [];
      const eds = works.map((w) => w.edition_count ?? 0);
      row.workCount = d.work_count ?? 0;
      row.returned = works.length;
      row.medianEditions = median(eds);
      row.canonShare = works.length ? +(eds.filter((e) => e >= 200).length / works.length).toFixed(2) : null;
      row.top = works.slice(0, 12).map((w) => `${w.title} — ${w.authors?.[0]?.name ?? "?"} (${w.edition_count})`);
      row.deeper = works.slice(50, 100).filter((_, i) => i % 6 === 0).map((w) => `${w.title} — ${w.authors?.[0]?.name ?? "?"} (${w.edition_count})`);
      if (works.length) {
        const s = await get(`https://openlibrary.org/search.json?q=${encodeURIComponent(`subject_key:${slug}`)}&fields=key,number_of_pages_median&limit=100`);
        const pages = (s.docs ?? []).map((x) => x.number_of_pages_median).filter((p) => typeof p === "number" && p > 0);
        row.pageCoverage = s.docs?.length ? +(pages.length / s.docs.length).toFixed(2) : null;
        row.bands = pages.reduce((m, p) => ((m[band(p)] = (m[band(p)] ?? 0) + 1), m), {});
      }
    } catch (err) {
      row.error = String(err.message ?? err);
    }
    out[option].push(row);
    console.log(`${option.padEnd(16)} ${slug.padEnd(30)} works ${String(row.workCount ?? "-").padStart(7)}  med eds ${String(row.medianEditions ?? "-").padStart(4)}  canon ${row.canonShare ?? "-"}  pages ${row.pageCoverage ?? "-"} ${JSON.stringify(row.bands ?? {})}${row.error ? " ERR " + row.error : ""}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}
fs.mkdirSync(new URL("./experiments/2026-10-23-question-core/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./experiments/2026-10-23-question-core/catalog-check.json", import.meta.url), JSON.stringify(out, null, 1));
