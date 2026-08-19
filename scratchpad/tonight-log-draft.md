# 2026-08-19

**OL pagination vs. multi-subject isolation test:** pagination works within a subject but doesn't fix cross-case convergence (case-3/case-8 already share a subject). Multi-subject fan-out grows pool size (+96%) but overlap persists (56.6%).

**Decision:** build multi-subject fan-out for pool richness, not to fix overlap. Cross-case OL overlap on structurally different inputs is expected when genuinely relevant (matches eval rubric dim. 6) — validate at the merged-pool layer later, not this isolated number.

**Flag:** `translated_literature` OL subject returns 0 works at any offset — likely dead/misnamed on OL's side.

**Built:** final full-pool shuffle in `lib/merge/mergeCandidatePools.ts` (post-dedup/combine) — fixes source-clustering where OL candidates always preceded Hardcover-only ones.

**Architecture decision:** Hardcover stays a fixed pre-fetch, not a model-invoked tool. `route.ts` derives tags upfront, fetches Hardcover deterministically, calls `mergeCandidatePools` once both pools exist. Intentionally asymmetric with OL's adaptive/model-invoked search.

**New gap:** no taste-description → Hardcover tag ID mapping function exists yet. Must work in one shot (no adaptive correction under fixed pre-fetch).

**Discussed, not tested:** widening Hardcover's tag list (currently ~2-3 tags) to increase retrieval reach — distinct from `WORKING_POOL_SIZE` (already tested, stays at 15). Test in isolation next session.

**Still open:** multi-subject fan-out not yet built into `searchBooks.ts` — needed before further merge testing.

## Next session (in order)
1. Build multi-subject fan-out into `searchBooks.ts`
2. Build taste-to-Hardcover-tag mapping function
3. Wire Hardcover into `route.ts` as fixed pre-fetch; call the merge there
4. Test widening Hardcover's tag list in isolation
5. Run real merge for case-3/case-8; check merged pool and source-tracking stats

## Carried forward, untouched
- Four taste-facet gaps from Aug 15
- Vetting Hardcover's Content Warning tag category from Aug 13
