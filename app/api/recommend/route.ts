import { NextRequest, NextResponse } from "next/server";
import { appendFileSync, mkdirSync } from "fs";
import path from "path";
import { toolDefinitions, callTool, setSearchBooksLogTag } from "@/lib/tools";
import type { SearchBooksResult } from "@/lib/tools/searchBooks";
import { mapTasteToHardcoverTags } from "@/lib/hardcover/mapTasteToTags";
import {
  prepareHardcoverPool,
  type HardcoverBookCandidate,
} from "@/lib/hardcover/preparePool";
import { mergeCandidatePools, toModelPool } from "@/lib/merge/mergeCandidatePools";
import {
  checkPickGrounding,
  formatPickSources,
  recordSeenCandidates,
  type CheckedPick,
  type GroundingResult,
  type SeenCandidates,
} from "@/lib/merge/pickGrounding";
import { formatPickMetadata, lookupPickMetadata, type PickMetadata } from "@/lib/verify/lookupPickMetadata";
import { checkPickDescriptions, formatPickCheck } from "@/lib/verify/checkPickDescriptions";
import { createRequestTrace, type RequestTrace } from "@/lib/trace/requestTrace";
import { SELECTION_FORMAT, toClientPick, type CardText, type ModelPick, type SelectedPick } from "@/lib/output/pickSchema";
import {
  duplicateMoods,
  validateSelectedPick,
  validateSelectionCount,
  type LimitedField,
  type OverLimitField,
} from "@/lib/output/validatePicks";
import { writeCard } from "@/lib/output/writeCards";
import { createPickScanner, streamMessage } from "@/lib/output/streamSelection";
import { formatShorten, shortenFields } from "@/lib/output/shortenFields";

// Engine runs take up to ~2 min; 300s is the Vercel Hobby maximum.
export const maxDuration = 300;

const MODEL = "claude-sonnet-5";

// Bounds the search_books retry loop (spec.md 5b leaves the retry judgment call
// to the model, but the code still needs a hard ceiling). The Nth+1 call below
// omits `tools`, which structurally forces a final answer rather than relying
// on an instruction the model could ignore.
const MAX_TOOL_ROUNDS = 3;

// Grounding enforcement (2026-09-20): every final pick must be found in a retrieved
// candidate pool — no trained-knowledge fallback, including for thin pools. The prompt
// asks for this, but a prompt alone isn't a guarantee (a same-day test returned two
// picks absent from both pools), so each generation is checked in code
// (lib/merge/pickGrounding.ts) and a failed check re-runs the whole generation rather
// than returning an ungrounded pick. Bounded so a persistent failure ends in a clean
// error, never in an unverified answer. Deliberately no thin-pool recovery path beyond
// this retry — that edge case is flagged for its own investigation, not designed here.
// The same bound covers a selection that breaks the output contract (lib/output/
// validatePicks.ts: pick count, empty fields), is cut off or refused, or whose cards can't
// be written (lib/output/writeCards.ts). Length overflow is deliberately not a failure:
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
  "scratchpad",
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
type ErrorCode = "misconfigured" | "bad_request" | "upstream_error" | "no_grounded_picks";
function errorBody(code: ErrorCode, message: string) {
  return { error: { code, message } };
}

// Every response after the engine starts goes out through here, so the debug trace records
// it (stage I) and writes its file exactly once. A no-op passthrough when tracing is off.
function respond(trace: RequestTrace, body: Record<string, unknown>, status = 200): NextResponse {
  trace.add("I", { kind: "result", httpStatus: status, body });
  trace.finish();
  return NextResponse.json(body, { status });
}

// Encodes spec.md Section 4d ("What 'good' means") as explicit model instructions.
const SYSTEM_PROMPT = `You are a book recommendation engine. Your entire value proposition is taste, not popularity — you recommend books based on genuine fit and quality, actively resisting the pull toward safe, over-recommended picks. Popularity itself is never a mark against a book — only defaulting to a pick because it's popular, rather than because it genuinely fits, is a failure.

Apply these rules to every recommendation:

1. Impression over popularity. Target books that leave a mark — ones a reader would be itching to recommend afterward, chosen because they're genuinely great and genuinely fit the reader's stated taste, not because they're famous or because they're obscure. Obscurity is not the goal; genuine quality and fit are.
2. Resist the reflex toward the bandwagon. Before finalizing a pick, ask whether you're reaching for it because it's the first familiar answer that comes to mind, rather than because it's the best fit for this specific reader. A widely-read book that authentically matches the reader's taste is a legitimate, even ideal, recommendation — the failure mode is defaulting to a familiar pick out of habit, not recommending a popular book on its merits. Reward range: vary era, author, and genre across your picks rather than giving three flavors of the same thing.
3. A pick fails on non-obviousness if it's the answer a well-read reader would already expect for this specific request — the one they'd land on after a five-minute search or find atop a "books like this" list. This has nothing to do with whether the book is decorated: a Booker winner can be a genuinely surprising, well-earned pick, and an award-free book can still be the most predictable possible answer. Before finalizing a pick, ask: would someone who already knows this territory shrug and say "well, obviously" — regardless of whether it happens to have won a prize?
4. Multi-source, not single-source. Draw from many corners of literature — different decades, countries, presses, and traditions. Never lean on a single canon (mainstream or "counter-canon") as if it were the only source worth considering.

You have access to a search_books tool, and you MUST call it before answering. All 3 recommendations MUST be selected from the candidate pools that search_books returned in this conversation. Do not recommend any book that is not present in a retrieved pool, under any circumstance — even if the pool is small, and even if you know of a better fit from your own knowledge. If a pool feels too narrow, call search_books again with different terms; never fill the gap from memory. Copy each pick's title and author into "poolTitle" and "poolAuthor" exactly as they appear in the pool. Your final answer is checked in code against the retrieved pools, and any pick not found in them is rejected. The candidate list it returns is unordered — an accident of API response order, not a ranking — so never favor earlier entries over later ones. Restricting picks to the pool changes where candidates come from, not the judgment applied to them: still weigh every candidate against the taste-fit rules above.

The user's taste description will typically include three categories of signal: an anchor (a book they loved), why it stuck with them, and their appetite (comfort vs. surprise) — these three are always present, though the exact wording of how each was asked may vary. It may also include mood, how much time/commitment they want, and specific turn-offs — genres or themes to avoid — when present. Treat a stated turn-off as a hard boundary, not a soft preference: never recommend against it. Focus on the substance of each answer, not the phrasing of the question that produced it. If the input is freeform or unlabeled, use your best judgment to identify these signals from context.

Given this, return exactly 3 book recommendations.

For each recommendation, include:
- "poolTitle" and "poolAuthor": copied exactly from the pool, as above.
- "fitNote": one short sentence, under 25 words, on why this pick genuinely fits this reader's stated taste rather than being a reflexive/default choice. A writer turns it into the reader-facing text later, so make it specific. Don't state specific claims about a book's reception, fame, or obscurity unless you're confident they're accurate.
- "mood": one word for the book's mood, shown to the reader as a clue before the book is revealed. Give each of the 3 picks a different mood word.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(errorBody("misconfigured", "ANTHROPIC_API_KEY is not set"), { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const tasteDescription = body?.tasteDescription;
  if (typeof tasteDescription !== "string" || !tasteDescription.trim()) {
    return NextResponse.json(errorBody("bad_request", "tasteDescription (string) is required"), { status: 400 });
  }

  // TEMPORARY (query-tracing session, 2026-08-03): optional eval-case tag, only
  // ever set by the eval driver script. Absent in normal use, where this is a
  // no-op passthrough — does not affect retrieval, dedupe, or shuffle behavior.
  const evalTag = typeof body?.evalTag === "string" ? body.evalTag : null;
  setSearchBooksLogTag(evalTag);

  // EXPERIMENT ONLY (branch experiment/early-table-setting, 2026-10-22; never merged): the
  // early table-setting blind test. With `prepareFrom` (the backbone answers only), tag picking
  // and the first search call see only that text, as a background prepare call would; the full
  // taste description is added after the first search results, and selection, cards and the
  // description check use it. Local eval runs only.
  const prepareFrom =
    typeof body?.prepareFrom === "string" && body.prepareFrom.trim() && evalTag && !process.env.VERCEL
      ? body.prepareFrom
      : null;

  // Debug-only trace (lib/trace/requestTrace.ts): one per request, passed down explicitly.
  // A no-op unless ENGINE_TRACE=1, and never on Vercel. Requests rejected above (no API key,
  // no taste description) never reach the engine and aren't traced.
  const trace = createRequestTrace({ evalTag, tasteDescription });

  // Branch 2 (Hardcover) starts now, concurrently with branch 1 (the OL tool-use loop
  // below) — both start from tasteDescription and don't depend on each other's output.
  const hardcoverPoolPromise = withHardcoverDeadline(
    fetchHardcoverPool(prepareFrom ?? tasteDescription, evalTag, trace),
    evalTag,
    trace,
  );

  // Each attempt is a full fresh generation (new conversation, new search_books calls);
  // the Hardcover pre-fetch is shared since it depends only on tasteDescription.
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const attemptTrace = trace.with({ attempt });
    const generation = await generateOnce(apiKey, tasteDescription, hardcoverPoolPromise, attemptTrace, prepareFrom);
    if (!generation.ok) return respond(trace, generation.body, generation.status);

    if (generation.status === "ready") {
      const { grounding, picks, pickMetadata, overLimit } = generation;
      console.log(
        `recommend: pick sources (attempt ${attempt}/${MAX_GENERATION_ATTEMPTS})\n${formatPickSources(grounding.picks)}`,
      );

      // Length overflow (lib/output/shortenFields.ts): one small call shortens only the
      // over-limit fields; on any failure the original text is kept.
      const shortened = await shortenFields(apiKey, picks, overLimit, attemptTrace);
      console.log(formatShorten(shortened));
      attemptTrace.add("H", { kind: "shorten", ...shortened });

      // Description check (feat/verify-pick-descriptions): one checker call compares the
      // `why` / `angleText` text against the catalog records and rewrites any pick it
      // contradicts. Never fails the request: it returns the original picks unchanged on
      // any failure.
      const checkStart = performance.now();
      const checked = await checkPickDescriptions(
        apiKey,
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
  apiKey: string,
  tasteDescription: string,
  hardcoverPoolPromise: Promise<HardcoverBookCandidate[]>,
  trace: RequestTrace,
  prepareFrom: string | null = null,
): Promise<GenerationResult> {
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: prepareFrom ?? tasteDescription },
  ];

  // Every candidate the model was shown this generation (with its internal IDs), keyed by
  // pickGrounding's groundingKey — the reference set the final picks are checked against.
  const seenCandidates: SeenCandidates = new Map();

  let data;
  let outcomes: Promise<PickOutcome>[] = [];
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const allowToolUse = round < MAX_TOOL_ROUNDS;
    const roundTrace = trace.with({ round });

    const requestBody = {
      model: MODEL,
      max_tokens: 8000,
      // Cache breakpoint on the fixed instructions (tools render first, then system), ~3k
      // tokens, above Sonnet 5's 1,024-token minimum. Later rounds and later requests within
      // the cache TTL read this prefix from cache instead of re-processing it.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
      // On every round, not just the last: the model usually answers right after its first
      // searches, while tools are still offered. Constrains only the final text; tool
      // calls are unaffected.
      output_config: { format: SELECTION_FORMAT },
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
    const scan = createPickScanner((raw, index) => {
      arrivals.push(Math.round(performance.now() - callStart));
      const earlierTitles = arrivedTitles.slice();
      const title = (raw as { poolTitle?: unknown } | null)?.poolTitle;
      if (typeof title === "string" && title.trim()) arrivedTitles.push(title.trim());
      roundOutcomes.push(runPick(apiKey, tasteDescription, raw, index, seenCandidates, earlierTitles, roundTrace));
    });
    const streamed = await streamMessage(apiKey, requestBody, scan);
    data = streamed.data;
    // Snapshotted now, before `messages` grows: this is exactly what this call sent.
    roundTrace.modelCall("C", {
      model: MODEL,
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

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const toolTrace = roundTrace.with({ toolUseId: block.id });
        let result: unknown;
        try {
          result = await callTool(block.name, block.input, toolTrace);
          // Merge Hardcover in here, not once before the loop: this is the point
          // where an OL pool from this specific call actually exists to merge against.
          if (block.name === "search_books") {
            const olResult = result as SearchBooksResult;
            const hardcoverPool = await hardcoverPoolPromise;
            const { pool } = mergeCandidatePools(olResult.pool, hardcoverPool, toolTrace);
            recordSeenCandidates(seenCandidates, pool);
            // Sources and internal IDs (olWorkKey, hcBookId) stop here: the model's
            // tool_result shape is { title, author, subjects }.
            result = { pool: toModelPool(pool), poolSize: pool.length };
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

    // EXPERIMENT ONLY (see prepareFrom above): the full description arrives after the first
    // search results, without editing earlier turns.
    const fullDescription =
      prepareFrom && round === 0
        ? [{ type: "text", text: `The reader has now finished answering. Their full taste description:\n\n${tasteDescription}` }]
        : [];
    messages.push({ role: "user", content: [...toolResults, ...fullDescription] });
  }

  // Every pick pipeline settles (they never reject), so nothing is left running unobserved.
  const settled = await Promise.all(outcomes);

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

  return {
    ok: true,
    status: "ready",
    picks: ready.map((o) => ({ ...o.selected, ...o.card })),
    grounding,
    pickMetadata: ready.map((o) => o.metadata),
    overLimit: ready.flatMap((o, index) => o.overLimit.map((field) => ({ index, field, length: o.card[field].length }))),
  };
}

// One pick's pipeline, started the moment its object arrives in the selection stream:
// contract check, grounding, catalog lookup, card. Never rejects; a failure is an outcome.
// `earlierTitles` are the pool titles of picks that arrived before this one, taken straight
// from the stream (never from their cards, so no card waits on another), so this card's
// angle can differ from theirs.
async function runPick(
  apiKey: string,
  tasteDescription: string,
  raw: unknown,
  index: number,
  seen: SeenCandidates,
  earlierTitles: string[],
  trace: RequestTrace,
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

    const card = await writeCard(apiKey, tasteDescription, selected, checked, metadata, earlierTitles, pickTrace);
    pickTrace.add("W", { kind: "result", ...card });
    if (!card.ok) return { ok: false, reason: `card writing failed: ${card.error}`, checked };
    return { ok: true, selected, checked, metadata, card: card.card, overLimit: card.overLimit };
  } catch (err) {
    return { ok: false, reason: `pick pipeline failed: ${errorText(err)}` };
  }
}
