# The taste profile: what the question flow hands the engine

> **Status:** Living · Draft v1, Nov 4, 2026 ([decision 2.24](../../decisions.md)). Defines the engine's input for the v2 question flow ([v2 design](./v2-design.md) §2). The slot list is data (`lib/engine/profile/slots.ts`) and the shape is a contract (`lib/contracts/tasteProfile.ts`), so both can change as the questions are designed. Last updated Nov 4, 2026.

## The idea
When a reader finishes the question flow, the app sends the engine a **taste profile**, not a paragraph. The profile has three layers, so nothing the reader did is lost to a summary:

1. **Slots:** the organised read of the reader (mood, pace, setting…). Each filled slot says where it came from and how sure we are.
2. **Their answers:** what the reader actually chose or typed, question by question ("chose the *fog* forecast"). Kept word for word.
3. **Anything else:** signals no slot covers ("audiobook", "translated fiction", "by women authors"). Logged, so a recurring signal becomes a new slot.

The engine turns the profile into a labelled **reader brief** for the choosing model, in plain code (no model call, no added wait). The brief always shows the reader's own answers next to the slots, and tells the model that the reader's words outrank our inferences.

## Slots (profile v1)
Every slot is optional. An empty slot is left out of the brief; the engine fills the gap with its own judgment.

| Slot | Values | How firmly it's treated | Shapes |
|---|---|---|---|
| **Doorway** | Which way in the reader chose: something I loved · a feeling · an ingredient or world · a moment · surprise me | Context: tells the engine where the reader started | — |
| **Loved** | Up to 3 things the reader loved, any medium (books first; shows, films and comics later), each with an optional *what hooked you* (the people · the world · the twists · the writing · the feeling) and an optional *but…* twist (darker · lighter · shorter · funnier · less bleak…) | Steers the search; the hook and twist are the reader's direction | Search + choice |
| **Ingredients** | What the book should have: "a heist", "found family", "big ideas about time", "a strong narrator" | Weighed, steers the search | Search + choice |
| **Mood** | Mood words, plus intensity from 1 (a hint) to 5 (wreck me) | **Strong preference** | Search + choice |
| **Pace** | page-turner · steady · slow and immersive | Weighed | Choice |
| **People or plot** | people · plot · both | Weighed | Choice |
| **Writing style** | spare · lush · witty (one or more) | Weighed | Choice |
| **Setting / world** | Places, eras, "an invented world", "here and now" (up to 2) | Weighed, steers the search | Search + choice |
| **Think or escape** | think · escape · both | Weighed | Choice |
| **Ending feel** | happy · bittersweet · gut-punch · open | Weighed | Choice |
| **Familiar ↔ surprising** | familiar · neutral · surprising | Sets how much non-obviousness matters (below) | Choice |
| **Published** | recent · modern · classic | Weighed | Search + choice |
| **Standalone or series** | standalone · series is fine | **Strong preference** when given | Choice |
| **Moment** | When or why they're reading: "a long flight", "reading slump", "gift for my dad" | Context | Choice |
| **Category** | fiction · nonfiction | **Hard rule** when given | Search + choice |
| **Audience** | adult · young adult · children | **Hard rule** when given | Search + choice |
| **Length** | quick · short · medium · long | **Hard rule** when given | Choice |
| **Avoid** | Genres, themes or content the reader rules out | **Hard rule** | Search + choice |

**No single way in.** A loved book is one doorway, not the main road: in the [question core audit](../../research/question-core-audit-2026-10-22.md) only about 1 in 4 real requests started from a book, and mood decided the picks even over the anchor. Mood, ingredients and the moment are equal ways in. Whatever doorway the reader takes, the engine searches with the combination of what's filled: subjects from ingredients and setting, mood tags, and the loved books' subjects. Which doorways produce the most relevant picks is measured by the evals, and the flow's emphasis follows the evidence.

**Length bands** (tunable, in the slot data): quick = up to 200 pages · short = 200–300 · medium = 300–500 · long = over 500. **Forgiving at the edges:** a book up to 15% past either edge (at least 25 pages) is allowed, so short accepts about 170–345 pages and medium about 255–575; beyond that it's left out, and so is a book whose length is unknown. The engine enforces this in code before the model chooses: it looks up page counts for the candidate pool and removes books that don't fit ([decision 2.25](../../decisions.md)). The eval judge checks the same range.

## Firmness, in plain words
- **Hard rule:** never broken. Avoid, category, audience, length.
- **Strong preference:** mood, and standalone or series when given. The audit showed mood decides whether picks feel right ([decision 2.20](../../decisions.md)).
- **Weighed:** the appeal factors. Always considered, never thrown away: the picks should reflect each one the reader gave, and a book that misses one needs to be clearly stronger on the others. They're weighed together rather than enforced one by one, so a book that's perfect on mood and starting point can still miss on pace.
- **How explicit the reader was matters too.** A slot's weight rises with how directly the reader said it: a clear answer they chose outweighs a partial one, and both outweigh our inferences. A specific direction ("properly unsettling", "witty, please") is treated close to a strong preference.
- **Steers the search:** loved books, ingredients, setting, published and mood also decide what gets searched, not just what gets chosen.

## Firmness is a setting, tuned by evidence
Each slot's firmness lives in the slot data, like a model choice in `lib/ai/slots.ts`, so it can be changed without touching code. It's measured, not assumed:
- **Adherence:** the evals score, for every slot a reader gave, whether the picks honour it. A slot that's often ignored shows up as a low adherence rate.
- **Impact:** removing one slot at a time from a case (as in the [question core audit](../../research/question-core-audit-2026-10-22.md)) shows which slots actually change the picks.
- **Real readers, once live:** which missed slots go with a thumbs-down or a "Not quite? Try again".

A slot gets firmer or softer only when that evidence says so, and each change is logged like any other eval-backed decision.

## Familiar ↔ surprising decides how much "non-obvious" matters
Relevance is always the bar: the best pick for this reader. Non-obviousness is an enhancement ([decision 2.24](../../decisions.md)):
- **Surprising, or the reader asked for something niche** ("nothing everyone's read"): non-obvious picks are expected, and scored that way.
- **Familiar or neutral:** an obvious pick that genuinely fits is a full pass. The engine still avoids reaching for a famous book out of habit when a better fit exists.

## Getting the read right
Misreading a reader is the biggest risk, and it comes from the places we interpret rather than record:
- **Every slot value carries its source** (asked · inferred · typed) and confidence (partial · clear). Inferred values are marked as such in the brief and carry less weight.
- **"Avoid" is never inferred.** Only the reader can rule something out.
- **"Avoid" means what the reader meant, not a shelf label.** A rule like "no horror" is judged by what reading the book is actually like (its description and moods), read through the reader's own words ("horror, I want spooky but subtle"). Catalog genre labels are broad shelves: they count as evidence, never as the verdict on their own, either way ([decision 3.10](../../decisions.md)).
- **Typed answers travel word for word**, wrapped as reader data, never instructions ([decision 10.5](../../decisions.md)), with the slots read from them listed alongside.
- **The brief writer is plain code, tested word for word** (`tests/taste-profile.test.mts`).
- **The reader sees our read** on the loading screen ("Looking for…"), and "Not quite? Try again" catches what we got wrong.
- **Evals score the read separately from the picks** ([eval strategy](../../quality/eval-strategy.md)).

## Speed
- Writing the brief: plain code, milliseconds.
- Typed answers are read into slots *during* the flow, while the reader answers the next question, never at the end.
- Structured mood and setting can later replace the taste-to-tags model call with a fixed mapping, and let the search start before the last tap (early table-setting). Both are engine improvements to prove against the baseline, not part of this format.

## Changing it
- **A new question:** declares which slot it fills and what each option means. No engine change.
- **A new or renamed slot:** a small change to the slot data, with the profile version bumped and the brief tests updated.
- **The legacy paragraph** (`tasteDescription`) is still accepted, so the original 11 eval cases keep running.
