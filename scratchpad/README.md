# scratchpad/

Working folder for experiments, eval drivers, and diagnostics — not part of the app build. It can't be deleted, though: the app writes two live logs here while it runs:

- `query-log.json` — every `search_books` call (query, subject, pool contents), appended by `lib/tools/searchBooks.ts`.
- `hardcover-failure-log.json` — Hardcover failures (missing token, API error, empty or failed tag mapping), appended by `app/api/recommend/route.ts`. Gitignored.

Most other `.json` output here is gitignored run output. Finished experiments have been removed; any of them can be recovered with `git log --all -- scratchpad/<name>`.

## Critical — don't delete

- `query-log.json` — the live search log above; also the raw evidence behind the Aug 4 narrow-pool investigation and the Sept 20 grounding-rejection checks.
- `hardcover-tags-gt100.json` — the full Hardcover Tag-category list (count > 100). `lib/hardcover/tagVocabulary.ts` is generated from it.
- `run-eval.mjs` — holds the 11 eval cases (verbatim from `docs/eval-set.md`); `run-eval-grounded.mjs` reads its `CASES` array rather than retyping them.

## Tools — still in use

- `run-eval-grounded.mjs` — runs all 11 eval cases against the live `/api/recommend` route and parses the dev-server log for attempt counts, pick sources (OL/HC), and pool sizes.
- `run-eval-narrow.mjs` — same driver as `run-eval.mjs`, limited to cases 3, 4, 6, 8 (the ones that showed title clustering).
- `classify-grounding-rejections.cjs` — sorts grounding-check rejections from an eval run into causes, using tolerant title/author matching against the logged pools.
- `attribute-pool-sources.mjs` — re-runs each logged query against Open Library's two endpoints to work out which source each pool title came from; writes `pool-source-attribution.json`.
- `hardcover-pull-tags.mjs` — re-pulls the Hardcover tag list into `hardcover-tags-gt100.json` (step 1 of refreshing the tag list).
- `check-tag-exclusions.mts` — runs `hardcover-tags-gt100.json` through `lib/hardcover/tagExclusions.ts` and reports what's excluded and kept (step 2: filter).
- `capture-anthropic-requests.mjs` — dev-only preload that records every request sent to the Anthropic API, to see exactly what the model receives. No production logging needed.
- `hc-single-book-lookup.mjs` — shows what Hardcover's API returns for one book ID (description, tags, cross-source IDs).
- `prod-repro-check.mjs` — sends cases 1, 9, and 10 to the live `/api/recommend` route exactly as a normal client would.
- `pick-check-replay.mts` — replays the pick-description check N times on frozen inputs and scores each verdict; used to compare prompt/model changes on identical inputs.
- `pick-check-build-live-inputs.mts` — freezes the Sept 26 live-run picks (cases 1 and 8) as replay inputs and writes the combined v2 input set.
- `pick-check-build-replay-inputs.mts` — builds the original frozen input set (cases 1, 5, 8) for `pick-check-replay.mts`.

## Evidence — the basis for a past decision

- `eval-run-grounded-2026-09-20.json` — raw output of the Sept 20 full 11-case run of the grounded-picks change (PR #5); see `docs/eval-log.md`, 2026-09-20.
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
