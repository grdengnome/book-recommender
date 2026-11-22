# Book index design

> **Status:** Draft · Parts 1–3 agreed Nov 16, 2026; Part 4 agreed Nov 17; Part 5 agreed Nov 20; Part 6 agreed Nov 22. Part 7 is still open. Nothing here is built yet.

The book index is our own database of books: the engine's backbone (decision 6.14). It is designed for the whole product (collection, rankings, reading stats, year summaries, premium), but v0 builds only a starter slice. This doc is the agreed design so far. The reasons are in [decisions](../decisions.md) 6.17–6.27, 3.16–3.17, 9.14, 10.8–10.13, 11.11 and 14.7.

## Where the design stands

| Part | Status |
|---|---|
| 1. What a book record holds | Agreed |
| 2. Sources and their terms | Agreed |
| 3. Our own layer: tags and search by meaning | Agreed |
| 4. Reader data | Agreed |
| 5. Storage, covers, contracts and backups | Agreed |
| 6. How the engine and the judge use the index | Agreed |
| 7. The v0 starter set (which books) | Not started |

## Part 1: what a book record holds

**Two levels, like library catalogs.** A *work* is the book as readers think of it. An *edition* is one published version of it (hardback, paperback, translation). Taste, tags and rankings attach to the work; pages, ISBN and cover attach to the edition.

**Three layers per record:**

| Layer | What it is |
|---|---|
| Collected | Each source's data exactly as received, with the source and date |
| Merged | One clean combined view; this is what the engine and judge read |
| Ours | What we add: tags and meaning data, each recording the model and vocabulary version that made it |

**IDs.** Every book gets our own ID, linked to outside IDs (Open Library, Hardcover, ISBNs; Wikidata later). When a source merges two of its records, we keep the old ID as a pointer.

**Authors are their own records,** not text on a book, so duplicates can be merged and "more by this author" works later.

**Fields:** title, original title and other titles · authors · first-published year · description and its source · subjects and genres · Hardcover moods · series and position · translator · editions (format, pages, language, ISBN, cover) · a status (complete, thin, needs review) · **form** (novel, stories, essays, memoir, poetry, graphic novel) · **audience** (children's, young adult, adult, unknown). Each field records its source and confidence.

**Audience safety rule.** A request for children's books gets only books positively labelled as children's. Adults never get children's-labelled books. Unknown is treated as adult. The labels' accuracy gets a free spot-check before the engine relies on them.

**Covers.** A cover belongs to an edition; each work points to a default cover. The record holds a link, the source, the size and whether we host it, never the image itself.

**Reserved, not filled for v0:** content notes, availability, popularity.

## Part 2: sources and their terms

| Source | Role | Terms, as checked Nov 16 |
|---|---|---|
| Open Library | Backbone | Data is CC0. Built from the free monthly download, not the live API, which is not meant for bulk use |
| Hardcover | Enrichment: moods, descriptions | Free tier 5,000 requests a day. Commercial products may not use readers' own data; aggregate data must be labelled as Hardcover's; no model training on it; a paid app must host covers itself. Their policies page was not readable from the session, so the paid-app points rest on a third-party summary |
| Wikidata | Later: ID links, clean facts, awards | CC0. Covers notable books only |
| Google Books | Out of the index | Its terms forbid charging users without Google's permission, and premium is planned |
| Goodreads | Catalog out; readers' own exports in, later | The API is closed. A reader can export their own shelves as a file and upload it to us |
| UCSD Goodreads dataset | Out | Academic use only |
| Library of Congress records | Check during the build | Free bulk download; may add audience labels Open Library lacks |
| Inventaire, Wikipedia, Project Gutenberg | Later | Open licences; not needed for v0 |
| Paid trade data (ISBNdb, publisher feeds) | Skip until there is revenue | Subscription |

**Before any paid feature:** ask Hardcover whether moods may be used in a paid app, and move covers to our own storage. v0 is a free private preview, so neither is needed yet.

**Descriptions** are used for the engine's reasoning and for writing our own card text. We don't show a source's description as our own.

## Part 3: our own layer

### One shared tag vocabulary

The question flow and the book tags use the same word list, so a reader's answer matches a book's tag directly. No model has to translate between two vocabularies (the problem with Hardcover's tags).

- **Fixed-choice traits** take their words from the taste profile: pace, people or plot, writing style, think or escape, ending, audience, category, series.
- **Mood** gets a fuller list (about 30–40 words), built from what readers actually say (question-flow options, the eval readers, the October audit), checked for gaps against established mood lists (Hardcover, StoryGraph, librarians' appeal terms), and extended by testing.
- **Setting and ingredients** stay open; subjects and search by meaning handle them.
- **The list is one data file in the repo.** Every change goes through a pull request. It has a version number, and every tag records the version that made it. An automatic check fails if a question-flow option has no tag, or the reverse.

### Three sources of evidence for a tag

| Source | When | How |
|---|---|---|
| Model tags | v0 | A model reads the description and subjects and fills in the form from the fixed list. Run once per book and saved |
| Hardcover moods | v0 | Translated once into our vocabulary; a second opinion and an accuracy check |
| Reader tags | After v0 | Readers tap a few buttons after finishing a book; each tap is a dated event |

Each tag keeps its evidence. The model's tag stands at first; once enough readers have tagged a book, their votes outweigh it. Our tags must be able to replace Hardcover's moods completely.

**Accuracy:** tags come only from the fixed list · a thin description gets fewer tags and a "thin" status, never invented ones · a 20-book test (model tags against Hardcover moods, plus Grim's read of a sample) runs before any batch · the real proof is the eval, with and without tags.

### Search by meaning

Each book's description is turned into a list of numbers once and saved; books with similar meaning get similar numbers. A reader's request gets the same treatment, and the database finds the closest books (Postgres with the pgvector add-on). It handles free-typed moods, ingredients and settings, and it has no fame bias. It needs one new AI job (an embedding model), chosen by a small test. Tags handle the fixed choices; search by meaning handles free text; picks still come only from our pool.

## Part 4: reader data (agreed Nov 17)

**Five data areas:** books · recommendations (profile, books shown, engine version) · reader actions as dated events · rankings (every pairwise comparison) · readers and collection (after v0; needs sign-in).

**Anonymous visitor ID.** A random ID kept in a cookie. We store only the ID: no name, email, IP address or fingerprint. When accounts exist, a visitor ID is linked to a reader with consent; past events are not rewritten.

**Events are only ever added.** A correction is a new event, never an edit: if a reader switches a thumbs-up to a thumbs-down, we add a "changed" event, so history stays truthful. Deletion is a separate, rare privacy action (below).

**v0 feedback shape:**
- Thumbs on each pick.
- **"Already read it"** is its own button, not a thumbs-down reason, with an optional follow-up: disliked / liked / loved. It is the only feedback from someone who has actually read the book.
- On a thumbs-down, optional reveal-time reasons: "not my mood", "doesn't sound like me", "too long or heavy".
- One optional open box at the end, with a note not to include personal details. It stays in the app for the first few versions and is kept longer only if it proves useful.
- Three or four watched sessions with friends.

Feedback is for diagnosis only in v0; it doesn't change tags or picks. Typed feedback is data, never instructions, and goes through the input guard.

**v0 events** (each defined in the event dictionary): pick shown · thumbs and thumbs changed · thumbs-down reasons · already read and its follow-up · open-box text · "Not quite? Try again" · taps on the "coming soon" tabs · "add to shelf" taps · general feedback · failed requests.

**Tables: created when first used.** v0 creates only the tables it writes to. Book side: works, editions, authors, work authors, external IDs, source records, work tags, covers and cover variants. Reader side: visitors, recommendations, recommendation picks, events, rate-limit counts. Comparisons, readers and collection, and summary tables are designed (Part 5's diagram) but created by the PR that first writes to them. Everything points at stable IDs (our book ID, the visitor ID), so later tables attach without changing existing data.

**Room for data we haven't thought of yet:**
- Every event has a flexible field that holds any number of named items. Something new can be recorded from the next release with no database change; an item gets its own column once we filter on it often.
- When unsure whether we'll need something, capture it in the flexible field now: anything not captured when it happens is gone. The no-identity rule still applies.
- Every new column or table is a script in a pull request, and every new flexible-field item is added to the event dictionary in a pull request, so every piece of data has a written meaning.

**The delete command.**
- An owner-only script, run from Grim's machine or a Codespace with the database's admin key. Nothing in the app can trigger it, and the app's own database login can add and read rows but not delete them.
- Two scopes: a whole visitor, or one recommendation (the recommendation, its picks shown, and every event and typed answer tied to it). Single events are never deleted; a wrong value is fixed with a correction event.
- A dry run first shows what would be deleted (row counts by type), then Grim confirms.
- It touches reader data only, never the book side. Each run logs the date and row counts, with no content.
- A friend who wants data removed asks Grim; self-serve deletion comes with accounts, behind sign-in.
- Deleted data survives in backups made before the deletion, so take a fresh backup after any deletion.

**Spend safeguards (three layers):**

| Layer | What it does | Status |
|---|---|---|
| Spend limit on the production key | The hard ceiling: the bill can't pass it (decision 10.4) | Exists |
| Daily cap across all visitors | Stops before the ceiling with a friendly "back tomorrow" message instead of errors | New for v0 |
| Per-visitor daily limit (about 10) | Stops one person, or one looping bug, from using up the day | In v0 scope (decision 10.5) |

The daily cap = monthly budget ÷ 30 ÷ cost per recommendation. Cost per recommendation is measured first (from a trace), then the budget and cap are set; about 50 a day is a placeholder. A cookie-based limit is easy to reset (clear cookies, private window, another browser), which is fine for trusted friends on a protected link; the stronger limit comes with sign-in before public launch.

**Reading the data:** a plain report from one command, not a dashboard. Rejected recommendations can become new eval readers, paraphrased (real answers never enter the repo).

**Later (after v0):** accounts and consented visitor linking · shelf and collection, finish a book to earn a card · pairwise comparisons and rankings · reader tags after finishing · Goodreads export import · summary tables for stats, insights and year summaries · avoid list and returning-reader shortcut · feedback that changes tags or picks · self-serve data export and deletion · a retention policy · a stronger rate limit.

## Part 5: storage (agreed Nov 20)

### The database: Postgres, hosted on Neon

**The engine and the host are separate choices.** Postgres is the long-term engine: linked tables, search by meaning (pgvector), keyword search, flexible fields, permission roles and a standard export, all in one place. The host is swappable: moving between Postgres hosts is one export and one import (about 100 MB for v0), so lock-in comes from the engine, not the host.

**Neon's free plan for v0.** Compared on Nov 20 against Supabase, Prisma Postgres and AWS Aurora, using each host's official pricing page and docs:

| | Neon | Supabase | Prisma Postgres | AWS Aurora |
|---|---|---|---|---|
| Free storage | 1 GB | 500 MB | 2 GB | 1 GiB |
| When idle | Sleeps after 5 min, wakes on the next request | Pauses after 1 week until restarted by hand | Vendor claims no cold starts | Optional pause |
| At the limit | Writes fail; no bill | Not stated | Not stated | Credits-based |
| Restore window (free) | 6 hours | None | None | Not checked |
| First paid step | No minimum; $0.106 per CU-hour | $25 a month | $10 a month | Pay as you go |

- **Why Neon:** fits v0, never bills by surprise, has the cheapest path to paid (usage-based, which suits bursty use), and upgrading is a billing change, not a migration.
- **Ruled out:** Supabase for v0 (the weekly pause would take the app offline between friend sessions; its sign-in and storage bundle is worth a second look when accounts arrive). Prisma Postgres (no free backups, unstated limit behavior, a per-query allowance a 10,000-book load would eat into). Aurora (credits expire within 12 months; kept as the large-scale benchmark).
- **Also ruled out, by category:** SQLite-based, MySQL-based, document databases, dedicated vector databases and search engines. Our data is heavily linked, and a second system would need keeping in sync.
- **Keeping it swappable:** the app reaches the database only through contracts; standard Postgres only. Neon-only features such as branching are used for development and testing, never in the app's runtime path. Backups are standard exports we keep ourselves.
- **Speed check:** no bake-off (Grim's call), but Neon's wake-up time and query speed from Vercel are measured in the 500-book pilot.

**Professional setup:**
- A Neon branch (a copy of the database) for development and evals, so experiments never touch real reader data.
- A fake stand-in for every contract, so automatic tests stay offline with no keys.
- Neon, file storage and Vercel in one region.
- Neon's connection pooler, built for serverless apps that open many short connections.

### What the database holds

```
BOOK SIDE (changes slowly, read constantly)
works ──< editions ──< covers ──< cover_variants   (original, enhanced; rarity later)
  │└──< work_authors >── authors
  ├──< external_ids      (Open Library, Hardcover, ISBN…)
  ├──< source_records    (data as received, kept raw)
  └──< work_tags         (tag, source, confidence, vocabulary version)

READER SIDE (grows forever, written constantly)
visitors ──< recommendations ──< recommendation_picks >── works
   │                │
   └──< events >────┘     (one row per action, never edited)
   └──< comparisons       (one row per "A beat B")
```

Image files don't go in the database (size, transfer limits, speed). **The record lives in the database; the file lives in file storage.**

**Habits that keep it scalable:**
1. Each fact is stored once and referenced by ID.
2. Events are only ever added, never edited.
3. Events have fixed columns for what we always filter on (who, type, book, recommendation, when) and one flexible field for the rest.
4. The app reads small summary tables rebuilt from events, not raw events.
5. Indexes match the questions we ask; the events table can be split by month when it grows.
6. Structure changes are scripts in the repo, through pull requests.

**Captured from day one, because it can't be recovered later:**
- What the reader actually saw: card text, cover, order.
- Version stamps on each recommendation: the code version (which covers prompts and logic), the settings in effect (model per job, engine settings), and the data version (vocabulary version, index snapshot date).
- The candidate list the engine chose from (book IDs).
- Failed requests, with the profile and the reason.
- A flag on internal and test traffic.
- Two timestamps: when it happened and when we recorded it.

**Backfilling.** New data that can be derived from what we kept, or that is a fact about a book, can be added to old records. Data only observable in the moment cannot; old rows get "unknown", never a guess. Backfilled values are labelled as such.

**Size.** The full structure is designed from day one, and tables are created when first used (Part 4); the book count starts small. Rough estimate: 10–15 KB per book all-in, so 20,000–30,000 books fit Neon's 1 GB; the pilot measures the real figure. The Open Library download is processed offline and only the chosen books are loaded.

### Covers

Covers are a core part of what makes the app distinctive: having the images, presenting them in a way that's mesmerizing, and giving readers a sense of ownership and collection. The legal side lives in the [legal and IP register](../legal/register.md); this section holds the technical design.

**Found once, at build time.** When the pipeline builds the index, each book's cover is looked for once, in order: Open Library, then Hardcover, then Google Books. The first real cover wins; labelled stand-ins and auto-generated covers are rejected. The result is saved in the book record, so no reader ever waits on a cover search. Books with no real cover are flagged, and that list is kept to fill over time.

**Every cover records where it came from:**

| Field | Example |
|---|---|
| Source | Open Library |
| Source's own ID or link | the cover's ID on Open Library |
| Publisher | Graywolf Press |
| Date fetched | Nov 20, 2026 |
| Terms | "display only, credit and link back required" |
| Check result | real cover / stand-in rejected |
| Visibility | shown / hidden (the kill switch: per book, per publisher, or everything) |

**Every generated variant records how it was made** (its recipe), so it can be referenced or recreated even after the design engine changes: engine or provider, model and version, prompt (a versioned prompt file in the repo), settings (seed, scale, other parameters), the input cover, the code version, date, approval and cost. AI tools don't always reproduce exactly, so the saved file is the source of truth and the recipe is the record.

**Everyone gets the same card.** The database is the registry of every variant (ID, version, recipe, approved). Files are never overwritten: an improved version is a new file with a new version number, and the registry points to the current one.

**The cover section is designed now for every stage below,** so later stages fill in fields rather than reshaping data. It is a foundation that will evolve.

**Staged roadmap (a living plan):**

| Stage | What | When |
|---|---|---|
| 1. Links | Cover link, source and "no cover" flag in each record | First, during the build |
| 2. Our own copies | Covers downloaded in bulk the legitimate way (Open Library's archive.org bulk files, or by asking Open Library; never by crawling its Covers API), stored in our file storage | v0, after Part 7 fixes the book list |
| 3. Variants | Enhanced covers (v0, the reveal-book study's cover enhancer test); rarity variants after v0, with the card bank | Enhanced in v0 |
| 4. Licensed high-res | Official artwork from publisher partnerships | When the app has traction to offer publishers |

Enhanced covers are in v0 because they are a big part of the proof of concept and of the feedback we want. **Still open:** enhance the whole index ahead of time, or books as they're first recommended. The enhancer test (cost and time per cover) decides.

### Contracts

Each part talks to its provider through a contract, so any provider can be swapped alone.

| Contract | Covers | Writes / reads | v0 provider |
|---|---|---|---|
| Books | Catalog, tags, cover records and sources, the variant registry | Only the build pipeline writes; the app reads | Neon |
| Reader data | Visitors, recommendations, events, feedback, rate limits | The app adds and reads; only the owner's delete script removes | Neon |
| Card files (new) | Original covers, enhanced versions, later rarity variants | The pipeline saves; the app serves | A small storage bake-off (Cloudflare R2 the likely default) |
| Image engine (new) | The cover enhancer now, rarity design later; records each recipe | The pipeline calls it | Decided by the cover enhancer test |

Existing contracts cover the rest: the AI gateway (including the model that powers search by meaning) and book sources. Sign-in, analytics and error tracking get theirs when chosen.

### Backups (v0)

A backup is a saved file, not a second database.

| What | How | Why |
|---|---|---|
| Book index | Keep the pipeline's output files | Rebuild without paying to re-tag or re-enhance |
| Reader data | One export before the friend test, plus one after any deletion | Neon Free can only rewind 6 hours |
| Card files | A second copy somewhere other than the main storage | Enhanced covers cost money and time to remake, and can't always be reproduced exactly |
| Proof | One restore drill before friends use the app | An untested backup isn't a backup |

- **Targets:** v0 can afford to lose data back to the last export, and must recover within a day.
- **Privacy:** reader exports contain typed answers, so they never go in the repo and are stored encrypted.
- **Keys:** API keys and database passwords are kept in a password manager.
- **Runbook:** the restore steps are written as a short checklist during the drill.
- Prompts and recipe files live in git, so they're already backed up.
- Scheduled automatic backups come later, once real readers depend on the app.

**Also for v0:** an event dictionary (one page: every event type and what it means) and the delete command (rules in Part 4).

### Refresh

No schedule in v0: one import from Open Library's download plus Hardcover's API. A refresh schedule is decided after v0.

### Outside checks for Part 5

- Neon's wake-up time and query speed, measured from Vercel in the pilot.
- How many pilot books get a real cover, and from which source; 20 covers spot-checked by eye.
- A test that the kill switch hides a cover instantly.
- The restore drill.
- A test that the app's database login can't delete anything.

## Part 6: how the engine and the judge use the index (agreed Nov 22)

**The whole process:**
- **A real reader asks:** answers become a taste profile → code builds a shortlist of about 40 books from the index → code turns it into the model's view (allowed fields only, numbered) → the model picks 3 by number → code maps the numbers back to books, writes the cards and shows them → everything is recorded.
- **An eval:** the engine runs on written test readers → code builds the judge's view of each pick (source facts only) → the judge scores each pick → a scorecard → compared against today's engine.
- **Improving:** change one thing → run an eval → record the result and the decision.

The engine (`lib/engine/`) serves readers. The judge (`evals/judge/`) runs only in evals and never touches a reader.

### 1. Retrieval: code builds the shortlist

One quick query to our own database replaces the model's search rounds; the model only chooses. The taste profile's firmness (`lib/engine/profile/slots.ts`) decides how each answer is used:

| Firmness | Answers | Use |
|---|---|---|
| Hard | Category, audience, length, avoid | Filter |
| Strong | Mood; standalone or series | Mood scored heavily; "standalone" filters out later books in a series |
| Weighed | Pace, people or plot, style, think or escape, ending, published, setting, should-have | Points for matching tags or year |
| Context | Loved books, familiar or surprising, moment | Loved books seed search by meaning; the rest goes to the model only |

- **Filter:** hard rules, plus the reader's loved books. "Avoid" text is matched to tags where possible; the rest goes to the model and the judge checks it. If a hard-rule fact is unknown, the book is left out, as with today's length rule.
- **Score:** tag and keyword matching plus search by meaning, combined with reciprocal rank fusion (a book earns points for ranking high on either list, with no hand-tuned weights).
- **Variety:** the best 25 plus 15 drawn at random from the next 150; at most 2 per author; one entry per series; shuffled so the model can't infer a ranking.
- **Size:** under 3 books gives "not enough books" (logged); 3–19 proceeds and is logged as a thin shortlist; about 40 is normal. 40 is a starting value, tuned with the shortlist check (try 30, 40 and 60; keep the smallest that doesn't lose good options).
- **Randomness** is fixed by a seed in evals, so runs are repeatable; real readers get fresh variety.
- **Fame:** each book has a hidden fame number from Open Library edition counts. The model never sees it, and it isn't used to rank in v0. It's measured in evals; if picks drift famous, we decide then (options: cap famous books per shortlist, or let the "surprising" answer tilt).
- **Changeable:** every number lives in one settings file; the recipe sits behind a shortlist contract; each recommendation records the recipe version.
- **Runs with no profile** (scoring off), keeping a zero-question "surprise" option open (backlog).

### 2. The two views: what the model and the judge see

| | Model's view (choosing) | Judge's view (evals only) |
|---|---|---|
| Sees | A per-request number ("book 17"), title, author, publication year, form, subjects (bestseller-list and award entries removed), our tags, our summary | The reader's profile, and for each pick the source facts: raw description, source subjects, page count, form, audience |
| Never | Popularity, ratings, reader counts, awards, catalog source, real IDs, scores, rank, tag confidence, raw publisher blurbs | Our tags or summaries (otherwise the index grades itself) |

- **Our summary, not the blurb:** blurbs carry fame signals and can contain manipulative text. Our summary is written once at build time by the same call that writes the tags.
- **Picking by number:** code maps numbers back to real books, so picks can't be mistyped and grounding retries go away.
- **Lean on purpose:** every extra field costs time and money on every request. Page count, series position and audience stay out because code enforces them.
- **Equal records:** both versions in any comparison get identical records for their picks. The judge is recalibrated against Grim's blind ratings after its inputs change.
- **Enforced in code:** one view file each, in `lib/engine/` and `evals/judge/`; a "never" test fails if a forbidden field appears in either. Changing a view needs a decision entry and an eval.
- **Rollout:** index fields first, then tags, then the summary, each measured on its own. A field that doesn't help isn't added. Later test: whether subjects become redundant once tags are in.

### 3. Speed

- **No fixed overall goal.** Measure what the reader feels: time to first card and time to all three, as the median and the slowest 1 in 10. Real targets are set from one trace and the pilot; until then, as fast as possible without losing quality.
- **Per-step budget (provisional):** shortlist under 0.5s; the Hardcover tag-mapping model call removed (tags are in the index); card lookups under 0.2s (read from the index); choosing the same or faster (no grounding retries).
- **Waking the database:** at the start of the question flow, only if the pilot shows it matters. The full app can wake it when any tab opens.
- **Card text is split:** book-level text comes from our build-time summary, checked once against the catalog records; only the personal "why it's for you" line is written live, and the choosing step's fit note may cover most of it.
- **Also:** prompt caching for the model's fixed instructions; a timeout per step that fails cleanly; perceived speed through the loading screen and cards appearing one at a time; a model pass after the index (decision 14.6).

### 4. Measuring the gain

A before-and-after eval proves the index picks at least as well as today's engine while being faster or cheaper, before readers are switched onto it.

- **Free measures, on every run (counted by code):** hard rules (must be 100%); speed; cost per recommendation; fame mix against the index average; variety (repeats across test readers); gap rates (not enough books, thin shortlists).
- **The paid judge only at decision points:**
  - Step A (card facts from the index): no paid eval. The golden test plus timing.
  - Step B (shortlist from the index): a shortlist check first, then one full same-day comparison.
  - Steps C1 (tags) and C2 (summary): replay saved shortlists through the choosing step only.
- **Cheaper after the switch:** the index is a frozen snapshot and evals use a fixed seed, so later versions compare against a saved run instead of a same-day control.
- **A cheaper judge** if it matches Grim's blind ratings as well as today's.
- **$25 a month is a ceiling, not a target.** Each paid run gets a cost estimate first, and a one-reader smoke test runs before it.
- **Test readers grow to about 50, built for coverage:** every doorway, every hard rule, and edge cases. About 20 are tuning readers (we study their failures) and about 30 are held out (they only grade, and are never used to build the tag vocabulary or the starter set). Tiers: smoke (1 reader), quick (about 10), full (all held-out readers). Each reader runs under both engines.
- **The pass mark is set before looking:** hard rules 100%; pick quality no worse than today's, within a small margin; a clear win on quality, speed or cost; fame and variety no worse.
- **Honest scoring:** every score carries the reader-set and judge versions, and scores from different versions are never compared directly. Results are reported as ranges, not single numbers.
- **Learning from failures:** past failures become a permanent "never break" set. Friend-test thumbs-downs become new made-up test readers with similar requests (never their real answers).
- **Outside checks:** Grim's blind ratings; hard rules checked in code; precise timings; friends' thumbs and "already read it" taps as a reality check.

### 5. Build order

Each stage is one PR with its check. ⚖️ marks high-stakes stages (they change what the model is sent or how hard rules are enforced), which get the full independent cold review.

| # | Stage | Check |
|---|---|---|
| 0 | Docs: Parts 6 and 7 recorded | Grim's review |
| 0b | Review and safety tooling (decision 11.11): scanners; the reviewer as one versioned file (Anthropic's code-review plugin plus our checklist and output format); `/security-review`; review on every code PR; the escaped-bug log; a baseline review of existing code | Tools running; baseline findings triaged with Grim |
| 1 | Test readers v2 (about 50, versioned, split) | Grim's review; every profile valid |
| 2 | Tag vocabulary v1 and the tag-and-summary prompt, tried on sample books with no database | The 50–100 book tag test against Hardcover moods, plus Grim's blind read |
| **Gate 1** | **Are tags worth it?** | Pass threshold set in the stage 2 PR; if it fails, fix the vocabulary or prompt before building infrastructure |
| 3 | Database foundation: Neon, the books and reader-data contracts with test stand-ins, setup scripts, read-only and no-delete logins | Offline contract tests; the "can't delete" test; wake-up and query times from Vercel |
| 4 | Pipeline and 500-book pilot: import, tags, summaries, cover links with sources, fame numbers | Bytes and dollars per book; cover counts by source; a 20-cover spot-check |
| 4b | Thin end-to-end run on pilot books, behind a setting, not judged for quality | It works end to end; real timings |
| **Gate 2** | **Do the numbers hold?** | Size, cost and speed fit the design; enough real covers; if not, adjust before the full load |
| 5 | The v0 starter set (Part 7) | Part 7's checks |
| 6 | Step A: card facts from the index | Golden test plus timing |
| 7 ⚖️ | The two views, picking by number, the "never" test (today's fields only) | The "never" test; golden diff reviewed; judge recalibrated |
| 8 ⚖️ | Step B: the shortlist from the index, behind a setting; saved shortlists; free measures and fame in the scorecard; fixed seed | Shortlist check, then the full comparison against the pass mark |
| **Gate 3** | **Does the index pick well?** | The pass mark; if it fails, the shortlist check shows whether search or choosing failed |
| 9 | Speed basics: prompt caching, per-step timeouts | Timing; golden diff reviewed |
| 10 ⚖️ | Step C1: the replay tool, and tags in the model's view | Replay against the pass mark |
| 11 ⚖️ | Step C2: the summary, and split card text | Replay; honest-cards check |
| **Gate 4** | **Did we build what we designed?** | A conformance checklist from Parts 1–6; every difference fixed or recorded as a decision |
| 12 | Switch over: the index engine becomes the default; the old search path removed; `CLAUDE.md` rules updated | Checks green; one final full eval |

- **Alongside, not blocking:** the cover track (the storage bake-off, card-files and image-engine contracts, the enhancer, and the bulk cover download after stage 5).
- **Needed from Grim:** one engine trace before stage 8 (to set speed targets and the real cost per eval reader); Part 7 before stage 5.
- **Every stage:**
  - **Definition of done:** the check passes, docs are updated, and any change from the design has a decision entry.
  - **An undo:** each engine change ships behind a setting.
  - **Data checks:** the pipeline refuses bad data (missing descriptions, impossible page counts, tags outside the vocabulary, duplicates).
  - **Snapshots:** the previous index snapshot is kept.
  - **A time box:** if a stage overruns, stop and re-plan.
  - **Gate results** are written up in the progress or eval log.

## Still open

- Part 7: which books go in the v0 starter set, including whether children's books are in v0 (the taste profile already offers "written for children").
- Live monitoring in v0 is proposed in the plan, not yet decided.

## Pro check

- **Added:** authors as their own records; old-ID pointers; reading each source's terms instead of assuming; the capture-now list (what was shown, version stamps, candidates, failures, test flag); deletion and a tested restore.
- **Changed:** Google Books moved out of the index (decision 6.14 had it in); Hardcover moods became a second opinion, not a dependency; thumbs-down reasons reshaped to what a tester can judge at the reveal.
- **Ruled out:** warehouses and streaming tools; a feedback dashboard; popularity-based rarity; the academic-only Goodreads dataset; a live-search fallback in v0 (decision 6.21); deleting single events.
- **Added Nov 17:** least privilege for deletion (the app can't delete); a daily cap across all visitors; the flexible event field and capture-when-unsure rule; corrections as new events.
- **Added Nov 20:** separating engine from host; a development branch so evals never touch real data; a test stand-in for every contract; one region; recorded sources and recipes for every cover and variant; files never overwritten; a kill switch; backup targets, encrypted reader exports and a written restore checklist.
- **Added Nov 22:** measuring the shortlist separately from picks; saved shortlists for replay; fame tracking; view files with a "never" test; picking by number; repeatable eval randomness; versioned exams and ranges; a "never break" set; stage gates; a thin end-to-end run; undo settings, data checks and kept snapshots; a reviewer on every code PR.
- **Outside checks planned:** audience-label spot-check; 20-book tag test against Hardcover moods; the eval with and without tags; a delete-command test (create a visitor, add events, delete, find zero rows); the not-enough-books rate in evals and the friend test.
