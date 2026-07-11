# Eval Log

Running log of quality findings, known limitations, and decisions made while evaluating recommendation output against docs/eval-set.md's rubric. Newest entries at the top.

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
