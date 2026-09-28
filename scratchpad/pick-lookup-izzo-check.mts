// Direct check (2026-09-26, feat/verify-pick-descriptions step 2): run the real
// lookupPickMetadata on Izzo's "Garlic, mint & sweet basil" (/works/OL19968899W) to
// confirm the lookup surfaces its "history and criticism" subjects — the signal that it's
// essays about noir, not a noir novel (the Sept 23 case-8 description error).
// Usage: node --env-file=.env.local scratchpad/pick-lookup-izzo-check.mts
import { register } from "node:module";

// lib/ uses extensionless relative imports (resolved by Next's bundler). Node's native
// type stripping doesn't resolve those, so retry unresolved relative specifiers with ".ts".
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

const pick = {
  title: "Garlic, mint & sweet basil",
  author: "Jean-Claude Izzo",
  sources: ["openlibrary"],
  record: {
    title: "Garlic, mint & sweet basil",
    author: "Jean-Claude Izzo",
    subjects: [],
    sources: ["openlibrary"],
    olWorkKey: "/works/OL19968899W",
  },
};

const start = performance.now();
const results = await lookupPickMetadata([pick]);
console.log(formatPickMetadata(results, Math.round(performance.now() - start)));

const subjects = results[0].lookups.flatMap((l) => (l.source === "openlibrary" ? l.subjects : []));
const hc = subjects.filter((s) => /history and criticism/i.test(s));
console.log(`\n"history and criticism" subjects surfaced: ${hc.length} -> ${JSON.stringify(hc)}`);
