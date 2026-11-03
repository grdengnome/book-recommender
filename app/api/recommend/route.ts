// The web front door for the recommendation engine (spec.md §4b): POST { tasteDescription }
// → { picks }, or { error: { code, message } }. Checks the request and the AI configuration,
// then hands the work to the engine (lib/engine/recommend.ts). No engine logic lives here.
import { NextRequest, NextResponse } from "next/server";
import { aiConfigError } from "@/lib/ai/gateway";
import { errorBody, recommend } from "@/lib/engine/recommend";

// Engine runs take up to ~2 min; 300s is the Vercel Hobby maximum.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const configError = aiConfigError();
  if (configError) {
    return NextResponse.json(errorBody("misconfigured", configError), { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const tasteDescription = body?.tasteDescription;
  if (typeof tasteDescription !== "string" || !tasteDescription.trim()) {
    return NextResponse.json(errorBody("bad_request", "tasteDescription (string) is required"), { status: 400 });
  }
  const evalTag = typeof body?.evalTag === "string" ? body.evalTag : null;

  const result = await recommend({ tasteDescription, evalTag });
  return NextResponse.json(result.body, { status: result.status });
}
