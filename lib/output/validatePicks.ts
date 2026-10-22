// Code-side checks on the structured answers (spec.md §4b): the selection call's picks and
// each written card. The schemas guarantee the shape; this checks what they can't: exactly
// 3 picks, no empty required field, and the length limits.
//
// Over-limit policy (decided 2026-10-21, fix PR 1): length overflow never fails a request
// and never re-runs the selection; only real failures do (an empty required field, a wrong
// pick count, ungrounded picks, a cut-off or refused answer). The prompt states the target
// lengths and code allows slack above them (LENGTH_CEILINGS). A field over its ceiling is
// reported in `overLimit`, and route.ts sends it to one small shortening call
// (shortenFields.ts); if that fails, the original text is kept. `mood` is the exception:
// when it isn't one word, the first word is kept, a clean cut. The first after-run had
// hook 113/116 against 110 and angleHeading 41/42 against 40, which is why the ceilings
// were widened to 120/45.
import type { CardText, SelectedPick } from "./pickSchema";

export const PICK_COUNT = 3;

// The final-step prompt's targets: hook ~90, angleHeading ~30 (about 5 words, decision
// 13.74), why and angleText ~2 sentences (~300 chars). shortenFields aims for these.
export const LENGTH_TARGETS = {
  hook: 90,
  angleHeading: 30,
  why: 300,
  angleText: 300,
} as const;

export const LENGTH_CEILINGS = {
  hook: 120,
  angleHeading: 45,
  why: 350,
  angleText: 350,
} as const;

const SELECTION_FIELDS = ["poolTitle", "poolAuthor", "fitNote", "mood"] as const;
const CARD_FIELDS = ["title", "author", "hook", "why", "angleHeading", "angleText"] as const;

export type LimitedField = keyof typeof LENGTH_CEILINGS;
export interface OverLimitField {
  index: number; // pick index
  field: LimitedField;
  length: number;
}

const strings = <K extends string>(raw: unknown, fields: readonly K[]): Record<K, string> =>
  Object.fromEntries(
    fields.map((f) => {
      const v = (raw as Record<string, unknown> | null)?.[f];
      return [f, typeof v === "string" ? v.trim() : ""];
    }),
  ) as Record<K, string>;

// First run of letters (any script), keeping inner hyphens/apostrophes: "bittersweet, quiet"
// → "bittersweet", "Slow-burning" stays whole.
function firstWord(mood: string): string {
  return mood.trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/u)?.[0] ?? "";
}

// One pick of the selection answer. Called per pick as the selection streams in (route.ts),
// so card writing can start before the whole answer has arrived; the pick count is checked
// once the answer is complete (validateSelectionCount).
export type SelectedPickValidation =
  | { status: "valid"; pick: SelectedPick; moodTrimmed: boolean }
  | { status: "invalid"; problems: string[] };

export function validateSelectedPick(raw: unknown): SelectedPickValidation {
  const pick = strings(raw, SELECTION_FIELDS);
  const problems = SELECTION_FIELDS.filter((f) => !pick[f]).map((f) => `${f} is empty`);
  const mood = firstWord(pick.mood);
  const moodTrimmed = mood !== pick.mood && mood !== "";
  if (!mood && pick.mood) problems.push("mood has no word");
  pick.mood = mood;
  return problems.length ? { status: "invalid", problems } : { status: "valid", pick, moodTrimmed };
}

export function validateSelectionCount(answerText: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(answerText);
  } catch {
    return "answer is not valid JSON";
  }
  const raw = (parsed as { picks?: unknown })?.picks;
  if (!Array.isArray(raw)) return "answer has no picks array";
  return raw.length === PICK_COUNT ? null : `expected ${PICK_COUNT} picks, got ${raw.length}`;
}

// Moods are meant to differ across the three picks (prompt and schema). A repeat is cosmetic,
// so it's recorded, never a failure.
export function duplicateMoods(picks: SelectedPick[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const p of picks) {
    const m = p.mood.toLowerCase();
    if (seen.has(m)) dupes.add(m);
    seen.add(m);
  }
  return [...dupes];
}

export type CardValidation =
  | { status: "valid"; card: CardText; overLimit: LimitedField[] }
  | { status: "invalid"; problems: string[] };

export function validateCard(raw: unknown): CardValidation {
  const card = strings(raw, CARD_FIELDS);
  const problems = CARD_FIELDS.filter((f) => !card[f]).map((f) => `${f} is empty`);
  const overLimit = (Object.keys(LENGTH_CEILINGS) as LimitedField[]).filter((f) => card[f].length > LENGTH_CEILINGS[f]);
  return problems.length ? { status: "invalid", problems } : { status: "valid", card, overLimit };
}
