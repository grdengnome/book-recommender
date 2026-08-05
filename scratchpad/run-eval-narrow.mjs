// Narrowed eval driver (2026-08-04 pool-content diagnostic session).
// Same driver as run-eval.mjs, restricted to cases 3, 4, 6, 8 — the ones that
// have shown clustering or near-clustering across the last two runs — to
// check whether repeated titles come from genuinely overlapping Open Library
// pools or from the model surfacing titles outside the pool it was shown.
//
// Does not touch retrieval/dedupe/shuffle logic — this only drives requests
// and records the final recommendations per case for cross-referencing
// against scratchpad/query-log.json.

const PORT = process.env.PORT || 3000;
const API_URL = `http://localhost:${PORT}/api/recommend`;

// Verbatim from docs/eval-set.md / run-eval.mjs — same inputs used in prior runs.
const CASES = [
  {
    id: "case-3",
    label: "Vague input",
    tasteDescription: "Just something good to read.",
  },
  {
    id: "case-4",
    label: "Explicit anti-mainstream demand",
    tasteDescription:
      "I want book recommendations, but nothing everyone's already read. I'm tired of every list recommending the same five books.",
  },
  {
    id: "case-6",
    label: "Hard turn-off",
    tasteDescription:
      "I love literary fiction — character studies, beautiful prose, morally complicated people. I will not read fantasy under any circumstances: no magic systems, no invented worlds.",
  },
  {
    id: "case-8",
    label: "Texture-match, not genre-match",
    tasteDescription:
      "I'm looking for something with a really granular, immersive sense of place — I want to feel like I'm actually there — and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture.",
  },
];

// Model sometimes wraps the JSON array in a ```json fence despite the system
// prompt saying not to — strip fences before parsing rather than fail silently.
function extractTitles(recommendationsText) {
  const stripped = recommendationsText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) {
      return parsed.map((r) => ({ title: r.title, author: r.author }));
    }
  } catch {
    // fall through
  }
  return null;
}

async function runCase(c) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tasteDescription: c.tasteDescription,
      evalTag: c.id,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`[${c.id}] ERROR`, data);
    return { ...c, error: data };
  }
  const titles = extractTitles(data.recommendations);
  if (!titles) {
    console.log(`[${c.id}] UNPARSED raw text:\n${data.recommendations}\n`);
  } else {
    console.log(`[${c.id}] done — ${titles.map((t) => t.title).join(" | ")}`);
  }
  return { ...c, recommendations: data.recommendations, titles };
}

const fs = await import("fs");
const outPath = new URL("./eval-run-narrow-results.json", import.meta.url);

const results = [];
for (const c of CASES) {
  // Sequential on purpose: keeps the module-level log tag in searchBooks.ts
  // unambiguous — no two cases' search_books calls are ever in flight at once.
  const result = await runCase(c);
  results.push(result);
  // Write after every case so a crash mid-run doesn't lose completed results.
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
}

console.log("\nWrote scratchpad/eval-run-narrow-results.json");
