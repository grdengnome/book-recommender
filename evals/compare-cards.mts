// Tests a change to the card writer on the same picks, without rerunning the engine (decision
// 2.26): a controlled before/after. Replayed requests also get the Hardcover evidence the engine
// now adds for Open Library picks. For each reader in a past run, it takes the exact card-writing
// requests from that run's debug traces, sends them again with today's card instructions, then
// has the card check read the old and the new cards side by side. Only the cards differ, so any
// change in honesty or heads-ups is the card writer's doing, not different books.
//
// Costs only the card rewrites (the card-writing model) and the card checks; picks, catalog
// facts and the old cards' checks are remembered. Needs the run's traces in .local/traces
// (written when the run had ENGINE_TRACE=1).
//
//   RUN=profile-v1-run1.json TAG_PREFIX=run1 node --env-file=.env.local --import ./tests/support/resolve.mts evals/compare-cards.mts
// Settings: ONLY=prof-01,prof-08 limits it to some readers.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callModel, modelFor } from "@/lib/ai/gateway";
import { CARD_SYSTEM_PROMPT, avoidBlock } from "@/lib/engine/cards/writeCards";
import { CARD_FORMAT } from "@/lib/engine/picks/pickSchema";
import { firstWord } from "@/lib/engine/picks/validatePicks";
import { finalMoods } from "@/lib/engine/recommend";
import { renderBrief } from "@/lib/engine/profile/renderBrief";
import type { TasteProfile } from "@/lib/contracts/tasteProfile";
import { remember } from "./judge/cache";
import { CATALOG_VERSION, lookupFacts, type CatalogFacts } from "./judge/catalog";
import { lookupHardcoverBySearch } from "@/lib/engine/verify/lookupPickMetadata";
import { checkCards, type CardFields, type CardVerdict } from "./judge/cardCheck";
import { callFailed, StopScoringError } from "./judge/errors";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(HERE, "results");
const TRACES = path.join(process.cwd(), ".local", "traces");

const runFile = process.env.RUN;
const prefix = process.env.TAG_PREFIX;
if (!runFile || !prefix) throw new Error("Set RUN (a results file) and TAG_PREFIX (the run's tag prefix), e.g. RUN=profile-v1-run1.json TAG_PREFIX=run1");
const only = new Set((process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean));

interface RunPick { title: string; author: string; hook: string; why: string; angleHeading: string; angleText: string; mood: string; pages?: number | null }
const run = JSON.parse(readFileSync(path.join(RESULTS, runFile), "utf8")) as { set: string; results: Array<{ id: string; picks?: RunPick[] }> };
const { cases } = JSON.parse(readFileSync(path.join(HERE, "cases", `${run.set}.json`), "utf8")) as { cases: Array<{ id: string; profile?: TasteProfile; tasteDescription?: string }> };
const avoidOf = (id: string) => cases.find((x) => x.id === id)?.profile?.slots.avoid?.value ?? [];
const briefOf = (id: string) => {
  const c = cases.find((x) => x.id === id);
  return c?.profile ? renderBrief(c.profile) : c?.tasteDescription ?? "";
};

const facts = async (title: string, author: string): Promise<CatalogFacts> =>
  (await remember("facts", { v: CATALOG_VERSION, title, author }, () => lookupFacts(title, author), { keep: (x) => x.status !== "error" && !x.hardcoverError })).value;

interface CardCall { hadHardcover?: boolean; attempt?: number; pick?: number; request: { system: string; messages: Array<{ content: string }>; output_config: unknown; [k: string]: unknown }; response?: { content?: Array<{ type: string; text?: string }> } }

// The final attempt's successful card-writing request for each pick, from the reader's trace.
function cardRequests(evalTag: string): Map<string, CardCall> {
  if (!existsSync(TRACES)) throw new Error(`No traces folder at ${TRACES}: this needs the run's debug traces`);
  const name = readdirSync(TRACES).filter((f) => f.includes(`-${evalTag}-`)).sort().pop();
  if (!name) throw new Error(`No trace for ${evalTag}`);
  const trace = JSON.parse(readFileSync(path.join(TRACES, name), "utf8")) as { stages: Record<string, Array<CardCall & { kind?: string }>> };
  const calls = (trace.stages.W_card_writing ?? []).filter((e) => e.kind === "model_call" && e.response);
  const last = Math.max(...calls.map((c) => c.attempt ?? 1));
  // Whether each pick's original lookup already had a Hardcover record (then the engine wouldn't search).
  const lookups = (trace.stages.G_pick_lookup ?? []) as unknown as Array<{ kind?: string; attempt?: number; pick?: number; picks?: Array<{ lookups?: Array<{ source: string }> }> }>;
  const hadHardcover = (c: CardCall) =>
    lookups.some((g) => g.kind === "result" && (g.attempt ?? 1) === (c.attempt ?? 1) && g.pick === c.pick && (g.picks?.[0]?.lookups ?? []).some((l) => l.source === "hardcover"));
  const byTitle = new Map<string, CardCall>();
  for (const c of calls.filter((c) => (c.attempt ?? 1) === last)) {
    try {
      const card = JSON.parse(c.response?.content?.find((b) => b.type === "text")?.text ?? "") as { title: string };
      byTitle.set(card.title, { ...c, hadHardcover: hadHardcover(c) });
    } catch {
      // a failed card; the retry that worked is kept instead
    }
  }
  return byTitle;
}

// The engine now gives every pick's card Hardcover's description and moods, finding the record
// by title and author when the pick came from Open Library only (decision 2.26). A replayed
// request from before that change gets the same evidence, found the same way (the engine's own
// lookup: strict match, same timeout), only where that pick's original lookup had no Hardcover
// record, and placed where the engine puts it (its description after the other descriptions,
// genres and moods last). Counts are kept so the result can be read in proportion.
const evidence = { added: 0, noMatch: 0, failed: 0, alreadyHad: 0 };
const searchMs: number[] = [];
async function withHardcoverEvidence(prompt: string, hadHardcover: boolean): Promise<string> {
  if (hadHardcover) {
    evidence.alreadyHad++;
    return prompt;
  }
  const title = /\ncatalog title: (.*)/.exec(prompt)?.[1]?.trim();
  const author = /\ncatalog author: (.*)/.exec(prompt)?.[1]?.trim();
  if (!title || !author) return prompt;
  const { value: hc, reused } = await remember("hardcoverForCard", { v: 2, title, author }, () => lookupHardcoverBySearch(title, author), { keep: (x) => x.status !== "failed" });
  if (!reused && hc.ms > 0) searchMs.push(hc.ms);
  if (hc.status === "failed") evidence.failed++;
  else if (hc.status !== "ok") evidence.noMatch++;
  if (hc.status !== "ok") return prompt;
  evidence.added++;
  const lines = prompt.split("\n");
  const flat = hc.description.replace(/\s+/g, " ").trim();
  if (flat) {
    const desc = `catalog description: ${flat.length > 1200 ? `${flat.slice(0, 1200)}…` : flat}`;
    const lastDesc = lines.map((l) => l.startsWith("catalog description: ")).lastIndexOf(true);
    const at = lastDesc >= 0 ? lastDesc + 1 : lines.findIndex((l) => l.startsWith("subjects: ") || l.startsWith("Hardcover genres: ") || l === "</book>");
    lines.splice(at, 0, desc);
  }
  const close = lines.indexOf("</book>");
  const tail = [
    ...(hc.genres.length ? [`Hardcover genres: ${hc.genres.join("; ")}`] : []),
    ...(hc.moods.length ? [`Hardcover moods: ${hc.moods.join("; ")}`] : []),
  ];
  lines.splice(close, 0, ...tail);
  return lines.join("\n");
}

// The engine now gives the card writer the reader's avoid list (the only things a heads-up may be
// about); a replayed request gets it in the same place.
function withAvoid(prompt: string, avoid: string[]): string {
  const block = avoidBlock(avoid);
  if (!block.length || prompt.includes("<reader_avoid>")) return prompt;
  return prompt.replace("</reader_taste>\n\n", `</reader_taste>\n\n${block.join("\n")}\n`);
}

async function rewrite(call: CardCall, avoid: string[]): Promise<{ fields: CardFields; selectorMood: string }> {
  const content = withAvoid(await withHardcoverEvidence(String(call.request.messages[0]?.content ?? ""), call.hadHardcover ?? false), avoid);
  const body = { ...call.request, messages: [{ ...call.request.messages[0], content }], model: modelFor("cardWriting"), system: CARD_SYSTEM_PROMPT, output_config: { format: CARD_FORMAT } };
  const selectorMood = /\nmood: (.*)/.exec(String(call.request.messages[0]?.content))?.[1]?.trim() ?? "";
  const { value } = await remember("cardRewrite", body, async () => {
    const res = await callModel(body, { timeoutMs: 30_000 });
    if (!res.ok) throw callFailed("card rewrite", res.status, res.data);
    return JSON.parse(res.data.content?.find((b) => b.type === "text")?.text ?? "") as CardFields;
  });
  return { fields: { ...value, mood: firstWord(value.mood ?? "") }, selectorMood };
}

const tally = (vs: CardVerdict[]) => ({
  errors: vs.filter((v) => v.honest === "fail").length,
  unknown: vs.filter((v) => v.honest === "unknown").length,
  warranted: vs.filter((v) => v.headsUp === "warranted").length,
  unwarranted: vs.filter((v) => v.headsUp === "unwarranted").length,
});

const report: unknown[] = [];
const oldAll: CardVerdict[] = [];
let headsUpWithoutAvoid = 0;
const newAll: CardVerdict[] = [];
try {
  for (const r of run.results) {
    if (only.size && !only.has(r.id)) continue;
    if (!r.picks?.length) continue;
    const calls = cardRequests(`${prefix}-${r.id}`);
    const brief = briefOf(r.id);
    const withFacts = await Promise.all(r.picks.map(async (p) => ({ ...p, facts: await facts(p.title, p.author) })));
    const rewritten = await Promise.all(r.picks.map(async (p) => {
      const call = calls.get(p.title);
      if (!call) throw new Error(`${r.id}: no card-writing request found for "${p.title}"`);
      return rewrite(call, avoidOf(r.id));
    }));
    const moods = finalMoods(rewritten.map((x) => ({ selector: x.selectorMood, card: x.fields.mood })));
    const oldCheck = await checkCards(brief, withFacts.map((p) => ({ ...p, fields: { hook: p.hook, why: p.why, angleHeading: p.angleHeading, angleText: p.angleText, mood: p.mood } })));
    const newCheck = await checkCards(brief, withFacts.map((p, i) => ({ ...p, fields: { ...rewritten[i].fields, mood: moods[i] } })));
    if (!avoidOf(r.id).length) headsUpWithoutAvoid += newCheck.cards.filter((v) => v.headsUp !== "none").length;
    oldAll.push(...oldCheck.cards);
    newAll.push(...newCheck.cards);
    r.picks.forEach((p, i) => {
      const o = oldCheck.cards[i], n = newCheck.cards[i];
      report.push({ id: r.id, title: p.title, old: { why: p.why, mood: p.mood, ...o }, new: { why: rewritten[i].fields.why, mood: moods[i], ...n } });
      if (o.honest !== n.honest || o.headsUp !== n.headsUp) {
        console.log(`${r.id} "${p.title}": honest ${o.honest} → ${n.honest}, heads-up ${o.headsUp} → ${n.headsUp}\n    new why: ${rewritten[i].fields.why}\n    check: ${n.reason}`);
      }
    });
    console.log(`[${r.id}] checked`);
  }
} catch (err) {
  if (!(err instanceof StopScoringError)) throw err;
  // Everything paid for is remembered; the summary below covers the readers checked so far.
  console.error(`\nStopped: ${err.message}`);
  process.exitCode = 1;
}

const out = runFile.replace(/\.json$/, "-cards.json");
writeFileSync(path.join(RESULTS, out), JSON.stringify(report, null, 2));
const o = tally(oldAll), n = tally(newAll);
console.log(`\nSame ${oldAll.length} picks, old cards vs new cards`);
const sorted = [...searchMs].sort((a, b) => a - b);
if (sorted.length) console.log(`Hardcover search time (the engine's own lookup, live): median ${sorted[Math.floor(sorted.length / 2)]}ms · slowest ${sorted[sorted.length - 1]}ms over ${sorted.length} searches`);
console.log(`Hardcover evidence: ${evidence.alreadyHad} cards already had it · ${evidence.added} newly added · ${evidence.noMatch} no matching record · ${evidence.failed} lookups failed`);
console.log(`Card errors:          ${o.errors} → ${n.errors}`);
console.log(`Unverifiable:         ${o.unknown} → ${n.unknown}`);
console.log(`Heads-ups warranted:  ${o.warranted} → ${n.warranted}`);
console.log(`Heads-ups unwarranted (needless hedging): ${o.unwarranted} → ${n.unwarranted}`);
console.log(`New heads-ups for readers with no avoid list (should be 0): ${headsUpWithoutAvoid}`);
console.log(`\nWrote evals/results/${out} (every card, old and new, with the check's reasons)`);
