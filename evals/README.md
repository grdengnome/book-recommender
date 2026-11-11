# evals/

> **Status:** Living · How recommendation quality is measured. Last updated Nov 5, 2026.

Every change to prompts, models or recommendation logic is checked against the eval set before it ships (CLAUDE.md, "Eval discipline"; decision 14.3 for model changes).

- **Rubric and cases:** [`docs/quality/eval-set.md`](../docs/quality/eval-set.md) (6 dimensions, fail/weak/good/excellent). The cases themselves are data in `cases/`.
- **Findings:** [`docs/quality/eval-log.md`](../docs/quality/eval-log.md).
- **Raw output:** `evals/results/` (gitignored).

## Running an eval
One runner, `run.mjs`, sends a set of cases to the live `/api/recommend` route one at a time and prints a summary. It needs `npm run dev` running and real API keys in `.env.local`. **It costs money** (about $0.09 per case), so it's run deliberately, never automatically.

```
ENGINE_TRACE=1 npm run dev                                        # terminal 1
SET=legacy-v0 CASE_IDS=case-1,case-5 TAG_PREFIX=mytest node evals/run.mjs   # terminal 2
```

| Setting | What it does |
|---|---|
| `SET` | Which case set to run, a file in `cases/` (default `legacy-v0`) |
| `CASE_IDS` | Run only these cases, in this order (default: the whole set) |
| `TAG_PREFIX` | Tags each request, so its logs and traces are easy to find later |
| `OUT` | Results file name in `evals/results/` (default `<set>-<tag prefix>.json`) |

The summary shows, per case: picks returned, server and driver time, and (with tracing on) cost and which models ran. It holds no reader data, so it can be pasted into a PR. Attempts, pick sources and pool sizes are in each request's debug trace in `.local/traces/`.

Common subsets of `legacy-v0`: the clustering cases `CASE_IDS=case-3,case-4,case-6,case-8`; the Oct 22 timing baseline `CASE_IDS=case-1,case-5,case-6,case-8,case-9,case-10`.

To try a different model for one job, set its override (for example `AI_SLOT_CARD_WRITING=...` in `.env.local`, see `lib/ai/slots.ts`), restart the dev server and run the cases; the models column confirms which models ran.

## Scoring against the readiness bar
After a run, the judge scores it against the [readiness bar](../docs/quality/readiness-bar.md). Both commands cost money and need the API key; neither needs the dev server. `--env-file=.env.local` loads the key: the dev server reads `.env.local` by itself, standalone scripts don't.

```
node --env-file=.env.local --import ./tests/support/resolve.mts evals/calibrate.mts                 # once per judge model, about $0.20
RUNS=profile-v1-run1.json BASELINE=1 node --env-file=.env.local --import ./tests/support/resolve.mts evals/score.mts
```

- **The card check** (`judge/cardCheck.ts`, decision 2.26) reads each engine card in full (hook, why, angle, mood word) against the catalog facts and flags claims they contradict, plus whether a heads-up about a gap was warranted. When it runs, it decides the "card errors" count; the main judge still reads only the one-line "why", so the plain-Claude comparison stays about the books.
- `compare-cards.mts` tests a change to the card writer on the same picks, without rerunning the engine: it replays a past run's card-writing requests (from its debug traces) with today's card instructions and has the card check read old and new cards side by side (`RUN=profile-v1-run1.json TAG_PREFIX=run1 node --env-file=.env.local --import ./tests/support/resolve.mts evals/compare-cards.mts`; `ONLY=` limits readers). A controlled before/after for about a third of the cost of a fresh run.
- **Paid answers are remembered** (`evals/results/cache/`, gitignored): an identical question to the judge (same judge version and model, brief, checks, picks and catalog facts) or to plain Claude (same brief, model and prompt) is answered from memory for free. Rescoring after an engine change only pays for readers whose picks changed, and unchanged picks can't change grade by chance. `NO_CACHE=1` asks the judge afresh (to measure its own randomness) while plain Claude's answers stay fixed; calibration always asks afresh. An answer given while a Hardcover lookup had failed isn't remembered. Run one scoring at a time. The scorecard's "Judge answers paid for" row shows new vs remembered.
- **Catalog facts are saved too** (`facts.json` in the same folder) and reused while the lookup rules (`judge/catalog.ts`) are unchanged, so a rescore sees exactly the same evidence (Hardcover's reader counts drift daily) and skips the slow lookups. `REFRESH_FACTS=1` looks every book up again.
- `check-lookups.mts` (free, no model calls) re-runs the catalog lookup for every pick in a scored file and lists books that changed, were newly found, or were lost: run it after any change to the lookup rules (`SCORED=<file>-scored.json node --env-file=.env.local --import ./tests/support/resolve.mts evals/check-lookups.mts`). The bar: no book found before is lost.
- If Hardcover's lookup fails for more than 1 in 10 picks, the rows that lean on its tags and reader counts (preferences, non-obvious) miss as "evidence incomplete".
- Out of API credit, scoring stops at once with a clear message; answers already paid for are remembered, so the rerun after a top-up only pays for the rest.
- `calibrate.mts` has the judge score planted picks (rerun it whenever the judge's model or instructions change; the scorecard says when it's stale) (`calibration/judge-calibration.json`): at least 9 of 10 must land right before its scores count.
- `score.mts` looks up every pick's catalog facts (Open Library, plus Hardcover's genre and mood tags and reader counts when `HARDCOVER_API_TOKEN` is set; a failed Hardcover lookup shows on the scorecard), has the judge (`evalJudge` slot, Opus 5.5) score each reader, cross-checks `SECOND_JUDGE` readers (default 5) with the second judge, and with `BASELINE=1` runs and scores plain Claude on the same readers. `RUNS` takes several files to score repeat runs side by side; `OUT` names the output.
- It prints the scorecard (safe to paste) and writes `results/<name>-scored.json` and `results/<name>-review.html`: open the review page in the browser for every reader's picks, with scores hidden until you tick "Show scores".
- About $1 per run of 21 readers for the judge, plus about $1 with the baseline.

## Case sets
Each file in `cases/` is one set:

```json
{
  "set": "legacy-v0",
  "description": "What the set is for",
  "rubric": "docs/quality/eval-set.md",
  "cases": [
    { "id": "case-1", "label": "Rich, clear input", "tests": "What this case checks",
      "focus": ["relevance", "traceability"], "status": "active", "tasteDescription": "..." },
    { "id": "...", "label": "...", "tests": "...", "focus": ["relevance"], "status": "active",
      "profile": { "version": 1, "slots": { }, "answers": [ ], "extras": [ ] } }
  ]
}
```

- `focus`: the rubric dimensions the case mainly tests.
- Each case has a `profile` (a taste profile, [decision 2.24](../docs/product/question-flow/taste-profile.md)) or a legacy `tasteDescription` paragraph, never both. Profiles are checked offline with the same rules the route applies.
- `status`: `active`, or `approximation` for cases that test question-flow behaviour the engine alone can't show.

| Set | What it is |
|---|---|
| `legacy-v0.json` | The original 11 cases, frozen Nov 2, 2026, so every run stays comparable with results since July. Don't edit; add a new set instead. |
| `profile-v1.json` | 21 readers in the taste profile format, across every doorway, for the readiness baseline ([readiness bar](../docs/quality/readiness-bar.md)). Each case lists its `checks`: the hard rules, strong and weighed preferences the picks must honour, and whether non-obvious picks are required. Grounded in real-request patterns; refreshed from pilot readers later. |

**Planned:** sets refreshed from pilot readers. Per-job evals for the AI gateway slots follow when a model swap is first tested.


## Round 1: comparing selection versions (decision 3.13)

Versions B and C (decision 6.13) run from the same code, switched by `ENGINE_SELECTION`, and are scored beside the Nov 7 baseline.

1. **Choose the readers (free):** `SCORED=profile-v1-run1-rescored2-scored.json LIMIT=10 CONTROLS=3 node --import ./tests/support/resolve.mts evals/weak-readers.mts` prints the weakest readers plus a few strong ones as controls, and a `CASE_IDS=` line.
2. **Version B, smoke test first (decision 3.14):** in terminal 1, `ENGINE_SELECTION=profile ENGINE_TRACE=1 npm run dev`; in terminal 2, `SET=profile-v1 CASE_IDS=prof-01,prof-09 TAG_PREFIX=r1b SMOKE=2 MAX_USD=1 node evals/run.mjs` (the two heaviest readers). If time and cost look right, run the full list with `RESUME=1` (same `TAG_PREFIX`), which keeps the two already done: `SET=profile-v1 CASE_IDS=... TAG_PREFIX=r1b RESUME=1 MAX_USD=3 node evals/run.mjs`.
3. **Version C:** stop the server (Ctrl+C in its terminal, and check nothing else is on port 3000), restart it with `ENGINE_SELECTION=shortlist ENGINE_TRACE=1 npm run dev`, then the same two steps with `TAG_PREFIX=r1c`.
4. **Score side by side, on the same readers:** `RUNS=profile-v1-run1.json+profile-v1-pages1.json,profile-v1-r1b.json,profile-v1-r1c.json CASE_IDS=... OUT=round1 SECOND_JUDGE=0 node --env-file=.env.local --import ./tests/support/resolve.mts evals/score.mts`. The first run is the Nov 7 baseline with the length readers' page-count run swapped in (`+` combines files; later files win reader by reader). `CASE_IDS` (the same list as the runs) keeps every run on the same readers, so the percentages compare like with like. The baseline's verdicts are remembered, so only B's and C's picks are paid for.
5. **Second run only if needed:** when B and C are within about 5 points on relevance, run both again (`TAG_PREFIX=r1b2`, `r1c2`).

Every run stops once its own spend passes `MAX_USD` (default $5; resumed readers don't count; it can go over by one reader), and stops if a reader has no recorded cost (the server needs `ENGINE_TRACE=1`). Version C's traces (stage S) record the finalists, how many had a description or mood tags, and the lookup time, for checking whether good books are cut too early.
