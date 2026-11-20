# Legal and IP register

> **Status:** Started Nov 20, 2026. A working register, not legal advice: every item here goes to an IP lawyer before public launch.

One place for every legal and intellectual-property question the app raises. Each entry has the risk, the rule we follow now, the fallbacks if we're challenged, and the questions for a lawyer. Technical details live in the design docs and link here.

**Our stance (Grim, Nov 20):** start top-down with the most engaging product we can make inside the rules, with fallbacks ready that get less and less risky. Legal pressure is most likely only once the app has adoption and volume, "a semi-good problem," but the plan is prepared in advance.

## 1. Book covers

**Why it matters:** covers are central to the cards, and to what makes the app distinctive. Covers are copyrighted, usually by the publisher or the artist, and a source letting us download a cover (Open Library, for example) is not the publisher licensing it.

**Risk depends on what we do with a cover:**

| Use | Risk | Why |
|---|---|---|
| Showing a cover to identify a book we recommend | Lowest | Retailers, libraries and review sites all do it, and it helps sell the book |
| Storing our own copies | Medium | Copying is a separate right; safest from a source whose terms allow it |
| Altering covers (upscaling, restyling, effects painted on) | Highest | Creates derivative works, the copyright owner's exclusive right |
| Selling anything that features a cover | Highest | Commercial use against the owner's market undercuts any fair-use argument |

The closest precedent, *Perfect 10 v. Amazon* (9th Cir. 2007), found thumbnail images fair use in an image search engine because the use was transformative. A recommendation service is a different use, so this is helpful, not a guarantee.

**Rules we follow now:**
- **The cover is never altered.** Our art goes around it (frames, foil and holographic edges, backgrounds, rarity emblems), never on it. Effects stay around the cover's edges until a lawyer says otherwise.
- **Every card works without a cover,** using our own art, so a takedown is a non-event.
- **Every cover records where it came from:** source, publisher, date, terms ([book index design, Part 5](../engineering/book-index-design.md)).
- **A kill switch:** hide covers for one book, one publisher, or everything, instantly, with no redeploy.
- **A visible takedown contact,** with a quick response.
- **Credit and a link back** to the source, which Open Library asks for.
- **Sources' own rules are respected:** Open Library's Covers API is for display on public websites, not bulk download or a high-traffic backend; bulk covers come from its archive.org files or by asking Open Library.

**Risk ladder:** we start at level 1 and step down only when a trigger happens.

| Level | What readers see | Trigger |
|---|---|---|
| 1. Full experience | Untouched cover at the highest quality available, inside rich card art | Default |
| 2. Original-quality cover | Same card art, no upscaled covers | A lawyer advises that upscaling counts as alteration |
| 3. Smaller cover | The cover is a small identifying image; our art dominates | Pressure from several publishers, or legal advice |
| 4. No cover | Our own art for the book (themed emblem plus title typography) | A takedown request (that publisher only, instantly), or worst case, everyone |

**If we receive a cease and desist:** hide that publisher's covers with the kill switch the same day (level 4 for them), reply through the takedown contact, record it here, and bring in the lawyer.

**Long-term goal:** licensed high-resolution covers through publisher partnerships, pitched on what we offer them: readers sent to obscure and backlist titles that are hard to promote. Other licensed routes to check when the time comes: publisher and distributor data feeds, and retailer or affiliate programs whose terms allow cover display.

**Questions for the lawyer:**
1. Is showing covers on recommendation cards defensible, and does adding collectible and rarity elements change that?
2. Does faithful upscaling count as creating a derivative work?
3. Can we store copies from Open Library or archive.org, given that their permission isn't the publisher's?
4. Do visual effects layered over a cover count as altering it?
5. What's the safest way to make money, given that cards feature covers?

## 2. Other items to track

| Item | Status |
|---|---|
| Privacy note and terms of use | A short privacy note is in v0 scope; full terms before public launch |
| App name and trademark | "The book recommender" is the generic name until branding is final (decision 1.13); a trademark search comes with the final name |
| Data-source terms (Open Library, Hardcover, Google Books) | Read in Part 2 of the book index design; recheck before public launch and whenever usage grows |
| Ownership of AI-generated art (illustrations, enhanced covers, card art) | Open: depends on each tool's terms and current law; check per tool in the image bake-off and with the lawyer |
