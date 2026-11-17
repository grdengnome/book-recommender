# Book index design

> **Status:** Draft · Parts 1–3 and the reader-data rules are agreed (Nov 16, 2026). Parts 4–7 are still open. Nothing here is built yet.

The book index is our own database of books: the engine's backbone (decision 6.14). It is designed for the whole product (collection, rankings, reading stats, year summaries, premium), but v0 builds only a starter slice. This doc is the agreed design so far. The reasons are in [decisions](../decisions.md) 6.17–6.20 and 10.8–10.9.

## Where the design stands

| Part | Status |
|---|---|
| 1. What a book record holds | Agreed |
| 2. Sources and their terms | Agreed |
| 3. Our own layer: tags and search by meaning | Agreed |
| 4. Reader data | Mostly agreed (below); confirm next session |
| 5. Storage, staged build and refresh | Structure agreed; build stages and provider check open |
| 6. How the engine and the judge use the index | Not started |
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

## Part 4: reader data (mostly agreed)

**Five data areas:** books · recommendations (profile, books shown, engine version) · reader actions as dated events · rankings (every pairwise comparison) · readers and collection (after v0; needs sign-in).

**Anonymous visitor ID.** A random ID kept in a cookie. We store only the ID: no name, email, IP address or fingerprint. When accounts exist, a visitor ID is linked to a reader with consent; past events are not rewritten.

**v0 feedback shape:** thumbs on each pick · on a thumbs-down, optional reveal-time reasons ("already read it", "not my mood", "doesn't sound like me", "too long or heavy") · one optional open box at the end, temporary, with a note not to include personal details · three or four watched sessions with friends. Reasons are used for diagnosis only in v0; they don't change tags or picks. Typed feedback is data, never instructions, and goes through the input guard.

**Reading the data:** a plain report from one command, not a dashboard. Rejected recommendations can become new eval readers, paraphrased (real answers never enter the repo).

## Part 5: storage (structure agreed)

One Postgres database, shared with PR 6's data store. Neon's free tier is the first candidate; its current limits are to be confirmed before we commit.

```
BOOK SIDE (changes slowly, read constantly)
works ──< editions ──< covers
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

**Also for v0:** an event dictionary (one page: every event type and what it means) · one command that deletes everything tied to a visitor ID · one tested backup restore before friends use the app.

**Backfilling.** New data that can be derived from what we kept, or that is a fact about a book, can be added to old records. Data only observable in the moment cannot; old rows get "unknown", never a guess. Backfilled values are labelled as such.

**Size.** The full structure exists from day one; the book count starts small. Rough estimate: 10–15 KB per book all-in, so 20,000–30,000 books fit a 1 GB free tier. The Open Library download is processed offline and only the chosen books are loaded.

## Still open

- Part 4: confirm.
- Part 5: build stages, refresh schedule, provider limits, cover storage choice.
- Part 6: how the engine and judge use the index, including what the model may see (today's rule is title, author and subjects only), and how we'll know the index helps.
- Part 7: which books go in the v0 starter set.

## Pro check

- **Added:** authors as their own records; old-ID pointers; reading each source's terms instead of assuming; the capture-now list (what was shown, version stamps, candidates, failures, test flag); deletion and a tested restore.
- **Changed:** Google Books moved out of the index (decision 6.14 had it in); Hardcover moods became a second opinion, not a dependency; thumbs-down reasons reshaped to what a tester can judge at the reveal.
- **Ruled out:** warehouses and streaming tools; a feedback dashboard; popularity-based rarity; the academic-only Goodreads dataset.
- **Outside checks planned:** audience-label spot-check; 20-book tag test against Hardcover moods; the eval with and without tags.
