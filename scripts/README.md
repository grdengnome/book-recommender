# scripts/

> **Status:** Living · Maintenance tools for the project, not part of the app. Last updated Nov 1, 2026.

| Script | What it does |
|---|---|
| `hardcover-pull-tags.mjs` | Re-pulls the full Hardcover tag list into `hardcover-tags-gt100.json` (step 1 of refreshing the tag list). Needs `HARDCOVER_API_TOKEN`. |
| `check-tag-exclusions.mts` | Runs `hardcover-tags-gt100.json` through `lib/engine/sources/hardcover/tagExclusions.ts` and reports what's excluded and kept (step 2). Run with `npx tsx scripts/check-tag-exclusions.mts` (it uses extensionless imports). |
| `hardcover-tags-gt100.json` | The full Hardcover tag-category list (count > 100). `lib/engine/sources/hardcover/tagVocabulary.ts` is generated from it. Don't delete. |
| `capture-anthropic-requests.mjs` | Dev-only preload that records every request sent to the Anthropic API, to see exactly what the model receives. Writes to `.local/`. |
| `hc-single-book-lookup.mjs` | Shows what Hardcover's API returns for one book ID. |
