# Eval Log

Running log of quality findings, known limitations, and decisions made while evaluating recommendation output against docs/eval-set.md's rubric. Newest entries at the top.

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
