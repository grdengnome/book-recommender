// The settings sheet: which model does each AI job. These are current choices, never
// permanent ones (decision 14.3). Each job uses the model with the best balance of speed and
// quality for it, and a change is proven by that job's eval and timing before it goes live.
//
// To try a different model for one job without editing code, set its override, for example
// AI_SLOT_SELECTION=claude-opus-5-5 in .env.local (or in Vercel's settings). The model must
// be listed in lib/ai/models.ts; an unknown name is ignored with a warning and the default
// below is used.
import type { AiJob } from "../contracts/ai";

export interface AiSlot {
  model: string;
  // Override setting name, e.g. AI_SLOT_CARD_WRITING.
  envOverride: string;
  purpose: string;
}

export const AI_SLOTS: Record<AiJob, AiSlot> = {
  tagMapping: {
    model: "claude-sonnet-5",
    envOverride: "AI_SLOT_TAG_MAPPING",
    purpose: "Maps the reader's taste to Hardcover reader tags (lib/engine/sources/hardcover/mapTasteToTags.ts)",
  },
  selection: {
    model: "claude-sonnet-5",
    envOverride: "AI_SLOT_SELECTION",
    purpose: "Searches the catalogs and chooses the three picks, streamed (app/api/recommend/route.ts)",
  },
  cardWriting: {
    model: "claude-sonnet-5",
    envOverride: "AI_SLOT_CARD_WRITING",
    purpose: "Writes each pick's card text, thinking off (lib/engine/cards/writeCards.ts)",
  },
  shortening: {
    model: "claude-haiku-4-5",
    envOverride: "AI_SLOT_SHORTENING",
    purpose: "Shortens a card field that runs over its length limit (lib/engine/cards/shortenFields.ts)",
  },
  descriptionCheck: {
    model: "claude-haiku-4-5",
    envOverride: "AI_SLOT_DESCRIPTION_CHECK",
    purpose: "Checks flagged picks' card text against catalog facts (lib/engine/verify/checkPickDescriptions.ts)",
  },
  // Eval jobs (decision 3.8). The judge is a stronger model than the one choosing the picks, so
  // the engine isn't grading itself; the second judge cross-checks a sample.
  evalJudge: {
    model: "claude-opus-5-5",
    envOverride: "AI_SLOT_EVAL_JUDGE",
    purpose: "Scores each pick against the reader and the readiness bar (evals/judge/judge.ts)",
  },
  evalSecondJudge: {
    model: "claude-sonnet-5",
    envOverride: "AI_SLOT_EVAL_SECOND_JUDGE",
    purpose: "Cross-checks the judge on a sample of readers (evals/score.mts)",
  },
  evalBaseline: {
    model: "claude-sonnet-5",
    envOverride: "AI_SLOT_EVAL_BASELINE",
    purpose: "Plain 'recommend 3 books' with no catalogs, the baseline the engine must beat (evals/judge/baseline.ts)",
  },
};
