# experiments/

> **Status:** Reference · One-off investigations and the evidence behind past decisions. Not app code, not linted, not type-checked. Last updated Nov 1, 2026.

Formerly `scratchpad/`. In November 2026 it was split by purpose:
- **`evals/`:** the eval runners (how recommendation quality is measured). See `evals/README.md`.
- **`scripts/`:** maintenance tools, like refreshing the Hardcover tag list. See `scripts/README.md`.
- **`tests/`:** automatic checks, run on every pull request (the old `trace-equivalence-check.mts` now lives there).
- **`experiments/` (this folder):** everything else: investigations, their evidence, and cover research.

The app no longer writes anything here. Its live logs (`query-log.json`, `hardcover-failure-log.json`) and debug traces now go to the gitignored `.local/` folder, so real readers' answers can never be committed. The `query-log.json` kept in this folder is the historical log up to Nov 1, 2026, and the evidence behind the Aug 4 narrow-pool investigation and the Sept 20 grounding checks.

Most `.json` output here is gitignored; evidence files are force-added (`git add -f`) and listed below. Finished experiments have been removed over time; any of them can be recovered with `git log --all -- scratchpad/<name>`.

## Tools still useful (they import app code from `../lib`)
- `classify-grounding-rejections.cjs` — sorts grounding-check rejections from an eval run into causes, using tolerant title/author matching against the logged pools. Paths inside point at the old Codespace location; update before reuse.
- `attribute-pool-sources.mjs` — re-runs each logged query against Open Library's two endpoints to work out which source each pool title came from; writes `pool-source-attribution.json`.
- `prod-repro-check.mjs` — sends cases 1, 9 and 10 to the live `/api/recommend` route. Reads the response's `raw` model message, which the route stopped sending in Oct; needs reworking against the trace before reuse.
- `pick-check-replay.mts` — replays the pick-description check N times on frozen inputs and scores each verdict; `pick-check-build-live-inputs.mts` and `pick-check-build-replay-inputs.mts` build those inputs. They use the old string interface of `checkPickDescriptions`; convert before the next checker experiment.
- `cover-research/` — cover coverage, size and upscaling research (Oct 13); findings in `cover-research/summary.md`.

## Evidence — the basis for a past decision

- `eval-run-grounded-2026-09-20.json` — raw output of the Sept 20 full 11-case run of the grounded-picks change (PR #5); see `docs/quality/eval-log.md`, 2026-09-20.
- `eval-run-grounded-fix-verify-2026-09-20.json` — raw output of the re-run of cases 3, 4, 1, 8 that verified the grounding-validator fix.
- `pool-source-attribution.json` — per-title source attribution (search vs subject endpoint) from the Aug 4 run; showed the clustering came from the subject endpoint, not the model.
- `hardcover-ol-overlap-test.mjs` — showed Hardcover's tag-matched pool genuinely differs from Open Library's, validating Hardcover as a supplement (Aug 15).
- `hardcover-diag-ranks16-30.mjs` — inspected Hardcover ranks 16–30; confirmed junk-free, which justified widening the pool from 15 to 30.
- `step3b-relevance-distribution.mts` — checked the relevance-score spread across all four tag sets; led to `RELEVANCE_FLOOR = 2` in `preparePool.ts`.
- `hardcover-schema-scan.mjs` — pulls Hardcover's full GraphQL schema; part of confirming there's no similarity/recommendation field to use.
- `hardcover-schema-report.mjs` — prints the Book/Series/Edition/Author/List types from that schema dump. Reads it from an old session's temp path, so it won't run as-is.
- `hardcover-tag-discovery.mjs` — found real Hardcover tags matching two eval inputs, so the overlap test used tags that actually exist.
- `hardcover-coverage-check.mjs` — checked how often promising Hardcover fields (pages, series, list reasons, etc.) are actually filled in, not just present in the schema.
- `openlibrary-pagination-vs-multisubject-test.mjs` — showed neither pagination nor multi-subject fixes cross-case convergence; multi-subject fan-out was built anyway for richer pools (Aug 19).
- `step4-real-merge.mts` — first real Open Library + Hardcover merge run (cases 3 and 8); re-run Sept 2 to confirm Hardcover candidates reach the merged pool.
- `blind-prep.mjs` — builds the blinded comparison list for the tag-widening test (Sept 17); widening was closed as not a viable lever.
- `tag-widening-test.mjs` — the tag-widening experiment itself: baseline vs widened Hardcover tag sets for case 1.
- `hc-stress-test.mjs` — inflated Hardcover's pool share to see whether its picks can win; showed low Hardcover pick rates are proportional rarity, not a structural block.
- `id-plumbing-check.mts` — confirmed a book found in both sources keeps both catalog IDs through merge and grounding (Sept 26 wrong-book fix).
- `ol-pick-metadata-check.mjs` — checked whether Open Library has descriptions and full subjects for the Sept 23 baseline's 33 picks; groundwork for the Sept 26 fix.
- `pick-check-izzo.mts` — ran the real description check on the Izzo pick that was wrongly described in the Sept 23 baseline; expected it to be rewritten.
- `pick-lookup-izzo-check.mts` — confirmed the metadata lookup surfaces the Izzo book's "history and criticism" subjects, the signal that it's essays, not a novel.
- `cover-research/` — Oct 13 cover coverage and quality research: per-source hit rates and pixel sizes for 57 picks and 150 pool books, the fake-cover finding, and the EDSR 2× upscaler test. Start with `cover-research/summary.md`. Cover images and the pages that display them are gitignored; the scripts regenerate them.
