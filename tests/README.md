# tests/

> **Status:** Living · Automatic checks, run on every pull request by GitHub Actions (`.github/workflows/checks.yml`). Last updated Nov 1, 2026.

Run them all with `npm test`, or everything GitHub runs with `npm run check` (type check + lint + tests). Every test runs offline: no API keys, no network, no spend.

| Test | What it protects |
|---|---|
| `grounding.test.mts` | Every pick must come from a pool the model was shown; accents, subtitles and non-Latin names still match; an empty author is never a wildcard |
| `merge.test.mts` | Books found in both catalogs appear once with both IDs; the model sees only title, author and subjects; nothing is silently dropped |
| `ai-gateway.test.mts` | Every AI job has a slot with a known, priced model; an override setting changes only its own job and a bad one falls back; a missing key is reported before any call; nothing outside `lib/ai/` talks to a provider or names a model |
| `engine-golden.test.mts` | A refactor changes nothing the outside world sees: every request the engine sends (address, headers, timeout, body) and its response match the saved copy in `golden/engine-requests.json`. A deliberate change refreshes the copy with `UPDATE_GOLDEN=1 npm test`, and its diff is reviewed in the PR |
| `engine-direct.test.mts` | The engine can be called directly, without a web request: `recommend()` returns the same answer as the route |
| `eval-cases.test.mts` | Every eval case set in `evals/cases/` is well-formed (unique ids, required fields, rubric dimension names, profiles valid), so a typo is caught before a paid run |
| `taste-profile.test.mts` | The reader brief is written word for word as specified; empty slots are left out; reader text can't close its tags; bad profiles are refused; the route sends the brief to the engine |
| `eval-scoring.test.mts` | The readiness scorecard computes what the bar says: length checked from page counts, every gate and bar at its threshold, each run and doorway separately, the plain-Claude comparison, judge agreement, and a review page that hides scores and escapes book text |
| `trace-equivalence.test.mts` | The debug trace only watches: model inputs, catalog requests and the response are byte-identical with tracing on and off; no secrets in the trace; never writes on Vercel |

`support/offlineEngine.ts` runs the real engine with canned catalog and model replies (no network, seeded shuffles); the engine-level tests share it. `support/resolve.mts` lets Node's built-in test runner load the app's TypeScript the way Next does. Feature-specific tests will live inside their feature folder (`features/<name>/`) once those exist; this folder holds cross-cutting checks such as contract tests.
