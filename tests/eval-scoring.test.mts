// The readiness scorecard and its pieces compute what the readiness bar says (decision 3.8), with
// no model calls: length rules are checked in code, every gate and bar passes or misses at its
// threshold, doorways are judged separately, plain Claude is compared, and the review page hides
// scores until asked and can't be broken by book text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { align, judgeCase, lengthVerdict, type CaseScore, type Grade, type PickScore } from "../evals/judge/judge";
import { OutOfCreditsError, StopScoringError } from "../evals/judge/errors";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { authorsMatch, authorsMatchStrict, lookupFacts, titlesMatch } from "../evals/judge/catalog";
import { judgeAgreement, preferenceRow, scorecard, withEvidence, type ScoredCase, type ScoredRun } from "../evals/judge/scorecard";
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

test("length rules are checked from page counts, with 15% past each edge allowed (decision 2.25)", () => {
  assert.equal(lengthVerdict("quick: up to 200 pages", 225).verdict, "pass");
  assert.equal(lengthVerdict("quick: up to 200 pages", 260).verdict, "fail");
  assert.equal(lengthVerdict("long: over 500 pages", 420).verdict, "fail");
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
  assert.ok(titlesMatch("Jonathan Strange & Mr Norrell", "Jonathan Strange and Mr Norrell"));
  assert.ok(titlesMatch("Cien años de soledad", "Cien Anos de Soledad"));
  assert.ok(!titlesMatch("Salt", "Salt Fat Acid Heat"));
  assert.ok(authorsMatch("Mark Kurlansky", ["Kurlansky, Mark", "Someone Else"]));
  assert.ok(!authorsMatch("Mark Kurlansky", ["Samin Nosrat"]));
});

test("a catalog search sent with a subtitle retries with the main title (Salt: A World History)", async () => {
  const realFetch = globalThis.fetch;
  const savedToken = process.env.HARDCOVER_API_TOKEN;
  delete process.env.HARDCOVER_API_TOKEN;
  const searched: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/search.json") {
      const t = url.searchParams.get("title") ?? "";
      searched.push(t);
      const docs = t === "Salt" ? [{ key: "/works/OL1W", title: "Salt", author_name: ["Mark Kurlansky"], number_of_pages_median: 484 }] : [];
      return new Response(JSON.stringify({ docs }));
    }
    return new Response(JSON.stringify({ description: "A history of salt." }));
  }) as typeof fetch;
  try {
    const f = await lookupFacts("Salt: A World History", "Mark Kurlansky");
    assert.equal(f.status, "found");
    assert.equal(f.pages, 484);
    assert.deepEqual(searched, ["Salt: A World History", "Salt"]);
  } finally {
    globalThis.fetch = realFetch;
    if (savedToken !== undefined) process.env.HARDCOVER_API_TOKEN = savedToken;
  }
});

// A stand-in for the catalogs: Open Library answers from `ol(title, hasAuthorParam)`, Hardcover
// from `hc(query)`. Restores fetch and the token afterwards.
async function withCatalogs(opts: { ol: (title: string, withAuthor: boolean) => unknown[]; hc?: (query: string) => Response }, fn: () => Promise<void>) {
  const realFetch = globalThis.fetch;
  const savedToken = process.env.HARDCOVER_API_TOKEN;
  if (opts.hc) process.env.HARDCOVER_API_TOKEN = "test-token";
  else delete process.env.HARDCOVER_API_TOKEN;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "api.hardcover.app") return opts.hc!(JSON.parse(String(init?.body)).query);
    if (url.pathname === "/search.json") return new Response(JSON.stringify({ docs: opts.ol(url.searchParams.get("title") ?? "", url.searchParams.has("author")) }));
    return new Response(JSON.stringify({ description: "" }));
  }) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = realFetch;
    if (savedToken === undefined) delete process.env.HARDCOVER_API_TOKEN;
    else process.env.HARDCOVER_API_TOKEN = savedToken;
  }
}

test("a translated author listed in their own script still matches by the romanised name", async () => {
  await withCatalogs({ ol: () => [{ key: "/works/OL2W", title: "Kokoro", author_name: ["夏目漱石"], author_alternative_name: ["Natsume Sōseki"], number_of_pages_median: 248 }] }, async () => {
    const f = await lookupFacts("Kokoro", "Natsume Soseki");
    assert.equal(f.status, "found");
    assert.equal(f.pages, 248);
  });
});

test("Open Library's last try searches by title alone and matches the author in code", async () => {
  await withCatalogs({ ol: (_t, withAuthor) => (withAuthor ? [] : [{ key: "/works/OL3W", title: "Cursed Bunny", author_name: ["Chung, Bora"] }]) }, async () => {
    assert.equal((await lookupFacts("Cursed Bunny", "Bora Chung")).status, "found");
  });
});

test("Hardcover is found through its search endpoint, then its tags are fetched by id", async () => {
  const hc = (query: string) => query.includes("search(")
    ? new Response(JSON.stringify({ data: { search: { results: { hits: [{ document: { id: 42, title: "Cursed Bunny", author_names: ["Bora Chung"] } }] } } } }))
    : new Response(JSON.stringify({ data: { books: [{ title: "Cursed Bunny", users_count: 900, pages: 256, release_year: 2017, description: "Stories.", contributions: [{ author: { name: "Bora Chung" } }], cached_tags: { Genre: [{ tag: "Horror" }], Mood: [{ tag: "Dark" }] } }] } }));
  await withCatalogs({ ol: () => [], hc }, async () => {
    const f = await lookupFacts("Cursed Bunny", "Bora Chung");
    assert.equal(f.source, "hardcover");
    assert.deepEqual(f.tags, ["Horror", "Dark"]);
    assert.equal(f.hardcoverReaders, 900);
  });
});

test("Hardcover's most-read record of a book wins over a duplicate with few readers", async () => {
  const hc = (query: string) => query.includes("search(")
    ? new Response(JSON.stringify({ data: { search: { results: { hits: [
      { document: { id: 7, title: "Kokoro", author_names: ["Natsume Sōseki"] } },
      { document: { id: 8, title: "Kokoro", author_names: ["Natsume Soseki"] } },
    ] } } } }))
    : new Response(JSON.stringify({ data: { books: [
      { title: "Kokoro", users_count: 14, pages: 200, release_year: 2010, description: "", contributions: [], cached_tags: {} },
      { title: "Kokoro", users_count: 5000, pages: 248, release_year: 1914, description: "", contributions: [], cached_tags: {} },
    ] } }));
  await withCatalogs({ ol: () => [], hc }, async () => {
    const f = await lookupFacts("Kokoro", "Natsume Soseki");
    assert.equal(f.hardcoverReaders, 5000);
  });
});

test("a refused Hardcover lookup is reported on the facts, not silently dropped", async () => {
  let calls = 0;
  const hc = () => {
    calls++;
    return new Response(JSON.stringify({ error: "ilike and related operations are not permitted on this server." }), { status: 403 });
  };
  await withCatalogs({ ol: () => [], hc }, async () => {
    const f = await lookupFacts("Kokoro", "Natsume Soseki");
    assert.equal(f.status, "not_found");
    assert.match(f.hardcoverError ?? "", /403/);
    assert.equal(calls, 1, "a refusal isn't retried");
  });
});

test("preferences the facts can't settle are reported, not scored, and can't pass on thin evidence", () => {
  assert.deepEqual(preferenceRow(8, 12, 2, 75), ["80% (8/10) · couldn't verify 2 (worst case 67%)", true]);
  assert.deepEqual(preferenceRow(6, 12, 2, 75), ["60% (6/10) · couldn't verify 2 (worst case 50%)", false]);
  assert.deepEqual(preferenceRow(9, 12, 0, 75), ["75% (9/12) · couldn't verify 0", true]);
  assert.deepEqual(preferenceRow(4, 12, 7, 75), ["not enough evidence: 5/12 checkable · couldn't verify 7", false]);
});

test("the strict author check (title-only searches) accepts real naming differences and rejects a different author", () => {
  const same: Array<[string, string]> = [
    ["Mark Kurlansky", "Kurlansky, Mark"],
    ["Natsume Soseki", "Sōseki Natsume"],
    ["Gabriel Garcia Marquez", "García Márquez, Gabriel"],
    ["J.R.R. Tolkien", "John Ronald Reuel Tolkien"],
    ["John Ronald Reuel Tolkien", "J. R. R. Tolkien"],
    ["Ursula K. Le Guin", "Ursula Le Guin"],
    ["Ursula Le Guin", "Le Guin, Ursula K."],
    ["Amal El-Mohtar", "Amal El Mohtar"],
    ["Colette", "Sidonie-Gabrielle Colette"],
    ["Bora Chung", "Chung, Bora"],
  ];
  for (const [wanted, cand] of same) assert.ok(authorsMatchStrict(wanted, [cand]), `${wanted} should match ${cand}`);
  assert.ok(authorsMatchStrict("Natsume Soseki", ["夏目漱石", "Natsume Sōseki"]), "any listed spelling can match");
  assert.ok(authorsMatchStrict("Amal El-Mohtar and Max Gladstone", ["Max Gladstone"]), "any one co-author can match");
  assert.ok(authorsMatchStrict("Douglas Preston & Lincoln Child", ["Child, Lincoln"]));
  const different: Array<[string, string]> = [
    ["Zadie Smith", "Ali Smith"],
    ["Marilynne Robinson", "Kim Stanley Robinson"],
    ["Mark Kurlansky", "Kurlansky"],
  ];
  for (const [wanted, cand] of different) assert.ok(!authorsMatchStrict(wanted, [cand]), `${wanted} shouldn't match ${cand}`);
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

test("plain Claude is compared on the same readers: one it failed to answer is left out on both sides", () => {
  const engine = run([scored("a", ["good", "good", "good"]), scored("b", ["weak", "weak", "weak"])]);
  const failed = scored("b", [], { ok: false, picks: [] });
  failed.score = null;
  const plain: ScoredRun = { ...run([scored("a", ["good", "weak", "weak"]), failed], "plain Claude"), kind: "baseline" };
  const row = rowOf(scorecard([engine], plain), "Beats plain Claude on relevance");
  assert.match(row.values[0], /^\+66\.7 points \(100% vs 33%, 1 readers; left out: 1 plain Claude failed\)$/);
  assert.deepEqual(row.pass, [true]);
});

// A stand-in for the model provider that returns one fixed judge answer and counts the calls.
async function withJudgeReplies(reply: () => Response, fn: (calls: () => number, bodies: Record<string, unknown>[]) => Promise<void>) {
  const realFetch = globalThis.fetch;
  const saved = { key: process.env.ANTHROPIC_API_KEY, dir: process.env.EVAL_CACHE_DIR, noCache: process.env.NO_CACHE };
  process.env.ANTHROPIC_API_KEY = "sk-ant-FAKE-test-key";
  process.env.EVAL_CACHE_DIR = mkdtempSync(path.join(tmpdir(), "eval-cache-"));
  delete process.env.NO_CACHE;
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return reply();
  }) as typeof fetch;
  try {
    await fn(() => bodies.length, bodies);
  } finally {
    globalThis.fetch = realFetch;
    for (const [k, env] of [["key", "ANTHROPIC_API_KEY"], ["dir", "EVAL_CACHE_DIR"], ["noCache", "NO_CACHE"]] as const) {
      if (saved[k] === undefined) delete process.env[env];
      else process.env[env] = saved[k];
    }
  }
}

const judgeAnswer = () => new Response(JSON.stringify({
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify({ picks: [pickScore("good")], rangeReason: "", range: "good", safetyReason: "", safety: "n/a" }) }],
}));
const oneCase = { brief: "A reader.", checks: { hardRules: [], strong: [], weighed: [], nonObviousRequired: false }, picks: [{ title: "T", author: "A", card: "why", facts }] };

test("an identical question to the judge is answered from memory for free", async () => {
  await withJudgeReplies(judgeAnswer, async (calls, bodies) => {
    const first = await judgeCase(oneCase);
    assert.equal(bodies[0].temperature, undefined, "the judge's model refuses a temperature setting");
    assert.equal(first.reused, false);
    const again = await judgeCase(oneCase);
    assert.equal(calls(), 1, "the second identical question isn't paid for");
    assert.equal(again.reused, true);
    assert.equal(again.picks[0].relevance, "good");
    await judgeCase({ ...oneCase, picks: [{ ...oneCase.picks[0], title: "Another book" }] });
    assert.equal(calls(), 2, "a changed pick is asked afresh");
    process.env.NO_CACHE = "1";
    await judgeCase(oneCase);
    assert.equal(calls(), 3, "NO_CACHE=1 asks afresh");
  });
});

test("a verdict given while Hardcover's evidence was missing isn't remembered", async () => {
  await withJudgeReplies(judgeAnswer, async (calls) => {
    const thin = { ...oneCase, picks: [{ ...oneCase.picks[0], facts: { ...facts, hardcoverError: "status 429" } }] };
    await judgeCase(thin);
    await judgeCase(thin);
    assert.equal(calls(), 2, "asked again, since the first answer was on incomplete evidence");
  });
});

test("an unreadable saved-answers file is set aside, not fatal", async () => {
  await withJudgeReplies(judgeAnswer, async (calls) => {
    const dir = process.env.EVAL_CACHE_DIR!;
    writeFileSync(path.join(dir, "judge.json"), '{"half-written');
    const realWarn = console.warn;
    console.warn = () => {};
    try {
      await judgeCase({ ...oneCase, brief: "A different reader." });
    } finally {
      console.warn = realWarn;
    }
    assert.equal(calls(), 1);
    assert.ok(readdirSync(dir).some((f) => f.startsWith("judge.json.unreadable-")));
    assert.ok(existsSync(path.join(dir, "judge.json")));
  });
});

test("if Hardcover failed for over 1 in 10 picks, the rows that lean on it miss as evidence incomplete", () => {
  assert.deepEqual(withEvidence({ hardcoverErrors: 1, lookedUp: 10 }, ["90%", true]), ["90%", true]);
  assert.deepEqual(withEvidence({ hardcoverErrors: 2, lookedUp: 10 }, ["90%", true]), ["evidence incomplete: Hardcover failed for 2 of 10 picks · 90%", false]);
});

test("a request the API refuses as invalid stops scoring instead of failing every reader", async () => {
  const refused = () => new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "`temperature` is deprecated for this model." } }), { status: 400 });
  await withJudgeReplies(refused, async () => {
    await assert.rejects(judgeCase(oneCase), StopScoringError);
  });
});

test("running out of API credit stops with a clear error instead of failing reader by reader", async () => {
  const broke = () => new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }), { status: 400 });
  await withJudgeReplies(broke, async () => {
    await assert.rejects(judgeCase(oneCase), OutOfCreditsError);
  });
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
