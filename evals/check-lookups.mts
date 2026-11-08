// Re-runs the catalog lookup for every pick in a scored file and lists what changed, so a change
// to the lookup rules is checked against real books, not just reasoning about names. Free: catalog
// lookups only, no model calls.
//
//   SCORED=profile-v1-run1-rescored2-scored.json node --env-file=.env.local --import ./tests/support/resolve.mts evals/check-lookups.mts
//
// The bar for a stricter matching rule: every book found before is still found, as the same book.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lookupFacts, type CatalogFacts } from "./judge/catalog";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.SCORED;
if (!file) throw new Error("Set SCORED to a scored file in evals/results/, e.g. SCORED=profile-v1-run1-rescored2-scored.json");

interface Pick { title: string; author: string; facts: CatalogFacts }
interface Run { cases: Array<{ picks: Pick[] }> }
const data = JSON.parse(readFileSync(path.join(HERE, "results", file), "utf8")) as { engineRuns: Run[]; baseline?: Run };
const runs = [...data.engineRuns, ...(data.baseline ? [data.baseline] : [])];

const picks = new Map<string, Pick>();
for (const r of runs) for (const c of r.cases) for (const p of c.picks) picks.set(`${p.title}|${p.author}`.toLowerCase(), p);

const show = (f: CatalogFacts) => `${f.status}${f.source ? ` via ${f.source}` : ""}${f.title ? ` "${f.title}"` : ""}${f.author ? ` by ${f.author}` : ""}${f.pages ? `, ${f.pages}pp` : ""}${f.hardcoverReaders !== undefined ? `, ${f.hardcoverReaders} readers` : ""}`;

let lost = 0, gained = 0, changed = 0, same = 0;
for (const p of picks.values()) {
  const now = await lookupFacts(p.title, p.author);
  const was = p.facts;
  if (now.hardcoverError) console.log(`  (Hardcover failed for "${p.title}": ${now.hardcoverError})`);
  if (was.found && !now.found) {
    lost++;
    console.log(`LOST    "${p.title}" by ${p.author}\n        was: ${show(was)}\n        now: ${show(now)}`);
  } else if (!was.found && now.found) {
    gained++;
    console.log(`FOUND   "${p.title}" by ${p.author}\n        now: ${show(now)}`);
  } else if (was.found && now.found && (was.source !== now.source || was.title !== now.title || was.pages !== now.pages || was.hardcoverReaders !== now.hardcoverReaders)) {
    changed++;
    console.log(`CHANGED "${p.title}" by ${p.author}\n        was: ${show(was)}\n        now: ${show(now)}`);
  } else same++;
}
console.log(`\n${picks.size} books: ${same} unchanged · ${changed} changed · ${gained} newly found · ${lost} lost`);
console.log(lost ? "Check every LOST book: the bar is that none are lost." : "No book that was found before is lost.");
