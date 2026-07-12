## Prompt v2 — removed named calibration examples, softened bestseller stance, clarified taste-description categories (2026-07-08)

_Note: while running this batch, discovered `max_tokens: 1500` in `route.ts` was letting extended-thinking tokens crowd out the actual response, causing truncated/empty output on 6 of 10 cases. Bumped to `max_tokens: 4000` (approved by user) before re-running; results below are from the fixed config, not the prompt change itself._

### Case 1 — Rich, clear input

**Input:**
> My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book.

**Output:**

1. **So Long, See You Tomorrow** — William Maxwell
   - why: A slim but devastating meditation on guilt and unspoken grief in rural Illinois, told with the same restraint Ishiguro uses to let emotion seep through the cracks rather than spill over.
   - nonObvious: Often overshadowed by louder American classics, but its quiet, elliptical narration of buried remorse is a closer emotional cousin to Ishiguro than most 'sad literary fiction' picks.
2. **The Emigrants** — W.G. Sebald
   - why: Four interlocking portraits of displaced lives told in hushed, melancholic prose that circles loss and memory without ever naming the pain directly — ideal for a reader who wants to sit slowly with what's left unsaid.
   - nonObvious: Sebald is frequently filed under 'experimental,' but this book's patient, character-focused sorrow makes it far more accessible and emotionally resonant than its reputation suggests.
3. **Independent People** — Halldór Laxness
   - why: A sprawling, immersive portrait of one stubborn Icelandic farmer's quiet, self-denying pride — the tragedy builds through accumulated restraint rather than dramatic incident, much like Stevens's repressed devotion in Remains of the Day.
   - nonObvious: Its Nobel pedigree makes it seem 'important' rather than personal, but underneath the sagas and sheep is an intimate, slow-burn character study of dignity mistaken for stubbornness.

### Case 2 — Anti-mainstream profile

**Input:**
> There's a novel I read a few years back — quiet, character-driven, nothing anyone around me had heard of — and it turned out to be one of the best books I've ever read. It completely surprised me, because nothing about its low profile suggested it would hit that hard. I've been recommending it to people unprompted ever since. I want more like that: no bestsellers, no 'if you liked X' consensus picks — just books that are genuinely great regardless of how well-known they are.

**Output:**

1. **A Month in the Country** — J.L. Carr
   - why: A short, deeply interior novel about a shell-shocked WWI veteran restoring a church mural over one English summer — nothing 'happens' in the plot sense, yet the quiet accumulation of small human moments lands with real emotional force, exactly the kind of low-key sleeper that surprises readers who go in expecting little.
   - nonObvious: It was Booker-shortlisted decades ago but has never broken into mainstream reading culture, so it rewards discovery rather than confirming a familiar 'if you liked X' chain.
2. **Family Lexicon** — Natalia Ginzburg
   - why: A portrait of an Italian family told almost entirely through their private phrases and habits — spare, understated, and devastating in how it builds character through accumulation rather than drama, which suits a reader who values quiet, character-first storytelling over plot mechanics.
   - nonObvious: Ginzburg is revered among close readers of Italian literature but rarely surfaces in general 'best books' conversations, so it sidesteps both bestseller lists and the usual counter-canon suspects.
3. **So Long, See You Tomorrow** — William Maxwell
   - why: A slim novel about a childhood friendship shattered by a rural murder, narrated decades later through the haze of memory and guilt — it's patient, restrained, and quietly devastating in the same register as a book you'd press into someone's hands unprompted.
   - nonObvious: It won the National Book Award, yet almost no general reader has heard of it today, making it a genuinely under-recognized rather than fashionably obscure pick.

### Case 3 — Vague input

**Input:**
> Just something good to read.

**Caveat:** v0 has no adaptive-questioning UI yet (per CLAUDE.md, that's intentionally deferred), so this is a single-shot approximation of the vague-input case rather than a real test of the follow-up-question trigger.

**Output:**

1. **Convenience Store Woman** — Sayaka Murata
   - why: A short, sharp, quietly funny novel about a woman who finds meaning in a life everyone else calls strange — the kind of book that reframes something ordinary until you can't look at it the same way again.
   - nonObvious: It's beloved in translation circles but rarely the first title people reach for when asked to name 'a good book,' despite being an easy, unforgettable read.
2. **Stoner** — John Williams
   - why: A quiet, devastating story of an unremarkable academic life, written with such precision that its restraint becomes the source of its power — the kind of book readers press into others' hands afterward.
   - nonObvious: Long overlooked after its original 1965 publication, it's a genuine masterpiece that never became a household name despite deserving one.
3. **Piranesi** — Susanna Clarke
   - why: An atmospheric, puzzle-box of a novel set in an endless, strange house — immersive and strange in the best way, rewarding patient, curious readers with real emotional payoff.
   - nonObvious: Its author is known mainly for a much longer, more famous book, so this slimmer, stranger work often gets skipped even though it's arguably the better entry point.

### Case 4 — Explicit anti-mainstream demand

**Input:**
> I want book recommendations, but nothing everyone's already read. I'm tired of every list recommending the same five books.

**Output:**

1. **The Passion According to G.H.** — Clarice Lispector
   - why: A hypnotic, philosophically dense novel about a woman's crisis after killing a cockroach — for readers who want fiction that unsettles and rewires how you see the mundane, not just entertains.
   - nonObvious: Lispector is revered among writers but rarely shows up on general 'best books' lists, since her work resists easy summary or plot-driven hype.
2. **The Employees** — Olga Ravn
   - why: A slim, eerie novel told through worker testimonies aboard a spaceship, blurring human and machine — great if you want something formally inventive and quietly devastating rather than a conventional narrative.
   - nonObvious: It was Booker International shortlisted but never broke into mainstream buzz, likely because its fragmented, almost clinical structure isn't 'easy' to market or skim.
3. **The Twenty Days of Turin** — Giorgio De Maria
   - why: An Italian cult horror novel from the 1970s about a city plagued by collective madness and a sinister archive — perfect if you want atmosphere and dread over jump-scares, with real literary teeth.
   - nonObvious: It was out of print for decades and only rediscovered/translated recently, so it never got folded into the standard horror or literary-fiction canon lists.

### Case 5 — Contradictory signals

**Input:**
> My favorite book of all time is 'War and Peace' — I loved the sprawling scope and how deeply it got into every character's inner life. But right now I want something light and quick to read, nothing heavy or slow.

**Output:**

1. **Cold Comfort Farm** — Stella Gibbons
   - why: You loved War and Peace's sprawling cast and rich inner lives — this gives you a similarly vivid ensemble of eccentric characters, but compressed into a fast, comic romp that pokes fun at exactly the kind of brooding, doom-laden family sagas you're taking a break from.
   - nonObvious: It's often shelved as a minor English comedy, but it's a genuinely sharp, tightly constructed character piece — not a default 'funny book' pick.
2. **Convenience Store Woman** — Sayaka Murata
   - why: It delivers the kind of close, unflinching interior access to a single mind that you valued in Tolstoy's characters, but in under 200 pages and with a wry, light touch rather than sprawling weight.
   - nonObvious: It's frequently recommended for its 'quirky premise,' but its real strength — psychologically precise interiority in miniature — is the actual bridge to what you loved in War and Peace.
3. **Heartburn** — Nora Ephron
   - why: A quick, funny, voice-driven novel that still gives you a fully realized, complicated inner life — just one character's, rendered with the same emotional specificity you admired in Tolstoy's cast, minus any of the heaviness.
   - nonObvious: Often filed as 'divorce comedy' or 'chick lit,' overlooking that it's a tightly controlled character study with real literary craft behind the light tone.

### Case 6 — Hard turn-off

**Input:**
> I love literary fiction — character studies, beautiful prose, morally complicated people. I will not read fantasy under any circumstances: no magic systems, no invented worlds.

**Output:**

1. **So Long, See You Tomorrow** — William Maxwell
   - why: A spare, devastating character study built entirely on memory and guilt — the prose is quietly gorgeous and the moral complications (a betrayal, a murder, a friendship abandoned) never resolve into easy judgment.
   - nonObvious: Often overshadowed by louder 20th-century American novels, but its restraint and emotional precision make it a better fit for 'beautiful prose + morally complicated people' than more famous contemporaries.
2. **Disgrace** — J.M. Coetzee
   - why: Centers on a genuinely unsympathetic, self-deceiving protagonist whose disgrace forces uncomfortable moral reckoning — exactly the kind of character study that resists tidy resolution.
   - nonObvious: Frequently recommended for its Booker pedigree, but it earns the pick here specifically because its ambiguity is structural, not decorative — the discomfort is the point, not a twist.
3. **Independent People** — Halldor Laxness
   - why: An unflinching portrait of a stubborn, often infuriating Icelandic farmer whose pride costs him everything he loves — sweeping, lyrical prose in service of a deeply flawed, deeply human protagonist.
   - nonObvious: Rarely surfaces in English-language 'literary fiction' recommendation lists despite its scope and craft, making it a genuine widening of range rather than a reflexive Western-canon pick.

### Case 7a — Rejection → clarify

**Input:**
> I asked for recommendations similar to quiet, literary character studies, but the three you gave me last time were all too dark and bleak for what I wanted. I'd like something in a similar literary vein, but warmer and more hopeful in tone.

**Caveat:** v0 is stateless with no rejection/clarify UI yet, so there is no real prior round to reject. This input simulates a plausible clarify-turn message as a single freeform string rather than testing the actual rejection mechanic.

**Output:**

1. **A Month in the Country** — J.L. Carr
   - why: A shell-shocked WWI veteran spends a summer restoring a church mural in a small English village — it's as quiet and interior as the character studies you loved, but the tone is gentle, healing, and suffused with small human kindnesses rather than despair.
   - nonObvious: It's a beloved cult classic among literary readers but rarely surfaces in general 'recommend me a book' lists, so it delivers the warmth without feeling like a default pick.
2. **Kitchen** — Banana Yoshimoto
   - why: A spare, intimate portrait of a young woman processing grief and finding an unconventional found family — melancholy touches the surface, but the prose and ending lean toward tenderness and quiet renewal, not bleakness.
   - nonObvious: Yoshimoto is often filed under 'sad Japanese fiction,' but this particular book is closer to a comfort read wearing literary clothes — an easy pick to overlook if you're bracing for darkness.
3. **Crossing to Safety** — Wallace Stegner
   - why: A decades-spanning study of two couples' friendship, written with the same patient, character-driven attention you responded to — but its emotional register is warmth, loyalty, and hard-won contentment rather than tragedy.
   - nonObvious: Stegner is usually recommended for 'Angle of Repose,' so this quieter, more affectionate late novel tends to get skipped even by his admirers.

### Case 7b — Rejection → clarify → widen escalation

**Input:**
> I've now rejected two rounds of recommendations for quiet literary character studies — the first round was too dark, and the second round (aiming for warmer and more hopeful) still didn't land, they felt flat and forgettable. At this point just show me your best editable read on what you think I'm actually after, and feel free to widen out and take some real chances rather than staying narrowly in that same lane.

**Caveat:** Same limitation as 7a, escalated: v0 has no widen/escalation mechanic built yet. This input simulates the scenario in freeform text rather than testing real multi-round state.

**Output:**

1. **Convenience Store Woman** — Sayaka Murata
   - why: It's a character study, but instead of quiet interiority it has a deadpan, almost unsettling comic edge — the protagonist's flat affect is the point, not a flaw, which sidesteps both the heaviness you rejected and the toothless warmth that felt forgettable.
   - nonObvious: It looks like it should be another gentle 'odd woman finds her place' book, but its refusal to resolve into either darkness or uplift is exactly what gives it teeth.
2. **Lincoln in the Bardo** — George Saunders
   - why: This takes the character-study impulse and blows it open formally — a chorus of restless ghosts narrating grief with absurdist humor and real tenderness, so it never sits still long enough to go flat, and its darkness is undercut by genuine comic energy.
   - nonObvious: It's often shelved as a 'literary fiction event' book, but its strangeness of form (fragmented voices, historical collage) makes it a genuine swing rather than a safe prestige pick.
3. **A Tale for the Time Being** — Ruth Ozeki
   - why: It braids two character studies — a suicidal teenager's diary and a novelist finding it years later — with real warmth and real stakes, but the metafictional, quantum-tinged structure keeps it from ever feeling static or safe.
   - nonObvious: It reads on the surface like comfort fiction about connection across time, but its formal playfulness and philosophical weirdness push it well past the 'warm and forgettable' trap.

### Case 8 — Texture-match, not genre-match

**Input:**
> I'm looking for something with a really granular, immersive sense of place — I want to feel like I'm actually there — and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture.

**Output:**

1. **The Sympathizer** — Viet Thanh Nguyen
   - why: Saigon's chaos and Los Angeles's exile communities are rendered with such granular detail—the smells, the politics, the small betrayals—that you feel embedded in both worlds, and the unnamed narrator, a communist spy embedded in the losing side, is impossible to file as hero or villain.
   - nonObvious: It's often shelved as 'the literary Vietnam War novel,' but it's picked here for its interrogation-scene structure and double-consciousness voice, which do the moral-ambiguity work more relentlessly than its reputation suggests.
2. **Season of Migration to the North** — Tayeb Salih
   - why: A Sudanese village on the Nile is drawn with such tactile specificity—irrigation ditches, gossip, the rhythm of the river—that the place becomes a character, while Mustafa Sa'eed, the enigmatic returnee at the novel's center, resists any easy verdict on whether he's predator or product of colonial violence.
   - nonObvious: Frequently taught as a postcolonial 'response to Conrad,' but it's recommended here for how deliberately it withholds moral resolution rather than for its canonical status.
3. **True History of the Kelly Gang** — Peter Carey
   - why: Written in Ned Kelly's own semi-literate, punctuation-starved voice, the Australian bush becomes viscerally present—the mud, the hunger, the fear of ambush—while Kelly himself is by turns tender father figure, cop-killer, and folk martyr, never settling into either myth.
   - nonObvious: Kelly's story is often flattened into national legend or straightforward outlaw romance; this version is chosen for how thoroughly Carey's voice-driven prose undercuts both readings.

### Case 9 — Genre/category fidelity & adjacent expansion

**Input:**
> I love narrative nonfiction — real events told with the pacing and craft of a novel. Specifically deep-dive investigative journalism or historical accounts that read like thrillers. That's exactly what I'm looking for right now.

**Output:**

1. **The Feather Thief** — Kirk Wallace Johnson
   - why: A true story of an obsessive museum heist involving rare bird specimens, fly-tying subcultures, and an international manhunt — structured with the tension and reveal-by-reveal pacing of a caper thriller while being rigorously reported.
   - nonObvious: It's not the reflexive true-crime pick — the 'crime' here is bizarre and niche (stolen taxidermy birds), which makes the investigative unraveling feel fresh rather than formulaic.
2. **The Spy and the Traitor** — Ben Macintyre
   - why: A meticulously sourced Cold War espionage account — the double-agent extraction sequence reads like a le Carré novel, but every beat is documented history, satisfying the craving for thriller pacing grounded in real stakes.
   - nonObvious: Macintyre is well-regarded but this particular book, rather than his more commonly cited Operation Mincemeat, centers a single human relationship (handler and asset) that gives it novelistic intimacy most spy nonfiction lacks.
3. **Black Hawk Down** — Mark Bowden
   - why: Ground-level reconstruction of the 1993 Battle of Mogadishu built from hundreds of interviews with soldiers on both sides — it moves minute-by-minute with the immediacy of combat fiction, but it's rigorous journalism.
   - nonObvious: Often shelved as 'war book' rather than 'narrative nonfiction,' so it's overlooked by readers seeking this genre, despite being a foundational text for the immersive-reporting style now common in the field.

### Case 10 — Creative-framing-only input

**Input:**
> 🌊🏚️👻🕯️ — moody, atmospheric, a little unsettling but not full horror. That's the vibe I want.

**Output:**

1. **Our Wives Under the Sea** — Julia Armfield
   - why: Grief, the deep sea, and a slow uncanny transformation — it's soaked in the exact wave/candlelight dread your emojis point to, without tipping into gore or jump-scare horror.
   - nonObvious: Chosen for its literal watery unease and quiet emotional devastation, not because it's the trendy 'literary horror' title of the moment.
2. **Wakenhyrst** — Michelle Paver
   - why: A crumbling manor on the edge of a fen, a father's descent into obsession, and a ghost that may or may not be real — this hits the haunted-house-and-candlelight mood hard while staying restrained and psychological.
   - nonObvious: Passed over in favor of the usual Hill House/Rebecca picks — this one gives the same gothic-manor ache but from a quieter, less-trafficked corner of the genre.
3. **Fever Dream** — Samanta Schweblin
   - why: A feverish, dreamlike unraveling in the countryside — dread builds through what's left unsaid, matching the 'unsettling but not full horror' brief almost exactly.
   - nonObvious: Brings in Argentine literary fiction rather than the usual Anglo-American gothic well, so the atmosphere comes from disorientation and voice rather than genre trappings.

---

## Prompt v3 — added explicit instruction against award-driven fame as a proxy for non-obviousness (2026-07-12)

_Change: inserted a new rule (point 3) in `SYSTEM_PROMPT` stating that major literary awards (Booker, Pulitzer, Nobel, National Book Award, etc.) are not on their own evidence of non-obviousness — a prize-winning book can still be a genuine, non-reflexive fit, but shouldn't be reached for because it feels "safely prestigious." No other prompt text changed; rule numbering for the old point 3 (multi-source) shifted to point 4. Same `max_tokens: 4000` config as Prompt v2._

### Case 1 — Rich, clear input

**Input:**
> My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book.

**Output:**

1. **A Month in the Country** — J.L. Carr
   - why: Like Remains of the Day, it's built entirely on restraint — a shell-shocked veteran restoring a church mural in an English village, quietly failing to say what he feels to the woman he loves. Same hush, same ache of what's left unspoken.
   - nonObvious: A slim, underread English gem rather than the reflexive Ishiguro-adjacent pick — its post-WWI setting and clipped prose mirror Stevens's world without retreading it.
2. **So Long, See You Tomorrow** — William Maxwell
   - why: A narrator looks back decades later at a childhood betrayal and a neighbor's quiet devastation, piecing together grief he was too young to name at the time — the same delayed-reckoning heartbreak that makes Stevens's ending land so hard.
   - nonObvious: Maxwell is revered by writers but rarely cited outside literary circles; this is a genuine match for unspoken sorrow, not a safe canon pick.
3. **Snow Country** — Yasunari Kawabata
   - why: A hot-spring affair unfolds almost entirely in silences and gestures — feeling communicated through what characters don't say to each other, immersive and melancholic rather than plot-driven, in prose as spare and controlled as Ishiguro's.
   - nonObvious: Chosen for its own restrained, elliptical craft (and Kawabata's Nobel-winning mastery of implication) rather than as a lazy 'another quiet Japanese author' echo.

### Case 2 — Anti-mainstream profile

**Input:**
> There's a novel I read a few years back — quiet, character-driven, nothing anyone around me had heard of — and it turned out to be one of the best books I've ever read. It completely surprised me, because nothing about its low profile suggested it would hit that hard. I've been recommending it to people unprompted ever since. I want more like that: no bestsellers, no 'if you liked X' consensus picks — just books that are genuinely great regardless of how well-known they are.

**Output:**

1. **A Month in the Country** — J.L. Carr
   - why: A shell-shocked WWI veteran spends a summer restoring a church mural in a small English village — nothing 'happens' in the plot sense, but the interiority and quiet accumulation of grief and healing are devastating in a way that sneaks up on you, exactly the kind of low-key gut-punch you're describing.
   - nonObvious: It's a slim, decades-old novella with almost no marketing footprint — it survives entirely on word-of-mouth from readers who stumble into it, not on prize buzz or bestseller lists.
2. **Territory of Light** — Yuko Tsushima
   - why: A newly single mother navigates a year alone with her toddler in 1970s Tokyo — told in spare, luminous vignettes that build an emotional wallop through accumulation rather than event, which fits the 'quiet but hits hard' profile precisely.
   - nonObvious: Only translated into English in 2019 after decades of obscurity outside Japan; it still has nowhere near the readership its quality warrants, and it's rarely anyone's go-to recommendation.
3. **The Summer Book** — Tove Jansson
   - why: An elderly grandmother and her young granddaughter spend summers on a tiny Finnish island — episodic, understated, and entirely character-driven, it earns its emotional depth through small human moments rather than plot mechanics.
   - nonObvious: Jansson is known internationally mainly as the Moomin creator, so this adult novel gets overlooked entirely — it's a genuine sleeper, not a 'if you liked X' consensus pick.

### Case 3 — Vague input

**Input:**
> Just something good to read.

**Caveat:** v0 has no adaptive-questioning UI yet (per CLAUDE.md, that's intentionally deferred), so this is a single-shot approximation of the vague-input case rather than a real test of the follow-up-question trigger.

**Output:**

1. **Convenience Store Woman** — Sayaka Murata
   - why: A short, sharp, quietly funny novel about a woman who finds meaning in an unconventional life — the kind of book that reshapes how you see 'normal' by the last page, perfect for a reader who just wants something genuinely good without a specific brief.
   - nonObvious: It's beloved in translation circles but often overlooked outside them, chosen here for its rare combination of brevity, wit, and lingering unease rather than for trend appeal.
2. **Piranesi** — Susanna Clarke
   - why: An immersive, dreamlike mystery set inside a vast, flooding house of endless statues — it rewards patient reading with genuine wonder and a gut-punch of an ending, ideal for someone open to being surprised.
   - nonObvious: Overshadowed by Clarke's earlier doorstop novel, this slim, strange book is picked for its own singular atmosphere, not as a follow-up to a famous predecessor.
3. **The Last Samurai** — Helen DeWitt
   - why: A dazzlingly inventive novel about a single mother raising a genius child through Kurosawa films and classical languages — funny, heartbreaking, and unlike almost anything else, for a reader who wants a book they'll be pressing into friends' hands.
   - nonObvious: Despite cult acclaim among writers, it never broke into mainstream conversation, making it a genuine discovery rather than a reflexive 'great book' pick.

### Case 4 — Explicit anti-mainstream demand

**Input:**
> I want book recommendations, but nothing everyone's already read. I'm tired of every list recommending the same five books.

**Output:**

1. **The Tartar Steppe** — Dino Buzzati
   - why: A quietly devastating Italian existentialist novel about a soldier waiting his whole career for a battle that never comes — the kind of slow-burn dread and beauty that rewards patient readers who want something that lingers rather than a plot-driven page-turner.
   - nonObvious: Constantly compared to Kafka but almost never assigned or listed, so it hits with the force of discovery rather than familiarity.
2. **The Employees** — Olga Ravn
   - why: A slim, eerie Danish novella told through fragmented worker testimonies aboard a spaceship — great if you want something formally inventive and unsettling that you can finish in an afternoon but think about for weeks.
   - nonObvious: It's genre-bending literary sci-fi from a small press in translation, not the space opera or dystopia that dominates most 'sci-fi you should read' lists.
3. **Pond** — Claire-Louise Bennett
   - why: A collection of interlinked, obsessively interior narratives from an unnamed woman living alone in rural Ireland — perfect if you want prose-as-experience over conventional plot, with humor and strangeness woven through the mundane.
   - nonObvious: Beloved by writers and small-press readers but almost never surfaces on mainstream 'best of' lists, making it a genuine left-field pick rather than a disguised bestseller.

### Case 5 — Contradictory signals

**Input:**
> My favorite book of all time is 'War and Peace' — I loved the sprawling scope and how deeply it got into every character's inner life. But right now I want something light and quick to read, nothing heavy or slow.

**Output:**

1. **Cold Comfort Farm** — Stella Gibbons
   - why: You loved War and Peace's rich cast of characters and sprawling social canvas — this gives you a miniature version of that (a heroine untangling a whole eccentric family's dramas) but played for sharp comedy and wrapped up in under 250 pages.
   - nonObvious: It's a beloved cult classic rather than a bandwagon pick, and its genius is specifically that it parodies the 'sweeping family saga' genre you already love, so the fit is structural, not accidental.
2. **Convenience Store Woman** — Sayaka Murata
   - why: You said what stuck with you in War and Peace was getting deep into a character's inner life — this book is almost entirely interior monologue, just compressed into one quirky, singular voice instead of a dozen aristocrats, and it reads in an afternoon.
   - nonObvious: It's often shelved as 'quirky Japanese fiction' and undersold as a light beach read, when it's actually a tightly controlled character study — the opposite of a safe default choice for someone craving interiority.
3. **The Hundred-Year-Old Man Who Climbed Out of the Window and Disappeared** — Jonas Jonasson
   - why: For the scope-lover in you: this compresses an entire epic, decades-spanning, history-brushing life (a bit like Pierre's picaresque wanderings in War and Peace) into a fast, farcical romp with no heavy lifting required.
   - nonObvious: It's popular in translation but rarely recommended for 'War and Peace fans' specifically — its appeal here is that it mimics the sweep-of-history structure in miniature and comic form, not because it's a trending title.

### Case 6 — Hard turn-off

**Input:**
> I love literary fiction — character studies, beautiful prose, morally complicated people. I will not read fantasy under any circumstances: no magic systems, no invented worlds.

**Output:**

1. **Stoner** — John Williams
   - why: A quiet, devastating character study of an ordinary man's compromises and small failures, told in prose so restrained it becomes luminous — exactly the kind of morally complicated interiority you're describing.
   - nonObvious: It's beloved among literary readers but rarely surfaces in casual recommendation lists, so it lands as a genuine discovery rather than a rehash of 'the classics.'
2. **Independent People** — Halldór Laxness
   - why: Centers on Bjartur, a stubborn Icelandic sheep farmer whose pride and self-reliance ruin nearly everyone around him — a morally thorny protagonist rendered with sweeping, often darkly funny prose that never lets you settle into simple judgment.
   - nonObvious: Laxness won the Nobel, but this specific novel is far less read outside Iceland than his prize would suggest, giving you prestige-caliber prose without the over-familiarity of typical prize-winner picks.
3. **The Makioka Sisters** — Jun'ichirō Tanizaki
   - why: A slow, richly textured portrait of four sisters navigating tradition, marriage, and personal desire in prewar Japan — long-form character work where beauty of style and moral ambiguity are inseparable from the storytelling itself.
   - nonObvious: It's a canonical work in Japan but comparatively under-recommended in English-language literary fiction circles, offering a genuinely different literary tradition rather than another Western modernist staple.

### Case 7a — Rejection → clarify

**Input:**
> I asked for recommendations similar to quiet, literary character studies, but the three you gave me last time were all too dark and bleak for what I wanted. I'd like something in a similar literary vein, but warmer and more hopeful in tone.

**Caveat:** v0 is stateless with no rejection/clarify UI yet, so there is no real prior round to reject. This input simulates a plausible clarify-turn message as a single freeform string rather than testing the actual rejection mechanic.

**Output:**

1. **A Month in the Country** — J.L. Carr
   - why: A slow, tender character study of a shell-shocked veteran restoring a church mural in a sleepy English village — it's quiet in the way you're asking for, but its arc bends toward healing and gentle grace rather than despair.
   - nonObvious: Often overshadowed by darker WWI-era fiction, but its core is deliberately restorative — a hopeful counterpoint hiding in a genre usually mined for tragedy.
2. **Kitchen** — Banana Yoshimoto
   - why: A spare, interior novella about grief and found family that stays warm and tender even while sitting with loss — exactly the kind of quiet character study that leans toward comfort rather than bleakness.
   - nonObvious: Its reputation abroad skews toward 'sad Japanese literature,' but the prose is disarmingly cozy — food, kindness, and small daily rituals do the emotional work, not misery.
3. **Crossing to Safety** — Wallace Stegner
   - why: A deeply observed portrait of a decades-long friendship between two couples, written with patience and warmth — it's a character study built entirely on affection and endurance rather than despair.
   - nonObvious: Stegner is usually recommended for his Western epics or Pulitzer-winning 'Angle of Repose,' so this quieter, more intimate late novel gets passed over despite being his warmest work.

### Case 7b — Rejection → clarify → widen escalation

**Input:**
> I've now rejected two rounds of recommendations for quiet literary character studies — the first round was too dark, and the second round (aiming for warmer and more hopeful) still didn't land, they felt flat and forgettable. At this point just show me your best editable read on what you think I'm actually after, and feel free to widen out and take some real chances rather than staying narrowly in that same lane.

**Caveat:** Same limitation as 7a, escalated: v0 has no widen/escalation mechanic built yet. This input simulates the scenario in freeform text rather than testing real multi-round state.

**Output:**

1. **A Confederacy of Dunces** — John Kennedy Toole
   - why: You wanted character depth without the bleakness of round one or the blandness of round two — Ignatius Reilly is a character study taken to its most vivid, absurd extreme: impossible to forget, impossible not to talk about.
   - nonObvious: It's beloved but rarely reached for by 'quiet character study' readers, since its energy is loud, comic, and grotesque rather than hushed — which is exactly the swing away from flatness you're asking for.
2. **Piranesi** — Susanna Clarke
   - why: A deeply interior, gentle narrator (the warmth you wanted) inside a strange, unforgettable structure — it proves that hopeful and quiet don't have to mean forgettable when the world around the character is this original.
   - nonObvious: It gets shelved as fantasy, so character-study readers often skip it — but it's really a study of memory, identity, and solitude wearing genre clothes, which is why it lands as fresh rather than safe.
3. **Pond** — Claire-Louise Bennett
   - why: If the warm picks felt flat, this is the corrective: a fragmented, obsessive, wickedly funny interior voice that makes the mundane feel electric — character study as texture and language rather than plot.
   - nonObvious: It's small-press and easy to overlook next to bigger names, but its restless, unruly narration is precisely the kind of aliveness that a 'safe warm' pick usually can't risk.

### Case 8 — Texture-match, not genre-match

**Input:**
> I'm looking for something with a really granular, immersive sense of place — I want to feel like I'm actually there — and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture.

**Output:**

1. **The Leopard** — Giuseppe Tomasi di Lampedusa
   - why: You want granular, immersive place — this novel practically lets you smell the dust and orange blossoms of a decaying Sicilian estate during the fall of the old aristocracy, and its protagonist, Prince Fabrizio, is neither hero nor villain but a man complicit in his own class's demise while mourning it.
   - nonObvious: It's a revered classic but rarely reached for outside 'Italian literature' lists — chosen here for its unmatched sensory density and its prince's genuine moral murkiness, not because it's famous.
2. **The Sympathizer** — Viet Thanh Nguyen
   - why: The narrator is a communist spy embedded in the South Vietnamese army and later a Vietnamese refugee community in Los Angeles — a man loyal to everyone and no one, giving you exactly the moral ambiguity you're after, while the prose renders Saigon's fall and LA's exile enclaves in vivid, specific detail.
   - nonObvious: It won major prizes, but it's picked here for its structural trick — a double-agent narrator whose divided loyalties make ambiguity the engine of the plot, not just a character trait.
3. **Season of Migration to the North** — Tayeb Salih
   - why: Set in a small village on the Nile and in fog-bound London, the novel's dual settings are rendered with startling tactile precision, and its central figure — a man who weaponizes colonial stereotypes to seduce and destroy — resists any easy moral read.
   - nonObvious: Often flattened into a 'postcolonial classic' shorthand, but it's included here for its genuinely unsettling ambiguity — the reader is never given permission to simply condemn or excuse its protagonist.

### Case 9 — Genre/category fidelity & adjacent expansion

**Input:**
> I love narrative nonfiction — real events told with the pacing and craft of a novel. Specifically deep-dive investigative journalism or historical accounts that read like thrillers. That's exactly what I'm looking for right now.

**Output:**

1. **The Feather Thief** — Kirk Wallace Johnson
   - why: A real theft of priceless Victorian bird specimens from a British museum, told with obsessive, propulsive detail — exactly the kind of investigative deep-dive that reads like a heist thriller while staying rigorously factual.
   - nonObvious: It's investigative nonfiction at its finest but built around an oddball subject (fly-tying and ornithology obsessives) rather than the true-crime or tech-scandal territory most 'thriller nonfiction' recommendations default to.
2. **The Monster of Florence** — Douglas Preston and Mario Spezi
   - why: An unsolved serial murder case in Italy that spirals into the journalist-author himself becoming a suspect — it has the pacing of a novel because the writer is genuinely living inside the investigation.
   - nonObvious: Co-written by a crime novelist and the actual Italian journalist who covered the case, so the craft-meets-real-stakes premise you're after is baked into its origin, not just its style — and it's set outside the usual American true-crime canon.
3. **Chernobyl: The History of a Nuclear Catastrophe** — Serhii Plokhy
   - why: A meticulously reconstructed hour-by-hour account of the disaster and its cover-up, built from newly declassified sources — tense, procedural, and paced like a countdown thriller despite being rigorous history.
   - nonObvious: Written by an academic historian rather than a journalist, giving it archival depth beyond the more familiar journalistic disaster narratives, while losing none of the momentum.

### Case 10 — Creative-framing-only input

**Input:**
> 🌊🏚️👻🕯️ — moody, atmospheric, a little unsettling but not full horror. That's the vibe I want.

**Output:**

1. **Piranesi** — Susanna Clarke
   - why: A labyrinthine, tide-swept House of endless halls and drowned statues — literally the water, ruin, and candlelit hush your emoji conjure, with a dreamlike unease that never tips into horror.
   - nonObvious: Its fame rests on being 'strange and beautiful,' not on being a go-to atmospheric pick — most readers reach for haunted-house classics before this quietly eerie labyrinth novel.
2. **Wide Sargasso Sea** — Jean Rhys
   - why: A crumbling Caribbean estate, oppressive humidity, encroaching sea, and a slow psychological unraveling — gothic dread built from decay and isolation rather than jump scares.
   - nonObvious: It's often read as a 'Jane Eyre companion piece' rather than for its own sake, so it's overlooked as the moody, water-and-ruin gothic it actually is.
3. **The Little Stranger** — Sarah Waters
   - why: A decaying English manor, flickering lamplight, and a dread that creeps in through implication and atmosphere rather than explicit scares — patient, unsettling, never full horror.
   - nonObvious: Waters is usually shelved as 'literary fiction with lesbian romance,' so this slow-burn haunted-house novel of hers gets skipped by readers hunting specifically for eerie atmosphere.
