// Builds the FIXED input set for replaying the step-3 pick check (2026-09-26,
// feat/verify-pick-descriptions), so prompt changes are compared on identical inputs.
// Writes scratchpad/pick-check-replay-inputs.json: per case, the taste description, the
// ORIGINAL (pre-check) recommendations text, and the looked-up catalog facts.
//
// Sources:
// - case-8: Sept 23 baseline answer verbatim (eval-run-postfix-2026-09-23.json).
// - case-1 / case-5: today's pickcheck run (eval-run-pickcheck-2026-09-26.json). Its saved
//   `recommendations` is the POST-check text, so the two picks the check rewrote
//   (Strangers, Adrian Mole) get their original why/nonObvious restored from the dev
//   server log's "BEFORE" lines (path passed as argv[2]).
// - Facts: fetched once here with the real lookupPickMetadata on the same work keys the
//   route used (from the same dev log / the Sept 23 resolution), then frozen in the file.
// Usage: node --env-file=.env.local scratchpad/pick-check-build-replay-inputs.mts <dev.log>
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
const baseline = JSON.parse(readFileSync("scratchpad/eval-run-postfix-2026-09-23.json", "utf8"));
const pickcheck = JSON.parse(readFileSync("scratchpad/eval-run-pickcheck-2026-09-26.json", "utf8"));

const pickArray = (text: string) => JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));

// Original why/nonObvious for a rewritten pick, from its formatPickCheck block in the log.
function beforeText(title: string) {
  const i = devLog.findIndex((l) => l.startsWith(`  "${title}" — `) && l.includes(": rewritten"));
  if (i === -1) throw new Error(`no rewritten block for ${title} in dev log`);
  const grab = (prefix: string) => {
    const line = devLog.slice(i + 1, i + 6).find((l) => l.startsWith(prefix));
    if (!line) throw new Error(`missing ${prefix.trim()} for ${title}`);
    return line.slice(prefix.length);
  };
  return { why: grab("    why BEFORE: "), nonObvious: grab("    nonObvious BEFORE: ") };
}

const cases = [
  {
    id: "case-8",
    tasteDescription: baseline.find((c: { id: string }) => c.id === "case-8").tasteDescription,
    picks: pickArray(baseline.find((c: { id: string }) => c.id === "case-8").recommendations),
    workKeys: ["/works/OL3428975W", "/works/OL261852W", "/works/OL19968899W"],
    restore: [] as string[],
  },
  {
    id: "case-1",
    tasteDescription: pickcheck.find((c: { id: string }) => c.id === "case-1").tasteDescription,
    picks: pickArray(pickcheck.find((c: { id: string }) => c.id === "case-1").recommendations),
    workKeys: ["/works/OL1875009W", "/works/OL477535W", "/works/OL14919676W"],
    restore: ["Strangers"],
  },
  {
    id: "case-5",
    tasteDescription: pickcheck.find((c: { id: string }) => c.id === "case-5").tasteDescription,
    picks: pickArray(pickcheck.find((c: { id: string }) => c.id === "case-5").recommendations),
    workKeys: ["/works/OL1793164W", "/works/OL549600W", "/works/OL88876W"],
    restore: ["Adrian Mole"],
  },
];

const out = [];
for (const c of cases) {
  for (const title of c.restore) Object.assign(c.picks.find((p: { title: string }) => p.title === title), beforeText(title));
  const picks = c.picks.map((p: { title: string; author: string }, i: number) => ({
    title: p.title,
    author: p.author,
    sources: ["openlibrary"],
    record: { title: p.title, author: p.author, subjects: [], sources: ["openlibrary"], olWorkKey: c.workKeys[i] },
  }));
  const metadata = await lookupPickMetadata(picks);
  const failed = metadata.flatMap((m) => m.lookups.filter((l) => l.status !== "ok").map((l) => `${m.title}: ${l.status} ${l.error ?? ""}`));
  if (failed.length) throw new Error(`lookup not ok, not freezing inputs: ${failed.join("; ")}`);
  out.push({ id: c.id, tasteDescription: c.tasteDescription, recommendations: JSON.stringify(c.picks, null, 2), metadata });
  console.log(`${c.id}: ${c.picks.map((p: { title: string }) => p.title).join(" | ")}`);
}
writeFileSync("scratchpad/pick-check-replay-inputs.json", JSON.stringify(out, null, 2));
console.log("wrote scratchpad/pick-check-replay-inputs.json");
