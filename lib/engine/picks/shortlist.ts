// Version C of the selection (decision 6.13): the search call lists about 30 finalists, code
// looks up each one's records, and a final call picks 3 with that information. This file holds
// the plain-code parts: reading the finalist list, writing the finalists out for the final call,
// and that call's request. The pipeline that runs them is in lib/engine/recommend.ts.
import { modelFor } from "@/lib/ai/gateway";
import { checkPickGrounding, type CheckedPick, type SeenCandidates } from "@/lib/engine/pool/pickGrounding";
import type { PickMetadata } from "@/lib/engine/verify/lookupPickMetadata";
import { SELECTION_FORMAT } from "./pickSchema";
import { FINAL_CHOICE_PROMPT, SHORTLIST_SIZE, SHORTLIST_SLACK } from "./selectionPrompts";

const DESCRIPTION_CHARS = 500;
const SUBJECTS_SHOWN = 8;

export interface Shortlist {
  finalists: CheckedPick[];
  listed: number; // entries the model returned
  ungrounded: string[]; // listed but not in any pool shown (dropped)
  duplicates: number; // listed twice (dropped)
  overCap: number; // grounded finalists past SHORTLIST_SIZE + SHORTLIST_SLACK (dropped)
}

// Reads the search call's answer. Every finalist must be in a pool the model was shown, the same
// grounding check as a final pick; anything else is dropped, never trusted.
export function readShortlist(answerText: string, seen: SeenCandidates): Shortlist {
  let entries: Array<{ poolTitle?: unknown; poolAuthor?: unknown }> = [];
  try {
    const parsed = JSON.parse(answerText);
    if (Array.isArray(parsed?.shortlist)) entries = parsed.shortlist;
  } catch {
    // An unreadable answer gives an empty shortlist, which the caller rejects.
  }
  const pairs = entries
    .filter((e) => typeof e?.poolTitle === "string" && typeof e?.poolAuthor === "string" && e.poolTitle.trim())
    .map((e) => ({ title: (e.poolTitle as string).trim(), author: (e.poolAuthor as string).trim() }));
  const { picks } = checkPickGrounding(pairs, seen);
  const keys = new Set<string>();
  const finalists: CheckedPick[] = [];
  const ungrounded: string[] = [];
  let duplicates = 0;
  for (const p of picks) {
    if (!p.record || !p.groundingKey) {
      ungrounded.push(`${p.title} — ${p.author}`);
      continue;
    }
    if (keys.has(p.groundingKey)) {
      duplicates++;
      continue;
    }
    keys.add(p.groundingKey);
    finalists.push(p);
  }
  // A runaway list would mean dozens of lookups and a long final message: keep the first ones.
  const cap = SHORTLIST_SIZE + SHORTLIST_SLACK;
  const overCap = Math.max(0, finalists.length - cap);
  return { finalists: finalists.slice(0, cap), listed: entries.length, ungrounded, duplicates, overCap };
}

// The finalists as the only pool the final picks may come from: its grounding check rejects a
// pick that isn't on the shortlist, even if it was in an earlier search's pool.
export function shortlistAsSeen(finalists: CheckedPick[]): SeenCandidates {
  const seen: SeenCandidates = new Map();
  for (const f of finalists) if (f.record && f.groundingKey) seen.set(f.groundingKey, f.record);
  return seen;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).replace(/\s+\S*$/, "")}…` : flat;
}

// Data, never instructions: catalog text is quoted, and angle brackets are swapped out so it
// can't close the tags around it (the same treatment as the reader brief).
const safe = (s: string) => s.replace(/</g, "‹").replace(/>/g, "›");
// Descriptions are quoted, so a quote mark inside one is swapped too, so it can't end the quote.
// (Titles and authors keep theirs: the final call copies them exactly for the grounding check.)
const safeQuoted = (s: string) => safe(s).replace(/"/g, "”");

export interface FinalistStats {
  finalists: number;
  withDescription: number;
  withMoods: number;
}

// What the final call sees per finalist: title, author, subjects, and where the records have
// them a description and reader mood tags. Never popularity, scores, catalog source or IDs
// (decision 6.13). Shuffled, so list order carries no meaning.
export function formatFinalists(finalists: CheckedPick[], metadata: PickMetadata[]): { text: string; stats: FinalistStats } {
  const stats: FinalistStats = { finalists: finalists.length, withDescription: 0, withMoods: 0 };
  const entries = finalists.map((f, i) => {
    const lookups = metadata[i]?.lookups ?? [];
    const hc = lookups.find((l) => l.source === "hardcover" && l.status === "ok");
    const ol = lookups.find((l) => l.source === "openlibrary" && l.status === "ok");
    const description = (hc?.description.trim() ? hc.description : ol?.description ?? "").trim();
    const moods = hc && hc.source === "hardcover" ? hc.moods : [];
    if (description) stats.withDescription++;
    if (moods.length) stats.withMoods++;
    const subjects = (f.record?.subjects ?? []).slice(0, SUBJECTS_SHOWN);
    return [
      `- "${safe(f.title)}" by ${safe(f.author)}`,
      `  Subjects: ${subjects.length ? safe(subjects.join("; ")) : "(none)"}`,
      `  Description: ${description ? `"${safeQuoted(clip(description, DESCRIPTION_CHARS))}"` : "(none in the catalogs)"}`,
      `  Reader mood tags: ${moods.length ? safe(moods.join(", ")) : "(none)"}`,
    ].join("\n");
  });
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  return { text: `<shortlist>\n${entries.join("\n")}\n</shortlist>`, stats };
}

// The final call: the reader's brief, then the shortlist. Streamed, so each pick's card can
// start as soon as it arrives, exactly as with the one-call selection.
export function finalChoiceRequest(brief: string, shortlistText: string) {
  return {
    model: modelFor("finalChoice"),
    max_tokens: 8000,
    system: [{ type: "text", text: FINAL_CHOICE_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user" as const, content: `${brief}\n\n${shortlistText}` }],
    output_config: { format: SELECTION_FORMAT },
    stream: true,
  };
}

