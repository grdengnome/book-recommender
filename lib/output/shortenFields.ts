// Length-overflow repair (fix PR 1, 2026-10-21). A field over its ceiling (validatePicks.ts)
// never fails the request or re-runs the final step. Instead, one small Haiku call per
// request shortens only the over-limit fields, keeping their meaning and adding nothing.
//
// Never breaks a response, same rule as checkPickDescriptions.ts: on any failure (timeout,
// API error, bad output) or a shortening that fails the checks below, the original text is
// kept and the reason is logged. A shortened field is used only if it:
// - fits its ceiling and isn't empty, and
// - adds no new word: every word of 4+ letters in it already appears in the original, except
//   connecting words (CONNECTORS), which carry no facts. This puts "adding nothing new" in
//   code, not just in the prompt. It's strict (a changed word form also fails), which only
//   costs a kept original, never a wrong claim. It can't check meaning: a cut can still
//   shift emphasis.
import type { ModelPick } from "./pickSchema";
import { LENGTH_CEILINGS, LENGTH_TARGETS, type LimitedField, type OverLimitField } from "./validatePicks";
import { noopTrace, type RequestTrace } from "../trace/requestTrace";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// Same small, fast model as the description check; this sits in front of the response.
const SHORTEN_MODEL = "claude-haiku-4-5";
const SHORTEN_TIMEOUT_MS = 8000;
const SHORTEN_MAX_TOKENS = 1000;

const FIELD_NAMES: Record<LimitedField, string> = {
  hook: "a one-line hook for a book card",
  angleHeading: "a short section heading",
  why: "a short paragraph on why a book suits a reader",
  angleText: "a short section body",
};

const SHORTEN_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["fields"],
    properties: {
      fields: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "text"],
          properties: { id: { type: "string" }, text: { type: "string" } },
        },
      },
    },
  },
} as const;

export interface ShortenResult {
  index: number;
  field: LimitedField;
  status: "shortened" | "kept";
  reason: string; // why the original was kept; "" when shortened
  before: string;
  after: string; // equals `before` when kept
}

export interface ShortenFieldsResult {
  picks: ModelPick[];
  results: ShortenResult[];
  callMade: boolean;
  ms: number;
  error?: string; // set when the whole call failed and every original was kept
}

// Seen in the Oct 21 probe: "with" alone rejected an otherwise faithful shortening.
const CONNECTORS = new Set(["with", "from", "into", "onto", "that", "this", "than", "then", "when", "while", "where", "whose", "their", "them", "they", "over", "upon", "about", "after", "before", "through", "across", "within", "without", "amid", "among", "also", "both", "each"]);

function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4);
}

function newWords(original: string, shortened: string): string[] {
  const allowed = new Set(words(original));
  return words(shortened).filter((w) => !allowed.has(w) && !CONNECTORS.has(w));
}

function buildPrompt(items: { id: string; field: LimitedField; text: string }[]): string {
  const blocks = items.map(
    (it) =>
      `<field id="${it.id}" kind="${FIELD_NAMES[it.field]}" current_chars="${it.text.length}" target_chars="${LENGTH_TARGETS[it.field]}">\n${it.text}\n</field>`,
  );
  // Aims at the prompt's target, well under the ceiling the result is checked against, so
  // a loose character count still lands inside it.
  return `Shorten each piece of text below to about its target_chars (counting spaces and punctuation). current_chars is its length now; cut until it is no longer than target_chars.

Rules:
- Keep the meaning and the tone.
- Only cut or tighten. Add nothing new: no new facts, claims, names, or words that aren't in the original.
- Keep it a natural, complete line, not a clipped fragment.

${blocks.join("\n\n")}

Return one entry per field, with its id and the shortened text.`;
}

export async function shortenFields(
  apiKey: string,
  picks: ModelPick[],
  overLimit: OverLimitField[],
  trace: RequestTrace = noopTrace,
): Promise<ShortenFieldsResult> {
  const results: ShortenResult[] = overLimit.map(({ index, field }) => ({
    index,
    field,
    status: "kept",
    reason: "",
    before: picks[index][field],
    after: picks[index][field],
  }));
  if (results.length === 0) return { picks, results, callMade: false, ms: 0 };

  const items = results.map((r, i) => ({ id: String(i), field: r.field, text: r.before }));
  const requestBody = {
    model: SHORTEN_MODEL,
    max_tokens: SHORTEN_MAX_TOKENS,
    messages: [{ role: "user", content: buildPrompt(items) }],
    output_config: { format: SHORTEN_FORMAT },
  };

  const start = performance.now();
  let recorded = false;
  let returned: { id?: unknown; text?: unknown }[];
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(SHORTEN_TIMEOUT_MS),
    });
    const data = await res.json();
    trace.modelCall("H", { model: SHORTEN_MODEL, request: requestBody, response: data, httpStatus: res.status, ms: Math.round(performance.now() - start) });
    recorded = true;
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${JSON.stringify(data?.error ?? data).slice(0, 200)}`);
    if (data?.stop_reason !== "end_turn") throw new Error(`stop_reason=${data?.stop_reason}`);
    const text = data?.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
    returned = JSON.parse(text).fields;
    if (!Array.isArray(returned)) throw new Error("no fields array");
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    const error =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
        ? `timeout after ${SHORTEN_TIMEOUT_MS}ms`
        : err instanceof Error ? err.message : String(err);
    // Timeouts and network failures never reach modelCall above; record them here.
    if (!recorded) trace.modelCall("H", { model: SHORTEN_MODEL, request: requestBody, ms, error });
    results.forEach((r) => (r.reason = `shortening call failed: ${error}`));
    return { picks, results, callMade: true, ms, error };
  }
  const ms = Math.round(performance.now() - start);

  const shortened = picks.map((p) => ({ ...p }));
  results.forEach((r, i) => {
    const entry = returned.find((e) => e?.id === String(i));
    const text = typeof entry?.text === "string" ? entry.text.trim() : "";
    const added = newWords(r.before, text);
    if (!text) r.reason = "no shortened text returned";
    else if (text.length > LENGTH_CEILINGS[r.field]) r.reason = `still ${text.length} chars (ceiling ${LENGTH_CEILINGS[r.field]})`;
    else if (added.length) r.reason = `added words not in the original: ${added.join(", ")}`;
    else {
      r.status = "shortened";
      r.after = text;
      shortened[r.index][r.field] = text;
    }
  });
  return { picks: shortened, results, callMade: true, ms };
}

// Same per-call console convention as formatPickCheck.
export function formatShorten(result: ShortenFieldsResult): string {
  if (!result.callMade) return "shortenFields: no field over its ceiling, no call";
  const lines = [`shortenFields: ${result.results.length} field(s) over ceiling, call ${result.ms}ms, model ${SHORTEN_MODEL}` + (result.error ? ` — KEPT ORIGINALS: ${result.error}` : "")];
  for (const r of result.results) {
    lines.push(`  pick ${r.index + 1} ${r.field}: ${r.status}${r.reason ? ` (${r.reason})` : ""} ${r.before.length}→${r.after.length} chars`);
  }
  return lines.join("\n");
}
