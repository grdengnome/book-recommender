# Question flow operating principles

*Adopted Oct 22, 2026; [decision 2.20](./decisions.md). Evidence: [question core audit](./research/question-core-audit-2026-10-22.md).*

Goal: the questions get at what the reader is really after, adaptively teasing out the underlying request, while feeling intriguing, interactive and fun, never like a form. The question flow is part of the product's delight, not a toll before it.

1. **Fill a taste profile, don't follow a fixed script.** The engine keeps a small structured profile: what you're after (entry point), mood + intensity, length, avoid, occasion / who it's for, plus familiar↔surprising calibration. Each next question targets the slot that is missing or most uncertain, and the flow stops when the profile is clear enough. Like Akinator: each question should be the one that teaches the engine the most. Adaptive by design, not "more questions."

2. **Every question must earn its place, measured continuously.** More questions means more drop-off. A question is asked only if its answer is likely to change the picks (the Oct 22 ablation: mood/length moved picks most; appetite moved nothing). Time budget ~60–90 seconds, 4–7 taps, with "just show me" always available.

3. **Make answering the fun part.** Comparisons beat absolute questions ("a storm at sea or a fire in a cabin?" beats "rate your mood 1–5"). Learn from examples: briefly show 2–3 real covers ("Would you read this? Yes / Seen it / Nope") to calibrate familiar vs surprising without asking it. Show the profile forming live in a small updating line ("Something gripping… short… nothing too dark"). Mix formats to fit each slot: autocomplete for an anchor, this-or-that for mood, a slider for intensity, chips for avoid, the cover game for calibration (the themed answer-format designs in [design §8](./design.md) cover most of these).

4. **The "here's what I'm hearing" moment.** Before the reveal, one editable card reflects the request back ("A short, gripping read with a quiet ending, nothing gory"). It builds trust, catches misunderstandings, and triggers early table-setting.

5. **Every option must map to something searchable.** No option the engine can't act on. Each mood choice needs a tested mapping. Limits like "not full horror" are enforced by the choosing step and avoid rules, not by search.

6. **Test adaptive flows offline with simulated readers.** Before real users, an AI plays 15–20 reader personas (gift-buyer, no favorite, mood contradicting the anchor, nonfiction-only, strong dislike…) and answers the questions. Measure questions needed, whether the profile came out right, and whether the picks fit.

7. **Once live, measure the questions themselves:** drop-off per question, time per question, which questions change picks, and wording A/B tests. The question bank improves the same way the engine does.
