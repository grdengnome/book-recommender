# Cover coverage and quality — 2026-10-14

Read-only research. Sample: **57 unique final picks** from three saved eval runs (Sept 20 grounded, Sept 20 fix-verify, Sept 23 postfix; the postfix file was found locally) plus **150 pool books** randomly sampled from `query-log.json` (seed 20261014, from 4,378 unique pool books, picks excluded).

Grades are by pixel width: Sharp ≥ 500, Usable 300–499, Small < 300, None. A cover is shown at 284×426 on screen, so a sharp phone display needs ~570px.

**Google Books could not be tested.** Every keyless request returned HTTP 429, `Quota exceeded for quota metric 'Queries' and limit 'Queries per day'`. That is a daily quota shared by all keyless callers. The script slowed to retries at 10s, 30s and 60s, then stopped the source as instructed. No API key was added. Its rows below are 0% because nothing could be fetched, not because Google has no covers.

## Picks (n=57)

| Source | Hit rate | Wrong-book matches | Sharp | Usable | Small | None |
|---|---|---|---|---|---|---|
| Open Library | 56/57 (98%) | 0 | 1 (2%) | 44 (77%) | 11 (19%) | 1 (2%) |
| Hardcover | 57/57 (100%) | 3 | 2 (4%) | 44 (77%) | 11 (19%) | 0 (0%) |
| Google Books | not tested (quota) | – | – | – | – | – |
| **Best of all three** | 57/57 (100%) | (excluded) | 3 (5%) | 49 (86%) | 5 (9%) | 0 (0%) |

## Pool sample (n=150)

| Source | Hit rate | Wrong-book matches | Sharp | Usable | Small | None |
|---|---|---|---|---|---|---|
| Open Library | 130/150 (87%) | 0 | 2 (1%) | 98 (65%) | 30 (20%) | 20 (13%) |
| Hardcover | 125/150 (83%) | 34 | 11 (7%) | 79 (53%) | 35 (23%) | 25 (17%) |
| Google Books | not tested (quota) | – | – | – | – | – |
| **Best of all three** | 133/150 (89%) | (excluded) | 11 (7%) | 105 (70%) | 17 (11%) | 17 (11%) |

"Best" is the widest real cover per book. It ignores any match flagged as a possible wrong book. The hit rate counts a wrong-book match as a hit, because an image did come back.

## Takeaways

1. **Almost every pick has a real cover, but almost none are sharp.** All 57 picks have one, and only 3 reach 500px wide. The typical best cover is about 326×500.
2. **Open Library has a hard size limit.** Its large covers are never taller than 500px, so an ordinary book shape comes out about 330px wide. Open Library can almost never give a Sharp cover.
3. **Hardcover is the only source here with bigger images, and only for a few books.** It had 10 covers at 570px+ (2 picks, 8 pool books). Its search also returns metadata that gives the image's real size, so we can know the size without downloading it.
4. **Hardcover's search is loose and needs a strict title/author check.** It returned wrong books for 3 of 57 picks (for example, *Elizabeth Costello* matched an anthology with a co-author named Costello) and 34 of 150 pool books. A few flagged matches are actually the right book in translation (*Los informantes* → *The Informers*). Open Library's title + author search had no flagged matches.
5. **Google Books needs a decision.** Without a key it can fail for a whole day, and that would likely affect the planned fallback order (Open Library → Google → placeholder) too. Whether to add a key is your call.

## Later findings (same session)

- **Two pick covers are fakes**, found by eye in a grid of all pick covers: *Miss Mapp* is a labelled stand-in ("This is not the actual book cover") and *Sult* is a Project Gutenberg auto-generated cover. Real coverage for picks is 55 of 57, not 57 of 57. Automated checks didn't catch either.
- **Upscaler test:** EDSR ×2 (OpenCV `dnn_superres`, Apache-2.0, PSNR-trained, no GAN) on the 10 softest picks. Text stayed intact; about 90 s per cover on 2 CPU cores. In a blind phone test (`upscale-blind.html`), the 2× version was picked as sharper 8 times out of 10.

## Method notes

- Each source was queried independently, at about 1 request per second per site, using the project's User-Agent. Each source's top 5 results were ranked by title and author agreement, with a cover as the tie-break.
- Pixel sizes come from the downloaded image headers (JPEG/PNG/GIF/WebP), read with no new dependency. No placeholder images turned up: Open Library's `default=false` returned 404s correctly, and no image repeated across books.
- A match is flagged as a possible wrong book when the main-title similarity is below 0.5, the surnames don't overlap, or it is a summary or study-guide edition. Author checks are skipped when the two names are in different scripts.
- Files: `sample.json`, `results.json` (per book, per source), `summary-data.json`. Re-run with `build-sample.mjs` → `fetch-covers.mjs` (needs `.env.local`) → `build-report.mjs`.
- Covers, upscales and the pages that display them are gitignored. `build-report.mjs` regenerates `contact-sheet.html`; `analyze-covers.mjs` → `grid-picks.mjs` → `upscale-softest.py` / `upscale-samples.py` → `build-preview.mjs`, `build-compare.mjs`, `build-blind.mjs` regenerate the rest (upscaler setup is in `upscale-softest.py`).
