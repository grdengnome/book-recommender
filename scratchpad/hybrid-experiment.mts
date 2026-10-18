// Experiment run 2 (2026-10-18, branch experiment/table-setting): hybrid table (arm C).
// Today's catalog table, built exactly as the engine builds it, plus verified AI proposals,
// with the run-1 "canon" dampened to at most 40 books. Compared against run 1's arm A.
// The live engine is not changed; lib modules and run 1's helpers are imported as they are.
//
// Usage:
//   node --env-file=.env.local scratchpad/hybrid-experiment.mts run       (12 runs; resumable)
//   node --env-file=.env.local scratchpad/hybrid-experiment.mts analyze
// Output (gitignored, holds taste descriptions): scratchpad/experiments/2026-10-18-hybrid/
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "scratchpad/experiments/2026-10-18-hybrid");
const RUN1 = path.join(ROOT, "scratchpad/experiments/2026-10-18-table-setting");
mkdirSync(OUT, { recursive: true });
const SPEND_CAP_USD = 4;
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
const { CASES, PRIZE, TASTE_RULES, PROPOSE_SYSTEM, titleKey, bookKey, olSearch, verifyCandidate, prizeFor, olEditionInfo, mapLimit, shuffle, parseLoose, popularity, median, sentences, traceTable, tracesFor, TASTE_ONE_LINE } = R1 as any;

// ---------- spend: every Anthropic response (ours and the lib's) is costed here ----------
type Ledger = { entries: { what: string; model: string; usd: number }[]; totalUsd: number };
const ledger = (): Ledger => (existsSync(LEDGER) ? readJson(LEDGER) : { entries: [], totalUsd: 0 });
let spendLabel = "unlabelled";
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  if (!url.startsWith("https://api.anthropic.com/")) return realFetch(input, init);
  if (ledger().totalUsd > SPEND_CAP_USD) throw new Error(`SPEND CAP: over $${SPEND_CAP_USD}; stopping`);
  const res = await realFetch(input, init);
  try {
    const data = await res.clone().json();
    // Responses can carry a dated model id (claude-haiku-4-5-20251001); price by the base id.
    const usd = modelCallCostUsd(data.model, data.usage) ?? modelCallCostUsd(String(data.model).replace(/-\d{8}$/, ""), data.usage) ?? 0;
    const l = ledger();
    l.entries.push({ what: spendLabel, model: data.model, usd });
    l.totalUsd = Math.round((l.totalUsd + usd) * 1e6) / 1e6;
    writeJson(LEDGER, l);
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

// ---------- catalog branch: the engine's own table-building ----------
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
      if (!tagIds.length) return { pool: [], note: "no tags" };
      return { pool: (await prepareHardcoverPool(tagIds, noopTrace)).pool, note: "ok" };
    } catch (err) {
      return { pool: [], note: `failed: ${String(err).slice(0, 120)}` };
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
  return { records: [...seen.values()], ms: Math.round(performance.now() - t0), rounds, searches, hardcoverPool: hc.pool.length, hardcoverNote: hc.note };
}

// ---------- AI branch ----------
const PROPOSE_SYSTEM_C = PROPOSE_SYSTEM.replace(
  "Only suggest books you are confident exist",
  "Skip the most obvious, most-recommended books for this taste — the ones that top every \"books like this\" list — and include several genuine deep cuts.\n\nOnly suggest books you are confident exist",
);
async function aiBranch(c: { id: string; taste: string }, label: string) {
  const t0 = performance.now();
  const shelfText = PRIZE.filter((p: any) => p.title && p.author && !/^Q\d+$/.test(p.title)).map((p: any) => `${p.id} | ${p.title} | ${p.author} | ${p.source}`).join("\n");
  const text = await claude(`${label} propose`, ENGINE_MODEL, PROPOSE_SYSTEM_C, `Reader's taste:\n${c.taste}\n\nPrize shelf:\n${shelfText}`, 8000);
  const proposeMs = Math.round(performance.now() - t0);
  let suggestions: any[] = [], parsesClean = true, dropped = 0;
  try { suggestions = parseLoose(text, "{").suggestions ?? []; } catch {
    parsesClean = false;
    for (const m of text.match(/\{[^{}]*"title"[^{}]*\}/g) ?? []) { try { suggestions.push(JSON.parse(m)); } catch { dropped++; } }
  }
  const prizeRaw = suggestions.filter((s) => s.prizeShelfId);
  const prizeDropped = prizeRaw.slice(8);
  suggestions = suggestions.filter((s) => !prizeDropped.includes(s));
  const tV = performance.now();
  const results = await mapLimit(suggestions, 4, async (s: any) => ({ s, v: await verifyCandidate(s) }));
  const verified = [], failures = [];
  for (const { s, v } of results) {
    const origin = s.prizeShelfId ? "prize shelf" : "AI suggestion";
    if (v.status === "verified") verified.push({ suggestion: s, origin, record: v.record });
    else failures.push({ suggestion: s, origin, ...v });
  }
  return { suggestions, verified, failures, parsesClean, dropped, prizeDroppedCount: prizeDropped.length, proposeMs, verifyMs: Math.round(performance.now() - tV), ms: Math.round(performance.now() - t0) };
}

// ---------- canon (run 1 arm A: books in 4+ of 6 cases' tables) ----------
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

// ---------- select + write ----------
const SELECT_SYSTEM_C = `You are a book recommendation engine. Your entire value proposition is taste, not popularity — you recommend books based on genuine fit and quality, actively resisting the pull toward safe, over-recommended picks. The goal is the most interesting and relevant books for this reader: authentically intriguing, familiar or not.

${TASTE_RULES}

Choose 3 picks and 2 reserves.
- Varied trio: the 3 picks must be three different kinds — one familiar-but-fresh (a known book or author, but not the reflexive answer), one discovery (a book this reader is unlikely to have met), and one wildcard (an unexpected angle that still lands) — all within the mood and feeling the reader asked for.
- At least one pick must be a genuine deep cut, not the most famous book for this taste.
- The 2 reserves must be strong enough to stand in for any pick, and also within the reader's mood.
- Treat any stated turn-off as a hard boundary.

All 5 books MUST come from the candidate table below. The table is unordered; never favor earlier entries. Copy each title and author exactly as they appear in the table; they are checked in code against it.

Respond with ONLY a JSON object: {"picks":[{"title":"...","author":"...","kind":"familiar-but-fresh|discovery|wildcard"}],"reserves":[{"title":"...","author":"..."}]}`;

const WRITE_SYSTEM_C = `You write the text for a book recommender's cards. For each book you get the reader's taste, the book's catalog title and author, its catalog subjects, and its catalog and Hardcover descriptions. Write in clean, plain English; no emoji.

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

async function fillSpec(rec: any, w: any) {
  let olDoc = rec._doc ?? null;
  let workKey = rec.olWorkKey;
  if (!olDoc) {
    const docs = await olSearch(workKey ? { q: workKey.replace("/works/", "") } : { title: rec.title, author: rec.author }, 3);
    olDoc = docs.find((d: any) => (workKey && d.key === workKey) || titleKey(d.title) === titleKey(rec.title)) ?? null;
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

async function runC(c: { id: string; taste: string }, run: number) {
  const label = `C ${c.id} r${run}`;
  const ledgerStart = ledger().entries.length;
  const t0 = performance.now();

  // 1. Both branches in parallel
  spendLabel = `${label} catalog`;
  const [cat, ai] = await Promise.all([catalogBranch(c.taste, `hybrid1018-${c.id}-r${run}`), aiBranch(c, label)]);
  const step1Ms = Math.round(performance.now() - t0);

  // 2. Dampen canon on the catalog side
  const damp = await dampenCanon(c.taste, cat.records, label);

  // 3. Combined table; origins stay internal
  const byKey = new Map<string, any>();
  for (const r of damp.kept) byKey.set(bookKey(r.title, r.author), { ...r, origin: "catalog" });
  for (const v of ai.verified) {
    const k = bookKey(v.record.title, v.record.author);
    const existing = byKey.get(k);
    if (existing) { existing.origin = "both"; existing.aiKind = v.origin; continue; }
    byKey.set(k, { ...v.record, origin: "AI", aiKind: v.origin });
  }
  const table = [...byKey.values()];
  const seen = new Map();
  recordSeenCandidates(seen, table.map(({ _doc, _hc, origin, aiKind, ...r }) => r));
  const modelTable = shuffle(table).map((r: any) => ({ title: r.title, author: r.author, subjects: r.subjects }));

  // 4. Select 3 + 2, grounded
  let sel: any = null, selectAttempts = 0;
  const tS = performance.now();
  for (let a = 1; a <= 3 && !sel; a++) {
    selectAttempts = a;
    const text = await claude(`${label} select`, ENGINE_MODEL, SELECT_SYSTEM_C, `Reader's taste:\n${c.taste}\n\nCandidate table:\n${JSON.stringify(modelTable)}`, 4000);
    let parsed: any;
    try { parsed = parseLoose(text, "{"); } catch { continue; }
    const all = [...(parsed.picks ?? []), ...(parsed.reserves ?? [])];
    if ((parsed.picks ?? []).length !== 3 || (parsed.reserves ?? []).length !== 2) continue;
    const g = checkPickGrounding(JSON.stringify(all), seen);
    if (g.status === "grounded") sel = { checked: g.picks, kinds: parsed.picks.map((p: any) => p.kind) };
  }
  const selectMs = Math.round(performance.now() - tS);
  if (!sel) return { case: c.id, run, error: "selection failed 3 times", usd: spentSince(ledgerStart) };

  // 5. Write all five, then swap unconfident picks for reserves
  const tW = performance.now();
  const meta = await lookupPickMetadata(sel.checked);
  const recs = sel.checked.map((p: any) => byKey.get(bookKey(p.record.title, p.record.author)) ?? p.record);
  const writeInput = sel.checked.map((p: any, i: number) => ({
    n: i + 1, catalogTitle: p.record.title, catalogAuthor: p.record.author, subjects: p.record.subjects ?? [],
    openLibraryDescription: meta[i]?.lookups.find((l: any) => l.source === "openlibrary")?.description || null,
    hardcoverDescription: meta[i]?.lookups.find((l: any) => l.source === "hardcover")?.description || null,
  }));
  const wText = await claude(`${label} write`, ENGINE_MODEL, WRITE_SYSTEM_C, `Reader's taste:\n${c.taste}\n\nBooks:\n${JSON.stringify(writeInput)}`, 5000);
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
    _origin: b.rec.origin, _aiKind: b.rec.aiKind ?? null, _canon: CANON.has(bookKey(b.rec.title, b.rec.author)),
    _kind: b.kind, _confident: b.confident, _swappedIn: b.swappedIn ?? false, _replaced: b.replaced ?? null,
    _hedgePhrase: HEDGES.test([b.spec.hook, b.spec.why, b.spec.angleText].join(" ")),
    _catalogTitle: b.rec.title, _catalogAuthor: b.rec.author,
  });
  return {
    case: c.id, run,
    ms: Math.round(performance.now() - t0), step1Ms, catalogMs: cat.ms, aiMs: ai.ms, aiProposeMs: ai.proposeMs, aiVerifyMs: ai.verifyMs, selectMs, writeMs,
    parallelSavedMs: cat.ms + ai.ms - step1Ms,
    usd: Math.round(spentSince(ledgerStart) * 1e6) / 1e6,
    catalog: { size: cat.records.length, rounds: cat.rounds, searches: cat.searches, hardcoverPool: cat.hardcoverPool, hardcoverNote: cat.hardcoverNote },
    canon: { onTable: damp.canonOnTable, kept: damp.canonKept },
    ai: { suggestions: ai.suggestions.length, verified: ai.verified.length, failures: ai.failures, parsesClean: ai.parsesClean, dropped: ai.dropped, prizeChosen: ai.suggestions.filter((s: any) => s.prizeShelfId).length, prizeDroppedCount: ai.prizeDroppedCount },
    tableSize: table.length,
    tableOrigins: { catalog: table.filter((r) => r.origin === "catalog").length, AI: table.filter((r) => r.origin === "AI").length, both: table.filter((r) => r.origin === "both").length },
    tableKeys: table.map((r) => bookKey(r.title, r.author)),
    selectAttempts, writeText: wText, writeParsesClean, hedgeSwaps,
    picks: finalPicks.map(show),
    reserves: reservesLeft.map(show),
    allFive: books.map(show),
  };
}

// ---------- analysis ----------
async function analyze() {
  const A: any[] = readJson(path.join(RUN1, "armA.json"));
  const C: any[] = readJson(path.join(OUT, "armC.json"));
  const popCache = path.join(OUT, "popularity-cache.json");
  const cache = existsSync(popCache) ? readJson(popCache) : existsSync(path.join(RUN1, "popularity-cache.json")) ? readJson(path.join(RUN1, "popularity-cache.json")) : {};
  const tA = tracesFor("trace1018");
  const aTables: Record<string, Set<string>> = Object.fromEntries(Object.entries(tA).map(([k, f]) => [k, traceTable(f as string)]));
  const aPicks: Record<string, any[]> = Object.fromEntries(A.map((a) => { let p: any[] = []; try { p = parseLoose(a.recommendations, "["); } catch {} return [a.case, p]; }));

  const arms: { name: string; tables: Record<string, Set<string>>; picks: Record<string, { title: string; author: string; origin: string; canon: boolean }[]> }[] = [];
  arms.push({ name: "A (run 1)", tables: aTables, picks: Object.fromEntries(Object.entries(aPicks).map(([c, ps]) => [c, ps.map((p) => ({ title: p.title, author: p.author, origin: "catalog", canon: CANON.has(bookKey(p.title, p.author)) }))])) });
  for (const run of [1, 2]) {
    const rs = C.filter((x) => x.run === run && !x.error);
    arms.push({
      name: `C run ${run}`,
      tables: Object.fromEntries(rs.map((x) => [x.case, new Set<string>(x.tableKeys)])),
      picks: Object.fromEntries(rs.map((x) => [x.case, x.picks.map((p: any) => ({ title: p._catalogTitle, author: p._catalogAuthor, origin: p._origin, canon: p._canon }))])),
    });
  }

  const L: string[] = ["# Hybrid table experiment (run 2) — results", "", `Generated ${new Date().toISOString()}. Spend: $${ledger().totalUsd}. "Canon" = ${CANON.size} books in 4+ of run 1's six arm-A tables (computed from only six cases; a real version would use many runs).`, ""];
  L.push("## Summary", "", "| Arm | Median table | Books in 4+ of 6 tables | Picks repeated across cases | Median HC readers | Median OL editions | Picks: catalog / AI / both | Canon picks | Median cost | Median time |", "|---|---|---|---|---|---|---|---|---|---|");
  const pops: Record<string, any[]> = {};
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
    pops[arm.name] = list;
    const o = (k: string) => list.filter((p) => p.origin === k).length;
    const runs = arm.name.startsWith("A") ? A : C.filter((x) => `C run ${x.run}` === arm.name && !x.error);
    L.push(`| ${arm.name} | ${median(sizes)} (${Math.min(...sizes)}–${Math.max(...sizes)}) | ${[...counts.values()].filter((n) => n >= 4).length} | ${rep.length}${rep.length ? ` (${rep.map(([k, n]) => `${k} ×${n}`).join("; ")})` : ""} | ${median(list.map((p) => p.hcUsers))} | ${median(list.map((p) => p.olEditions))} | ${o("catalog")} / ${o("AI")} / ${o("both")} | ${list.filter((p) => p.canon).length} of ${list.length} | $${median(runs.map((r: any) => r.usd))?.toFixed(3)} | ${Math.round(median(runs.map((r: any) => r.ms)) / 1000)}s |`);
  }

  const share = (a: any[] = [], b: any[] = []) => { const s = new Set(a.map((p) => bookKey(p.title, p.author))); return b.filter((p) => s.has(bookKey(p.title, p.author))).length; };
  L.push("", "## Overlap", "", "| Case | C run 1 vs run 2 | A vs C run 1 |", "|---|---|---|");
  for (const c of CASES) L.push(`| ${c.id} | ${share(arms[1].picks[c.id], arms[2].picks[c.id])} of 3 | ${share(arms[0].picks[c.id], arms[1].picks[c.id])} of 3 |`);

  L.push("", "## Per case (C)", "", "| Case | Run | Catalog table | Canon on table → kept | AI verified / suggested | Combined table (cat / AI / both) | Picks (origin, canon) | Reserves | Hedge swaps | Cost | Time | Parallel saved |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const x of C) {
    if (x.error) { L.push(`| ${x.case} | ${x.run} | ERROR: ${x.error} |||||||||||`); continue; }
    const pp = x.picks.map((p: any) => `${p.title} — ${p.author} (${p._origin}${p._canon ? ", canon" : ""}${p._swappedIn ? ", swapped in" : ""})`).join("; ");
    const rr = x.reserves.map((p: any) => `${p.title} (${p._origin})`).join("; ");
    L.push(`| ${x.case} | ${x.run} | ${x.catalog.size} (HC pool ${x.catalog.hardcoverPool}) | ${x.canon.onTable} → ${x.canon.kept} | ${x.ai.verified} / ${x.ai.suggestions} | ${x.tableSize} (${x.tableOrigins.catalog} / ${x.tableOrigins.AI} / ${x.tableOrigins.both}) | ${pp} | ${rr} | ${x.hedgeSwaps} | $${x.usd.toFixed(3)} | ${Math.round(x.ms / 1000)}s | ${Math.round(x.parallelSavedMs / 1000)}s |`);
  }
  const ok = C.filter((x) => !x.error);
  L.push("", `Timing (medians): catalog branch ${Math.round(median(ok.map((x) => x.catalogMs)) / 1000)}s, AI branch ${Math.round(median(ok.map((x) => x.aiMs)) / 1000)}s (propose ${Math.round(median(ok.map((x) => x.aiProposeMs)) / 1000)}s, verify ${Math.round(median(ok.map((x) => x.aiVerifyMs)) / 1000)}s), step 1 wall ${Math.round(median(ok.map((x) => x.step1Ms)) / 1000)}s, select ${Math.round(median(ok.map((x) => x.selectMs)) / 1000)}s, write ${Math.round(median(ok.map((x) => x.writeMs)) / 1000)}s. Parallel saved ${Math.round(median(ok.map((x) => x.parallelSavedMs)) / 1000)}s per run (median).`);

  // AI failures
  const aiTot = ok.reduce((a, x) => a + x.ai.suggestions, 0);
  const fails = ok.flatMap((x) => x.ai.failures.map((f: any) => ({ ...f, case: x.case, run: x.run })));
  const nm = fails.filter((f) => f.status === "near-miss"), inv = fails.filter((f) => f.status === "invented");
  L.push("", "## AI suggestions that failed verification", "", `${fails.length} of ${aiTot} (${((100 * fails.length) / Math.max(1, aiTot)).toFixed(1)}%): ${nm.length} near misses, ${inv.length} invented or not found.`, "");
  for (const f of fails) L.push(`- ${f.case} r${f.run} [${f.origin}] *${f.suggestion.title}* — ${f.suggestion.author}: **${f.status}**, ${f.reason}${f.match ? ` (catalog: *${f.match.title}* — ${f.match.author})` : ""}`);

  // Hedging + validity
  const all5 = ok.flatMap((x) => x.allFive);
  L.push("", "## Hedging", "", `Books marked not confident: ${all5.filter((b: any) => !b._confident).length} of ${all5.length}. Hedge swaps: ${ok.reduce((a, x) => a + x.hedgeSwaps, 0)}. Hedge phrases still in the final text: ${all5.filter((b: any) => b._hedgePhrase).length}.`);
  for (const b of all5.filter((b: any) => !b._confident)) L.push(`- not confident: ${b._catalogTitle} — ${b._catalogAuthor}`);
  const REQ = ["title", "author", "format", "findLink", "hook", "why", "angleHeading", "angleText", "mood"];
  const shown = ok.flatMap((x) => [...x.picks, ...x.reserves].map((p: any) => ({ ...p, run: `${x.case} r${x.run}` })));
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
  L.push("", "## Output validity against spec §4b (picks + reserves shown)", "",
    `- Write step: code fence in ${ok.filter((x) => x.writeText.includes("```")).length} of ${ok.length}; parses cleanly ${ok.filter((x) => x.writeParsesClean).length} of ${ok.length}.`,
    `- ${shown.length} books: ${issues.length} issues. Optional fields filled: year ${fill("year")}, pages ${fill("pages")}, cover ${fill("coverUrl")}, ISBN ${fill("isbn")}, story ${fill("story")}, source ${fill("source")}, originalTitle ${fill("originalTitle")}, subtitle ${fill("subtitle")}.`,
    "- Arm A (run 1, for comparison): code fence in 6 of 6; parses cleanly 0 of 6; hook, heading, angle text, mood, format and link don't exist.", "");
  for (const i of issues) L.push(`- ${i}`);
  writeFileSync(path.join(OUT, "results.md"), L.join("\n") + "\n");

  // Blind: A vs C run 1. A's names cleaned for display only (one Haiku call), so the sets look alike.
  const aList = CASES.flatMap((c: any) => (aPicks[c.id] ?? []).map((p: any) => ({ case: c.id, title: p.title, author: p.author })));
  const cleanFile = path.join(OUT, "blind-a-names.json");
  let clean: any[] = existsSync(cleanFile) ? readJson(cleanFile) : [];
  if (!clean.length) {
    const t = await claude("blind A names", CANON_MODEL,
      `Normalize book display names. For each book give its usual English title (no series or edition noise, no subtitle unless it's part of the usual title) and the author's name as "First Last" in its usual English romanization, no stress marks. Respond with ONLY a JSON array of {"title":"...","author":"..."} in the same order.`,
      JSON.stringify(aList.map(({ title, author }) => ({ title, author }))), 2000);
    clean = parseLoose(t, "[");
    writeJson(cleanFile, clean);
  }
  const firstSentence = (t: string) => { const s = (t ?? "").split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|[A-Z])\.)(?<=[.!?])\s+(?=[A-Z"“‘(])/)[0] ?? ""; return s.length > 200 ? s.slice(0, 197) + "…" : s; };
  const B: string[] = ["# Blind look: A vs C", "", "For each case: the reader's taste, then two sets of three picks in random order. Both sets show the English title, a romanized author and the first sentence of the engine's \"why\". Reserves (picks 4–5 of one set) are listed after the sets. The key is in blind-key.json.", ""];
  const key: Record<string, any> = {};
  for (const c of CASES) {
    const a = (aPicks[c.id] ?? []).map((p: any) => { const k = aList.findIndex((x) => x.case === c.id && x.title === p.title && x.author === p.author); return { title: clean[k]?.title ?? p.title, author: clean[k]?.author ?? p.author, line: firstSentence(p.why) }; });
    const cr = C.find((x) => x.case === c.id && x.run === 1 && !x.error);
    const cs = (cr?.picks ?? []).map((p: any) => ({ title: p.title, author: p.author, line: firstSentence(p.why) }));
    const sets = [{ arm: "A", items: a }, { arm: "C", items: cs }];
    const order = Math.random() < 0.5 ? [0, 1] : [1, 0];
    key[c.id] = { "Set 1": sets[order[0]].arm, "Set 2": sets[order[1]].arm, reservesBelongTo: "C" };
    B.push(`## ${c.id}`, "", `**Reader:** ${TASTE_ONE_LINE[c.id]}`, "");
    order.forEach((i, n) => { B.push(`**Set ${n + 1}**`, ""); for (const it of shuffle(sets[i].items)) B.push(`- *${it.title}* — ${it.author}. ${it.line}`); B.push(""); });
    B.push("**Reserves** (picks 4–5 of one of the sets above)", "");
    for (const p of cr?.reserves ?? []) B.push(`- *${p.title}* — ${p.author}. ${firstSentence(p.why)}`);
    if (!(cr?.reserves ?? []).length) B.push("- none left (used for swaps)");
    B.push("");
  }
  writeFileSync(path.join(OUT, "blind.md"), B.join("\n"));
  writeJson(path.join(OUT, "blind-key.json"), key);
  console.log("wrote results.md, blind.md, blind-key.json");
}

// ---------- main ----------
const cmd = process.argv[2];
if (cmd === "run") {
  const file = path.join(OUT, "armC.json");
  const done: any[] = existsSync(file) ? readJson(file) : [];
  const only = process.argv[3];
  for (const run of [1, 2]) for (const c of CASES) {
    if (only && only !== `${c.id}:${run}`) continue;
    if (done.some((d) => d.case === c.id && d.run === run && !d.error)) continue;
    const r = await runC(c, run);
    const i = done.findIndex((d) => d.case === c.id && d.run === run);
    if (i >= 0) done[i] = r; else done.push(r);
    writeJson(file, done);
    console.log(`C ${c.id} r${run}: ${(r as any).error ?? "ok"}, table ${(r as any).tableSize}, ${Math.round(((r as any).ms ?? 0) / 1000)}s, $${(r as any).usd} | ledger $${ledger().totalUsd}`);
  }
} else if (cmd === "analyze") await analyze();
else console.log("usage: run | analyze");
