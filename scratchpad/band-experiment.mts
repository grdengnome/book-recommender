// Experiment run 3, revised (2026-10-20, branch experiment/table-setting): canon dampening with
// and without one discovery slot. Per case, one catalog table built exactly as the engine builds
// it, with run 2's canon dampening; then two variants select and write from that same table:
//   D1: dampening only; the selector picks 3 + 2 reserves freely.
//   D2: the table split by code into two shelves at a popularity line; at least 1 of the 3 picks
//       must come from the deeper shelf (checked in code). Everything else is free.
// Compared against run 1's arm A. The live engine is not changed. Popularity comes from data the
// engine already fetches and then drops: Open Library edition_count (read from the subject
// responses as they arrive) and Hardcover users_count (on the Hardcover pool rows). No extra lookups.
// An earlier strict version (2 of 3 picks and both reserves from the deeper shelf) was stopped
// after three cases; its output is kept in strict-partial/ and is not part of this comparison.
//
// Usage:
//   node --env-file=.env.local scratchpad/band-experiment.mts run       (6 cases; resumable)
//   node --env-file=.env.local scratchpad/band-experiment.mts analyze
// Output (gitignored, holds taste descriptions): scratchpad/experiments/2026-10-20-band/
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "scratchpad/experiments/2026-10-20-band");
const RUN1 = path.join(ROOT, "scratchpad/experiments/2026-10-18-table-setting");
const RUN2 = path.join(ROOT, "scratchpad/experiments/2026-10-18-hybrid");
mkdirSync(OUT, { recursive: true });
const SPEND_CAP_USD = 2.5;
const RUN_HEADROOM_USD = 0.25; // don't start a case with less than this left under the cap
const LEDGER = path.join(OUT, "spend-ledger.json");
const readJson = (f: string) => JSON.parse(readFileSync(f, "utf8"));
const writeJson = (f: string, v: unknown) => writeFileSync(f, JSON.stringify(v, null, 1));

// Run 1's module registers the "@/..." resolver hook and holds the shared helpers.
const R1 = await import("./table-setting-experiment.mts");
const { checkPickGrounding, recordSeenCandidates } = await import("../lib/merge/pickGrounding.ts");
const { lookupPickMetadata } = await import("../lib/verify/lookupPickMetadata.ts");
const { mapTasteToHardcoverTags } = await import("../lib/hardcover/mapTasteToTags.ts");
const { prepareHardcoverPool } = await import("../lib/hardcover/preparePool.ts");
const { mergeCandidatePools, toModelPool } = await import("../lib/merge/mergeCandidatePools.ts");
const { toolDefinitions, callTool, setSearchBooksLogTag } = await import("../lib/tools/index.ts");
const { modelCallCostUsd, noopTrace } = await import("../lib/trace/requestTrace.ts");
const { CASES, TASTE_RULES, titleKey, bookKey, olSearch, prizeFor, olEditionInfo, shuffle, parseLoose, popularity, median, sentences, traceTable, tracesFor, TASTE_ONE_LINE } = R1 as any;

// ---------- spend: every Anthropic response (ours and the lib's) is costed here ----------
type Ledger = { entries: { what: string; model: string; usd: number }[]; totalUsd: number };
const ledger = (): Ledger => (existsSync(LEDGER) ? readJson(LEDGER) : { entries: [], totalUsd: 0 });
const priceUsd = (model: string, usage: any) =>
  modelCallCostUsd(model, usage) ?? modelCallCostUsd(String(model).replace(/-\d{8}$/, ""), usage) ?? 0;
function addSpend(what: string, model: string, usd: number) {
  const l = ledger();
  l.entries.push({ what, model, usd });
  l.totalUsd = Math.round((l.totalUsd + usd) * 1e6) / 1e6;
  writeJson(LEDGER, l);
}
// Open Library edition counts, read off the subject responses the engine already requests.
const OL_EDITIONS = new Map<string, number>();
let spendLabel = "unlabelled";
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  if (url.startsWith("https://openlibrary.org/subjects/")) {
    const res = await realFetch(input, init);
    try {
      const data = await res.clone().json();
      for (const w of data?.works ?? []) if (w?.key && typeof w.edition_count === "number") OL_EDITIONS.set(w.key, w.edition_count);
    } catch {}
    return res;
  }
  if (!url.startsWith("https://api.anthropic.com/")) return realFetch(input, init);
  if (ledger().totalUsd > SPEND_CAP_USD) throw new Error(`SPEND CAP: over $${SPEND_CAP_USD}; stopping`);
  const what = spendLabel;
  const res = await realFetch(input, init);
  if (JSON.parse(init?.body ?? "{}").stream) return res; // streamed calls are costed by their reader
  try {
    const data = await res.clone().json();
    addSpend(what, data.model, priceUsd(data.model, data.usage));
  } catch {}
  return res;
}) as typeof fetch;
function assertUnderCap() {
  if (ledger().totalUsd > SPEND_CAP_USD) throw new Error(`SPEND CAP: total $${ledger().totalUsd} is over $${SPEND_CAP_USD}; stopping`);
}
const spentSince = (n: number) => ledger().entries.slice(n).reduce((a, e) => a + e.usd, 0);

async function claude(label: string, model: string, system: string, user: string, maxTokens = 6000) {
  assertUnderCap();
  spendLabel = label;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(data?.error ?? data).slice(0, 300)}`);
  return (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

// Streamed, only so the write step's time splits into time-to-first-token and generation time;
// that split is what the "five write-ups in parallel" estimate is built from.
async function claudeStream(label: string, model: string, system: string, user: string, maxTokens: number) {
  assertUnderCap();
  spendLabel = label;
  const t0 = performance.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, stream: true, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  let text = "", firstMs: number | null = null, buf = "", modelId = model;
  const usage: any = {};
  const decoder = new TextDecoder();
  for await (const chunk of res.body as any) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      let ev: any;
      try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.type === "message_start") { modelId = ev.message?.model ?? model; Object.assign(usage, ev.message?.usage ?? {}); }
      else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") { firstMs ??= performance.now() - t0; text += ev.delta.text; }
      else if (ev.type === "message_delta" && ev.usage) Object.assign(usage, ev.usage);
    }
  }
  const totalMs = performance.now() - t0;
  addSpend(label, modelId, priceUsd(modelId, usage));
  return { text, ttftMs: Math.round(firstMs ?? totalMs), genMs: Math.round(totalMs - (firstMs ?? totalMs)), totalMs: Math.round(totalMs), outputTokens: usage.output_tokens ?? null };
}

// ---------- catalog branch: the engine's own table-building (as run 2) ----------
// The search-loop prompt is read from route.ts so it is byte-identical to today's engine.
const ROUTE_SRC = readFileSync(path.join(ROOT, "app/api/recommend/route.ts"), "utf8");
const ENGINE_SYSTEM_PROMPT = ROUTE_SRC.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/)![1];
const ENGINE_MODEL = ROUTE_SRC.match(/const MODEL = "([^"]+)"/)![1];
const MAX_TOOL_ROUNDS = 3;

async function catalogBranch(taste: string, tag: string) {
  const t0 = performance.now();
  setSearchBooksLogTag(tag);
  const hcPromise = (async () => {
    try {
      const { tagIds } = await mapTasteToHardcoverTags(taste, noopTrace);
      if (!tagIds.length) return { pool: [] as any[], note: "no tags" };
      return { pool: (await prepareHardcoverPool(tagIds, noopTrace)).pool as any[], note: "ok" };
    } catch (err) {
      return { pool: [] as any[], note: `failed: ${String(err).slice(0, 120)}` };
    }
  })();
  const messages: any[] = [{ role: "user", content: taste }];
  const seen = new Map();
  let rounds = 0, searches = 0;
  // Same loop as route.ts generateOnce, minus the final no-tools "answer now" call: only the
  // table is needed here, and the table comes entirely from search_books results.
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    rounds++;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: ENGINE_MODEL, max_tokens: 4000, system: ENGINE_SYSTEM_PROMPT, messages, tools: toolDefinitions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Anthropic ${res.status} in search loop`);
    if (data.stop_reason !== "tool_use") break; // the model answered; its answer is discarded
    messages.push({ role: "assistant", content: data.content });
    const toolResults = await Promise.all(
      data.content.filter((b: any) => b.type === "tool_use").map(async (b: any) => {
        let result: any;
        try {
          result = await callTool(b.name, b.input, noopTrace);
          if (b.name === "search_books") {
            searches++;
            const { pool } = mergeCandidatePools(result.pool, (await hcPromise).pool, noopTrace);
            recordSeenCandidates(seen, pool);
            result = { pool: toModelPool(pool), poolSize: pool.length };
          }
        } catch (err) {
          result = { error: err instanceof Error ? err.message : "Tool call failed" };
        }
        return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(result) };
      }),
    );
    messages.push({ role: "user", content: toolResults });
  }
  const hc = await hcPromise;
  const hcUsers = new Map<number, number>(hc.pool.map((r: any) => [r.hcBookId, r.usersCount]));
  return { records: [...seen.values()], hcUsers, ms: Math.round(performance.now() - t0), rounds, searches, hardcoverPool: hc.pool.length, hardcoverNote: hc.note };
}

// ---------- canon (run 1 arm A: books in 4+ of 6 cases' tables), as run 2 ----------
function canonSet() {
  const counts = new Map<string, number>();
  for (const f of Object.values(tracesFor("trace1018")) as string[]) for (const k of traceTable(f)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return new Set([...counts.entries()].filter(([, n]) => n >= 4).map(([k]) => k));
}
const CANON = canonSet();
const CANON_KEEP = 40;
const CANON_MODEL = "claude-haiku-4-5";

async function dampenCanon(taste: string, records: any[], label: string) {
  const canon = records.filter((r) => CANON.has(bookKey(r.title, r.author)));
  const canonUnique = new Set(canon.map((r) => bookKey(r.title, r.author))).size;
  if (canon.length <= CANON_KEEP) return { kept: records, canonOnTable: canonUnique, canonKept: canon.length };
  const list = shuffle(canon);
  const text = await claude(`${label} canon-rank`, CANON_MODEL,
    `You rank books by how well they fit a reader's taste. Respond with ONLY a JSON array of the ${CANON_KEEP} most relevant book numbers, most relevant first.`,
    `Reader's taste:\n${taste}\n\nBooks:\n${list.map((r, i) => `${i + 1}. ${r.title} — ${r.author} [${(r.subjects ?? []).join(", ")}]`).join("\n")}`, 1000);
  let idx: number[] = [];
  try { idx = parseLoose(text, "[").map(Number).filter((n: number) => n >= 1 && n <= list.length); } catch {}
  const keep = new Set([...new Set(idx)].slice(0, CANON_KEEP).map((n) => list[n - 1]));
  return { kept: records.filter((r) => !CANON.has(bookKey(r.title, r.author)) || keep.has(r)), canonOnTable: canonUnique, canonRecords: canon.length, canonKept: keep.size };
}

// ---------- popularity band ----------
// Deeper = under the line on every count the row has; a missing count counts as under.
// If the deeper shelf is short, the line is raised a step at a time and the step is recorded.
const LINES = [{ editions: 20, readers: 250 }, { editions: 30, readers: 375 }, { editions: 45, readers: 560 }];
const MIN_DEEPER = 10;
const D2_NEED_PICKS = 1;

function rowPopularity(r: any, hcUsers: Map<number, number>) {
  return {
    editions: r.olWorkKey && OL_EDITIONS.has(r.olWorkKey) ? OL_EDITIONS.get(r.olWorkKey)! : null,
    readers: r.hcBookId != null && hcUsers.has(r.hcBookId) ? hcUsers.get(r.hcBookId)! : null,
  };
}
const under = (p: { editions: number | null; readers: number | null }, line: { editions: number; readers: number }) =>
  (p.editions == null || p.editions < line.editions) && (p.readers == null || p.readers < line.readers);

function shelve(table: any[]) {
  const counts = LINES.map((line) => table.filter((r) => under(r.pop, line)).length);
  let step = counts.findIndex((n) => n >= MIN_DEEPER);
  const fellShort = step < 0;
  if (fellShort) step = LINES.length - 1;
  const line = LINES[step];
  const deeper = new Set<string>(table.filter((r) => under(r.pop, line)).map((r) => bookKey(r.title, r.author)));
  return { line, step, counts, fellShort, deeper, needPicks: Math.min(D2_NEED_PICKS, deeper.size) };
}

// ---------- select + write ----------
// D1 and D2 get the same instructions apart from the shelf line and how the candidates are laid out.
const selectSystem = (shelf: { needPicks: number } | null) => `You are a book recommendation engine. Your entire value proposition is taste, not popularity — you recommend books based on genuine fit and quality, actively resisting the pull toward safe, over-recommended picks. The goal is the most interesting and relevant books for this reader: authentically intriguing, familiar or not.

${TASTE_RULES}

Choose 3 picks and 2 reserves.
- Varied trio: the 3 picks must be three different kinds — one familiar-but-fresh (a known book or author, but not the reflexive answer), one discovery (a book this reader is unlikely to have met), and one wildcard (an unexpected angle that still lands) — all within the mood and feeling the reader asked for.${shelf ? `
- Shelves: the candidates are split across Shelf 1 and Shelf 2. At least ${shelf.needPicks} of the 3 picks must come from Shelf 2; the other picks and both reserves may come from either shelf. This is checked in code.` : ""}
- The 2 reserves must be strong enough to stand in for any pick, and also within the reader's mood.
- Treat any stated turn-off as a hard boundary.

${shelf
  ? "All 5 books MUST come from the shelves below. Each shelf is unordered; never favor earlier entries. Copy each title and author exactly as they appear; they are checked in code against the shelves."
  : "All 5 books MUST come from the candidate table below. The table is unordered; never favor earlier entries. Copy each title and author exactly as they appear in the table; they are checked in code against it."}

Respond with ONLY a JSON object: {"picks":[{"title":"...","author":"...","kind":"familiar-but-fresh|discovery|wildcard"}],"reserves":[{"title":"...","author":"..."}]}`;

const WRITE_SYSTEM = `You write the text for a book recommender's cards. For each book you get the reader's taste, the book's catalog title and author, its catalog subjects, and its catalog and Hardcover descriptions. Write in clean, plain English; no emoji.

No hedging. Never write phrases like "should land well", "likely to appeal", "might", "probably" or "may resonate". Write only what you can say with confidence from your own knowledge of the book and the descriptions given. If you can't write confidently about a book, set "confident" to false and leave the other text fields null; the book will be swapped out.

Fields per book:
- "confident": true or false.
- "title": the English display title, without series or edition noise like "(Penguin Classics)". Always English, even when the catalog title is in another language or script.
- "author": the author's name as "First Last", in its usual English romanization, no stress marks.
- "hook": one short line for the revealed book, at most 90 characters.
- "why": why it's for this reader, about 2 sentences, tied to specifics in their taste.
- "story": a 2–3 sentence summary of what the book is about, based ONLY on the descriptions given. Never invent plot. If no usable description is given, use null.
- "angleHeading": a heading for a third section, written for this specific book (for example "Shelved in the wrong aisle"), at most 30 characters. Not a fixed label.
- "angleText": that section's body, about 2 sentences. Don't state claims about the book's fame, sales or obscurity unless you're confident they're accurate.
- "mood": one word.

Respond with ONLY a JSON array, one object per book in the order given, with exactly those keys.`;

const HEDGES = /\b(should land|likely to (appeal|resonate|land)|may (appeal|resonate)|might (appeal|resonate|enjoy|like)|probably|could be a good fit)\b/i;

// Run 2's lookup searched q=<work id>, which Open Library no longer matches; key:/works/... does.
async function olDocFor(title: string, author: string, workKey?: string) {
  const byKey = workKey ? await olSearch({ q: `key:${workKey}` }, 1) : [];
  if (byKey[0]) return byKey[0];
  const docs = await olSearch({ title, author }, 3);
  return docs.find((d: any) => titleKey(d.title) === titleKey(title)) ?? null;
}

async function fillSpec(rec: any, w: any) {
  let olDoc = rec._doc ?? null;
  let workKey = rec.olWorkKey;
  if (!olDoc) {
    olDoc = await olDocFor(rec.title, rec.author, workKey);
    workKey = workKey ?? olDoc?.key;
  }
  const ed = workKey ? await olEditionInfo(workKey) : null;
  const isbn = ed?.isbn ?? null;
  const prize = prizeFor(rec.title, rec.author, rec.olWorkKey);
  const englishTitle = w.title ?? rec.title;
  const original = prize?.originalTitle ?? rec.title;
  return {
    title: englishTitle,
    originalTitle: original && titleKey(original) !== titleKey(englishTitle) ? original : null,
    subtitle: olDoc?.subtitle ?? null,
    author: w.author ?? rec.author,
    year: olDoc?.first_publish_year ?? rec._hc?.release_year ?? null,
    pages: olDoc?.number_of_pages_median ?? ed?.pages ?? null,
    format: ed?.format ?? "paperback",
    coverUrl: olDoc?.cover_i ? `https://covers.openlibrary.org/b/id/${olDoc.cover_i}-L.jpg` : null,
    isbn,
    findLink: isbn ? `https://bookshop.org/book/${isbn}`
      : workKey ? `https://openlibrary.org${workKey}`
      : `https://openlibrary.org/search?q=${encodeURIComponent(`${rec.title} ${rec.author}`)}`,
    hook: w.hook ?? null, why: w.why ?? null, story: w.story ?? null, angleHeading: w.angleHeading ?? null, angleText: w.angleText ?? null, mood: w.mood ?? null,
    source: prize?.source ?? null,
  };
}

// Parallel estimate: one book's call would pay the same time-to-first-token and generate only
// that book's share of the output, so the slowest book bounds it. Shares are by output length.
function parallelWriteEstimateMs(w: { ttftMs: number; genMs: number; text: string }, written: any[]) {
  const lens = written.map((b) => JSON.stringify(b ?? {}).length);
  const total = lens.reduce((a, n) => a + n, 0);
  if (!total) return null;
  return Math.round(w.ttftMs + (w.genMs * Math.max(...lens)) / total);
}

// Shared per case: the catalog table, canon dampening and the shelf split (used by D2; for D1
// it only labels picks after the fact).
async function buildTable(c: { id: string; taste: string }) {
  const ledgerStart = ledger().entries.length;
  const t0 = performance.now();
  spendLabel = `${c.id} catalog`;
  const cat = await catalogBranch(c.taste, `band1020b-${c.id}`);
  const tC = performance.now();
  const damp = await dampenCanon(c.taste, cat.records, c.id);
  const canonMs = Math.round(performance.now() - tC);
  const table = damp.kept.map((r: any) => ({ ...r, pop: rowPopularity(r, cat.hcUsers) }));
  const sh = shelve(table);
  return {
    cat, damp, table, sh, canonMs,
    ms: Math.round(performance.now() - t0), usd: spentSince(ledgerStart),
    summary: {
      catalog: { size: cat.records.length, rounds: cat.rounds, searches: cat.searches, hardcoverPool: cat.hardcoverPool, hardcoverNote: cat.hardcoverNote },
      canon: { onTable: damp.canonOnTable, kept: damp.canonKept },
      tableSize: table.length,
      tableKeys: table.map((r: any) => bookKey(r.title, r.author)),
      popCoverage: { editions: table.filter((r: any) => r.pop.editions != null).length, readers: table.filter((r: any) => r.pop.readers != null).length, neither: table.filter((r: any) => r.pop.editions == null && r.pop.readers == null).length },
      shelves: { line: sh.line, lineStep: sh.step, deeperAtEachLine: sh.counts, fellShort: sh.fellShort, deeper: sh.deeper.size, any: table.length - sh.deeper.size, needPicks: sh.needPicks },
      catalogMs: cat.ms, canonMs,
    },
  };
}

async function runVariant(variant: "D1" | "D2", c: { id: string; taste: string }, t: Awaited<ReturnType<typeof buildTable>>) {
  const label = `${variant} ${c.id}`;
  const ledgerStart = ledger().entries.length;
  const t0 = performance.now();
  const { table, sh } = t;
  const isDeeper = (r: any) => sh.deeper.has(bookKey(r.title, r.author));
  const byKey = new Map<string, any>(table.map((r: any) => [bookKey(r.title, r.author), r]));
  const seen = new Map();
  recordSeenCandidates(seen, table.map(({ pop, ...r }: any) => r));
  const modelRow = (r: any) => ({ title: r.title, author: r.author, subjects: r.subjects });
  const shelfRule = variant === "D2" ? { needPicks: sh.needPicks } : null;
  const candidates = shelfRule
    ? `Shelf 1:\n${JSON.stringify(shuffle(table.filter((r: any) => !isDeeper(r))).map(modelRow))}\n\nShelf 2:\n${JSON.stringify(shuffle(table.filter(isDeeper)).map(modelRow))}`
    : `Candidate table:\n${JSON.stringify(shuffle(table).map(modelRow))}`;

  // Select 3 + 2: grounded, and for D2 the shelf rule checked in code
  let sel: any = null, selectAttempts = 0;
  const misses: string[] = [];
  const tS = performance.now();
  for (let a = 1; a <= 3 && !sel; a++) {
    selectAttempts = a;
    const text = await claude(`${label} select`, ENGINE_MODEL, selectSystem(shelfRule), `Reader's taste:\n${c.taste}\n\n${candidates}`, 4000);
    let parsed: any;
    try { parsed = parseLoose(text, "{"); } catch { misses.push("unparseable"); continue; }
    const all = [...(parsed.picks ?? []), ...(parsed.reserves ?? [])];
    if ((parsed.picks ?? []).length !== 3 || (parsed.reserves ?? []).length !== 2) { misses.push("wrong count"); continue; }
    const g = checkPickGrounding(JSON.stringify(all), seen);
    if (g.status !== "grounded") { misses.push("not grounded"); continue; }
    const deepPicks = g.picks.slice(0, 3).filter((p: any) => isDeeper(p.record)).length;
    if (shelfRule && deepPicks < shelfRule.needPicks) { misses.push(`shelf rule (${deepPicks} picks from Shelf 2)`); continue; }
    sel = { checked: g.picks, kinds: parsed.picks.map((p: any) => p.kind) };
  }
  const selectMs = Math.round(performance.now() - tS);
  const base = { case: c.id, variant, selectAttempts, selectMisses: misses };
  if (!sel) return { ...base, error: "selection failed 3 times", usd: t.usd + spentSince(ledgerStart), ms: t.ms + Math.round(performance.now() - t0) };

  // Write all five (streamed for timing), then swap unconfident picks for reserves
  const tW = performance.now();
  const meta = await lookupPickMetadata(sel.checked);
  const lookupMs = Math.round(performance.now() - tW);
  const recs = sel.checked.map((p: any) => byKey.get(bookKey(p.record.title, p.record.author)) ?? p.record);
  const writeInput = sel.checked.map((p: any, i: number) => ({
    n: i + 1, catalogTitle: p.record.title, catalogAuthor: p.record.author, subjects: p.record.subjects ?? [],
    openLibraryDescription: meta[i]?.lookups.find((l: any) => l.source === "openlibrary")?.description || null,
    hardcoverDescription: meta[i]?.lookups.find((l: any) => l.source === "hardcover")?.description || null,
  }));
  const w = await claudeStream(`${label} write`, ENGINE_MODEL, WRITE_SYSTEM, `Reader's taste:\n${c.taste}\n\nBooks:\n${JSON.stringify(writeInput)}`, 5000);
  const wText = w.text;
  let written: any[] = [], writeParsesClean = true;
  try { written = JSON.parse(wText); } catch { writeParsesClean = false; try { written = parseLoose(wText, "["); } catch {} }
  const books = await Promise.all(recs.map(async (r: any, i: number) => ({
    i, rec: r, confident: written[i]?.confident !== false && !!written[i]?.why,
    spec: await fillSpec(r, written[i] ?? {}),
    kind: i < 3 ? sel.kinds[i] : "reserve",
  })));
  const reservesLeft = books.slice(3).filter((b) => b.confident);
  let hedgeSwaps = 0;
  const finalPicks = books.slice(0, 3).map((b) => {
    if (b.confident || !reservesLeft.length) return { ...b, swappedIn: false };
    hedgeSwaps++;
    return { ...reservesLeft.shift()!, swappedIn: true, replaced: b.spec.title };
  });
  const writeMs = Math.round(performance.now() - tW);

  const show = (b: any) => ({
    ...b.spec,
    _canon: CANON.has(bookKey(b.rec.title, b.rec.author)), _shelf: isDeeper(b.rec) ? "deeper" : "any", _pool: b.rec.pop,
    _kind: b.kind, _confident: b.confident, _swappedIn: b.swappedIn ?? false, _replaced: b.replaced ?? null,
    _hedgePhrase: HEDGES.test([b.spec.hook, b.spec.why, b.spec.angleText].join(" ")),
    _catalogTitle: b.rec.title, _catalogAuthor: b.rec.author,
  });
  const ownMs = Math.round(performance.now() - t0);
  return {
    ...base,
    // Time and cost as if this variant ran alone: the shared table plus its own select and write.
    ms: t.ms + ownMs, ownMs, selectMs, writeMs, lookupMs,
    write: { ttftMs: w.ttftMs, genMs: w.genMs, callMs: w.totalMs, outputTokens: w.outputTokens, parallelEstimateMs: parallelWriteEstimateMs(w, written) },
    usd: Math.round((t.usd + spentSince(ledgerStart)) * 1e6) / 1e6, ownUsd: Math.round(spentSince(ledgerStart) * 1e6) / 1e6,
    writeText: wText, writeParsesClean, hedgeSwaps,
    picks: finalPicks.map(show),
    reserves: reservesLeft.map(show),
    allFive: books.map(show),
  };
}

// ---------- analysis ----------
const sec = (ms: number | null) => (ms == null ? "?" : `${Math.round(ms / 1000)}s`);
// The line applied to looked-up pick popularity, so arm A's picks can be placed against it too.
const underLookup = (p: any) => under({ editions: p.olEditions, readers: p.hcUsers }, LINES[0]);

async function analyze() {
  const A: any[] = readJson(path.join(RUN1, "armA.json"));
  const R: any[] = readJson(path.join(OUT, "results.json"));
  const popCache = path.join(OUT, "popularity-cache.json");
  const cache = existsSync(popCache) ? readJson(popCache) : readJson(path.join(RUN1, "popularity-cache.json"));
  const tA = tracesFor("trace1018");
  const aTables: Record<string, Set<string>> = Object.fromEntries(Object.entries(tA).map(([k, f]) => [k, traceTable(f as string)]));
  const aPicks: Record<string, any[]> = Object.fromEntries(A.map((a) => { let p: any[] = []; try { p = parseLoose(a.recommendations, "["); } catch {} return [a.case, p]; }));
  const dTables = Object.fromEntries(R.map((x) => [x.case, new Set<string>(x.shared.tableKeys)]));
  const V = (v: "D1" | "D2") => R.map((x) => x[v]).filter((y) => y && !y.error);

  const arms: { name: string; runs: any[]; tables: Record<string, Set<string>>; picks: Record<string, { title: string; author: string; canon: boolean; shelf?: string }[]> }[] = [];
  arms.push({ name: "A (run 1)", runs: A, tables: aTables, picks: Object.fromEntries(Object.entries(aPicks).map(([c, ps]) => [c, ps.map((p) => ({ title: p.title, author: p.author, canon: CANON.has(bookKey(p.title, p.author)) }))])) });
  for (const v of ["D1", "D2"] as const) arms.push({
    name: v, runs: V(v), tables: dTables,
    picks: Object.fromEntries(V(v).map((x) => [x.case, x.picks.map((p: any) => ({ title: p._catalogTitle, author: p._catalogAuthor, canon: p._canon, shelf: p._shelf }))])),
  });

  const L: string[] = ["# Canon dampening ± one discovery slot (run 3, revised) — results", "",
    `Generated ${new Date().toISOString()}. Spend: $${ledger().totalUsd} (cap $${SPEND_CAP_USD}; the stopped strict run's $0.55 is separate, in strict-partial/). "Canon" = ${CANON.size} books in 4+ of run 1's six arm-A tables. D1 and D2 share one catalog table per case (same search, same dampening); only selection and writing differ. Line: deeper = under ${LINES[0].editions} Open Library editions and under ${LINES[0].readers} Hardcover readers (a missing count counts as under); raised to ${LINES[1].editions}/${LINES[1].readers}, then ${LINES[2].editions}/${LINES[2].readers}, if fewer than ${MIN_DEEPER} books fall under it. D2's selector sees unlabelled "Shelf 1" / "Shelf 2"; the split itself is a popularity signal the live engine never gives the model. D1 sees one table; its picks are placed on the shelves only afterwards.`, ""];
  L.push("## Summary", "", "| Arm | Median table | Books in 4+ of 6 tables | Picks repeated across cases | Canon picks | Median HC readers | Median OL editions | Picks under the line (looked up) | Picks on deeper shelf (pool data) | Median cost | Median time |", "|---|---|---|---|---|---|---|---|---|---|---|");
  for (const arm of arms) {
    const sizes = Object.values(arm.tables).map((s) => s.size);
    const counts = new Map<string, number>();
    for (const s of Object.values(arm.tables)) for (const k of s) counts.set(k, (counts.get(k) ?? 0) + 1);
    const pc = new Map<string, number>();
    for (const ps of Object.values(arm.picks)) for (const k of new Set(ps.map((p) => bookKey(p.title, p.author)))) pc.set(k, (pc.get(k) ?? 0) + 1);
    const rep = [...pc.entries()].filter(([, n]) => n >= 2);
    const list: any[] = [];
    for (const [c, ps] of Object.entries(arm.picks)) for (const p of ps) list.push({ case: c, ...p, ...(await popularity(p.title, p.author, cache)) });
    writeJson(popCache, cache);
    const deep = arm.name.startsWith("D") ? `${list.filter((p) => p.shelf === "deeper").length} of ${list.length}` : "n/a";
    L.push(`| ${arm.name} | ${median(sizes)} (${Math.min(...sizes)}–${Math.max(...sizes)}) | ${[...counts.values()].filter((n) => n >= 4).length} | ${rep.length}${rep.length ? ` (${rep.map(([k, n]) => `${k} ×${n}`).join("; ")})` : ""} | ${list.filter((p) => p.canon).length} of ${list.length} | ${median(list.map((p) => p.hcUsers))} | ${median(list.map((p) => p.olEditions))} | ${list.filter(underLookup).length} of ${list.length} | ${deep} | $${median(arm.runs.map((r: any) => r.usd))?.toFixed(3)} | ${sec(median(arm.runs.map((r: any) => r.ms)))} |`);
  }
  L.push("", "Pick popularity (readers, editions, \"under the line (looked up)\") is looked up per pick the same way as runs 1–2, so it is comparable across arms; a missing count counts as under, as on the shelves. \"Deeper shelf (pool data)\" uses the counts the table was shelved by. D1 and D2 share a table, so their table columns are the same.");

  // D2: the discovery slot
  const d2 = V("D2");
  const deepCount = (bs: any[]) => bs.filter((b: any) => b._shelf === "deeper").length;
  const fallback = R.filter((x) => x.shared.shelves.lineStep > 0 || x.shared.shelves.fellShort);
  L.push("", "## D2: the discovery slot", "",
    `- Fallback needed (fewer than ${MIN_DEEPER} deeper books at 20/250): ${fallback.length} of ${R.length} tables.${fallback.length ? " " + fallback.map((x) => `${x.case}: ${x.shared.shelves.deeperAtEachLine[0]} under 20/250, line raised to ${x.shared.shelves.line.editions}/${x.shared.shelves.line.readers} (${x.shared.shelves.deeper} deeper)${x.shared.shelves.fellShort ? ", still short" : ""}`).join("; ") + "." : ""}`,
    `- Selected picks from the deeper shelf (before any hedge swap): ${d2.map((x) => `${x.case} ${deepCount(x.allFive.slice(0, 3))}`).join(", ")}. The two free picks were also from the deeper shelf ${d2.reduce((a, x) => a + Math.max(0, deepCount(x.allFive.slice(0, 3)) - 1), 0)} of ${2 * d2.length} times; reserves (free) ${d2.reduce((a, x) => a + deepCount(x.allFive.slice(3)), 0)} of ${2 * d2.length}.`,
    `- For comparison, D1 (no rule) selected ${V("D1").reduce((a, x) => a + deepCount(x.allFive.slice(0, 3)), 0)} of ${3 * V("D1").length} picks and ${V("D1").reduce((a, x) => a + deepCount(x.allFive.slice(3)), 0)} of ${2 * V("D1").length} reserves from the deeper shelf.`,
    `- Shelf-rule retries: ${d2.reduce((a, x) => a + x.selectMisses.filter((s: string) => s.startsWith("shelf")).length, 0)}; other select retries (D1 + D2): ${[...V("D1"), ...d2].reduce((a, x) => a + x.selectMisses.filter((s: string) => !s.startsWith("shelf")).length, 0)}; failed selections: ${R.filter((x) => x.D1?.error || x.D2?.error).length}.`,
    `- Hedge swaps that left D2 with no deeper-shelf pick: ${d2.filter((x) => deepCount(x.allFive.slice(0, 3)) >= 1 && deepCount(x.picks) === 0).length}.`);

  // Time
  const both = [...V("D1"), ...V("D2")];
  const mR = (f: (x: any) => number | null) => median(R.map(f));
  const m = (xs: any[], f: (x: any) => number | null) => median(xs.map(f));
  const estTotal = (x: any) => (x.write?.parallelEstimateMs == null ? null : x.ms - x.write.callMs + x.write.parallelEstimateMs);
  L.push("", "## Time", "",
    `Medians, per variant as if run alone: D1 ${sec(m(V("D1"), (x) => x.ms))}, D2 ${sec(m(V("D2"), (x) => x.ms))}; Arm A ${sec(median(A.map((a) => a.ms)))}. Breakdown (both variants): catalog table ${sec(mR((x) => x.shared.catalogMs))} + canon ${sec(mR((x) => x.shared.canonMs))} + select ${sec(m(both, (x) => x.selectMs))} + write step ${sec(m(both, (x) => x.writeMs))} (description lookups ${sec(m(both, (x) => x.lookupMs))}; one write call for five books ${sec(m(both, (x) => x.write?.callMs))}: first token ${sec(m(both, (x) => x.write?.ttftMs))}, generation ${sec(m(both, (x) => x.write?.genMs))}, ${m(both, (x) => x.write?.outputTokens)} output tokens).`,
    "",
    `The gap with Arm A comes mostly from the separate write step: Arm A has no write step and returns only title, author and a "why", while D1 and D2 write the full spec card (hook, why, story, angle, mood) for five books in one call. The table, canon and select steps together take about as long as Arm A's whole request.`,
    "",
    `If the five write-ups ran as five parallel calls: estimated write call ${sec(m(both, (x) => x.write?.parallelEstimateMs))} instead of ${sec(m(both, (x) => x.write?.callMs))}; estimated total D1 ${sec(m(V("D1"), estTotal))}, D2 ${sec(m(V("D2"), estTotal))}. Estimate = the run's own time to first token + the longest book's share of the generation time (share by output length). It assumes each parallel call starts as fast as the single call did. "First token" means first text, so it includes any silent thinking the model did before writing (in some runs output tokens far exceed the text returned); in a one-book call that thinking would likely be shorter, so the estimate leans high. Cost would rise slightly, since the taste and instructions are sent five times.`);

  // Per case
  L.push("", "## Per case", "", "| Case | Catalog table | Canon on table → kept | Table | Rows with editions / readers / neither | Deeper at 20/250, 30/375, 45/560 | Line used | Deeper / any | Variant | Select attempts (misses) | Picks (shelf, canon) | Reserves (shelf) | Hedge swaps | Cost | Time |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const x of R) {
    const s = x.shared.shelves;
    const lineUsed = `${s.line.editions}/${s.line.readers}${s.lineStep ? " (raised)" : ""}${s.fellShort ? " (still short)" : ""}`;
    for (const v of ["D1", "D2"]) {
      const y = x[v];
      const pp = y.error ? `ERROR: ${y.error}` : y.picks.map((p: any) => `${p.title} — ${p.author} (${p._shelf}${p._canon ? ", canon" : ""}${p._swappedIn ? ", swapped in" : ""})`).join("; ");
      const rr = (y.reserves ?? []).map((p: any) => `${p.title} (${p._shelf})`).join("; ");
      const head = v === "D1" ? `| ${x.case} | ${x.shared.catalog.size} (HC pool ${x.shared.catalog.hardcoverPool}) | ${x.shared.canon.onTable} → ${x.shared.canon.kept} | ${x.shared.tableSize} | ${x.shared.popCoverage.editions} / ${x.shared.popCoverage.readers} / ${x.shared.popCoverage.neither} | ${s.deeperAtEachLine.join(", ")} | ${lineUsed} | ${s.deeper} / ${s.any} |` : "| | | | | | | | |";
      L.push(`${head} ${v} | ${y.selectAttempts}${y.selectMisses.length ? ` (${y.selectMisses.join("; ")})` : ""} | ${pp} | ${rr} | ${y.hedgeSwaps ?? ""} | $${y.usd.toFixed(3)} | ${sec(y.ms)} |`);
    }
  }

  // Overlap
  const share = (a: any[] = [], b: any[] = []) => { const s = new Set(a.map((p) => bookKey(p.title, p.author))); return b.filter((p) => s.has(bookKey(p.title, p.author))).length; };
  L.push("", "## Overlap (shared picks)", "", "| Case | D1 vs D2 | A vs D1 | A vs D2 |", "|---|---|---|---|");
  for (const c of CASES) L.push(`| ${c.id} | ${share(arms[1].picks[c.id], arms[2].picks[c.id])} of 3 | ${share(arms[0].picks[c.id], arms[1].picks[c.id])} of 3 | ${share(arms[0].picks[c.id], arms[2].picks[c.id])} of 3 |`);

  // Hedging + validity
  L.push("", "## Hedging and output validity against spec §4b", "");
  const REQ = ["title", "author", "format", "findLink", "hook", "why", "angleHeading", "angleText", "mood"];
  for (const v of ["D1", "D2"] as const) {
    const ok = V(v);
    const all5 = ok.flatMap((x) => x.allFive);
    const shown = ok.flatMap((x) => [...x.picks, ...x.reserves].map((p: any) => ({ ...p, run: x.case })));
    const issues: string[] = [];
    for (const p of shown) {
      const miss = REQ.filter((f) => !p[f]); if (miss.length) issues.push(`${p.run} ${p.title}: missing ${miss.join(", ")}`);
      if ((p.hook ?? "").length > 90) issues.push(`${p.run} ${p.title}: hook ${p.hook.length} chars`);
      if ((p.angleHeading ?? "").length > 30) issues.push(`${p.run} ${p.title}: heading "${p.angleHeading}" ${p.angleHeading.length} chars`);
      if (/\s/.test((p.mood ?? "").trim())) issues.push(`${p.run} ${p.title}: mood "${p.mood}"`);
      if (sentences(p.why) > 3) issues.push(`${p.run} ${p.title}: why ${sentences(p.why)} sentences`);
      if (p.story && (sentences(p.story) < 2 || sentences(p.story) > 3)) issues.push(`${p.run} ${p.title}: story ${sentences(p.story)} sentences`);
    }
    const fill = (f: string) => shown.filter((p) => p[f]).length;
    L.push(`**${v}.** Not confident: ${all5.filter((b: any) => !b._confident).length} of ${all5.length}${all5.some((b: any) => !b._confident) ? ` (${all5.filter((b: any) => !b._confident).map((b: any) => b._catalogTitle).join("; ")})` : ""}. Hedge swaps: ${ok.reduce((a, x) => a + x.hedgeSwaps, 0)}. Hedge phrases in final text: ${all5.filter((b: any) => b._hedgePhrase).length}. Write step: code fence in ${ok.filter((x) => x.writeText.includes("```")).length} of ${ok.length}; parses cleanly ${ok.filter((x) => x.writeParsesClean).length} of ${ok.length}. ${shown.length} books shown: ${issues.length} issues. Optional fields filled: year ${fill("year")}, pages ${fill("pages")}, cover ${fill("coverUrl")}, ISBN ${fill("isbn")}, story ${fill("story")}, originalTitle ${fill("originalTitle")}, subtitle ${fill("subtitle")}.`, "");
    for (const i of issues) L.push(`- ${i}`);
    L.push("");
  }
  L.push("**Arm A** (run 1): code fence in 6 of 6; parses cleanly 0 of 6; hook, heading, angle text, mood, format and link don't exist.");
  writeFileSync(path.join(OUT, "results.md"), L.join("\n") + "\n");

  // Blind: A vs D1 vs D2. A's display names reuse run 2's cleanup (same 18 books, same order).
  const aList = CASES.flatMap((c: any) => (aPicks[c.id] ?? []).map((p: any) => ({ case: c.id, title: p.title, author: p.author })));
  const clean: any[] = readJson(path.join(RUN2, "blind-a-names.json"));
  // First sentence only, cut at a word boundary to the same limit for every set, no ellipsis.
  const WHY_MAX = 140;
  const firstSentence = (t: string) => {
    let s = (t ?? "").split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|[A-Z])\.)(?<=[.!?])\s+(?=[A-Z"“‘(])/)[0] ?? "";
    if (s.length > WHY_MAX) s = s.slice(0, WHY_MAX + 1).replace(/\s+\S*$/, "").replace(/[,;:—–-]+$/, "");
    return s;
  };
  const B: string[] = ["# Blind look: three sets of picks", "", `For each case: the reader's taste, then three sets of three picks in random order. Every set shows the English title, a romanized author and the first sentence of the engine's "why", cut to at most ${WHY_MAX} characters. Two of the sets also have reserves, listed after the sets as Reserves X and Reserves Y. The key is in blind-key.json.`, ""];
  const key: Record<string, any> = {};
  for (const c of CASES) {
    const x = R.find((r) => r.case === c.id);
    const a = (aPicks[c.id] ?? []).map((p: any) => { const k = aList.findIndex((y) => y.case === c.id && y.title === p.title && y.author === p.author); return { title: clean[k]?.title ?? p.title, author: clean[k]?.author ?? p.author, line: firstSentence(p.why) }; });
    const items = (v: string) => (x?.[v]?.picks ?? []).map((p: any) => ({ title: p.title, author: p.author, line: firstSentence(p.why) }));
    const sets = shuffle([{ arm: "A", items: a }, { arm: "D1", items: items("D1") }, { arm: "D2", items: items("D2") }]);
    const resv = shuffle(["D1", "D2"]);
    key[c.id] = { "Set 1": sets[0].arm, "Set 2": sets[1].arm, "Set 3": sets[2].arm, "Reserves X": resv[0], "Reserves Y": resv[1] };
    B.push(`## ${c.id}`, "", `**Reader:** ${TASTE_ONE_LINE[c.id]}`, "");
    sets.forEach((s, n) => { B.push(`**Set ${n + 1}**`, ""); for (const it of shuffle(s.items) as any[]) B.push(`- *${it.title}* — ${it.author}. ${it.line}`); B.push(""); });
    resv.forEach((v, n) => {
      B.push(`**Reserves ${n ? "Y" : "X"}** (reserves for one of the sets above)`, "");
      const rs = x?.[v]?.reserves ?? [];
      for (const p of rs) B.push(`- *${p.title}* — ${p.author}. ${firstSentence(p.why)}`);
      if (!rs.length) B.push("- none left (used for swaps)");
      B.push("");
    });
  }
  writeFileSync(path.join(OUT, "blind.md"), B.join("\n"));
  writeJson(path.join(OUT, "blind-key.json"), key);
  console.log("wrote results.md, blind.md, blind-key.json");
}

// ---------- main ----------
const cmd = process.argv[2];
if (cmd === "run") {
  const file = path.join(OUT, "results.json");
  const done: any[] = existsSync(file) ? readJson(file) : [];
  const only = process.argv[3];
  for (const c of CASES) {
    if (only && only !== c.id) continue;
    if (done.some((d) => d.case === c.id && !d.D1?.error && !d.D2?.error)) continue;
    if (ledger().totalUsd + RUN_HEADROOM_USD > SPEND_CAP_USD) { console.log(`stopping before ${c.id}: $${ledger().totalUsd} spent, less than $${RUN_HEADROOM_USD} left under the cap`); break; }
    const t = await buildTable(c);
    const D1 = await runVariant("D1", c, t);
    const D2 = await runVariant("D2", c, t);
    const r = { case: c.id, shared: t.summary, sharedUsd: t.usd, sharedMs: t.ms, D1, D2 };
    const i = done.findIndex((d) => d.case === c.id);
    if (i >= 0) done[i] = r; else done.push(r);
    writeJson(file, done);
    const s = t.summary.shelves;
    console.log(`${c.id}: table ${t.summary.tableSize}, deeper ${s.deeper} (line ${s.line.editions}/${s.line.readers}) | D1 ${(D1 as any).error ?? "ok"} ${Math.round(D1.ms / 1000)}s $${D1.usd.toFixed(3)} | D2 ${(D2 as any).error ?? "ok"} sel ${D2.selectAttempts} ${Math.round(D2.ms / 1000)}s $${D2.usd.toFixed(3)} | ledger $${ledger().totalUsd}`);
  }
} else if (cmd === "refill") {
  // Fills year, pages, cover and subtitle on stored books after the lookup fix. No model calls.
  const file = path.join(OUT, "results.json");
  const R: any[] = readJson(file);
  let filled = 0, total = 0;
  for (const x of R) for (const v of ["D1", "D2"]) for (const group of ["allFive", "picks", "reserves"]) for (const b of x[v]?.[group] ?? []) {
    total++;
    const d = await olDocFor(b._catalogTitle, b._catalogAuthor);
    if (!d) continue;
    filled++;
    b.year ??= d.first_publish_year ?? null;
    b.pages ??= d.number_of_pages_median ?? null;
    b.coverUrl ??= d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null;
    b.subtitle ??= d.subtitle ?? null;
  }
  writeJson(file, R);
  console.log(`refilled ${filled} of ${total} book entries`);
} else if (cmd === "analyze") await analyze();
else console.log("usage: run | refill | analyze");
