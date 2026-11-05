// The taste profile contract (decision 2.24): what the question flow hands the engine.
// Spec: docs/product/question-flow/taste-profile.md. The slot list, firmness and wording live
// as data in lib/engine/profile/slots.ts; this file is only the shape.
//
// Three layers, so nothing the reader did is lost to a summary: slots (our organised read),
// answers (what the reader actually chose or typed, word for word), and extras (signals no slot
// covers). Every slot is optional; an empty slot is left out of the brief.

export const PROFILE_VERSION = 1;

// Where a slot value came from, and how sure we are. Inferred values carry less weight, and
// "avoid" can never be inferred (only the reader can rule something out).
export type SlotSource = "asked" | "inferred" | "typed";
export type SlotConfidence = "partial" | "clear";

export interface SlotValue<T> {
  value: T;
  source: SlotSource;
  confidence: SlotConfidence;
}

export type Doorway = "loved" | "feeling" | "ingredient" | "moment" | "surprise";
export type LovedMedium = "book" | "show" | "film" | "comic" | "game" | "other";
export type Hook = "people" | "world" | "twists" | "writing" | "feeling";

export interface LovedItem {
  title: string;
  creator?: string;
  medium: LovedMedium;
  hooked?: Hook[];
  // The reader's "but…": darker, shorter, less bleak, funnier…
  twist?: string;
}

export interface MoodValue {
  words: string[];
  // 1 = a hint … 5 = wreck me
  intensity?: 1 | 2 | 3 | 4 | 5;
}

export interface ProfileSlots {
  loved?: SlotValue<LovedItem[]>;
  ingredients?: SlotValue<string[]>;
  mood?: SlotValue<MoodValue>;
  pace?: SlotValue<"page-turner" | "steady" | "slow">;
  focus?: SlotValue<"people" | "plot" | "both">;
  style?: SlotValue<Array<"spare" | "lush" | "witty">>;
  setting?: SlotValue<string[]>;
  ideas?: SlotValue<"think" | "escape" | "both">;
  ending?: SlotValue<"happy" | "bittersweet" | "gut-punch" | "open">;
  familiarity?: SlotValue<"familiar" | "neutral" | "surprising">;
  published?: SlotValue<"recent" | "modern" | "classic">;
  series?: SlotValue<"standalone" | "series-ok">;
  moment?: SlotValue<string>;
  category?: SlotValue<"fiction" | "nonfiction">;
  audience?: SlotValue<"adult" | "young-adult" | "children">;
  length?: SlotValue<"quick" | "short" | "medium" | "long">;
  avoid?: SlotValue<string[]>;
}

export type SlotKey = keyof ProfileSlots;

// One question and the reader's answer, in their words. `typed` marks free text the reader
// wrote (always reader data, never instructions).
export interface ProfileAnswer {
  question: string;
  answer: string;
  typed?: boolean;
}

export interface TasteProfile {
  version: typeof PROFILE_VERSION;
  doorway?: Doorway;
  slots: ProfileSlots;
  answers: ProfileAnswer[];
  extras: string[];
}
