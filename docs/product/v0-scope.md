# v0 scope

> **Status:** Living · Agreed Oct 28, 2026 ([decision 1.11](../decisions.md)). Refit Nov 12, 2026 ([decision 1.12](../decisions.md)); order and status are in the [plan](../plan.md). New ideas go to the [roadmap and backlog](./roadmap-and-backlog.md) as "Later" unless they're a true must-have.

## What v0 is
**A polished preview of the full Discover experience, shared on a private link with a few friends first.** It tests three things: the engine works, the question flow is enjoyable, and the books fit. It also doubles as a portfolio link.

**No fixed date** ([decision 9.13](../decisions.md)): quality first, with a full review at each checkpoint (the first in early December).

## In v0
**Question flow**
- Adaptive question flow that fills a taste profile ([v2 design](./question-flow/v2-design.md)), with a lite set of formats; more formats after v0.
- Several doorways (something I loved · a feeling · an ingredient or world · a moment · surprise me), all filling one taste profile ([decision 2.24](../decisions.md), [taste profile](./question-flow/taste-profile.md)). The favourites doorway is one search box using the existing Open Library title search, up to three, books only at first; it's optional, not required ([decision 2.23](../decisions.md)).
- Gentle nudge for unclear typed answers (never blocks).

**Recommendations**
- Three varied picks: variety, without predefined pick types that could bias the model.
- Loading screen with a "Looking for" line from the answers, and something engaging to read while waiting (author facts or similar).
- "Not quite? Try again" after the reveal.
- Faster recommendations (a median of about 30s for v0), helped by the swappable model setup.
- A starter book index: stored descriptions, moods and appeal tags for the books the engine meets ([decision 6.14](../decisions.md)).

**Reveal and cards**
- Themed wrapping, tap to unwrap.
- Rarity tiers (basic first).
- 3D reveal book from real edition data, improved in the reveal-book study (with the cover enhancer test). The card bank waits until after v0.
- Detail screen.

**Look and feel**
- A design baseline built to be improved, not replaced: the image bake-off, updated art direction, refreshed key screens and shared design tokens.
- Themes: the café as the floor, up to all five (Café, Mystery, Fantasy, Superhero, Sci-fi) if they prove cheap to add.
- A different scene on every screen; worm cameos.
- Clean main tabs: Discover live; Collection and You shown as "coming soon" teasers, plus an "add to shelf" doorway. Taps are tracked to learn where readers want to go.

**Feedback and trust**
- In-app feedback, stored: thumbs up or down per pick, an optional short note, which picks were shown, and a general "send feedback" option. No personal details.
- Per-visitor rate limit (around 10 recommendations a day) so one visitor can't exhaust the monthly API cap.
- Basic prompt-injection guard: typed answers treated as reader data, never instructions; length cap; narrow tools; the existing grounding and description checks.
- A short privacy note.
- Decisions [10.5](../decisions.md) and [10.6](../decisions.md).

**Platform**
- Web app on a private link. No sign-in.

## Not in v0
A trained style model · advanced motion · logo, mascot and per-theme typography · the design-system lock · card bank · sign-in (required before public launch) · shelf, card collection, finish → earn card, pairwise ranking · profile, reading insights, taste profile on the You tab · sharing, social, book clubs, reading challenges, a yearly "Wrapped" · push notifications · dark/light toggle · where-to-buy beyond a skeleton · cover game · returning-reader shortcut · avoid list · shows and films as favourites · app store version · curated influencer lists.

All of these are in the [roadmap and backlog](./roadmap-and-backlog.md).

## Alongside v0 (not app features)
- Claim the @squirmly handles and getsquirmly.com (cheap protection; branding work later).
