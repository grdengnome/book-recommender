# Decision Log

*Covers decisions through the v0 engine, v0 product planning, and the start of the build (October 3, 2026). Further build decisions will be added as they're made.*

The product and architecture decisions behind this recommender, and the paths I rejected. The [progress log](./progress-log.md) is the session-by-session diary; this file is the story told by decision. Each entry gives the decision and why, with a link to the full detail.

Dates are 2026. "OL" is Open Library and "HC" is Hardcover, the two book catalogs the engine retrieves from.

---

## Contents

- [The through-lines](#the-through-lines): five principles behind almost every decision below

1. [Product scope and definition](#1-product-scope-and-definition)
2. [Question flow and UX](#2-question-flow-and-ux)
3. [Measuring quality](#3-measuring-quality)
4. [Defining "non-obvious"](#4-defining-non-obvious)
5. [Grounding: real books only](#5-grounding-real-books-only)
6. [Retrieval: where candidates come from](#6-retrieval-where-candidates-come-from)
7. [Hardcover: using reader tags as a taste signal](#7-hardcover-using-reader-tags-as-a-taste-signal)
8. [Accuracy of what the user reads](#8-accuracy-of-what-the-user-reads)
9. [Shipping and prioritization](#9-shipping-and-prioritization)
10. [Identity, privacy, and security](#10-identity-privacy-and-security)
11. [How I work with AI tools](#11-how-i-work-with-ai-tools)
12. [Open questions I'm carrying](#12-open-questions-im-carrying)
13. [Visual design](#13-visual-design)

---

## The through-lines

- **The core problem fights the model's defaults.** LLMs drift toward famous books. Most decisions below are about finding where popularity sneaks back in.
- **Decide from evidence.** Most architecture calls were settled by a small test before building. Several confident hypotheses were wrong.
- **Enforce what matters in code.** Rules the model could ignore became rules it can't.
- **Distrust proxies for quality.** Awards, popularity counts, tag frequency, and small-test scores all looked like quality signals and weren't.
- **Accept documented limitations over disproportionate fixes.** Known issues are written down with a trigger for revisiting.

---

## 1. Product scope and definition

### 1.1 v0 is the recommender only
**Decision:** Build only the AI recommender; shelves, profiles, ranking, and import move to v1 or later.
**Why:** Only the recommender is an AI problem. The rest is conventional app-building that would delay the part that matters. ([spec §2](./spec.md))

### 1.2 Draw the line on where AI earns its keep
**Decision:** Use the LLM for taste synthesis, adaptive questioning, and descriptions, not for ranking, storage, or import.
**Why:** Pairwise ranking is a sort algorithm. Calling it AI would be dishonest and more expensive. ([spec §3](./spec.md))

### 1.3 Define "good" before building
**Decision:** A good pick leaves a mark. Bandwagon picks count as failures, and range is required.
**Why:** Without a written bar, "good" drifts toward "popular and safe," which is the model's default. ([spec §4d, Flag A](./spec.md))

### 1.4 Three picks, as cards
**Decision:** Return exactly three recommendations as flip cards.
**Why:** Enough for range, few enough to read, and it discourages filler. ([spec §4a](./spec.md))

### 1.5 v0 is stateless
**Decision:** No memory of users across sessions.
**Why:** Persistence only pays off once profiles exist. Rotating question wording handles staleness for now. ([spec §4a](./spec.md))

### 1.6 Park monetization; verify risky integrations first
**Decision:** No revenue design until "launch vs. portfolio" is decided. Goodreads import must be verified before it's promised.
**Why:** Goodreads closed its API to new developers, and designing revenue before knowing the audience is premature. ([spec §6, Flag C](./spec.md))

### 1.7 v0 is a complete, deployed product, not just an engine
**Decision:** v0 includes the question flow, cards, feedback and rejection path, and a public deployment with a spending guard.
**Why:** A live link beats a repo for a portfolio. Planning the UI also surfaced needs the engine alone never showed: long waits, hosting limits, a public API bill, and no way to learn whether picks land. ([spec §2](./spec.md))

### 1.8 Anonymous feedback is the one exception to stateless
**Decision:** Record anonymous events (👍/👎, already read, swaps, question completion) with no user identity.
**Why:** The original goal included knowing whether picks are "valued and accepted," and v0 had no way to learn that. Anonymous events answer it without profiles. ([spec §4i](./spec.md))

### 1.9 Monetization starts as a configurable affiliate link
**Decision:** "Find this book" links to Bookshop.org (affiliate), with Open Library as the fallback. Destination and tag are configuration, not code. Amazon later.
**Why:** Bookshop has no minimum-sales requirement and fits the anti-default brand; Amazon's qualifying-sales rule risks closing a low-traffic account. Revenue is small either way, so the link has to be easy to swap. ([spec §4c](./spec.md))

### 1.10 Author facts move from the cards to the loading screen
**Decision:** A curated, source-verified library of facts about well-known authors plays during the wait, instead of facts about each pick on the cards.
**Why:** Catalog lookups already cover the cards, and a 30–120 second wait needs something worth watching. General facts need no engine change, and verifying each once means the most visible moment can't show a false claim. ([spec §4h](./spec.md))

---

## 2. Question flow and UX

*2.1–2.9 designed in initial planning; 2.10–2.17 decided in v0 product planning, Sept 29. Not yet built.*

### 2.1 Tap-to-answer, with free text as a fallback
**Decision:** No question requires typing.
**Why:** Typing is the biggest drop-off in a quiz, and options give the model cleaner signal. ([checkpoint #1](./checkpoint.md))

### 2.2 A fixed backbone with rotating wording
**Decision:** Always ask anchor → why → appetite, but rotate each question's wording through 4–5 phrasings.
**Why:** The structure carries the signal; the wording is what feels stale. Appetite also puts the anti-mainstream dial in the user's hands. ([checkpoint #2](./checkpoint.md))

### 2.3 Creative prompts capped at about one per session
**Decision:** Emoji and image prompts are alternate phrasings, not a separate step.
**Why:** One creative moment delights; a whole creative track feels like a gimmick and adds length. ([checkpoint #3](./checkpoint.md))

### 2.4 Confidence-based stopping, not a question cap
**Decision:** Reversed my own "5 questions max." The model asks only while signal is improving, and targets the thin category.
**Why:** A cap forces picks from thin signal or wastes questions on clear users. ([checkpoint #8](./checkpoint.md))

### 2.5 The turn-off question is never forced
**Decision:** Ask "anything you're not in the mood for?" only when needed.
**Why:** High-signal, but asking every time makes the quiz feel like a form. ([checkpoint #4](./checkpoint.md))

### 2.6 A rejection path with a two-step exit
**Decision:** If all three picks miss: one clarifying question, then an editable read-back of the user's taste, then deliberately varied picks.
**Why:** Narrowing on a misread profile traps the user. Letting them correct it is more honest and more effective. ([checkpoint #5](./checkpoint.md))

### 2.7 Reflect-back built from real answers
**Decision:** Loading screens quote the user's actual answers.
**Why:** Specific quotes feel like understanding; generic lines feel like a horoscope. ([question bank](./question-bank.md))

### 2.8 Cover images: a fallback chain
**Decision:** Open Library, then Google Books, then a designed placeholder.
**Why:** Open Library is free but thin on obscure titles, which is where this app leans. ([spec §4c](./spec.md))

### 2.9 Simple layout, rich moments
**Decision:** Keep the flow simple; spend the visual budget on the card reveal and button "pop."
**Why:** "Vibrant" and "uncluttered" pull against each other, so I resolved it on purpose. ([spec Flag B](./spec.md))

### 2.10 Anchor entry uses autocomplete, and never blocks
**Decision:** Suggest real books as the user types, with a "use what I typed" escape. Suggestions target under a second, and "Next" always works.
**Why:** An exact book helps both the engine and the summary check. It runs while typing, so it never adds to the wait. The source (Open Library or Hardcover search) is chosen by measured speed. ([spec §4a](./spec.md))

### 2.11 An AI-written taste summary is the engine's input
**Decision:** One small model call turns the answers into a plain-language summary. That summary is both the engine's input and the read-back text.
**Why:** Editing the read-back then edits exactly what the engine sees. The risk of a dropped or invented preference is handled like grounding: a code check for must-have answers, a template fallback, and its own eval set. ([spec §4f](./spec.md))

### 2.12 The read-back appears only on the rejection path
**Decision:** Don't show the taste summary before every run.
**Why:** It keeps the main flow fast, and the code check makes misreads rare. Revisit if first-result 👎 rates run high. ([spec §4g](./spec.md))

### 2.13 Reserve picks make swaps instant
**Decision:** Each run returns 3 picks plus 2–3 grounded, verified reserves.
**Why:** Every rerun is a 30–90 second wait. Reserves from the same run make "already read it" instant for a small extra cost. ([spec §4b](./spec.md))

### 2.14 👎 records feedback and offers an optional swap
**Decision:** A thumbs-down is always recorded and reveals "show me another"; it doesn't auto-swap.
**Why:** Auto-swapping removes the chance to compare; record-only leaves the user at a dead end. ([spec §4c](./spec.md))

### 2.15 The rejection path is capped at three reruns
**Decision:** Clarify → read-back → widen, then offer "start over."
**Why:** Each rerun is a full wait and a full cost, and three misses usually means a fresh start will work better. ([spec §4g](./spec.md))

### 2.16 No ratings on cards in v0
**Decision:** The card back shows the description, why it fits, the non-obvious angle, and a link, not ratings.
**Why:** No reliable ratings source is confirmed, and thin rating counts on obscure books drag averages down, working against the product. ([spec §4c](./spec.md))

### 2.17 A visual design pass before building screens
**Decision:** Mock up the question screens and cards together before writing UI code.
**Why:** They're the first impression and must feel engaging and satisfying. Designing them together keeps one visual language, and mockups are cheaper to change than code. ([spec §4j](./spec.md))

---

## 3. Measuring quality

### 3.1 Eval-driven from day one
**Decision:** Every prompt or logic change is scored against fixed test cases.
**Why:** It turns "looks good" into evidence, and several findings below only exist because of it. ([eval set](./eval-set.md))

### 3.2 A six-part rubric on a four-point scale
**Decision:** Relevance, non-obviousness, range, correctness, traceability, and variety across sessions.
**Why:** I added variety because the other five can all pass while a returning user sees the same list. Relevant repeats are fine; staleness isn't. ([checkpoint #7](./checkpoint.md))

### 3.3 Score against outside sources
**Decision:** Check obscurity and correctness against Goodreads, awards, and reception, not the model's opinion.
**Why:** A model grading its own picks shares the blind spots that produced them. ([eval log, Aug 2](./eval-log.md))

### 3.4 Remove hidden bias from tests and prompt
**Decision:** Reworded eval cases that hinted at answers, and removed my touchstone books from the prompt.
**Why:** Named examples become magnets, and a test that hints at its answer tests nothing. ([progress log, Jul 5–7](./progress-log.md))

### 3.5 Label single-turn stand-ins honestly
**Decision:** Three cases that need the unbuilt question flow are marked as approximations.
**Why:** Reporting them as real passes would overstate what the engine does. ([eval log, Sep 23](./eval-log.md))

### 3.6 Narrow runs for hypotheses, full runs for milestones
**Decision:** Test a specific question on only the relevant cases.
**Why:** Faster evidence at lower cost, while keeping full milestone comparisons. ([eval log, Aug 4](./eval-log.md))

---

## 4. Defining "non-obvious"

### 4.1 Prompt v2: drop "never recommend bestsellers"
**Decision:** Softened a blanket ban on bestsellers.
**Why:** Popularity isn't the problem; defaulting to a safe pick is. ([progress log, Jul 7](./progress-log.md))

### 4.2 Prompt v3: awards aren't evidence of non-obviousness
**Decision:** Prize-winners aren't hidden gems by default.
**Why:** The model was calling *Disgrace* and *Lincoln in the Bardo* overlooked. A bigger catalog wouldn't fix it; it was a definition problem. ([progress log, Jul 10–12](./progress-log.md))

### 4.3 Prompt v4: the "first-guess" test
**Decision:** A pick fails if a well-read person would name it first for this exact request.
**Why:** v3 was dodged through other kinds of fame. This targets the real failure and still allows a decorated book nobody would guess. ([eval log, Aug 2](./eval-log.md))

### 4.4 No invented reception claims
**Decision:** The model can't assert a book's fame or obscurity unless it's confident.
**Why:** It called *Say Nothing*, one of the decade's most decorated books, "overshadowed." A rule against one bias had taught it to write false disclaimers. ([eval log, Aug 2](./eval-log.md))

---

## 5. Grounding: real books only

### 5.1 Use a real catalog, not the model's memory
**Decision:** Retrieve real candidates from an external catalog.
**Why:** The same few titles recurred across very different inputs, and two rounds of prompt changes didn't fix it. ([spec §5](./spec.md))

### 5.2 Retrieval is a tool, not prompt text
**Decision:** A `search_books` tool the model calls, built on a reusable tools pattern.
**Why:** Keeps the prompt about taste, lets the model re-search when results are thin, and makes future tools plug-in. ([spec §5a](./spec.md))

### 5.3 Shuffle and strip ranking data
**Decision:** Randomize candidate order and remove scores before the model sees them.
**Why:** Models favor earlier items, so the catalog's ranking would re-import its popularity bias. ([spec §5b](./spec.md))

### 5.4 No cap on pool size
**Decision:** Don't limit how many candidates the model sees.
**Why:** Cost is trivial at this scale, the shuffle handles dilution, and capping works against breadth. ([spec §5b](./spec.md))

### 5.5 End the search loop structurally
**Decision:** After three searches, the tool is removed from the request.
**Why:** An instruction to stop can be ignored; a missing tool can't. ([progress log, Aug 1](./progress-log.md))

### 5.6 No fallback to memory, enforced in code
**Decision:** Code checks every pick against the retrieved pools; misses retry up to 3 times, then return a clean error.
**Why:** A test returned 2 of 3 picks from outside the pool. The rule had only been implied. A thin pool now errors instead of giving a weak answer, by choice. ([progress log, Sep 20](./progress-log.md))

### 5.7 When the guardrail broke the product
**Decision:** The pick check got its own accent- and subtitle-tolerant matching, separate from the merge.
**Why:** It falsely rejected 5 legitimate picks (accent encoding, marketing subtitles) and failed one fully grounded request. ([eval log, Sep 20](./eval-log.md))

### 5.8 Hide each candidate's catalog from the model
**Decision:** The model no longer sees which catalog a candidate came from.
**Why:** Showing it broke the rule that the model sees only title, author, and subjects. Removing it was safe: grounding and logging read the internal record. Subject formats still differ between the catalogs, but the evidence doesn't justify normalizing them. ([eval log, Sep 29](./eval-log.md))

---

## 6. Retrieval: where candidates come from

### 6.1 Diagnose before switching
**Decision:** Log each pool's contents before changing retrieval.
**Why:** My hypothesis (similar queries cause repeats) was wrong. The real cause: Open Library's subject lists are nearly static and supplied 99–100% of pools. ([eval log, Aug 3–4](./eval-log.md))

### 6.2 Treat clustering as a tendency, not a list of offenders
**Decision:** Stop chasing individual repeated titles.
**Why:** Identical runs showed the same clustering rate with different titles. Blocking books would just surface new ones. ([eval log, Aug 2](./eval-log.md))

### 6.3 Stop relying on free-text search, across three providers
**Decision:** Stop tuning free-text search and shift the retrieval burden to subject lists and Hardcover tags. Open Library's search call still runs but contributes very little.
**Why:** It matches words, not taste. "cult novel" returned *1984* and a *Batman* comic, and longer queries collapse to zero hits. Google Books and Hardcover search failed the same way. ([progress log, Aug 4–6](./progress-log.md))

### 6.4 Two sources with different jobs
**Decision:** Open Library for breadth, Hardcover's reader tags for taste.
**Why:** A tag-based pull showed no clustering around famous titles, unlike every search engine tested. ([progress log, Aug 5](./progress-log.md))

### 6.5 Supplement, don't filter or re-rank
**Decision:** Hardcover adds candidates to the pool. Duplicates match exactly on title plus author.
**Why:** Re-ranking can't create diversity that was never retrieved. Tested first: Hardcover added 26–28 new books per request. ([progress log, Aug 15](./progress-log.md))

### 6.6 Multi-subject search for richness; relevant overlap is fine
**Decision:** Search several subjects per request, and accept overlap between users.
**Why:** It grew pools ~96% but left 56.6% overlap. The rubric says relevant repeats are fine, and the overlap didn't reach final picks. ([progress log, Aug 19–20](./progress-log.md))

### 6.7 Source split is an estimate, not a target
**Decision:** Keep the ~87/13 split instead of my ~75/25 guess.
**Why:** The gap is structural. Loosening quality filters to hit a made-up number would trade relevance for vanity. ([progress log, Aug 20](./progress-log.md))

### 6.8 Don't test on a known-bad foundation
**Decision:** Paused the first merge run when I found its prerequisite was never built.
**Why:** Results on a pool I knew was too narrow would mislead. ([progress log, Aug 16](./progress-log.md))

---

## 7. Hardcover: using reader tags as a taste signal

### 7.1 Audit tag data before trusting it
**Decision:** Use genre/mood/trope tags; exclude review-form answers and shelf labels. 153 of 190 common tags kept.
**Why:** The top "tags" were a fixed review form. Book-level data made them look organic; reader-level data showed one pick per reader. ([progress log, Aug 6–13](./progress-log.md))

### 7.2 Rank by taste match, not popularity
**Decision:** Rank Hardcover results by tags matched, then shuffle. Reader count only breaks merge ties.
**Why:** Sorting by readers returned *1984* and *The Hobbit* for unrelated tag sets. ([progress log, Aug 15–16](./progress-log.md))

### 7.3 A wider pool with a quality floor
**Decision:** 30 candidates, each matching at least 2 chosen tags.
**Why:** Widening added variety, but single-tag matches drifted off-genre. The floor came from real score data, not a guess. ([progress log, Aug 20](./progress-log.md))

### 7.4 Hardcover is a fixed lookup, not a model tool
**Decision:** Fetch Hardcover once per request; Open Library stays model-driven.
**Why:** Narrow exact tag matching suits one predictable fetch. The asymmetry is intentional. ([progress log, Aug 19](./progress-log.md))

### 7.5 Tag selection can't see tag popularity
**Decision:** The tag selector sees names only, shuffled, never usage counts.
**Why:** Seeing counts would pull it toward popular tags. Preventing it structurally beats instructing against it. ([progress log, Aug 20](./progress-log.md))

### 7.6 Hardcover failures degrade silently
**Decision:** If Hardcover fails, continue with Open Library only and log it on the backend.
**Why:** It's a beta API. A secondary source should never take down the product. ([progress log, Aug 27](./progress-log.md))

### 7.7 Low Hardcover pick rate is proportional, not a bug
**Decision:** No fix.
**Why:** Nothing caps it, and at ~45% of the pool in a stress test, Hardcover books got picked. ([progress log, Sep 17](./progress-log.md))

### 7.8 Rejected: more tags per request
**Decision:** Closed after testing.
**Why:** A blind comparison showed the same fit rate (6.3% vs. 7.1%). More tags added volume, not quality. ([progress log, Sep 17](./progress-log.md))

### 7.9 Accepted limitation: the "slow burn" mix-up
**Decision:** Leave it documented, unfixed.
**Why:** One confirmed case. Hand-labeling every tag was disproportionate, and adding sample titles would reintroduce popularity bias. ([progress log, Sep 18](./progress-log.md))

### 7.10 Fill gaps with the right mechanism
**Decision:** Page count for read length; writing style deferred to v1 via reviews; appetite needs tag rarity; turn-offs need content-warning tags.
**Why:** No tags exist for those needs, and forcing tags to fit would produce bad matches. ([progress log, Aug 13–15](./progress-log.md))

---

## 8. Accuracy of what the user reads

### 8.1 Fix the wrong-book description now
**Decision:** Fix it before moving on, though it only blocked launch, not v0.
**Why:** An essay collection was described as a noir novel. Wrong descriptions break trust, and the root cause was clear: the model describes picks from memory. ([eval log, Sep 23–26](./eval-log.md))

### 8.2 Look up each final pick in the catalog
**Decision:** Fetch each pick's catalog record by ID after grounding, hidden from the model.
**Why:** It gives facts to check against without changing what the model sees, and the data feeds the cards later. ([spec §5e](./spec.md))

### 8.3 Only check when there's hard evidence
**Decision:** A small model rewrites a description only when the catalog flags the book as criticism of its genre.
**Why:** An always-on check aced a small test set, then made accurate descriptions wrong on fresh picks. I was overfitting. Gated: 45/45 correct. ([eval log, Sep 26](./eval-log.md))

### 8.4 Rejected: a bigger model for the check
**Decision:** Kept Haiku over Sonnet 5.
**Why:** Sonnet was ~4x slower and not more accurate. ([eval log, Sep 26](./eval-log.md))

### 8.5 Accuracy vs. latency
**Decision:** Accept 0.4–5s of lookups, plus ~3s when a pick is flagged. Don't chase every error type.
**Why:** Maximum accuracy, but not at the cost of significant slowdown for edge cases. ([eval log, Sep 26](./eval-log.md))

### 8.6 Deferred: replace or re-describe?
**Decision:** Undecided.
**Why:** An honest rewrite can reveal a pick no longer fits the request. Worth a deliberate call, not a rushed one. ([eval log, Sep 26](./eval-log.md))

---

## 9. Shipping and prioritization

### 9.1 Declare v0 done, with documented limitations
**Decision:** Engine complete for v0 on Sept 18, followed by a short wrap-up plan.
**Why:** An engine can always be tuned. Without a stopping point, the UI never starts. ([progress log, Sep 18](./progress-log.md))

### 9.2 Separate "blocks v0" from "blocks launch"
**Decision:** Classify every issue by what it blocks.
**Why:** Treating everything as urgent stalls progress; treating nothing as urgent ships broken trust. ([progress log, Sep 23](./progress-log.md))

### 9.3 A dated v0 baseline
**Decision:** Score all 11 cases as a fixed reference point.
**Why:** Future changes need something to compare against. Result: 11/11 delivered, 33/33 picks grounded. ([eval log, Sep 23](./eval-log.md))

### 9.4 Don't chase what I can't measure
**Decision:** Park the popularity-in-tags question and a stress-test-only bug.
**Why:** One needs logging that doesn't exist yet; the other never reproduced in the real route. ([progress log, Sep 17](./progress-log.md))

### 9.5 Stop auditing, test the real thing
**Decision:** Switched from data auditing to testing the merge on the original problem.
**Why:** A week of input polishing hadn't tested whether the pipeline worked at all. ([progress log, Aug 13](./progress-log.md))

### 9.6 Clean the repo for a reviewer
**Decision:** Index experiment scripts, remove finished ones, fix the build.
**Why:** A portfolio repo should be navigable. The cleanup also found the app couldn't build from a fresh copy. ([scratchpad index](../scratchpad/README.md))

### 9.7 Plan the whole v0 flow before building any of it
**Decision:** Sketch every screen and the engine changes each needs before building. Considered and set aside: shipping a text-box-only slice first, or starting with card design alone.
**Why:** The pieces depend on each other: the read-back reuses the taste summary, swaps and reruns need the same engine change, and feedback and logs share storage. Planning end to end avoids building into a corner. ([spec §8](./spec.md))

### 9.8 Foundation before any UI
**Decision:** Hosting, log storage, and a spending guard come first.
**Why:** A host's request-time limit or ban on file writes could change what's possible, and a public link without a spend cap risks a surprise bill. ([spec §8](./spec.md))

### 9.9 Engine speed is a v0 workstream
**Decision:** Set a latency target and trim the engine to meet it, measured on the deployed setup.
**Why:** Waits of 30–120 seconds were fine while reading logs. They're a product problem once someone is watching a screen. ([spec §8](./spec.md))

### 9.10 Host on Vercel's free plan
**Decision:** Vercel Hobby, with the recommend route's limit set to 300 seconds.
**Why:** Netlify's 60-second limit would force a redesign, and Render/Railway cost money or sleep when idle. Vercel is built for Next.js, gives every PR a preview link, and the free plan can't run up a bill. Its non-commercial terms are fine for a portfolio project; move to Pro if this becomes a product. ([progress log, Sep 30](./progress-log.md))

### 9.11 Deploy privately first
**Decision:** All deployments stay behind Vercel login until the rate limit exists.
**Why:** The moment it deploys, the engine is a public endpoint that spends money per call. ([progress log, Sep 30](./progress-log.md))

---

## 10. Identity, privacy, and security

### 10.1 Build in public under a pseudonym
**Decision:** A separate GitHub identity, with email privacy on.
**Why:** Show the work publicly while keeping it separate from my real name. ([progress log, Jul 13](./progress-log.md))

### 10.2 Rewrite history to remove personal data
**Decision:** Rewrote git history twice to remove my email and a former username, then asked GitHub to purge cached copies.
**Why:** Deleting a line doesn't remove it from history. I updated all commit references in the docs in the same pass. ([progress log, Sep 28](./progress-log.md))

### 10.3 Secrets never pass through chat or terminal
**Decision:** Keys go straight into a local env file; tokens are read-only.
**Why:** AI tools confirm saves by key name only, so secrets never appear in a transcript. ([CLAUDE.md](../CLAUDE.md))

### 10.4 Cap spending at the API, not the host
**Decision:** A dedicated Console workspace with a $20 monthly limit and an alert; its key is used only by Vercel, separate from the development key.
**Why:** On Vercel's free plan, hosting can't cost anything; the real risk is model calls. A hard cap at the source is the simplest guarantee. ([progress log, Sep 30](./progress-log.md))

---

## 11. How I work with AI tools

*I'm not a developer by training. These rules let me direct an AI-built codebase and still own every decision in it.*

### 11.1 Clear roles
**Decision:** I decide and review. A Claude chat diagnoses and writes instructions. Claude Code implements.
**Why:** Architecture decisions stay with me, not the coding agent.

### 11.2 One decision per instruction
**Decision:** Each instruction covers one decision, with stop-and-review checkpoints.
**Why:** Bundled changes hide which change caused which effect, and they're hard to undo.

### 11.3 Investigate, decide, then build
**Decision:** Raw output first, strategy second, code third.
**Why:** Several hypotheses I'd have built on were wrong (§6.1, §6.3, §8.3).

### 11.4 Written records at two levels
**Decision:** A concise progress entry per session, an eval log, and this file. Docs go straight to `main`; code goes through pull requests.
**Why:** Anyone, including future me, can see what happened and why. ([CLAUDE.md](../CLAUDE.md))

---

## 12. Open questions I'm carrying

- **Does tag relevance still favor popular books?** Needs logging first.
- **Cross-case repeats** within a run. Pool size alone doesn't create variety.
- **Thin or empty pools** error cleanly by design; no recovery path yet.
- **One eval case never gets Hardcover candidates**: its input names no genre or mood to map.
- **Replace or re-describe** a pick whose corrected description no longer fits.
- **The question-flow stopping threshold** needs real usage data.
- **Raw catalog data leaks into display text** (non-Latin author names, missing co-authors). Scheduled: card-ready output in [spec §4b](./spec.md).

---

## 13. Visual design

### 13.1 Design before data store
**Decision:** Start the visual design pass now; move the data store and rate limit to just before the site goes public.
**Why:** Nothing uses the data store while the site is private and has no screens. Deploying already surfaced the hosting constraints the foundation phase was meant to find. ([progress log, Oct 3](./progress-log.md))

### 13.2 Readers first, not recruiters
**Decision:** Design for the book nerd who cares about a book's whole presentation; aim for a cult following.
**Why:** A product built for its real audience makes a better portfolio piece than a demo built for reviewers. ([design §1](./design.md))

### 13.3 Clean, never quiet
**Decision:** Few words and one idea per screen, at 7–8 out of 10 energy; the reveal is the 10.
**Why:** My first framing ("calm canvas, big moments") read as stock. Every screen needs personality; restraint comes from word count and focus, not muted color. ([design §2](./design.md))

### 13.4 Rotating themes on one shared structure
**Decision:** The app opens in a different genre theme each visit. Every theme uses the same layout; only the skin changes (fonts, colors, shapes, art, wording).
**Why:** Rotation keeps the app fresh. A shared structure means each screen is built once, and it still feels like one product. ([design §3](./design.md))

### 13.5 Five themes at launch
**Decision:** Bookshop, Fantasy, Superhero, Mystery, Sci-fi. Horror, historical, and romance come later.
**Why:** Five is enough for variety while each gets real care; a weak theme hurts more than a missing one. Horror was held back as the most likely to feel wrong on the wrong request. ([design §4](./design.md))

### 13.6 A theme changes everything, not just color
**Decision:** Fonts, button shapes, input fields, cards, and wording all follow the theme.
**Why:** Early versions felt like one template recolored. Distinct shapes and voice are what make each theme feel like its genre. ([design §4](./design.md))

### 13.7 Themes are decoration, picked at random
**Decision:** A theme doesn't signal the genre of the picks. Skinning each reveal to its book's genre is a later step.
**Why:** Random rotation is simple and needs no engine change. Matched reveals need a genre label per pick. ([design §5](./design.md))

### 13.8 One book per reveal screen
**Decision:** Reveal each pick on its own screen with the cover dominant, then show all three together, with a detail page per book.
**Why:** A single cover gets full attention, which makes each pick an event; comparison comes after. ([design §3](./design.md))

### 13.9 Light or dark by theme; the toggle waits
**Decision:** Each theme is whichever mode suits it. No user light/dark toggle in v0.
**Why:** A toggle would double five themes into ten skins. ([design §4](./design.md))

### 13.10 The worm as a recurring brand detail
**Decision:** One small worm on key screens in every theme, costumed for the theme.
**Why:** It ties the themes together as one brand without a heavy logo. ([design §6](./design.md))
