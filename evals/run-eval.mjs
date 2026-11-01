// Temporary eval driver for the query-tracing session (2026-08-04).
// Runs the 11 docs/eval-set.md cases against the live /api/recommend route
// (dev server must already be running on PORT below), tagging each request
// with its case id so lib/tools/searchBooks.ts's diagnostic logging can
// attribute every search_books call back to the case that triggered it.
//
// Does not touch retrieval/dedupe/shuffle logic — this only drives requests
// and records the final recommendations per case for later cross-referencing
// against .local/query-log.json.

// Options (environment settings):
//   CASE_IDS=case-1,case-5   run only these cases, in this order
//   TAG_PREFIX=gateway1101    prefix for each request's eval tag, so its logs and traces are separable
//   OUT=eval-run-x.json       results file name in evals/results/ (default eval-run-results.json)
// With the dev server started as ENGINE_TRACE=1 npm run dev, each case's server-side time and
// dollar cost are read from its trace in .local/traces/ and printed in the summary at the end.

const PORT = process.env.PORT || 3000;
const API_URL = `http://localhost:${PORT}/api/recommend`;

// Verbatim from docs/eval-log.md / docs/eval-results.md — same inputs used in
// prior eval runs (Prompt v2/v3 and the 2026-08-01 search_books-wired run).
const CASES = [
  {
    id: "case-1",
    label: "Rich, clear input",
    tasteDescription:
      "My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book.",
  },
  {
    id: "case-2",
    label: "Anti-mainstream profile",
    tasteDescription:
      "There's a novel I read a few years back — quiet, character-driven, nothing anyone around me had heard of — and it turned out to be one of the best books I've ever read. It completely surprised me, because nothing about its low profile suggested it would hit that hard. I've been recommending it to people unprompted ever since. I want more like that: no bestsellers, no 'if you liked X' consensus picks — just books that are genuinely great regardless of how well-known they are.",
  },
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
    id: "case-5",
    label: "Contradictory signals",
    tasteDescription:
      "My favorite book of all time is 'War and Peace' — I loved the sprawling scope and how deeply it got into every character's inner life. But right now I want something light and quick to read, nothing heavy or slow.",
  },
  {
    id: "case-6",
    label: "Hard turn-off",
    tasteDescription:
      "I love literary fiction — character studies, beautiful prose, morally complicated people. I will not read fantasy under any circumstances: no magic systems, no invented worlds.",
  },
  {
    id: "case-7a",
    label: "Rejection → clarify",
    tasteDescription:
      "I asked for recommendations similar to quiet, literary character studies, but the three you gave me last time were all too dark and bleak for what I wanted. I'd like something in a similar literary vein, but warmer and more hopeful in tone.",
  },
  {
    id: "case-7b",
    label: "Rejection → clarify → widen escalation",
    tasteDescription:
      "I've now rejected two rounds of recommendations for quiet literary character studies — the first round was too dark, and the second round (aiming for warmer and more hopeful) still didn't land, they felt flat and forgettable. At this point just show me your best editable read on what you think I'm actually after, and feel free to widen out and take some real chances rather than staying narrowly in that same lane.",
  },
  {
    id: "case-8",
    label: "Texture-match, not genre-match",
    tasteDescription:
      "I'm looking for something with a really granular, immersive sense of place — I want to feel like I'm actually there — and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture.",
  },
  {
    id: "case-9",
    label: "Genre/category fidelity & adjacent expansion",
    tasteDescription:
      "I love narrative nonfiction — real events told with the pacing and craft of a novel. Specifically deep-dive investigative journalism or historical accounts that read like thrillers. That's exactly what I'm looking for right now.",
  },
  {
    id: "case-10",
    label: "Creative-framing-only input",
    tasteDescription:
      "🌊🏚️👻🕯️ — moody, atmospheric, a little unsettling but not full horror. That's the vibe I want.",
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

const TAG_PREFIX = process.env.TAG_PREFIX ? `${process.env.TAG_PREFIX}-` : "";
const TRACE_DIR = new URL("../.local/traces/", import.meta.url);

// The newest trace written for this eval tag, if tracing was on: { totalMs, totalUsd, models }.
async function readTrace(evalTag) {
  const fs = await import("fs");
  try {
    const name = fs.readdirSync(TRACE_DIR).filter((f) => f.includes(`-${evalTag}-`)).sort().pop();
    if (!name) return null;
    const trace = JSON.parse(fs.readFileSync(new URL(name, TRACE_DIR), "utf8"));
    return { totalMs: trace.totalMs, totalUsd: trace.cost?.totalUsd ?? null, models: Object.keys(trace.cost?.byModel ?? {}) };
  } catch {
    return null;
  }
}

async function runCase(c) {
  const evalTag = `${TAG_PREFIX}${c.id}`;
  const start = performance.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tasteDescription: c.tasteDescription,
      evalTag,
    }),
  });
  const data = await res.json();
  const driverMs = Math.round(performance.now() - start);
  const trace = await readTrace(evalTag);
  if (!res.ok) {
    console.error(`[${c.id}] ERROR`, data);
    return { ...c, error: data, driverMs, trace };
  }
  // Since fix PR 1 (2026-10-21) the route returns structured `picks`; older runs returned
  // `recommendations` as model text, which extractTitles still parses.
  const titles = data.picks
    ? data.picks.map((p) => ({ title: p.title, author: p.author }))
    : extractTitles(data.recommendations);
  if (!titles) {
    console.log(`[${c.id}] UNPARSED raw text:\n${data.recommendations}\n`);
  } else {
    console.log(`[${c.id}] done — ${titles.map((t) => t.title).join(" | ")}`);
  }
  return { ...c, picks: data.picks ?? null, recommendations: data.recommendations ?? null, titles, driverMs, trace };
}

const fs = await import("fs");
fs.mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
const outName = process.env.OUT || "eval-run-results.json";
const outPath = new URL(`./results/${outName}`, import.meta.url);

const wanted = process.env.CASE_IDS ? process.env.CASE_IDS.split(",").map((id) => id.trim()) : null;
const unknown = (wanted ?? []).filter((id) => !CASES.some((c) => c.id === id));
if (unknown.length) throw new Error(`Unknown CASE_IDS: ${unknown.join(", ")}`);
const toRun = wanted ? wanted.map((id) => CASES.find((c) => c.id === id)) : CASES;

const results = [];
for (const c of toRun) {
  // Sequential on purpose: keeps the module-level log tag in searchBooks.ts
  // unambiguous — no two cases' search_books calls are ever in flight at once.
  const result = await runCase(c);
  results.push(result);
  // Write after every case so a crash mid-run doesn't lose completed results.
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
}

// Summary: no reader data and no keys, safe to paste into a PR or chat.
const secs = (ms) => (typeof ms === "number" ? `${(ms / 1000).toFixed(1)}s` : "–");
console.log("\nSummary");
console.log("case      | status | picks | server time | driver time | cost   | models");
for (const r of results) {
  const status = r.error ? "ERROR" : "ok";
  const picks = r.picks ? r.picks.length : 0;
  const cost = typeof r.trace?.totalUsd === "number" ? `$${r.trace.totalUsd.toFixed(3)}` : "–";
  console.log(`${r.id.padEnd(9)} | ${status.padEnd(6)} | ${String(picks).padEnd(5)} | ${secs(r.trace?.totalMs).padEnd(11)} | ${secs(r.driverMs).padEnd(11)} | ${cost.padEnd(6)} | ${(r.trace?.models ?? []).join(", ")}`);
}
const times = results.map((r) => r.trace?.totalMs ?? r.driverMs).sort((a, b) => a - b);
const median = times.length ? times[Math.floor((times.length - 1) / 2)] + (times.length % 2 ? 0 : (times[times.length / 2] - times[Math.floor((times.length - 1) / 2)]) / 2) : null;
const costs = results.map((r) => r.trace?.totalUsd).filter((x) => typeof x === "number");
console.log(`\n${results.filter((r) => !r.error && r.picks?.length === 3).length}/${results.length} cases returned 3 picks · median time ${secs(median)}` + (costs.length ? ` · total cost $${costs.reduce((a, b) => a + b, 0).toFixed(3)}` : " · cost: start the dev server with ENGINE_TRACE=1 to see it"));
console.log(`Wrote evals/results/${outName}`);
