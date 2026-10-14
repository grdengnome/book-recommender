// Builds upscale-blind.html: the same 10 pairs, unlabelled, sides shuffled with a fixed seed,
// images embedded so filenames can't give the answer away. Choices live in page memory only.
// Usage: node scratchpad/cover-research/build-blind.mjs
import { readFileSync, writeFileSync } from "node:fs";
const WORK = "scratchpad/cover-research/work", D = "scratchpad/cover-research/";
const books = JSON.parse(readFileSync(`${WORK}/softest10.json`, "utf8"));
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = mulberry32(20261014);
// Images are embedded as data URIs so filenames can't give the answer away.
const uri = (f, mime) => `data:${mime};base64,${readFileSync(D + "upscaled/" + f).toString("base64")}`;
const pairs = books.map(b => ({
  title: b.title, w: b.w, h: b.h, upscaledLeft: rand() < 0.5,
  orig: uri(`${b.name}-original.jpg`, "image/jpeg"), up: uri(`${b.name}-2x.png`, "image/png"),
}));
console.log("left = 2x for:", pairs.map((p, i) => `${i + 1}:${p.upscaledLeft ? "L" : "R"}`).join(" "));
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blind Upscale Test</title>
<style>
:root { --bg:#111110; --panel:#1c1b19; --fg:#ecebe6; --muted:#a3a19a; --line:#2e2d29; --on:#ecebe6; --good:#5fd387; --bad:#ff6b5e; color-scheme: dark; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.45 system-ui, sans-serif; }
header, main, footer { padding:16px; }
h1 { font-size:17px; margin:0 0 4px; } header p { margin:0; color:var(--muted); font-size:13px; max-width:65ch; }
article { padding:20px 0; border-top:1px solid var(--line); }
h2 { font-size:13px; color:var(--muted); font-weight:600; margin:0 0 8px; }
.pair { display:flex; flex-wrap:wrap; gap:12px; }
.pair img { display:block; width:284px; max-width:calc(50vw - 22px); height:auto; }
.ans { font-size:12px; color:var(--muted); margin-top:4px; min-height:1em; }
.btns { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
button { font:inherit; color:var(--fg); background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:8px 12px; cursor:pointer; }
button[aria-pressed="true"] { border-color:var(--on); font-weight:600; }
.result { margin-top:8px; font-size:13px; font-weight:600; }
.good { color:var(--good); } .bad { color:var(--bad); }
footer { border-top:1px solid var(--line); }
#score { font-size:16px; font-weight:600; margin-top:10px; }
</style></head><body>
<header><h1>Blind upscale test</h1>
<p>Each pair is the same cover twice: once as the original, once upscaled 2×, both shown 284px wide. Sides are randomised. For each pair, pick the sharper one, then press Reveal at the bottom. Choices aren't saved anywhere; reloading clears them.</p></header>
<main id="list"></main>
<footer><button id="reveal">Reveal</button><div id="score"></div></footer>
<script>
const PAIRS = ${JSON.stringify(pairs.map(({ title, w, h, upscaledLeft }) => ({ title, w, h, upscaledLeft })))};
const IMGS = ${JSON.stringify(pairs.map(p => [p.orig, p.up]))};
const choice = new Array(PAIRS.length).fill(null);
let revealed = false;
const list = document.getElementById("list");
PAIRS.forEach((p, i) => {
  const [orig, up] = IMGS[i];
  const [left, right] = p.upscaledLeft ? [up, orig] : [orig, up];
  const el = document.createElement("article");
  el.innerHTML = \`<h2>Pair \${i + 1}</h2>
    <div class="pair"><div><img src="\${left}" style="aspect-ratio:\${p.w}/\${p.h}" alt="Left cover"><div class="ans" data-side="L"></div></div>
    <div><img src="\${right}" style="aspect-ratio:\${p.w}/\${p.h}" alt="Right cover"><div class="ans" data-side="R"></div></div></div>
    <div class="btns"><button data-v="L">Left is sharper</button><button data-v="R">Right is sharper</button><button data-v="?">Can't tell</button></div>
    <div class="result"></div>\`;
  el.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    if (revealed) return;
    choice[i] = b.dataset.v;
    el.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  list.appendChild(el);
});
document.getElementById("reveal").addEventListener("click", () => {
  revealed = true;
  let score = 0, cant = 0;
  list.querySelectorAll("article").forEach((el, i) => {
    const p = PAIRS[i], upSide = p.upscaledLeft ? "L" : "R";
    el.querySelectorAll(".ans").forEach(a => {
      const isUp = a.dataset.side === upSide;
      a.textContent = isUp ? \`2× upscaled · \${p.w * 2}×\${p.h * 2}\` : \`Original · \${p.w}×\${p.h}\`;
    });
    const c = choice[i], r = el.querySelector(".result");
    if (c === upSide) { score++; r.innerHTML = \`<span class="good">You picked the 2× version</span> · \${p.title}\`; }
    else if (c === "?" || c === null) { cant++; r.textContent = \`\${c === null ? "No answer" : "Can't tell"} · \${p.title}\`; }
    else r.innerHTML = \`<span class="bad">You picked the original</span> · \${p.title}\`;
  });
  document.getElementById("score").textContent = \`Score: \${score} / 10 picked the 2× version as sharper\${cant ? \` (\${cant} can't tell or unanswered)\` : ""}\`;
});
</script>
</body></html>`;
writeFileSync(D + "upscale-blind.html", html);
console.log((html.length / 1e6).toFixed(1), "MB");
