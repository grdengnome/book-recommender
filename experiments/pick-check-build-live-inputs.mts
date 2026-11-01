// Freezes today's final live-check picks (2026-09-26, cases 1 and 8 via the route —
// eval-run-finalcheck-2026-09-26.json) as replay inputs, and writes the combined set
// scratchpad/pick-check-replay-inputs-v2.json = the original 3 frozen cases
// (pick-check-replay-inputs.json) + these 2 live cases.
//
// Saved `recommendations` there is POST-check text, so the picks the live check rewrote
// get their original why/nonObvious restored from the dev log's "BEFORE" lines. Work keys
// come from the same log's "ids:" lines (in pick order). Facts are re-fetched once with
// the real lookupPickMetadata and frozen; a lookup that fails now is frozen as failed
// (the live run had The Stone Diaries time out), and reported below.
// Usage: node --env-file=.env.local scratchpad/pick-check-build-live-inputs.mts <dev.log>
import { register } from "node:module";
import { readFileSync, writeFileSync } from "fs";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        try { return await next(specifier, context); }
        catch (err) {
          if (specifier.startsWith(".") && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier + ".ts", context);
          throw err;
        }
      }`),
);
const { lookupPickMetadata } = await import("../lib/verify/lookupPickMetadata.ts");

const devLog = readFileSync(process.argv[2], "utf8").split("\n");
const live = JSON.parse(readFileSync("scratchpad/eval-run-finalcheck-2026-09-26.json", "utf8"));
const frozen = JSON.parse(readFileSync("scratchpad/pick-check-replay-inputs.json", "utf8"));

const pickArray = (text: string) => JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));

// Each request's log block starts at "recommend: pick sources"; take them in request order.
const blocks: string[][] = [];
devLog.forEach((line, i) => {
  if (line.startsWith("recommend: pick sources")) blocks.push(devLog.slice(i, i + 40));
});
if (blocks.length !== live.length) throw new Error(`expected ${live.length} request blocks in log, found ${blocks.length}`);

const out = [...frozen];
for (const [n, c] of live.entries()) {
  const block = blocks[n];
  const workKeys = block.filter((l) => l.startsWith("    ids: ol=")).slice(0, 3).map((l) => l.match(/ol=(\S+)/)![1]);
  const picks = pickArray(c.recommendations);
  for (const p of picks) {
    const i = block.findIndex((l) => l.startsWith(`  "${p.title}" — `) && l.includes(": rewritten"));
    if (i === -1) continue;
    const grab = (prefix: string) => block.slice(i + 1, i + 6).find((l) => l.startsWith(prefix))!.slice(prefix.length);
    p.why = grab("    why BEFORE: ");
    p.nonObvious = grab("    nonObvious BEFORE: ");
    console.log(`${c.id}: restored original text for "${p.title}"`);
  }
  const lookupPicks = picks.map((p: { title: string; author: string }, i: number) => ({
    title: p.title,
    author: p.author,
    sources: ["openlibrary"],
    record: { title: p.title, author: p.author, subjects: [], sources: ["openlibrary"], olWorkKey: workKeys[i] },
  }));
  const metadata = await lookupPickMetadata(lookupPicks);
  for (const m of metadata) {
    for (const l of m.lookups) if (l.status !== "ok") console.log(`${c.id}: lookup for "${m.title}" is ${l.status} ${l.error ?? ""} — frozen as-is`);
  }
  out.push({ id: `live-${c.id}`, tasteDescription: c.tasteDescription, recommendations: JSON.stringify(picks, null, 2), metadata });
  console.log(`live-${c.id}: ${picks.map((p: { title: string }, i: number) => `${p.title} (${workKeys[i]})`).join(" | ")}`);
}
writeFileSync("scratchpad/pick-check-replay-inputs-v2.json", JSON.stringify(out, null, 2));
console.log("wrote scratchpad/pick-check-replay-inputs-v2.json");
