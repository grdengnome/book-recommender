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

---

## August 5, 2026 — Google Books ruled out; Hardcover's tag-based search shows a different pattern

**Status:** Continuing the narrow-pool investigation from August 4. Google Books was tested as an alternative free-text source and ruled out — same structural defect as Open Library. Hardcover was tested as a fundamentally different retrieval mechanism (tag/community metadata rather than free-text) and shows a meaningfully different pattern on a single small test, but nothing proven at eval scale yet.

**Context:** The August 4 session found Open Library's `/search.json` structurally unfixable for taste-aware retrieval — implicit AND-matching collapses hit counts on multi-concept queries, and even queries with healthy hit counts (e.g. "cult novel," 238 hits) aren't taste-aware, surfacing mainstream/famous titles instead. Section 5's grounding architecture (`search_books`, wired live since August 1) was built assuming free-text search was a viable retrieval leg alongside the subject endpoint. Tonight tested whether that leg could be salvaged — first by swapping providers (Google Books), then by testing a source with a different retrieval mechanism entirely (Hardcover's tag/community metadata).

**Google Books investigation:** Three queries run against Google Books' `/volumes` endpoint.

1. `literary fiction granular sense of place moral ambiguity` (the same dense/abstract phrasing style that broke Open Library) — `totalItems: 4`. None were a plausible taste-match: a self-published "psychological fiction" title, two early-1900s novels ("Lying Prophets," "Red Harvest"), and an unrelated contemporary novel ("The Reluctant Human"). Sparse-result behavior similar in shape to Open Library's AND-matching collapse.
2. `cult novel` — 20 of 20 requested results returned. Genuine cult-fiction titles at the top ("Cult," "Classic Cult Fiction," "Cult Fiction," "The Cthulhu Cult") diluted by unrelated keyword matches and trailing off into book-industry trade periodicals by the end of the page ("The Book News Monthly," "Bookseller & Stationer and Office Equipment Journal"). Failure mode: literal keyword matching on "cult" and "novel" independently, not a concept of the genre.
3. `obscure literary fiction underrated` — `totalItems: 300` after a transient 503 on the first attempt. Of the 20 returned, none were actual obscure literary novels — almost entirely encyclopedias, literary-criticism reference works, and periodicals ("Literary Digest," "Academy and Literature," "Saturday Review of Politics, Literature, Science and Art," "Chambers's encyclopædia"). "Literary" is matching against reference-work titles/subjects, not fiction.

Ran the identical `cult novel` query against Open Library side by side for direct comparison: *Nineteen Eighty-Four*, *Interview With the Vampire*, and a *Batman* title all reappeared — the same three examples named in the August 4 entry, confirming that finding was repeatable, not a one-off.

**Conclusion (Google Books):** Ruled out as a fix. Same underlying defect as Open Library — literal keyword/title matching, no taste-awareness — just a different noise texture (Google Books skews toward non-fiction reference material; Open Library skews toward mainstream fiction). Switching free-text providers doesn't address the actual gap.

**Hardcover API investigation:** Tested as a different kind of source, not another free-text engine — Hardcover exposes user-assigned tags and genres per book (e.g. "Character driven," "Unloveable Characters"), which raised the question of whether querying *by* taste-adjacent tags, rather than by free-text description, could avoid the same failure mode.

*Coverage check:* Queried Hardcover for the 5 titles this project's narrow-pool problem has repeatedly clustered on (*The Memory of Love*, *So Long, See You Tomorrow*, *Independent People*, *Convenience Store Woman*, *Piranesi*). All 5 found, via the `search` GraphQL query (the `books` table blocks `_ilike`/pattern filtering server-side). 4 of 5 had populated tags, all 5 had genres — texture-level metadata like "Character driven" and "Unloveable Characters" that neither Open Library nor Google Books expose at all.

*Search-behavior check:* The actual question — does querying by tag surface obscure, well-matched books, or default to mainstream titles like both free-text engines did tonight — was tested next. Checked whether a "moral ambiguity"-adjacent tag exists before falling back to a proxy: pulled the top 500 tags by usage count (of 40,118 total) and searched for moral/ambiguity/complicit/antihero/gray-area terms — none matched (not an exhaustive check of all 40,118, only the popular end). Ran the test instead on two tags actually seen in the coverage check — `"Character driven"` AND `"Unloveable Characters"`, exact-match via the `taggings` relation, no ordering applied, limit 20.

**Result:** `users_count` across the 20 returned books ranged from 1 (*Los locos mueren de viejos*) to 2011 (*Prince Caspian*), with well-known authors (Twain, C.S. Lewis, Graham Greene) sitting alongside single-reader titles in the same unordered pull — no clustering around famous titles. That's a meaningfully different pattern from both free-text engines tested tonight, though tag-match *quality* (vs. just popularity spread — Twain's *Eve's Diary* under "Unloveable Characters" looks like a stretch) wasn't evaluated.

**Known constraints on Hardcover, not glossed over:**
- Beta API, and tokens reset without notice, per Hardcover's own documentation.
- Tag filtering is exact-match only — `_ilike`/pattern matching is blocked server-side on this API key (confirmed directly: identical "not permitted on this server" error on both `books.title` and `tags.tag`).
- No dedicated mood/theme query beyond the `tags` field itself (confirmed via schema introspection of root query fields).
- 40,118 total tags, no substring search available — finding the right tag for a given taste input isn't something that can be done ad hoc per-request.

**Conclusion:** Open Library remains the volume/breadth layer — nothing tonight replaces it. Hardcover is a candidate *second signal* to layer on top (tag-based filtering or re-ranking, or a supplemental pool), not a replacement. This is unproven at scale: tonight's test was two hand-picked tags against a 20-book pull, not a run against real eval cases.

**Next:**
1. Decide the integration architecture — does Hardcover supplement the candidate pool, or act as a filter/re-ranker on Open Library's results?
2. Build a taste-vocabulary-to-Hardcover-tag mapping — exact-match-only search against 40,118 tags isn't usable ad hoc per request.
3. Re-run the specific eval cases that previously produced repeated titles (*Satantango*, *The Memory of Love*) through a combined pool and check directly whether the repeats resolve.
4. Confirm the existing shuffle/metadata-stripping bias mitigations get applied to the combined pool, not just Open Library's slice.

---

## August 6, 2026 — Hardcover free-text search ruled out; Tag category split into three data types via forced-choice-widget detection

**Status:** Continuing directly from the August 5 session's Hardcover investigation, which had confirmed tag-filtering showed a genuinely different obscurity pattern (no clustering around famous titles) and ruled out Google Books' free-text search. Tonight's goal was to design the actual Open Library + Hardcover merge architecture — but before that could happen, two open questions from the 5th needed closing: whether Hardcover's own free-text search (as opposed to tag-filtering) was any better than Open Library's, and whether the tag vocabulary itself was reliable enough to build a taste mapping on. Both turned out to need resolving before any merge design work could start, so that became tonight's actual scope.

**Hardcover free-text `search` endpoint test:** Ran the same three benchmark queries used against Open Library and Google Books two sessions ago, this time against Hardcover's own `search` GraphQL query (Typesense-backed, `query_type: "Book"`, `per_page: 20` — distinct from the `taggings`-based tag-filtering mechanism validated on the 5th). Script: `scratchpad/hardcover-search-test.mjs`; raw output: `scratchpad/hardcover-search-raw-output.txt`.

1. `"literary fiction granular sense of place moral ambiguity"` — `found: 75`. Top hits were nonfiction/criticism whose titles happen to contain "literary"/"fiction" (e.g. "The Substance of Fiction: Literary Objects in China," "Stranger Than Fiction: The Art of Literary Journalism"). `text_match_info` showed `num_tokens_dropped: 5, tokens_matched: 3` on nearly every hit — Typesense partial-matched on 3 of ~8 tokens, degrading to a keyword match on "literary"/"fiction" alone.
2. `"cult novel"` — `found: 7` (vs. Open Library's 238). A much smaller, curated-feeling index rather than a broad LIKE-style scan. Top hit ("The Cthulhu Cult") is a genuine but obscure match; Fahrenheit 451 (10,895 users) also appears as a literal-keyword false-positive on "cult."
3. `"obscure literary fiction underrated"` — `found: 138`. Dominated by titles containing the literal word "Obscure" (*Jude the Obscure*, *Thomas the Obscure*, several unrelated genre novels titled "Obscure X") — literal title-word matching, not concept matching.

**Conclusion:** Same underlying defect as Open Library and Google Books — literal keyword/title matching, not taste-awareness. The difference is in degradation behavior, not match quality: no 0-hit collapse on dense multi-concept queries (Typesense drops tokens and partial-matches instead, visible in `num_tokens_dropped`/`tokens_matched`), and relevance scoring is inspectable (`best_field_weight`, `typo_prefix_score`) where Open Library's endpoint gives no such visibility. But the graceful degradation still produces noise — matching on leftover literal tokens rather than failing closed. Tags/genres/moods were frequently empty even on this endpoint, and populated metadata correlated with `users_count` (popularity), not obscurity. **Hardcover's free-text search is ruled out on the same grounds as the other two sources.** Tag-filtering remains the only validated Hardcover mechanism — and confirms the August 5 finding was specific to that mechanism, not something free text could also deliver.

**Tag credibility investigation — the core work of tonight:** With free text ruled out everywhere, tag-filtering was the only path left, which raised the question the 5th had flagged but not answered: how much of the 40,171-tag vocabulary is actually trustworthy?

- Corrected a misstatement from the August 5 entry: the field is `count`, not "usage count" — confirmed via introspection on the `tags` GraphQL type. Pulled threshold data via paginated queries (the API silently caps any single response at 100 rows regardless of the requested `limit`, requiring `offset`-based pagination to get accurate totals): **1,290 tags above `count > 50`, 780 above `count > 100`, out of 40,171 total tags.** Raw data: `scratchpad/hardcover-tags-gt50.json`, `hardcover-tags-gt100.json`.
- The top of the `Tag` category by count turned out to be dominated by a 9-tag cluster: Loveable Characters, Unloveable Characters, Strong Character Development, Weak Character Development, Diverse Characters, Not Diverse Characters, Character driven, Plot driven, A mix driven.
- Tested this cluster by pulling a random 30-book sample (of 41,652 books carrying ≥1 cluster tag) and decomposing taggings **per user**, not just at the book level. Book-level aggregation alone would have wrongly cleared this cluster as organic — popular books accumulate contributions from dozens of disagreeing taggers, so the aggregate shows apparent co-occurrence between opposite tags (e.g. David Copperfield showing both "Loveable" and "Unloveable" characters). Per-user decomposition on six multi-tagger books (David Copperfield, The Nickel Boys, Stars and Smoke, Fortune Academy, Cursed Prince, When the Tides Held the Moon) showed every individual user picks at most one tag from each of four mutually exclusive groups — valence (Loveable/Unloveable), development (Strong/Weak), diversity (Diverse/Not Diverse), and drive (Character/Plot/A mix, three-way) — confirming a fixed 4-axis forced-choice review widget, not organic tagging. Sample data: `scratchpad/hardcover-cluster-sample.json`.
- Extended the same co-occurrence method to the broader top-100 non-cluster `Tag`-category entries (`scratchpad/hardcover-top-tag-category-noncluster.json`) and found a second, even more rigid cluster: **`fast-paced` / `medium-paced` / `slow-paced`**, with **literal zero co-occurrence** across an 801-book pool against expected overlaps of 2.8–5.9 under independence — a starker signal than the character-development cluster's book-level pattern, suggesting a single canonical/algorithmic pace value per book rather than even a disagreeing crowd vote. Also found `N/A driven` (count 1,023) belongs to the original character-development cluster as a 4th "drive" option, missed in the initial 9-tag identification — per-user data confirmed it's applied almost always solo, with one exception (a single user applying both "A mix driven" and "Character driven" to the same book, out of ~200+ per-user picks inspected).
- Confirmed as organic and safe to use: genre tags, mood tags, and romance-trope tags (`enemies to lovers`, `forced proximity`, `friends to lovers`, `slow burn`) — normal-to-high multi-select co-occurrence (ratios 1.9–6.9 against independence), consistent with real books legitimately carrying multiple compatible tags at once. Raw co-occurrence data: `scratchpad/hardcover-cooc-book-samples.json`, `hardcover-cooc-books-tagdata.json`.
- Surfaced a separate, unrelated data-quality issue while scanning the top-100 list: a meaningful share of high-count `Tag`-category entries are personal shelf-management artifacts, not taste/content tags at all — `Calibre Import` (3,164), `#digitally-own` (1,991), `Audible` (540), `audiobook` (570), `humblebundle` (385), `VPL` (348), `libby` (321), `from-audible` (311), `Kindle` (237), `ebook` (227), `obsidian-import` (219), `to-read` (219), `#ALL#` (192). A naive "top N tags by count" approach would have pulled these in alongside genuine taste signal.
- Also noted a recurring case/quote-variant duplicate issue across categories: `"Loveable Characters"` (with literal quote marks, count 52) as a separate tag from `Loveable Characters`; `Tense` (Tag category, count 610) as a separate tag from `tense` (Mood category, count 45,155). This is a general dedup problem, not a one-off fix.
- **Methodological note for future sessions:** book-level co-occurrence alone is an unreliable test for forced-choice widgets when many independent users tag the same book — it can show *positive* correlation for a genuinely exclusive-per-user axis, because disagreeing users' choices aggregate into apparent overlap. Always decompose per-user before concluding a tag cluster is organic; the pace_trio cluster only read as more exclusive than the confirmed character-development cluster because it happens to have fewer independent taggers per book, not because the underlying mechanism is more rigid.

**Conclusion:** Hardcover's Tag category contains three distinct data types requiring different handling: organic taste tags (genres, moods, romance-style tropes — safe to use as-is), disguised forced-choice rating widgets (the character-development cluster + `N/A driven`, and `pace_trio` — exclude from the taste-vocabulary mapping; could be revisited later as a separate structured feature, not a free-text-style tag), and shelf-management noise (exclude via keyword filtering). Free-text search is ruled out entirely across all three sources tested (Open Library, Google Books, Hardcover). Tag-filtering on a cleaned vocabulary remains the validated path forward for Hardcover's role in the merge.

**Next:**
1. Build the concrete exclusion list: the confirmed rating-widget tags (character-development cluster + `pace_trio`, ~13 tags total) plus a keyword-based filter for shelf-management noise.
2. Build a light case/quote-insensitive dedup pass for the tag vocabulary.
3. Build the taste-vocabulary-to-Hardcover-tag mapping using only the cleaned vocabulary (genres, moods, romance-style tropes), connecting it to the question architecture's facets (anchor/why/appetite).
4. Then move to the actual merge/integration logic with Open Library — parallel API calls, decide supplement-vs-filter architecture. This was deferred from tonight since it depends on having a working, clean tag vocabulary first.

---

## August 9, 2026 — Full Tag-category scan closed out; exclusion list confirmed exhaustive; exclusion module built

**Conclusion:** Extended the August 6 forced-choice scan to the full remaining Tag-category vocabulary (177 tags, all non-cluster tags at count>100). No new clusters found — the ~13-tag exclusion list from August 6 is confirmed exhaustive at this threshold. Built `lib/hardcover/tagExclusions.ts` to encode it. Also fixed a scratchpad-persistence gap from last session.

**Cluster scan:** Tested 5 additional same-axis candidate pairs (Male MC/Female MC, POV person, POV count, MF/m-m, author gender). Male MC/Female MC ruled out as organic — per-user data showed real multi-select on the same book. The two POV pairs are inconclusive: zero co-occurrence, but also zero overlapping cases to run per-user decomposition on, so they're flagged unproven rather than confirmed either way. MF/m-m and author gender turned out to fall inside the already-scanned top-100 tier, not new territory.

**Exclusion module:** `lib/hardcover/tagExclusions.ts` exports `RATING_WIDGET_TAGS` (the 13 confirmed tags, exact-match) and `SHELF_NOISE_PATTERNS` (pattern-based — named platforms plus structural patterns for likely variants), combined via `isExcludedTag()`. Verified against the full 190-tag list: 32 excluded, 158 kept, zero false positives on manual review. Testing surfaced one additional noise family the original pattern set missed — `Shelf: NN <name>` personal custom-shelf labels (plus a malformed bracketed duplicate of one) — added as `/^\[?"?shelf:/i`.

**Process fix:** August 6's scratchpad files (data + scripts) didn't survive between sessions — gitignored/untracked, lost on environment reset. Force-added this session's key evidence files (tag list, analysis output, deep-pull data) to prevent recurrence.

**Next:** Build the taste-vocabulary-to-Hardcover-tag mapping using the 158 cleaned tags, connecting it to the question architecture's facets (anchor/why/appetite). Unlike the last two sessions, this is a design/judgment task, not a data-verification task.

---

## August 13, 2026 — Facet-to-tag mapping drafted; real gaps confirmed; reviews explored as a partial fix; reframed toward overdue eval test

**Correction:** Last entry's "158 cleaned tags" was stale — logged before the `Shelf: NN` pattern was added in that same session. Re-running `isExcludedTag` against the current module gives **153 kept, 37 excluded**, of 190 total. 153 is the real number going forward.

**Conclusion:** Drafted a facet-to-tag mapping (anchor / why→writing,world,characters,ideas,feeling / appetite / mood / commitment / turn-off) against the 153 cleaned tags. Good coverage on ideas, feeling, and mood; partial on world/genre. Five real gaps, confirmed by manually eyeballing the full raw tag list (not just the categorized summary) at the user's request:

- **Writing/voice** — no prose-style or craft vocabulary exists in the tag set at all.
- **Characters** — the tags that would directly answer this (`Loveable/Unloveable Characters`, `Strong/Weak Character Development`, etc.) are exactly the ones excluded as forced-choice rating-widget artifacts on Aug 6/9. Two independently-correct decisions in real tension.
- **Appetite** — needs tag rarity/co-occurrence frequency, not facet-to-tag lookup — a different mechanism entirely.
- **Commitment** — the direct tags (`fast/medium/slow-paced`) are excluded rating-widget noise; page-count metadata is likely the better source.
- **Turn-off** — current candidates are romance-spice-specific, not general content warnings. Hardcover's actual `Content Warning` tag category is unpulled and is likely the right source.

**Reviews investigated as a fix for the writing/voice gap.** Reviews live on `user_books` (`review`, `review_markdown`, `review_length`, etc.), not a standalone `Review` type — confirmed via introspection. Pulled samples for 8 literary-prose titles (Lolita, Blood Meridian, Beloved, Mrs Dalloway, The Sound and the Fury, Gilead, Stoner, Housekeeping). Real craft language shows up — "stream of consciousness," "form is content," "fragmented and circular by design" — vocabulary the tags never surfaced. Not building on this now: sparse relative to plot-summary/rating text, multilingual noise in the longest reviews, requires an LLM extraction step per book rather than a lookup (different mechanism than tag-matching), and likely thin on exactly the obscure titles this project cares about most — same popularity-correlation pattern found with tags on Aug 5. Documenting as a deliberate v1 candidate. Also hit the same edition-fragmentation problem tag/co-occurrence data had: "Blood Meridian" splits across 4+ `book_id`s with wildly different review counts per edition (0 vs. 117) depending on exact title string.

**Reframe:** No eval-case testing has happened since Aug 5 — every session since Aug 6 has been coverage/data-quality analysis on Hardcover, not a test of whether a combined Open Library + Hardcover pool actually resolves the original problem (the Satantango/*Memory of Love* repeats). That test is step 3 from the Aug 5 plan and is still undone. It's the real priority, ahead of further vocabulary auditing.

**Next:**
1. Build a rough Open Library + Hardcover merge and run it directly against the eval cases that previously produced repeated titles (*Satantango*, *The Memory of Love*) — the real test of whether the architecture works, gaps included.
2. Resolve the four flagged gaps (writing/voice, appetite, commitment, turn-off) with the user before building the mapping into code — none should be resolved unilaterally.
3. If turn-off needs it, pull and vet Hardcover's `Content Warning` tag category (unpulled so far).

---

## August 15, 2026 — Full Hardcover schema introspection closes remaining unknowns; Open Library + Hardcover merge architecture scoped and empirically validated

**Conclusion:** Schema introspection ruled out the two things a recommender would most want from Hardcover (similarity/recommendation data, award/prize data) as absent entirely, and confirmed page count as a real, well-populated data source. Separately, scoped the three open architecture decisions for the Open Library + Hardcover merge — all tracing back to the Aug 4 root cause (structurally different taste inputs collapsing onto the same Open Library subject bucket) — and validated the riskiest one (does Hardcover actually add diversity, or just re-surface the same books) empirically rather than by reasoning alone.

**Schema introspection** (`Book`/`Series`/`Edition`/`Author`/`List` + close relations, full field menu, not a targeted test): confirmed absent at the schema level — no similarity/recommendation field anywhere (only `user_books.recommended_by/for`, free-text personal notes, not an algorithm), no award/prize type or field anywhere. New useful finds: `pages` is well-populated on both `books` and `editions` (100%/88% in sample) — a real data source for the commitment facet, resolving part of the Aug 13 gap. `book_characters` exists as a structured relationship separate from the excluded rating-widget tags, but unverified — the unfiltered sample skewed toward real people in memoirs, fiction-character coverage unconfirmed. User-curated lists (`lists`/`list_books`) exist and are structurally solid, but `list_books.reason` — the field that would carry curator voice — was 0/30 populated in sample; not usable as-is. Scripts: `scratchpad/hardcover-schema-scan.mjs`, `hardcover-schema-report.mjs`, `hardcover-coverage-check.mjs`; raw schema in `hardcover-full-schema.json`.

**Merge architecture — three decisions:**
1. **Dedup:** exact match on `normalize(title) + normalize(author_lastname)`, not fuzzy — avoids false-positive merges of genuinely different books with similar titles. Omnibus/compilation entries (e.g. "Novels (Emma / Mansfield Park / …)") are a separate filtering concern, not folded into dedup, since they don't collide on this key. Cross-source duplicates get merged (Open Library baseline + Hardcover tags attached), not discarded down to one source's record.
2. **Retrieval breadth — multi-subject (primary) + pagination (secondary), both:** confirmed via direct testing that pagination increases volume within a bucket but doesn't touch the root cause (offset 0/20/40 on `literary_fiction` returned zero overlapping titles, cleanly proving the param works, but every page is still "generic literary fiction"); multi-subject changes *which* bucket feeds the pool and meaningfully diversifies it (`literary_fiction` vs. `historical_fiction`: 1/20 overlap, +95% pool growth from merging). Multi-subject addresses the diagnosed cause; pagination is a cheap, already-proven volume assist layered on top, not a substitute.
3. **Supplement, not filter/re-rank:** filter/re-rank either inherits the Aug 4 root cause (bounded by whatever Open Library already retrieved — can't rerank into diversity that was never fetched) or conflicts outright with the already-resolved spec §5b rule to strip ranking metadata and shuffle before the model sees the pool. Hardcover's `users_count` is scoped narrowly to merge-time tiebreaking only (which source's fields become canonical on a confirmed duplicate) — deliberately not a pool-wide popularity-deprioritization signal, to avoid re-importing the same naive-proxy mistake already ruled out with awards.

**Supplement decision validated empirically**, not just reasoned through (`scratchpad/hardcover-ol-overlap-test.mjs`, real API calls against two real eval-case taste inputs — case 3 vague, case 8 texture-match): Hardcover's tag-matched pool genuinely diverges from Open Library's rather than re-surfacing it — 4/29 shared on the vague-input test, 2/58 on the texture-match test, +26 to +28 real new candidates each time. Two findings surfaced by running the test that weren't anticipated going in: Hardcover has zero tags at count>50 for "atmospheric," "moral ambiguity," "sense of place," or "quiet" (`scratchpad/hardcover-tag-discovery.mjs`) — some taste inputs will only ever get an approximated Hardcover mapping, not a direct one. And sorting the Hardcover query by `users_count desc` reproduced the same popularity-convergence problem the OL side has been fighting since July — two different tag sets still shared 6 identical mega-popular titles (*1984*, *The Hobbit*, *The Great Gatsby*, etc.), because heavily-tagged books surface under almost any broad tag pull regardless of theme. Flagged as a concrete build constraint for the real merge, not a wait-and-see item.

**Next:**
1. Build the merge (dedup + multi-subject + pagination + supplement, per the decisions above) and run it against the eval cases that previously produced repeated titles (*Satantango*, *The Memory of Love*) — the real test of whether the architecture works.
2. Decide the Hardcover query ordering/sampling strategy before wiring it in — `users_count desc` is now a known-bad default, not an open question.
3. Resolve the four flagged gaps (writing/voice, appetite, commitment, turn-off) with the user before building the taste-facet mapping into code — commitment is now partly addressed by confirmed `pages` coverage, the other three remain open.
4. If turn-off needs it, pull and vet Hardcover's `Content Warning` tag category (unpulled so far).

---

## August 16, 2026 — Hardcover ordering decision built and verified; OL+HC merge built but paused — discovered the Aug 15 multi-subject/pagination fix was never built

**Conclusion:** Turned tonight's earlier Hardcover ordering decision (tag-match relevance + shuffle, not `users_count desc`) into working code, then built the Open Library + Hardcover merge — but paused before running it for real, because building the merge surfaced that the Aug 15 architecture decision's primary fix for the repeated-titles problem (multi-subject + offset pagination on Open Library) was decided but never actually implemented. Session ended blocked on an unrelated network issue before that gap could be investigated.

**Hardcover pool prep, done and verified:** `lib/hardcover/preparePool.ts` (`prepareHardcoverPool(tagIds)`) retrieves via `taggable_counts`, ranks by tag-match relevance, truncates to `WORKING_POOL_SIZE=15`, shuffles, normalizes to `BookCandidate`-compatible shape, strips ranking metadata except `usersCount` (merge-tiebreak only). Verified clean against both eval inputs (0 dropped-for-no-author rows, pool size matches 15 exactly). A ranks-16-30 diagnostic confirmed the truncation depth is sound: no junk through rank 30, but relevance decays gently rather than cliffing — ranks 16-30 carry the same mainstream lean as the top 15, so raising `WORKING_POOL_SIZE` wouldn't improve anything.

**New open finding, distinct from the `users_count` bug already fixed:** tag-match relevance still correlates with mainstream-ness on broad mood tags (`dark`/`tense`/`mysterious`) — broad tags simply accumulate more raw applications on widely-read books, so relevance-ranking decouples from platform-wide popularity without fully escaping it. Not investigating further now — revisit once real merged/eval output shows whether this actually surfaces as a problem downstream, not before.

**Merge built, not yet run:** `lib/merge/mergeCandidatePools.ts` dedups on normalized title + author-lastname (exact match, per the Aug 15 decision), merges metadata across sources on a match rather than discarding either record, and produces per-call source-tracking stats (raw pool size per source, duplicates removed, merged total, per-source %). Reviewed at checkpoint. Blocked from running against real data by the finding below.

**Discovered mid-build:** `searchBooks.ts` still only does single free-text + single-subject Open Library retrieval — the Aug 15 decision to add multi-subject queries + offset pagination (the *primary* fix for the narrow-pool/repeated-titles problem) was decided but never built. Paused the merge rather than run it against a known-insufficient OL pool. Following the same investigate-then-build pattern as tonight's Hardcover ordering work: test pagination and multi-subject in isolation, keep it simple, stop at one lever if it proves sufficient.

**Investigation started, blocked:** wrote `scratchpad/openlibrary-pagination-vs-multisubject-test.mjs`, targeting the real documented convergence pair — case-3 and case-8, both independently landing on `subject=literary_fiction` per the 2026-08-04 eval-log entry (the pairing that produced the shared *The Memory of Love* result). Never ran: `openlibrary.org` was unreachable for the rest of the session — TCP connect to port 443 timed out consistently, while DNS resolved fine and other hosts (`api.hardcover.app`, etc.) connected normally from the same environment. Checked independently via browser too; no public outage confirmed via third-party status checkers. Likely transient, not a Codespace-side network problem, but unconfirmed.

**Next:**
1. Retry `openlibrary.org` reachability.
2. If reachable: run the pagination-vs-multi-subject isolation test (script already written; steps 1/3/4 not yet run).
3. Decide which lever(s) to build into `searchBooks.ts` from the results — keep it simple, don't combine both unless the isolated tests actually show it's needed.
4. Verify the upgrade with a diagnostic, same pattern as tonight's Hardcover ranks-16-30 check.
5. Only then run `mergeCandidatePools.ts` for real against the eval cases, including the ones that previously produced repeated titles (*Satantango*, *The Memory of Love*).
6. Open, untested hypothesis to check once the merge runs: roughly 75-80% of the merged pool from Open Library, ~20-25% from Hardcover. Source-tracking stats are already built to measure this directly.
7. Carry forward from Aug 15: resolve the four flagged taste-facet gaps (writing/voice, appetite, commitment, turn-off) with the user before building the mapping into code.
8. Carry forward from Aug 13: pull and vet Hardcover's `Content Warning` tag category if needed for turn-off.

---

## August 19, 2026 — Pagination-vs-multi-subject test resolved; Hardcover locked in as fixed pre-fetch

**Conclusion:** Ran the pagination-vs-multi-subject isolation test blocked since Aug 16. Pagination works within a subject but doesn't touch cross-case convergence; multi-subject fan-out grows pool size but doesn't fix overlap either. Decided to build multi-subject fan-out anyway, for pool richness rather than as an overlap fix — cross-case OL overlap on structurally different inputs is expected when genuinely relevant, per eval rubric dimension 6. Separately, resolved a real architecture fork: Hardcover will be a fixed pre-fetch, not a model-invoked tool.

**Pagination vs. multi-subject test:** pagination works cleanly within a subject but doesn't fix cross-case convergence, since case-3 and case-8 already share a subject. Multi-subject fan-out grows each case's pool (+96%) but didn't fix cross-case overlap either — 56.6% overlap even after expansion. Flag: `translated_literature` subject returns 0 works at any offset — likely dead/misnamed on Open Library's side.

**Built:** final full-pool shuffle in `lib/merge/mergeCandidatePools.ts` (after dedup/combine) — fixes source-clustering (OL candidates were always listed before Hardcover-only ones). Multi-subject fan-out itself is still not built into `searchBooks.ts` — needed before further merge testing.

**Architecture decision:** Hardcover stays a fixed pre-fetch, not a model-invoked tool. `route.ts` will derive tags upfront, fetch Hardcover deterministically, call `mergeCandidatePools` once both pools exist. Intentionally asymmetric with Open Library's adaptive/model-invoked search.

**New gap:** no function exists yet to convert a taste description into Hardcover tag IDs. Needed regardless of the above, and needs to work in one shot since there's no adaptive correction under a fixed pre-fetch.

**Discussed, not tested:** widening Hardcover's tag list (currently ~2-3 tags) to increase retrieval reach — distinct from `WORKING_POOL_SIZE` (already tested, stays at 15). Widening tags doesn't increase Hardcover's share of the merged pool on its own; test in isolation next session, not bundled with a pool-size change.

**Next:**
1. Build multi-subject fan-out into `searchBooks.ts`.
2. Build the taste-to-Hardcover-tag mapping function.
3. Wire Hardcover into `route.ts` as fixed pre-fetch; call the merge there.
4. Test widening Hardcover's tag list in isolation.
5. Run the real merge for case-3/case-8; check the merged pool and source-tracking stats.
6. Carry forward from Aug 15: resolve the four flagged taste-facet gaps with the user before building the mapping into code.
7. Carry forward from Aug 13: pull and vet Hardcover's `Content Warning` tag category if needed for turn-off.