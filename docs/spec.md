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

## 5. Data & sources — the research bucket

**The open question:** where should recommendations come from, and how do we get breadth without repetition? Candidate sources named in early planning: Goodreads, libraries, NYT bestseller list, YouTube, TikTok, Reddit.

Sub-questions still to resolve:
- Which book-metadata sources are actually accessible to a solo dev (Open Library, Google Books) and on what terms? **[FACT]**
- Does v0 need retrieval/grounding against a dataset, or can a well-prompted model carry it? **[FACT/SYNTH]** — this is the biggest remaining architecture call, tied directly to Section 4b.
- How do we operationalize "avoid stagnant/repetitive recs"? Partly prompt design, partly grounding — see Flag A.

Cover images are resolved (Section 4c) — this open question is now scoped to recommendation-engine grounding only.

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
