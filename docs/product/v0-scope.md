# v0 scope

> **Status:** Living · Agreed Oct 28, 2026 ([decision 1.11](../decisions.md)). Scope is frozen: new ideas go to the [roadmap and backlog](./roadmap-and-backlog.md) as "Later" unless they're a true must-have. Last updated Nov 4, 2026.

## What v0 is
**A polished preview of the full Discover experience, shared on a private link.** It proves the product works, gathers feedback from a first set of readers, and doubles as a portfolio link.

**Soft target:** end of 2026, not a hard date. Checkpoint in early December to see how it's tracking ([decision 9.12](../decisions.md)).

## In v0
**Question flow**
- Adaptive question flow that fills a taste profile ([v2 design](./question-flow/v2-design.md)), with a lite set of formats; more formats after v0.
- Several doorways (something I loved · a feeling · an ingredient or world · a moment · surprise me), all filling one taste profile ([decision 2.24](../decisions.md), [taste profile](./question-flow/taste-profile.md)). The favourites doorway is one search box using the existing Open Library title search, up to three, books only at first; it's optional, not required ([decision 2.23](../decisions.md)).
- Gentle nudge for unclear typed answers (never blocks).

**Recommendations**
- Three varied picks: variety, without predefined pick types that could bias the model.
- Loading screen with a "Looking for" line from the answers, and something engaging to read while waiting (author facts or similar).
- "Not quite? Try again" after the reveal.
- Faster recommendations, helped by the swappable model setup.

**Reveal and cards**
- Themed wrapping, tap to unwrap.
- Rarity tiers (basic first).
- Card enhancer and card bank (faithful upscale of the real cover, never altered).
- 3D reveal book from real edition data.
- Detail screen.

**Look and feel**
- All five themes (Café, Mystery, Fantasy, Superhero, Sci-fi) at "satisfactory" polish: the café is built first as the template, and the other worlds are built off it. As good as possible from a production standpoint, with accepted trade-offs.
- A different scene on every screen; worm cameos.
- Clean main tabs: Discover live, other tabs shown as "coming soon".

**Feedback and trust**
- In-app feedback, stored: thumbs up or down per pick, an optional short note, which picks were shown, and a general "send feedback" option. No personal details.
- Per-visitor rate limit (around 10 recommendations a day) so one visitor can't exhaust the monthly API cap.
- Basic prompt-injection guard: typed answers treated as reader data, never instructions; length cap; narrow tools; the existing grounding and description checks.
- A short privacy note.
- Decisions [10.5](../decisions.md) and [10.6](../decisions.md).

**Platform**
- Web app on a private link. No sign-in.

## Not in v0
Sign-in (required before public launch) · shelf, card collection, finish → earn card, pairwise ranking · profile, reading insights, taste profile on the You tab · sharing, social, book clubs, reading challenges, a yearly "Wrapped" · push notifications · dark/light toggle · where-to-buy beyond a skeleton · cover game · returning-reader shortcut · avoid list · shows and films as favourites · app store version · curated influencer lists.

All of these are in the [roadmap and backlog](./roadmap-and-backlog.md).

## Alongside v0 (not app features)
- Claim the @squirmly handles and getsquirmly.com (cheap protection; branding work later).
