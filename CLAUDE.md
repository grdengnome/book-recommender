# CLAUDE.md

This file is read automatically by Claude Code at the start of every session in this repo. Keep it current as real architecture decisions get made — this should describe what the code actually does, not aspirations.

## What this project is

An AI book recommender. Full product spec: `docs/spec.md`. Actual question wording, phrasing pools, and rejection/reflect-back mechanics: `docs/question-bank.md` (content, kept separate from the spec since it grows independently). Read the spec first for the *why* behind any request that seems oddly specific (e.g. "why does the rejection path have two steps") — it's almost always a deliberate decision documented there, not an oversight.

## Current build priority

**We are proving the core recommendation loop before building UI.** The near-term task is: given a hardcoded test input (from `docs/eval-set.md`), call the Anthropic API with a prompt encoding the taste rules in `docs/spec.md` Section 4d, and produce a recommendation. No cards, no adaptive questioning, no cover images yet — those come after the loop is proven to produce good output.

Do not build the question-architecture UI, card-flip UI, or cover-image lookup until told the core loop is working.

## Stack & conventions

- **Next.js** (App Router) with co-located API routes — the LLM call lives in an API route, not a separate service.
- LLM calls go through the Anthropic API. Never hardcode an API key — always read from `process.env.ANTHROPIC_API_KEY`, loaded via `.env.local` (gitignored).
- No database yet. v0 is stateless by design (see `docs/spec.md` Section 4a — this was a deliberate decision, not a gap).
- Prefer plain fetch to the `/v1/messages` endpoint over adding an SDK dependency unless there's a concrete reason to need one.

## Eval discipline

Any change to the recommendation prompt/logic should be checked against the test cases in `docs/eval-set.md` using the rubric there (6 dimensions, 4-point scale: fail/weak/good/excellent). If you change prompt logic, note what you changed and why in a comment or commit message — traceability matters here as much as it does in the recommendations themselves.

## Things that look like bugs but aren't

- No fixed question count / no "always ask 5 questions" logic — this was deliberately removed in favor of a confidence-based stopping rule. See spec Section 4a.
- The turn-off question not always appearing is correct behavior, not a missing feature.
- Cover image lookup failing over from Open Library → Google Books → placeholder is the designed behavior, not error handling to "fix."

## Open questions (do not resolve unilaterally)

- Exact wording for each rotating phrasing pool.
- The numeric threshold for the "confidence isn't improving" guardrail — needs real testing data first.

Flag these rather than picking an answer.
