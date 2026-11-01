// Direct check (2026-09-26, feat/verify-pick-descriptions step 3): run the real lookup +
// checkPickDescriptions on the Sept 23 baseline's case-8 answer, verbatim, including the
// Izzo pick's original wrong description ("a noir plot where the ex-cop protagonist...").
// Expect: Izzo rewritten; Sátántangó and Paris Trout confirmed (both were accurate).
// Work keys are the ones resolved for these picks in ol-pick-metadata-check-results.json.
// Usage: node --env-file=.env.local scratchpad/pick-check-izzo.mts [runs]
import { register } from "node:module";
import { readFileSync } from "fs";

// lib/ uses extensionless relative imports; retry unresolved relative specifiers with ".ts".
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

const { lookupPickMetadata, formatPickMetadata } = await import("../lib/verify/lookupPickMetadata.ts");
const { checkPickDescriptions, formatPickCheck } = await import("../lib/verify/checkPickDescriptions.ts");

const baseline = JSON.parse(readFileSync("scratchpad/eval-run-postfix-2026-09-23.json", "utf8"));
const case8 = baseline.find((c: { id: string }) => c.id === "case-8");

const workKeys: Record<string, string> = {
  "Sátántangó": "/works/OL3428975W",
  "Paris Trout": "/works/OL261852W",
  "Garlic, mint & sweet basil": "/works/OL19968899W",
};
const text: string = case8.recommendations;
const parsed = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
const picks = parsed.map((p: { title: string; author: string }) => ({
  title: p.title,
  author: p.author,
  sources: ["openlibrary"],
  record: { title: p.title, author: p.author, subjects: [], sources: ["openlibrary"], olWorkKey: workKeys[p.title] },
}));

const runs = Number(process.argv[2] ?? 1);
for (let i = 1; i <= runs; i++) {
  console.log(`\n===== run ${i}/${runs} =====`);
  const start = performance.now();
  const metadata = await lookupPickMetadata(picks);
  const lookupMs = Math.round(performance.now() - start);
  console.log(formatPickMetadata(metadata, lookupMs));
  const checked = await checkPickDescriptions(process.env.ANTHROPIC_API_KEY!, case8.tasteDescription, text, metadata);
  console.log(formatPickCheck(checked, lookupMs, Math.round(performance.now() - start)));
  console.log(`recommendations text changed: ${checked.recommendations !== text}`);
}
