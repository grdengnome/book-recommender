const fs = require("fs");
const R = require("/workspaces/book-recommender/scratchpad/eval-run-grounded-2026-09-20.json");
const Q = fs.readFileSync("/workspaces/book-recommender/scratchpad/query-log.json","utf8").split("\n").filter(Boolean).map(l=>JSON.parse(l));
// tolerant normalisation: NFKD + strip marks, drop subtitle after ":" , punctuation, articles
const tol = (t) => (t||"").normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().split(/:| \(/)[0].replace(/^(the|a|an)\s+/,"").replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();
const lastName = (n) => { const p=(n||"").normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^\w\s]/g," ").trim().split(/\s+/); return p[p.length-1]; };
for (const c of R) {
  const failed = c.attempts.filter(a => a.outcome !== "grounded");
  if (!failed.length) continue;
  const rounds = Q.filter(e => e.tag === `grounded-${c.id}`);
  // Assign logged OL rounds to attempts in order, using each attempt's merge count (searchRounds).
  let idx = 0; const byAttempt = {};
  for (const a of c.attempts) { byAttempt[a.attempt] = rounds.slice(idx, idx + a.searchRounds); idx += a.searchRounds; }
  console.log(`\n=== ${c.id} (${c.label}) — ${c.attempts.length} attempts, final ${c.finalOutcome}; logged rounds=${rounds.length}, sum of searchRounds=${idx}`);
  for (const a of failed) {
    console.log(`  attempt ${a.attempt} [${a.outcome}] rounds=${a.searchRounds} mergedPools=${JSON.stringify(a.mergedPoolSizes)}`);
    for (const p of a.picks) {
      if (!p.source.startsWith("NONE")) { console.log(`     ok    "${p.title}" — ${p.author}: ${p.source}`); continue; }
      const inThis = (byAttempt[a.attempt]||[]).flatMap(e=>e.pool).filter(b => tol(b.title)===tol(p.title) && lastName(b.author)===lastName(p.author));
      const inAny  = rounds.flatMap(e=>e.pool).filter(b => tol(b.title)===tol(p.title) && lastName(b.author)===lastName(p.author));
      const verdict = inThis.length ? "FALSE REJECTION (book was in this attempt's OL pool)" : inAny.length ? "in a DIFFERENT attempt's pool only → true ungrounded for this attempt" : "TRUE UNGROUNDED (in no logged OL pool; HC pool not logged)";
      console.log(`     NONE  "${p.title}" — ${p.author}: ${verdict}` + (inThis[0] ? `\n           pool string: ${JSON.stringify(inThis[0].title)} / ${JSON.stringify(inThis[0].author)}` : ""));
    }
  }
}
