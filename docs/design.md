# Design System

*How Worm looks and why. Decisions behind it are in [`decisions.md`](./decisions.md) §13; what each screen does is in [`spec.md`](./spec.md) §4. Mockups live on the design canvas (private link, held by the owner). Last updated October 4, 2026.*

---

## 1. Brief

- **Product name (working):** Worm / The Worm.
- **For:** readers first. The book nerd who cares about the whole presentation of a book, not just the story.
- **Feeling:** Epic, Clean, Colorful.
- **The idea:** getting a book should feel like an event, in a world built from great book covers.

## 2. Principles

1. **Clean, never quiet.** Few words and one idea per screen, but every screen has personality. Regular screens run at about 7–8 out of 10 in energy; the reveal is the 10.
2. **Covers are the art.** Book covers dominate wherever a book appears.
3. **One world, varied screens.** The app opens in a different theme each visit. Themes share one structure, so it always feels like the same product. The Café Bookshop is the home theme behind them all (see §5).
4. **Every part of a theme carries the theme.** Fonts, button shapes, input fields, cards, and wording all change with the theme, not just colors.
5. **Storytelling framing.** Screens read like the opening of a story in that theme's genre.
6. **The worm appears everywhere, subtly.** One small worm per key screen, dressed for the theme (see §6).

**Avoid:** busy or wordy screens, saturation with no hierarchy, plain spreadsheet-style displays, generic stock illustration.

## 3. Shared structure (identical in every theme)

Themes never change what is on a screen or where it sits. They change how it looks.

**Question screen, top to bottom:**
1. Header: wordmark left. No question counter, because the number of questions varies.
2. Scene: a themed illustration.
3. Question: one sentence, in the theme's voice. It is the largest text on the screen, with one key phrase in the accent colour and a quieter lead-in line above.
4. Title field with a label.
5. Up to two suggestions (cover thumbnail, title, author), plus "use what I typed."
6. One primary button, pinned to the bottom.

**Reveal screen (one book per screen), top to bottom:**
1. Header: "one of three" marker.
2. Cover: about 265 × 400 on a 390-wide phone, the largest element on the screen.
3. Title, author, and a one-line "why it's for you."
4. Two buttons: more detail (secondary), next pick (primary).

**Follow-up question screen:** same as the question screen, with a shorter scene and up to four tappable answers plus a free-text "say it your way" field in place of the title field.

**Loading screen, top to bottom:**
1. Header.
2. Scene (the richest scene in the theme; this is the longest wait).
3. The reflect-back of what the user asked for, shown as an object in the scene (Café Bookshop: an order ticket hanging from the shelf).
4. Headline and an honest wait estimate ("About a minute or two").
5. One author fact, unboxed, with the author's name.
6. Progress indicator.
Each section gets clear space around it so nothing reads as a wall of text.

**Rejection read-back screen:** question ("Did I hear you right?"), the taste summary on the same object used on the loading screen, and two buttons (fix it, look again). The first rejection step reuses the follow-up question layout.

**Error screen:** scene, headline, one plain sentence on what went wrong, and two buttons (start over, try again).

**Attention signal (rejection and error screens):** these screens stay on brand but signal that something needs the user. Each theme has one attention colour used only here (Café Bookshop: terracotta `#E8744B`), on the highlighted phrase, a stripe on the question card, and a small header chip ("One more thing", "Hiccup"). The scene's lighting also changes: dimmed for rejection, off for errors. Fonts do not change. Colour is never the only signal; the chip wording and scene carry it too.

**Reveal follow-ons:** an "all three" screen with the covers together, and a book detail screen (cover, why it's for you, the story, the non-obvious angle, "find this book," and the three feedback actions).

**Fixed rules:**
- Phone first: designed at 390 × 844. Tap targets at least 44px.
- Text contrast at least 4.5:1 (3:1 for text 24px and larger).
- Real buttons, links, and labeled inputs, so the app works with a keyboard and screen readers.
- The meaning of every question and button is the same in every theme; only the wording's flavor changes. If themed wording ever confuses, plain wording wins.

## 4. The five launch themes

Each theme is light or dark, whichever suits it. A user-facing light/dark toggle is deferred.

| | Café Bookshop | Fantasy | Superhero | Mystery | Sci-fi |
|---|---|---|---|---|---|
| **Concept** | A cozy bookstore café on a rainy day | An illuminated manuscript | A comic book | Film noir | A ship's console |
| **Mode** | Light question, dark reveal | Light page, dark reveal | Light | Dark | Dark |
| **Display font** | Barlow Condensed | Uncial Antiqua | Bangers | Limelight | Orbitron |
| **Body font** | Courier Prime | Alegreya | Comic Neue | Special Elite | Share Tech Mono |
| **Ground** | Whitewashed brick `#E9E2D4`, dark brick `#5A2A1C`, walnut `#4A2C1A` | Parchment `#F1E3C0`, night `#2A1B4A` | Yellow `#FFE14A`, cyan `#19B5E6` | Near-black `#0B0D12` | Deep navy `#060B14` |
| **Ink** | `#171311` on light, `#F3EAD8` on dark | `#2B1A12` | `#111111` | `#D9D4C7` | `#D8F6FA` |
| **Accents** | Amber glow `#F2A23A`, fern `#4F7F45`, teal `#3E7C7A` | Crimson `#9B1C2E`, gold `#F2C230` | Red `#C91D22`, green `#3DBE6C` | Amber `#E8B04A` only | Orange `#FF6B2C`, cyan `#36D6E7` |
| **Scene** | Walnut shelves on iron brackets, brick wall, rainy window, lamp, jars, mugs, ferns, comic covers as colour pops | Castle and moon in an arched window | City skyline, searchlight signal | Rainy street, lamppost, figure in a hat | Ringed planet, rocket, stars |
| **Question container** | Black poster card, cream type | Illuminated capital and running text | Speech bubble in a panel | Title-card text over the scene | "Incoming transmission" panel, cut corners |
| **Title field** | Cream label, typewriter text | Ink underline, italic | Thick-outlined box | Thin underline, typewriter | Terminal prompt `>` |
| **Primary button** | Walnut price tag | Ribbon banner | Outlined block, hard shadow | Thin double-line frame | Angled key |
| **Reveal treatment** | Cover on a walnut shelf, amber glow on dark brick, jar-label card | Cover in a gold arch, title on a ribbon | Splash page with a burst | Cover lit from above, blind shadows, rain | Cover in targeting brackets before a planet |
| **Voice** | "Rainy day. Pull up a chair." / "Turn the page" | "Once upon a time" / "Turn the page" | "Meanwhile, in the city..." / "To the rescue!" | "It was a dark and stormy night." / "Follow the lead" | "Incoming transmission" / "Launch" |

**Texture rules per theme:**
- **Café Bookshop:** low warm light, vintage browns, brick texture, 2px ink outlines, price-tag and jar-label shapes, organized clutter of small objects. Colour pops come only from covers.
- **Fantasy:** double-rule page border with corner jewels, arches, diamond bullets.
- **Superhero:** 4px black outlines, halftone dots, caption boxes, bursts.
- **Mystery:** near-monochrome, one amber accent, thin lines, rain. No stamps, tags, or pop-art devices.
- **Sci-fi:** scanlines, cut-corner panels, bracket corners, segmented progress.

## 5. Theme rotation

- A theme is picked at random on each visit and stays for the whole session.
- Themes are decoration: they don't imply the genre of the recommendations.
- Later: skin each reveal to the genre of that pick (needs a genre label per pick from the engine).
- **Café Bookshop is the home theme.** Screens outside a themed session (settings, profile, "How it works", and errors that happen outside a session) use it. Errors inside a themed session use that session's theme. It should support the other themes, not overshadow them. Open: whether it also stays in the random rotation.
- Later: shelf items that change to reflect the reader (for example, covers from their last session). Needs the app to remember a visitor, so not v0.
- Later themes: horror, historical, romance. Horror was held back because it's the most likely to feel wrong on the wrong request.

## 6. The worm

A small worm appears on key screens in every theme, as the brand's through-line. It is a supporting detail, never the focus.

- **Café Bookshop:** peeking out of a coffee mug.
- **Superhero:** flying over the skyline in a red cape.
- **Fantasy:** on the hill beside the castle, in a wizard's hat.
- **Mystery:** on the wet street near the lamppost, in a fedora.
- **Sci-fi:** floating beside the rocket, in a bubble helmet.

So far the worm appears on each theme's question screen (and on all eight Café Bookshop screens). Its place on the other screens is still to design.

Rules: one worm per screen at most; drawn as a single thick wavy line with an eye; costumed with one prop per theme; never on the book cover itself.

## 7. Status

| Screen | Café Bookshop | Fantasy | Superhero | Mystery | Sci-fi |
|---|---|---|---|---|---|
| Question | Mocked | Mocked | Mocked | Mocked | Mocked |
| Follow-up question | Mocked | To do | To do | To do | To do |
| Loading | Mocked | To do | To do | To do | To do |
| Reveal, one book | Mocked | Mocked | Mocked | Mocked | Mocked |
| All three | Mocked | To do | To do | To do | To do |
| Book detail | Mocked | To do | To do | To do | To do |
| Rejection read-back | Mocked | To do | To do | To do | To do |
| Error | Mocked | To do | To do | To do | To do |

Mockups use placeholder covers and bracketed placeholder text. Real covers come from the catalogs (spec §4c). Motion is not yet designed. Priorities when it is: the reveal, a satisfying "magical" answer-button press, and staged fade-ins (question before answers; loading sections one at a time) to guide the eye.

## 8. Building it

- Build each screen once against the shared structure. A theme is a set of values (fonts, colors, shapes, scene art, wording) applied to that structure.
- Adding a theme must not require changing any screen's layout.
- Fonts above are all on Google Fonts.
