// The slot settings sheet (decision 2.24): how firmly the engine treats each taste-profile slot,
// what it's called in the reader brief, and how each value is worded. Content as data: changing
// a slot's firmness, wording or the length bands is a change here, not in the brief writer.
// Firmness is a setting tuned by evidence (eval adherence and impact, then real readers), like a
// model choice in lib/ai/slots.ts. Spec: docs/product/question-flow/taste-profile.md.
import type { SlotKey } from "@/lib/contracts/tasteProfile";

// hard: never broken · strong: a strong preference · weighed: always considered, weighed
// together · context: background for the choice.
export type Firmness = "hard" | "strong" | "weighed" | "context";

export interface SlotSetting {
  label: string;
  firmness: Firmness;
  // How each fixed value is worded in the brief. Free-text slots have none.
  values?: Record<string, string>;
}

// Pages per length band. A book whose length is unknown is left out when a band is asked for.
export const LENGTH_BANDS: Record<"quick" | "short" | "medium" | "long", { min?: number; max?: number; words: string }> = {
  quick: { max: 200, words: "quick: up to 200 pages" },
  short: { min: 200, max: 300, words: "short: about 200 to 300 pages" },
  medium: { min: 300, max: 500, words: "medium: about 300 to 500 pages" },
  long: { min: 500, words: "long: over 500 pages" },
};

export const SLOT_SETTINGS: Record<SlotKey, SlotSetting> = {
  loved: { label: "Loved", firmness: "context" },
  ingredients: { label: "Should have", firmness: "weighed" },
  mood: { label: "Mood right now", firmness: "strong" },
  pace: { label: "Pace", firmness: "weighed", values: { "page-turner": "a page-turner", steady: "steady", slow: "slow and immersive" } },
  focus: { label: "People or plot", firmness: "weighed", values: { people: "the people matter most", plot: "things need to happen", both: "both people and plot" } },
  style: { label: "Writing style", firmness: "weighed", values: { spare: "spare and simple", lush: "lush and poetic", witty: "sharp and witty" } },
  setting: { label: "Setting or world", firmness: "weighed" },
  ideas: { label: "Think or escape", firmness: "weighed", values: { think: "make them think", escape: "let them escape", both: "both thinking and escape" } },
  ending: { label: "Ending feel", firmness: "weighed", values: { happy: "happy", bittersweet: "bittersweet", "gut-punch": "a gut-punch", open: "open" } },
  familiarity: { label: "Familiar or surprising", firmness: "context", values: { familiar: "familiar", neutral: "neutral", surprising: "surprising" } },
  published: { label: "Published", firmness: "weighed", values: { recent: "recent (the last few years)", modern: "modern (roughly the last 50 years)", classic: "a classic" } },
  series: { label: "Standalone or series", firmness: "strong", values: { standalone: "a standalone, not part of a series", "series-ok": "a series is fine" } },
  moment: { label: "Moment", firmness: "context" },
  category: { label: "Category", firmness: "hard", values: { fiction: "fiction only", nonfiction: "nonfiction only" } },
  audience: { label: "Audience", firmness: "hard", values: { adult: "written for adults", "young-adult": "written for young adults", children: "written for children" } },
  length: { label: "Length", firmness: "hard" },
  avoid: { label: "Avoid", firmness: "hard" },
};

export const MOOD_INTENSITY: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "a hint",
  2: "gentle",
  3: "clear",
  4: "strong",
  5: "full force",
};

export const DOORWAYS: Record<string, string> = {
  loved: "something they loved",
  feeling: "a feeling",
  ingredient: "an ingredient or world",
  moment: "a moment in their life",
  surprise: "surprise me",
};
