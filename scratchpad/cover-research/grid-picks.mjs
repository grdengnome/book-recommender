// Lays out every pick's best cover in one numbered grid (work/grid-picks.png), for
// checking covers by eye. This is how the two fake covers (Miss Mapp's labelled
// stand-in, Sult's Project Gutenberg auto-cover) were found.
// Usage: node scratchpad/cover-research/grid-picks.mjs   (after analyze-covers.mjs)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const sharp = createRequire(import.meta.url)("sharp");
const WORK = "scratchpad/cover-research/work";
const rows = JSON.parse(readFileSync(`${WORK}/covers-analysis.json`, "utf8")).filter((r) => r.tag === "pick");
const W = 150, H = 225, COLS = 10, LH = 18;

const tiles = [];
for (const [k, r] of rows.entries()) {
  const x = (k % COLS) * W, y = Math.floor(k / COLS) * (H + LH);
  tiles.push({ input: await sharp(r.file).resize(W, H, { fit: "contain", background: "#808080" }).toBuffer(), left: x, top: y });
  tiles.push({
    input: Buffer.from(`<svg width="${W}" height="${LH}"><rect width="100%" height="100%" fill="black"/><text x="3" y="13" font-size="12" fill="white" font-family="sans-serif">#${r.idx}</text></svg>`),
    left: x, top: y + H,
  });
}
await sharp({ create: { width: W * COLS, height: Math.ceil(rows.length / COLS) * (H + LH), channels: 3, background: "#404040" } })
  .composite(tiles).png().toFile(`${WORK}/grid-picks.png`);
console.log(`wrote ${WORK}/grid-picks.png`);
