# Eval Set

*Status: draft starter set (10 cases). Finalizing this to the 20–30 target, applying the #10 reword and #7 split, is a pending next step — not done yet. Use this as-is for now; don't treat it as complete.*

## Rubric

Score each test case's output on all 6 dimensions, 4-point scale: **fail / weak / good / excellent**.

| Dimension | The question | Why it's here |
|---|---|---|
| Relevance | Do the picks match the stated taste, mood, appetite? | Baseline — must hit |
| Non-obviousness | Are these NOT the bandwagon picks everyone names? | Core differentiator |
| Range | Variety across era, author, genre — not 3 flavors of one thing? | The "wide variety" rule |
| Real & correct | Actual books, right authors, no invented titles? | Guards against hallucination |
| Traceability | Can you see *why* each was picked from the inputs? | Feeds reflect-back; builds trust |
| Variety across sessions | Does the system avoid near-identical rec sets for similar/repeat inputs? | Repeat titles are fine if relevant — staleness is the failure mode |

## Test cases

1. **Rich, clear input** — anchor + why + mood all coherent. Easy case; should nail it.
2. **Anti-mainstream profile** — loved *Stoner* / *Project Hail Mary*, wants books that leave an impression, explicitly anti-mainstream. Does it avoid the obvious?
3. **Vague input** — "just something good," minimal signal. Should trigger an adaptive follow-up, not guess wildly.
4. **Explicit anti-mainstream demand** — "nothing everyone's already read." The acid test for the non-obviousness dimension.
5. **Contradictory signals** — wants "light and quick" but anchor book is an 800-page literary epic. How does it reconcile?
6. **Hard turn-off** — "love literary fiction, will not read fantasy." Does it respect the boundary?
7a. **Rejection → clarify** — user dislikes the first 3 cards. Does the clarifying question produce a genuinely better second set?
7b. **Rejection → clarify → widen escalation** — clarify doesn't land either. Does the clean-exit widen mechanic kick in correctly (editable taste read-back, then wildcard variety)?
8. **Texture-match, not genre-match** — "granular sense of place, moral ambiguity" type input. Can it match on texture, not just category?
9. **Genre/category fidelity & adjacent expansion** — anchor signals a specific, somewhat narrow genre or category (e.g., narrative nonfiction, or any other niche). Tests two things: (a) does the recommender stay faithful to the actual signaled category rather than drifting toward its own default bias in either direction, and (b) if strong, non-obvious picks are genuinely scarce within that exact niche, does it responsibly widen to closely adjacent categories — transparently, not silently — rather than forcing weak in-category picks or ignoring the stated genre altogether?
10. **Creative-framing-only input** — emoji cluster + mood, no anchor book. How well does it do on vibe alone, without the highest-signal input?

## Next steps for this file

- Expand toward 20–30 cases.
- Track results over time in an `eval-log.md` as prompt iterations happen.
