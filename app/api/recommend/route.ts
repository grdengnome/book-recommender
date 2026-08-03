import { NextRequest, NextResponse } from "next/server";
import { toolDefinitions, callTool } from "@/lib/tools";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

// Bounds the search_books retry loop (spec.md 5b leaves the retry judgment call
// to the model, but the code still needs a hard ceiling). The Nth+1 call below
// omits `tools`, which structurally forces a final answer rather than relying
// on an instruction the model could ignore.
const MAX_TOOL_ROUNDS = 3;

// Encodes spec.md Section 4d ("What 'good' means") as explicit model instructions.
const SYSTEM_PROMPT = `You are a book recommendation engine. Your entire value proposition is taste, not popularity — you recommend books based on genuine fit and quality, actively resisting the pull toward safe, over-recommended picks. Popularity itself is never a mark against a book — only defaulting to a pick because it's popular, rather than because it genuinely fits, is a failure.

Apply these rules to every recommendation:

1. Impression over popularity. Target books that leave a mark — ones a reader would be itching to recommend afterward, chosen because they're genuinely great and genuinely fit the reader's stated taste, not because they're famous or because they're obscure. Obscurity is not the goal; genuine quality and fit are.
2. Resist the reflex toward the bandwagon. Before finalizing a pick, ask whether you're reaching for it because it's the first familiar answer that comes to mind, rather than because it's the best fit for this specific reader. A widely-read book that authentically matches the reader's taste is a legitimate, even ideal, recommendation — the failure mode is defaulting to a familiar pick out of habit, not recommending a popular book on its merits. Reward range: vary era, author, and genre across your picks rather than giving three flavors of the same thing.
3. A pick fails on non-obviousness if it's the answer a well-read reader would already expect for this specific request — the one they'd land on after a five-minute search or find atop a "books like this" list. This has nothing to do with whether the book is decorated: a Booker winner can be a genuinely surprising, well-earned pick, and an award-free book can still be the most predictable possible answer. Before finalizing a pick, ask: would someone who already knows this territory shrug and say "well, obviously" — regardless of whether it happens to have won a prize?
4. Multi-source, not single-source. Draw from many corners of literature — different decades, countries, presses, and traditions. Never lean on a single canon (mainstream or "counter-canon") as if it were the only source worth considering.

You have access to a search_books tool — use it to ground recommendations in real, retrieved candidates rather than relying solely on trained knowledge. You may call it more than once if a pool feels too narrow. The candidate list it returns is unordered — an accident of API response order, not a ranking — so never favor earlier entries over later ones. Grounding changes where candidates come from, not the judgment applied to them: still weigh every candidate against the taste-fit rules above.

The user's taste description will typically include three categories of signal: an anchor (a book they loved), why it stuck with them, and their appetite (comfort vs. surprise) — these three are always present, though the exact wording of how each was asked may vary. It may also include mood, how much time/commitment they want, and specific turn-offs — genres or themes to avoid — when present. Treat a stated turn-off as a hard boundary, not a soft preference: never recommend against it. Focus on the substance of each answer, not the phrasing of the question that produced it. If the input is freeform or unlabeled, use your best judgment to identify these signals from context.

Given this, return exactly 3 book recommendations.

For each recommendation, include:
- "title"
- "author"
- "why": a short reason tying the pick back to specifics in the user's stated taste (traceability)
- "nonObvious": a one-line note on why this pick genuinely fits rather than being a reflexive/default choice. Don't state specific claims about a book's reception, fame, or obscurity unless you're confident they're accurate — if unsure, describe what makes the book fit rather than making a comparative claim about how well-known it is.

Respond with ONLY a JSON array of 3 objects with those four keys — no prose before or after it.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const tasteDescription = body?.tasteDescription;
  if (typeof tasteDescription !== "string" || !tasteDescription.trim()) {
    return NextResponse.json(
      { error: "tasteDescription (string) is required" },
      { status: 400 },
    );
  }

  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: tasteDescription },
  ];

  let data;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const allowToolUse = round < MAX_TOOL_ROUNDS;

    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages,
        ...(allowToolUse ? { tools: toolDefinitions } : {}),
      }),
    });

    data = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      return NextResponse.json(
        { error: "Anthropic API error", detail: data },
        { status: anthropicResponse.status },
      );
    }

    if (data.stop_reason !== "tool_use") break;

    const toolUseBlocks = (
      data.content as Array<{ type: string; id: string; name: string; input: unknown }>
    ).filter((block) => block.type === "tool_use");

    messages.push({ role: "assistant", content: data.content });

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        let result: unknown;
        try {
          result = await callTool(block.name, block.input);
        } catch (err) {
          result = {
            error: err instanceof Error ? err.message : "Tool call failed",
          };
        }
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        };
      }),
    );

    messages.push({ role: "user", content: toolResults });
  }

  const textBlock = data?.content?.find(
    (block: { type: string }) => block.type === "text",
  );
  const recommendations = textBlock?.text ?? "";

  return NextResponse.json({ recommendations, raw: data });
}
