// The review page (decision 3.8): one static HTML file per scoring, for Grim's gut check. The
// scorecard sits on top; below, every reader in plain words with their three picks and covers.
// Scores and judge reasons are hidden until "Show scores" is ticked, so the first look is a
// reader's-eye view. The plain-Claude picks sit under each reader, collapsed.
import type { Row, ScoredCase, ScoredRun } from "./scorecard";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const badge = (p: boolean | null) => (p === null ? `<span class="b na">–</span>` : p ? `<span class="b ok">pass</span>` : `<span class="b no">miss</span>`);

function picksHtml(c: ScoredCase): string {
  if (!c.ok) return `<p class="err">No picks: ${esc(c.error ?? "request failed")}</p>`;
  return `<div class="picks">${c.picks
    .map((p, i) => {
      const s = c.score?.picks[i];
      const cover = p.coverUrl || p.facts.coverUrl;
      const facts = [p.facts.firstYear, p.pages ?? p.facts.pages ? `${p.pages ?? p.facts.pages} pages` : "", p.facts.found ? "" : "not found in catalog"].filter(Boolean).join(" · ");
      const scores = s
        ? `<div class="score"><b>Relevance: ${esc(s.relevance)}</b> — ${esc(s.relevanceReason)}<br><b>Non-obvious: ${esc(s.nonObvious)}</b> — ${esc(s.nonObviousReason)}${[...s.hardRules, ...s.strong, ...s.weighed]
            .map((v) => `<br><span class="v ${esc(v.verdict)}">${esc(v.verdict)}</span> ${esc(v.item)}: ${esc(v.reason)}`)
            .join("")}<br><b>Card: ${esc(s.cardAccuracy)}</b> — ${esc(s.cardReason)}</div>`
        : "";
      return `<div class="pick">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : `<div class="nocover"></div>`}<div><div class="t">${esc(p.title)}</div><div class="a">${esc(p.author)}${facts ? ` · ${esc(facts)}` : ""}</div><div class="c">${esc(p.card)}</div>${scores}</div></div>`;
    })
    .join("")}</div>`;
}

export function reviewPage(args: { title: string; rows: Row[]; runNames: string[]; engine: ScoredRun; baseline?: ScoredRun; briefs: Record<string, string>; calibration?: string; agreement?: string }): string {
  const { rows, runNames, engine, baseline, briefs } = args;
  const table = `<table><tr><th></th><th>Pass mark</th>${runNames.map((n) => `<th>${esc(n)}</th>`).join("")}</tr>${rows
    .map((r) => `<tr><td><span class="g">${esc(r.group)}</span> ${esc(r.name)}</td><td>${esc(r.mark)}</td>${r.values.map((v, i) => `<td>${badge(r.pass[i])} ${esc(v)}</td>`).join("")}</tr>`)
    .join("")}</table>`;
  const readers = engine.cases
    .map((c) => {
      const b = baseline?.cases.find((x) => x.id === c.id);
      return `<section><h2>${esc(c.id)} · ${esc(c.label)}</h2><div class="meta">Way in: ${esc(c.doorway || "—")}${c.serverMs ? ` · ${(c.serverMs / 1000).toFixed(1)}s` : ""}</div><details><summary>The reader's brief</summary><pre>${esc(briefs[c.id] ?? "")}</pre></details>${picksHtml(c)}${b ? `<details class="base"><summary>Plain Claude picked</summary>${picksHtml(b)}</details>` : ""}</section>`;
    })
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(args.title)}</title><style>
:root{--bg:#faf8f4;--fg:#1f1d1a;--mut:#6b665e;--line:#e4dfd6;--card:#fff;--ok:#2e7d4f;--no:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#191816;--fg:#ece8e1;--mut:#a39d93;--line:#34312c;--card:#22201d;--ok:#6fcf97;--no:#f28b82}}
body{background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,sans-serif;max-width:1000px;margin:0 auto;padding:16px}
h1{font-size:22px;font-weight:600}h2{font-size:17px;margin:0 0 2px}table{border-collapse:collapse;width:100%;font-size:13px;margin:12px 0 24px}
td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}.g{color:var(--mut);font-size:11px;display:block}
.b{display:inline-block;font-size:11px;padding:1px 6px;border-radius:8px;border:1px solid}.ok{color:var(--ok)}.no{color:var(--no)}.na{color:var(--mut)}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:14px 0}.meta{color:var(--mut);font-size:13px}
.picks{display:grid;gap:10px;margin-top:10px}.pick{display:grid;grid-template-columns:64px 1fr;gap:12px}.pick img,.nocover{width:64px;height:96px;object-fit:cover;border-radius:4px;background:var(--line)}
.t{font-weight:600}.a{color:var(--mut);font-size:13px}.c{font-size:14px;margin-top:4px}.score{display:none;font-size:13px;margin-top:6px;padding-left:8px;border-left:3px solid var(--line)}
body.show .score{display:block}.v{font-weight:600}.v.fail,.v.no{color:var(--no)}.v.pass,.v.yes{color:var(--ok)}pre{white-space:pre-wrap;font-size:12px;color:var(--mut)}
details{margin-top:8px}summary{cursor:pointer;color:var(--mut);font-size:13px}.err{color:var(--no)}label{font-size:14px}.note{color:var(--mut);font-size:13px}
</style></head><body><h1>${esc(args.title)}</h1>
<p class="note">${esc(args.calibration ?? "Judge calibration: not run")} · ${esc(args.agreement ?? "Second judge: not run")}</p>
${table}
<label><input type="checkbox" onchange="document.body.classList.toggle('show',this.checked)"> Show scores and judge reasons</label>
${readers}</body></html>`;
}
