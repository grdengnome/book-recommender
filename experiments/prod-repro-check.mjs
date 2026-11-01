// THROWAWAY, read-only reproduction check. Hits the live /api/recommend route
// exactly as a normal client would — no production files touched.
const API_URL = "http://localhost:3000/api/recommend";

const CASES = [
  { id: "case-1", tasteDescription:
    "My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book." },
  { id: "case-9", tasteDescription:
    "I love narrative nonfiction — real events told with the pacing and craft of a novel. Specifically deep-dive investigative journalism or historical accounts that read like thrillers. That's exactly what I'm looking for right now." },
  { id: "case-10", tasteDescription:
    "🌊🏚️👻🕯️ — moody, atmospheric, a little unsettling but not full horror. That's the vibe I want." },
];

function describe(data) {
  const usage = data?.usage || {};
  const blocks = (data?.content || []).map(b => b.type);
  const textBlock = (data?.content || []).find(b => b.type === "text");
  const failed = data?.stop_reason === "end_turn" && !textBlock;
  return {
    stop_reason: data?.stop_reason,
    output_tokens: usage.output_tokens,
    thinking_tokens: usage.output_tokens_details?.thinking_tokens,
    blocks,
    textPresent: !!textBlock,
    failed,
  };
}

async function run(c) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tasteDescription: c.tasteDescription, evalTag: `prod-repro-${c.id}` }),
  });
  const body = await res.json();
  return { httpStatus: res.status, ...describe(body.raw) };
}

for (const c of CASES) {
  const first = await run(c);
  let retry = null;
  if (first.failed || first.httpStatus !== 200) {
    retry = await run(c);
  }
  console.log(JSON.stringify({ id: c.id, first, retry }));
}
