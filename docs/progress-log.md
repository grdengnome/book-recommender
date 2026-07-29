# Progress Log

Running session-by-session log of what happened, what was decided, and what's next. Added to each time this project gets picked back up — see the bottom entry for where to start next.

---

## July 4, 2026 — Repo & dev environment setup

**Status:** Planning fully done; repo and dev environment now exist and are verified working.

**What happened:** Created the public repo, pushed the starter pack (`README.md`, `CLAUDE.md`, `.gitignore`, `/docs`), scaffolded the Next.js app via Claude Code inside a GitHub Codespace (TypeScript, Tailwind, App Router, ESLint), installed dependencies (368 packages), verified `npx next build` completes without errors.

**Nothing product-specific built yet** — no recommendation logic, no UI, no API calls. Pure scaffold.

**Next:** Prove the core recommendation loop works at all — the single most important open question in the whole project. Hardcode eval test case #1, call the Anthropic API using the taste rules in `spec.md` Section 4d, log the raw output. No UI yet.

---

## July 5, 2026 — First successful recommendation loop test

**Status:** Core recommendation engine works — biggest milestone so far.

**What happened:** Built `app/api/recommend/route.ts` — takes a taste description, applies the Section 4d taste rules, calls the Anthropic API, returns real recommendations. Fixed a real bug along the way: the code was grabbing a "thinking" response block instead of the actual text block. Ran test case #2 (anti-mainstream profile) — 3 recommendations came back that looked good on a first read. Also reworded eval cases #2 and #9 to remove hidden bias.

**Caveat:** "looked good at a glance" ≠ scored against the rubric. That hasn't happened yet.

**Next:** Score case #2 properly against all 6 rubric dimensions. Then run the other 9 test cases.

---

## July 7, 2026 — First full 10-case eval run

**Status:** All 10 eval cases run against the live engine; results saved, not yet scored.

**What happened:** Found and fixed a real technical bug — `max_tokens` was set to 1500, and the model's internal "thinking" was eating most of that budget, leaving too little room to finish the JSON response. 6 of 10 cases came back truncated on the first pass. Bumped to 4000, reran — all 10 came back clean. Also caught a prompt-level bias problem: the system prompt had personal touchstone books (*Stoner*, *The Uncool*, *Project Hail Mary*) baked in as literal calibration examples, which risked nudging every recommendation toward those specific books. Removed them, and softened an overcorrection where the prompt said "never" recommend bestsellers (the real issue is defaulting to a pick *because* it's safe, not popularity itself). Labeled this **Prompt v2**. All 10 outputs saved to `docs/eval-results.md`.

**Caveat carried forward:** cases 3, 7a, 7b test adaptive-questioning and rejection-path behavior that doesn't exist yet in this single-call version. Their scores are single-turn approximations, not real tests.

**Next:** Actually score all 10 against the rubric — the data exists, the judgment doesn't yet.

---

## July 10, 2026 — Eval scoring: two problems found

**Status:** All 10 Prompt v2 cases scored against the 6-dimension rubric, using external grounding (Goodreads, award records, Wikipedia, general reception) instead of gut-feel.

**What the scoring found:**
1. **Narrow internal pool.** Titles like *So Long, See You Tomorrow*, *Convenience Store Woman*, and *Independent People* kept resurfacing across structurally different inputs — not just similarly-worded ones. Points to the model drawing from a fairly small internal "quiet literary fiction" pool. Prompt wording alone won't fix this.
2. **Awards mistaken for non-obviousness.** Cases 6, 7b, 8, 9 scored weak on non-obviousness specifically because the picks were prize-winners or adaptation-famous (*Disgrace*, *Lincoln in the Bardo*, *The Sympathizer*, *Black Hawk Down*). The model was treating critical/awards fame as a sign of quality rather than another kind of "safe, expected" pick.

Everything else — relevance, traceability, real-and-correct — scored excellent or good across all 10, no hallucinated titles.

**Agreed plan:** Step A — quick award-bias prompt fix, re-run as Prompt v3. Step C1 — separately, research and decide whether v0 actually needs external grounding to fix problem #1. Step C2 — build it, only if C1 says yes.

---

## July 12, 2026 — Section 5 grounding decision resolved

**Status:** The biggest open architecture question in the spec is resolved and documented.

**What happened:** Two separate commits. First, the Prompt v3 award-bias fix (major awards aren't automatic evidence of non-obviousness) plus its full 10-case eval re-run. Second, `docs/spec.md` Section 5 rewritten from an open question into a resolved decision: yes, grounding is needed — backed by the July 10 eval evidence, not a guess. The fix is a **tool-based architecture**: a `search_books` tool (Anthropic tool-use) that merges Open Library's Search API and Subjects API into one real candidate pool, shuffled and stripped of ranking metadata before the model ever sees it, to prevent position bias from recreating the same "safe default" problem in a new form. Built on a general `lib/tools/` pattern designed for future tools, not a one-off.

**Nothing built yet** — this was a decision-and-documentation session only.

**Next:** Build the `search_books` tool. Fully specified in `spec.md` Section 5 — this is implementation, not a new design call.

---

## July 13, 2026 — GitHub identity migration

**Status:** Repo moved to a pseudonymous identity, unrelated to the product work above.

**What happened:** Changed GitHub username from `grimallday` to `grdengnome` to establish a build-in-public identity separate from real name/identity. Enabled email privacy settings. Used `git filter-repo` to rewrite all 11 existing commits, replacing the real email with the GitHub noreply address, and force-pushed the rewritten history. Verified via `git log --format='%ae'` that all commits now show the noreply address. Repo stayed public throughout.

**Next:** Back to the product work — build the `search_books` tool (see July 12 entry).

---

## [Next entry goes here]

**Status:**

**What happened:**

**Next:**