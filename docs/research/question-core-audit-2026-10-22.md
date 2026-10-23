# Question core audit (October 22, 2026)

The evidence behind [decision 2.20](../decisions.md) (new question core), and the basis for the [question flow principles](../question-flow-principles.md). Three parts: an audit of real requests, a question-value (ablation) test on the live engine, and a free check of how "right now" options map to catalog subjects. Run on branch `experiment/question-core`; scripts in `scratchpad/question-core-*.mjs` on that branch, raw output in `scratchpad/experiments/2026-10-23-question-core/` (local, not committed). Spend: $2.37.

**Bottom line:** only about 1 in 4 real requests starts from a favorite book; most ask for a specific ingredient, a mood or an occasion. In the engine, the current mood decides the picks, and it overrides the anchor. A turn-off is decisive when the reader's other answers point toward what they want to avoid. Removing the anchor, the why or appetite never moved the result beyond normal run-to-run variation, and appetite had no measurable effect in any case.

---

## 1. Real-request audit (48 requests)

48 book requests read from r/suggestmeabook on Oct 22 (two recent page snapshots). Done in a separate Claude chat; summarized here. Requests often contain several elements, so shares sum to more than 100%.

| Element in the request | Share | Examples |
|---|---|---|
| Specific ingredient (character type, setting, topic, plot element, structure) | ~45% | older female protagonist; set in Eastern Europe; pit fighters; main character hiding a secret from the reader |
| Anchor title they loved | ~25% | like *Strange Pictures*; like *The Secret History* but better |
| Genre stated | ~20% | |
| Occasion or life situation | ~17% | long flight; trip to Edinburgh; going through a hard time; back into reading after years |
| Emotional effect / mood | ~15% | wreck me in a good way; jaw on the floor; spooky but subtle; lighter tone |
| Nonfiction / learning | ~12% | |
| Quality / wow | ~10% | |
| Length / format | ~4% | |
| For someone else | ~2% | |
| Too vague | ~4% | |

**Findings:**
1. Only about 1 in 4 requests starts from a favorite book, so the anchor should be one way in, not required.
2. The "why" options are too generic: people ask for specific ingredients.
3. "Right now" is justified, and mood options need intensity (wreck me, disturbing, absurd), not just cozy vs dark.
4. About a third of anchors are TV shows, films or comics (*Supernatural*, *Ocean's 11*, *Rick and Morty*), so the anchor input should accept non-books.
5. Several anchors are common.
6. Length and gifts are rarely stated up front, so they're optional filters, not required questions.

**Caveats:** a small sample from one community and snapshot. Reddit skews toward enthusiasts with very specific asks, and people leave out what they assume. Directional, not definitive.

**Sources:** https://lr.eu.psf.lt/r/suggestmeabook, https://lr.psf.lt/r/SuggestMeABook, https://gummysearch.com/r/suggestmeabook

---

## 2. Question-value (ablation) test

### Method

- **Structured test set.** Each eval case was rewritten as the current flow's answers (spec §4a): anchor, why, appetite (comfort ↔ strange), plus mood, length and turn-off as separate optional fields. A field was filled only where the original text stated it. Appetite is stated in none of the cases, so it was inferred to match each text, on a draft 5-point scale (Pure comfort · Mostly comfort · In between · Somewhat surprising · Surprising and a little strange). Lengths not stated as a band kept only the reader's words. Cases 7a and 7b test the rejection path, not the questions, and were left out.
- **Five new draft cases:** no favorite book; mood contradicting the anchor; a gift for someone else; nonfiction only; a strong dislike ("everyone loved X, I didn't"). Only the mood-vs-anchor case was run.
- **Engine input.** The taste-summary step isn't built, so answers were joined with the plain one-line-per-answer template that is spec §4f's fallback. Removing an answer removes exactly one line.
- **Runs.** The live `/api/recommend` route, unchanged, with the debug trace on. Each case ran twice with all answers (normal variation), then once with each answer removed (mood and length together in cases 1 and 5). 28 runs, all returned picks on the first attempt.
- **Measures.** Table overlap: the share of candidate books two runs have in common (Jaccard; 1.0 = identical), averaged over both full runs. Picks kept: how many of the three picks appear in either full run's six. Two full runs of the same input share only 0–1 picks, so pick counts show only large shifts.

### Results

Each cell: table overlap · picks kept. An answer matters only if removing it moves the result clearly beyond the normal-variation column. \* = appetite inferred in every case. ⚠ = obviously wrong picks.

| Case | Normal variation | − anchor | − why | − appetite\* | − mood/length | − turn-off |
|---|---|---|---|---|---|---|
| 1 (Remains of the Day) | 0.49 | 0.55 · 1/3 | 0.57 · 2/3 | 0.58 · 2/3 | 0.56 · 1/3 | — |
| 5 (War and Peace, light) | 0.69 | 0.46 · 3/3 | 0.35 · 0/3 | 0.40 · 1/3 | **0.14 · 0/3 ⚠** | — |
| 6 (literary, no fantasy) | 0.60 | — | 0.54 · 2/3 | 0.58 · 3/3 | — | 0.77 · 2/3 |
| 8 (sense of place) | 0.61 | — | — | 0.64 · 1/3 | — | — |
| 10 (emoji, not horror) | 0.93 | — | — | 0.96 · 2/3 | **0.16 · 0/3 ⚠** (mood only) | **0.46 · 0/3 ⚠** |
| Mood vs anchor | 0.21 | — | — | — | **0.20 · 0/3 ⚠** (mood only) | — |

### What went wrong without an answer

- **Case 5 without mood/length** picked *And Quiet Flows the Don*, *Les Misérables* and *One Hundred Years of Solitude* for a reader who asked for "light and quick". With it, every run picked light comedy (*Cranford*, *Three Men in a Boat*, *The Thursday Murder Club*).
- **Case 10 without "not full horror":** the Hardcover tags switched to Horror, the searches added "horror", and the picks went to *The House on the Borderland* and *Marina*. Both full runs stayed at quiet dread (*Ghost Wall*, *We Have Always Lived in the Castle*).
- **Mood vs anchor** (Blood Meridian; mood cozy, uplifting): with all answers the engine followed the mood (*A Psalm for the Wild-Built*, *Clock Dance*, *The Country of the Pointed Firs*). Without the mood it followed the anchor (*Satantango*, *Pincher Martin*, *Hunger*). This case's full runs varied a lot (0.21), so the signal is the change in tone, not the overlap figure.
- **Case 6 without "no fantasy"** picked no fantasy: "literary fiction" already keeps the searches away from it.

### What each question contributes

- **Anchor:** no measurable effect on its own in either case; the why and mood carry the same signal. Without the anchor title, case 1 picked another Ishiguro (*A Pale View of Hills*); with it, no run picked the anchor's author. One example.
- **Why:** no effect beyond normal variation in any case; it overlaps with the mood answer.
- **Appetite:** no effect in any of five cases. Caveat: every value was inferred and mid-scale (2–4); an extreme value wasn't tested.
- **Mood / length:** the strongest question. It sets the direction of the table and the picks and overrides the anchor; removing it caused the worst failures.
- **Turn-off:** decisive when the other answers lean toward what the reader wants to avoid (case 10), redundant when they don't (case 6).

### Caveats

- One run per removal; the engine's choices vary run to run, which is why each case has two full runs as a reference.
- Hardcover was dropped in 6 of 28 runs (4 timeouts, 2 empty tag matches; 4 of them in case 5), which adds some table noise there.
- Length reached the engine only as words; the planned page-count filter isn't built.
- Case 8 picked Izzo's essay collection again (its third appearance); it's on that table, not caused by the removed answer.

---

## 3. Mood-to-catalog check

Free; Open Library only. For each draft "right now" option, the subjects it plausibly maps to (ones the engine has chosen before, from the search log, plus a hand list) were fetched the way the engine fetches them (subjects API, top 100), and their size, canon-heaviness and sample titles checked.

| Option | Fit | Best subjects | Problem |
|---|---|---|---|
| Gripping | Good | suspense, thrillers, detective_and_mystery_stories | Top of the lists is Fleming, Dan Brown, Christie |
| Unsettling | Good | gothic_fiction, ghost_stories, supernatural | The "horror" subject's top is Dracula and Dorian Gray, so "not horror" can't be filtered by subject |
| Funny | Good | humorous_fiction, satire | humorous_stories and wit_and_humor pull in children's books |
| Adventurous | OK | sea_stories, adventure_stories | Very classic-heavy (two-thirds of adventure_stories' top 100 have 200+ editions), plus children's books |
| Dark | Poor | noir_fiction (158 works), crime_fiction | The "dark" subject is dark-romance erotica; psychological_fiction is canon |
| Romantic | Poor | romance_fiction | love_stories and romance top out at Austen and the Brontës; romantic_comedy is small and mixed with manga |
| Cozy | Poor | none | cozy_mysteries 12 works, cozy 55, feel_good 2; friendship_fiction is Huck Finn and Oz |
| Quiet/reflective | Poor | none specific | No quiet or meditative subject; literary_fiction and domestic_fiction are canon lists; memory mixes in self-help and picture books |

- **Length bands work.** Open Library has a page count for 87–100% of books in these subjects, and 7 of 8 spot-checked known books matched. *War and Peace* came back at 696 pages (it's 1,200+): multi-volume editions pull the median down, so long books near a band edge need care.
- **Familiar ↔ surprising doesn't map to Open Library.** Edition counts separate old classics (thousands of editions) from everything else, but modern bestsellers look obscure by that measure (*Normal People* 28 editions, *Lonesome Dove* 26, *Crazy Rich Asians* 21). Modern familiarity would need Hardcover reader counts.
- **Implication:** gripping, unsettling and funny map well. Cozy, quiet, dark and romantic need another route. Hardcover's tag vocabulary (tags used more than 100 times) has "reflective", "dark" and "romance", but no "cozy"; the nearest is "lighthearted".
