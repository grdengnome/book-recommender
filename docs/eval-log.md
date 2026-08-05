# Eval Log

Running log of quality findings, known limitations, and decisions made while evaluating recommendation output against docs/eval-set.md's rubric. Newest entries at the top.

---

## 2026-08-04 — Narrow-pool clustering traced to subject-endpoint determinism; free-text search investigated and abandoned

Followed up on the 2026-08-03 entry's flagged next step: extended `search_books`'s temporary diagnostic logging (`lib/tools/searchBooks.ts`) to record each call's full pool contents (title + author per candidate), not just `poolSize`. Ran a narrowed eval — cases 3, 4, 6, and 8 only, the ones that had shown clustering or near-clustering in the prior two runs — via a new `scratchpad/run-eval-narrow.mjs` driver, to get pool-content evidence fast without a full 11-case run.

That run didn't reproduce a repeated final recommendation across the four cases, but *The Memory of Love* (Forna) — the title that clustered in cases 6/8 on 2026-08-02 — showed up again, this time appearing in both case-3's and case-8's raw candidate pools (though only recommended in case-3). That gave a concrete instance to resolve the 2026-08-03 entry's open question: genuine retrieval overlap vs. the model selecting outside the pool it was shown. Traced it definitively to the former. Both calls independently guessed `subject="literary_fiction"` despite very different free-text queries ("literary fiction acclaimed" vs. "atmospheric setting morally complex characters"), and `fetchSubjectResults` hits Open Library's `/subjects/{slug}.json` endpoint, which returns a static, deterministically-ordered listing that's largely insensitive to anything in the free-text call. Reconstructed per-source attribution for all 13 calls in the run by re-querying each logged `query`/`subject` pair separately and matching against the logged pool (`scratchpad/pool-source-attribution.json`): in both the case-3 and case-8 calls that shared `literary_fiction`, the subject endpoint contributed 99–100% of the pool while the free-text search contributed ~1%, and *The Memory of Love* itself came from the subject endpoint in both, not the free-text search, in either. **Root cause is retrieval-breadth (the subject guess converging on a shared static listing), not model-selection** — the 2026-08-03 entry's two candidate explanations are now resolved in favor of (a).

That pointed at the free-text side as underpowered rather than as a lead worth chasing on its own, so investigated directly whether `/search.json` could be fixed instead of just weighted down further. Tested abstract-mood queries from tonight's near-zero-result calls ("quietly devastating literary novel," "underrated novel voice unusual structure," etc.) against literal/concrete rewrites (specific plot elements, comparable author names, setting descriptors) via direct `curl` against the live endpoint. No meaningful difference — 9 of 12 concrete rewrites still returned 0 hits. Isolated the actual mechanism instead: `/search.json` applies an implicit AND across every space-separated term with no relevance-style OR fallback (confirmed directly: `devastating literary novel` → 0 hits, `devastating OR literary OR novel` → 414,913 hits with identical terms). Hit counts collapse almost geometrically as word count increases — `cult novel` → 238, `cult classic novel` → 12, `cult classic strange novel` → 1 — independent of whether the added words are abstract or concrete. The tool's own query-field instruction ("2-5 keywords") sits inside the range where this collapse is already underway.

Even queries that do return meaningful hit counts don't provide taste-aware relevance: pulled the first 15 results for two non-zero broad queries. `literary novel` (5,397 hits) returned a roughly even mix of genuine literary fiction (*Giovanni's Room*, *Atonement*, *The Poisonwood Bible*) and mainstream commercial/genre bestsellers (*It*, *The Midnight Library*, *Daisy Jones & The Six*) — "literary" is applied as a loose subject tag even to genre work (Jeff VanderMeer's *Annihilation*, a Nebula-winning horror/sci-fi novel, is tagged "Literary"). `cult novel` (238 hits) was worse: *1984*, *Interview with the Vampire*, and a *Batman* graphic novel all matched — "cult" keys off the *Cults*-as-subject-matter tag as much as "cult classic" reputation, surfacing exactly the famous, mainstream, over-recommended titles this project exists to steer away from. Confirms `/search.json` is doing literal word co-occurrence across title/author/subject text, not anything resembling genre- or taste-aware matching.

Status: root cause of the narrow-pool clustering fully identified (subject-endpoint determinism on shared tag guesses, not a model-selection bug). Decision made: free-text `/search.json` is not fixable for this use case with query-wording changes and should be deprioritized or dropped rather than continued to be tuned — the AND-join and generic-metadata-matching behavior are structural, not a phrasing problem. Next direction: focus on the subject endpoint specifically — investigate whether `/subjects/{slug}.json` supports pagination (an `offset` param, and how deep each subject's catalog actually goes) and whether having the model request more than one subject tag per call (since taste inputs often don't map cleanly to a single tag) would address the clustering without needing free-text search to carry any of the relevance burden. Diagnostic logging and both eval-run scripts (`scratchpad/run-eval-narrow.mjs`, `scratchpad/attribute-pool-sources.mjs`) left in place for that follow-up.

---

## 2026-08-03 — Query-construction hypothesis tested and weakened

Added temporary diagnostic logging to `search_books` (query, subject, poolSize, tagged by eval case — see `lib/tools/searchBooks.ts`, `lib/tools/index.ts`, `app/api/recommend/route.ts`) to test the leading hypothesis for the narrow-pool clustering documented below: that structurally different taste inputs were converging on similar `search_books` queries, and that similarity in query text was driving the repeated-title pattern. Ran the same 11 `eval-set.md` cases once against the current prompt with logging active. Raw output: `scratchpad/query-log.json` (36 logged calls) and `scratchpad/eval-run-results.json` (full recommendations per case).

Two findings:

- **The specific pairing that clustered twice last session (cases 6 and 8, both landing on *The Memory of Love*) didn't repeat this run.** Case 6 → *Hunger*, *The Informers*, *The Assistant*; case 8 → *Sátántangó*, *Paris Trout*, *The Garden of Evening Mists* — no overlap between them, and *The Memory of Love* didn't appear in either (it turned up in case 4 instead). Their queries still overlap in subject/theme this run (both hit `literary_fiction` + `psychological_fiction`, both orbit "morally ambiguous/complicated character") even without matching vocabulary — so the two cases remain structurally close in query space, they just didn't land on the same title this time.
- **More significant: the one title that did repeat this run — *Sátántangó* (Krasznahorkai), cases 4 and 8 — came from queries with no meaningful overlap.** Different subjects (`translated_literature`/`magical_realism`/`literary_fiction` vs. `literary_fiction`/`psychological_fiction`), different vocabulary, no shared free-text terms. Two genuinely dissimilar queries still converged on the same title.

That second finding weakens the query-construction hypothesis: the clustering doesn't clearly track query similarity. Case 4 and case 8 prove a repeated title can happen without similar search terms, which means query-text convergence isn't a necessary condition for the pattern — even if it may still be a contributing factor in cases like 6/8 where the queries *are* close.

**Natural next step, flagged not yet done:** extend the logging to capture full pool contents per call (not just `poolSize`), so a repeated title can be checked against whether it was actually present in both cases' retrieved pools. Two different root causes look the same from title-overlap alone but require different fixes: (a) genuinely overlapping Open Library results across dissimilar queries (a retrieval-breadth problem — same books keep surfacing regardless of query wording), vs. (b) the model converging on a title it wasn't even shown in one of the two pools (a model-selection problem — trained-knowledge bias overriding the grounded candidates). Pool-content logging would distinguish these directly instead of continuing to infer from query text alone.

Status: hypothesis tested and weakened. Root cause still open — needs the pool-content logging above before it can be narrowed further. Diagnostic logging left in place (not removed) for that follow-up run.

---

## 2026-08-02 — Narrow-pool finding reframed: a general clustering tendency, not a fixed offender list

While rescoring the Prompt v4 run (docs/eval-results.md), found *The Memory of Love* (Aminatta Forna) clustering across 4 of 11 cases. Ran the same 11 `eval-set.md` cases a second time, back to back, against the identical Prompt v4 SYSTEM_PROMPT (no prompt changes between the two runs) specifically to check whether that clustering was a one-off artifact of a single `search_books` call or a repeatable pattern.

It's repeatable, but the specific title isn't fixed:

- **Run 1:** *The Memory of Love* in 4 of 11 cases (2, 3, 6, 8); *Oblomov* in 2 (1, 2); *Hunger* in 2 (3, 6). 5 of 11 cases shared a title with another case in the same run.
- **Run 2 (identical prompt, immediate rerun):** *The Memory of Love* in 3 of 11 cases (4, 6, 8); *The Garden of Evening Mists* in 2 (3, 8); *The Informers* in 2 (4, 6). 4 of 11 cases shared a title with another case in the same run.

*The Memory of Love* clustered in both runs, and specifically landed in cases 6 (hard turn-off) and 8 (texture-match) both times — the same two taste profiles, independently, twice. But *Oblomov* and *Hunger* (Run 1's other clustering titles) didn't recur in Run 2, and *The Garden of Evening Mists* / *The Informers* (Run 2's other clustering titles) weren't part of Run 1's cluster. So the magnitude of the problem is stable (4-5 of 11 cases per run share membership with another case), but which titles fill that role shifts between otherwise-identical calls.

This is a reframing of the existing finding, not a new problem. It's the same underlying issue first observed 2026-07-08 (*So Long, See You Tomorrow* / *Convenience Store Woman* / *Independent People* recurring 2-3x each) and confirmed to persist after grounding on 2026-08-01 (*Satantango* recurring 2x). What tonight's two-rerun comparison adds: the specific "offender" titles were never really the problem — they're symptoms of a general tendency for the model (even grounded against a real, shuffled `search_books` candidate pool) to converge on a small number of go-to answers per run, and that tendency is stable in magnitude even though its specific targets rotate call to call. Chasing individual titles (as the July 8 and August 1 entries implicitly did) will keep finding new instances rather than resolving the underlying cause.

Status: documented, not fixed. This looks more like an architecture question than a prompt-wording one — worth weighing whether it's the same shape of problem Section 5's grounding decision was meant to solve and didn't fully, or a genuinely different mechanism (e.g., `search_books` query construction itself converging on similar candidate pools across different taste inputs). Needs more reruns to characterize before deciding.

---

## 2026-08-02 — Case 5 empty-response incident (single occurrence, not yet investigated)

During the second of tonight's two Prompt v4 reruns, case 5's first API call returned a valid HTTP 200 with `stop_reason: end_turn`, but the final text block was empty — no recommendations, no error. `usage` showed `output_tokens: 314`, of which 312 were `thinking_tokens`: the model spent nearly its entire output allocation on the `thinking` block and returned effectively nothing for the actual response, despite `max_tokens: 4000` leaving plenty of headroom unused. This is not the same root cause as the 2026-07-07 truncation bug (that was `max_tokens: 1500` being exhausted by thinking; here the model stopped well under the 4000 cap on its own).

A same-input retry immediately after produced a clean, normal response (*The Warden*, *Memento Mori*, *Sweet Thursday*). Single occurrence — not reproduced deliberately, not investigated further tonight.

Status: flagged, not investigated. Worth watching for recurrence in future runs; if it happens again, worth capturing the full `thinking` block content to see whether there's a pattern before treating it as a code-level issue.

---

## 2026-08-02 — Case 9 (Say Nothing): factually inaccurate non-obviousness justification, a reliability problem not a taste call

Found while scoring the 2026-08-01 run against the full rubric (docs/eval-results.md). Distinct from the broader non-obviousness pattern documented in the entry below — this one isn't a judgment call about where the "obvious" line sits, it's a factual claim in the model's own output that doesn't hold up.

Case 9's top pick, *Say Nothing* (Patrick Radden Keefe), justifies its `nonObvious` field with: "it's well-regarded but often gets overshadowed by flashier true-crime picks." Checked against actual reception: it won the National Book Critics Circle Award for Nonfiction, the Orwell Prize for Political Writing, and the Arthur Ross Gold Medal; it was named to the New York Times's 20 Best Books of the 21st Century and a Kirkus Best Nonfiction Book of the Century; it was a Barack Obama favorite book of the year; and it was adapted into a 2024 FX/Hulu series. It is not overshadowed by anything in this genre — it's one of the most decorated and widely-cited narrative nonfiction titles of the last decade.

This pick also happens to be the single most obvious answer to case 9's brief ("investigative journalism/historical accounts that read like thrillers") under the "first-guess" test described in the entry above — so it fails on non-obviousness twice over. But it's logged here separately because of the specific claim itself: the model asserted something checkably false about a real book's reception in order to justify the pick, rather than just picking something that's arguably too famous. That's a different category of failure than a judgment call about non-obviousness — it's the model fabricating a specific factual claim, apparently under pressure from the Prompt v3 award-bias rule to explain away exactly this kind of fame.

Worth watching for elsewhere: if the award-bias rule is inadvertently teaching the model to write confident-sounding but false disclaimers about a book's reception, that's a bigger reliability concern than the underlying pick-selection bias it was meant to fix.

Status: documented, not yet fixed. Good candidate to check for recurrence in future runs — specifically whether the model fabricates "actually it's less famous than you'd think" claims to satisfy the award-bias rule when the true answer is "yes, this is actually the famous/obvious pick."

---

## 2026-08-02 — Non-obviousness bar clarified: the test is "first-guess answer to the brief," not "won an award"

Scoring the 2026-08-01 run against the full rubric (docs/eval-results.md) surfaced weak non-obviousness scores in cases 6, 8, and 10. Worth being precise about the actual failure mode here, since it's easy to over-apply the Prompt v3 fix in the wrong direction: **the bar isn't "avoid decorated or famous books."** A Booker winner or a Hugo/Nebula sweep can still be a genuinely non-obvious pick for a specific brief. The real test is narrower — would a reasonably well-read person already have this exact book on their radar as *the* answer to this exact ask, the kind of thing a quick search or a "best of [genre/mood]" list would surface first? Fame and decoration correlate with that failure mode; they aren't the same thing as it, and a pick shouldn't be downgraded just for being decorated if it still wouldn't be most people's first guess.

Reframing cases 6, 8, and 10 through that lens specifically:

- **Case 6 — still weak, for the correct reason.** *Disgrace* isn't a weak pick because it won the Booker. It's weak because it's arguably the single most commonly-cited answer to "literary fiction, character studies, morally complicated people" that exists — the reflexive answer, prize or no prize.
- **Case 8 — reassess.** Neither *The Garden of Evening Mists* nor *The Yiddish Policemen's Union* is the obvious first-guess answer to "granular sense of place + morally ambiguous characters, genre doesn't matter." Both are decorated (Walter Scott Prize / Man Asian Prize / Booker shortlist for the former; Hugo/Nebula/Locus/Sidewise for the latter), but neither is what most well-read people would name first for this specific brief — a search for "immersive sense of place, moral ambiguity" surfaces things like *The English Patient*, *Blood Meridian*, or *All the Light We Cannot See* long before either of these. Under the first-guess test rather than the was-it-decorated test, this case reads closer to good than weak — worth revisiting if this case is rescored.
- **Case 10 — still weak, but for a specific and different reason than originally scored.** *We Have Always Lived in the Castle* and *The Little Stranger* aren't weak because of an undisclosed Booker shortlist (*Little Stranger*) or because Jackson is famous generally — they're weak because both are genuine staples of exactly the "atmospheric, moody, unsettling-not-horror" list this brief describes. They're the first-guess answer to this specific emoji-coded vibe, not a discovery. *Kit's Wilderness* holds up fine under this test — genuinely off the radar for this brief despite its own award (Printz), because that award sits in a different genre bucket (YA) this specific ask wouldn't surface it from.

Net: cases 6 and 10 hold up as weak under the corrected test; case 8 likely doesn't, and may be worth rescoring on a future pass. Flagging rather than silently changing the already-reviewed scoring table in docs/eval-results.md.

Status: documented. Good candidate to fold into a future SYSTEM_PROMPT revision alongside the award-bias rule — the instruction should probably target "is this the reflexive/first-guess answer to the specific brief" rather than naming specific award bodies, since the award-naming approach is exactly what let cases 8 and 10 slip through un-triggered.

---

## 2026-08-01 — Grounding reduced repetition but didn't eliminate it: same pattern, new title

First full eval run (docs/eval-results.md, 2026-08-01) since `search_books` was wired into the live recommend call. Checked directly against the three titles named in the 2026-07-08 "repeated picks across structurally distinct inputs" finding below:

- "So Long, See You Tomorrow" (Maxwell) — does not appear anywhere in this 11-case run. Previously recurred in 3 cases (1, 2, 6).
- "Independent People" (Laxness) — does not appear anywhere. Previously recurred in 2 cases (1, 6).
- "Convenience Store Woman" (Murata) — appears once, in case 7b — the same case it recurred in before. Previously recurred in 3 cases (3, 5, 7b).

That's a real reduction, not noise: all three previously-flagged titles either disappeared entirely or dropped from multiple cases down to one. Grounding via `search_books` appears to be doing real work against the narrow-internal-pool problem.

**But the underlying pattern wasn't eliminated — it just resurfaced on a different title.** "Satantango" / "Sátántangó" (László Krasznahorkai) appears in *both* case 3 ("just something good to read" — vague input) and case 8 (granular sense of place + moral ambiguity — texture-match input) in this same run. These are structurally distinct inputs, not near-duplicates of each other, which is exactly the criterion used to rule out a test-design artifact in the original finding below. This is a new instance of the exact failure mode Section 5's grounding architecture was built to fix — not a recurrence of the same three titles, but the same shape of problem: the model still has *some* narrow "go-to" pool it reaches for across varied inputs, grounding just changed which titles are in it.

Status: documented, not yet investigated further. Full 6-dimension rubric scoring for this run is still outstanding (deferred to next session — see docs/progress-log.md, 2026-08-01 entry). Worth watching whether this is a one-off coincidence across 11 cases or a real residual pattern once more cases are scored and more runs accumulate.

---

## 2026-07-08 — Known limitation: prestige/award status treated as "non-obvious"

Observed in the Prompt v2 eval run (docs/eval-results.md): across cases 6, 7b, 8, and 9, non-obviousness scored weak specifically because picks were major literary award winners — Disgrace (Booker Prize, contributed to Coetzee's Nobel), Lincoln in the Bardo (Booker Prize, #1 NYT bestseller), The Sympathizer (Pulitzer Prize, 2024 HBO adaptation), and Black Hawk Down (bestseller, major film adaptation).

This is a distinct failure mode from the repeated-titles finding above (same day) — not the model drawing from too small a pool, but the model's working definition of "non-obvious" being too narrow. The system prompt instructs against bestseller/bandwagon picks, and the model appears to interpret that as specifically "not on a commercial bestseller list" — while treating major literary prizes (Booker, Pulitzer, Nobel) as evidence of genuine, uncommon quality rather than as their own, equally well-known form of "safe, expected" recommendation. A prize winner is just as much an institutionally-endorsed, widely-known pick as a bestseller — swapping commercial fame for critical fame still isn't the surprising, personal-friend-recommendation quality the prompt is aiming for.

Distinguishing the fix from the repeated-titles issue matters: a broader external book dataset (the Section 5 grounding question) would likely help reduce repeated titles by giving the model more real candidates to draw from, but would NOT fix this issue on its own — a bigger dataset still contains Booker and Pulitzer winners, so the model could just as easily pull from a larger set of famous-but-prestigious books. This is a definition problem in the prompt's instructions, not a breadth problem in the data.

Likely fix: a targeted SYSTEM_PROMPT addition, addressable now, independent of the Section 5 architecture decision — explicitly instruct the model that major literary awards (Booker, Pulitzer, Nobel, National Book Award, etc.) are not, on their own, evidence of a non-obvious pick. Fame is fame regardless of whether it comes from sales charts or prize committees; a pick should be judged non-obvious based on how surprising and specific it is to the reader's actual stated taste, not on which kind of institution made it famous.

Status: documented, not yet fixed. Good candidate for the next SYSTEM_PROMPT revision — smaller, more targeted change than the Section 5 grounding question, and can be tested independently.

---

## 2026-07-08 — Known limitation: repeated picks across structurally distinct inputs

Observed in the Prompt v2 eval run (docs/eval-results.md): several titles recur across multiple, meaningfully different test cases rather than being confined to one:

- "So Long, See You Tomorrow" (Maxwell) — cases 1, 2, 6
- "Convenience Store Woman" (Murata) — cases 3, 5, 7b
- "Independent People" (Laxness) — cases 1, 6

Checked whether this is a test-design artifact (cases worded too similarly) — largely ruled out. Case 6 (hard genre turn-off, morally-complicated-characters framing) shares little surface wording with case 1 (mood/texture framing) or case 2 (explicit anti-mainstream framing), yet converges on the same titles. This suggests the model has a fairly small internal "quiet literary fiction" answer-pool it reaches for across varied inputs, not just near-identical ones.

This is a soft version of the "variety across sessions" failure mode — not the strict case (same input, re-run, same output), but a related risk: a real user population would likely see the same handful of titles resurface across different taste profiles that all land in adjacent territory.

Likely fix: not prompt wording (already tried removing named calibration examples in Prompt v2 — didn't eliminate this). This points toward the still-open architecture question in spec.md Section 5 — grounding recommendations against a broader external book dataset rather than relying solely on the model's own trained knowledge, which appears to default to a limited familiar set for any "quiet/literary/character-driven" request regardless of specific framing.

Status: documented, not yet fixed. Revisit once retrieval/grounding is decided.
