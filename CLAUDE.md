# CLAUDE.md

Read automatically by Claude Code at the start of every session in this repo. Describes what the code actually does, not aspirations. Keep it current as decisions are made.

## What this project is

An AI book recommender whose core problem is resisting the model's pull toward famous, obvious picks. Start here:
- `docs/decisions.md`: every product and architecture decision and why. Check it before questioning something that looks odd; it's usually deliberate.
- `docs/spec.md`: product spec. `docs/question-bank.md`: question wording and flow mechanics.

## Current build priority

**The v0 engine is complete** (Sept 2026), with known limitations documented in `docs/decisions.md` §12. The next phase is being planned; the question-flow and card UI is the likely candidate.

Do not start building UI (question flow, cards, cover images) until explicitly told to.

## How the engine works

One API route, `app/api/recommend/route.ts`: POST `{ tasteDescription }` → `{ recommendations }`.

- `lib/tools/`: the `search_books` tool (Open Library subjects + search) and the tool registry. The model calls it up to 3 rounds; the 4th call omits tools to force an answer.
- `lib/hardcover/`: maps the taste description to reader tags (one model call), then fetches a tag-matched pool. Runs once per request, in parallel with the Open Library loop.
- `lib/merge/`: `mergeCandidatePools.ts` dedups, merges, and shuffles the pools; `pickGrounding.ts` checks every pick against the pools the model was shown.
- `lib/verify/`: looks up each final pick in its catalog and checks flagged descriptions (Haiku).

## Rules the code enforces (don't weaken them)

- **Picks come only from the retrieved pools.** Checked in code; a miss retries the whole generation (max 3 attempts), then returns a clean 502. Never add a fallback to the model's own knowledge.
- **The model never sees ranking data.** Candidates are shuffled, with scores, rank positions, and catalog IDs stripped. Don't add popularity or relevance fields to what the model sees.
- **Tag selection never sees tag counts.** The tag mapper gets names only, shuffled.

## Stack & conventions

- **Next.js** (App Router); the engine is a co-located API route, not a separate service.
- Plain `fetch` to the Anthropic `/v1/messages` endpoint; no SDK unless there's a concrete need.
- Env vars in `.env.local` (gitignored): `ANTHROPIC_API_KEY` (required), `HARDCOVER_API_TOKEN` (optional; without it the engine runs on Open Library alone).
- No database. v0 is stateless by design.
- `scratchpad/` holds experiment scripts and two live logs the app writes to (`query-log.json`, `hardcover-failure-log.json`). It's excluded from the app's type check; see `scratchpad/README.md` before deleting anything there.

## Security

Secrets go directly into `.env.local` through the editor, never through chat or the terminal. When confirming a secret was saved, report its key name and character count only, never the value.

## Git workflow

- Code changes go on a branch and through a pull request. Doc-only changes can go straight to `main`.
- One decision per change. Stop and show the diff before committing.

## Eval discipline

Any change to prompts or recommendation logic is checked against `docs/eval-set.md` (6 dimensions, fail/weak/good/excellent). Use a narrow case subset to test a hypothesis; run all 11 cases for milestones. Record findings in `docs/eval-log.md`, and note what changed and why in the commit message.

## Progress log

One entry per session in `docs/progress-log.md`, written at session close:
- Lead with the conclusion or decision, not the investigation narrative.
- Compress methodology to one line ("tested X via Y, found Z"). One example, not several.
- Skip context that's already in the previous entry.
- End with a numbered "Next" list.
- Target: skimmable in under a minute; detail lives in scratchpad files or the eval log.
- The container clock runs UTC; evening US Eastern sessions can roll past midnight. Confirm the local date before dating an entry.

## Decision log

`docs/decisions.md` records every product and architecture decision and every rejected approach. Keep it current:
- When a session makes a product or architecture decision, or deliberately rejects an approach, add an entry under the matching section (or a new section if none fits).
- Format: `### N.N Title`, then a **Decision:** line and a **Why:** line, ending with a link to the progress-log or eval-log entry with the full detail.
- Routine bug fixes don't get entries.
- Update the date in the italic scope line under the title whenever entries are added.
- Resolved items in section 12 ("Open questions") become entries in the matching section and are removed from the list.

## Things that look like bugs but aren't

- **A 502 with no picks** when grounding fails 3 times: correct. Thin or empty pools fail closed rather than returning ungrounded picks.
- **Hardcover failures are silent.** Missing token, API errors, or no matching tags degrade to Open Library only and are logged to `scratchpad/hardcover-failure-log.json`, never shown to the user.
- **Hardcover books rarely become final picks.** Proportional to their small share of the pool, not a bug (tested Sept 17).
- **Most picks skip the description check.** It only runs when a pick's catalog subjects flag it as criticism of its genre; everything else passes through unchanged by design.
- **The Open Library search call contributes very little to pools** (about 1% when measured in August). Deliberately deprioritized, not broken; subject lists and Hardcover carry retrieval.
- **No fixed question count** in the (planned) question flow; it uses a confidence-based stopping rule. The turn-off question not always appearing is also intended.
- **Cover images fall back** Open Library → Google Books → placeholder by design.

## Open questions (do not resolve unilaterally)

- Exact wording for each rotating phrasing pool.
- The threshold for the "confidence isn't improving" guardrail; needs real usage data.
- Engine-level open questions are listed in `docs/decisions.md` §12.

Flag these rather than picking an answer.
