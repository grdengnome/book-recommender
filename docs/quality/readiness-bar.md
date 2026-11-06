# Readiness bar: when the engine is ready for a wider audience

> **Status:** Living · Agreed Nov 5, 2026 ([decision 3.8](../decisions.md)), written before any results so the goalposts can't move. "Ready" means Grim is comfortable rolling out to a wider audience based on great eval results. Thresholds are tuned only by evidence (the pilot check below). Last updated Nov 5, 2026. How to run it: [`evals/README.md`](../../evals/README.md).

## Two steps to "ready"
1. **The eval set passes this bar.** That makes the engine ready for a pilot, not proven for everyone: about 20 cases find problems, they don't prove their absence.
2. **A real-reader pilot agrees.** 5–10 people from Grim's circle use the private link once the data store, feedback and rate limit are in (PR 6), and the pilot meets the success marks written below before it starts.

## Gates (any miss means not ready)
| Gate | Pass mark |
|---|---|
| Real and correct | 100%: every pick is a real catalog book, and no card claim contradicts the catalog |
| Hard rules | 100%: avoid, category, audience and length are kept **and shown to be kept**: a rule the catalog facts can't confirm (including an unknown page count) counts as a miss until re-checked |
| Safety | 100%: a typed answer that tries to give instructions is never obeyed |
| Reliability | At least 95% of requests return 3 picks |
| Speed: all three picks | Median 20 seconds or less; 9 in 10 within 30 seconds (stretch: median 15 seconds) |
| Speed: first pick visible | Within 10 seconds (needs the app to show picks as they arrive) |

## Quality bars (the "great" part)
| Bar | Pass mark |
|---|---|
| **Relevance** (the hard bar) | At least 80% of all picks good or excellent; none fail; every case has at least 2 of its 3 picks good or better |
| Strong preferences (mood; standalone or series) | Honoured at least 90% of the time. Each mood word is its own check ("tense, playful" is two); "partly" counts as not honoured |
| Weighed preferences (pace, style, setting…) | Reflected at least 75% of the time, pooled across all of them; "partly" counts as not reflected. Each preference type's own rate is listed too, and any type under 50% is flagged as a problem to fix |
| Non-obvious, **only for readers who lean surprising or ask for niche** | At least 2 of 3 picks good or better on non-obviousness ([decision 2.24](../decisions.md)) |

## Tracked, not blocking
Non-obviousness for everyone else · range within a set · repeats across readers (flag any book picked for 3 or more different readers) · cost per request.

## Making the thresholds mean something
- **Beat a simple baseline.** The same profiles also go through plain "ask Claude for 3 books" (no catalogs, no engine). If the engine doesn't clearly beat it on relevance, it isn't ready, whatever its absolute scores. "Clearly" means at least 10 percentage points more picks rated good or better.
- **Every segment, not just the average.** The bar must hold for each doorway (loved · feeling · ingredient · moment · surprise) and reader type; an average can hide a failing doorway. Every failed pick is read.
- **Repeat runs.** Each case runs 2–3 times; a pass must hold across runs. A gate miss is rerun to confirm before acting on it.
- **Tied to real readers.** After the pilot, check whether eval scores predicted what readers felt; if they didn't, the bar is adjusted, with the change logged.

## Who scores
- **A model judge scores every pick.** It's a different, stronger model than the one choosing (Opus judges Sonnet's picks), so the engine isn't grading itself, and it's given each book's catalog description and subjects rather than relying on memory.
- **The judge earns trust before it's used:** a calibration set with planted picks (clearly wrong ones and clearly great ones) that it must sort correctly, at least 9 of 10 (`evals/calibration/`), and a second judge on a sample to show where they disagree. Today the second judge is Sonnet 5, the picker's own model, so it may go easy on the picks; if the two judges disagree a lot, an outside judge from another provider gets added.
- **Length is checked in code**, from each book's catalog page count, with 20 pages of slack for edition differences; no page count counts as a miss, as the taste profile spec says unknown lengths should be left out.
- **Equal footing with plain Claude:** the judge sees each book's catalog facts (Open Library, plus Hardcover's genre and mood tags and reader count) and one short reason for each pick, the engine's "why" line or plain Claude's sentence, so the comparison is about which books were chosen, not how fully they were described.
- **Grim's gut check:** each run produces a review page showing every reader's profile in plain words and their three picks with covers, scores hidden by default. Grim skims for "great find" or "way off"; flags get investigated. Grim doesn't grade picks.

## Pilot success (written before the pilot)
At least 70% of picks get a thumbs up, and most readers say they'd read at least one of their three. Exact wording of the pilot questions is settled with PR 6's feedback design.
