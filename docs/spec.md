# Book Recommender — Spec

*Current state of the product and its design. Decisions, reversals, and rejected paths are in [`decisions.md`](./decisions.md); this file says what the product is and how it works. Last updated October 5, 2026.*

---

## 1. Product summary

An AI book recommender whose wedge is *taste articulation*: turning a user's mood, preferences, and feedback into **non-obvious, high-quality recommendations** drawn from real catalogs, delivered as cards. The differentiator isn't "recommends books"; it's "recommends the books a thoughtful friend with eclectic taste would, not the bestseller list everyone already knows." This fights how LLMs behave by default (Flag A), and solving that visibly is the portfolio-worthy part.

---

## 2. Core scope decision

The original idea was three products in one: a recommender, a Beli-style ranking system, and a reading tracker, plus Goodreads import, profiles, and gamified prompts. Only the recommender is an AI problem.

| Tier | Scope | Why |
|---|---|---|
| **v0 (build this)** | The recommender as a complete, deployed product: question flow → 3 cards → feedback and rejection path, plus the eval system behind it (full list in §4) | This is the AI, and the portfolio piece. A live link beats a repo |
| **v1 (next)** | Shelves, profiles, returning-user persistence | Conventional features that make it a real product |
| **Later** | Beli-style ranking, Goodreads import, gamified visual prompts | High effort, none of it AI; import has a hard external dependency (Flag C) |

**v0 status (Sept 29):** the engine is complete (§5). The product around it is designed (§4) and next to build (§8).

---

## 3. Where AI earns its keep (and where it doesn't)

| Genuinely AI (LLM-shaped) | NOT AI (conventional code) |
|---|---|
| Picking recommendations from the candidate pool | Ranking (a pairwise sort, Elo-style) |
| Mapping a taste description to Hardcover tags | Shelves and organization (basic data storage) |
| Writing the taste summary from question answers | Goodreads import (data plumbing) |
| Deciding whether to ask another question | Card UI, navigation, animation |
| Writing card hooks; checking flagged descriptions | Cover lookup, links, logging |

---

## 4. v0 specification

### 4a. Core flow

The opening page *is* the recommender (no landing or login wall). The flow:

**Questions (3 backbone + 0–2 follow-ups) → loading → 3 cards → feedback / rejection path.**

- **Input mode:** every question is tap-to-answer with a "write your own" fallback. Nothing requires typing.
- **Backbone (always asked):** anchor ("a book you loved") → why ("what stuck with you?": the writing / the world / the characters / the ideas / the feeling) → appetite (comfort ↔ strange). Fixed structure, rotating wording: 2–3 phrasings per question at launch, growing toward 4–5.
- **Anchor entry:** autocomplete against a catalog as the user types, with a "use what I typed" escape. Suggestions appear after 3+ characters and a short typing pause, target under ~1 second, and never block progress. Source (Open Library or Hardcover search) is chosen by measured speed.
- **Adaptive follow-ups:** after the backbone, one small model call judges whether the signal is enough. If not, it asks 1–2 targeted follow-ups (mood, length, turn-off) aimed at the thin category. No fixed question count; a guardrail stops the loop if confidence isn't improving (threshold TBD from usage data).
- **Unclear typed answers:** never block. If no answer is chosen and the typed text is obviously unusable (fewer than 3 characters, or no real letters), show one gentle inline nudge under the field ("Tell me a little more? Or tap an answer above.") and keep the page from turning once. Ask once, then move on: a second tap proceeds anyway. Subtler unclear answers are handled by the taste summary's code check and template fallback (§4f); an unusable answer is dropped quietly, and the rejection path (§4g) catches a miss.
- **Creative framing:** emoji-style prompts woven into the pools, about one per session.
- **Stateless:** no memory of users across sessions. The one exception is anonymous feedback events (§4i), which identify no one.

Full question wording and pools: [`question-bank.md`](./question-bank.md).

### 4b. The recommendation engine

Built and grounded; see §5. The engine takes one input, the taste description, and returns picks that are real, retrieved, and checked.

**Engine additions required for the v0 product:**
- **Taste summary step (§4f):** answers → verified plain-language summary → engine input.
- **Reserves:** each run returns 3 picks plus 2–3 reserves, all grounded and verified the same way, so swaps are instant.
- **Exclude list:** reruns and swaps never return a book the user has already seen this session.
- **Widen mode:** deliberately varied picks for the final step of the rejection path.
- **Stage reporting:** the engine reports when it moves between its three stages (searching, choosing, double-checking), so the loading screen's three bars show real progress, never an estimate ([`design.md`](./design.md) §9).
- **Card-ready output:** cover image, cleaned-up title and author text (no raw catalog artifacts like "Last, First" or untransliterated names), the "find this book" link, and the three pre-reveal clue values (year, page count, one-word mood; §4c).

### 4c. The card UX

Each pick is revealed alone on its own screen, then all three are shown together; tapping one opens its detail screen (decision 13.8). Layouts: [`design.md`](./design.md) §3.

- **Reveal:** each pick arrives wrapped and is revealed by tapping the wrapped book. Before it is revealed, it shows three clue chips: year, page count, and a one-word mood. The engine's card-ready output (§4b) needs to supply these three values. Motion: [`design.md`](./design.md) §8.
- **Revealed pick:** cover image, title, author, and a one-line hook (why it's for you). Designed placeholder when there's no cover.
- **Detail screen:** cover, catalog description, why it fits, the non-obvious angle, and a "find this book" link. **No ratings in v0**: no reliable source is confirmed, and thin rating counts on obscure books work against the product.
- **"Find this book" link:** destination and affiliate tag are configuration, not code. v0: Bookshop.org (affiliate) → Open Library fallback when no ISBN. Amazon may be added later as a secondary option. A short commission disclosure is shown.
- **Per-book actions (on the detail screen):**
  - **👍:** recorded.
  - **👎:** recorded, and reveals an optional "show me another" (swaps in a reserve). It doesn't auto-swap, so the user can still compare.
  - **"Already read it":** swaps in a reserve immediately.
  - When reserves run out, the swap control becomes "none of these working?" → rejection path (§4g).

**Cover images:** Open Library → Google Books → designed placeholder.

### 4d. What "good" means

- **Impression over popularity.** Target books that leave a mark: quiet standouts you'd itch to recommend.
- **Penalize the bandwagon.** A pick fails if a well-read person would name it first for this exact request, whatever its fame or awards.
- **Range** across era, author, and genre.
- **Real and correct.** Every pick is a real, retrieved book, and its description matches that book.

### 4e. Evaluation

- **Rubric:** 6 dimensions (relevance, non-obviousness, range, real & correct, traceability, variety across sessions), fail / weak / good / excellent, scored against external sources. Test cases: [`eval-set.md`](./eval-set.md). Findings: [`eval-log.md`](./eval-log.md).
- **New for v0:**
  - **Taste summary fidelity:** about 10 answer sets, scored on two questions: was anything dropped, and was anything added?
  - **"Enough signal?" decisions:** cases for when to ask more vs. recommend. Cases 3, 7a, and 7b stop being single-message stand-ins once the flow exists.
  - **Real-world signal:** completion rate through the questions, 👍/👎 rates, and "already read it" rates, from anonymous feedback events.

### 4f. Taste summary

One small model call turns the question answers into a plain-language summary. That summary is both the engine's input and the text shown on the read-back screen, so editing the read-back edits exactly what the engine sees.

- **Rules:** include every answer, keep the user's own words for anything typed, add nothing they didn't say.
- **Code check:** confirms the anchor title, any typed text, the appetite level, and any turn-offs appear in the summary. On failure, retry once, then fall back to a plain stitched template. Never blocks the request.
- **Shown to the user only on the rejection path** (§4g), to keep the main flow fast.

### 4g. Rejection path

"None of these" leads to at most three reruns, then "start over":
1. **Clarify:** one tap ("too safe / too heavy / wrong mood / something else"). Rerun with that adjustment, excluding everything shown.
2. **Read-back:** "Here's what I heard" (the taste summary), editable. Rerun.
3. **Widen:** deliberately varied wildcard picks. The clean exit.

Each rerun is a full engine run (a full wait).

### 4h. Loading and error states

- **Loading (30–120 seconds today):** the user's answers reflected back in their own words, then rotating author facts, then the cards. Reflect-back quotes real answers, specific enough that it couldn't describe just anyone.
- **Author facts:** a curated library of about 50–100 facts about well-known and historic authors, each verified once against a cited source, shuffled, never repeated within a session. Not tied to the request. (Famous-only vs. a mix with lesser-known authors: undecided.)
- **Errors:** "Something went wrong, try again," with all answers kept. Covers the engine's grounding failure (502), catalog outages, and requests that run too long.

### 4i. Feedback and logging

Anonymous events (question completion, 👍/👎, already-read, swaps, reruns) are stored in a small hosted data store, which also replaces the file-based logs the engine writes today. No user identity, no profiles.

### 4j. Visual design

- **Direction:** vibrant, storybook feel; simple layout and flow, with the visual budget spent on rich moments (the card reveal, the button "pop"). One consistent theme across every screen (Flag B).
- **Principles:** one question per screen; large tap targets; every tap gets a response; book covers wherever possible (including autocomplete); the appetite question as something visual; progress shown as momentum, not "2 of 5"; mobile first.
- **Process:** a visual design pass (mockups of the question screens and cards together) before any screen is built.

### 4k. Supporting pages

A short "How it works" page, linked from the footer, explaining the approach and linking to [`decisions.md`](./decisions.md).

---

## 5. Data & sources — RESOLVED

**Grounding is required.** The model repeatedly drew from a narrow internal pool of "go-to" titles across very different inputs, and prompt changes didn't fix it. Every pick now comes from real catalog candidates.

**Pipeline:** Open Library search (model-driven, §5b) and Hardcover tag pool (fixed pre-fetch, §5f) → merge (§5g) → model picks → grounding check (§5c) → catalog lookup and description check (§5e).

### 5a. Architecture — tool-based retrieval

Retrieval is a tool the model calls (Anthropic tool use), not instructions embedded in the prompt. This keeps `SYSTEM_PROMPT` about taste judgment and lets the model re-search when results are thin.

- `lib/tools/`: one file per tool (definition schema + implementation), with a registry in `index.ts`.
- `SYSTEM_PROMPT` references tools by name and intent only.
- New tools follow the same pattern without re-deciding it.

### 5b. Open Library — the `search_books` tool

- **Inputs:** a short keyword query and one or more subject slugs. Subjects are fetched in parallel (multi-subject fan-out) and merged with the search results.
- **Retrieval weight:** subject lists carry the pool. Open Library's free-text search matches words, not taste (implicit AND across terms, keyword matches like "cult novel" returning *1984*), so it's deprioritized: still called, but it contributes very little.
- **Loop cap:** at most 3 search rounds; the 4th model call omits the tool, forcing an answer.
- **No pool size cap.** Cost is small at this scale; dilution is handled by the shuffle.

### 5c. Grounding enforcement

- **Prompt:** `search_books` must be called, and all 3 picks must come from the retrieved pools, even a small one. No fallback to the model's own knowledge.
- **Code:** `lib/merge/pickGrounding.ts` checks every pick against the pools the model was shown, using a tolerant key (title up to the first colon or parenthesis + author last name, Unicode-folded; an empty title or author never matches). A miss or unparseable answer retries the whole generation (max 3 attempts), then returns a clean 502. Never an ungrounded pick.
- **Thin pools** too small for 3 valid picks fail closed (the 502). A recovery path is not designed.

### 5d. Cover images

Open Library → Google Books → designed placeholder (§4c). Open Library is free but thin on obscure titles; Google Books needs an API key at real volume.

### 5e. Post-selection verification of pick descriptions

Grounding proves each pick is a real, retrieved book, not that its description matches that book.
- **Lookup:** each final pick's catalog records are fetched by the IDs carried internally through the merge (Open Library work key, Hardcover book ID; never shown to the model). Parallel, 5-second timeout each, never fails the request. The same data feeds the cards.
- **Gated check:** only a pick whose catalog subjects mark it as criticism of its genre ("history and criticism" / "criticism and interpretation") gets checked. One Haiku call rewrites its description only if it contradicts the catalog facts; any failure keeps the original. Everything else passes through unchanged. An ungated check was rejected after it corrupted accurate descriptions on fresh picks.

### 5f. Hardcover — the tag pool

A second, taste-shaped pool built from reader-applied tags. Fetched once per request, in parallel with the Open Library loop, not as a model-invoked tool.
- **Tag mapping** (`lib/hardcover/mapTasteToTags.ts`): one model call maps the taste description to up to 4 tags from a cleaned 153-tag vocabulary. The model sees tag names only, shuffled, never usage counts.
- **Vocabulary cleaning** (`tagExclusions.ts`): excludes disguised review-form answers (Loveable/Unloveable Characters, Character/Plot driven, fast/medium/slow-paced) and personal shelf labels ("to-read", "Kindle").
- **Pool prep** (`preparePool.ts`): rank by tag-match relevance (never by popularity), require at least 2 matched tags (`RELEVANCE_FLOOR = 2`), keep up to 30 (`WORKING_POOL_SIZE`), shuffle.
- **Failure handling:** a missing token, API error, or no matching tags silently degrades to Open Library only, logged by category, never shown to the user.
- **Known limitation:** a tag can be misread across categories (e.g., "slow burn" is a romance trope, not pacing). One confirmed case; accepted and documented.

### 5g. Merge — what the model sees

`lib/merge/mergeCandidatePools.ts`:
- **Dedup:** exact match on normalized title + author last name (not fuzzy). A book in both catalogs is merged, keeping both sources' data. Hardcover reader count is used only to break ties on which record is canonical.
- **Supplement, not filter:** Hardcover adds candidates; it never re-ranks Open Library's.
- **Shuffle** the full merged pool.
- **What the model sees:** title, author, and subjects only (`toModelPool`). Catalog source, IDs, scores, and rank positions stay internal. Subject formats still differ by catalog (Hardcover plain words, Open Library slugs); normalizing them isn't justified by the evidence so far.
- **Typical split:** roughly 87% Open Library / 13% Hardcover. An estimate, not a target.

---

## 6. Roadmap (after v0)

- **Shelves** (read / want-to-read) and **profiles**. v1.
- **Returning-user persistence**, including anti-repeat across sessions. v1, alongside profiles.
- **Writing-style signal** from reader reviews (needs an extraction step). v1 candidate.
- **Beli-style pairwise ranking.** Pure algorithm, not AI. Later.
- **Goodreads / tracking-app import.** Later; verify feasibility first (Flag C).
- **Gamified visual prompts and bespoke illustration.** Later.
- **Monetization:** v0 ships a configurable affiliate link (§4c). Anything beyond that waits on the "launch vs. portfolio piece" decision.

---

## 7. Flags

**Flag A — the core conviction fights how LLMs behave by default. [most important]** An LLM asked for book recommendations gravitates toward popular, frequently discussed titles. Solving that visibly is the point of the project. Current levers: grounding in real catalogs (§5), bias controls in code (§5b, §5f, §5g), the "first-guess" test for non-obviousness (§4d), and evals that measure it (§4e).

**Flag B — "rich visuals" vs. "simple interface."** Resolved: simple layout and flow, rich moments (§4j).

**Flag C — Goodreads import may not be feasible.** Goodreads closed its public API to new developers. Verify before promising import; alternatives are export files or manual add.

---

## 8. Build plan (v0)

1. **Foundation:** choose hosting and confirm its request-time limit (engine runs take up to ~2 minutes); add a monthly spend cap. (Hosting: Vercel Hobby, done Sept 30.) The hosted data store for logs and the rate limit are deferred to just before public launch.
2. **Visual design pass (in progress):** mockups of the question screens and cards together (§4j). Design system: [`design.md`](./design.md).
3. **Results:** cards, loading screen, error states; engine reserves and card-ready output.
4. **Question flow:** backbone and follow-ups, anchor autocomplete, taste summary with its check and eval set, the "enough signal?" call.
5. **Feedback loop:** per-card actions, rejection path, exclude list, widen mode, feedback logging.
6. **Speed:** set a latency target and trim the engine to meet it, measured on the deployed setup.
7. **Launch polish:** mobile pass, author-fact library, "How it works" page, eval expansion, animations.

## Still open

- Exact wording for each phrasing pool beyond the drafts in `question-bank.md`.
- The "confidence isn't improving" guardrail threshold; needs usage data.
- Author facts: famous authors only, or a mix with lesser-known ones.
- Engine-level open questions: [`decisions.md` §12](./decisions.md#12-open-questions-im-carrying).
