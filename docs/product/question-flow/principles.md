# Question flow operating principles

> **Status:** Living · Adopted Oct 22, 2026 ([decision 2.20](../../decisions.md)); updated Oct 25 and Oct 28 (decisions 2.21–2.23). Last updated Nov 1, 2026.

*Evidence: [question core audit](../../research/question-core-audit-2026-10-22.md). Full design: [question flow v2](./v2-design.md).*

Goal: the questions get at what the reader is really after, adaptively teasing out the underlying request, while feeling intriguing, interactive and fun, never like a form. The question flow is part of the product's delight, not a toll before it.

## The core (decision 2.20)
1. **"What are you after?"** Several ways in: a book, show or film you loved · a feeling · a topic, setting or kind of character · surprise me. The anchor is optional; non-books and more than one anchor are accepted.
2. **"Right now"** (required): mood with intensity; optional length.
3. **"Anything to avoid?"** (optional): chips, enforced as hard rules by the choosing step.
4. **Adaptive follow-ups,** only while the request is still unclear.

Appetite (comfort ↔ strange) is dropped as a question. Familiar ↔ surprising is calibrated through examples and by the engine (north star, decision 4.5: intriguing, not obscure).

## The seven principles

1. **Fill a taste profile, don't follow a fixed script.** The engine keeps a small structured profile: what you're after, mood + intensity, appeal factors (pace, character ↔ plot, writing style, setting, ideas, ending feel), length, avoid, plus familiar ↔ surprising calibration. Each next question targets the slot that is missing or most uncertain, and the flow stops when the profile is clear enough. Like the guessing game Akinator: each question should be the one that teaches the engine the most.

2. **Every question must earn its place, measured continuously.** More questions means more drop-off. A question is asked only if its answer is likely to change the picks (the Oct 22 ablation test: mood and length moved picks most; appetite moved nothing). Time budget: about 60–90 seconds, 4–7 taps. *(Oct 25: the "just show me" shortcut was removed; the flow is short enough that it invited an unnecessary step.)*

3. **Make answering the fun part.**
   - Comparisons beat absolute questions ("a storm at sea or a fire in a cabin?" beats "rate your mood 1–5").
   - Learn from examples: briefly show 2–3 real covers ("Would you read this? Yes / Seen it / Nope") to calibrate familiar vs surprising without asking it.
   - Mix formats to fit each slot: search for an anchor, this-or-that for mood, a dial for intensity, chips for avoid ([v2 design §5](./v2-design.md), [design system §8](../../design/design-system.md)).
   - *(Oct 25: the live taste line was removed from question screens to protect the reveal. The favourites screen shows "What I'm picking up" from the titles chosen, and the loading screen shows a "Looking for" line.)*

4. **Reflect the request back, without clouding the reveal.** The loading screen shows a short, non-editable "Looking for" line built from the answers. The correction path lives **after** the reveal: "Not quite? Try again" lets the reader adjust and re-roll. *(Oct 28: decided that an editable read-back before the reveal would cloud first impressions and reroute the flow unnecessarily.)*

5. **Every option must map to something searchable.** No option the engine can't act on. Each mood choice needs a tested mapping (gripping, unsettling and funny map well to Open Library; cozy, quiet, dark and romantic need Hardcover mood tags or tested subject sets). Limits like "not full horror" are enforced by the choosing step and avoid rules, not by search.

6. **Test adaptive flows offline with simulated readers.** Before real users, an AI plays 15–20 reader personas (gift-buyer, no favorite, mood contradicting the anchor, nonfiction-only, strong dislike…) and answers the questions. Measure questions needed, whether the profile came out right, and whether the picks fit. This is the eval set for the question flow.

7. **Once live, measure the questions themselves:** drop-off per question, time per question, which questions change picks, and wording A/B tests. The question bank improves the same way the engine does.

## Standing design rules (Oct 25): every screen, every theme
- **Composed scenes, not added detail.** A picture improves through the scene itself: things sit where they naturally would, nothing floats, objects relate to each other.
- **One consistent illustration style** across background, shelf and option art. (The rendering style itself is under review in the image bake-off; see [art direction](../../design/art-direction.md).)
- **Nothing that could read as wrong, unfinished or slop.** No stray lines, unnatural objects, lines that start or end nowhere, clipping or cut-off text. Small errors in a small sample will be seen constantly at scale.
- **No repeated pictures within one flow.** Each picture appears once per run; screens that echo the reader's mood (intensity, loading) get their own art. Small mood emblems are an icon language and may recur.
- **Minimal empty space.** Each screen fills the phone efficiently.
- **Even grids, realistic options.** No stretched odd tile; every option is realistic for its question.
- **Check before showing:** view every screen at phone size, in every state (empty, partly filled, full), on every path.
