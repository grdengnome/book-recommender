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
1. **Narrow internal pool.** *So Long, See You Tomorrow* (Maxwell) recurred across cases 1, 2, and 6; *Convenience Store Woman* (Murata) across cases 3, 5, and 7b; *Independent People* (Laxness) across cases 1 and 6 — structurally different inputs, not just similarly-worded ones. Checked whether this was a test-design artifact (cases worded too similarly) and largely ruled it out: case 6 (hard genre turn-off, morally-complicated-characters framing) shares little surface wording with case 1 (mood/texture framing) or case 2 (explicit anti-mainstream framing), yet converges on the same titles anyway. Points to the model drawing from a fairly small internal "quiet literary fiction" pool. Already tried removing the named calibration examples in Prompt v2 — didn't eliminate it, so prompt wording alone won't fix this.
2. **Awards mistaken for non-obviousness.** Cases 6, 7b, 8, 9 scored weak on non-obviousness specifically because the picks were prize-winners or adaptation-famous: *Disgrace* (Booker Prize, contributed to Coetzee's Nobel), *Lincoln in the Bardo* (Booker Prize, #1 NYT bestseller), *The Sympathizer* (Pulitzer Prize, 2024 HBO adaptation), *Black Hawk Down* (bestseller, major film adaptation). The model was treating critical/awards fame as a sign of quality rather than another kind of "safe, expected" pick. Confirmed this needs a different fix than problem #1: a bigger candidate dataset would still contain Booker and Pulitzer winners, so broader grounding wouldn't resolve this on its own — it's a definition problem in the prompt's instructions, not a breadth problem in the data.

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

## July 29, 2026 — `search_books` tool built

**Status:** The `search_books` tool from spec.md Section 5 exists and its core mechanics are verified against live data. Not yet wired into the live recommendation call.

**What happened:** Built `lib/tools/searchBooks.ts` and `lib/tools/index.ts`, following the `lib/tools/` pattern from spec 5a — `searchBooks.ts` exports the Anthropic tool-definition schema and the implementation function, `index.ts` is a central registry (`toolDefinitions`, `callTool`) so a future second tool only needs a new file. Both Open Library API calls (free-text `/search.json` and controlled-vocabulary `/subjects/{subject}.json`) are called and merged every invocation, not just one or the other. Verified the merge/dedupe by work ID (or title+author) is byte-for-byte clean: one test run came back 101 candidates in, 101 unique keys out. No hard cap on pool size, per spec. Verified the Fisher-Yates shuffle is real, not cosmetic, by diffing the tool's output order against the raw, unshuffled Subjects API order — completely different sequences. Confirmed ranking metadata is stripped before the model ever sees a candidate: only title, author, and up to two subject tags survive. Updated `SYSTEM_PROMPT` in `route.ts` per spec 5c to reference the tool by name and intent only ("you have a search_books tool, use it to ground recommendations...") — no retrieval mechanics re-explained as prompt text.

**Real-world finding, not a code bug:** Open Library's free-text search is stricter than spec 5b assumed. Confirmed directly against the live API: a long, descriptive query returned zero hits, while short queries returned results but could be off-topic (one short query's only `/search.json` hit was a philosophy textbook, not fiction). Adjusted the tool's `query` field description to nudge toward short keyword phrasing rather than full sentences, since that's what the live API actually rewards. Left as a description-level nudge, not app-code query rewriting — query construction stays the model's judgment call, per spec 5a.

**Also caught, but not actually fixed:** a real personal email (`p48414815@gmail.com`) is hardcoded into the `USER_AGENT` string in `searchBooks.ts` (line 7). Searched the repo for other occurrences (none found), but — despite the commit message for `104b0ec` implying it was replaced before committing — it was not: `git log -p` shows no commit ever touched that line after it was introduced, and it's still present verbatim in the code at the tip of `main` as of this entry. This is live in a repo the July 13 entry describes as public. Needs to be swapped for a placeholder/non-identifying contact string as the first thing next session, before any other work.

**Deliberately not done:** `route.ts`'s actual API call still doesn't pass `tools` or handle a `tool_use` round-trip — the tool exists and was verified standalone, but isn't wired into the live recommendation flow yet.

**Next:** Wire `search_books` into `route.ts` — add `tools` to the API call, handle the `tool_use`/`tool_result` loop, let the model call it (possibly more than once) before returning final recommendations. Then re-run the eval set with real grounding active.