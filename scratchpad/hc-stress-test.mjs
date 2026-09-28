// THROWAWAY diagnostic script (not part of the pipeline). Read-only against
// production files: extracts SYSTEM_PROMPT text from route.ts via regex, and
// re-derives raw OL/HC pools from already-logged data in
// scratchpad/merge-diag-log.json. Does not modify any production file. Does
// not fabricate Hardcover entries — only truncates the reconstructed OL pool
// to inflate Hardcover's share of a synthetic merged pool, which is then fed
// through the same system prompt / same final Anthropic call shape route.ts
// uses for its last (no-tools) round.

import fs from "fs";

const routeSrc = fs.readFileSync("app/api/recommend/route.ts", "utf8");
const m = routeSrc.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;\n\nexport async function POST/);
if (!m) throw new Error("Could not extract SYSTEM_PROMPT from route.ts");
const SYSTEM_PROMPT = m[1];

const apiKey = process.env.ANTHROPIC_API_KEY || fs.readFileSync(".env.local","utf8").match(/^ANTHROPIC_API_KEY=(.*)$/m)[1].trim();

const CASES = [
  { id: "diag-case-1", label: "case-1 Rich, clear input",
    tasteDescription: "My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book." },
  { id: "diag-case-3", label: "case-3 Vague input",
    tasteDescription: "Just something good to read." },
  { id: "diag-case-6", label: "case-6 Hard turn-off",
    tasteDescription: "I love literary fiction — character studies, beautiful prose, morally complicated people. I will not read fantasy under any circumstances: no magic systems, no invented worlds." },
  { id: "diag-case-9", label: "case-9 Genre fidelity & adjacent expansion",
    tasteDescription: "I love narrative nonfiction — real events told with the pacing and craft of a novel. Specifically deep-dive investigative journalism or historical accounts that read like thrillers. That's exactly what I'm looking for right now." },
  { id: "diag-case-10", label: "case-10 Creative-framing-only input",
    tasteDescription: "🌊🏚️👻🕯️ — moody, atmospheric, a little unsettling but not full horror. That's the vibe I want." },
];

const mergeLines = fs.readFileSync("scratchpad/merge-diag-log.json","utf8")
  .split("\n").filter(l=>l.trim()).map(l=>JSON.parse(l));

// Same dedup/merge logic as lib/merge/mergeCandidatePools.ts, reimplemented
// locally (read, not imported/modified) so this script has zero coupling to
// production files at runtime.
function normTitle(title) {
  return (title ?? "").toLowerCase().replace(/^(the|a|an)\s+/i, "").replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}
function normAuthorLastName(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase().replace(/[^\w]/g, "");
}
function dedupKey(title, author) { return `${normTitle(title)}|${normAuthorLastName(author)}`; }
function mergeSubjects(a, b) {
  const seen = new Set(); const merged = [];
  for (const s of [...a, ...b]) { const k = s.trim().toLowerCase(); if (seen.has(k)) continue; seen.add(k); merged.push(s); }
  return merged;
}
function mergeCandidatePools(openLibraryPool, hardcoverPool) {
  const byKey = new Map();
  for (const c of openLibraryPool) {
    byKey.set(dedupKey(c.title, c.author), { record: { title: c.title, author: c.author, subjects: [...c.subjects], sources: ["openlibrary"] }, usersCount: 0 });
  }
  for (const c of hardcoverPool) {
    const key = dedupKey(c.title, c.author);
    const existing = byKey.get(key);
    if (existing) {
      existing.record.subjects = mergeSubjects(existing.record.subjects, c.subjects);
      existing.record.sources = ["openlibrary", "hardcover"];
    } else {
      byKey.set(key, { record: { title: c.title, author: c.author, subjects: [...c.subjects], sources: ["hardcover"] }, usersCount: 0 });
    }
  }
  const combined = [...byKey.values()].map(v => v.record);
  // Fisher-Yates, same as production
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined;
}

function reconstructPools(tag) {
  const rounds = mergeLines.filter(m => m.tag === tag);
  // pick the round with the larger logged openLibraryRawPoolSize, to maximize
  // available OL candidates for truncation
  const round = rounds.reduce((a,b) => (b.stats.openLibraryRawPoolSize > a.stats.openLibraryRawPoolSize ? b : a));
  const olPool = round.pool.filter(c => c.sources.includes("openlibrary"))
    .map(c => ({ title: c.title, author: c.author, subjects: c.subjects }));
  const hcPool = round.pool.filter(c => c.sources.includes("hardcover"))
    .map(c => ({ title: c.title, author: c.author, subjects: c.subjects }));
  return { olPool, hcPool };
}

async function finalSelection(tasteDescription, pool) {
  const messages = [
    { role: "user", content: tasteDescription },
    { role: "assistant", content: [
      { type: "tool_use", id: "toolu_stress_test", name: "search_books", input: { query: "stress test", subjects: [] } },
    ]},
    { role: "user", content: [
      { type: "tool_result", tool_use_id: "toolu_stress_test", content: JSON.stringify({ pool, poolSize: pool.length }) },
    ]},
  ];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 4000, system: SYSTEM_PROMPT, messages }),
  });
  const data = await res.json();
  const textBlock = data?.content?.find(b => b.type === "text");
  return textBlock?.text ?? JSON.stringify(data);
}

function extractTitles(text) {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { const parsed = JSON.parse(stripped); if (Array.isArray(parsed)) return parsed.map(r => ({ title: r.title, author: r.author })); } catch {}
  return null;
}

const onlyIds = process.env.ONLY_IDS ? process.env.ONLY_IDS.split(",") : null;
const priorResults = fs.existsSync("scratchpad/hc-stress-test-results.json")
  ? JSON.parse(fs.readFileSync("scratchpad/hc-stress-test-results.json", "utf8"))
  : [];

const results = onlyIds ? priorResults.filter(r => !onlyIds.includes(r.id)) : [];
const casesToRun = onlyIds ? CASES.filter(c => onlyIds.includes(c.id)) : CASES;

for (const c of casesToRun) {
  const { olPool, hcPool } = reconstructPools(c.id);
  const hcCount = hcPool.length;
  const targetOlCount = Math.max(1, Math.round(hcCount * (1/0.45 - 1)));
  const olTruncated = olPool.slice(0, targetOlCount);
  const inflatedPool = mergeCandidatePools(olTruncated, hcPool);
  const hcSharePct = Math.round((inflatedPool.filter(c=>c.sources.includes("hardcover")).length / inflatedPool.length) * 1000) / 10;

  const text = await finalSelection(c.tasteDescription, inflatedPool);
  const titles = extractTitles(text);

  const sourceLookup = new Map(inflatedPool.map(c => [dedupKey(c.title, c.author), c.sources]));
  const tagged = (titles || []).map(t => {
    const src = sourceLookup.get(dedupKey(t.title, t.author));
    return { ...t, source: src ? src.join("+") : "NOT_IN_POOL" };
  });

  const hcPicks = tagged.filter(t => t.source.includes("hardcover") && !t.source.includes("openlibrary")).length;

  console.log(`[${c.id}] HC raw=${hcCount} OL trunc=${olTruncated.length} merged=${inflatedPool.length} HC%=${hcSharePct} -> ${tagged.map(t=>`${t.title} (${t.source})`).join(" | ")}`);
  results.push({ id: c.id, label: c.label, hcCount, olTruncCount: olTruncated.length, mergedTotal: inflatedPool.length, hcSharePct, picks: tagged, hcPicks, raw: text });
}

const order = CASES.map(c => c.id);
results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
fs.writeFileSync("scratchpad/hc-stress-test-results.json", JSON.stringify(results, null, 2));
console.log("done");
