// Card writing (fix PR 1, speed, 2026-10-21). Once the selection call has picked a grounded
// book, one call writes its card text. route.ts streams the selection and starts each
// pick's lookup and card as soon as that pick arrives, so the three cards overlap the rest
// of the selection and each other. Writing was ~10s of the combined final call.
//
// Each call sees the reader's taste, its book (pool title/author/subjects), the book's
// catalog records from the pick lookup (descriptions, subjects, Hardcover genres and moods),
// the selection call's fit note and mood, and the titles of the picks that arrived before it
// so the angles differ (the first card can't know the later picks). Thinking is off: this is
// writing to a brief, not choosing. The books themselves never change here; which books are
// picked is decided entirely by the selection call.
//
// A card that fails (API error, timeout, cut off, an empty field) is retried once on its
// own. If it fails again the whole attempt fails, like any other missing required field,
// and route.ts re-runs the generation. Length overflow is not a failure (validatePicks.ts).
import type { CheckedPick } from "../merge/pickGrounding";
import type { PickMetadata } from "../verify/lookupPickMetadata";
import { CARD_FORMAT, type CardText, type SelectedPick } from "./pickSchema";
import { validateCard, type LimitedField } from "./validatePicks";
import { noopTrace, type RequestTrace } from "../trace/requestTrace";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// Same model as the selection call; only thinking differs.
const CARD_MODEL = "claude-sonnet-5";
const CARD_TIMEOUT_MS = 20000;
const CARD_MAX_TOKENS = 1000;
const CARD_TRIES = 2;
const DESCRIPTION_MAX_CHARS = 1200;
const SUBJECTS_MAX = 20;

const CARD_SYSTEM_PROMPT = `You write the card for one book recommendation. The book has already been chosen for this reader; your job is to tell them why, in a few short pieces of text.

Write these fields:
- "title": the book's English display title, without series or edition notes such as "(Penguin Classics)". If the catalog title is in another language or script, give the book's established English title, keeping the accents that title uses in English.
- "author": the author's name as "First Last", in a standard English transliteration, without stress marks.
- "hook": one short line that makes the reader want to open the book, about 90 characters or fewer.
- "why": why this book is for this reader, tied to specifics in their stated taste. About 2 sentences.
- "angleHeading": a heading for a section on why this pick genuinely fits rather than being a reflexive/default choice, written for this book (e.g. "Shelved in the wrong aisle"), not a generic label. About 5 words, 30 characters at most.
- "angleText": that section's body, about 2 sentences. Don't state specific claims about a book's reception, fame, or obscurity unless you're confident they're accurate — if unsure, describe what makes the book fit rather than making a comparative claim about how well-known it is.

What you say the book is and contains must agree with the catalog records given. Where they are silent, keep claims general rather than inventing plot. The selector's note says why the book was chosen, and its mood word is shown on the card next to yours; build on both. Any other picks are listed only so your angle differs from theirs: don't mention them.

Don't use emoji. Keep to the lengths above.`;

interface CardFacts {
  descriptions: string[];
  subjects: string[];
  genres: string[];
  moods: string[];
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function cardFacts(record: CheckedPick["record"], meta: PickMetadata | undefined): CardFacts {
  const facts: CardFacts = { descriptions: [], subjects: [...(record?.subjects ?? [])], genres: [], moods: [] };
  for (const l of meta?.lookups ?? []) {
    if (l.status !== "ok") continue;
    if (l.description.trim()) facts.descriptions.push(truncate(l.description, DESCRIPTION_MAX_CHARS));
    if (l.source === "openlibrary") facts.subjects.push(...l.subjects);
    else {
      facts.genres.push(...l.genres);
      facts.moods.push(...l.moods);
    }
  }
  facts.subjects = [...new Set(facts.subjects)].slice(0, SUBJECTS_MAX);
  return facts;
}

function cardPrompt(tasteDescription: string, pick: SelectedPick, facts: CardFacts, otherTitles: string[]): string {
  const lines = [
    "<reader_taste>",
    tasteDescription,
    "</reader_taste>",
    "",
    "<book>",
    `catalog title: ${pick.poolTitle}`,
    `catalog author: ${pick.poolAuthor}`,
    `selector's note: ${pick.fitNote}`,
    `mood: ${pick.mood}`,
  ];
  for (const d of facts.descriptions) lines.push(`catalog description: ${d}`);
  if (facts.subjects.length) lines.push(`subjects: ${facts.subjects.join("; ")}`);
  if (facts.genres.length) lines.push(`Hardcover genres: ${facts.genres.join("; ")}`);
  if (facts.moods.length) lines.push(`Hardcover moods: ${facts.moods.join("; ")}`);
  lines.push("</book>");
  if (otherTitles.length) lines.push("", `<other_picks>${otherTitles.join("; ")}</other_picks>`);
  return lines.join("\n");
}

type CardAttempt =
  | { ok: true; card: CardText; overLimit: LimitedField[] }
  | { ok: false; error: string };

async function callCard(apiKey: string, prompt: string, trace: RequestTrace): Promise<CardAttempt> {
  const requestBody = {
    model: CARD_MODEL,
    max_tokens: CARD_MAX_TOKENS,
    thinking: { type: "disabled" },
    system: CARD_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: CARD_FORMAT },
  };
  const start = performance.now();
  let recorded = false;
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(CARD_TIMEOUT_MS),
    });
    const data = await res.json();
    trace.modelCall("W", { model: CARD_MODEL, request: requestBody, response: data, httpStatus: res.status, ms: Math.round(performance.now() - start) });
    recorded = true;
    if (!res.ok) return { ok: false, error: `Anthropic API error ${res.status}: ${JSON.stringify(data?.error ?? data).slice(0, 200)}` };
    if (data?.stop_reason !== "end_turn") return { ok: false, error: `stop_reason=${data?.stop_reason}` };
    const text = data?.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
    const v = validateCard(JSON.parse(text));
    if (v.status === "invalid") return { ok: false, error: v.problems.join("; ") };
    return { ok: true, card: v.card, overLimit: v.overLimit };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    const error =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
        ? `timeout after ${CARD_TIMEOUT_MS}ms`
        : err instanceof Error ? err.message : String(err);
    if (!recorded) trace.modelCall("W", { model: CARD_MODEL, request: requestBody, ms, error });
    return { ok: false, error };
  }
}

export type WriteCardResult = (CardAttempt & { tries: number; ms: number });

// `checked` and `metadata` describe this pick: its grounding record and catalog lookup.
export async function writeCard(
  apiKey: string,
  tasteDescription: string,
  pick: SelectedPick,
  checked: CheckedPick,
  metadata: PickMetadata | undefined,
  otherTitles: string[],
  trace: RequestTrace = noopTrace,
): Promise<WriteCardResult> {
  const start = performance.now();
  const prompt = cardPrompt(tasteDescription, pick, cardFacts(checked.record, metadata), otherTitles);
  let last: CardAttempt = { ok: false, error: "not run" };
  for (let tryNo = 1; tryNo <= CARD_TRIES; tryNo++) {
    last = await callCard(apiKey, prompt, trace.with({ try: tryNo }));
    if (last.ok) return { ...last, tries: tryNo, ms: Math.round(performance.now() - start) };
  }
  return { ...last, tries: CARD_TRIES, ms: Math.round(performance.now() - start) };
}
