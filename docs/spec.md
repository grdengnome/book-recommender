# Book Recommender — Spec

*Single source of truth. Fully self-contained — nothing here refers back to an earlier version you'd need to cross-reference. Tags: **[FACT]** = needs research/verification · **[SYNTH]** = judgment/design call · **[YOU]** = only you decide · **[RESOLVED]** = settled, with the reasoning kept below.*

---

## 1. Product summary

An AI book recommender whose wedge is *taste articulation* — turning a user's mood, preferences, and feedback into **non-obvious, high-quality recommendations** drawn from many sources, delivered through a distinctive card-flip UX. The differentiator isn't "recommends books"; it's "recommends the books a thoughtful friend with eclectic taste would, not the bestseller list everyone already knows." See Flag A — this conviction actively fights how LLMs default to behaving, and solving that visibly is the portfolio-worthy part.

---

## 2. Core scope decision

The full product idea (from the original capture doc) is three products in one trenchcoat: a recommender, a Beli-style ranking system, and a reading-organization tool, plus Goodreads import, profiles, and gamified visual prompts. That's a full consumer app, not a first AI build.

The recommender is the only piece that's actually about AI. Everything else is conventional app-building that doesn't showcase the skill being demonstrated.

| Tier | Scope | Why |
|---|---|---|
| **v0 (build this)** | The recommender: adaptive questioning → 3 card recommendations → feedback/refine loop → the eval system behind it | This is the AI. It's the portfolio piece. Shippable in weeks. |
| **v1 (next)** | Reading-organization page (shelves), profile, card-flip detail view, returning-user persistence | Conventional features that make it a real product. |
| **Later** | Beli-style ranking, Goodreads/import, gamified visual prompts | High effort, none of it AI; import has a hard external dependency (Flag C). |

**Confirmed:** v0 = the recommender only.

---

## 3. Where AI earns its keep (and where it doesn't)

Being able to articulate this boundary is itself part of the portfolio signal.

| Genuinely AI (LLM-shaped) | NOT AI (conventional code) |
|---|---|
| The recommendation reasoning — synthesizing taste into picks | The ranking system — pairwise comparison is a sort algorithm (Elo-style), not an LLM |
| Adaptive questioning — deciding when to ask more vs. recommend | Shelves / organization — basic CRUD |
| Writing the engaging card descriptions | Goodreads import — data plumbing |
| The "you didn't like these" clarifying pivot | Card-flip UI, tabs, navigation — front-end |

The ranking feature is not an AI feature. That's not a knock, it's clarity — the AI story lives entirely in the recommender.

---

## 4. v0 specification

### 4a. Core flow

Opening page *is* the recommender (no landing/login wall). User answers preference prompts → AI refines as answers come in → returns **3** recommendations as cards.

**[RESOLVED] Input mode:** every question — trio, adaptive, rejection — presents as clickable/tappable options with a "write your own" free-text fallback. Nothing requires typing to proceed.

**[RESOLVED] Adaptive depth — confidence-based, no hard cap:** the model keeps asking only while signal is genuinely improving, and stops once it judges input sufficient. This *replaces* an earlier "~5 questions max" rule, which was reversed because a hard cap fights against letting genuinely thin signal get a real follow-up.
- Guardrail (not a cap, exact number TBD from testing): if confidence isn't improving after repeated attempts, use best judgment and move to recommendations rather than spiraling.
- Targeted follow-ups: when signal is weak, return to the *specific* thin category rather than pulling generically from the adaptive pool.

**[RESOLVED] Persistence:** v0 is fully stateless — no cross-session memory of a user, even locally. The rotating phrasing pools (4a-i) do the anti-staleness work instead of tracking what a returning user has seen. Revisit in v1 once profiles exist.

Full question wording, pools, and mechanics: see **`docs/question-bank.md`** — kept separate from this spec because it's content, not architecture, and will grow independently.

### 4b. The recommendation engine

The heart of the product. Takes the user's articulated taste and produces non-obvious, multi-source-grounded picks.

**Open [FACT/SYNTH] — the single biggest build-architecture question:** does v0 recommend from the model's own knowledge, or ground it against an external book dataset/API for breadth and to fight repetition? Not yet resolved — see Section 5.

### 4c. The card UX

Concise list of 3 cards, "Pokémon-card" reveal. Cover image as background + a short, engaging hook. Tap to flip → fuller description + ratings.

**[RESOLVED] Cover image sourcing:** lookup order is **Open Library (primary) → Google Books (fallback) → designed placeholder (final fallback)**.
- Open Library: free, no commercial-use restriction, no signup, rate limit (~3 req/sec with identified User-Agent) sufficient for on-demand single-user fetches. Fetch by ISBN: `https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg`. Gap: inconsistent coverage on obscure/non-mainstream titles — exactly where this app leans.
- Google Books: stronger coverage on gaps, but unauthenticated requests cap around 100/day — a real API key is needed for actual usage, and there are attribution/branding rules to follow.
- Lookup: Open Library by ISBN → if empty, Google Books by ISBN → if still empty, designed placeholder.

Note the tension with "simple/uncluttered" (Flag B): keep the *interface* simple even while the *cards* are visually rich. Spend the visual budget on the cards, not the surrounding chrome.

**Visual design direction (from original ideation, not yet fully designed):**
- Opening page *is* the recommender — simple layout, with a "cartoon" / fairy-tale-accessory visual quality that mimics book covers, potentially rotating between cover-style imagery.
- Vibrant color theme, meant to evoke imagination/creativity rather than a neutral utility-app palette.
- Buttons should feel physically satisfying — a "pop" or "explode like a cloud" interaction on tap, not a flat click.
- All screens/features should carry one consistent visual theme rather than feeling like separate mini-apps bolted together.
- v1, once shelves/profile exist: bottom tab bar for navigation between sections.
These are directional, not final — treat as a brief for whoever designs the actual UI, not literal implementation instructions.

### 4d. What "good" means

The quality bar the recommender (and the evals) must hit:

- **Impression over popularity.** Target books that "leave a mark" — that you'd itch to recommend, quiet standouts you can't put down. Touchstones: *Stoner*, *The Uncool*, *Project Hail Mary*.
- **Penalize the bandwagon.** Over-recommended, everyone-says-so picks are a *failure*, not a safe default. Reward range across years, authors, genres.
- **Multi-source, not single-source.** Synthesize from many places; never lean on one canon.

This directly informs the system prompt's explicit instructions and the eval rubric in 4e.

### 4e. Evaluation

Build a set of **20–30 test inputs** (taste descriptions) with notes on what a *good* vs *lazy* response looks like for each. Score prompts against it as you tune. Track quality over time in an `eval-log.md`. Full rubric and current test case bank: **`docs/eval-set.md`**.

**[RESOLVED] Rubric — 6 dimensions, 4-point scale (fail/weak/good/excellent):** Relevance, Non-obviousness, Range, Real & correct, Traceability, Variety across sessions (new — avoids near-identical rec sets for similar/repeat inputs; individual repeat titles are fine if genuinely relevant, staleness across sessions is the failure mode).

---

## 5. Data & sources — RESOLVED

**The open question — resolved.** Does v0 need grounding, or can a well-prompted model carry it alone? **Answer: grounding is needed.** Two separate eval findings (documented in `docs/eval-log.md`, 2026-07-08) showed the model repeatedly draws from a narrow internal "go-to" pool for common taste profiles (e.g., "So Long, See You Tomorrow," "Convenience Store Woman," "Independent People," "Piranesi" recurring across structurally distinct inputs) regardless of prompt wording changes. This is a real, evidenced limitation, not a hypothetical one — prompt tuning alone (Prompt v2, v3) did not resolve it.

### 5a. Architecture — tool-based retrieval, not prompt-embedded logic

The retrieval logic does **not** live in `SYSTEM_PROMPT` as inline instructions. It's implemented as a **tool** the model can call via the Anthropic API's tool-use (function-calling) feature — the same general mechanism used for any external capability a model needs mid-reasoning, not something custom-built for this one case.

**Why tool-use over stuffing logic into the prompt:** keeps `SYSTEM_PROMPT` focused on taste judgment (what makes a good recommendation) rather than mixed with retrieval mechanics (how to query an external API). It also means the model itself decides *when* and *how many times* to call the tool — including retrying with broader search terms if an initial pool comes back thin — rather than requiring hand-coded retry logic in the application.

**This project should adopt a general "tools" pattern, not a single hardcoded integration** — built so that future capabilities (e.g., a cover-image lookup tool, an author-fact-pool lookup, anything else identified later) can be added the same way, without re-architecting. Concretely:
- A `lib/tools/` directory, one file per tool (e.g., `lib/tools/searchBooks.ts`).
- Each tool file exports: (1) its Anthropic tool-definition schema (name, description, input parameters), and (2) the actual implementation function the code runs when the model calls it.
- A central tool registry (e.g., `lib/tools/index.ts`) that assembles the list of available tool definitions to pass to the API, and dispatches incoming tool-call requests to the right implementation.
- `SYSTEM_PROMPT` references available tools by name and intent only ("you have access to a search_books tool — use it to ground recommendations in real candidates") — never by embedding a tool's internal logic as prompt text.

**Convention for adding tools going forward:** each new tool gets its own numbered subsection (5b, 5c, 5d...) following this same template — purpose, mechanics, any bias/quality mitigations specific to it. Section 5a's architecture pattern (the `lib/tools/` structure, registry, prompt-reference-only rule) does not need to be re-explained or re-decided for each new tool — only referenced.

### 5b. First tool — `search_books`

**Two underlying API calls, merged into one candidate pool:**
1. **Open Library Search API** (`/search.json?q=...`) — free-text, relevance-ranked search. Model-generated natural-language-ish search terms (e.g., "quiet character study morally ambiguous") work here; matching is lenient (terms are boosted, not all required to match).
2. **Open Library Subjects API** (`/subjects/{subject}.json`) — exact controlled-vocabulary genre/subject tags (e.g., `psychological_fiction`). Model-generated stricter subject guesses go here.

Both are free, require no API key, and are called once per tool invocation — no meaningful cost or rate-limit concern at this scale.

**Merge and pool-building logic (in code, not the model):**
- Combine results from both calls.
- Deduplicate by title + author (or Open Library's internal work ID where available).
- **No hard cap on pool size, and this is a deliberate choice, not an oversight.** The two real risks of a large candidate pool are (1) token cost and (2) relevance dilution. (1) is a non-issue at this scale — even 150–200 candidates is roughly 3,000–4,000 tokens, small change against Claude's context window. (2) is real, but it's addressed directly by the shuffle and explicit "don't favor earlier entries" instruction below — those solve dilution without needing to artificially throttle breadth, which is the actual goal here. If pool size later proves to be a genuine problem in practice (not just a theoretical one), revisit with real data rather than pre-emptively capping it now.
- **If the merged pool is thin (under ~15–20 candidates):** this is a signal for the *model* to recognize and act on — it can call `search_books` again with broader or different terms, rather than the application silently proceeding with a weak pool. Only if repeated tool calls still return too little should the model fall back to its own trained knowledge, and it should do so transparently (e.g., reflected honestly in its reasoning, not hidden).

**Bias mitigation — critical, non-negotiable requirements:**
- **Shuffle the merged candidate list before returning it to the model.** Language models exhibit measurable position bias — favoring earlier list items regardless of actual merit. Randomizing order in code, every time, before the tool result is returned neutralizes this entirely.
- **Strip relevance scores, rank position, and any other ranking metadata** before returning results to the model. Only title, author, and a subject tag or two should be visible — the model must never see which API result was "ranked first."
- **`SYSTEM_PROMPT` must explicitly state** that the candidate list is unordered and that earlier entries should not be favored — reinforcing the shuffle in code with an explicit instruction, belt-and-suspenders.

### 5c. What `SYSTEM_PROMPT` actually needs to say about this (kept short, by design)

Only a few sentences — the mechanics live in code and the tool definition, not here:
- That a `search_books` tool exists and should be used to ground recommendations in real, retrieved candidates rather than relying solely on trained knowledge.
- That the tool may be called more than once if results feel too narrow.
- That the returned candidate list is unordered — no positional favoritism.
- That the final picks should still be judged against the existing taste-fit rules (impression over popularity, resist the bandwagon, awards ≠ non-obviousness) — grounding changes *where candidates come from*, not the *judgment* applied to them.

### 5d. Cover images — unchanged, already resolved (Section 4c)

No change here; this section's resolution is scoped to the recommendation-engine grounding question only.

---

## 6. Roadmap (deferred, captured so nothing's lost)

- **Reading-organization page** — shelves for read / want-to-read. Conventional, v1.
- **Profile** — account, preferences, layout selections. v1.
- **Returning-user persistence / anti-repeat tracking** — lightweight local storage of last-seen phrasing IDs. Deferred to v1 alongside profiles, since v0 is deliberately stateless.
- **Beli-style pairwise ranking** — comparison-sort to maintain a favorites list. Pure algorithm, not AI. Later.
- **Goodreads / tracking-app import** — see Flag C. Later, and verify feasibility first.
- **Gamified visual prompts** — pick-by-image/color instead of text questions. Strong idea, real front-end effort. v1/later.
- **Monetization** — parked. Decide *launch vs. portfolio piece* before designing any revenue in.

---

## 7. Flags — resolve these

**Flag A — the core conviction fights how LLMs default to behaving. [most important]** The strongest taste rule is "no over-recommended mainstream books." But an LLM asked for book recs gravitates *toward* popular, frequently-discussed titles by default — exactly the bandwagon this app is trying to avoid. This isn't a reason not to build; it's *the* design problem, and solving it visibly is what makes this portfolio-worthy. Levers: explicit anti-popularity instructions in the prompt, asking for picks across decades/obscurity tiers, possibly grounding against a broad dataset, and using the eval set to *measure* non-obviousness. Name this problem in the case study; don't paper over it.

**Flag B — "rich visuals" vs. "simple interface."** The goal is vibrant, immersive *and* simple, uncluttered. These trade off. Resolution: simple *layout and flow*, rich *moments* (the card reveal, the button pop). Guide the eye with restraint; spend the visual budget on the cards.

**Flag C — Goodreads import may not be feasible. [FACT — verify before promising it]** Goodreads closed its public API to new developers some years back, so "connect to Goodreads" likely isn't a straightforward integration anymore. Verify current state before committing to it. Alternatives: StoryGraph export files, Open Library, or manual add. Another reason import is "later," not v0.

---

## 8. Next steps

1. ~~Confirm v0 scope~~ ✅ done.
2. ~~Draft question architecture + eval set, review, merge~~ ✅ done — see `docs/question-bank.md` and `docs/eval-set.md`.
3. **Stand up the GitHub repo** — starter pack, point Claude Code at it, prove the pipeline with a throwaway task. *(In progress — this is the repo you're building now.)*
4. **Prove the core recommendation loop** — one hardcoded test input → one LLM call using the 4d taste rules → one raw output. No UI yet.
5. **Build the author-fact pool**, with a fact-check pass — deferred until real recommendations exist, so it only covers authors that actually come up (folded in here rather than gated as a separate phase).
6. **Finalize test cases** into final form — expand toward the 20–30 target in `docs/eval-set.md`.

## Still open (not decided, don't need to be yet)

- Exact copy/wording for each phrasing pool beyond what's drafted in `docs/question-bank.md`.
- The specific number/threshold for the "confidence isn't improving" guardrail — revisit once observable in testing.
