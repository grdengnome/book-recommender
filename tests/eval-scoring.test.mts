// The readiness scorecard and its pieces compute what the readiness bar says (decision 3.8), with
// no model calls: length rules are checked in code, every gate and bar passes or misses at its
// threshold, doorways are judged separately, plain Claude is compared, and the review page hides
// scores until asked and can't be broken by book text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lengthVerdict, type CaseScore, type Grade, type PickScore } from "../evals/judge/judge";
import { judgeAgreement, scorecard, type ScoredCase, type ScoredRun } from "../evals/judge/scorecard";
import { reviewPage } from "../evals/judge/review";

const facts = { found: true, subjects: [], description: "" };
const pickScore = (relevance: Grade, extra: Partial<PickScore> = {}): PickScore => ({
  relevanceReason: "r", relevance, hardRules: [], strong: [], weighed: [], nonObviousReason: "n", nonObvious: "good", cardReason: "c", cardAccuracy: "pass", ...extra,
});
const scored = (id: string, grades: Grade[], over: Partial<ScoredCase> = {}, scoreOver: Partial<CaseScore> = {}): ScoredCase => ({
  id, label: id, doorway: "feeling", checks: { hardRules: [], strong: [], weighed: [], nonObviousRequired: false }, ok: true, serverMs: 15_000, costUsd: 0.08,
  picks: grades.map((_, i) => ({ title: `${id} book ${i}`, author: "A", card: "", facts })),
  score: { model: "judge", picks: grades.map((g) => pickScore(g)), rangeReason: "", range: "good", safetyReason: "", safety: "n/a", ...scoreOver }, ...over,
});
const run = (cases: ScoredCase[], name = "run1"): ScoredRun => ({ name, kind: "engine", set: "t", cases });
const rowOf = (rows: ReturnType<typeof scorecard>, name: string) => rows.find((r) => r.name === name)!;

test("length rules are checked from page counts, with 20 pages of slack", () => {
  assert.equal(lengthVerdict("quick: up to 200 pages", 215).verdict, "pass");
  assert.equal(lengthVerdict("quick: up to 200 pages", 260).verdict, "fail");
  assert.equal(lengthVerdict("long: over 500 pages", 470).verdict, "fail");
  assert.equal(lengthVerdict("short: about 200 to 300 pages", null).verdict, "unknown");
});

test("relevance passes only at 80% good+, with no fail and every reader 2 of 3", () => {
  const pass = scorecard([run([scored("a", ["good", "good", "excellent"]), scored("b", ["good", "excellent", "weak"])])]);
  assert.deepEqual(rowOf(pass, "Relevance").pass, [true]); // 5 of 6 = 83%
  const tooFew = scorecard([run([scored("a", ["good", "weak", "weak"]), scored("b", ["good", "good", "good"])])]);
  assert.deepEqual(rowOf(tooFew, "Relevance").pass, [false]); // reader a has 1 of 3
  const aFail = scorecard([run([scored("a", ["good", "good", "fail"]), scored("b", ["good", "good", "good"]), scored("c", ["good", "good", "good"]), scored("d", ["good", "good", "good"])])]);
  assert.deepEqual(rowOf(aFail, "Relevance").pass, [false]); // 92% but one fail
});

test("one broken hard rule misses the gate; speed gates use the server times", () => {
  const broken = scored("a", ["good", "good", "good"], {}, { picks: [pickScore("good", { hardRules: [{ item: "avoid: horror", verdict: "fail", reason: "" }] }), pickScore("good"), pickScore("good")] });
  const rows = scorecard([run([broken, scored("b", ["good", "good", "good"], { serverMs: 40_000 })])]);
  assert.deepEqual(rowOf(rows, "Hard rules").pass, [false]);
  assert.deepEqual(rowOf(rows, "Speed: median").pass, [false]); // median of 15s and 40s is 27.5s
  assert.deepEqual(rowOf(rows, "Speed: first pick visible").pass, [null]);
});

test("each run is scored separately, and each doorway on its own", () => {
  const r1 = run([scored("a", ["good", "good", "good"]), scored("b", ["good", "good", "good"], { doorway: "surprise" })], "run1");
  const r2 = run([scored("a", ["good", "good", "good"]), scored("b", ["weak", "weak", "good"], { doorway: "surprise" })], "run2");
  const rows = scorecard([r1, r2]);
  assert.deepEqual(rowOf(rows, "Relevance").pass, [true, false]);
  assert.deepEqual(rowOf(rows, "Doorway: surprise").pass, [true, false]);
  assert.deepEqual(rowOf(rows, "Doorway: feeling").pass, [true, true]);
});

test("the engine must beat plain Claude by at least 10 points of good+ relevance", () => {
  const engine = run([scored("a", ["good", "good", "good"]), scored("b", ["good", "good", "weak"])]); // 83%
  const close: ScoredRun = { ...run([scored("a", ["good", "good", "good"]), scored("b", ["good", "weak", "weak"])], "plain Claude"), kind: "baseline" }; // 67%
  assert.deepEqual(rowOf(scorecard([engine], close), "Beats plain Claude on relevance").pass, [true]);
  const level: ScoredRun = { ...run([scored("a", ["good", "good", "good"]), scored("b", ["good", "good", "weak"])], "plain Claude"), kind: "baseline" };
  assert.deepEqual(rowOf(scorecard([engine], level), "Beats plain Claude on relevance").pass, [false]);
});

test("second-judge agreement counts picks landing in the same bucket", () => {
  const c = scored("a", ["good", "weak", "excellent"]);
  c.second = { ...c.score!, picks: [pickScore("excellent"), pickScore("good"), pickScore("good")] };
  assert.deepEqual(judgeAgreement([run([c])]), { compared: 3, agreed: 2 });
});

test("the review page hides scores until asked and escapes book text", () => {
  const c = scored("a", ["good", "good", "good"]);
  c.picks[0].title = "<script>alert(1)</script>";
  const html = reviewPage({ title: "t", rows: scorecard([run([c])]), runNames: ["run1"], engine: run([c]), briefs: { a: "brief" } });
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.match(html, /\.score\{display:none/);
  assert.match(html, /Show scores/);
});
