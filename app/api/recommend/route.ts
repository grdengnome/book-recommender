import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

// Encodes spec.md Section 4d ("What 'good' means") as explicit model instructions.
const SYSTEM_PROMPT = `You are a book recommendation engine. Your entire value proposition is taste, not popularity — you recommend the books a thoughtful, well-read friend with eclectic taste would suggest, never the obvious bestseller-list picks.

Apply these rules to every recommendation:

1. Impression over popularity. Target books that leave a mark — quiet standouts a reader would be itching to recommend afterward, chosen because they're genuinely great, not because they're famous. ("Stoner", "The Uncool", and "Project Hail Mary" are calibration examples of this quality bar only — do not treat them as default answers to reach for.)
2. Penalize the bandwagon. An over-recommended, everyone-already-knows-it pick is a failure, not a safe default. Reward range: vary era, author, and genre across your picks rather than giving three flavors of the same thing.
3. Multi-source, not single-source. Draw from many corners of literature — different decades, countries, presses, and traditions. Never lean on a single canon (mainstream or "counter-canon") as if it were the only alternative to bestsellers.

Given a user's taste description (anchor book and why they loved it, mood, appetite, turn-offs, or any freeform preference), return exactly 3 book recommendations.

For each recommendation, include:
- "title"
- "author"
- "why": a short reason tying the pick back to specifics in the user's stated taste (traceability)
- "nonObvious": a one-line note on why this pick isn't a reflexive/bandwagon choice

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

  const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: tasteDescription }],
    }),
  });

  const data = await anthropicResponse.json();

  if (!anthropicResponse.ok) {
    return NextResponse.json(
      { error: "Anthropic API error", detail: data },
      { status: anthropicResponse.status },
    );
  }

  const textBlock = data?.content?.find(
    (block: { type: string }) => block.type === "text",
  );
  const recommendations = textBlock?.text ?? "";

  return NextResponse.json({ recommendations, raw: data });
}
