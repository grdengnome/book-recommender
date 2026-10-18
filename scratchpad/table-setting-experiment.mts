// Experiment (2026-10-18, branch experiment/table-setting): "a new way to set the table", run 1 of 2.
// Compares today's engine (arm A, driven through the local dev server) with a smaller table
// built from AI proposals + a Wikidata prize shelf, verified against the catalogs (arm B).
// The live engine is not changed; lib modules are imported as they are.
//
// Usage (dev server with ENGINE_TRACE=1 must be running for arm A):
//   node --env-file=.env.local scratchpad/table-setting-experiment.mts armA
//   node --env-file=.env.local scratchpad/table-setting-experiment.mts armB
//   node --env-file=.env.local scratchpad/table-setting-experiment.mts lists
//   node --env-file=.env.local scratchpad/table-setting-experiment.mts analyze
// Output (gitignored, holds taste descriptions): scratchpad/experiments/2026-10-18-table-setting/
import { registerHooks } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Resolve the app's "@/..." alias and extensionless relative imports the way Next does.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const base =
      specifier.startsWith("@/") ? path.join(ROOT, specifier.slice(2))
      : specifier.startsWith(".") && context.parentURL?.startsWith("file:") ? path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
      : null;
    if (base && !path.extname(base)) {
      for (const candidate of [`${base}.ts`, path.join(base, "index.ts")]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { checkPickGrounding, recordSeenCandidates } = await import("../lib/merge/pickGrounding.ts");
const { lookupPickMetadata } = await import("../lib/verify/lookupPickMetadata.ts");
const { hcGraphql } = await import("../lib/hardcover/preparePool.ts");
const { modelCallCostUsd } = await import("../lib/trace/requestTrace.ts");

// Hardcover allows about 60 requests a minute: space calls 1.1s apart and back off on 429.
let hcNext = 0;
export async function hc<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const wait = Math.max(0, hcNext - Date.now());
    hcNext = Math.max(Date.now(), hcNext) + 1100;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      return await hcGraphql<T>(query, variables);
    } catch (err) {
      if (attempt < 4 && /429/.test(String(err))) { await new Promise((r) => setTimeout(r, 15000)); continue; }
      throw err;
    }
  }
}

const OUT = path.join(ROOT, "scratchpad/experiments/2026-10-18-table-setting");
mkdirSync(OUT, { recursive: true });
const MODEL = "claude-sonnet-5"; // same final-selection model as app/api/recommend/route.ts
const UA = "book-recommender-experiment (https://github.com/grdengnome/book-recommender)";
const SPEND_CAP_USD = 5;
const LEDGER = path.join(OUT, "spend-ledger.json");

// Verbatim from scratchpad/run-eval.mjs (docs/eval-set.md inputs).
export const CASES: { id: string; taste: string }[] = [
  { id: "case-1", taste: "My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book." },
  { id: "case-5", taste: "My favorite book of all time is 'War and Peace' — I loved the sprawling scope and how deeply it got into every character's inner life. But right now I want something light and quick to read, nothing heavy or slow." },
  { id: "case-6", taste: "I love literary fiction — character studies, beautiful prose, morally complicated people. I will not read fantasy under any circumstances: no magic systems, no invented worlds." },
  { id: "case-8", taste: "I'm looking for something with a really granular, immersive sense of place — I want to feel like I'm actually there — and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture." },
  { id: "case-9", taste: "I love narrative nonfiction — real events told with the pacing and craft of a novel. Specifically deep-dive investigative journalism or historical accounts that read like thrillers. That's exactly what I'm looking for right now." },
  { id: "case-10", taste: "🌊🏚️👻🕯️ — moody, atmospheric, a little unsettling but not full horror. That's the vibe I want." },
];

const readJson = (f: string) => JSON.parse(readFileSync(f, "utf8"));
const writeJson = (f: string, v: unknown) => writeFileSync(f, JSON.stringify(v, null, 1));

// ---------- spend ledger (arm A costs come from its traces, arm B from each response) ----------
type Ledger = { entries: { what: string; usd: number }[]; totalUsd: number };
function ledger(): Ledger {
  return existsSync(LEDGER) ? readJson(LEDGER) : { entries: [], totalUsd: 0 };
}
function spend(what: string, usd: number) {
  const l = ledger();
  l.entries.push({ what, usd });
  l.totalUsd = Math.round((l.totalUsd + usd) * 1e6) / 1e6;
  writeJson(LEDGER, l);
  if (l.totalUsd > SPEND_CAP_USD) throw new Error(`SPEND CAP: total $${l.totalUsd} is over $${SPEND_CAP_USD}; stopping`);
}
function assertUnderCap() {
  const t = ledger().totalUsd;
  if (t > SPEND_CAP_USD) throw new Error(`SPEND CAP: total $${t} is over $${SPEND_CAP_USD}; stopping`);
}

async function claude(what: string, system: string, user: string, maxTokens = 6000) {
  assertUnderCap();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const start = performance.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  const ms = Math.round(performance.now() - start);
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(data?.error ?? data).slice(0, 300)}`);
  const usd = modelCallCostUsd(MODEL, data.usage) ?? 0;
  spend(what, usd);
  const text = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { text, usd, ms, usage: data.usage };
}

// Lenient parse for our own use (records separately whether the raw text was clean JSON).
export function parseLoose(text: string, open: "[" | "{"): any {
  const close = open === "[" ? "]" : "}";
  const s = text.indexOf(open), e = text.lastIndexOf(close);
  return JSON.parse(text.slice(s, e + 1));
}

// ---------- matching keys: same rules as lib/merge/pickGrounding.ts (not exported there) ----------
const fold = (s: string) => (s ?? "").normalize("NFKD").replace(/\p{M}/gu, "");
export function titleKey(t: string) {
  const f = fold(t).toLowerCase();
  const b = f.split(/[:(]/)[0];
  return (b.trim() ? b : f).replace(/^(the|a|an)\s+/, "").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}
export function authorKey(a: string) {
  const t = fold(a).toLowerCase().trim().split(/\s+/);
  return t[t.length - 1].replace(/[^\p{L}\p{N}]/gu, "");
}
export const bookKey = (t: string, a: string) => `${titleKey(t)}|${authorKey(a)}`;
function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const similar = (a: string, b: string) => {
  const m = Math.max(a.length, b.length);
  return m > 0 && 1 - lev(a, b) / m >= 0.8;
};

// ---------- catalog access ----------
const OL_FIELDS = "key,title,subtitle,author_name,author_alternative_name,alternative_title,first_publish_year,edition_count,number_of_pages_median,isbn,cover_i,language,subject";
export async function olSearch(params: Record<string, string>, limit = 8): Promise<any[]> {
  const url = new URL("https://openlibrary.org/search.json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("fields", OL_FIELDS);
  url.searchParams.set("limit", String(limit));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      if (r.ok) return (await r.json()).docs ?? [];
    } catch {}
    await new Promise((res) => setTimeout(res, 1500));
  }
  return [];
}
export async function hcSearchBooks(q: string, perPage = 8): Promise<any[]> {
  try {
    const d: any = await hc(`query($q:String!,$n:Int!){ search(query:$q, query_type:"Book", per_page:$n, page:1){ results } }`, { q, n: perPage });
    return (d?.search?.results?.hits ?? []).map((h: any) => h.document);
  } catch {
    return [];
  }
}

// Strict = the existing grounding check passes against the catalog's own title + author_name.
// Implemented by feeding the catalog docs through recordSeenCandidates/checkPickGrounding.
function strictMatch(s: { title: string; author: string }, records: any[]) {
  const seen = new Map();
  recordSeenCandidates(seen, records);
  const g = checkPickGrounding(JSON.stringify([{ title: s.title, author: s.author }]), seen);
  return g.status === "grounded" ? g.picks[0].record : null;
}
function olRecords(docs: any[]) {
  // One record per listed author name, so a co-author/translator listed first doesn't block the match.
  return docs.flatMap((d) =>
    (d.author_name ?? []).map((a: string) => ({
      title: d.title, author: a, subjects: (d.subject ?? []).slice(0, 3), sources: ["openlibrary"], olWorkKey: d.key, _doc: d,
    })),
  );
}
function hcRecords(docs: any[]) {
  return docs.flatMap((d) =>
    (d.author_names ?? []).map((a: string) => ({
      title: d.title, author: a, subjects: (d.genres ?? []).slice(0, 3), sources: ["hardcover"], hcBookId: Number(d.id), _hc: d,
    })),
  );
}

type Verified = { status: "verified"; record: any; via: "openlibrary" | "hardcover" };
type Failed = { status: "near-miss" | "invented"; reason: string; match?: { title: string; author: string; key?: string } };
export async function verifyCandidate(s: { title: string; author: string }): Promise<Verified | Failed> {
  const olDocs = await olSearch({ title: s.title, author: s.author });
  const ol = strictMatch(s, olRecords(olDocs));
  if (ol) return { status: "verified", record: ol, via: "openlibrary" };
  const hcDocs = await hcSearchBooks(`${s.title} ${s.author}`);
  const hc = strictMatch(s, hcRecords(hcDocs));
  if (hc) return { status: "verified", record: hc, via: "hardcover" };

  // Near-miss checks: same book under a catalog-listed alternate author name, an alternate or
  // translated title, or a slightly different author spelling. Searched more loosely.
  const loose = [...olDocs, ...(await olSearch({ q: s.title })), ...(await olSearch({ author: s.author }))];
  const tk = titleKey(s.title), ak = authorKey(s.author);
  for (const d of loose) {
    const titles = [d.title, ...(d.alternative_title ?? [])];
    const authors = [...(d.author_name ?? []), ...(d.author_alternative_name ?? [])];
    const titleHit = titles.some((t: string) => titleKey(t) === tk);
    const titleNear = titles.some((t: string) => similar(titleKey(t), tk));
    const authorExact = (d.author_name ?? []).some((a: string) => authorKey(a) === ak);
    const authorAlt = (d.author_alternative_name ?? []).some((a: string) => authorKey(a) === ak);
    const authorNear = authors.some((a: string) => similar(authorKey(a), ak) || fold(a).toLowerCase().split(/\s+/).includes(ak));
    const m = { title: d.title, author: (d.author_name ?? [])[0], key: d.key };
    if (titleHit && authorAlt) return { status: "near-miss", reason: "author under a catalog-listed alternate name", match: m };
    if (!titleHit && (titleNear || titles.slice(1).some((t: string) => titleKey(t) === tk)) && (authorExact || authorAlt))
      return { status: "near-miss", reason: "alternate or translated title", match: m };
    if (titleHit && authorNear) return { status: "near-miss", reason: "different author spelling", match: m };
  }
  for (const d of hcDocs) {
    const titles = [d.title, ...(d.alternative_titles ?? [])];
    const titleHit = titles.some((t: string) => titleKey(t) === tk || similar(titleKey(t), tk));
    const authorNear = (d.author_names ?? []).some((a: string) => similar(authorKey(a), ak));
    if (titleHit && authorNear) return { status: "near-miss", reason: "alternate title or author spelling (Hardcover)", match: { title: d.title, author: d.author_names?.[0] } };
  }
  // Right title, wrong author: the title exists but under someone else.
  if (loose.some((d) => titleKey(d.title) === tk)) return { status: "invented", reason: "title exists under a different author" };
  return { status: "invented", reason: "not found in either catalog" };
}

// ---------- prize shelf ----------
export const PRIZE: any[] = readJson(path.join(OUT, "prize-shelf.json")).map((p: any, i: number) => ({ ...p, id: `P${i + 1}` }));
const prizeByKey = new Map<string, any>();
for (const p of PRIZE) if (p.title && p.author) for (const a of p.author.split(", ")) prizeByKey.set(bookKey(p.title, a), p);
const prizeByOl = new Map<string, any>();
for (const p of PRIZE) for (const id of p.olWorkIds) prizeByOl.set(`/works/${id}`, p);
export function prizeFor(title: string, author: string, olWorkKey?: string) {
  return (olWorkKey && prizeByOl.get(olWorkKey)) || prizeByKey.get(bookKey(title, author)) || null;
}

// ---------- prompts ----------
// Taste rules 1–4 copied from route.ts's SYSTEM_PROMPT so the judgment is the same as today's.
export const TASTE_RULES = `1. Impression over popularity. Target books that leave a mark — ones a reader would be itching to recommend afterward, chosen because they're genuinely great and genuinely fit the reader's stated taste, not because they're famous or because they're obscure. Obscurity is not the goal; genuine quality and fit are.
2. Resist the reflex toward the bandwagon. Before finalizing a pick, ask whether you're reaching for it because it's the first familiar answer that comes to mind, rather than because it's the best fit for this specific reader. A widely-read book that authentically matches the reader's taste is a legitimate, even ideal, recommendation — the failure mode is defaulting to a familiar pick out of habit, not recommending a popular book on its merits. Reward range: vary era, author, and genre across your picks rather than giving three flavors of the same thing.
3. A pick fails on non-obviousness if it's the answer a well-read reader would already expect for this specific request — the one they'd land on after a five-minute search or find atop a "books like this" list. This has nothing to do with whether the book is decorated: a Booker winner can be a genuinely surprising, well-earned pick, and an award-free book can still be the most predictable possible answer.
4. Multi-source, not single-source. Draw from many corners of literature — different decades, countries, presses, and traditions. Never lean on a single canon (mainstream or "counter-canon") as if it were the only source worth considering.`;

export const PROPOSE_SYSTEM = `You help a book recommender set its table: a shortlist of real books that a later step will choose three final picks from. The goal is the most interesting and relevant books for this reader — authentically intriguing, familiar or not. Guard against the generic: the predictable, first-thing-you'd-think-of pick.

${TASTE_RULES}

Suggest about 25 books from your own reading that fit this reader's mood and feeling, spread across three kinds:
- "familiar-but-fresh": a known book or author, but not the reflexive answer for this request
- "discovery": a book this reader is unlikely to have met
- "wildcard": an unexpected angle (different genre, era or form) that still lands in the reader's mood

Only suggest books you are confident exist, with the author's name as it usually appears on English editions. Respect any stated turn-off as a hard boundary.

You may also choose up to 8 books from the attached prize shelf (listed by id). Choose them only when they genuinely fit; you don't have to choose any. Count them inside the ~25.

Respond with ONLY a JSON object: {"suggestions":[{"title":"...","author":"...","kind":"familiar-but-fresh|discovery|wildcard","reason":"one line","prizeShelfId":"P12 or null"}]}`;

const SELECT_SYSTEM = `You are a book recommendation engine. Your entire value proposition is taste, not popularity — you recommend books based on genuine fit and quality, actively resisting the pull toward safe, over-recommended picks. The goal is the most interesting and relevant books for this reader: authentically intriguing, familiar or not.

${TASTE_RULES}

Varied trio: the three picks must be three different kinds — one familiar-but-fresh (a known book or author, but not the reflexive answer), one discovery (a book this reader is unlikely to have met), and one wildcard (an unexpected angle that still lands) — and all three must stay within the mood and feeling the reader asked for. Treat any stated turn-off as a hard boundary.

All 3 picks MUST be chosen from the candidate table below. The table is unordered; never favor earlier entries. Copy each pick's title and author exactly as they appear in the table; picks are checked in code against it.

Respond with ONLY a JSON array of 3 objects: [{"title":"...","author":"...","kind":"familiar-but-fresh|discovery|wildcard"}]`;

const WRITE_SYSTEM = `You write the text for a book recommender's cards. For each pick you get the reader's taste, the book's catalog title and author, and its catalog description(s). Write in clean, plain English; no emoji.

Fields per pick:
- "title": the English display title, without series or edition noise like "(Penguin Classics)". Always English, even when the catalog title is in another language or script.
- "author": the author's name as "First Last", in its usual English transliteration, no stress marks.
- "hook": one short line for the revealed book, at most 90 characters.
- "why": why it's for this reader, about 2 sentences, tied to specifics in their taste.
- "story": a 2–3 sentence summary of what the book is about, based ONLY on the catalog description given. Never invent plot. If the description is missing or unusable, use null.
- "angleHeading": a heading for a third section, written for this specific pick (for example "Shelved in the wrong aisle"), at most 30 characters. Not a fixed label.
- "angleText": that section's body, about 2 sentences. Don't state claims about the book's fame, sales or obscurity unless you're confident they're accurate.
- "mood": one word.

Respond with ONLY a JSON array, one object per pick in the order given, with exactly those keys.`;

// ---------- arm B ----------
export const shuffle = <T,>(xs: T[]) => {
  const r = [...xs];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
};

export async function olEditionInfo(workKey: string) {
  try {
    const r = await fetch(`https://openlibrary.org${workKey}/editions.json?limit=50`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const eds: any[] = (await r.json()).entries ?? [];
    const isEng = (e: any) => (e.languages ?? []).some((l: any) => l.key === "/languages/eng");
    const withIsbn = eds.filter((e) => e.isbn_13?.length || e.isbn_10?.length);
    const best = withIsbn.find(isEng) ?? withIsbn[0] ?? null;
    if (!best) return null;
    return {
      isbn: best.isbn_13?.[0] ?? best.isbn_10?.[0],
      format: /hard/i.test(best.physical_format ?? "") ? "hardcover" : "paperback",
      pages: best.number_of_pages ?? null,
    };
  } catch {
    return null;
  }
}

async function runArmB(c: { id: string; taste: string }, run: number) {
  const t0 = performance.now();
  const costs: Record<string, number> = {};
  const shelfText = PRIZE.filter((p) => p.title && p.author && !/^Q\d+$/.test(p.title))
    .map((p) => `${p.id} | ${p.title} | ${p.author} | ${p.source}`).join("\n");

  // 1. AI proposes (+ up to 8 from the prize shelf)
  const prop = await claude(`B ${c.id} r${run} propose`, PROPOSE_SYSTEM, `Reader's taste:\n${c.taste}\n\nPrize shelf:\n${shelfText}`, 8000);
  costs.propose = prop.usd;
  // Fallback: parse each suggestion object on its own if the whole reply isn't valid JSON.
  let suggestions: any[] = [], proposeParsesClean = true, proposeDropped = 0;
  try { suggestions = parseLoose(prop.text, "{").suggestions ?? []; } catch {
    proposeParsesClean = false;
    for (const m of prop.text.match(/\{[^{}]*"title"[^{}]*\}/g) ?? []) {
      try { suggestions.push(JSON.parse(m)); } catch { proposeDropped++; }
    }
  }
  // Enforce the up-to-8 prize-shelf rule: keep the first 8, drop the rest (recorded).
  const prizeChosenRaw = suggestions.filter((s) => s.prizeShelfId);
  const prizeOverLimit = prizeChosenRaw.length > 8;
  const prizeDropped = prizeChosenRaw.slice(8);
  suggestions = suggestions.filter((s) => !prizeDropped.includes(s));
  const prizeChosen = suggestions.filter((s) => s.prizeShelfId);

  // 2–3. Verify every candidate (prize-shelf choices included) against the catalogs
  const verified: any[] = [];
  const failures: any[] = [];
  const tV = performance.now();
  const results = await mapLimit(suggestions, 4, async (s) => ({ s, v: await verifyCandidate(s) }));
  for (const { s, v } of results) {
    const origin = s.prizeShelfId ? "prize shelf" : "AI suggestion";
    if (v.status === "verified") verified.push({ suggestion: s, origin, via: v.via, record: v.record });
    else failures.push({ suggestion: s, origin, ...v });
  }
  const verifyMs = Math.round(performance.now() - tV);

  // Table: dedupe by work (or key); attach prize label where known (never model-facing)
  const table = new Map<string, any>();
  for (const v of verified) {
    const r = v.record;
    const k = r.olWorkKey ?? `hc:${r.hcBookId}`;
    if (table.has(k)) continue;
    const prize = (v.suggestion.prizeShelfId && PRIZE.find((p) => p.id === v.suggestion.prizeShelfId)) || prizeFor(r.title, r.author, r.olWorkKey);
    table.set(k, { ...r, origin: v.origin, kind: v.suggestion.kind, source: prize?.source ?? null, prizeOriginalTitle: prize?.originalTitle ?? null });
  }
  const tableRecords = [...table.values()];
  const seen = new Map();
  recordSeenCandidates(seen, tableRecords.map(({ _doc, _hc, origin, kind, source, prizeOriginalTitle, ...r }) => r));
  const modelTable = shuffle(tableRecords).map((r) => ({ title: r.title, author: r.author, subjects: r.subjects }));

  // 4a. Select (sees title, author, subjects only), grounded with retries like route.ts
  let selection: any = null, selectText = "", selectAttempts = 0;
  costs.select = 0;
  for (let attempt = 1; attempt <= 3 && !selection; attempt++) {
    selectAttempts = attempt;
    const sel = await claude(`B ${c.id} r${run} select a${attempt}`, SELECT_SYSTEM, `Reader's taste:\n${c.taste}\n\nCandidate table:\n${JSON.stringify(modelTable)}`, 4000);
    costs.select += sel.usd;
    selectText = sel.text;
    const g = checkPickGrounding(sel.text, seen);
    if (g.status === "grounded") selection = { picks: g.picks, kinds: parseLoose(sel.text, "[").map((p: any) => p.kind) };
  }
  if (!selection) return { case: c.id, run, error: "grounding failed 3 times", selectText, suggestions, failures, tableSize: tableRecords.length, costs, ms: Math.round(performance.now() - t0) };

  // Pick lookup (existing), then the write call
  const meta = await lookupPickMetadata(selection.picks);
  const picksFull = selection.picks.map((p: any, i: number) => {
    const r = tableRecords.find((t) => (p.record.olWorkKey && t.olWorkKey === p.record.olWorkKey) || (p.record.hcBookId && t.hcBookId === p.record.hcBookId));
    return { pick: p, rec: r, kind: selection.kinds[i], lookups: meta[i]?.lookups ?? [] };
  });
  const writeInput = picksFull.map((p: any, i: number) => ({
    n: i + 1, catalogTitle: p.pick.record.title, catalogAuthor: p.pick.record.author,
    descriptions: p.lookups.map((l: any) => l.description).filter((d: string) => d),
  }));
  const wr = await claude(`B ${c.id} r${run} write`, WRITE_SYSTEM, `Reader's taste:\n${c.taste}\n\nPicks:\n${JSON.stringify(writeInput)}`, 4000);
  costs.write = wr.usd;
  let written: any[] = [];
  let writeParsesClean = true;
  try { written = JSON.parse(wr.text); } catch { writeParsesClean = false; try { written = parseLoose(wr.text, "["); } catch { written = []; } }

  // Code-filled fields
  const picks = [];
  for (let i = 0; i < picksFull.length; i++) {
    const p = picksFull[i], w = written[i] ?? {}, rec = p.rec ?? {}, doc = rec._doc;
    let workKey = rec.olWorkKey;
    let olDoc = doc;
    if (!olDoc) { // Hardcover-verified: find the OL work for year/pages/ISBN
      const docs = await olSearch({ title: rec.title, author: rec.author }, 3);
      olDoc = docs.find((d) => titleKey(d.title) === titleKey(rec.title)) ?? null;
      workKey = olDoc?.key;
    }
    const ed = workKey ? await olEditionInfo(workKey) : null;
    const isbn = ed?.isbn ?? null;
    const hcYear = rec._hc?.release_year ?? null;
    const englishTitle = w.title ?? rec.title;
    const originalCandidate = rec.prizeOriginalTitle ?? rec.title;
    picks.push({
      title: englishTitle,
      originalTitle: originalCandidate && titleKey(originalCandidate) !== titleKey(englishTitle) ? originalCandidate : null,
      subtitle: olDoc?.subtitle ?? null,
      author: w.author ?? rec.author,
      year: olDoc?.first_publish_year ?? hcYear,
      pages: olDoc?.number_of_pages_median ?? ed?.pages ?? rec._hc?.pages ?? null,
      format: ed?.format ?? "paperback",
      coverUrl: olDoc?.cover_i ? `https://covers.openlibrary.org/b/id/${olDoc.cover_i}-L.jpg` : null,
      isbn,
      findLink: isbn ? `https://bookshop.org/book/${isbn}` : workKey ? `https://openlibrary.org${workKey}` : null,
      hook: w.hook, why: w.why, story: w.story ?? null, angleHeading: w.angleHeading, angleText: w.angleText, mood: w.mood,
      source: rec.source ?? null,
      // experiment-only fields (not part of the contract)
      _origin: rec.origin, _kind: p.kind, _catalogTitle: rec.title, _catalogAuthor: rec.author,
      _olWorkKey: workKey ?? null, _hcBookId: rec.hcBookId ?? null,
    });
  }

  return {
    case: c.id, run, ms: Math.round(performance.now() - t0), verifyMs, costs,
    usd: Object.values(costs).reduce((a, b) => a + b, 0),
    suggestionsCount: suggestions.length, proposeParsesClean, proposeDropped, proposeText: prop.text, prizeChosen: prizeChosen.length, prizeOverLimit, prizeDroppedCount: prizeDropped.length,
    verifiedCount: verified.length, failures, tableSize: tableRecords.length,
    table: tableRecords.map((r) => ({ title: r.title, author: r.author, origin: r.origin, source: r.source, olWorkKey: r.olWorkKey, hcBookId: r.hcBookId })),
    selectAttempts, selectText, writeText: wr.text, writeParsesClean, picks, suggestions,
  };
}

export async function mapLimit<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// ---------- arm A ----------
async function runArmA() {
  const results = [];
  for (const c of CASES) {
    assertUnderCap();
    const t0 = performance.now();
    const res = await fetch("http://localhost:3000/api/recommend", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tasteDescription: c.taste, evalTag: `trace1018-${c.id}` }),
      signal: AbortSignal.timeout(300000),
    });
    const body = await res.json();
    const ms = Math.round(performance.now() - t0);
    // Cost from this request's trace file
    const tf = readdirSync(path.join(ROOT, "scratchpad/traces")).filter((f) => f.includes(`trace1018-${c.id}-`)).sort().pop();
    const usd = tf ? readJson(path.join(ROOT, "scratchpad/traces", tf)).cost?.totalUsd ?? 0 : 0;
    spend(`A ${c.id}`, usd);
    results.push({ case: c.id, httpStatus: res.status, ms, usd, traceFile: tf, recommendations: body.recommendations ?? null, error: body.error ?? null });
    console.log(`A ${c.id}: HTTP ${res.status}, ${ms}ms, $${usd}`);
  }
  writeJson(path.join(OUT, "armA.json"), results);
}

// ---------- Hardcover lists (look only) ----------
const LIST_QUERIES: Record<string, string[]> = {
  "case-1": ["quiet melancholic", "restrained literary fiction", "slow character-driven"],
  "case-6": ["literary fiction character study", "morally complex characters", "beautiful prose"],
  "case-9": ["narrative nonfiction", "investigative journalism", "nonfiction that reads like a thriller"],
};
async function runLists() {
  const out: any = {};
  for (const [caseId, queries] of Object.entries(LIST_QUERIES)) {
    out[caseId] = [];
    for (const q of queries) {
      const d: any = await hc(`query($q:String!){ search(query:$q, query_type:"List", per_page:15, page:1){ results } }`, { q });
      const hits = (d?.search?.results?.hits ?? []).map((h: any) => h.document);
      const ids = hits.map((h: any) => Number(h.id));
      const det: any = ids.length
        ? await hc(`query($ids:[Int!]){ lists(where:{id:{_in:$ids}}){ id name featured ranked followers_count books_count public description list_books(limit:200){ reason } } }`, { ids })
        : { lists: [] };
      const byId = new Map((det.lists ?? []).map((l: any) => [l.id, l]));
      out[caseId].push({
        query: q, found: d?.search?.results?.found ?? 0,
        lists: ids.map((id: number) => {
          const l: any = byId.get(id);
          if (!l) return { id, missing: true };
          const reasons = l.list_books.filter((b: any) => b.reason && b.reason.trim()).length;
          return { id, name: l.name, featured: l.featured, ranked: l.ranked, followers: l.followers_count, books: l.books_count, hasDescription: !!(l.description ?? "").trim(), booksWithReason: reasons, booksChecked: l.list_books.length };
        }),
      });
      console.log(`lists ${caseId} "${q}": ${out[caseId].at(-1).found} found`);
    }
  }
  writeJson(path.join(OUT, "hardcover-lists.json"), out);
}

// ---------- analysis ----------
export const TASTE_ONE_LINE: Record<string, string> = {
  "case-1": "Loved The Remains of the Day; wants something quiet, melancholic, character-driven, slow and immersive.",
  "case-5": "Loves War and Peace's scope and inner lives, but right now wants something light and quick.",
  "case-6": "Literary fiction: character studies, beautiful prose, morally complicated people. No fantasy at all.",
  "case-8": "Granular, immersive sense of place and morally ambiguous characters; any genre.",
  "case-9": "Narrative nonfiction: investigative journalism or history that reads like a thriller.",
  "case-10": "🌊🏚️👻🕯️ Moody, atmospheric, a little unsettling, not full horror.",
};
export const median = (xs: number[]) => {
  const v = xs.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
export const sentences = (t: string) => (t ?? "").split(/(?<=[.!?])\s+(?=[A-Z"“‘(])/).filter((x) => x.trim()).length;

export function traceTable(file: string) {
  const t = readJson(file);
  const merges: any[] = t.stages.E_merge ?? [];
  const lastAttempt = Math.max(...merges.map((m) => m.attempt ?? 1));
  const keys = new Set<string>();
  for (const m of merges) if ((m.attempt ?? 1) === lastAttempt) for (const c of m.pool ?? []) keys.add(bookKey(c.title, c.author));
  return keys;
}
export function tracesFor(tag: string) {
  const dir = path.join(ROOT, "scratchpad/traces");
  const out: Record<string, string> = {};
  for (const c of CASES) {
    const f = readdirSync(dir).filter((x) => x.includes(`${tag}-${c.id}-`)).sort().pop();
    if (f) out[c.id] = path.join(dir, f);
  }
  return out;
}
function picksFromTrace(file: string) {
  const body = readJson(file).stages.I_response?.[0]?.body;
  try { return parseLoose(body.recommendations, "["); } catch { return []; }
}

export async function popularity(title: string, author: string, cache: any) {
  const k = bookKey(title, author);
  if (cache[k]) return cache[k];
  const docs = await olSearch({ title, author }, 5);
  const tk = titleKey(title), ak = authorKey(author);
  const d = docs.find((x) => titleKey(x.title) === tk && [...(x.author_name ?? []), ...(x.author_alternative_name ?? [])].some((a: string) => authorKey(a) === ak))
    ?? docs.find((x) => titleKey(x.title) === tk);
  const hcDocs = await hcSearchBooks(`${title} ${author}`, 5);
  const h = hcDocs.find((x) => titleKey(x.title) === tk && (x.author_names ?? []).some((a: string) => authorKey(a) === ak))
    ?? hcDocs.find((x) => titleKey(x.title) === tk);
  cache[k] = { olEditions: d?.edition_count ?? null, hcUsers: h?.users_count ?? null };
  return cache[k];
}

async function analyze() {
  const A: any[] = readJson(path.join(OUT, "armA.json"));
  const B: any[] = readJson(path.join(OUT, "armB.json"));
  const cacheFile = path.join(OUT, "popularity-cache.json");
  const cache = existsSync(cacheFile) ? readJson(cacheFile) : {};
  const t18 = tracesFor("trace1018"), t17 = tracesFor("trace1017");

  type ArmRun = { name: string; tables: Record<string, Set<string>>; picks: Record<string, { title: string; author: string; origin?: string }[]> };
  const runs: ArmRun[] = [];
  const mk = (name: string, traces: Record<string, string>): ArmRun => ({
    name,
    tables: Object.fromEntries(Object.entries(traces).map(([c, f]) => [c, traceTable(f)])),
    picks: Object.fromEntries(Object.entries(traces).map(([c, f]) => [c, picksFromTrace(f).map((p: any) => ({ title: p.title, author: p.author, origin: "catalog search" }))])),
  });
  runs.push(mk("Oct 17 (A, earlier)", t17), mk("A (today's engine)", t18));
  for (const run of [1, 2]) {
    const rs = B.filter((b) => b.run === run && !b.error);
    runs.push({
      name: `B run ${run}`,
      tables: Object.fromEntries(rs.map((b) => [b.case, new Set<string>(b.table.map((t: any) => bookKey(t.title, t.author)))])),
      picks: Object.fromEntries(rs.map((b) => [b.case, b.picks.map((p: any) => ({ title: p._catalogTitle, author: p._catalogAuthor, origin: p._origin, display: p.title }))])),
    });
  }

  const lines: string[] = [];
  lines.push("# Table-setting experiment, run 1 — results", "", `Generated ${new Date().toISOString()}. Spend so far: $${ledger().totalUsd}.`, "");

  // Per-arm summary
  lines.push("## Summary by arm", "", "| Arm | Median table size | Books in 4+ of 6 tables | Picks repeated across cases | Median HC readers (picks) | Median OL editions (picks) |", "|---|---|---|---|---|---|");
  const perPickPop: Record<string, any[]> = {};
  for (const r of runs) {
    const sizes = Object.values(r.tables).map((s) => s.size);
    const counts = new Map<string, number>();
    for (const s of Object.values(r.tables)) for (const k of s) counts.set(k, (counts.get(k) ?? 0) + 1);
    const in4 = [...counts.values()].filter((n) => n >= 4).length;
    const pc = new Map<string, number>();
    for (const ps of Object.values(r.picks)) for (const p of new Set(ps.map((p) => bookKey(p.title, p.author)))) pc.set(p, (pc.get(p) ?? 0) + 1);
    const repeated = [...pc.entries()].filter(([, n]) => n >= 2);
    const pops = [];
    for (const [c, ps] of Object.entries(r.picks)) for (const p of ps) pops.push({ case: c, ...p, ...(await popularity(p.title, p.author, cache)) });
    writeJson(cacheFile, cache);
    perPickPop[r.name] = pops;
    lines.push(`| ${r.name} | ${median(sizes)} (${Math.min(...sizes)}–${Math.max(...sizes)}) | ${in4} | ${repeated.length}${repeated.length ? ` (${repeated.map(([k, n]) => `${k} ×${n}`).join("; ")})` : ""} | ${median(pops.map((p) => p.hcUsers))} | ${median(pops.map((p) => p.olEditions))} |`);
  }

  // Run-to-run variation
  lines.push("", "## Run-to-run variation (same case, two runs)", "", "| Case | A vs Oct 17: shared picks | B run 1 vs run 2: shared picks |", "|---|---|---|");
  const share = (a: any[] = [], b: any[] = []) => { const s = new Set(a.map((p) => bookKey(p.title, p.author))); return b.filter((p) => s.has(bookKey(p.title, p.author))).length; };
  for (const c of CASES) lines.push(`| ${c.id} | ${share(runs[0].picks[c.id], runs[1].picks[c.id])} of 3 | ${share(runs[2].picks[c.id], runs[3].picks[c.id])} of 3 |`);

  // Per case
  lines.push("", "## Per case", "", "| Case | Arm | Table | Picks (source of each) | HC readers | OL editions | Cost | Time |", "|---|---|---|---|---|---|---|---|");
  for (const c of CASES) {
    for (const r of runs.slice(1)) {
      const pops = perPickPop[r.name].filter((p) => p.case === c.id);
      let cost = "", time = "";
      if (r.name.startsWith("A")) { const a = A.find((x) => x.case === c.id); cost = `$${a?.usd?.toFixed(3)}`; time = `${Math.round(a?.ms / 1000)}s`; }
      else { const b = B.find((x) => x.case === c.id && `B run ${x.run}` === r.name); cost = `$${b?.usd?.toFixed(3)}`; time = `${Math.round(b?.ms / 1000)}s`; }
      lines.push(`| ${c.id} | ${r.name} | ${r.tables[c.id]?.size ?? "—"} | ${pops.map((p) => `${p.display ?? p.title} — ${p.author} (${p.origin})`).join("; ")} | ${pops.map((p) => p.hcUsers ?? "?").join(", ")} | ${pops.map((p) => p.olEditions ?? "?").join(", ")} | ${cost} | ${time} |`);
    }
  }

  // AI suggestion verification
  lines.push("", "## AI suggestions that failed verification", "", "| Case | Run | Suggested | AI-only verified | Near miss | Invented | Prize-shelf chosen (failed) |", "|---|---|---|---|---|---|---|");
  let tot = { s: 0, aiS: 0, aiV: 0, nm: 0, inv: 0 };
  const failLines: string[] = [];
  for (const b of B.filter((x) => !x.error)) {
    const ai = b.suggestions.filter((s: any) => !s.prizeShelfId).length;
    const aiFails = b.failures.filter((f: any) => f.origin === "AI suggestion");
    const nm = aiFails.filter((f: any) => f.status === "near-miss").length, inv = aiFails.filter((f: any) => f.status === "invented").length;
    const prizeFails = b.failures.filter((f: any) => f.origin === "prize shelf").length;
    tot.s += b.suggestionsCount; tot.aiS += ai; tot.aiV += ai - aiFails.length; tot.nm += nm; tot.inv += inv;
    lines.push(`| ${b.case} | ${b.run} | ${b.suggestionsCount} | ${ai - aiFails.length} of ${ai} | ${nm} | ${inv} | ${b.prizeChosen} (${prizeFails}) |`);
    for (const f of b.failures) failLines.push(`- ${b.case} r${b.run} [${f.origin}] *${f.suggestion.title}* — ${f.suggestion.author}: **${f.status}**, ${f.reason}${f.match ? ` (catalog: *${f.match.title}* — ${f.match.author})` : ""}`);
  }
  lines.push("", `Totals: ${tot.aiS} AI suggestions; ${tot.aiS - tot.aiV} failed (${((100 * (tot.aiS - tot.aiV)) / Math.max(1, tot.aiS)).toFixed(1)}%): ${tot.nm} near misses, ${tot.inv} invented or not found.`, "", "Every failure:", "", ...(failLines.length ? failLines : ["- none"]));

  // Pick origins
  lines.push("", "## Where picks came from", "");
  for (const r of runs.slice(1)) {
    const o = new Map<string, number>();
    for (const ps of Object.values(r.picks)) for (const p of ps) o.set(p.origin ?? "?", (o.get(p.origin ?? "?") ?? 0) + 1);
    lines.push(`- ${r.name}: ${[...o.entries()].map(([k, n]) => `${k} ${n}`).join(", ")}`);
  }

  // Output validity
  lines.push("", "## Output validity against spec §4b", "");
  const REQ = ["title", "author", "format", "findLink", "hook", "why", "angleHeading", "angleText", "mood"];
  for (const a of A) {
    const raw = a.recommendations ?? "";
    let clean = true; try { JSON.parse(raw); } catch { clean = false; }
    let picks: any[] = []; try { picks = parseLoose(raw, "["); } catch {}
    const missing = REQ.filter((f) => picks.some((p) => !p[f]));
    lines.push(`- A ${a.case}: code fence ${raw.includes("```") ? "yes" : "no"}; parses cleanly ${clean ? "yes" : "no"}; required fields missing: ${missing.join(", ") || "none"}`);
  }
  const vb = { runs: 0, fence: 0, clean: 0, missing: 0, hookLong: 0, headLong: 0, moodMulti: 0, whyLong: 0, storyBad: 0, picks: 0, fill: {} as Record<string, number> };
  const issues: string[] = [];
  for (const b of B.filter((x) => !x.error)) {
    vb.runs++; if (b.writeText.includes("```")) vb.fence++; if (b.writeParsesClean) vb.clean++;
    for (const p of b.picks) {
      vb.picks++;
      const miss = REQ.filter((f) => !p[f]); if (miss.length) { vb.missing++; issues.push(`${b.case} r${b.run} ${p.title}: missing ${miss.join(", ")}`); }
      if ((p.hook ?? "").length > 90) { vb.hookLong++; issues.push(`${b.case} r${b.run} ${p.title}: hook ${p.hook.length} chars`); }
      if ((p.angleHeading ?? "").length > 30) { vb.headLong++; issues.push(`${b.case} r${b.run} ${p.title}: heading "${p.angleHeading}" ${p.angleHeading.length} chars`); }
      if (/\s/.test((p.mood ?? "").trim())) { vb.moodMulti++; issues.push(`${b.case} r${b.run} ${p.title}: mood "${p.mood}"`); }
      if (sentences(p.why) > 3) { vb.whyLong++; issues.push(`${b.case} r${b.run} ${p.title}: why has ${sentences(p.why)} sentences`); }
      if (p.story && (sentences(p.story) < 2 || sentences(p.story) > 3)) { vb.storyBad++; issues.push(`${b.case} r${b.run} ${p.title}: story has ${sentences(p.story)} sentences`); }
      for (const f of ["originalTitle", "subtitle", "year", "pages", "coverUrl", "isbn", "story", "source"]) if (p[f]) vb.fill[f] = (vb.fill[f] ?? 0) + 1;
    }
  }
  lines.push(`- B (${vb.runs} runs, ${vb.picks} picks): code fence in ${vb.fence}; parses cleanly ${vb.clean} of ${vb.runs}; picks missing a required field ${vb.missing}; hook over 90 chars ${vb.hookLong}; heading over 30 chars ${vb.headLong}; mood not one word ${vb.moodMulti}; why over 3 sentences ${vb.whyLong}; story outside 2–3 sentences ${vb.storyBad}.`);
  lines.push(`- B optional fields filled (of ${vb.picks}): ${Object.entries(vb.fill).map(([k, n]) => `${k} ${n}`).join(", ")}`);
  if (issues.length) lines.push("", "Issues:", "", ...issues.map((i) => `- ${i}`));
  writeFileSync(path.join(OUT, "results.md"), lines.join("\n") + "\n");

  // Blind look: A vs B run 1, shuffled per case
  const blind: string[] = ["# Blind look: which set is more intriguing?", "", "For each case: the reader's taste, then two sets of three picks in random order. Each line is the first sentence of the engine's \"why\" (both arms have one, so the format doesn't give the arm away). The key is in blind-key.json; don't open it until you've judged.", ""];
  const key: Record<string, any> = {};
  const firstSentence = (t: string) => { const s = (t ?? "").split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|[A-Z])\.)(?<=[.!?])\s+(?=[A-Z"“‘(])/)[0] ?? ""; return s.length > 200 ? s.slice(0, 197) + "…" : s; };
  for (const c of CASES) {
    const a = A.find((x) => x.case === c.id);
    let aPicks: any[] = []; try { aPicks = parseLoose(a.recommendations, "["); } catch {}
    const b = B.find((x) => x.case === c.id && x.run === 1);
    const sets = [
      { arm: "A", items: aPicks.map((p) => ({ title: p.title, author: p.author, line: firstSentence(p.why) })) },
      { arm: "B", items: (b?.picks ?? []).map((p: any) => ({ title: p.title, author: p.author, line: firstSentence(p.why), hook: p.hook })) },
    ];
    const order = Math.random() < 0.5 ? [0, 1] : [1, 0];
    key[c.id] = { "Set 1": sets[order[0]].arm, "Set 2": sets[order[1]].arm };
    blind.push(`## ${c.id}`, "", `**Reader:** ${TASTE_ONE_LINE[c.id]}`, "");
    order.forEach((i, n) => {
      blind.push(`**Set ${n + 1}**`, "");
      for (const it of shuffle(sets[i].items)) blind.push(`- *${it.title}* — ${it.author}. ${it.line}`);
      blind.push("");
    });
  }
  writeFileSync(path.join(OUT, "blind.md"), blind.join("\n"));
  writeJson(path.join(OUT, "blind-key.json"), key);
  console.log("wrote results.md, blind.md, blind-key.json");
}

// ---------- main ----------
// Only when run directly (scratchpad/hybrid-experiment.mts imports the helpers above).
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
const cmd = isMain ? process.argv[2] : undefined;
if (cmd === "armA") await runArmA();
else if (cmd === "armB") {
  const file = path.join(OUT, "armB.json");
  const done: any[] = existsSync(file) ? readJson(file) : [];
  const only = process.argv[3]; // optional "case-1:1" for a single run
  for (const run of [1, 2]) for (const c of CASES) {
    if (only && only !== `${c.id}:${run}`) continue;
    if (done.some((d) => d.case === c.id && d.run === run && !d.error)) continue;
    const r = await runArmB(c, run);
    const i = done.findIndex((d) => d.case === c.id && d.run === run);
    if (i >= 0) done[i] = r; else done.push(r);
    writeJson(file, done);
    console.log(`B ${c.id} r${run}: ${r.error ?? "ok"}, table ${r.tableSize}, ${r.ms}ms, $${(r as any).usd?.toFixed?.(4)} | ledger $${ledger().totalUsd}`);
  }
} else if (cmd === "lists") await runLists();
else if (cmd === "analyze") await analyze();
else if (isMain) console.log("usage: armA | armB | lists | analyze");
if (cmd === "testVerify") {
  for (const s of [
    { title: "Oblomov", author: "Ivan Goncharov" },
    { title: "The Assistant", author: "Bernard Malamud" },
    { title: "Kokoro", author: "Natsume Soseki" },
    { title: "The Vegetarian", author: "Han Kang" },
    { title: "The Glass Orchard of Mirelle", author: "Tomas Varga" },
    { title: "Stoner", author: "John Williams" },
  ]) console.log(s.title, "→", JSON.stringify(await verifyCandidate(s), (k, v) => (k === "_doc" || k === "_hc" ? undefined : v)).slice(0, 220));
}

