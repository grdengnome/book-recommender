// Early table-setting blind test, step 1 (2026-10-22, branch experiment/early-table-setting).
// For six eval cases, the table is built from the backbone answers only (anchor, why,
// appetite), as a background prepare call would build it; selection, cards and the
// description check then run with the full taste description. Uses the route's
// experiment-only `prepareFrom` field. The comparison arm is today's engine, from the Oct 22
// timing-run traces (same code as main after PR #10): `*stream1022-case-{1,5,6}*` and
// `*stream1022b-case-{8,9,10}*`.
//
// The eval cases are single free-text messages, so the backbone text is cut from each by
// hand: keep anchor / why / appetite, drop mood, length and turn-offs. None of the six states
// an appetite, so neither arm has one. Cases 8 and 9 are all backbone, so their two runs differ
// only in when the description arrives: they show run-to-run noise. Case 10 has no anchor or
// why at all; its emoji are the nearest stand-in and it's the weakest case.
//
// Usage: dev server running with ENGINE_TRACE=1; node scratchpad/early-table-test.mjs
// Optional: CASE_IDS=case-8 (subset). Writes nothing itself; results are the traces tagged
// early1022-<case>.
import fs from "fs";

const PORT = process.env.PORT || 3000;
const src = fs.readFileSync(new URL("./run-eval.mjs", import.meta.url), "utf8");
const CASES = eval(src.match(/const CASES = (\[[\s\S]*?\n\]);/)[1]);

export const BACKBONE = {
  "case-1": {
    backbone: "My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface.",
    later: { mood: "quiet and melancholic, character-driven rather than plot-heavy", length: "plenty of time, a slow, immersive book" },
  },
  "case-5": {
    backbone: "My favorite book of all time is 'War and Peace' — I loved the sprawling scope and how deeply it got into every character's inner life.",
    later: { mood: "something light", length: "quick to read, nothing heavy or slow" },
  },
  "case-6": {
    backbone: "I love literary fiction — character studies, beautiful prose, morally complicated people.",
    later: { turnOff: "no fantasy: no magic systems, no invented worlds" },
  },
  "case-8": {
    backbone: "I'm looking for something with a really granular, immersive sense of place — I want to feel like I'm actually there — and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture.",
    later: {},
  },
  "case-9": {
    backbone: "I love narrative nonfiction — real events told with the pacing and craft of a novel. Specifically deep-dive investigative journalism or historical accounts that read like thrillers. That's exactly what I'm looking for right now.",
    later: {},
  },
  "case-10": {
    backbone: "🌊🏚️👻🕯️",
    later: { mood: "moody, atmospheric, a little unsettling", turnOff: "not full horror" },
  },
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const ids = process.env.CASE_IDS ? process.env.CASE_IDS.split(",") : Object.keys(BACKBONE);
  for (const id of ids) {
    const c = CASES.find((x) => x.id === id);
    const start = Date.now();
    const res = await fetch(`http://localhost:${PORT}/api/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tasteDescription: c.tasteDescription, prepareFrom: BACKBONE[id].backbone, evalTag: `early1022-${id}` }),
    });
    const body = await res.json();
    const picks = body.picks?.map((p) => `${p.title} — ${p.author} [${p.mood}]`).join(" | ") ?? JSON.stringify(body.error);
    console.log(`[${id}] HTTP ${res.status} ${((Date.now() - start) / 1000).toFixed(1)}s ${picks}`);
  }
}
