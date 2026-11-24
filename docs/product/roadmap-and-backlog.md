# Roadmap and backlog

> **Status:** Living · Built from the Oct 28, 2026 idea brainstorm (51 ideas). New ideas are added here; anything that lands after the v0 scope freeze goes to "Later" by default. Last updated Nov 9, 2026.

## The vision
Squirmly helps readers find the next book they'll love, and makes finding, collecting and ranking books feel like play.
- **Discover:** an interactive, themed question flow and a theatrical reveal of three intriguing, relevant picks.
- **Collection:** finish a book → earn its collectible card → optionally rank it. A shelf for tracking, and Beli-style pairwise rankings instead of star ratings.
- **You:** your taste profile, reading insights and a yearly recap.
- **Social, later:** friends, sharing and book clubs.

A few main tabs, with features grouped inside them (six or fewer tabs). Readers first: built for the book lover who cares about a book's whole presentation.

## Phases
| Phase | What |
|---|---|
| **v0 (preview)** | The full Discover experience on a private link: [v0 scope](./v0-scope.md) |
| **Public launch** | Sign-in; the beginnings of Collection (shelf, earn a card, ranking); stronger security review; where-to-get-the-book links; app store or installable app |
| **Growth** | Profile and insights, sharing, seasonal sets, more themes and question formats, social |
| **Vision** | Clubs, challenges, a yearly Wrapped, official card art with publishers, curated reading lists |

## Backlog by area
Bucket: **v0** (in [scope](./v0-scope.md)) · **Later** (real app, after v0) · **Vision** (long-term) · **Unsure** (to decide).

### Discovery: question flow
| Idea | Bucket | Notes |
|---|---|---|
| Adaptive question flow filling a taste profile | v0 | [v2 design](./question-flow/v2-design.md) |
| Many question formats and content variants | v0 lite → Later | Must-have for production; v0 needs only a lite set |
| Gentle nudge for unclear typed answers | v0 | Never block |
| Favourites as starting points | v0 (simple) | Books only, one required, up to three; shows/films later |
| Returning-reader shortcut ("Same reader, new mood?") | Later | Needs accounts; feeds the user profile |
| Cover game (Yes / Seen it / Nope) | Later | Easier once a cover database exists |
| First-line questions | Unsure | Only if genuinely intriguing; public-domain or original lines |
| Question of the day | Later | Needs accounts |
| Zero-question surprise: three books with no questions, beyond the v0 "Surprise me" doorway | Later | Options (Nov 22): ready-made taste profiles ("templates" such as "cozy mystery night" or "big ideas"), picked by the reader or at random, run through the normal engine (Grim's favourite; templates could also be starting points to tweak); a random draw at the shortlist step with guardrails (quality bar, three different moods, no recent repeats), faster and cheaper with no choosing step; random guided by saved tastes once accounts exist. Avoid feeding random answers to the model. Decide after the friend test |

### Recommendations
| Idea | Bucket | Notes |
|---|---|---|
| Three varied picks | v0 | Variety without predefined pick types |
| Range of voices in the book index: track how many countries, eras and translated books it includes (no quota) | Later | Not a v0 priority with a small local friend group; pick up when the app expands (Nov 23) |
| More book forms in the index: poetry, graphic novels, plays | Later | Out of the v0 starter set because the question flow doesn't ask about format (decision 6.28) |
| Children's books, with their own content-safety checks | Later | Out of v0, and the "written for children" answer hidden (decision 1.14) |
| "Not quite? Try again" | v0 | The correction path after the reveal |
| Faster recommendations | v0 | Swappable models make per-step model choice easy |
| Engine performance track: running models more efficiently and creatively | Ongoing | Parallel calls, streaming, caching, routing small jobs to fast models, early table-setting; re-test model choices per job as new models ship (decision 14.3) |
| Taste summary on the loading screen | v0 | "Looking for" line |
| Eval set refresh: a new case set in the exact shape the question flow sends the engine (favourites, appeal factors, mood, turn-offs), drawn from patterns in real readers' answers, 20–30 cases, with machine-scored checks (grounded, 3 picks, distinct moods, turn-offs respected, how famous the picks are) beside blind human scoring | In progress (before PR 5, decided Nov 2) | `legacy-v0` stays frozen as the baseline (decision 14.5); cases worth adding sooner: an injection attempt, accented titles, the case 5 famous-picks drift |
| Dependency checkup: review npm's 25 reported package vulnerabilities (Nov 1) and update safely, in its own PR | Later | Before anyone outside sees the app; checks must stay green |
| Eval on demand: a "Run eval" button in GitHub Actions, with the API key stored as a GitHub secret | Later | Worth it once model swaps become frequent (decision 14.3); today evals run by hand |
| Shortlist, then choose with descriptions (decision 6.13) | v0 (round 1) | Tested against a prompt-only version |
| Smarter search: mood dictionary (our mood words → Hardcover moods and Open Library subjects) and loved-book seeds (search from the loved book's own record) | v0 (round 2) | Mood is the strongest preference and maps worst today |
| Reserves: choose 5, show 3 | v0 (round 3) | A failed check swaps in a reserve instead of rerunning the request |
| Fit check before the reveal: each pick checked against the musts from its description | Later (before pilot) | Swap a reserve on a fail |
| Start searching during the question flow, once the core answers are in | Later (before pilot) | Hides most of the wait |
| Curated shelves: Hardcover lists, Wikidata prize shelf | Later (before pilot) | The new Hardcover key allows lists |
| Translated titles that miss Hardcover | Later (before pilot) | Thin records lead to weak cards |
| Repeat damping: lightly penalise books recommended to many readers | Later | Needs the data store |
| Held-out readers: 15–20 real requests never used for tuning | v0 (eval tooling) | Guards against tuning the prompt to our 21 readers |
| Search measurement: were good fits in the pool at all? | v0 (eval tooling) | Tells search problems from choosing problems |
| Pilot signals per pick: "already read it", save and finish rates | v0 (pilot) | The real-world test of discovery and fit |
| Our own book index (decisions 6.14, 6.17–6.20) | v0 (starter set) | Design in `docs/engineering/book-index-design.md`; our own tags and search by meaning |
| Reader tags: readers tap a few buttons after finishing a book | Later | Same vocabulary as the question flow; outweighs model tags with enough votes (decision 6.19) |
| Ask Hardcover whether moods may be used in a paid app; host covers ourselves | Later (before any paid feature) | v0 is a free preview, so not needed yet (decision 6.18) |
| Wikidata for ID links, clean facts and awards | Later | A quality signal that isn't popularity |
| Learning from readers: saves, finishes and rankings improve picks | Growth | The long-term moat |
| Avoid list / Nope shelf | Later | Low priority |
| Influencer or curated reading lists | Vision | Fits the engine as another book source |

### Reveal and cards
| Idea | Bucket | Notes |
|---|---|---|
| Themed wrapping, tap to unwrap | v0 | |
| Rarity tiers | v0 (basic) | Improves with the image bake-off |
| Card enhancer + card bank | v0 | Faithful upscale only; respect cover copyright |
| 3D reveal book from edition data | v0 | CSS book vs Three.js book test planned |
| More reveal animations over time | Later | A set list for v0, then seasonal and themed additions |
| Genre-matched reveals | Later | Reveal theme matches the pick's genre |

### Book details and getting the book
| Idea | Bucket | Notes |
|---|---|---|
| Detail screen | v0 | |
| Where to get the book (buy, borrow, find) | Later | Skeleton only in v0; needed for wider rollout |
| Explore and favourites, Letterboxd-style | Later | |

### Collection: shelf, cards and rankings
| Idea | Bucket | Notes |
|---|---|---|
| Shelf: save, list, track | Later | Core to the full app; intricate |
| Finish → earn card → optional rank | Later | |
| Pairwise ranking (Beli-style) | Later | Key differentiator; feeds favourites, social and insights |
| Card collection | Later | The main draw |
| Goodreads history import: a reader uploads their own export | Later (must-have, needs sign-in) | Brings ratings and history for taste profiles, rankings and collection from day one (decision 6.18) |
| Earned rarity: a card levels up through the reader's actions (finishing, app-recommended, top-ranked) | Later | Preferred direction (Nov 16); scarcity later; popularity-based rarity skipped |
| Other rarity slices: achievements for reading and ranking lesser-known books | Later | Parked Nov 16; to be designed |
| Rarity tier shown at the reveal | Later | Parked Nov 16 |
| Seasonal sets; rarer cards for Squirmly picks | Vision | |
| Reading challenges that unlock cards | Vision | |
| Selling cards | Vision | Not upfront (copyright and legal risk) |
| Official card art with authors and publishers | Vision | |

### Profile, insights and sharing
| Idea | Bucket | Notes |
|---|---|---|
| Taste profile on the You tab | Later | Needs accounts |
| Reading insights (StoryGraph-style, better visuals) | Later | |
| Shareable picks and cards | Later | Instagram first; soft marketing |
| Squirmly "Wrapped" yearly recap | Vision | |
| Social features (friends, what others read) | Later | Beli-style social layer |
| Book clubs | Vision | In a social tab |

### Themes, visuals and brand
| Idea | Bucket | Notes |
|---|---|---|
| Five rotating genre themes | v0 | More themes over time (e.g. horror) |
| A different scene on every screen | v0 | Standing rule |
| Worm cameos | v0 | Mascot and name subject to change |
| Engaging loading content (author facts or more) | v0 | |
| Dark / light toggle | Later | Low-hanging fruit |
| Personal bookshelf props | Later | |
| Name, handle and domain | Alongside v0 | Claim now; branding later |

### Platform, return loops and growth
| Idea | Bucket | Notes |
|---|---|---|
| Few main tabs | v0 | Six or fewer; Discover live, others "coming soon" |
| In-app feedback (picks + general) | v0 | Stored |
| Web app first, then app store | v0 → Later | |
| Sign-in | Later | Required before public launch |
| Push notifications (useful, not spam) | Later | |
| Social media video marketing | Vision | Short clips of the reveal and cards |
