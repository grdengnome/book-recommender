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
After a run, the judge scores it against the [readiness bar](../docs/quality/readiness-bar.md). Both commands cost money and need the API key; neither needs the dev server.

```
node --import ./tests/support/resolve.mts evals/calibrate.mts                 # once per judge model, about $0.20
RUNS=profile-v1-run1.json BASELINE=1 node --import ./tests/support/resolve.mts evals/score.mts
```

- `calibrate.mts` has the judge score planted picks (`calibration/judge-calibration.json`): at least 9 of 10 must land right before its scores count.
- `score.mts` looks up every pick's catalog facts (Open Library, plus Hardcover reader counts when `HARDCOVER_API_TOKEN` is set), has the judge (`evalJudge` slot, Opus 5.5) score each reader, cross-checks `SECOND_JUDGE` readers (default 5) with the second judge, and with `BASELINE=1` runs and scores plain Claude on the same readers. `RUNS` takes several files to score repeat runs side by side; `OUT` names the output.
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
