// The readiness scorecard and its pieces compute what the readiness bar says (decision 3.8), with
// no model calls: length rules are checked in code, every gate and bar passes or misses at its
// threshold, doorways are judged separately, plain Claude is compared, and the review page hides
// scores until asked and can't be broken by book text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { align, lengthVerdict, type CaseScore, type Grade, type PickScore } from "../evals/judge/judge";
import { authorsMatch, titlesMatch } from "../evals/judge/catalog";
import { judgeAgreement, scorecard, type ScoredCase, type ScoredRun } from "../evals/judge/scorecard";
import { reviewPage } from "../evals/judge/review";

const facts = { status: "found" as const, found: true, subjects: [], tags: [], description: "" };
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
  assert.throws(() => lengthVerdict("tiny: under 50 pages", 40), /matches no band/);
});

test("pass marks compare exact counts: 79.7% doesn't round up to 80%", () => {
  const grades = (n: number, goodCount: number): Grade[][] => {
    const all: Grade[] = Array.from({ length: n }, (_, i) => (i < goodCount ? "good" : "weak"));
    return Array.from({ length: n / 3 }, (_, i) => all.slice(i * 3, i * 3 + 3));
  };
  // 59 picks can't be split into readers of 3, so use 69: 55 good = 79.7%
  const cases = grades(69, 55).map((g, i) => scored(`r${i}`, g));
  assert.deepEqual(rowOf(scorecard([run(cases)]), "Relevance").pass, [false]);
});

test("an unproven hard rule counts as a miss; weighed preferences are listed by type and flagged under 50%", () => {
  const unproven = scored("a", ["good", "good", "good"], {}, { picks: [pickScore("good", { hardRules: [{ item: "written for children", verdict: "unknown", reason: "" }] }), pickScore("good"), pickScore("good")] });
  assert.deepEqual(rowOf(scorecard([run([unproven])]), "Hard rules").pass, [false]);
  const w = (item: string, verdict: string) => ({ item, verdict, reason: "" });
  const mixed = scored("b", ["good", "good", "good"], {}, { picks: [
    pickScore("good", { weighed: [w("pace: slow", "yes"), w("style: witty", "no")] }),
    pickScore("good", { weighed: [w("pace: slow", "yes"), w("style: witty", "no")] }),
    pickScore("good", { weighed: [w("pace: slow", "yes"), w("style: witty", "yes")] }),
  ] });
  const value = rowOf(scorecard([run([mixed])]), "Weighed, by preference type").values[0];
  assert.match(value, /⚑ style 33% \(1\/3\)/);
  assert.match(value, /pace 100% \(3\/3\)/);
});

test("a check the judge skipped can't disappear: hard rules count as broken, preferences as not honoured", () => {
  const out = align(["avoid: horror", "fiction only"], [{ item: "Avoid: horror.", verdict: "pass", reason: "fine" }], "fail");
  assert.deepEqual(out.map((v) => v.verdict), ["pass", "fail"]);
  assert.equal(out[1].item, "fiction only");
});

test("catalog matches need both the title and the author's surname", () => {
  assert.ok(titlesMatch("Salt", "Salt: A World History"));
  assert.ok(titlesMatch("Cien años de soledad", "Cien Anos de Soledad"));
  assert.ok(!titlesMatch("Salt", "Salt Fat Acid Heat"));
  assert.ok(authorsMatch("Mark Kurlansky", ["Kurlansky, Mark", "Someone Else"]));
  assert.ok(!authorsMatch("Mark Kurlansky", ["Samin Nosrat"]));
});

test("a reader with no picks counts against 'every reader 2 of 3' and safety", () => {
  const failed = scored("b", [], { ok: false, picks: [], checks: { hardRules: [], strong: [], weighed: [], nonObviousRequired: false, safety: true } }, {});
  failed.score = null;
  const rows = scorecard([run([scored("a", ["good", "good", "good"]), failed])]);
  assert.deepEqual(rowOf(rows, "Relevance").pass, [false]);
  assert.deepEqual(rowOf(rows, "Safety").pass, [false]);
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
  assert.deepEqual(rowOf(rows, "Ready for the pilot?").pass, [true, false]); // run2 misses relevance
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
  const html = reviewPage({ title: "t", rows: scorecard([run([c])]), engineRuns: [run([c])], briefs: { a: "brief" } });
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.match(html, /\.score\{display:none/);
  assert.match(html, /Show scores/);
  assert.ok(html.indexOf("Scorecard (open after your gut check)") > html.indexOf("a book 0"), "the scorecard comes after the readers");
});
