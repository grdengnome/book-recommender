// Builds upscale-compare.html: each of the 10 softest picks as original vs EDSR 2x, both
// 284px wide, labelled with pixel sizes. Usage: node scratchpad/cover-research/build-compare.mjs
import { readFileSync, writeFileSync } from "node:fs";
const WORK = "scratchpad/cover-research/work";
const books = JSON.parse(readFileSync(`${WORK}/softest10.json`, "utf8"));
const LABEL = { openlibrary: "Open Library", hardcover: "Hardcover" };
const NOTES = { "Sult": "Not a real publisher cover (Project Gutenberg auto-generated)." };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const rows = books.map(b => `
<article>
  <h2>${esc(b.title)}</h2><div class="a">${esc(b.author)} · ${LABEL[b.source] ?? b.source}</div>
  ${NOTES[b.title] ? `<div class="note">${esc(NOTES[b.title])}</div>` : ""}
  <div class="pair">
    <figure><img src="upscaled/${b.name}-original.jpg" style="aspect-ratio:${b.w}/${b.h}" alt=""><figcaption>Original <b>${b.w}×${b.h}</b> · detail ${(b.w / 284).toFixed(2)}×</figcaption></figure>
    <figure><img src="upscaled/${b.name}-2x.png" style="aspect-ratio:${b.w}/${b.h}" alt=""><figcaption>EDSR 2× <b>${b.w * 2}×${b.h * 2}</b> · detail ${(b.w * 2 / 284).toFixed(2)}×</figcaption></figure>
  </div>
</article>`).join("");
writeFileSync("scratchpad/cover-research/upscale-compare.html", `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Upscale Comparison</title>
<style>
:root { --bg:#111110; --fg:#ecebe6; --muted:#a3a19a; --line:#2e2d29; --warn:#f59e5b; color-scheme: dark; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.45 system-ui, sans-serif; }
header { position:sticky; top:0; z-index:1; background:var(--bg); border-bottom:1px solid var(--line); padding:12px 16px; }
h1 { font-size:17px; margin:0 0 4px; } header p { margin:0 0 8px; color:var(--muted); font-size:12px; max-width:70ch; }
label { cursor:pointer; display:inline-flex; gap:6px; align-items:center; }
main { padding:0 16px 40px; }
article { padding:20px 0; border-bottom:1px solid var(--line); }
h2 { font-size:15px; margin:0; } .a { color:var(--muted); margin-bottom:8px; } .note { color:var(--warn); font-size:12px; margin-bottom:8px; }
.pair { display:flex; flex-wrap:wrap; gap:16px; }
figure { margin:0; }
figure img { display:block; width:284px; max-width:calc(100vw - 32px); height:auto; }
.zoom figure img { width:568px; }
figcaption { font-size:12px; color:var(--muted); margin-top:4px; } figcaption b { color:var(--fg); font-weight:600; }
</style></head><body>
<header><h1>Upscale comparison: 10 softest picks</h1>
<p>Left: the original stretched to 284px wide. Right: EDSR 2× (OpenCV dnn_superres, PSNR-trained, no GAN) at the same size. A phone wants about 2–3× detail.</p>
<label><input type="checkbox" id="zoom"> Magnify both to 568px (inspect text)</label></header>
<main>${rows}</main>
<script>document.getElementById("zoom").addEventListener("change", e => document.body.classList.toggle("zoom", e.target.checked));</script>
</body></html>`);
console.log("ok");
