// Compares the early-table test (traces tagged early1022-*) with today's engine (Oct 22
// timing-run traces). See early-table-test.mjs. Prints a summary and writes
// experiments/2026-10-22-early-table/compare.json.
import fs from "fs";
const dir = new URL("./traces/", import.meta.url).pathname;
const files = fs.readdirSync(dir);
const load = (tag) => { const f = files.filter((x) => x.includes(`-${tag}-`)).sort().at(-1); return JSON.parse(fs.readFileSync(dir + f, "utf8")); };
const TODAY = { "case-1": "stream1022-case-1", "case-5": "stream1022-case-5", "case-6": "stream1022-case-6", "case-8": "stream1022b-case-8", "case-9": "stream1022b-case-9", "case-10": "stream1022b-case-10" };
const norm = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
const key = (b) => `${norm(b.title)}|${norm(b.author).split(" ").at(-1)}`;

function summarize(t) {
  const s = t.stages;
  const calls = s.C_model_search_loop.filter((e) => e.kind === "model_call");
  const table = new Set(s.E_merge.filter((e) => e.round === 0 && e.attempt === 1).flatMap((e) => e.pool.map(key)));
  const fullTable = new Set(s.E_merge.flatMap((e) => e.pool.map(key)));
  const searches = s.D_open_library_search.filter((e) => e.round === 0 && e.attempt === 1).map((e) => e.input);
  const laterSearches = s.D_open_library_search.filter((e) => e.round > 0).map((e) => e.input);
  const tags = s.A_tag_picking.find((e) => e.kind === "result")?.matched?.map((m) => m.tag) ?? [];
  const r1 = calls.find((c) => c.round === 1);
  const prepareMs = r1 ? r1.atMs - r1.ms : null; // request start -> selection call starts
  const r0 = calls.find((c) => c.round === 0);
  const olWait = Math.max(...s.D_open_library_search.filter((e) => e.round === 0).map((e) => e.ms));
  const picks = s.I_response.at(-1).body.picks ?? [];
  const sel = calls.at(-1);
  return { tags, searches, laterSearches, table, fullTable, prepareMs, searchCallMs: r0.ms, olWait, totalMs: t.totalMs, chooseWriteMs: prepareMs == null ? null : t.totalMs - prepareMs,
    selectionMs: sel.ms, thinking: sel.usage?.output_tokens_details?.thinking_tokens, rounds: calls.length, cost: t.cost.totalUsd,
    picks: picks.map((p) => ({ title: p.title, author: p.author, mood: p.mood, hook: p.hook, why: p.why })),
    poolPicks: (s.F_grounding_check.at(-1).picks ?? []).map((p) => key({ title: p.poolTitle ?? p.title, author: p.poolAuthor ?? p.author })) };
}

const out = {};
for (const id of Object.keys(TODAY)) {
  const T = summarize(load(TODAY[id])), P = summarize(load(`early1022-${id}`));
  const inter = [...P.table].filter((k) => T.table.has(k)).length;
  const union = new Set([...P.table, ...T.table]).size;
  const pPicksInT = P.picks.filter((p) => T.fullTable.has(key(p))).length;
  const shared = P.picks.filter((p) => T.picks.some((q) => key(q) === key(p))).map((p) => p.title);
  out[id] = { T, P, overlap: { sizeT: T.table.size, sizeP: P.table.size, shared: inter, jaccard: +(inter / union).toFixed(2), pctOfToday: +(inter / T.table.size).toFixed(2) }, pPicksInTodayTable: pPicksInT, sharedPicks: shared };
  console.log(`\n== ${id}`);
  console.log(`tags   T: ${T.tags.join(", ")}\n       P: ${P.tags.join(", ")}`);
  console.log(`search T: ${JSON.stringify(T.searches)}\n       P: ${JSON.stringify(P.searches)}`);
  if (P.laterSearches.length || T.laterSearches.length) console.log(`later searches T: ${JSON.stringify(T.laterSearches)} P: ${JSON.stringify(P.laterSearches)}`);
  console.log(`table  T ${T.table.size}, P ${P.table.size}, shared ${inter} (${Math.round(100 * inter / T.table.size)}% of today's), jaccard ${(inter / union).toFixed(2)}`);
  console.log(`picks  T: ${T.picks.map((p) => p.title).join(" | ")}\n       P: ${P.picks.map((p) => p.title).join(" | ")}  (P picks in today's table: ${pPicksInT}/3; same picks: ${shared.length})`);
  console.log(`time   T: total ${T.totalMs} prepare ${T.prepareMs} (search call ${T.searchCallMs}, OL ${T.olWait}) choose+write ${T.chooseWriteMs} sel ${T.selectionMs} think ${T.thinking}`);
  console.log(`       P: total ${P.totalMs} prepare ${P.prepareMs} (search call ${P.searchCallMs}, OL ${P.olWait}) choose+write ${P.chooseWriteMs} sel ${P.selectionMs} think ${P.thinking} rounds ${P.rounds} cost ${P.cost}`);
}
const ser = JSON.parse(JSON.stringify(out, (k, v) => (v instanceof Set ? v.size : v)));
fs.writeFileSync(new URL("./experiments/2026-10-22-early-table/compare.json", import.meta.url), JSON.stringify(ser, null, 1));
