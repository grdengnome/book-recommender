// The engine's core promise: every pick comes from a pool the model was actually shown.
// These check lib/engine/pool/pickGrounding.ts with no network and no model calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPickGrounding, recordSeenCandidates, type SeenCandidates } from "@/lib/engine/pool/pickGrounding";
import type { MergedBookCandidate } from "@/lib/engine/pool/mergeCandidatePools";

function poolOf(...books: Partial<MergedBookCandidate>[]): SeenCandidates {
  const seen: SeenCandidates = new Map();
  recordSeenCandidates(
    seen,
    books.map((b) => ({ subjects: [], sources: ["openlibrary"], title: "", author: "", ...b })),
  );
  return seen;
}

test("a pick that is in the pool is grounded", () => {
  const seen = poolOf({ title: "The Remains of the Day", author: "Kazuo Ishiguro" });
  const result = checkPickGrounding([{ title: "The Remains of the Day", author: "Kazuo Ishiguro" }], seen);
  assert.equal(result.status, "grounded");
});

test("a pick that is not in the pool is rejected (no fallback to the model's own knowledge)", () => {
  const seen = poolOf({ title: "The Remains of the Day", author: "Kazuo Ishiguro" });
  const result = checkPickGrounding(
    [
      { title: "The Remains of the Day", author: "Kazuo Ishiguro" },
      { title: "Never Let Me Go", author: "Kazuo Ishiguro" },
    ],
    seen,
  );
  assert.equal(result.status, "ungrounded");
  assert.deepEqual(result.picks[1].sources, []);
});

test("accents written two different ways still match (Sept 20 false-rejection bug)", () => {
  // Open Library stores the decomposed form (a + combining accent); the model writes precomposed.
  const seen = poolOf({ title: "Sátántangó", author: "László Krasznahorkai" });
  const result = checkPickGrounding([{ title: "Sátántangó", author: "László Krasznahorkai" }], seen);
  assert.equal(result.status, "grounded");
});

test("a dropped subtitle still matches", () => {
  const seen = poolOf({ title: "Stoner: A Novel", author: "John Williams" });
  assert.equal(checkPickGrounding([{ title: "Stoner", author: "John Williams" }], seen).status, "grounded");
});

test("same title by a different author does not match", () => {
  const seen = poolOf({ title: "Kokoro", author: "Natsume Soseki" });
  assert.equal(checkPickGrounding([{ title: "Kokoro", author: "Someone Else" }], seen).status, "ungrounded");
});

test("an empty author is never a wildcard", () => {
  const seen = poolOf({ title: "Kokoro", author: "Natsume Soseki" });
  assert.equal(checkPickGrounding([{ title: "Kokoro", author: "" }], seen).status, "ungrounded");
});

test("non-Latin author names can still ground a pick", () => {
  const seen = poolOf({ title: "Kokoro", author: "夏目漱石" });
  assert.equal(checkPickGrounding([{ title: "Kokoro", author: "夏目漱石" }], seen).status, "grounded");
});
