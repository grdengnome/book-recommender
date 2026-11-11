// The recommendation engine's pipeline (decision 14.5): the recipe that runs every stage in
// order. Moved out of app/api/recommend/route.ts, which is now only the web front door.
//
// Stages, each in its own folder under lib/engine/:
//   sources/  where books come from (Open Library search tool, Hardcover tag pool)
//   pool/     merging the catalogs, and checking every pick is in the pool
//   picks/    the selection's shape, streaming and validation
//   cards/    writing and shortening each pick's card
//   verify/   catalog lookup per pick and the description check
// Every model call goes through the AI gateway (lib/ai/gateway.ts).
import { appendFileSync, mkdirSync } from "fs";
import path from "path";
import { toolDefinitions, callTool, setSearchBooksLogTag } from "@/lib/engine/sources/openlibrary";
import type { SearchBooksResult } from "@/lib/engine/sources/openlibrary/searchBooks";
import { mapTasteToHardcoverTags } from "@/lib/engine/sources/hardcover/mapTasteToTags";
import {
  prepareHardcoverPool,
  type HardcoverBookCandidate,
} from "@/lib/engine/sources/hardcover/preparePool";
import { mergeCandidatePools, toModelPool } from "@/lib/engine/pool/mergeCandidatePools";
import { filterByLength } from "@/lib/engine/pool/lengthFilter";
import type { LengthBand } from "@/lib/engine/profile/slots";
import {
  checkPickGrounding,
  formatPickSources,
  recordSeenCandidates,
  type CheckedPick,
  type GroundingResult,
  type SeenCandidates,
} from "@/lib/engine/pool/pickGrounding";
import { formatPickMetadata, lookupFinalists, lookupPickMetadata, type PickMetadata } from "@/lib/engine/verify/lookupPickMetadata";
import { modeForInput, searchesPerRound, searchPromptFor, selectionMaxTokens, selectionMode, SHORTLIST_SIZE } from "@/lib/engine/picks/selectionPrompts";
import { finalChoiceRequest, formatFinalists, readShortlist, shortlistAsSeen } from "@/lib/engine/picks/shortlist";
import { checkPickDescriptions, formatPickCheck } from "@/lib/engine/verify/checkPickDescriptions";
import { createRequestTrace, type RequestTrace } from "@/lib/trace/requestTrace";
import { SELECTION_FORMAT, SHORTLIST_FORMAT, toClientPick, type CardText, type ModelPick, type SelectedPick } from "@/lib/engine/picks/pickSchema";
import {
  duplicateMoods,
  validateSelectedPick,
  validateSelectionCount,
  type LimitedField,
  type OverLimitField,
} from "@/lib/engine/picks/validatePicks";
import { writeCard } from "@/lib/engine/cards/writeCards";
import { createPickScanner } from "@/lib/engine/picks/streamSelection";
import { modelFor, streamModel } from "@/lib/ai/gateway";
import { formatShorten, shortenFields } from "@/lib/engine/cards/shortenFields";

// Bounds the search_books retry loop (spec.md 5b leaves the retry judgment call
// to the model, but the code still needs a hard ceiling). The Nth+1 call below
// omits `tools`, which structurally forces a final answer rather than relying
// on an instruction the model could ignore.
const MAX_TOOL_ROUNDS = 3;

// Grounding enforcement (2026-09-20): every final pick must be found in a retrieved
// candidate pool — no trained-knowledge fallback, including for thin pools. The prompt
// asks for this, but a prompt alone isn't a guarantee (a same-day test returned two
// picks absent from both pools), so each generation is checked in code
// (lib/engine/pool/pickGrounding.ts) and a failed check re-runs the whole generation rather
// than returning an ungrounded pick. Bounded so a persistent failure ends in a clean
// error, never in an unverified answer. Deliberately no thin-pool recovery path beyond
// this retry — that edge case is flagged for its own investigation, not designed here.
// The same bound covers a selection that breaks the output contract (lib/engine/picks/
// validatePicks.ts: pick count, empty fields), is cut off or refused, or whose cards can't
// be written (lib/engine/cards/writeCards.ts). Length overflow is deliberately not a failure:
// it's repaired after the cards are written (shortenFields below).
const MAX_GENERATION_ATTEMPTS = 3;

// Hardcover pre-fetch — spec.md 5b, architecture decided 2026-08-19 (docs/progress-log.md):
// fixed pre-fetch derived from the taste description up front, intentionally asymmetric
// with Open Library's adaptive/model-invoked search. Runs once per request, concurrently
// with the OL tool-use loop below; merged into each search_books result as it resolves
// (see the tool-result loop), not merged once before the conversation starts, since no
// single OL pool value exists outside an individual tool call.
//
// Error-handling decision point (flagged, not silently picked): on any failure —
// Hardcover API error, missing token, or an empty tag mapping — this degrades to an
// empty pool rather than failing the whole request. mergeCandidatePools with an empty
// Hardcover side is a no-op that just passes the OL pool through, so the user still gets
// OL-only recommendations instead of a hard failure. This matches the existing convention
// in searchBooks.ts (fetchSearchResults/fetchSubjectResults already catch-and-return-[]
// rather than throwing) — reconsider if silent degradation here should instead surface to
// the caller (e.g. a response field noting Hardcover was unavailable).
//
// Failure tracking: silent to the client, but not silent to us — same NDJSON-append
// pattern as searchBooks.ts's query-log.json (tagged, append-only, logging failure can
// never break the actual request). Categorized rather than lumped into one bucket, since
// "token misconfigured" and "Hardcover API had a bad day" point to different fixes.
type HardcoverFailureCategory =
  | "hardcover_timeout"
  | "missing_token"
  | "hardcover_api_error"
  | "empty_tag_mapping"
  | "tag_mapping_error";

const HARDCOVER_FAILURE_LOG_PATH = path.join(
  process.cwd(),
  ".local",
  "hardcover-failure-log.json",
);

function logHardcoverFailure(
  tag: string | null,
  category: HardcoverFailureCategory,
  err: unknown,
): void {
  try {
    mkdirSync(path.dirname(HARDCOVER_FAILURE_LOG_PATH), { recursive: true });
    const entry = {
      tag,
      timestamp: new Date().toISOString(),
      category,
      detail:
        err instanceof Error
          ? err.message
          : category === "hardcover_timeout"
            ? `pool not ready after ${HARDCOVER_DEADLINE_MS}ms`
            : "mapTasteToHardcoverTags matched zero tags",
    };
    appendFileSync(HARDCOVER_FAILURE_LOG_PATH, JSON.stringify(entry) + "\n");
  } catch {
    // Diagnostic logging must never break the actual Hardcover pre-fetch.
  }
}

async function fetchHardcoverPool(
  tasteDescription: string,
  evalTag: string | null,
  trace: RequestTrace,
): Promise<HardcoverBookCandidate[]> {
  let tagIds: number[];
  try {
    tagIds = (await mapTasteToHardcoverTags(tasteDescription, trace)).tagIds;
  } catch (err) {
    console.error("Hardcover tag mapping failed, degrading to Open-Library-only:", err);
    logHardcoverFailure(evalTag, "tag_mapping_error", err);
    trace.add("A", { kind: "error", category: "tag_mapping_error", error: errorText(err) });
    trace.add("B", { kind: "skipped", reason: "tag mapping failed" });
    return [];
  }

  if (tagIds.length === 0) {
    console.error("Hardcover tag mapping matched zero tags, degrading to Open-Library-only");
    logHardcoverFailure(evalTag, "empty_tag_mapping", null);
    trace.add("B", { kind: "skipped", reason: "tag mapping matched zero tags" });
    return [];
  }

  try {
    const { pool } = await prepareHardcoverPool(tagIds, trace);
    return pool;
  } catch (err) {
    console.error("Hardcover pre-fetch failed, degrading to Open-Library-only:", err);
    const category = process.env.HARDCOVER_API_TOKEN ? "hardcover_api_error" : "missing_token";
    logHardcoverFailure(evalTag, category, err);
    trace.add("B", { kind: "error", category, error: errorText(err) });
    return [];
  }
}

// Speed (fix PR 1, 2026-10-21): the merge waits for the Hardcover pool, so a slow Hardcover
// call held up the whole request (one of 12 traced runs took 10.1s; the median is ~1.2s).
// Past this deadline from the start of the request, the engine goes on with Open Library
// alone, the same path as any other Hardcover failure. The merge normally needs the pool at
// ~6s, so a typical request never waits on this.
const HARDCOVER_DEADLINE_MS = 5000;

function withHardcoverDeadline(
  pool: Promise<HardcoverBookCandidate[]>,
  evalTag: string | null,
  trace: RequestTrace,
): Promise<HardcoverBookCandidate[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<HardcoverBookCandidate[]>((resolve) => {
    timer = setTimeout(() => {
      console.error(`Hardcover pool not ready after ${HARDCOVER_DEADLINE_MS}ms, degrading to Open-Library-only`);
      logHardcoverFailure(evalTag, "hardcover_timeout", null);
      trace.add("B", { kind: "timeout", deadlineMs: HARDCOVER_DEADLINE_MS });
      resolve([]);
    }, HARDCOVER_DEADLINE_MS);
  });
  return Promise.race([pool.finally(() => clearTimeout(timer)), deadline]);
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Error body for the screens (spec.md §4b): a stable code to pick the error state from, and
// a plain message. Upstream detail (the Anthropic error, model text) stays in the server log
// and the trace, never in the response.
export type ErrorCode = "misconfigured" | "bad_request" | "upstream_error" | "no_grounded_picks" | "not_enough_books";
export function errorBody(code: ErrorCode, message: string) {
  return { error: { code, message } };
}

// Every response after the engine starts goes out through here, so the debug trace records
// it (stage I) and writes its file exactly once. A no-op passthrough when tracing is off.
function respond(trace: RequestTrace, body: Record<string, unknown>, status = 200): RecommendResult {
  trace.add("I", { kind: "result", httpStatus: status, body });
  trace.finish();
  return { status, body };
}


export interface RecommendInput {
  // The reader's answers, as one piece of text. Data to interpret, never instructions.
  tasteDescription: string;
  // The reader's length request, when they made one (from the taste profile). Enforced in code
  // before the model chooses (decision 2.25).
  length?: LengthBand;
  // What the reader asked to avoid (from the taste profile). A card may give a heads-up only
  // about these (decision 2.26).
  avoid?: string[];
  // Optional eval-case tag, set only by the eval runner; tags logs and the debug trace.
  evalTag?: string | null;
}

// The engine's answer: the HTTP status to send and the response body (spec.md §4b).
export interface RecommendResult {
  status: number;
  body: Record<string, unknown>;
}

// The whole recommendation pipeline for one reader. The caller (app/api/recommend/route.ts)
// has already checked the request and that the AI gateway is configured.
export async function recommend({ tasteDescription, length, avoid = [], evalTag = null }: RecommendInput): Promise<RecommendResult> {
  // TEMPORARY (query-tracing session, 2026-08-03): optional eval-case tag, only
  // ever set by the eval driver script. Absent in normal use, where this is a
  // no-op passthrough — does not affect retrieval, dedupe, or shuffle behavior.
  setSearchBooksLogTag(evalTag);

  // Debug-only trace (lib/trace/requestTrace.ts): one per request, passed down explicitly.
  // A no-op unless ENGINE_TRACE=1, and never on Vercel. Requests the route rejects (no API
  // key, no taste description) never reach the engine and aren't traced.
  const trace = createRequestTrace({ evalTag, tasteDescription });

  // Branch 2 (Hardcover) starts now, concurrently with branch 1 (the OL tool-use loop
  // below) — both start from tasteDescription and don't depend on each other's output.
  const hardcoverPoolPromise = withHardcoverDeadline(
    fetchHardcoverPool(tasteDescription, evalTag, trace),
    evalTag,
    trace,
  );

  // Each attempt is a full fresh generation (new conversation, new search_books calls);
  // the Hardcover pre-fetch is shared since it depends only on tasteDescription.
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const attemptTrace = trace.with({ attempt });
    const generation = await generateOnce(tasteDescription, hardcoverPoolPromise, attemptTrace, length, avoid);
    if (!generation.ok) return respond(trace, generation.body, generation.status);

    if (generation.status === "ready") {
      const { grounding, picks, pickMetadata, overLimit } = generation;
      console.log(
        `recommend: pick sources (attempt ${attempt}/${MAX_GENERATION_ATTEMPTS})\n${formatPickSources(grounding.picks)}`,
      );

      // Length overflow (lib/engine/cards/shortenFields.ts): one small call shortens only the
      // over-limit fields; on any failure the original text is kept.
      const shortened = await shortenFields(picks, overLimit, attemptTrace);
      console.log(formatShorten(shortened));
      attemptTrace.add("H", { kind: "shorten", ...shortened });

      // Description check (feat/verify-pick-descriptions): one checker call compares the
      // `why` / `angleText` text against the catalog records and rewrites any pick it
      // contradicts. Never fails the request: it returns the original picks unchanged on
      // any failure.
      const checkStart = performance.now();
      const checked = await checkPickDescriptions(
        tasteDescription,
        shortened.picks,
        pickMetadata,
        attemptTrace,
      );
      const checkMs = Math.round(performance.now() - checkStart);
      console.log(formatPickCheck(checked, 0, checkMs));
      attemptTrace.add("H", { kind: "result", ...checked, checkPlusOverheadMs: checkMs });

      // Only the contract's fields leave the server: no model message, no thinking, no
      // pool strings or catalog IDs.
      return respond(trace, { picks: checked.picks.map(toClientPick) });
    }

    console.error(
      `recommend: ATTEMPT REJECTED (attempt ${attempt}/${MAX_GENERATION_ATTEMPTS}) — ${generation.detail}` +
        (attempt < MAX_GENERATION_ATTEMPTS ? "\nrecommend: retrying" : ""),
    );
  }

  console.error(
    `recommend: all ${MAX_GENERATION_ATTEMPTS} attempts rejected — returning error, no picks returned`,
  );
  return respond(
    trace,
    errorBody("no_grounded_picks", "Could not produce recommendations grounded in the retrieved candidate pool"),
    502,
  );
}

// "rejected" = this attempt can't be used (selection cut off, breaks the output contract or
// ungrounded, or a card couldn't be written); the caller re-runs the generation.
type GenerationResult =
  | {
      ok: true;
      status: "ready";
      picks: ModelPick[];
      grounding: GroundingResult;
      pickMetadata: PickMetadata[];
      overLimit: OverLimitField[];
    }
  | { ok: true; status: "rejected"; detail: string }
  | { ok: false; status: number; body: Record<string, unknown> };

// What happened to one pick between arriving in the selection stream and having its card.
type PickOutcome =
  | { ok: true; selected: SelectedPick; checked: CheckedPick; metadata: PickMetadata; card: CardText; overLimit: LimitedField[] }
  | { ok: false; reason: string; checked?: CheckedPick };

// One full generation: the OL tool-use loop (with Hardcover merged into each search_books
// result), whose final answer is the selection. The selection is streamed: as each pick's
// object completes, that pick is checked (contract, grounding), looked up in its catalog and
// its card written, while the rest of the selection is still arriving. Once the stream ends,
// the full answer is checked (finished, exactly 3 picks) and every pick's outcome collected.
// An Anthropic API failure ends the request — API failures are not retried here — with a
// generic error body; the detail goes to the server log and the trace.
async function generateOnce(
  tasteDescription: string,
  hardcoverPoolPromise: Promise<HardcoverBookCandidate[]>,
  trace: RequestTrace,
  length?: LengthBand,
  avoid: string[] = [],
): Promise<GenerationResult> {
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: tasteDescription },
  ];
  // Which selection version runs (decision 6.13; ENGINE_SELECTION, default "current").
  const mode = modeForInput(selectionMode(), tasteDescription);

  // Every candidate the model was shown this generation (with its internal IDs), keyed by
  // pickGrounding's groundingKey — the reference set the final picks are checked against.
  const seenCandidates: SeenCandidates = new Map();

  let data;
  let outcomes: Promise<PickOutcome>[] = [];
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const allowToolUse = round < MAX_TOOL_ROUNDS;
    const roundTrace = trace.with({ round });

    const requestBody = {
      model: modelFor("selection"),
      max_tokens: selectionMaxTokens(mode),
      // Cache breakpoint on the fixed instructions (tools render first, then system), ~3k
      // tokens, above Sonnet 5's 1,024-token minimum. Later rounds and later requests within
      // the cache TTL read this prefix from cache instead of re-processing it.
      system: [{ type: "text", text: searchPromptFor(mode), cache_control: { type: "ephemeral" } }],
      messages,
      // On every round, not just the last: the model usually answers right after its first
      // searches, while tools are still offered. Constrains only the final text; tool
      // calls are unaffected.
      output_config: { format: mode === "shortlist" ? SHORTLIST_FORMAT : SELECTION_FORMAT },
      ...(allowToolUse ? { tools: toolDefinitions } : {}),
      // Streamed so each pick's lookup and card can start as soon as it arrives.
      stream: true,
    };

    // Picks that arrive in this round's text start their pipeline at once. A round that
    // ends in tool_use instead discards them (none observed: the text is the final answer).
    const roundOutcomes: Promise<PickOutcome>[] = [];
    const callStart = performance.now();
    const arrivals: number[] = [];
    const arrivedTitles: string[] = [];
    // Version C's search call lists finalists, not picks: nothing starts until the final choice.
    const scan = mode === "shortlist" ? () => {} : createPickScanner((raw, index) => {
      arrivals.push(Math.round(performance.now() - callStart));
      const earlierTitles = arrivedTitles.slice();
      const title = (raw as { poolTitle?: unknown } | null)?.poolTitle;
      if (typeof title === "string" && title.trim()) arrivedTitles.push(title.trim());
      roundOutcomes.push(runPick(tasteDescription, raw, index, seenCandidates, earlierTitles, roundTrace, avoid));
    });
    const streamed = await streamModel(requestBody, scan);
    data = streamed.data;
    // Snapshotted now, before `messages` grows: this is exactly what this call sent.
    roundTrace.modelCall("C", {
      model: requestBody.model,
      request: requestBody,
      response: data,
      httpStatus: streamed.status,
      ms: Math.round(performance.now() - callStart),
    });
    if (arrivals.length) roundTrace.add("C", { kind: "pick_arrivals", msFromCallStart: arrivals });

    if (!streamed.ok) {
      console.error(`recommend: Anthropic API error ${streamed.status}: ${JSON.stringify(data?.error ?? data).slice(0, 300)}`);
      return {
        ok: false,
        status: 502,
        body: errorBody("upstream_error", "The recommendation service is unavailable. Please try again."),
      };
    }

    if (data.stop_reason !== "tool_use") {
      outcomes = roundOutcomes;
      break;
    }

    const toolUseBlocks = (
      data.content as Array<{ type: string; id: string; name: string; input: unknown }>
    ).filter((block) => block.type === "tool_use");

    messages.push({ role: "assistant", content: data.content });

    // At most searchesPerRound() searches run in one turn; the rest get a short "skipped"
    // answer (every tool call needs a result) and never reach the catalogs or the pool.
    const cap = searchesPerRound();
    let searchesThisRound = 0;
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const toolTrace = roundTrace.with({ toolUseId: block.id });
        if (block.name === "search_books" && ++searchesThisRound > cap) {
          toolTrace.add("D", { kind: "search_skipped", input: block.input, cap });
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({
              skipped: `Search limit reached: only ${cap} searches run per turn. ${round < MAX_TOOL_ROUNDS - 1 ? "Work with the results above, or choose your best searches next turn." : "Work with the results above."}`,
            }),
          };
        }
        let result: unknown;
        try {
          result = await callTool(block.name, block.input, toolTrace);
          // Merge Hardcover in here, not once before the loop: this is the point
          // where an OL pool from this specific call actually exists to merge against.
          if (block.name === "search_books") {
            const olResult = result as SearchBooksResult;
            const hardcoverPool = await hardcoverPoolPromise;
            const { pool: merged } = mergeCandidatePools(olResult.pool, hardcoverPool, toolTrace);
            // A length request is enforced here, before the model sees the pool: books outside
            // the allowed range, or of unknown length, never reach it (decision 2.25). The
            // grounding check then only accepts picks from this filtered pool.
            let pool = merged;
            if (length) {
              const filtered = await filterByLength(merged, length);
              pool = filtered.pool;
              toolTrace.add("E", { kind: "length_filter", ...filtered.stats });
            }
            recordSeenCandidates(seenCandidates, pool);
            // Sources and internal IDs (olWorkKey, hcBookId) stop here: the model's
            // tool_result shape is { title, author, subjects }.
            result = length
              ? {
                  pool: toModelPool(pool),
                  poolSize: pool.length,
                  // Tells the model why a pool may be small, so it searches more broadly.
                  note: "Only books of the reader's requested length are listed. If too few fit, search different subjects.",
                }
              : { pool: toModelPool(pool), poolSize: pool.length };
          }
        } catch (err) {
          result = {
            error: err instanceof Error ? err.message : "Tool call failed",
          };
          toolTrace.add("D", { kind: "error", tool: block.name, input: block.input, error: errorText(err) });
        }
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        };
      }),
    );

    messages.push({ role: "user", content: toolResults });
  }

  // Version C (decision 6.13): the search call's answer is the shortlist; the final choice runs
  // now and its picks go through the same checks below as a one-call selection's.
  if (mode === "shortlist" && data?.stop_reason === "end_turn" && !(length && seenCandidates.size < 3)) {
    const stage = await chooseFromShortlist(tasteDescription, data, seenCandidates, trace, avoid);
    if (stage.kind === "rejected") return { ok: true, status: "rejected", detail: stage.detail };
    if (stage.kind === "error") return { ok: false, status: 502, body: errorBody("upstream_error", "The recommendation service is unavailable. Please try again.") };
    data = stage.data;
    outcomes = stage.outcomes;
  }

  // Every pick pipeline settles (they never reject), so nothing is left running unobserved.
  const settled = await Promise.all(outcomes);

  // Give up fast (decision 2.25): if the length filter left fewer than 3 books across all the
  // searching, no attempt can succeed, so say so now instead of retrying the whole search.
  if (length && seenCandidates.size < 3) {
    trace.add("F", { kind: "not_enough_books", length, candidatesShown: seenCandidates.size });
    return {
      ok: false,
      status: 422,
      body: errorBody("not_enough_books", "Not enough books of that length matched this request; a different length may help"),
    };
  }

  // Structured outputs only guarantee the schema on a finished answer: a cut-off or refused
  // one is rejected.
  if (data?.stop_reason !== "end_turn") {
    const detail = `final call stopped with stop_reason=${data?.stop_reason}`;
    trace.add("F", { kind: "rejected", reason: detail, candidatesShown: seenCandidates.size });
    return { ok: true, status: "rejected", detail };
  }

  const textBlock = data?.content?.find(
    (block: { type: string }) => block.type === "text",
  );
  const answerText = String(textBlock?.text ?? "");
  const countProblem = validateSelectionCount(answerText);
  const checkedPicks = settled.map((o) => o.checked).filter((c): c is CheckedPick => !!c);
  const grounding: GroundingResult = {
    status: checkedPicks.length === settled.length && checkedPicks.every((c) => c.sources.length > 0) ? "grounded" : "ungrounded",
    picks: checkedPicks,
  };
  const ready = settled.filter((o): o is Extract<PickOutcome, { ok: true }> => o.ok);
  const selected = ready.map((o) => o.selected);
  trace.add("F", {
    kind: "result",
    status: grounding.status,
    candidatesShown: seenCandidates.size,
    answerText,
    picks: grounding.picks,
    duplicateMoods: duplicateMoods(selected),
  });

  const problems = [
    ...(countProblem ? [countProblem] : []),
    ...settled.map((o, i) => (o.ok ? "" : `pick ${i + 1}: ${o.reason}`)).filter(Boolean),
  ];
  if (problems.length) return { ok: true, status: "rejected", detail: problems.join("; ") };

  // Mood words (decision 2.26): the card writer may replace the selector's word when the
  // records clearly contradict it, but the three must still differ, so a replacement that's
  // empty or would repeat another pick's mood falls back to the selector's word.
  const moods = finalMoods(ready.map((o) => ({ selector: o.selected.mood, card: o.card.mood })));
  trace.add("W", { kind: "moods", moods: ready.map((o, i) => ({ selector: o.selected.mood, card: o.card.mood, final: moods[i] })) });
  trace.add("W", { kind: "heads_up", kept: avoid.length > 0, notes: ready.map((o) => o.card.headsUp ?? "") });

  return {
    ok: true,
    status: "ready",
    // "Good to know" notes are kept only for readers with an avoid list (decision 2.26); for
    // everyone else they're dropped here, and the count shows how often picks miss the brief.
    picks: ready.map((o, i) => ({ ...o.selected, ...o.card, mood: moods[i], headsUp: avoid.length ? o.card.headsUp : undefined })),
    grounding,
    pickMetadata: ready.map((o) => o.metadata),
    overLimit: ready.flatMap((o, index) => o.overLimit.map((field) => ({ index, field, length: o.card[field].length }))),
  };
}

// Version C's second half (decision 6.13): read the finalists, look up their records, and stream
// the final choice. Picks start their pipelines as they arrive, grounded against the shortlist
// only, so a final pick can't come from outside it.
type ShortlistStage =
  | { kind: "ok"; data: Awaited<ReturnType<typeof streamModel>>["data"]; outcomes: Promise<PickOutcome>[] }
  | { kind: "rejected"; detail: string }
  | { kind: "error" };

async function chooseFromShortlist(
  tasteDescription: string,
  searchAnswer: { content?: unknown[] },
  seen: SeenCandidates,
  trace: RequestTrace,
  avoid: string[],
): Promise<ShortlistStage> {
  const text = String((searchAnswer.content as Array<{ type: string; text?: string }> | undefined)?.find((b) => b.type === "text")?.text ?? "");
  const shortlist = readShortlist(text, seen);
  if (shortlist.finalists.length < 3) {
    const detail = `shortlist had ${shortlist.finalists.length} grounded finalists of ${shortlist.listed} listed`;
    trace.add("S", { kind: "rejected", reason: detail, ungrounded: shortlist.ungrounded });
    return { kind: "rejected", detail };
  }

  const lookupStart = performance.now();
  const metadata = await lookupFinalists(shortlist.finalists);
  const lookupMs = Math.round(performance.now() - lookupStart);
  const { text: shortlistText, stats } = formatFinalists(shortlist.finalists, metadata);
  console.log(
    `shortlist: ${stats.finalists} finalists (asked for ${SHORTLIST_SIZE}; ${shortlist.listed} listed, ${shortlist.ungrounded.length} ungrounded, ${shortlist.duplicates} repeated, ${shortlist.overCap} over the cap) · ${stats.withDescription} with a description · ${stats.withMoods} with mood tags · lookup ${lookupMs}ms`,
  );
  // The finalist log (decision 6.13): which books made the cut, for measuring whether good books
  // are cut too early.
  trace.add("S", {
    kind: "shortlist",
    asked: SHORTLIST_SIZE,
    listed: shortlist.listed,
    ungrounded: shortlist.ungrounded,
    duplicates: shortlist.duplicates,
    overCap: shortlist.overCap,
    lookupMs,
    ...stats,
    finalists: shortlist.finalists.map((f, i) => ({
      title: f.title,
      author: f.author,
      sources: f.sources,
      lookups: metadata[i].lookups.map((l) => ({ source: l.source, status: l.status, hasDescription: !!l.description.trim() })),
    })),
  });

  const restricted = shortlistAsSeen(shortlist.finalists);
  const body = finalChoiceRequest(tasteDescription, shortlistText);
  const outcomes: Promise<PickOutcome>[] = [];
  const arrivedTitles: string[] = [];
  const callStart = performance.now();
  const scan = createPickScanner((raw, index) => {
    const earlierTitles = arrivedTitles.slice();
    const title = (raw as { poolTitle?: unknown } | null)?.poolTitle;
    if (typeof title === "string" && title.trim()) arrivedTitles.push(title.trim());
    outcomes.push(runPick(tasteDescription, raw, index, restricted, earlierTitles, trace, avoid));
  });
  const streamed = await streamModel(body, scan);
  trace.modelCall("S", { model: body.model, request: body, response: streamed.data, httpStatus: streamed.status, ms: Math.round(performance.now() - callStart) });
  if (!streamed.ok) {
    console.error(`recommend: Anthropic API error ${streamed.status} in the final choice: ${JSON.stringify(streamed.data?.error ?? streamed.data).slice(0, 300)}`);
    return { kind: "error" };
  }
  return { kind: "ok", data: streamed.data, outcomes };
}

export function finalMoods(picks: Array<{ selector: string; card: string }>): string[] {
  const chosen = picks.map((p) => (p.card ? p.card : p.selector));
  return chosen.map((m, i) => {
    const clash = chosen.some((other, j) => j !== i && other.toLowerCase() === m.toLowerCase());
    return clash && m !== picks[i].selector ? picks[i].selector : m;
  });
}

// One pick's pipeline, started the moment its object arrives in the selection stream:
// contract check, grounding, catalog lookup, card. Never rejects; a failure is an outcome.
// `earlierTitles` are the pool titles of picks that arrived before this one, taken straight
// from the stream (never from their cards, so no card waits on another), so this card's
// angle can differ from theirs.
async function runPick(
  tasteDescription: string,
  raw: unknown,
  index: number,
  seen: SeenCandidates,
  earlierTitles: string[],
  trace: RequestTrace,
  avoid: string[] = [],
): Promise<PickOutcome> {
  const pickTrace = trace.with({ pick: index });
  try {
    const v = validateSelectedPick(raw);
    if (v.status === "invalid") return { ok: false, reason: `breaks the output contract: ${v.problems.join("; ")}` };
    const selected = v.pick;
    const [checked] = checkPickGrounding([{ title: selected.poolTitle, author: selected.poolAuthor }], seen).picks;
    if (checked.sources.length === 0) return { ok: false, reason: "ungrounded", checked };

    const lookupStart = performance.now();
    const [metadata] = await lookupPickMetadata([checked]);
    const lookupMs = Math.round(performance.now() - lookupStart);
    console.log(formatPickMetadata([metadata], lookupMs));
    pickTrace.add("G", { kind: "result", ms: lookupMs, picks: [metadata] });

    const card = await writeCard(tasteDescription, selected, checked, metadata, earlierTitles, pickTrace, avoid);
    pickTrace.add("W", { kind: "result", ...card });
    if (!card.ok) return { ok: false, reason: `card writing failed: ${card.error}`, checked };
    return { ok: true, selected, checked, metadata, card: card.card, overLimit: card.overLimit };
  } catch (err) {
    return { ok: false, reason: `pick pipeline failed: ${errorText(err)}` };
  }
}
