// A reader's length request is enforced in code before the model chooses (decision 2.25): books
// outside the band plus 15% past each edge, or of unknown length, never reach the model, and the
// eval judge uses the same allowed range. Offline, with the shared harness's canned catalogs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "./support/offlineEngine";
import { allowedPages, fitsLength } from "@/lib/engine/profile/slots";
import { lengthVerdict } from "../evals/judge/judge";
import { clearPageCounts } from "@/lib/engine/sources/pageCounts";

test("each length band allows 15% past its edges (at least 25 pages)", () => {
  assert.deepEqual(allowedPages("quick"), { max: 230 });
  assert.deepEqual(allowedPages("short"), { min: 170, max: 345 });
  assert.deepEqual(allowedPages("medium"), { min: 255, max: 575 });
  assert.deepEqual(allowedPages("long"), { min: 425 });
  assert.ok(fitsLength("short", 320), "a fitting book a little past the band is allowed");
  assert.ok(!fitsLength("short", 351), "the Nov 6 baseline's 351-page 'short' pick is still out");
  assert.ok(!fitsLength("short", 157), "and so is its 157-page one");
});

test("the eval judge checks length with the same allowed range as the engine", () => {
  assert.equal(lengthVerdict("short: about 200 to 300 pages", 320).verdict, "pass");
  assert.equal(lengthVerdict("short: about 200 to 300 pages", 351).verdict, "fail");
  assert.equal(lengthVerdict("long: over 500 pages", 430).verdict, "pass");
});

const profile = (length?: string) => ({
  profile: {
    version: 1,
    doorway: "feeling",
    slots: {
      mood: { value: { words: ["quiet"], intensity: 3 }, source: "asked", confidence: "clear" },
      ...(length ? { length: { value: length, source: "asked", confidence: "clear" } } : {}),
    },
    answers: [],
    extras: [],
  },
  evalTag: "length-check",
});

// Every candidate the model was shown, from the tool results in the requests it received.
function shownToModel(requests: Array<{ url: string; body: string | null }>): string[] {
  const titles = new Set<string>();
  for (const r of requests) {
    if (!r.url.includes("api.anthropic.com") || !r.body) continue;
    for (const m of JSON.parse(r.body).messages ?? []) {
      if (!Array.isArray(m.content)) continue;
      for (const block of m.content) {
        if (block.type !== "tool_result") continue;
        for (const c of JSON.parse(block.content).pool ?? []) titles.add(c.title);
      }
    }
  }
  return [...titles];
}

test("with a length set, only books that fit reach the model, and the picks come from them", async () => {
  clearPageCounts();
  const res = await run({}, profile("short"));
  assert.equal(res.status, 200, res.responseText);
  const shown = shownToModel(res.requests);
  assert.ok(shown.length > 0);
  // The canned catalog gives Open Library books 250 pages (fit), 600 (too long) or no count
  // (unknown), and Hardcover-only books 280 (fit) or 900 (too long). Only fitting ones get through.
  for (const title of ["Gilead", "Stoner", "Our Souls at Night"]) assert.ok(!shown.includes(title), `${title} (600 pages or unknown) must not reach the model`);
  for (const title of ["The Go-Between", "Hotel du Lac"]) assert.ok(shown.includes(title), `${title} (250 pages) reaches the model`);
  const picks = JSON.parse(res.responseText).picks.map((p: { title: string }) => p.title);
  for (const t of picks) assert.ok(shown.includes(t), `${t} was a pick but never shown`);
  assert.ok(res.requests.some((r) => r.url.includes("search.json") && r.url.includes("key%3A")), "page counts were looked up");
});

test("without a length, no page counts are looked up and the pool is untouched", async () => {
  clearPageCounts();
  const res = await run({}, profile());
  assert.equal(res.status, 200, res.responseText);
  assert.ok(!res.requests.some((r) => r.url.includes("key%3A")), "no page count lookup");
  assert.ok(!res.requests.some((r) => r.body?.includes("query Pages")));
  assert.ok(shownToModel(res.requests).includes("Gilead"));
});
