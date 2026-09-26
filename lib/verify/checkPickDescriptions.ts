// Final-pick description check + rewrite — step 3 of verifying pick descriptions (branch
// feat/verify-pick-descriptions). Step 2 (lookupPickMetadata.ts) fetches each validated
// pick's own source records; this makes one model call that compares the recommender's
// `why` / `nonObvious` text for the gated picks (see below) against those facts, and
// rewrites the text for any pick it contradicts (e.g. the Sept 23 case-8 pick describing Izzo's essay
// collection "Garlic, Mint & Sweet Basil" as a noir novel).
//
// Gated on a hard signal (2026-09-26): only picks whose catalog subjects trigger the form
// hint (formHint below) are sent to the checker; every other pick passes through unchanged
// as "not checked", and a request with no such pick makes no checker call at all. Replays
// showed the ungated checker catching the target error but also misfiring on fresh live
// picks — flagging Oblomov's "tragedy" vs the catalog's "comedic" (a tone judgment) and
// rewriting an accurate Los informantes blurb because the catalog description covered a
// different thread of the novel — with no real catches among them. The lookups still run
// for every pick: they compute the hint, and their data will be reused for cards.
//
// Scope limits, deliberate:
// - Never changes which book was picked — only `why` and `nonObvious` are ever replaced,
//   and only on the pick at the index the checker returned.
// - Never breaks a response: any failure (timeout, API error, unparseable or malformed
//   output) returns the original recommendations text unchanged, byte for byte. The text
//   is only re-serialized when at least one pick was actually rewritten.
import type { PickMetadata } from "./lookupPickMetadata";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// Narrow fact-check, latency-sensitive (it sits in front of the response) — a small, fast
// model. Kept in one constant so it's easy to swap.
const CHECK_MODEL = "claude-haiku-4-5";
const CHECK_TIMEOUT_MS = 8000;
const CHECK_MAX_TOKENS = 2000;
const DESCRIPTION_MAX_CHARS = 1000;
const OL_SUBJECTS_MAX = 30;

// "not checked" = gated out (no hard signal), passed through unchanged by design;
// "unchecked" = was eligible for checking, but the check failed or gave no usable verdict.
export type PickCheckStatus = "confirmed" | "rewritten" | "unchecked" | "not checked";

export interface PickCheckResult {
  title: string;
  author: string;
  status: PickCheckStatus;
  reason: string; // checker's reason, or why the pick went unchecked
  before: { why: string; nonObvious: string };
  after: { why: string; nonObvious: string }; // equals `before` unless rewritten
}

export interface CheckPickDescriptionsResult {
  recommendations: string; // text to send to the user — the original unless something was rewritten
  picks: PickCheckResult[];
  checkMs: number; // time spent in the model call (0 when no call was made)
  checkCalled: boolean; // false when no pick had a hard signal (or the input couldn't be used)
  error?: string; // set when the whole check fell back to the original text
}

interface ParsedPick {
  title?: unknown;
  author?: unknown;
  why?: unknown;
  nonObvious?: unknown;
  [key: string]: unknown;
}

interface PickFacts {
  descriptions: { source: string; text: string }[];
  olSubjects: string[];
  hcGenres: string[];
  hcMoods: string[];
  formNote?: string; // set by formHint when the subjects mark the work as criticism
}

// Form hint (2026-09-26). Prompt C on Haiku missed Izzo's "Garlic, Mint & Sweet Basil"
// 3/3 replay runs: it read "French Noir fiction" as confirming a noir novel and ignored
// the "... history and criticism" subjects that mark it as commentary about noir. So the
// signal is computed in code and stated to the checker explicitly. Deliberately narrow —
// only these two subdivisions: across the 31 unique Sept 23 baseline picks, Izzo carried
// 4/8 such subjects and no other pick carried any
// (scratchpad/ol-pick-metadata-check-results.json). Other form patterns (biography,
// drama, ...) showed up as one-off noise on real novels there, so they're excluded.
// Thresholds are provisional: that data has only one positive example.
const CRITICISM_SUBJECT_PATTERN = /history and criticism|criticism and interpretation/i;
const CRITICISM_MIN_COUNT = 2;
const CRITICISM_MIN_SHARE = 0.25;
const CRITICISM_FORM_NOTE =
  "Catalog note: this work's subjects indicate it is criticism or commentary about its genre, not a work of fiction in that genre.";

// Applied to the (already capped) subjects actually sent to the checker.
function formHint(olSubjects: string[]): string | undefined {
  if (olSubjects.length === 0) return undefined;
  const count = olSubjects.filter((s) => CRITICISM_SUBJECT_PATTERN.test(s)).length;
  return count >= CRITICISM_MIN_COUNT || count / olSubjects.length >= CRITICISM_MIN_SHARE
    ? CRITICISM_FORM_NOTE
    : undefined;
}

interface CheckerVerdict {
  index?: unknown;
  verdict?: unknown;
  errorType?: unknown;
  blurbClaim?: unknown;
  catalogFact?: unknown;
  reason?: unknown;
  why?: unknown;
  nonObvious?: unknown;
}

// The only error kinds that justify a rewrite. A "contradicts" verdict must name one of
// these and quote both the blurb claim and the catalog fact it conflicts with; otherwise
// the flag is dropped in code (pick confirmed, original kept). Added 2026-09-26 after a
// replay showed a prompt-only rule didn't stop Haiku flagging interpretive wording
// ("a character study rather than a plotted novel" on Brookner's Strangers) 3/3 runs.
const FACTUAL_ERROR_TYPES = ["form", "genre", "subject_or_setting", "plot", "different_book"] as const;

// Same tolerant parse as pickGrounding.ts's checkPickGrounding: the JSON array between the
// first "[" and the last "]", ignoring any code fence or prose around it.
function parseJsonArray(text: string): unknown[] | null {
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

// Loose normalization for quote checking: case, diacritics, punctuation and whitespace
// don't matter, so a faithful quote matches even if the model re-punctuates it.
function normalizeForQuote(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// True if `quote` actually appears in `source`. An ellipsis in the quote is treated as
// elided text: every non-empty segment must appear. Guards against the checker "quoting"
// text that isn't there — seen in the 2026-09-26 replay, where the claimed blurb quote for
// Strangers came from the catalog description and a claimed catalog fact for Paris Trout
// was the model's own inference.
function quoteAppearsIn(quote: string, source: string): boolean {
  const haystack = normalizeForQuote(source);
  const segments = quote.split(/\.\.\.|…/).map(normalizeForQuote).filter(Boolean);
  return segments.length > 0 && segments.every((seg) => haystack.includes(seg));
}

function factsText(f: PickFacts): string {
  return [...f.descriptions.map((d) => d.text), ...f.olSubjects, ...f.hcGenres, ...f.hcMoods, f.formNote ?? ""].join(" | ");
}

// Only successful lookups contribute; failed/empty ones add nothing.
function collectFacts(meta: PickMetadata | undefined): PickFacts {
  const facts: PickFacts = { descriptions: [], olSubjects: [], hcGenres: [], hcMoods: [] };
  for (const l of meta?.lookups ?? []) {
    if (l.status !== "ok") continue;
    if (l.description.trim()) {
      facts.descriptions.push({ source: l.source, text: truncate(l.description, DESCRIPTION_MAX_CHARS) });
    }
    if (l.source === "openlibrary") facts.olSubjects.push(...l.subjects.slice(0, OL_SUBJECTS_MAX));
    else {
      facts.hcGenres.push(...l.genres);
      facts.hcMoods.push(...l.moods);
    }
  }
  facts.formNote = formHint(facts.olSubjects);
  return facts;
}

function hasFacts(f: PickFacts): boolean {
  return f.descriptions.length + f.olSubjects.length + f.hcGenres.length + f.hcMoods.length > 0;
}

function buildPrompt(
  tasteDescription: string,
  items: { index: number; pick: ParsedPick; facts: PickFacts }[],
): string {
  const blocks = items.map(({ index, pick, facts }) => {
    const lines = [
      `<pick index="${index}">`,
      `title: ${str(pick.title)}`,
      `author: ${str(pick.author)}`,
      `why (recommender's text): ${str(pick.why)}`,
      `nonObvious (recommender's text): ${str(pick.nonObvious)}`,
      "facts from catalog records:",
    ];
    for (const d of facts.descriptions) lines.push(`- ${d.source} description: ${d.text}`);
    if (facts.olSubjects.length) lines.push(`- Open Library subjects: ${facts.olSubjects.join("; ")}`);
    if (facts.hcGenres.length) lines.push(`- Hardcover genres: ${facts.hcGenres.join("; ")}`);
    if (facts.hcMoods.length) lines.push(`- Hardcover moods: ${facts.hcMoods.join("; ")}`);
    if (facts.formNote) lines.push(`- ${facts.formNote}`);
    lines.push("</pick>");
    return lines.join("\n");
  });

  return `You are fact-checking short book-recommendation blurbs against catalog records.

The reader asked for:
<taste>
${tasteDescription}
</taste>

For each pick below, a recommender wrote a "why" and a "nonObvious" blurb. Your job is to catch factual errors about the book — not to judge the recommender's interpretation of it.

${blocks.join("\n\n")}

For each pick, mark it "contradicts" only if the blurbs make a factual error that the catalog facts provided directly show is wrong. These are the only kinds of error that count:
- Wrong form: e.g. calling an essay collection, story collection, or nonfiction work a novel, or the reverse.
- Wrong genre.
- Wrong subject or setting: e.g. the wrong place, period, or central topic.
- Wrong plot facts: e.g. a protagonist, event, or relationship the facts rule out.
- Describing a different book: e.g. another volume in the same series (a different installment, a different stage of the character's life) or another work by the same author.

Interpretive characterizations are not errors: pacing, tone, mood, "character study," "slow," "quiet," "immersive," "plot-light," how the book reads, and how it relates to the reader's taste. A catalog description that summarizes events does not contradict a blurb calling the book a character study or not plot-driven — that is a judgment about emphasis, not a fact. Treat such characterizations as errors only if the facts directly contradict them.

Mark every other pick "consistent". Claims the facts simply don't cover are fine. When unsure whether something is a factual error, mark it "consistent" rather than rewriting.

Library subject headings can state a book's form directly. Subdivisions such as "History and criticism", "Criticism and interpretation", "Biography", or "Juvenile literature" mean the book is that kind of work (criticism, biography, etc.), so they are valid evidence of the form.

To mark a pick "contradicts" you must be able to fill in all of: which error type it is (one of the five above), the wrong claim quoted word for word from that pick's blurbs, and the catalog fact quoted word for word from that pick's facts. Both quotes are checked against the text; a paraphrase, an inference, or a quote from the wrong place does not count. If you can't quote a specific catalog fact, it is not a contradiction.

If a pick contradicts the facts, rewrite both "why" and "nonObvious" so they are accurate to the catalog facts while still connecting the book to the reader's taste. Every claim in a rewrite about what the book is or contains must be supported by the facts provided. That rules out two things: details from your own knowledge of the book, and details kept from the original blurb that the facts don't support — once a blurb has been shown wrong about the book, treat the rest of its specifics as unverified. If the facts only support a modest description, write a modest one; it is fine for a rewrite to be shorter than the original. Never suggest a different book.

Catalog records can be noisy (odd subject tags, a description that is only a page count); ignore noise rather than treating it as a contradiction.

Respond with ONLY a JSON array, one object per pick, no prose before or after. For a consistent pick:
{"index": <pick index>, "verdict": "consistent", "reason": "<one short sentence>"}
For a pick that contradicts the facts — all fields required, including both rewrites:
{"index": <pick index>, "verdict": "contradicts", "errorType": "form" | "genre" | "subject_or_setting" | "plot" | "different_book", "blurbClaim": "<the wrong claim, quoted from the blurb>", "catalogFact": "<the catalog fact that contradicts it, quoted from the facts>", "reason": "<one short sentence>", "why": "<rewritten why>", "nonObvious": "<rewritten nonObvious>"}`;
}

async function callChecker(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CHECK_MODEL,
      max_tokens: CHECK_MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${JSON.stringify(data?.error ?? data).slice(0, 200)}`);
  if (data?.stop_reason === "max_tokens") throw new Error("checker hit max_tokens");
  const textBlock = data?.content?.find((b: { type: string }) => b.type === "text");
  return textBlock?.text ?? "";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return `timeout after ${CHECK_TIMEOUT_MS}ms`;
  }
  return err instanceof Error ? err.message : String(err);
}

// `metadata` must be index-aligned with the pick array in `recommendations` — route.ts
// builds it from grounding.picks, which checkPickGrounding parses from that same text in
// the same order. A length mismatch is treated as a failure (nothing is rewritten).
export async function checkPickDescriptions(
  apiKey: string,
  tasteDescription: string,
  recommendations: string,
  metadata: PickMetadata[],
): Promise<CheckPickDescriptionsResult> {
  const parsed = parseJsonArray(recommendations) as ParsedPick[] | null;
  const unchanged = (picks: PickCheckResult[], checkMs: number, error?: string) => ({
    recommendations,
    picks,
    checkMs,
    checkCalled: checkMs > 0,
    ...(error ? { error } : {}),
  });

  if (!parsed) return unchanged([], 0, "recommendations text could not be parsed");
  const base: PickCheckResult[] = parsed.map((p) => {
    const text = { why: str(p?.why), nonObvious: str(p?.nonObvious) };
    return { title: str(p?.title), author: str(p?.author), status: "unchecked", reason: "", before: text, after: { ...text } };
  });
  if (parsed.length !== metadata.length) {
    base.forEach((r) => (r.reason = "pick/metadata count mismatch"));
    return unchanged(base, 0, `pick count ${parsed.length} != metadata count ${metadata.length}`);
  }

  const toCheck: { index: number; pick: ParsedPick; facts: PickFacts }[] = [];
  parsed.forEach((pick, index) => {
    const facts = collectFacts(metadata[index]);
    if (facts.formNote) toCheck.push({ index, pick, facts });
    else {
      base[index].status = "not checked";
      base[index].reason = hasFacts(facts) ? "no hard signal" : "no hard signal; no usable facts from lookups";
    }
  });
  if (toCheck.length === 0) return unchanged(base, 0);

  const start = performance.now();
  let verdicts: CheckerVerdict[];
  try {
    const text = await callChecker(apiKey, buildPrompt(tasteDescription, toCheck));
    const arr = parseJsonArray(text);
    if (!arr) throw new Error(`checker response not a JSON array: ${text.slice(0, 200)}`);
    verdicts = arr as CheckerVerdict[];
  } catch (err) {
    const checkMs = Math.round(performance.now() - start);
    const error = errorMessage(err);
    toCheck.forEach(({ index }) => (base[index].reason = `check failed: ${error}`));
    return unchanged(base, checkMs, error);
  }
  const checkMs = Math.round(performance.now() - start);

  const sent = new Set(toCheck.map((t) => t.index));
  const factsByIndex = new Map(toCheck.map((t) => [t.index, factsText(t.facts)]));
  let rewroteAny = false;
  for (const v of verdicts) {
    const index = typeof v?.index === "number" ? v.index : Number.NaN;
    if (!sent.has(index)) continue; // ignore verdicts for picks that weren't sent
    const result = base[index];
    const reason = str(v.reason);
    if (v.verdict === "consistent") {
      result.status = "confirmed";
      result.reason = reason;
    } else if (v.verdict === "contradicts") {
      const why = str(v.why).trim();
      const nonObvious = str(v.nonObvious).trim();
      const errorType = str(v.errorType);
      const blurbText = `${result.before.why} ${result.before.nonObvious}`;
      const problems = [
        (FACTUAL_ERROR_TYPES as readonly string[]).includes(errorType) ? "" : `errorType=${errorType || "none"}`,
        quoteAppearsIn(str(v.blurbClaim), blurbText) ? "" : "blurbClaim not found in blurb",
        quoteAppearsIn(str(v.catalogFact), factsByIndex.get(index) ?? "") ? "" : "catalogFact not found in facts",
      ].filter(Boolean);
      if (problems.length) {
        // Unjustified flag: treated as consistent, per "when unsure, confirm".
        result.status = "confirmed";
        result.reason = `flag dropped (${problems.join("; ")}): ${reason}`;
      } else if (why && nonObvious) {
        result.status = "rewritten";
        result.reason = `${errorType}: "${str(v.blurbClaim)}" vs catalog "${str(v.catalogFact)}" — ${reason}`;
        result.after = { why, nonObvious };
        parsed[index].why = why;
        parsed[index].nonObvious = nonObvious;
        rewroteAny = true;
      } else {
        result.reason = `flagged as contradicting but rewrite was incomplete — kept original (${reason})`;
      }
    } else {
      result.reason = "checker returned no usable verdict";
    }
  }
  for (const index of sent) {
    if (base[index].status === "unchecked" && !base[index].reason) {
      base[index].reason = "checker returned no verdict for this pick";
    }
  }

  return {
    recommendations: rewroteAny ? JSON.stringify(parsed, null, 2) : recommendations,
    picks: base,
    checkMs,
    checkCalled: true,
  };
}

// Same per-call console convention as formatPickMetadata. totalMs is measured by the
// caller around lookups + check together — the full latency verification adds.
export function formatPickCheck(result: CheckPickDescriptionsResult, lookupMs: number, totalMs: number): string {
  const counts = { confirmed: 0, rewritten: 0, unchecked: 0, "not checked": 0 };
  result.picks.forEach((p) => counts[p.status]++);
  const check = result.checkCalled
    ? `check ${result.checkMs}ms, model ${CHECK_MODEL}, timeout ${CHECK_TIMEOUT_MS}ms`
    : "check skipped, no pick with a hard signal";
  const lines = [
    `pickCheck: ${counts.confirmed} confirmed, ${counts.rewritten} rewritten, ${counts.unchecked} unchecked, ` +
      `${counts["not checked"]} not checked — added wall time=${totalMs}ms (lookups ${lookupMs}ms + ${check})` +
      (result.error ? ` — FELL BACK TO ORIGINAL TEXT: ${result.error}` : ""),
  ];
  for (const p of result.picks) {
    lines.push(`  "${p.title}" — ${p.author}: ${p.status}${p.reason ? ` (${p.reason})` : ""}`);
    if (p.status === "rewritten") {
      lines.push(`    why BEFORE: ${p.before.why}`);
      lines.push(`    why AFTER:  ${p.after.why}`);
      lines.push(`    nonObvious BEFORE: ${p.before.nonObvious}`);
      lines.push(`    nonObvious AFTER:  ${p.after.nonObvious}`);
    }
  }
  return lines.join("\n");
}
