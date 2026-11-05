// Every eval case set in evals/cases/ is well-formed, so a typo in a new set is caught before
// anyone pays to run it: unique ids, every required field present, focus names taken from the
// rubric (docs/quality/eval-set.md), a known status, and each profile case passes the same
// checks the route applies.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProfile } from "@/lib/engine/profile/validateProfile";

const CASES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "evals", "cases");
const DIMENSIONS = ["relevance", "non-obviousness", "range", "real & correct", "traceability", "variety across sessions"];
const STATUSES = ["active", "approximation"];

for (const file of readdirSync(CASES_DIR).filter((f) => f.endsWith(".json"))) {
  test(`eval case set ${file} is well-formed`, () => {
    const set = JSON.parse(readFileSync(path.join(CASES_DIR, file), "utf8"));
    assert.equal(set.set, file.replace(/\.json$/, ""), "the set field matches the file name");
    assert.ok(typeof set.description === "string" && set.description.length > 0, "has a description");
    assert.ok(Array.isArray(set.cases) && set.cases.length > 0, "has cases");
    const ids = new Set<string>();
    for (const c of set.cases) {
      assert.match(c.id, /^[a-z0-9-]+$/, `id "${c.id}" is lowercase letters, digits and dashes`);
      assert.ok(!ids.has(c.id), `id ${c.id} is unique`);
      ids.add(c.id);
      for (const field of ["label", "tests"]) {
        assert.ok(typeof c[field] === "string" && c[field].trim(), `${c.id} has ${field}`);
      }
      // Each case is a taste profile (decision 2.24) or a legacy paragraph, never both.
      assert.ok((c.profile === undefined) !== (c.tasteDescription === undefined), `${c.id} has exactly one of profile or tasteDescription`);
      if (c.tasteDescription !== undefined) assert.ok(typeof c.tasteDescription === "string" && c.tasteDescription.trim(), `${c.id} tasteDescription is text`);
      if (c.profile !== undefined) {
        const check = validateProfile(c.profile);
        assert.ok(check.ok, `${c.id} profile is valid: ${check.ok ? "" : check.problems.join("; ")}`);
      }
      assert.ok(STATUSES.includes(c.status), `${c.id} status is one of ${STATUSES.join(", ")}`);
      assert.ok(Array.isArray(c.focus) && c.focus.length > 0, `${c.id} has focus dimensions`);
      for (const d of c.focus) assert.ok(DIMENSIONS.includes(d), `${c.id} focus "${d}" is a rubric dimension`);
    }
  });
}
