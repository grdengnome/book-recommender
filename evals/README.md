# evals/

> **Status:** Living · How recommendation quality is measured. Last updated Nov 1, 2026.

Every change to prompts, models or recommendation logic is checked against the eval set before it ships (CLAUDE.md, "Eval discipline"; decision 14.3 for model changes).

- **Rubric and cases:** [`docs/quality/eval-set.md`](../docs/quality/eval-set.md) (6 dimensions, fail/weak/good/excellent; 11 cases).
- **Findings:** [`docs/quality/eval-log.md`](../docs/quality/eval-log.md).
- **Raw output:** `evals/results/` (gitignored).

## Runners
All three call the live `/api/recommend` route, so they need `npm run dev` running and real API keys in `.env.local`. **They cost money** (about $0.08 per case), so they're run deliberately, never automatically.

| Runner | What it runs |
|---|---|
| `run-eval.mjs` | All 11 cases, or a subset with `CASE_IDS=case-1,case-5`; holds the case inputs (verbatim from the eval set). Prints a summary: picks returned, time and, with the dev server started as `ENGINE_TRACE=1 npm run dev`, each case's cost and models |
| `run-eval-grounded.mjs` | All 11 cases, also parsing the dev-server log for attempts, pick sources and pool sizes (`DEV_LOG=/path/to/dev.log node evals/run-eval-grounded.mjs`) |
| `run-eval-narrow.mjs` | Cases 3, 4, 6 and 8 (the ones that showed title clustering) |

To try a different model for one job, set its override (for example `AI_SLOT_CARD_WRITING=...` in `.env.local`, see `lib/ai/slots.ts`), restart the dev server and run the cases; the summary's models column confirms which models ran.

**Planned (restructure PR 4b):** combine these into one runner with the cases in a data file. Per-job evals for the AI gateway slots follow when a model swap is first tested.
