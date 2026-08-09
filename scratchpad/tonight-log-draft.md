## August 9, 2026 — Full Tag-category forced-choice scan: no new clusters confirmed

**Conclusion:** Extended August 6's forced-choice scan from the top-100 Tag-category tags to the full remaining set (177 non-cluster tags). No new clusters confirmed — the exclusion list stays at the known ~13 tags ([[character-development cluster]] + `pace_trio`). One correction to August 6's numbers, and one process gap worth flagging.

**Correction:** August 6's "780 tags above count>100" is the count across *all* tag categories, not the `Tag` category specifically — `Tag`-category count>100 is actually 190 (confirmed via `tags_aggregate`). So August 6's "top-100" scan already covered a bit over half of the relevant population; today closed out the remaining 177 (190 minus the 13 known).

**Process gap:** None of August 6's scratchpad files (data or scripts) survived into this session — only the committed progress-log narrative did. Rebuilt `hardcover-tags-gt100.json` and the pull scripts from scratch. Worth deciding whether to force-add key outputs to git going forward (as `query-log.json` already is) rather than relying on the environment persisting.

**Method:** Sampled 30 books/tag across all 177 tags, then ran a blind pairwise co-occurrence scan first — it produced ~1,000 flagged pairs, nearly all genre-segregation noise (e.g. fantasy tags never co-occurring with "non-fiction") rather than forced-choice signal, so blind co-occurrence across a heterogeneous tag set isn't a usable detector on its own. Switched to eyeballing tag names for same-axis candidates (same way `pace_trio` was originally spotted), then did a deeper 200-books/tag pull + per-user decomposition on 5 candidates: MC gender, pairing type (MF/m-m), author gender, POV person (third/first-person), POV count (dual-pov/Multiple POV's).

**Results:**
- **Male MC / Female MC — ruled out.** 7 co-occurring books (of 263); per-user decomposition showed all 7 came from one user applying both tags to the same book — organic multi-select, not forced choice.
- **POV person, POV count — inconclusive.** Zero co-occurrence across ~280-300-book pools (expected ~70-76 under independence), but zero co-occurrence also means zero overlap to decompose — the per-user test needs at least one instance to run. Likely genuine content/naming exclusivity rather than a UI widget, but unproven.
- **MF/m-m, author gender** — same zero-data situation, and technically out of scope: both rank inside the already-scanned top-100 tier, not the newly-covered range.

**Next:**
1. Decide whether POV person / POV count warrant a larger-sample retry or are safe to leave as "assume single-valued, unconfirmed."
2. Decide on force-adding key scratchpad outputs to git given the persistence gap.
3. Proceed with the taste-vocabulary-to-Hardcover-tag mapping (deferred from August 6, still unblocked).
