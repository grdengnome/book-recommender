// Analyses the question-value (ablation) runs (traces tagged qc1023-*; see
// question-core-ablation.mjs). For each case: full-a vs full-b is the normal run-to-run
// variation; each removal run is compared with both full runs. Table = every candidate the
// selector was shown in the successful attempt (all merged search results). Picks are
// matched on normalized title + author surname. Writes
// experiments/2026-10-23-question-core/ablation-compare.json.
import fs from "fs";
const dir = new URL("./traces/", import.meta.url).pathname;
const files = fs.readdirSync(dir);
const norm = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
const key = (b) => `${norm(b.title).replace(/^(the|a|an) /, "")}|${norm(b.author).split(" ").at(-1)}`;
// Trace file names replace characters like "+" in the tag with "_".
const load = (tag) => { const f = files.filter((x) => x.includes(`-${tag.replace(/[^A-Za-z0-9-]/g, "_")}-`)).sort().at(-1); return f ? JSON.parse(fs.readFileSync(dir + f, "utf8")) : null; };

function summarize(t) {
  const s = t.stages;
  const lastAttempt = Math.max(...s.C_model_search_loop.map((e) => e.attempt));
  const merges = s.E_merge.filter((e) => e.attempt === lastAttempt);
  const table = new Set(merges.flatMap((e) => e.pool.map(key)));
  const searches = s.D_open_library_search.filter((e) => e.attempt === lastAttempt).map((e) => e.input);
  const tags = s.A_tag_picking.find((e) => e.kind === "result")?.matched?.map((m) => m.tag) ?? [];
  const body = s.I_response.at(-1).body;
  const sel = s.C_model_search_loop.filter((e) => e.kind === "model_call").at(-1);
  return { table, searches, tags, attempts: lastAttempt, picks: (body.picks ?? []).map((p) => ({ title: p.title, author: p.author, mood: p.mood, key: key(p) })),
    error: body.error?.code ?? null, totalMs: t.totalMs, thinking: sel?.usage?.output_tokens_details?.thinking_tokens, cost: t.cost.totalUsd };
}
const jac = (a, b) => { const i = [...a].filter((k) => b.has(k)).length; return +(i / new Set([...a, ...b]).size).toFixed(2); };
const sharedPicks = (a, b) => a.picks.filter((p) => b.picks.some((q) => q.key === p.key)).length;

const runs = JSON.parse(fs.readFileSync(new URL("./experiments/2026-10-23-question-core/ablation-runs.json", import.meta.url), "utf8"));
const out = {};
for (const id of [...new Set(runs.map((r) => r.id))]) {
  const S = Object.fromEntries(runs.filter((r) => r.id === id).map((r) => [r.variant, summarize(load(r.evalTag))]));
  const A = S["full-a"], B = S["full-b"];
  const rows = [{ variant: "full-b vs full-a (noise)", tableJ: jac(A.table, B.table), picksKept: sharedPicks(B, A), picksInEitherFull: null, ...B }];
  for (const [v, R] of Object.entries(S).filter(([v]) => v.startsWith("minus-"))) {
    const either = { picks: [...A.picks, ...B.picks] };
    rows.push({ variant: v, tableJ: +((jac(R.table, A.table) + jac(R.table, B.table)) / 2).toFixed(2), picksKept: null, picksInEitherFull: sharedPicks(R, either), ...R });
  }
  out[id] = { fullA: A, rows };
  console.log(`\n== ${id}\n  full-a: ${A.picks.map((p) => `${p.title} [${p.mood}]`).join(" | ")}  (table ${A.table.size}, think ${A.thinking}, ${A.totalMs}ms)`);
  console.log(`  tags ${A.tags.join(", ")}; searches ${JSON.stringify(A.searches)}`);
  for (const r of rows) {
    console.log(`  ${r.variant.padEnd(26)} tableJ ${r.tableJ}  picks same ${r.picksKept ?? r.picksInEitherFull + "/3 in either full"}  table ${r.table.size} att ${r.attempts} think ${r.thinking} ${r.totalMs}ms $${r.cost.toFixed(3)}${r.error ? " ERROR " + r.error : ""}`);
    console.log(`      picks: ${r.picks.map((p) => `${p.title} — ${p.author} [${p.mood}]`).join(" | ")}`);
    console.log(`      tags ${r.tags.join(", ")}; searches ${JSON.stringify(r.searches)}`);
  }
}
fs.writeFileSync(new URL("./experiments/2026-10-23-question-core/ablation-compare.json", import.meta.url),
  JSON.stringify(out, (k, v) => (v instanceof Set ? v.size : v), 1));
