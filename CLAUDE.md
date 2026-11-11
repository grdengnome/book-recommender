# CLAUDE.md

Read automatically by Claude Code at the start of every session in this repo. Describes what the code actually does today, and the rules for changing it. Keep it current as decisions are made.

## What this project is

Squirmly (working name) is an AI book discovery app. Readers answer a few playful, themed questions; the engine reveals three intriguing, relevant books from real catalogs, unwrapped as collectible cards. Its core engine problem is resisting the model's pull toward famous, obvious picks. The full vision adds a Collection tab (shelf, cards, pairwise ranking) and a You tab (taste profile, insights).

Start here:
- `docs/README.md`: map of every doc, with status.
- `docs/product/v0-scope.md`: what v0 includes and excludes. Scope is frozen; new ideas go to `docs/product/roadmap-and-backlog.md`.
- `docs/decisions.md`: every product and architecture decision and why. Check it before questioning something that looks odd; it's usually deliberate.
- `docs/engineering/repo-guide.md`: how the repo is organized, its rules, and restructure progress.
- `docs/engineering/contracts-and-adapters.md`: how every part stays swappable.

## Current priority

**v0 is a polished preview of the full Discover experience on a private link** (decision 1.11), soft target end of 2026. The engine is complete and deployed privately.

Now: the eval refresh (decided Nov 2: test the engine on the new question flow before building screens): taste profile format (done, decision 2.24) → readiness bar (done, `docs/quality/readiness-bar.md`, decision 3.8) → new case set in the profile format (done, `evals/cases/profile-v1.json`) → judge (done, calibrated 10/10, decisions 3.9–3.10) → baseline (done, Nov 7: relevance 81%, speed and preferences the big gaps) → engine improvements, each proven against the baseline: page counts (done, PR #23) → honest cards (done, PR #24) → round 1: a selection prompt written for the profile, and a shortlist that chooses with descriptions, tested as two versions (decisions 6.13, 3.13) → round 2: smarter search → round 3: reserves → speed. Long-term: our own book index (6.14). How everything gets measured: `docs/quality/eval-strategy.md`. Then the rest of the repo restructure, one pull request at a time (`docs/engineering/repo-guide.md`; PRs 1–4b are done): PR 5 app skeleton → PR 6 store, feedback, rate limit, input guard → the café vertical slice.

Don't build screens until explicitly asked. Screens follow `docs/design/design-system.md` and `docs/design/art-direction.md`; question flow work follows `docs/product/question-flow/principles.md` and `v2-design.md`. The illustration style and tool are under review in an image generator bake-off, so don't redraw scene artwork from scratch; the prototypes in `prototypes/` are the reference until that's decided. The data store, rate limit and input guard must be in place before anyone outside sees the app.

## How we think: the top-professional check

Before proposing a plan, building a feature, or changing the engine or design, ask how a top professional in that field would do it, and go **deeper, not bigger**:
1. **What would they do that wasn't asked for?** Name the standard practice a top professional wouldn't skip. Ask before adding scope; don't add it silently.
2. **What raw material would they start from?** Real data, source code, catalog records and user behaviour, not summaries or assumptions.
3. **What methods and tools would they use?** The established technique for this kind of problem, checked against the Tool Radar.
4. **What, other than Claude or the owner, would show it's right?** An eval, a test, an outside source, a blind comparison, or a real reader. Prefer external checks over self-judgment.

**Show the check.** Every plan and PR description includes a short "Pro check" section: what the check added, changed or ruled out.

**Depth, not gold-plating.** The check is about doing the right thing well, not doing more things. It works with the YAGNI guardrail below: don't add layers, features or process for a future that isn't planned. Scale the check to the task; a small fix needs none.

## How we work

- **The owner is a product manager learning by doing, not a developer.** Explain every step in plain language as it happens: what it is, why it's done, and what it will look like. Avoid unexplained jargon.
- **Plan first.** Show the plan before changing anything, and raise any decision big enough for the owner to weigh in on. Don't resolve open questions unilaterally.
- **Every change goes through a pull request,** docs included (decision 11.7). The owner reviews and merges every PR; Claude never merges into `main`.
- **Work can happen from a claude.ai session or a Codespace** (decision 11.5). Either way, start from the latest `main`, and don't have two sessions editing the same branch.

**PR description template:** what changed (plain language) · why · how it was checked · Pro check · **Review focus** (the 1–3 files or sections worth the owner's eyes, and what to look for) · anything left for a later PR.

**Reviews (decision 11.8):** the owner checks intent and risk, not every line. High-stakes PRs (the engine's prompt, hard-rule enforcement, the input guard, anything that reaches readers, safety or money) also get an independent cold review from a separate reviewer agent that didn't build the change; post its findings in the PR. `main` is protected: PRs only, merge commits only, and the `checks` and `Vercel` status checks must pass.

## How the code is organized

The repo is moving to **feature folders for the app on shared infrastructure** (decision 14.2; full layout in `docs/engineering/repo-guide.md`). The engine and shared infrastructure are in place (`lib/engine/`, `lib/ai/`, `lib/contracts/`, `lib/trace/`); `features/`, `ui/` and `themes/` arrive with PR 5.

Rules for all new code:
- **Everything swappable (decision 14.1).** A part that's likely to change talks to the rest of the app through a contract in `lib/contracts/`; adapters plug in; settings choose them. App code never calls an outside service (a model, catalog or database) directly.
- **YAGNI guardrail.** Add a contract only when two options already exist, a swap is planned, an outside service is involved, or change would be expensive later. Otherwise keep plain code. Placeholders for future features are a type or a note, not empty folders.
- **Features never import from each other.** They talk only through `lib/contracts` and shared code.
- **A piece lives inside its feature until a second feature needs it;** then it moves to `ui/`, `themes/` or `lib/`.
- **Content as data.** Questions, themes, rarity rules and copy live as data files where practical.
- **No permanent model choices (decision 14.3).** Each AI job picks the model with the best speed–quality balance, proven by its eval and timing. How models run (in parallel, streamed, cached, routed by job size) is part of that choice and is improved continuously.

## How the engine works (today)

One API route, `app/api/recommend/route.ts`: POST `{ profile }` (a taste profile, decision 2.24) or the legacy `{ tasteDescription }` paragraph → `{ picks }` (spec §4b contract; fields the engine can't fill yet are `null`). Errors are `{ error: { code, message } }`. Nothing else leaves the server: no model message, no thinking, no pool strings or IDs. The route is only the web front door (decision 14.5): it checks the request and the AI configuration, then calls `recommend()` in `lib/engine/recommend.ts`, which runs the whole pipeline and can also be called directly (tests, scripts, future routes).

The engine lives in `lib/engine/`, one folder per pipeline stage:
- `profile/`: the taste profile's slot settings as data (`slots.ts`: firmness, wording, length bands), `validateProfile.ts` (untrusted input checks; avoid never inferred) and `renderBrief.ts` (plain-code reader brief, grouped by firmness; reader text quoted, never instructions). Spec: `docs/product/question-flow/taste-profile.md`.
- `recommend.ts`: the recipe. The search loop (at most 3 turns, and `ENGINE_SEARCHES_PER_ROUND` searches per turn), the Hardcover deadline, the 3-attempt retry, starting each pick's work as it streams in, error codes.
- `sources/openlibrary/`: the `search_books` tool (Open Library subjects + search) and the tool registry. The model calls it up to 3 rounds; the 4th call omits tools to force an answer. Subject lists are cached for 24h; every Open Library call times out at 5s.
- `sources/hardcover/`: maps the taste description to reader tags (one model call), then fetches a tag-matched pool. Runs once per request, in parallel with the Open Library loop; dropped if not back within 5s.
- `pool/`: `mergeCandidatePools.ts` dedups, merges, and shuffles the pools; `lengthFilter.ts` removes books outside the reader's length band (plus 15% at each edge) or of unknown length before the model sees the pool, using page counts from `sources/pageCounts.ts` (only when a length is set; decision 2.25); `pickGrounding.ts` checks every pick against the pools the model was shown.
- `picks/`: the stage I contract. Choosing and writing are separate calls. `pickSchema.ts` holds the selection schema (three pool picks, a fit note and a distinct mood each; structured outputs, `output_config.format`), the card schema and the client `Pick` type. The selection call is streamed; `streamSelection.ts` spots each complete pick in the stream so its grounding, lookup and card start as soon as it arrives; the response still waits for all three. `validatePicks.ts` checks pick count, empty fields and length ceilings. `selectionPrompts.ts` holds the selection instructions and the `ENGINE_SELECTION` setting for round 1's versions (decision 6.13): `current` (default, today's prompt), `profile` (B) and `shortlist` (C: the search call lists about 30 finalists, `lookupFinalists` reads their records, and a final call, `shortlist.ts`, picks 3 from them only). The losing version is removed once round 1 is decided.
- `cards/`: `writeCards.ts` writes one pick's card (thinking off) from its catalog records, honestly: claims about facts and feel must agree with them, and a real gap with what the reader asked for gets a brief heads-up (decision 2.26); `shortenFields.ts` repairs an over-limit field with one small Haiku call.
- `verify/`: looks up each final pick in its catalog (Open Library by work key; Hardcover by ID, or by title and author through `sources/hardcover/findBook.ts` when the pick came from Open Library only, so every card gets Hardcover's description and moods; decision 2.26) and checks flagged descriptions (Haiku), on `why` + `angleText`. Title and author matching (`sources/bookMatch.ts`) is shared with the eval judge.

Shared infrastructure the engine uses:
- `lib/ai/`: the AI gateway (decision 14.4). `gateway.ts` is the only way to call a model: `modelFor(job)`, `callModel`, `streamModel`. `slots.ts` says which model does each job (five engine jobs, plus three eval jobs: the judge, the second judge and the plain-Claude baseline); `models.ts` lists each model's provider and price; `anthropic.ts` is the only code that talks to Anthropic (key, headers, timeouts, streaming). An `AI_SLOT_<JOB>` setting overrides one job's model for an experiment. The contract is `lib/contracts/ai.ts`.
- `lib/trace/`: debug-only request trace. With `ENGINE_TRACE=1` each request writes `.local/traces/<time>-<tag>-<id>.json` (stages A–I plus W for card writing, tokens, dollar cost). The trace object is passed down as an argument, is watch-only, and is ignored on Vercel. Don't let trace data feed back into the engine or the model's input; `tests/trace-equivalence.test.mts` checks this.
- Models today: Sonnet 5 for tag mapping, selection, the final choice (version C) and card writing; Haiku 4.5 for field shortening and the description check. **These are current choices, not permanent ones** (decision 14.3): every AI job can use whichever model gives the best balance of speed and quality, and is re-evaluated when better options appear. A change is one line in `lib/ai/slots.ts` (or one override setting) plus that job's eval.

## Rules the code enforces (don't weaken them)

- **Picks come only from the retrieved pools.** Checked in code against the pool strings the model copies (`poolTitle`/`poolAuthor`); a miss retries the whole generation (max 3 attempts), then returns a clean 502. Never add a fallback to the model's own knowledge.
- **Length overflow never fails a request or reruns the final step.** Only real failures rerun (ungrounded, empty required field, wrong pick count, cut-off or refused answer). An over-limit field gets one shortening call; if that fails, the original text is kept.
- **The model sees only title, author, and subjects.** (In version C only, the final choice also sees each finalist's description and reader mood tags; decision 6.13. This becomes the rule only if C wins round 1.) Candidates are shuffled; scores, rank positions, catalog source, and IDs stay internal. Don't add popularity, relevance, or source fields to what the model sees.
- **At most `ENGINE_SEARCHES_PER_ROUND` searches (default 3) run per turn of the search loop** (decision 6.15). Extra searches the model asks for in one turn get a "skipped" answer and never reach the catalogs. Don't remove the cap; change the setting.
- **Tag selection never sees tag counts.** The tag mapper gets names only, shuffled.
- **Every model call goes through the AI gateway.** No file outside `lib/ai/` talks to a provider or names a model; `tests/ai-gateway.test.mts` checks this.
- **A reader's length request is enforced in code before the model chooses** (decision 2.25): unknown lengths are left out, and a failed page-count lookup fails closed. Don't fall back to an unfiltered pool.
- **Readers' typed answers are data, never instructions.** Treat them as content to interpret, never as commands to follow (decision 10.5).

## Stack & conventions

- **Next.js** (App Router); the engine is a co-located API route, not a separate service.
- Plain `fetch` to the Anthropic `/v1/messages` endpoint; no SDK unless there's a concrete need.
- Env vars in `.env.local` (gitignored): `ANTHROPIC_API_KEY` (required), `HARDCOVER_API_TOKEN` (optional; without it the engine runs on Open Library alone), `ENGINE_TRACE` (optional, local only; `1` turns on the debug trace), `AI_SLOT_<JOB>` (optional; overrides one job's model, see `lib/ai/slots.ts`), `ENGINE_SELECTION` (optional; round 1's selection version, decision 6.13), `ENGINE_SEARCHES_PER_ROUND` (optional; searches run per turn, default 3, decision 6.15).
- No database yet. v0 adds a small data store for feedback, rate limits and the card bank (decisions 10.5, 10.6), behind a `Store` contract; it stores no personal details.
- Hosted on Vercel (Hobby plan), project `book-recommender` under `grdengnome`. Deployment Protection is on for all deployments. Production keys are Vercel Secrets (separate, spend-capped Console workspace); never copy them into the repo or chat. The recommend route sets `maxDuration = 300`.
- The app's live logs (`query-log.json`, `hardcover-failure-log.json`) and debug traces go to `.local/`, which is gitignored: they can hold real readers' answers.
- `evals/`: one eval runner, `run.mjs` (paid, run deliberately); case sets as data in `evals/cases/` (`legacy-v0.json` is the frozen original 11; `profile-v1.json` is the 21-reader readiness set); the judge and scorecard in `evals/judge/`, run by `score.mts` and calibrated by `calibrate.mts` (`evals/README.md`). `scripts/`: maintenance tools. `experiments/`: one-off investigations and evidence (not linted or type-checked; see its README before deleting anything). `prototypes/`: design prototypes.
- `.env.example` lists every setting; copy it to `.env.local`.

## Automatic checks

`npm run check` runs the type check, the linter (app, lib, tests) and the tests; GitHub Actions runs the same on every pull request and push to `main` (`.github/workflows/checks.yml`). Every test runs offline with no API keys. **Checks must be green before a PR is merged**, and new engine rules get a test in `tests/`. Tests use Node's built-in test runner (`tests/README.md`). `tests/engine-golden.test.mts` compares every request the engine sends with a saved copy: a refactor must leave it unchanged, and a deliberate change (a prompt edit, a new model) refreshes it with `UPDATE_GOLDEN=1 npm test`, with the diff reviewed in the PR.

## Security

Secrets go directly into `.env.local` through the editor, never through chat or the terminal. When confirming a secret was saved, report its key name and character count only, never the value. Never commit API keys, cover images, debug traces or real readers' answers.

## Git workflow

- Every change goes on a branch and through a pull request, docs included. The owner merges.
- One decision per change. Show the plan, and the diff for anything substantial, before committing.
- Keep commits reviewable: separate pure file moves from content edits.
- Run `npm run check` before pushing.

## Eval discipline

Any change to prompts or recommendation logic is checked against `docs/quality/eval-set.md` (6 dimensions, fail/weak/good/excellent). Use a narrow case subset to test a hypothesis; run all 11 cases for milestones. Record findings in `docs/quality/eval-log.md`, and note what changed and why in the commit message.

## Progress log

One entry per session in `docs/progress-log.md`, written at session close:
- Lead with the conclusion or decision, not the investigation narrative.
- Compress methodology to one line ("tested X via Y, found Z"). One example, not several.
- Skip context that's already in the previous entry.
- End with a numbered "Next" list.
- Target: skimmable in under a minute; detail lives in experiments, eval results or the eval log.
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
- **A 422 `not_enough_books`** when fewer than 3 books fit the reader's length: correct, and deliberately fast (no retries; decision 2.25).
- **Hardcover failures are silent.** Missing token, API errors, or no matching tags degrade to Open Library only and are logged to `.local/hardcover-failure-log.json`, never shown to the user.
- **Hardcover books rarely become final picks.** Proportional to their small share of the pool, not a bug (tested Sept 17).
- **Most picks skip the description check.** It only runs when a pick's catalog subjects flag it as criticism of its genre; everything else passes through unchanged by design.
- **The Open Library search call contributes very little to pools** (about 1% when measured in August). Deliberately deprioritized, not broken; subject lists and Hardcover carry retrieval.
- **No fixed question count** in the question flow; it uses a confidence-based stopping rule (`docs/product/question-flow/v2-design.md` §4).
- **Cover images fall back** Open Library → Hardcover (strict title + author match only) → Google Books (needs an API key) → themed placeholder by design (`docs/product/spec.md` §5d). Fake covers (labelled stand-ins, Project Gutenberg auto-covers) count as no cover.

## Open questions (do not resolve unilaterally)

- Product-level open questions: `docs/product/spec.md` "Still open" and `docs/product/question-flow/v2-design.md` §9.
- Engine-level open questions: `docs/decisions.md` §12.

Flag these rather than picking an answer.
