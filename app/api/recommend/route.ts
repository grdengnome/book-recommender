// The web front door for the recommendation engine (spec.md §4b): POST { profile } (a taste
// profile, decision 2.24) or the legacy { tasteDescription } paragraph → { picks }, or
// { error: { code, message } }. Checks the request and the AI configuration, turns a profile
// into the reader brief, then hands the work to the engine (lib/engine/recommend.ts).
import { NextRequest, NextResponse } from "next/server";
import { aiConfigError } from "@/lib/ai/gateway";
import { errorBody, recommend } from "@/lib/engine/recommend";
import { renderBrief } from "@/lib/engine/profile/renderBrief";
import { validateProfile } from "@/lib/engine/profile/validateProfile";
import type { LengthBand } from "@/lib/engine/profile/slots";

// Engine runs take up to ~2 min; 300s is the Vercel Hobby maximum.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const configError = aiConfigError();
  if (configError) {
    return NextResponse.json(errorBody("misconfigured", configError), { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const evalTag = typeof body?.evalTag === "string" ? body.evalTag : null;

  let tasteDescription: string;
  let length: LengthBand | undefined;
  let avoid: string[] = [];
  if (body?.profile !== undefined) {
    const check = validateProfile(body.profile);
    if (!check.ok) {
      return NextResponse.json(errorBody("bad_request", `Invalid profile: ${check.problems.slice(0, 5).join("; ")}`), { status: 400 });
    }
    tasteDescription = renderBrief(check.profile);
    length = check.profile.slots.length?.value;
    avoid = check.profile.slots.avoid?.value ?? [];
  } else if (typeof body?.tasteDescription === "string" && body.tasteDescription.trim()) {
    tasteDescription = body.tasteDescription;
  } else {
    return NextResponse.json(errorBody("bad_request", "profile (object) or tasteDescription (string) is required"), { status: 400 });
  }

  const result = await recommend({ tasteDescription, length, avoid, evalTag });
  return NextResponse.json(result.body, { status: result.status });
}
