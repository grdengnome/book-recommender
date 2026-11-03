// Output format (stage I) — the contract between the engine and the screens, spec.md §4b.
//
// Choosing and writing are separate steps (fix PR 1, speed, 2026-10-21). The final call of
// the search loop only selects: three pool entries and a one-line note each. The cards are
// then written by three parallel calls (writeCards.ts), which keeps the slow prose off the
// selection call; on the first after-run, writing was ~10s of a ~25s final call.
//
// Both answers are constrained with structured outputs (output_config.format, a JSON
// schema), so the API itself guarantees JSON of these shapes: no code fences, no prose. A
// forced tool call would also guarantee a shape, but the API doesn't allow forcing a tool
// while thinking is on, and Sonnet 5 thinks by default. Length targets can't go in the
// schema (structured outputs drop maxLength), so they're stated in the field descriptions
// and the prompts, and enforced in code (validatePicks.ts).

const field = (description: string) => ({ type: "string", description });

// What the selection call returns per pick. poolTitle/poolAuthor are the pool's own strings,
// copied exactly, for the grounding check. fitNote is internal: it carries the selection
// call's reason to the card writer and never reaches the client. `mood` is chosen here, not
// by the card writers, because only the selection call sees all three picks and can keep
// their moods distinct (cards written separately repeated them: "haunting" ×2, Oct 21).
export interface SelectedPick {
  poolTitle: string;
  poolAuthor: string;
  fitNote: string;
  mood: string;
}

export const SELECTION_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["picks"],
    properties: {
      picks: {
        type: "array",
        description: "Exactly 3 picks, each selected from the retrieved candidate pools.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["poolTitle", "poolAuthor", "fitNote", "mood"],
          properties: {
            poolTitle: field("The title exactly as it appears in the candidate pool."),
            poolAuthor: field("The author exactly as it appears in the candidate pool."),
            fitNote: field("One short sentence on why this book fits this reader."),
            mood: field("One word for this book's mood, different from the other picks' moods."),
          },
        },
      },
    },
  },
} as const;

// What a card-writing call returns for one pick.
export interface CardText {
  title: string;
  author: string;
  hook: string;
  why: string;
  angleHeading: string;
  angleText: string;
}

export const CARD_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "author", "hook", "why", "angleHeading", "angleText"],
    properties: {
      title: field("English display title, cleaned of series or edition notes."),
      author: field('Author as "First Last" in English transliteration, no stress marks.'),
      hook: field("One short line for the revealed book, about 90 characters or fewer."),
      why: field("Why it's for this reader, tied to their stated taste. About 2 sentences."),
      angleHeading: field("Heading written for this pick, about 5 words (30 characters)."),
      angleText: field("That section's body. About 2 sentences."),
    },
  },
} as const;

// A grounded pick with its written card: what shortening and the description check work on.
// Never sent to the client as-is: toClientPick below maps it to the contract.
export type ModelPick = SelectedPick & CardText;

// spec.md §4b field table. Fields the engine can't fill yet are null; later PRs fill them
// (cover chain, ISBN, find link, catalog year/pages/format, story, source). `format` falls
// back to "paperback" per the table. `rarity` is an open question (decisions.md §12) and is
// left out.
export interface Pick {
  title: string;
  originalTitle: string | null;
  subtitle: string | null;
  author: string;
  year: number | null;
  pages: number | null;
  format: "paperback" | "hardcover";
  coverUrl: string | null;
  isbn: string | null;
  findLink: string | null;
  hook: string;
  why: string;
  story: string | null;
  angleHeading: string;
  angleText: string;
  mood: string;
  source: string | null;
}

export function toClientPick(p: ModelPick): Pick {
  return {
    title: p.title,
    originalTitle: null,
    subtitle: null,
    author: p.author,
    year: null,
    pages: null,
    format: "paperback",
    coverUrl: null,
    isbn: null,
    findLink: null,
    hook: p.hook,
    why: p.why,
    story: null,
    angleHeading: p.angleHeading,
    angleText: p.angleText,
    mood: p.mood,
    source: null,
  };
}
