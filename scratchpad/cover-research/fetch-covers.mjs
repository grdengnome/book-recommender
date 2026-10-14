// Read-only cover research (2026-10-14). For every book in sample.json, tries
// Open Library, Hardcover, and Google Books independently, downloads each cover,
// reads its real pixel size from the image header, and writes results.json.
// Resumable: books already in results.json are skipped.
// Usage: node --env-file=.env.local scratchpad/cover-research/fetch-covers.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const HERE = new URL(".", import.meta.url);
const RESULTS = new URL("results.json", HERE);
// Reuse the project's User-Agent without retyping it here.
const USER_AGENT = readFileSync(new URL("../../lib/tools/searchBooks.ts", HERE), "utf8")
  .match(/const USER_AGENT = "([^"]+)"/)[1];
const HC_TOKEN = process.env.HARDCOVER_API_TOKEN;
const MIN_REAL_COVER_PX = 50; // anything narrower or shorter is a placeholder pixel/stub

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- politeness: one request per second per site ----------
const lastHit = {};
async function politeFetch(site, url, init = {}) {
  const wait = (lastHit[site] ?? 0) + 1000 - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit[site] = Date.now();
  return fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) } });
}

// ---------- image header parsing (JPEG / PNG / GIF / WebP) ----------
function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { format: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") return { format: "gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { format: "webp", width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { format: "webp", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") { const b = buf.readUInt32LE(21); return { format: "webp", width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) }; }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { format: "jpeg", width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

async function downloadImage(site, url) {
  try {
    const res = await politeFetch(site, url, { redirect: "follow" });
    if (!res.ok) return { imageStatus: res.status, imageError: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const size = imageSize(buf);
    if (!size) return { imageStatus: res.status, imageError: "unreadable image header", bytes: buf.length };
    return { imageStatus: res.status, ...size, bytes: buf.length, sha1: createHash("sha1").update(buf).digest("hex") };
  } catch (e) {
    return { imageError: String(e.message ?? e) };
  }
}

// ---------- title / author matching ----------
const strip = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const isLatin = (s) => /[a-z]/i.test(strip(s)) && !/[^\u0000-ɏ\s.,'’\-]/.test(strip(s));
const STOP = new Set(["the", "a", "an", "of", "and", "&", "la", "le", "el", "les", "der", "die", "das"]);
function mainTitle(t) {
  return strip(t).replace(/\(.*?\)|\[.*?\]/g, " ").split(/[:;]| - /)[0].replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
const tokens = (t) => mainTitle(t).split(" ").filter((w) => w && !STOP.has(w));
function titleScore(want, got) {
  const a = tokens(want), b = tokens(got);
  if (!a.length || !b.length) return mainTitle(want) === mainTitle(got) ? 1 : 0;
  const sb = new Set(b);
  const inter = a.filter((w) => sb.has(w)).length;
  return (2 * inter) / (a.length + b.length);
}
const surnames = (names) => names.flatMap((n) => strip(n).replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1));
// true / false, or null when it can't be judged (non-Latin script on one side, or no author returned).
function authorMatch(want, gotNames) {
  if (!gotNames?.length) return null;
  if (!isLatin(want) || !gotNames.some(isLatin)) {
    return gotNames.some((g) => strip(g).replace(/\s/g, "") === strip(want).replace(/\s/g, "")) ? true : null;
  }
  const a = new Set(surnames([want]));
  return surnames(gotNames).some((w) => a.has(w));
}
const DERIVATIVE = /\b(summary|study guide|sparknotes|cliffsnotes|analysis of|workbook|coloring book|notes on)\b/i;
function judge(book, gotTitle, gotAuthors) {
  const ts = titleScore(book.title, gotTitle ?? "");
  const am = authorMatch(book.author, gotAuthors);
  const derivative = DERIVATIVE.test(gotTitle ?? "") && !DERIVATIVE.test(book.title);
  const reasons = [];
  if (ts < 0.5) reasons.push(`title differs (score ${ts.toFixed(2)})`);
  if (am === false) reasons.push("author differs");
  if (derivative) reasons.push("summary/study-guide edition");
  return { titleScore: +ts.toFixed(2), authorMatch: am, wrongMatch: reasons.length > 0, wrongMatchReasons: reasons };
}
// Rank candidates: best title+author agreement first, then prefer ones that carry a cover.
function pickBest(book, cands) {
  const scored = cands.map((c) => ({ c, j: judge(book, c.title, c.authors) }));
  scored.sort((x, y) =>
    (y.j.titleScore + (y.j.authorMatch === true ? 1 : y.j.authorMatch === null ? 0.5 : 0)) -
    (x.j.titleScore + (x.j.authorMatch === true ? 1 : x.j.authorMatch === null ? 0.5 : 0)) ||
    (y.c.hasCover ? 1 : 0) - (x.c.hasCover ? 1 : 0));
  return scored[0] ?? null;
}
const searchTitle = (t) => strip(t).replace(/\(.*?\)|\[.*?\]/g, " ").split(/[:;]/)[0].replace(/\s+/g, " ").trim() || t;

// ---------- sources ----------
async function openLibrary(book) {
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(searchTitle(book.title))}&author=${encodeURIComponent(book.author)}&fields=key,title,author_name,cover_i&limit=5`;
  const res = await politeFetch("openlibrary", url);
  if (!res.ok) return { status: "error", error: `search HTTP ${res.status}` };
  const docs = (await res.json()).docs ?? [];
  const best = pickBest(book, docs.map((d) => ({ title: d.title, authors: d.author_name ?? [], hasCover: !!d.cover_i, d })));
  if (!best) return { status: "no-match" };
  const base = { matchedTitle: best.c.title, matchedAuthors: best.c.authors, matchId: best.c.d.key, ...best.j };
  if (!best.c.d.cover_i) return { status: "no-cover", ...base };
  const imageUrl = `https://covers.openlibrary.org/b/id/${best.c.d.cover_i}-L.jpg?default=false`;
  return { status: "image", ...base, imageUrl, ...(await downloadImage("openlibrary", imageUrl)) };
}

async function hardcover(book) {
  if (!HC_TOKEN) return { status: "error", error: "HARDCOVER_API_TOKEN not set" };
  const query = `query Q($q: String!) { search(query: $q, query_type: "Book", per_page: 5) { results } }`;
  const res = await politeFetch("hardcover", "https://api.hardcover.app/v1/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: HC_TOKEN.startsWith("Bearer ") ? HC_TOKEN : `Bearer ${HC_TOKEN}` },
    body: JSON.stringify({ query, variables: { q: `${searchTitle(book.title)} ${book.author}` } }),
  });
  if (!res.ok) return { status: "error", error: `search HTTP ${res.status}` };
  const json = await res.json();
  if (json.errors) return { status: "error", error: json.errors.map((e) => e.message).join("; ").slice(0, 200) };
  const hits = json.data?.search?.results?.hits ?? [];
  const best = pickBest(book, hits.map((h) => ({ title: h.document.title, authors: h.document.author_names ?? [], hasCover: !!h.document.image?.url, d: h.document })));
  if (!best) return { status: "no-match" };
  const base = { matchedTitle: best.c.title, matchedAuthors: best.c.authors, matchId: best.c.d.id, ...best.j,
    declaredWidth: best.c.d.image?.width ?? null, declaredHeight: best.c.d.image?.height ?? null };
  if (!best.c.d.image?.url) return { status: "no-cover", ...base };
  const imageUrl = best.c.d.image.url;
  return { status: "image", ...base, imageUrl, ...(await downloadImage("hardcover-assets", imageUrl)) };
}

let googleDisabled = null;
async function googleFetchJson(url) {
  for (const backoff of [0, 10_000, 30_000, 60_000]) {
    if (backoff) { console.log(`  google: rate-limited, waiting ${backoff / 1000}s`); await sleep(backoff); }
    const res = await politeFetch("google", url);
    if (res.status === 429 || res.status === 403 || res.status === 503) continue;
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { json: await res.json() };
  }
  return { rateLimited: true };
}
async function googleBooks(book) {
  if (googleDisabled) return { status: "skipped", error: googleDisabled };
  const q = `intitle:${searchTitle(book.title)} inauthor:${book.author}`;
  const s = await googleFetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books`);
  if (s.rateLimited) { googleDisabled = "rate-limited after backoff; source stopped"; return { status: "skipped", error: googleDisabled }; }
  if (s.error) return { status: "error", error: `search ${s.error}` };
  const items = s.json.items ?? [];
  const best = pickBest(book, items.map((it) => ({ title: it.volumeInfo?.title ?? "", authors: it.volumeInfo?.authors ?? [], hasCover: !!it.volumeInfo?.imageLinks, d: it })));
  if (!best) return { status: "no-match" };
  const base = { matchedTitle: best.c.title, matchedAuthors: best.c.authors, matchId: best.c.d.id, ...best.j };
  const v = await googleFetchJson(`https://www.googleapis.com/books/v1/volumes/${best.c.d.id}`);
  if (v.rateLimited) { googleDisabled = "rate-limited after backoff; source stopped"; return { status: "skipped", ...base, error: googleDisabled }; }
  if (v.error) return { status: "error", ...base, error: `volume ${v.error}` };
  const links = v.json.volumeInfo?.imageLinks ?? best.c.d.volumeInfo?.imageLinks;
  const size = ["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"].find((k) => links?.[k]);
  if (!size) return { status: "no-cover", ...base };
  const imageUrl = links[size].replace(/^http:/, "https:").replace(/&edge=curl/, "");
  return { status: "image", ...base, imageLinkSize: size, imageUrl, ...(await downloadImage("google-images", imageUrl)) };
}

// ---------- run ----------
const sample = JSON.parse(readFileSync(new URL("sample.json", HERE), "utf8")).books;
const results = existsSync(RESULTS) ? JSON.parse(readFileSync(RESULTS, "utf8")) : { books: [] };
const done = new Set(results.books.map((b) => `${b.title}|${b.author}`));
const safe = async (fn, book) => { try { return await fn(book); } catch (e) { return { status: "error", error: String(e.message ?? e) }; } };

let n = 0;
for (const book of sample) {
  n++;
  if (done.has(`${book.title}|${book.author}`)) continue;
  const [ol, hc, gb] = await Promise.all([safe(openLibrary, book), safe(hardcover, book), safe(googleBooks, book)]);
  results.books.push({ ...book, sources: { openlibrary: ol, hardcover: hc, google: gb } });
  results.googleDisabled = googleDisabled;
  writeFileSync(RESULTS, JSON.stringify(results, null, 2));
  const fmt = (r) => r.status === "image" ? (r.width ? `${r.width}x${r.height}` : r.imageError) : r.status;
  console.log(`${n}/${sample.length} [${book.tag}] ${book.title} — OL ${fmt(ol)} | HC ${fmt(hc)} | GB ${fmt(gb)}`);
}
console.log("done", googleDisabled ? `(google: ${googleDisabled})` : "");
