# Question flow v2: design

> **Status:** Living · Draft rev 2 (Oct 24, 2026), with the Oct 25 and Oct 28 changes marked below. Last updated Nov 4, 2026.

*Follows [decision 2.20](../../decisions.md) (new question core) and the [principles](./principles.md). Evidence: [question core audit](../../research/question-core-audit-2026-10-22.md). Replaces the backbone in [spec §4a](../spec.md) and [question-bank.md](./question-bank.md), which are pending a rewrite. A themed café prototype of this flow was built and reviewed over Oct 25–26.*

## 1. The bar
The question flow is the front door of the Discover tab and a key reason people come back. It must (1) understand what the reader really wants right now, (2) feel like play, with every question a small, satisfying moment, and (3) be quick: 4–7 taps, roughly 60–90 seconds. It must also **stay fresh visit after visit**: readers should rarely see the same question twice.

Every question must pass four tests:
- **Easy:** answerable by instinct in under about 5 seconds.
- **Vivid:** uses scenes, images, covers, emoji or themed metaphors, never abstract form words ("Preferred tone?").
- **Rewarding:** each answer gets a visible response (a small animation, the worm reacts).
- **Varied:** never the same format twice in a row.

Plus: **never corny.** Wording and content must feel genuinely intriguing to a reader, not cute for its own sake.

*Oct 25 changes: the "just show me" shortcut was removed, and the live taste line was removed from question screens (see §6).*

## 2. The taste profile
What the engine fills in while the reader answers. Each slot is **empty / partial / clear**. *Nov 4: the exact slots, values and firmness the engine receives are now specified in [taste profile](./taste-profile.md) (decision 2.24), which adds doorway, ingredients, published, standalone or series, moment, category and audience.*

**Core: what you want (most questions go here)**
1. **Starting point:** a book, show or film loved · a feeling · a world or topic · surprise me.
2. **Mood and tone right now, with intensity** ("a little eerie" vs "properly unsettling").
3. **Appeal factors** (the readers'-advisory framework librarians use to match people to books):
   - **Pace:** page-turner ↔ slow and immersive
   - **Character ↔ plot:** "I need to love the people" ↔ "I need things to happen"
   - **Writing style:** spare and simple · lush and poetic · sharp and witty
   - **Setting / world:** a vivid place, an era, an invented world, here and now
   - **Ideas:** make me think ↔ let me escape
   - **Ending feel:** happy · bittersweet · gut-punch · open
4. **Familiar ↔ surprising:** learned quietly (cover game and other signals), never asked directly.

**Light extras (never a dedicated big question)**
- **Length:** quick optional tap.
- **Avoid:** picked up via "Nope" signals and an optional "Nope shelf". Enforced as hard rules by the choosing step. Low priority for v0.
- **Occasion / who it's for:** no question; extracted from typed text if mentioned ("gift for my dad", "long flight").

**Lasting vs today.** Appeal factors are lasting taste; mood is today's intent. Once accounts exist, Squirmly remembers appeal factors, so returning readers get a 2–3 tap flow ("Same reader, new mood?") and the You tab can show them ("You love slow, character-driven books with lush writing").

**Search vs choose (engine note).** Some slots shape *what gets searched* (starting point, topic or setting, mood or genre); others shape *what gets chosen* from the table (pace, character/plot, style, ideas, ending, familiar/surprising, avoid). The catalogs can't search "lush prose", but the choosing step can judge it, so only search-shaping answers need catalog mappings.

## 3. How the bank stays fresh
Separate **formats** (the interaction: duel, dial, postcards…) from **content** (the specific scenes, emoji sets, lines, postcards, metaphors).
- **Formats:** a growing set, around 15–20 for the full product, each themed in all five skins. Formats are expensive (design plus motion per theme), so they grow steadily. v0 ships a lite set.
- **Content:** many sets per format: dozens of scene pairs, postcard sets, speed metaphors and so on. Content is cheap to add (text, illustration, mapping test), so this is where variety comes from.
- **Several questions per slot:** every slot has multiple formats that can fill it (mood: Scene duel, Emoji spell, Weather report, Soundtrack, Colour swatch…), so the same slot feels different each visit.
- **Rotation rules:** don't repeat a content item a reader saw in their last ~5 sessions (tracked per device before accounts, per account after); don't repeat a format within a session; vary by theme.
- **Seasonal refresh:** new content drops alongside seasonal card sets.
- **Quality gate:** every new item passes the four tests, "never corny" and a tested mapping before it ships. AI can help draft content; humans curate.
- **Measure and retire:** items with high drop-off, slow answers or no effect on picks get retired; winners get variants.

## 4. Flow shape
1. **Doorways:** "What are you after?" (opening, always).
2. **Adaptive middle:** 2–5 questions chosen by the next-question rule.
3. **Loading** with a "Looking for" line, which turns into the reveal by itself.
4. **Reveal**, with **"Not quite? Try again"** as the correction path. *(Oct 28: replaces the editable "Here's what I'm hearing" card before the reveal.)*

### Next-question rule
After each answer, update the profile, then:
1. **Infer before asking.** A starting answer often fills other slots (anchor *Gone Girl* → fast pace, plot-driven, dark, twisty). Inferred slots are marked partial and may be confirmed with a quick "Right?" rather than asked.
2. **Ask about the most valuable unclear slot**, in priority order: mood → the two most uncertain appeal factors → familiar/surprising → length.
3. **Clarify contradictions** immediately (anchor *Blood Meridian* + mood "cozy" → "Which wins tonight?").
4. **Stop** when the starting point and mood are clear and at least two appeal factors are partial or clear, or at 7 taps.
5. **Rotate formats and content** per §3.
6. **Typed answers** go through one small model call that extracts slot values (mood, setting, occasion, avoid, anchors), so a rich sentence can fill several slots at once.

## 5. Question bank v2: formats
Each format is themed in all five skins (Café, Mystery, Fantasy, Superhero, Sci-fi). The slot each fills is in brackets.

- **A. Doorways** [starting point]: four illustrated doors. Options: a book/show/film I loved · a feeling · a world or topic · surprise me.
- **B. Anchor search** [starting point]: search for a favourite; picked anchors stack as small covers. Optional follow-up "What hooked you?" (the people · the world · the twists · the writing · the feeling). *v0: books only, one required, up to three (decision 2.23).*
- **C. Scene duel** [mood]: two illustrated scenes, pick one; 2–3 rounds narrow the mood.
- **D. Emoji spell** [mood]: pick up to 3 emoji to "cast" tonight's mood; the worm reads it back in words.
- **E. Intensity dial** [mood strength]: "a hint" → "wreck me", with themed live feedback.
- **F. Pick your speed** [pace]: themed metaphors (Café: espresso shot / slow pour-over).
- **G. People or plot?** [character ↔ plot], with "Both, please".
- **H. First-line test** [writing style]: two short opening lines in different styles: "Which would you keep reading?" Must be genuinely intriguing, never corny. Uses original lines or public-domain openings only (modern opening lines are copyrighted).
- **I. Postcards** [setting / world]: pick up to 2 places or eras.
- **J. Think or escape** [ideas].
- **K. Judge a book by its cover** [familiar ↔ surprising + avoid]: three real covers, Yes / Seen it / Nope. An occasional option, not core; best once a cover database exists.
- **L. Finish the sentence** [emotional effect]: "I want to finish this book feeling ___".
- **M. How long's the trip?** [length, optional]: four themed bands, each showing its page range (quick: under about 200 pages · short: about 200–300 · medium: about 300–500 · long: 500+), so the reader picks knowing what each means ([decision 2.25](../../decisions.md)). The ranges come from the same slot data the engine enforces.
- **N. The Nope shelf** [avoid, optional].
- **O. Clarifier** [contradictions]: "*Blood Meridian*, but cozy? Which wins tonight?"
- **Q. Pack your bag** [setting / mood / genre]: drag 3 items into a themed bag.
- **R. Weather report** [mood]: tap a forecast (fog, thunderstorm, heatwave, first snow, golden hour, autumn leaves).
- **S. Soundtrack** [mood / pace]: pick the soundtrack for your next read.
- **T. The ending wheel** [ending feel].
- **U. Hot take** [character / style / ideas]: agree or disagree with a playful book opinion.
- **V. Choose your path** [mood / pace / setting]: a two-step micro-story. Later addition.
- **W. Colour swatch** [mood].
- **X. Reading hour** [pace / mood]: morning coffee · commute · lazy Sunday · 2 a.m.
- **Y. Rapid fire** [several appeal factors]: words flash briefly; tap the ones that pull you.

*(Format P, the editable read-back card, was retired on Oct 28; see §4.)*

## 6. Rewards and reasons to come back
- **The worm reacts** to answers (hides under a blanket for eerie, grabs a cape for thrilling).
- *Oct 25: the live taste line on question screens and the shareable "tonight's reader card" were dropped. The favourites screen shows "What I'm picking up"; the loading screen shows "Looking for".*
- **Returning readers** (with accounts): remembered appeal factors → "Same reader, new mood?" 2–3 tap flow.
- **Question of the day** (later, with accounts): one playful daily question, as a reason to open the app between books and to sharpen the taste profile. Only worth it if as good as the best formats.

## 7. Example flows
- **Reader A, types "like *Gone Girl* but less bleak, for a flight":** Doorway → typed text fills anchor, mood, occasion and inferred pace → Intensity dial → Ending wheel → loading. About 4 taps.
- **Reader B, "Surprise me":** Doorway → Weather report → Intensity dial → Rapid fire → Pack your bag → loading. About 5–6 taps.
- **Reader C, no favourite, in a reading slump:** Doorway (a feeling) → Emoji spell → Finish the sentence → How long's the trip → People or plot → loading. About 5 taps.
- **Reader D, returning:** "Same reader, new mood?" → Scene duel → Intensity dial → loading. About 3 taps.

## 8. Engine mapping and testing
- Every answer maps to slot values. Search-shaping answers need tested catalog mappings (gripping, unsettling and funny map well to Open Library; cozy, quiet, dark and romantic need Hardcover tags or tested subject sets). Choose-shaping answers become clear instructions to the choosing step.
- Content items ship only once their mapping is tested.
- **Simulated readers:** 15–20 personas run through the adaptive flow offline; measure taps, profile accuracy and pick fit.
- **Live:** drop-off and time per question, pick impact per question, A/B wording; retire items that don't earn their place.

## 9. Open
- Whether 3–4 tap paths (when three strong favourites are given) feel too short.
- Which formats make the v0 lite set. The café prototype includes Doorways, Anchor search, Scene duel, Weather report, Intensity dial, Pick your speed, People or plot, Think or escape and Pack your bag.
