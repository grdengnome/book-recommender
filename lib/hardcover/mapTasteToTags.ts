// Taste description -> Hardcover tag IDs — spec.md Section 5b. Hardcover is a fixed
// pre-fetch (decided 2026-08-19, no adaptive retry), so this has to pick well in one
// shot: an LLM call, not a keyword/count heuristic.
//
// Design constraint (2026-08-20): `taggable_counts.count` is not a uniform
// trustworthiness signal. Forced-choice-widget tags are already excluded by
// tagExclusions.ts, but a second failure mode survives that filter — broad organic
// mood tags ("dark", "mysterious") carry inflated counts simply because widely-read
// books accumulate more tagging activity overall, not because they're a better fit.
// A naive "pick the highest-count matching tags" selector would systematically prefer
// those broad tags over more specific ones, collapsing different taste inputs onto the
// same 2-3 tags. Fixed structurally, not just by instruction: the candidate list handed
// to the model carries tag names only (no counts, shuffled order) — count literally
// isn't visible input to the selection, so it can't be leaned on even by accident.
import { HARDCOVER_TAG_VOCABULARY } from "./tagVocabulary";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";
const MIN_TAGS = 2;
const MAX_TAGS = 4;

export interface MapTasteToTagsResult {
  tagIds: number[];
  tagNames: string[];
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildPrompt(tasteDescription: string, candidateNames: string[]): string {
  return `A reader described the kind of book they want like this:

"${tasteDescription}"

Here is a list of tags from a book-tagging platform. Pick ${MIN_TAGS}-${MAX_TAGS} tags from this exact list that best represent this reader's taste:

${candidateNames.map((name) => `- ${name}`).join("\n")}

Many of these tags are broad, generic descriptors ("dark", "mysterious", "fiction") that could technically apply to a huge range of books. Others are much more specific to a particular texture, theme, or trope. When a more specific tag on the list genuinely fits the reader's description, prefer it over a broader one that only loosely applies — the goal is tags that distinguish this taste input from a different one, not tags that are safe to apply to almost anything. Don't force a fit: if nothing on the list is a good match for some aspect of the description, it's fine to leave that aspect unrepresented rather than reaching for a loosely-related tag.

Respond with ONLY a JSON array of the tag strings you picked, copied exactly as they appear in the list above — no prose before or after it.`;
}

function parseSelectedTags(responseText: string): string[] {
  // The "no prose before or after" instruction isn't always followed — seen in
  // practice with leading reasoning text ahead of the array (2026-08-20, Step 4
  // real-merge run). Extract the first [...] span rather than assuming the whole
  // trimmed response is valid JSON, same tolerance route.ts already applies to the
  // main recommendation response (strips code fences there; this goes one step
  // further since a bare fence strip isn't enough for leading prose).
  const match = responseText.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON array found in response: ${responseText}`);
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of tag strings");
  return parsed.filter((t): t is string => typeof t === "string");
}

export async function mapTasteToHardcoverTags(
  tasteDescription: string,
): Promise<MapTasteToTagsResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  // Shuffled every call: no positional bias toward whatever happened to be listed first.
  const shuffledVocabulary = shuffle([...HARDCOVER_TAG_VOCABULARY]);
  const prompt = buildPrompt(tasteDescription, shuffledVocabulary.map((t) => t.tag));

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic API error: ${JSON.stringify(data)}`);

  const textBlock = data.content?.find((block: { type: string }) => block.type === "text");
  const selected = parseSelectedTags(textBlock?.text ?? "[]");

  // Guard against hallucinated tag names: only accept exact matches against the
  // real vocabulary, so a malformed model response can't smuggle an invalid tag
  // through to the Hardcover query downstream.
  const byName = new Map(HARDCOVER_TAG_VOCABULARY.map((t) => [t.tag, t]));
  const matched = selected
    .map((name) => byName.get(name))
    .filter((t): t is (typeof HARDCOVER_TAG_VOCABULARY)[number] => t !== undefined);

  return {
    tagIds: matched.map((t) => t.id),
    tagNames: matched.map((t) => t.tag),
  };
}
