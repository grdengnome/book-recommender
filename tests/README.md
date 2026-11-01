# tests/

> **Status:** Living · Automatic checks, run on every pull request by GitHub Actions (`.github/workflows/checks.yml`). Last updated Nov 1, 2026.

Run them all with `npm test`, or everything GitHub runs with `npm run check` (type check + lint + tests). Every test runs offline: no API keys, no network, no spend.

| Test | What it protects |
|---|---|
| `grounding.test.mts` | Every pick must come from a pool the model was shown; accents, subtitles and non-Latin names still match; an empty author is never a wildcard |
| `merge.test.mts` | Books found in both catalogs appear once with both IDs; the model sees only title, author and subjects; nothing is silently dropped |
| `trace-equivalence.test.mts` | The debug trace only watches: model inputs, catalog requests and the response are byte-identical with tracing on and off; no secrets in the trace; never writes on Vercel |

`support/resolve.mts` lets Node's built-in test runner load the app's TypeScript the way Next does. Feature-specific tests will live inside their feature folder (`features/<name>/`) once those exist; this folder holds cross-cutting checks such as contract tests.
