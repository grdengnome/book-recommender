// The merge must dedupe across catalogs and never pass popularity, source or IDs to the model.
// These check lib/merge/mergeCandidatePools.ts with no network and no model calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeCandidatePools, toModelPool } from "@/lib/merge/mergeCandidatePools";

const quiet = () => {
  const log = console.log;
  console.log = () => {};
  return () => (console.log = log);
};

test("a book found in both catalogs appears once and keeps both sources and IDs", () => {
  const restore = quiet();
  const { pool } = mergeCandidatePools(
    [{ title: "Stoner", author: "John Williams", subjects: ["campus fiction"], olWorkKey: "/works/OL1W" }],
    [{ title: "Stoner", author: "John Williams", subjects: ["literary"], usersCount: 900, hcBookId: 42 }],
  );
  restore();
  assert.equal(pool.length, 1);
  assert.deepEqual([...pool[0].sources].sort(), ["hardcover", "openlibrary"]);
  assert.equal(pool[0].olWorkKey, "/works/OL1W");
  assert.equal(pool[0].hcBookId, 42);
});

test("what the model sees has only title, author and subjects", () => {
  const restore = quiet();
  const { pool } = mergeCandidatePools(
    [{ title: "Stoner", author: "John Williams", subjects: ["campus fiction"], olWorkKey: "/works/OL1W" }],
    [{ title: "Kokoro", author: "Natsume Soseki", subjects: ["japanese fiction"], usersCount: 500, hcBookId: 7 }],
  );
  restore();
  for (const candidate of toModelPool(pool)) {
    assert.deepEqual(Object.keys(candidate).sort(), ["author", "subjects", "title"]);
  }
});

test("every input book survives the merge (nothing silently dropped)", () => {
  const restore = quiet();
  const ol = Array.from({ length: 20 }, (_, i) => ({ title: `Book ${i}`, author: `Author ${i}`, subjects: [] }));
  const hc = Array.from({ length: 10 }, (_, i) => ({ title: `HC Book ${i}`, author: `HC Author ${i}`, subjects: [], usersCount: i, hcBookId: i }));
  const { pool, stats } = mergeCandidatePools(ol, hc);
  restore();
  assert.equal(pool.length, 30);
  assert.equal(stats.duplicatesRemoved, 0);
});
