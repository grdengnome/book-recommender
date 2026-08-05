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

---

## August 1, 2026 — `search_books` live in the recommend call; full eval re-run

**Status:** Grounding is no longer standalone-only — `search_books` is wired into the actual `/api/recommend` request path and confirmed working against live traffic. Full 11-case eval set re-run against it; raw output captured, rubric scoring deliberately deferred.

**What happened:** First, fixed the hardcoded personal email flagged in the July 29 entry above — replaced the literal address in `searchBooks.ts`'s `USER_AGENT` string with a repo URL, confirmed the fix against the current line before committing, committed it on its own. Then wired `search_books` into `app/api/recommend/route.ts`: added `tools: toolDefinitions` to the request, and a loop that handles `tool_use` responses by dispatching to `callTool`, appending `tool_result` messages, and re-calling the API. Capped the loop at 3 `search_books` rounds — the 4th call omits `tools` entirely, which structurally forces a final text response rather than relying on an instruction the model could ignore. A failed or malformed tool call is caught and turned into a `tool_result` error rather than crashing the request, so the model can react instead of the request 500ing. `SYSTEM_PROMPT` text itself is unchanged — the tool-reference paragraph added back in the `search_books`-build session already covers what spec 5c asks for.

Smoke-tested live before the full eval run: one taste description came back with real, grounded picks and ~19k input tokens, consistent with a real shuffled candidate pool actually being returned by the tool (not just the tool existing unused).

**Full eval run:** all 11 cases from `docs/eval-set.md` (1 through 10, including 7a/7b) run against the now-live tool-wired endpoint, using the same literal input text as the Prompt v2/v3 runs. All 11 came back `stop_reason: end_turn`, no errors, no truncation. Input token counts ranged 6,140–25,343 per case — again consistent with the tool actually firing on every case, not intermittently. Raw output (every title, author, `why`, and `nonObvious`) saved to `docs/eval-results.md` under a new entry explicitly labeled as **raw output, not yet scored against the rubric**.

**Checked directly against the July 10 "narrow internal pool" finding:** of the three titles named there, "So Long, See You Tomorrow" and "Independent People" don't appear anywhere in this 11-case run (previously in 3 and 2 cases respectively), and "Convenience Store Woman" appears only once, in the same case (7b) it recurred in before (previously in 3 cases). Real reduction, not noise — grounding appears to be doing genuine work against that specific problem.

**New finding, logged separately in `docs/eval-log.md`:** the underlying pattern wasn't eliminated, just relocated. "Satantango" / "Sátántangó" (Krasznahorkai) shows up in both case 3 (vague "just something good" input) and case 8 (granular-place/moral-ambiguity input) — two structurally distinct prompts, in the same run. Same shape of failure as the original finding, different title. Next thing to investigate, not yet acted on.

**Deliberately not done:** full 6-dimension rubric scoring of this run. That takes real per-case reading time and external grounding (same as the July 10 scoring session), and there wasn't room for it tonight — explicitly deferred to next session rather than rushed.

---

## August 2, 2026 — Non-obviousness rule reframed (Prompt v4); narrow-pool finding reframed as a general tendency

**Status:** The award-bias non-obviousness fix is proven via re-scoring. A separate, pre-existing narrow-pool problem is now understood more precisely, but is not fixed — same open status as before, better diagnosed.

**What happened:** Full 6-dimension rubric scoring of the 2026-08-01 tool-wired eval run found that Prompt v3's award-bias rule (rule 3) was only partially working: it correctly stopped the model from citing named literary awards as evidence of non-obviousness, but the same underlying pattern — reaching for a famous/expected pick and describing it as overlooked — resurfaced through gaps the rule's specific wording didn't cover (non-Booker/Pulitzer/Nobel/NBA awards, undisclosed prize status, plain canonical fame) in cases 6, 8, 9, and 10. Separately, case 9's *Say Nothing* pick justified itself with a reception claim ("often gets overshadowed by flashier true-crime picks") that's factually false — it's one of the most decorated narrative nonfiction titles of the last decade.

Rewrote SYSTEM_PROMPT rule 3 in `app/api/recommend/route.ts` (commit a5ff6ab) around a different test: would a well-read reader already expect this pick for this specific request, independent of whether it's decorated. Also tightened the `nonObvious` field instructions to stop the model asserting reception/fame claims it isn't confident are accurate. No other prompt text changed.

Re-ran all 11 `eval-set.md` cases against the new prompt and rescored. **Confirmed fixed:** cases 6, 9, and 10 — the specific offending titles from the prior run (*Disgrace*, *Say Nothing*, *We Have Always Lived in the Castle* / *The Little Stranger*) are all gone, and the replacements hold up under the corrected test itself, not just the old rule's literal wording. Case 8 improved (*Satantango* gone) though one prior title persisted. Case 7b (widen escalation) didn't move — same partial-widen problem as before, likely needs the actual widen mechanic (not yet built, per CLAUDE.md) rather than more prompt tuning.

**Narrow-pool finding, reframed:** While re-scoring, found *The Memory of Love* (Forna) clustering across 4 of 11 cases in the new run — a bigger version of the narrow-pool problem tracked since July (previously: 3 fixed titles recurring 2-3x each; then *Satantango* recurring 2x after grounding). Reran the identical 11 cases a second time against the identical prompt (no changes) specifically to check whether this was a one-off. It wasn't: *The Memory of Love* clustered again (3 of 11 cases, landing in the same two case slots — 6 and 8 — both times), and two more titles neither previously flagged also clustered within that single run (*The Garden of Evening Mists*, *The Informers*). Conclusion: the magnitude of the clustering (4-5 of 11 cases per run) is stable, but the specific titles involved rotate between otherwise-identical calls — this is a general tendency, not a fixed offender list. Full detail in `docs/eval-log.md`.

**Also found, not investigated:** one of the two reruns produced an empty final response for case 5 (valid HTTP 200, `stop_reason: end_turn`, but the model spent nearly its entire output budget on the `thinking` block and returned no text, well under the 4000-token cap). Retried once and got a clean response. Single occurrence — logged in `docs/eval-log.md`, not chased further tonight.

**What's proven vs. not:** The non-obviousness/award-bias fix is proven — re-scored against real cases, holds up under the corrected test, not just the old rule's letter. The narrow-pool problem is documented more precisely than before but not fixed — same open status as before tonight (Section 5 grounding reduced it but didn't eliminate it), now understood as a general tendency rather than something chaseable title-by-title. The case 5 empty-response incident is a new, distinct, unsolved observation — flagged, not diagnosed.

**Next:** Narrow-pool problem needs an architectural look, not another prompt patch — a third rerun with results logged would help confirm whether the clustering rate itself (4-5 of 11 cases per run) is stable, which would strengthen the case for revisiting Section 5's grounding approach rather than treating this as prompt-fixable. Case 5's empty-response incident needs more occurrences before it's worth investigating — watch for recurrence.

**Next:** Score all 11 cases from this run against the 6-dimension rubric in `docs/eval-set.md`. While doing that, keep an eye on whether "Satantango" recurring across cases 3 and 8 is a one-off or a real residual narrow-pool pattern — may need more eval cases or more runs to tell the difference from noise.

---

## August 4, 2026 — Narrow-pool root cause found; free-text search abandoned; recurring date-label bug fixed

**Status:** The narrow-pool clustering problem tracked since July has a confirmed root cause and a clear next direction. A separate, unrelated bug — session dates silently landing one day ahead of local time — was caught, diagnosed, and fixed this session.

**What happened:** Extended `search_books`'s temporary diagnostic logging to capture full pool contents (title + author), not just size, and ran a narrowed 4-case eval (cases 3, 4, 6, 8) to get pool-content evidence fast rather than a full 11-case run. Reconstructed per-source attribution for every logged call (`scratchpad/pool-source-attribution.json`) by re-querying each call's `query` and `subject` separately and matching the results against the logged pool. Confirmed the narrow-pool clustering is a retrieval-breadth problem, not a model-selection bug: cases 3 and 8 both guessed `subject="literary_fiction"` off very different free-text queries, and Open Library's `/subjects/{slug}.json` endpoint returns a static, near-identical listing regardless of the free-text call — it supplied 99–100% of both pools while free-text search contributed ~1%, and the repeated title (*The Memory of Love*) came from the subject endpoint in both cases, not from the model reaching outside its shown pool. Full detail in `docs/eval-log.md`.

That result pointed at free-text search as the weak link, so tested directly whether it's fixable. Tried literal/concrete query rewrites against the queries that returned near-zero hits tonight — no real improvement (9 of 12 rewrites still returned 0 hits). Isolated the actual cause via direct `curl` testing against the live endpoint: Open Library's `/search.json` applies an implicit AND across every word with no relevance fallback, so hit counts collapse almost geometrically as word count rises, regardless of whether the added words are abstract or concrete. **Decisive finding:** even queries that do return real hit counts aren't doing taste-aware matching — `cult novel` (238 hits) surfaced *1984*, *Interview with the Vampire*, and a *Batman* graphic novel in its first 15 results, exactly the kind of mainstream/famous picks this project exists to avoid. Conclusion: free-text search is structurally unfixable for this use case, not a phrasing problem — decided to deprioritize/drop it rather than keep tuning it.

**Also found and fixed:** several of tonight's draft log entries were dated a day ahead of the actual local date (2026-08-05 instead of 2026-08-04). Root cause: the container's system clock runs in plain UTC with no `TZ` set (`/etc/timezone` = `Etc/UTC`), while the actual working timezone is US Eastern (UTC-4) — confirmed by cross-referencing git commit timestamps against previously-correct doc entries. Since these sessions regularly run past UTC midnight (still evening in Eastern time), the harness's injected current-date value rolls over roughly 4 hours before the local calendar day actually does. This had already caused one undetected mislabel in committed history — last session's `docs/eval-log.md` entry was headed 2026-08-04 but should have been 2026-08-03 (commit `656cfa3` landed at 02:03 UTC, i.e. 22:03 Eastern the day before) — corrected the doc text as part of tonight's commit rather than left wrong; the original commit itself wasn't rewritten, since amending git history for a one-day label typo isn't worth the risk. **Flag for future sessions:** don't trust the injected current-date value at face value for anything written in the UTC evening/night window — confirm the local date explicitly when a session's work spans that boundary.

**Next:** Investigate the subject endpoint specifically — whether `/subjects/{slug}.json` supports pagination (an `offset` param, and how deep each subject's catalog goes) and whether having the model request more than one subject tag per call would address the clustering without needing free-text search to carry any relevance burden, since taste inputs often don't map cleanly to a single tag. Temporary diagnostic logging (`lib/tools/searchBooks.ts`) and both eval-run scripts (`scratchpad/run-eval-narrow.mjs`, `scratchpad/attribute-pool-sources.mjs`) remain in place for that follow-up.