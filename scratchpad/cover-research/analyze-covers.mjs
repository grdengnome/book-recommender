// Downloads each book's best real cover (widest, ignoring flagged wrong-book matches)
// into work/covers/ and measures brightness and detail with sharp (already installed).
// Covers all picks plus the first 40 pool books. Writes work/covers-analysis.json and
// work/softest10.json (the 10 narrowest pick covers, input to upscale-softest.py).
// The 8 design samples in samples/ were then chosen by eye from grid-picks.mjs's grid.
// Usage: node scratchpad/cover-research/analyze-covers.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const sharp = createRequire(import.meta.url)("sharp");
const HERE = new URL(".", import.meta.url);
const WORK = "scratchpad/cover-research/work";
mkdirSync(`${WORK}/covers`, { recursive: true });
const USER_AGENT = readFileSync(new URL("../../lib/tools/searchBooks.ts", HERE), "utf8")
  .match(/const USER_AGENT = "([^"]+)"/)[1];
const { books } = JSON.parse(readFileSync(new URL("results.json", HERE), "utf8"));
const SOURCES = ["openlibrary", "hardcover", "google"];
const POOL_LIMIT = 40;

const lastHit = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (t) => t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).slice(0, 4).join("-");

const rows = [];
let i = 0;
for (const b of books) {
  i++;
  if (b.tag === "pool" && rows.filter((x) => x.tag === "pool").length >= POOL_LIMIT) break;
  const ok = SOURCES.filter((s) => b.sources[s].grade && b.sources[s].grade !== "None" && !b.sources[s].wrongMatch)
    .sort((x, y) => b.sources[y].width - b.sources[x].width);
  if (!ok.length) continue;
  const r = b.sources[ok[0]];
  const host = new URL(r.imageUrl).host;
  const wait = (lastHit[host] ?? 0) + 1000 - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit[host] = Date.now();
  const res = await fetch(r.imageUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) { console.log("fail", b.title, res.status); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const file = `${WORK}/covers/${String(i).padStart(3, "0")}.img`;
  writeFileSync(file, buf);
  const st = await sharp(buf).stats();
  const [R, G, B] = st.channels;
  rows.push({
    idx: i, tag: b.tag, title: b.title, author: b.author, source: ok[0], w: r.width, h: r.height,
    lum: Math.round(0.2126 * R.mean + 0.7152 * G.mean + 0.0722 * B.mean), // 0 black – 255 white
    entropy: +st.entropy.toFixed(2), // low = plain or typographic
    file, url: r.imageUrl,
  });
}
writeFileSync(`${WORK}/covers-analysis.json`, JSON.stringify(rows, null, 2));
const softest = rows.filter((x) => x.tag === "pick").sort((a, b) => a.w - b.w || a.h - b.h).slice(0, 10)
  .map((x, k) => ({ ...x, name: `${String(k + 1).padStart(2, "0")}-${slug(x.title)}` }));
writeFileSync(`${WORK}/softest10.json`, JSON.stringify(softest, null, 2));
console.log(`${rows.length} covers analysed; softest picks:`, softest.map((x) => `${x.title} ${x.w}x${x.h}`));
