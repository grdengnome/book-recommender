// Grades results.json and writes summary-data.json (the numbers behind summary.md)
// and contact-sheet.html. summary.md itself is written by hand from summary-data.json.
// Usage: node scratchpad/cover-research/build-report.mjs
import { readFileSync, writeFileSync } from "node:fs";

const HERE = new URL(".", import.meta.url);
const { books, googleDisabled } = JSON.parse(readFileSync(new URL("results.json", HERE), "utf8"));
const SOURCES = ["openlibrary", "hardcover", "google"];
const LABEL = { openlibrary: "Open Library", hardcover: "Hardcover", google: "Google Books" };
const MIN_REAL_COVER_PX = 50;

// An image byte-identical across 3+ different books is a placeholder ("image not available").
const shaBooks = {};
for (const b of books) for (const s of SOURCES) {
  const r = b.sources[s];
  if (r.sha1) (shaBooks[r.sha1] ??= new Set()).add(`${b.title}|${b.author}`);
}
const placeholderShas = new Set(Object.entries(shaBooks).filter(([, v]) => v.size >= 3).map(([k]) => k));

function grade(r) {
  if (r.status !== "image" || !r.width) return "None";
  if (r.width < MIN_REAL_COVER_PX || r.height < MIN_REAL_COVER_PX) return "None";
  if (placeholderShas.has(r.sha1)) return "None";
  return r.width >= 500 ? "Sharp" : r.width >= 300 ? "Usable" : "Small";
}
function fakeReason(r) {
  if (r.status !== "image" || !r.width) return null;
  if (r.width < MIN_REAL_COVER_PX || r.height < MIN_REAL_COVER_PX) return `tiny placeholder (${r.width}×${r.height})`;
  if (placeholderShas.has(r.sha1)) return "placeholder image (same bytes as other books)";
  return null;
}
for (const b of books) {
  for (const s of SOURCES) {
    const r = b.sources[s];
    r.grade = grade(r);
    r.fake = fakeReason(r);
  }
  // Best real cover across sources: widest image, ignoring flagged wrong-book matches.
  const ok = SOURCES.filter((s) => b.sources[s].grade !== "None" && !b.sources[s].wrongMatch);
  b.best = ok.sort((x, y) => b.sources[y].width - b.sources[x].width)[0] ?? null;
  b.bestGrade = b.best ? b.sources[b.best].grade : "None";
}
writeFileSync(new URL("results.json", HERE), JSON.stringify({ books, googleDisabled, placeholderShas: [...placeholderShas] }, null, 2));

// ---------- numbers ----------
const GRADES = ["Sharp", "Usable", "Small", "None"];
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "–");
function stats(group, getGrade, getWrong) {
  const split = Object.fromEntries(GRADES.map((g) => [g, group.filter((b) => getGrade(b) === g).length]));
  return { n: group.length, hits: group.length - split.None, wrong: group.filter(getWrong).length, split };
}
const data = { googleDisabled, placeholderShas: placeholderShas.size, groups: {} };
for (const tag of ["pick", "pool"]) {
  const group = books.filter((b) => b.tag === tag);
  const g = {};
  for (const s of SOURCES) g[s] = stats(group, (b) => b.sources[s].grade, (b) => b.sources[s].grade !== "None" && b.sources[s].wrongMatch);
  g.best = stats(group, (b) => b.bestGrade, () => false);
  g.bestFrom = Object.fromEntries(SOURCES.map((s) => [s, group.filter((b) => b.best === s).length]));
  // How often each source alone is the only way to a Sharp cover.
  g.onlySharp = Object.fromEntries(SOURCES.map((s) => [s, group.filter((b) => {
    const sharp = SOURCES.filter((x) => b.sources[x].grade === "Sharp" && !b.sources[x].wrongMatch);
    return sharp.length === 1 && sharp[0] === s;
  }).length]));
  g.fakes = Object.fromEntries(SOURCES.map((s) => [s, group.filter((b) => b.sources[s].fake).length]));
  data.groups[tag] = g;
}
writeFileSync(new URL("summary-data.json", HERE), JSON.stringify(data, null, 2));

// Markdown tables printed for pasting into summary.md.
for (const tag of ["pick", "pool"]) {
  const g = data.groups[tag];
  console.log(`\n### ${tag === "pick" ? "Picks" : "Pool sample"} (n=${g.best.n})\n`);
  console.log("| Source | Hit rate | Wrong-book matches | Sharp | Usable | Small | None |\n|---|---|---|---|---|---|---|");
  for (const s of [...SOURCES, "best"]) {
    const x = g[s];
    const name = s === "best" ? "**Best of all three**" : LABEL[s];
    const wrong = s === "best" ? "(excluded)" : `${x.wrong}`;
    console.log(`| ${name} | ${x.hits}/${x.n} (${pct(x.hits, x.n)}) | ${wrong} | ${GRADES.map((gr) => `${x.split[gr]} (${pct(x.split[gr], x.n)})`).join(" | ")} |`);
  }
  console.log(`best from: ${JSON.stringify(g.bestFrom)}  only-sharp: ${JSON.stringify(g.onlySharp)}  fakes: ${JSON.stringify(g.fakes)}`);
}

// ---------- contact sheet ----------
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function cell(b, s) {
  const r = b.sources[s];
  const wrong = r.wrongMatch && r.status !== "no-match"
    ? `<div class="wrong">Likely wrong book: ${esc(r.wrongMatchReasons.join("; "))}</div>` : "";
  const matched = r.matchedTitle ? `<div class="matched">${esc(r.matchedTitle)} — ${esc((r.matchedAuthors ?? []).join(", "))}</div>` : "";
  let box, label;
  if (r.status === "image" && r.width && !r.fake) {
    box = `<img src="${esc(r.imageUrl)}" width="${r.width}" height="${r.height}" loading="lazy" alt="">`;
    label = `${r.width}×${r.height} · <b class="g-${r.grade}">${r.grade}</b>`;
  } else {
    const why = r.fake ?? r.imageError ?? r.error ?? { "no-cover": "match has no cover", "no-match": "no match found", skipped: "source skipped" }[r.status] ?? r.status;
    box = `<span class="none">${esc(why)}</span>`;
    label = `<b class="g-None">None</b>`;
  }
  return `<td><div class="src">${LABEL[s]}${b.best === s ? ' <span class="best">best</span>' : ""}</div><div class="box">${box}</div><div class="lbl">${label}</div>${matched}${wrong}</td>`;
}
const ordered = [...books.filter((b) => b.tag === "pick"), ...books.filter((b) => b.tag === "pool")];
const rows = ordered.map((b) => `<tr><th><div class="t">${esc(b.title)}</div><div class="a">${esc(b.author)}</div><span class="tag tag-${b.tag}">${b.tag}</span><div class="bg">best: <b class="g-${b.bestGrade}">${b.bestGrade}</b></div></th>${SOURCES.map((s) => cell(b, s)).join("")}</tr>`).join("\n");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cover Contact Sheet</title>
<style>
:root { --bg:#f6f5f2; --fg:#1d1d1b; --muted:#6b6a66; --box:#e4e2dc; --line:#d6d3cb; --red:#c0261b; --sharp:#1d7a3a; --usable:#8a6d00; --small:#b45309; --none:#6b6a66; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#161614; --fg:#ecebe6; --muted:#a3a19a; --box:#2a2926; --line:#34332f; --red:#ff6b5e; --sharp:#5fd387; --usable:#e6c34a; --small:#f59e5b; --none:#a3a19a; } }
:root[data-theme="dark"] { --bg:#161614; --fg:#ecebe6; --muted:#a3a19a; --box:#2a2926; --line:#34332f; --red:#ff6b5e; --sharp:#5fd387; --usable:#e6c34a; --small:#f59e5b; --none:#a3a19a; }
body { margin:0; padding:16px; background:var(--bg); color:var(--fg); font:14px/1.4 system-ui, sans-serif; }
h1 { font-size:20px; margin:0 0 4px; } p.note { color:var(--muted); margin:0 0 16px; max-width:70ch; }
.wrap { overflow-x:auto; } table { border-collapse:collapse; }
th, td { vertical-align:top; text-align:left; padding:12px 10px; border-top:1px solid var(--line); }
th { width:200px; min-width:160px; } .t { font-weight:600; } .a { color:var(--muted); margin-bottom:6px; }
.tag { font-size:11px; text-transform:uppercase; letter-spacing:.05em; padding:1px 6px; border-radius:3px; border:1px solid var(--line); }
.tag-pick { font-weight:700; } .bg { margin-top:6px; font-size:12px; }
.src { font-size:12px; color:var(--muted); margin-bottom:4px; } .best { color:var(--sharp); font-weight:700; }
.box { width:284px; height:426px; background:var(--box); display:flex; align-items:center; justify-content:center; overflow:hidden; }
.box img { max-width:100%; max-height:100%; width:auto; height:auto; display:block; }
.none { color:var(--muted); font-size:12px; padding:12px; text-align:center; }
.lbl { margin-top:4px; font-size:12px; } .matched { font-size:11px; color:var(--muted); max-width:284px; }
.wrong { color:var(--red); font-size:12px; font-weight:600; max-width:284px; }
.g-Sharp { color:var(--sharp); } .g-Usable { color:var(--usable); } .g-Small { color:var(--small); } .g-None { color:var(--none); }
</style></head><body>
<h1>Cover contact sheet</h1>
<p class="note">${books.filter((b) => b.tag === "pick").length} picks, then ${books.filter((b) => b.tag === "pool").length} pool books. Each cover is shown in a 284×426 reveal-size box, never enlarged past its natural pixel size, so small images look small. Sharp ≥ 500px wide, Usable 300–499, Small &lt; 300.${googleDisabled ? ` Google Books: ${esc(googleDisabled)}.` : ""}</p>
<div class="wrap"><table>${rows}</table></div>
</body></html>`;
writeFileSync(new URL("contact-sheet.html", HERE), html);
console.log("\nwrote results.json (graded), summary-data.json, contact-sheet.html");
