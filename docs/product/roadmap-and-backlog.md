# Roadmap and backlog

> **Status:** Living · Built from the Oct 28, 2026 idea brainstorm (51 ideas). New ideas are added here; anything that lands after the v0 scope freeze goes to "Later" by default. Last updated Nov 1, 2026.

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

### Recommendations
| Idea | Bucket | Notes |
|---|---|---|
| Three varied picks | v0 | Variety without predefined pick types |
| "Not quite? Try again" | v0 | The correction path after the reveal |
| Faster recommendations | v0 | Swappable models make per-step model choice easy |
| Engine performance track: running models more efficiently and creatively | Ongoing | Parallel calls, streaming, caching, routing small jobs to fast models, early table-setting; re-test model choices per job as new models ship (decision 14.3) |
| Taste summary on the loading screen | v0 | "Looking for" line |
| Eval set refresh: a new case set in the exact shape the question flow sends the engine (favourites, appeal factors, mood, turn-offs), drawn from patterns in real readers' answers, 20–30 cases, with machine-scored checks (grounded, 3 picks, distinct moods, turn-offs respected, how famous the picks are) beside blind human scoring | Next (with the café slice) | `legacy-v0` stays frozen as the baseline (decision 14.5); cases worth adding sooner: an injection attempt, accented titles, the case 5 famous-picks drift |
| Dependency checkup: review npm's 25 reported package vulnerabilities (Nov 1) and update safely, in its own PR | Later | Before anyone outside sees the app; checks must stay green |
| Eval on demand: a "Run eval" button in GitHub Actions, with the API key stored as a GitHub secret | Later | Worth it once model swaps become frequent (decision 14.3); today evals run by hand |
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
