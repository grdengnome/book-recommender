# Eval strategy: how every part of Squirmly gets measured and improved

> **Status:** Living · Agreed Nov 4, 2026. How evals spread beyond the pick-quality eval, so every part of the product can be hill-climbed. Rubric and cases: [eval set](./eval-set.md) and [`evals/`](../../evals/README.md). When it's ready: [readiness bar](./readiness-bar.md). Findings: [eval log](./eval-log.md). Last updated Nov 4, 2026.

## The loop
Hill-climbing is the same everywhere: a fixed case set, a baseline score, change **one** thing, rerun the same set, keep the change only if it wins, and log it. A change is never judged on a fresh, different set of examples.

## The ladder
Cheap checks run constantly; expensive ones run when they matter.

| Rung | What | Cost | When |
|---|---|---|---|
| 1. Automatic checks | Rules checked in code: grounding, the golden-request test, the reader-brief wording, case-set validity | Free | Every pull request (live) |
| 2. Judged evals | A model or rubric scores outputs against a labelled set | Cents | When a prompt or model changes |
| 3. Full eval runs | The whole engine on a case set, scored blind by Grim | ~$1–2 | Milestones (e.g. the readiness run) |
| 4. Real readers | Thumbs up or down per pick, "Not quite? Try again" rate, drop-off | Free once live | Continuously, after PR 6 |

## What gets measured
**The engine, job by job** (one eval per AI slot in `lib/ai/slots.ts`, so a model swap is proven, decision 14.3):
- Reading typed answers into slots: does "like *Gone Girl* but less bleak, for a flight" become the right slots?
- Mood → Hardcover tags: are the tags right?
- Choosing the picks: the main eval (relevance first; [eval set](./eval-set.md)).
- Card writing: every claim matches the catalog, the tone is right, no false "underrated" claims.
- Shortening: meaning kept.
- Description check: catches the known wrong-book cases without false alarms.

**The read of the reader** (decision 2.24):
- Did the profile capture what the reader meant? Scored separately from the picks.
- Slot adherence: for every slot a reader gave, do the picks honour it? Hard rules must be 100%.
- Slot impact: removing one slot at a time, does it change the picks? This tunes each slot's firmness.

**Retrieval:** did the pool even contain great options? If the right books never reach the table, no prompt can choose them; this sets the ceiling on pick quality.

**Behaviour across runs:**
- Variety: the same reader five times, and different readers. How often do picks repeat?
- Obviousness calibration: do readers who lean surprising get less famous books (Hardcover reader counts)? A soft score; relevance is the bar.
- Speed and cost per stage, against a budget, from the debug trace.

**Robustness:** typed answers that try to give instructions, gibberish, non-English, emoji only, accented and non-Latin titles.

**The question flow:**
- Simulated readers: a persona with a hidden "true taste" goes through the flow; does the profile match? ([v2 design](../product/question-flow/v2-design.md) §8)
- Question value: does each question change the picks?
- Content gate: every new scene, line and metaphor passes "easy, vivid, never corny" and a tested mapping.
- Doorways: which ways in produce the most relevant picks.

**Visuals:** cover matching (right book, right edition, faithful upscale) and illustration consistency, judged blind (the image bake-off).

## Keeping judges honest
Wherever a model scores outputs, Grim blind-scores a sample too and we check the judge agrees. A judge that hasn't been checked against a person is just Claude grading Claude.

## Order
1. **Now, with the readiness work:** the reader-brief tests (done), a typed-answer eval, the new pick set in the profile format with adherence scoring, and variety and robustness cases folded in.
2. **When a model is swapped:** that job's eval.
3. **With the question flow build:** simulated readers, question value, doorways.
4. **With the image bake-off:** visuals.
5. **With PR 6:** real-reader signals.
