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

---

## search_books wired into the live recommend call — RAW OUTPUT, NOT YET SCORED AGAINST THE RUBRIC (2026-08-01)

_Change: `app/api/recommend/route.ts` now passes `tools` and runs a real `tool_use`/`tool_result` loop (capped at 3 `search_books` rounds before a final call omits `tools` to force a text response). `SYSTEM_PROMPT` text is unchanged from Prompt v3 — same rules 1–4, same `max_tokens: 4000`. This is the first run where `search_books` is actually live rather than standalone-tested. All 11 cases returned `stop_reason: end_turn` with no errors; input token counts (6,140–25,343 per case) are consistent with a real shuffled candidate pool being returned by the tool on every case, not just some. **These outputs have not been scored against the 6-dimension rubric yet — that's deferred to next session, when there's time to read each case carefully. This entry is the raw record only.**_

### Case 1 — Rich, clear input

**Input:**
> My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book.

**Output:**

1. **Stoner** — John Williams
   - why: Like 'The Remains of the Day,' this is a quiet, devastating portrait of a man who never voices his deepest disappointments and loves, told in plain, unadorned prose that makes the buried emotion hit harder.
   - nonObvious: It's often praised in literary circles, but it's chosen here because its slow, interior tragedy of a life half-lived mirrors Stevens's suppressed regret almost beat for beat — not because it's a trendy 'rediscovered classic.'
2. **The Stone Diaries** — Carol Shields
   - why: A character-driven, meditative chronicle of one woman's ordinary life, where the biggest emotional truths are left unsaid or only gestured at between the lines — ideal for sitting slowly with a life rather than racing through a plot.
   - nonObvious: It won the Pulitzer, but that's incidental — its real fit is the fragmented, restrained interiority of its narrator, whose quiet self-effacement echoes Stevens's own inability to claim his feelings.
3. **Kokoro** — Natsume Sōseki
   - why: A spare, melancholic novel about guilt, loneliness, and the things people can't bring themselves to say to those they love most — the same aching restraint that made Stevens's unspoken devotion so heartbreaking.
   - nonObvious: Rarely reached for as a comfort-read companion to Ishiguro despite being a clear spiritual ancestor of his reticent, emotionally coiled style — a genuine lineage pick rather than a default one.

### Case 2 — Anti-mainstream profile

**Input:**
> There's a novel I read a few years back — quiet, character-driven, nothing anyone around me had heard of — and it turned out to be one of the best books I've ever read. It completely surprised me, because nothing about its low profile suggested it would hit that hard. I've been recommending it to people unprompted ever since. I want more like that: no bestsellers, no 'if you liked X' consensus picks — just books that are genuinely great regardless of how well-known they are.

**Output:**

1. **The Door** — Magda Szabó
   - why: A slow-burning, devastating character study of the decades-long relationship between a writer and her fiercely private housekeeper — it's the kind of book that seems small and domestic on the surface and then quietly wrecks you by the end, exactly the 'didn't see it coming' impact you described.
   - nonObvious: Hugely respected among literary-translation readers and NYRB Classics devotees, but almost never shows up on general 'best books' lists or bestseller charts, so it rarely gets pushed as a default rec.
2. **A Month in the Country** — J. L. Carr
   - why: Barely 130 pages about a shell-shocked WWI veteran restoring a church mural over one English summer — nothing dramatic happens, and yet the accumulated tenderness and restraint make it land harder than novels three times its length, the same 'quietly devastating' effect you're chasing.
   - nonObvious: It was Booker-shortlisted decades ago but has drifted almost entirely out of public awareness; it survives mostly through word-of-mouth passing between readers who stumbled onto it, not through prize-list momentum.
3. **The Summer Book** — Tove Jansson
   - why: A grandmother and her young granddaughter spend a summer on a tiny Finnish island, and through plain, unadorned scenes of daily life the book builds an emotional weight about aging, grief, and companionship that sneaks up on you — very much the 'low-key surface, huge impact' pattern you loved.
   - nonObvious: Jansson is world-famous for the Moomin books, so this quiet adult novel for grown-ups gets completely overshadowed by her children's work and almost never appears in 'if you liked X' literary-fiction rotations.

### Case 3 — Vague input

**Input:**
> Just something good to read.

**Output:**

1. **The Heart Is a Lonely Hunter** — Carson McCullers
   - why: A deeply humane novel about loneliness and the ache to be understood, written with a clarity and emotional precision that makes ordinary lives feel enormous — the kind of book that quietly rearranges how you see people.
   - nonObvious: It's a canonical American novel, but it's chosen here for its unmatched tenderness and structural craft rather than because it's the 'safe' classic pick — many readers know McCullers by name but haven't actually read this.
2. **Del amor y otros demonios** — Gabriel García Márquez
   - why: A shorter, lesser-read Márquez novel steeped in colonial Cartagena, mixing lush sensory prose with a genuinely strange, haunting plot — good if you want a vivid, immersive read without committing to a doorstop.
   - nonObvious: Skips the reflexive 'One Hundred Years of Solitude' recommendation in favor of a tighter, stranger, equally beautiful Márquez that fewer people have already read.
3. **Sátántangó** — László Krasznahorkai
   - why: A hypnotic, darkly comic novel about a doomed rural Hungarian village, told in long unbroken sentences that pull you into its bleak, rain-soaked atmosphere — a genuinely unforgettable reading experience for anyone open to something formally daring.
   - nonObvious: Krasznahorkai is acclaimed but rarely a default pick; this novel rewards readers open to slower, stranger pacing with one of the most singular reading experiences in contemporary translated fiction.

### Case 4 — Explicit anti-mainstream demand

**Input:**
> I want book recommendations, but nothing everyone's already read. I'm tired of every list recommending the same five books.

**Output:**

1. **İnce Memed (Memed, My Hawk)** — Yaşar Kemal
   - why: A sweeping, propulsive epic about a young outlaw in rural Anatolia — the kind of big, immersive, morally complex story that rewards readers tired of the same handful of 'important novels' circulating in English-language lists.
   - nonObvious: Kemal was a perennial Nobel contender and towering figure in Turkish literature, yet this novel almost never appears on Western recommendation lists, making it a genuine discovery rather than a prestige name-check.
2. **My Family's Role in the World Revolution** — Bora Ćosić
   - why: A darkly funny, formally inventive novel narrated by a child in postwar Yugoslavia, satirizing ideology and family life with a fractured, playful structure — great if you want something that feels genuinely different in voice and shape, not just plot.
   - nonObvious: It's a cult classic of Serbian literature with almost no footprint in mainstream English-language 'best of' lists, despite being formally as daring as more famous postmodern touchstones.
3. **Paris Trout** — Pete Dexter
   - why: A stark, unflinching National Book Award-winning novel about racial violence and moral rot in a small Georgia town in the 1950s — intense, character-driven, and quietly devastating rather than showy.
   - nonObvious: It won a major award decades ago but has largely fallen out of contemporary conversation, so it delivers the payoff of a 'best of its era' book without being a recycled staple of current lists.

### Case 5 — Contradictory signals

**Input:**
> My favorite book of all time is 'War and Peace' — I loved the sprawling scope and how deeply it got into every character's inner life. But right now I want something light and quick to read, nothing heavy or slow.

**Output:**

1. **Three Men in a Boat (to say nothing of the dog)** — Jerome K. Jerome
   - why: It's a short, wonderfully funny romp built almost entirely on character quirks and voice — the same delight in individual personality that made you love Tolstoy's characters, just compressed into a breezy afternoon read instead of a thousand pages.
   - nonObvious: It's a beloved classic but rarely the first 'light read' recommendation that comes to mind, so it still feels like a discovery rather than a reflex pick.
2. **The Unlikely Pilgrimage of Harold Fry** — Rachel Joyce
   - why: A gentle, quick novel that still spends real time inside one man's inner life and memories as he walks across England — giving you that intimate psychological depth you loved in War and Peace, but at a fraction of the length and weight.
   - nonObvious: It's popular but often overlooked as a 'palate cleanser' pick between heavier classics, which is exactly the gap it fills here.
3. **Cause Celeb** — Helen Fielding
   - why: A sharp, fast-moving comic novel about a woman running a refugee camp who gets entangled with London celebrities trying to help — full of vividly drawn, flawed characters and social satire, read in a couple of sittings.
   - nonObvious: Overshadowed by Fielding's own Bridget Jones's Diary, it's a genuinely funnier, more socially observant book that rarely gets recommended on its own merits.

### Case 6 — Hard turn-off

**Input:**
> I love literary fiction — character studies, beautiful prose, morally complicated people. I will not read fantasy under any circumstances: no magic systems, no invented worlds.

**Output:**

1. **Disgrace** — J. M. Coetzee
   - why: A morally compromised protagonist rendered with unflinching, spare prose — exactly the kind of character study where you're never sure whether to condemn or understand him.
   - nonObvious: Its Booker win doesn't make it a safe pick here; it's chosen because Coetzee's refusal to soften or explain his characters is a rarer, harder-edged version of moral complexity than most 'complicated character' novels attempt.
2. **Sula** — Toni Morrison
   - why: Centers on a genuinely unclassifiable woman — neither villain nor heroine — and Morrison's prose is dense, musical, and precise in a way that rewards close reading.
   - nonObvious: Overshadowed by Morrison's more frequently assigned novels (Beloved, Song of Solomon), Sula is tighter and stranger — a less reflexive entry point into her work for this taste.
3. **The Assistant** — Bernard Malamud
   - why: A quiet, grinding character study of a small-time thief trying to redeem himself while working in a failing grocery — morally messy people rendered with plain, devastating sentences.
   - nonObvious: Malamud gets less reflexive airtime than his contemporaries (Roth, Bellow), making this a genuine discovery rather than a default 'great American postwar novel' pick.

### Case 7a — Rejection → clarify

**Input:**
> I asked for recommendations similar to quiet, literary character studies, but the three you gave me last time were all too dark and bleak for what I wanted. I'd like something in a similar literary vein, but warmer and more hopeful in tone.

**Output:**

1. **My Ántonia** — Willa Cather
   - why: A quiet, deeply interior character study of pioneer life on the Nebraska prairie — reflective and elegiac, but its warmth toward resilience, memory, and human connection gives it a fundamentally hopeful glow rather than a bleak one.
   - nonObvious: Cather gets cited for prairie fiction generally, but this particular book is often overlooked in favor of louder 'great American novel' picks — it's a genuine fit for warm introspection, not a reflexive canon grab.
2. **The Chosen** — Chaim Potok
   - why: A gentle, closely observed study of two boys' friendship and their relationships with their fathers within Orthodox and Hasidic Jewish communities — its tone is contemplative and tender, culminating in reconciliation and mutual understanding rather than tragedy.
   - nonObvious: It's well-regarded but rarely surfaces in 'quiet character study' recommendation lists, which tend to loop back to more secular literary fiction — this one offers real thematic and cultural range.
3. **A Jest of God** — Margaret Laurence
   - why: An intimate, restrained portrait of a repressed small-town schoolteacher's inner life — melancholic in places, but it builds toward genuine self-liberation and quiet hope by its close, matching a warmer register than typical psychological fiction.
   - nonObvious: Laurence is a major Canadian writer but this novel is far less reflexively recommended than her 'The Stone Angel,' making it a genuine rather than default choice for this specific warmer tone.

### Case 7b — Rejection → clarify → widen escalation

**Input:**
> I've now rejected two rounds of recommendations for quiet literary character studies — the first round was too dark, and the second round (aiming for warmer and more hopeful) still didn't land, they felt flat and forgettable. At this point just show me your best editable read on what you think I'm actually after, and feel free to widen out and take some real chances rather than staying narrowly in that same lane.

**Output:**

1. **Memento Mori** — Muriel Spark
   - why: A quiet character study of a circle of elderly Londoners each receiving anonymous calls reminding them they must die — it's exactly the kind of understated psychological portraiture you're after, but delivered with such precise, mordant wit that it never risks going flat or merely 'nice.'
   - nonObvious: Spark is famous mainly for Jean Brodie, so this sharper, stranger later novel gets skipped even though it's arguably her most piercing character work — a way to hit 'quiet and literary' without the reflexive pick.
2. **Convenience Store Woman** — Sayaka Murata
   - why: An intensely interior study of a woman who has built her entire selfhood around the rhythms of a convenience store — it's quiet, character-driven, and odd in a way that keeps it vivid rather than forgettable, with warmth that's earned through specificity, not sentiment.
   - nonObvious: It's popular enough to know, but it's usually shelved as 'quirky Japanese fiction' rather than recognized for what it actually is: a rigorous, deadpan character study — a genuine fit rather than a trend pick.
3. **The Informers** — Juan Gabriel Vásquez
   - why: A son investigating his father's past uncovers a buried betrayal from Colombia's WWII-era blacklists — it's a slow-burning, morally intricate character study with real emotional weight, but its clarity and restraint keep it from tipping into the oppressive darkness you already ruled out.
   - nonObvious: Vásquez is well-regarded in Latin American letters but rarely surfaces in English-language 'quiet character study' recommendation lists, which tend to default to Anglophone or Japanese names — a genuine widening of the lane rather than a safe swap.

### Case 8 — Texture-match, not genre-match

**Input:**
> I'm looking for something with a really granular, immersive sense of place — I want to feel like I'm actually there — and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture.

**Output:**

1. **Satantango** — László Krasznahorkai
   - why: You want to feel like you're actually there — this novel drowns you in a decaying, rain-soaked Hungarian village so thoroughly that the mud and despair become characters themselves, while the villagers plotting around a possibly-resurrected con man are neither victims nor villains, just desperate people making compromised choices.
   - nonObvious: It's acclaimed among writers and cinephiles (via Béla Tarr's film) but rarely surfaces in mainstream book-recommendation lists, so it delivers prestige-level craft without being a reflexive pick.
2. **The Garden of Evening Mists** — Tan Twan Eng
   - why: Set in the Malaysian highlands after WWII, the novel renders the tea plantations, mist, and gardens with such sensory precision you can feel the humidity — and its central relationship between a former POW-camp survivor and the Japanese emperor's ex-gardener refuses easy judgments about complicity and forgiveness.
   - nonObvious: It won prizes but remains under-read outside Southeast Asian literary circles, and its moral ambiguity is structural rather than decorative — the whole plot hinges on not knowing who to trust.
3. **The Yiddish Policemen's Union** — Michael Chabon
   - why: A noir mystery built entirely out of place — a fictional Yiddish-speaking Jewish settlement in Sitka, Alaska, rendered in dense, specific, almost tactile detail — populated by a washed-up alcoholic detective and criminals-slash-victims whose loyalties shift constantly.
   - nonObvious: Genre-blending speculative noir gets overlooked by literary-fiction readers, making this a genuine left-turn pick rather than a safe default, even though Chabon is a known name.

### Case 9 — Genre/category fidelity & adjacent expansion

**Input:**
> I love narrative nonfiction — real events told with the pacing and craft of a novel. Specifically deep-dive investigative journalism or historical accounts that read like thrillers. That's exactly what I'm looking for right now.

**Output:**

1. **Say Nothing: A True Story of Murder and Memory in Northern Ireland** — Patrick Radden Keefe
   - why: This is deep-dive investigative journalism at its finest — years of reporting on the Troubles woven into a propulsive narrative with the tension of a political thriller, exactly the blend of real events and novelistic pacing you're after.
   - nonObvious: It's well-regarded but often gets overshadowed by flashier true-crime picks; chosen here because its structural craft (interlocking mysteries, slow-burn reveals) is a near-perfect technical match for 'reads like a thriller,' not because it's a famous title.
2. **Billion Dollar Whale** — Tom Wright and Bradley Hope
   - why: A globe-spanning financial fraud investigation — Malaysian politics, Hollywood, Wall Street — told with the momentum of a heist novel, satisfying the appetite for real events with thriller-grade plotting.
   - nonObvious: Financial-crime nonfiction rarely gets recommended alongside true-crime staples, but its pacing and scope make it a sharper fit for 'reads like a novel' than more predictable murder-focused picks.
3. **Frozen in Time: The Fate of the Franklin Expedition** — Owen Beattie and John Geiger
   - why: A forensic investigation into a 19th-century Arctic disaster, combining historical detective work, exhumed bodies, and scientific sleuthing into a slow-mounting dread that reads like a mystery novel.
   - nonObvious: It sidesteps the usual true-crime/journalism default entirely, using polar exploration history instead, which broadens the genre range while still delivering the investigative, thriller-like structure you're drawn to.

### Case 10 — Creative-framing-only input

**Input:**
> 🌊🏚️👻🕯️ — moody, atmospheric, a little unsettling but not full horror. That's the vibe I want.

**Output:**

1. **We Have Always Lived in the Castle** — Shirley Jackson
   - why: A crumbling house, a family isolated behind hedges and superstition, and a slow-burning dread that never tips into gore — pure moody, unsettling atmosphere rather than horror set pieces.
   - nonObvious: Reaching for Jackson isn't lazy here because this is her quieter, stranger book — not the haunted-house one everyone defaults to — built on domestic menace rather than ghosts.
2. **The Little Stranger** — Sarah Waters
   - why: A decaying English manor, a family unraveling, and a haunting that's ambiguous enough to be psychological or real — exactly the candlelit, water-damaged-wallpaper dread the mood calls for.
   - nonObvious: Waters is known for lesbian historical fiction, so her one true gothic ghost story tends to get overlooked in favor of Victorian staples — it's a genuinely literary slow-burn, not a jump-scare book.
3. **Kit's Wilderness** — David Almond
   - why: Set in a fog-bound former mining town on the English coast, it's soaked in grief, old ghosts, and childhood games that edge into the uncanny — eerie and tender rather than frightening.
   - nonObvious: Almond is usually filed as children's/YA fantasy, so this quietly haunting, ghost-inflected literary novel rarely makes 'atmospheric horror-adjacent' lists, despite fitting the brief precisely.

---

## Rubric scoring — 2026-08-01 run, scored 2026-08-02

Full 6-dimension scoring of the 11-case run above, against the rubric in `docs/eval-set.md`, using the same 4-point scale (fail/weak/good/excellent) and the same standard of external grounding (Goodreads, award records, general reception) as the July 10 scoring session — not gut-feel, particularly for Real & correct and Non-obviousness. Award/reception claims were checked against real sources rather than assumed.

| Case | Relevance | Non-obviousness | Range | Real & correct | Traceability | Variety across sessions |
|---|---|---|---|---|---|---|
| **1** Rich, clear input | excellent | good | excellent | excellent | excellent | excellent |
| **2** Anti-mainstream profile | excellent | good | excellent | excellent | excellent | excellent |
| **3** Vague input | good | good | excellent | excellent | weak* | weak† |
| **4** Explicit anti-mainstream | excellent | good | excellent | excellent | excellent | excellent |
| **5** Contradictory signals | excellent | good | good | excellent | excellent | excellent |
| **6** Hard turn-off | excellent | weak‡ | good | excellent | excellent | excellent |
| **7a** Rejection→clarify | excellent | good | good | excellent | excellent | excellent |
| **7b** Rejection→clarify→widen | good* | good‡ | excellent | excellent | good | excellent |
| **8** Texture-match | excellent | weak‡ | excellent | excellent | excellent | weak† |
| **9** Genre fidelity/expansion | excellent | fail‡ | excellent | excellent | excellent | excellent |
| **10** Creative-framing-only | excellent | weak | good | excellent | excellent | excellent |

\* Case 3's low Traceability isn't a recommendation-quality failure — with zero real signal in "just something good to read" and no adaptive follow-up mechanic in this stateless single-call version (per CLAUDE.md, deliberately not built yet), there's nothing case-specific for the *why*s to trace to. They're generically well-written, not input-grounded. The same structural caveat applies to 7a/7b (simulated single-message stand-ins for a rejection/clarify/widen mechanic that doesn't exist yet), but those two didn't show the same degradation — the simulated messages carry enough explicit content (dark/warm/flat/widen) for the model to trace against, so they weren't discounted on that basis. 7b's Relevance is "good" rather than "excellent" for an unrelated reason: only 1 of 3 picks (*The Informers*) genuinely widens out as asked — *Memento Mori* and *Convenience Store Woman* stay in the same quiet-literary lane the user explicitly said didn't land twice already.

† Expected, not a surprise — this is the Satantango finding already logged in `docs/eval-log.md` (2026-08-01 entry). It appears in both case 3 and case 8, structurally distinct inputs, so both score weak on this dimension specifically for that reason.

‡ See the Prompt v3 comparison below.

### Non-obviousness: is Prompt v3's award-bias fix holding for cases 6, 7b, 8, 9?

Partially — the letter of the rule is holding, the underlying pattern isn't. Where the model names a major literary award explicitly (Booker/Pulitzer/Nobel/NBA), it now correctly declines to treat the award as evidence of non-obviousness and argues from other grounds instead — real, measurable progress from the 2026-07-08 finding in `docs/eval-log.md`. But the same shape of failure (reach for a famous/decorated title, frame it as overlooked) keeps resurfacing through gaps the rule's specific wording doesn't cover:

- **Case 6 — regression, same title.** *Disgrace* is the exact book flagged in the July 10 finding. The reasoning genuinely improved ("Its Booker win doesn't make it a safe pick here...") but the pick itself is unchanged — still one of the most canonical, frequently-assigned answers to "morally complicated literary fiction" you could name.
- **Case 7b — real fix.** The July 10 offender here (*Lincoln in the Bardo*, Booker + #1 NYT bestseller) is gone, replaced by *Memento Mori* and *The Informers*, both genuine deeper cuts. This one actually holds.
- **Case 8 — fix evaded, not applied.** *The Sympathizer* (Pulitzer) is gone, but *The Garden of Evening Mists* (Walter Scott Prize winner, Booker-shortlisted, Man Asian Prize winner) and *The Yiddish Policemen's Union* (Hugo/Nebula/Locus/Sidewise sweep) fill the same slot. Neither is a Booker/Pulitzer/Nobel/NBA winner by name, so the rule's literal wording doesn't trigger — but both are as decorated and famous as the books the rule was written to stop.
- **Case 9 — worse than before, and factually shaky.** *Black Hawk Down* (bestseller/film) is gone, but *Say Nothing* replaces it with a claim that doesn't survive fact-checking (see the dedicated 2026-08-02 entry in `docs/eval-log.md`) — it's actually one of the most garlanded and widely-cited narrative nonfiction books of the last decade, not an overshadowed pick.
- **Case 10 — same pattern, different flavor (not one of the four originally flagged, but worth noting).** *We Have Always Lived in the Castle* is Jackson's other most-canonical novel, and *The Little Stranger* was Booker-shortlisted (undisclosed in its `nonObvious` text) — same prestige-substitution move, via reputation/undisclosed-award rather than a named literary prize.

This mirrors the shape of the eval-log's grounding finding from the same run: not eliminated, relocated. See the 2026-08-02 entries in `docs/eval-log.md` for a clarifying note on what the actual non-obviousness bar should be (it's not "avoid awards/fame" — see that entry for the corrected read on cases 6, 8, and 10 specifically) and for the *Say Nothing* factual-accuracy issue logged as its own distinct finding.

### Everything else

Relevance, Range, Real & correct, and Traceability are strong across the board — no hallucinated titles or misattributed authors in any of the 33 picks (all verified real), and traceability is excellent everywhere the input actually carries signal to trace to. This matches the July 10 pattern where these three dimensions were already solid; the open problems remain concentrated in non-obviousness and the residual narrow-pool issue.

---

## Prompt v4 — non-obviousness rule reframed around "expected answer," nonObvious field tightened for factual accuracy (2026-08-02)

_Change: `app/api/recommend/route.ts` (commit a5ff6ab) — rule 3 in `SYSTEM_PROMPT` rewritten from "major literary awards aren't evidence of non-obviousness" to "a pick fails on non-obviousness if it's the answer a well-read reader would already expect for this request, independent of decoration." The `nonObvious` field instructions gained a sentence barring reception/fame claims the model isn't confident are accurate. Rules 1, 2, 4, the tool-reference paragraph, the input-parsing paragraph, and the JSON output instructions are unchanged. Same `max_tokens: 4000`, same live `search_books` tool-use loop as the prior run. All 11 cases returned `stop_reason: end_turn`, no errors; input tokens ranged 10,469–26,482 per case, consistent with the tool firing on every case._

### Case 1 — Rich, clear input

1. **Stoner** — John Williams
   - why: Like Stevens in 'The Remains of the Day', William Stoner lives a life of quiet endurance and suppressed longing, narrated with the same devastating restraint — the emotion is almost entirely between the lines.
   - nonObvious: It's a slow-burn academic tragedy rather than a dramatic one, so it satisfies the craving for stillness without being the first title most 'quiet literary fiction' lists reach for outside dedicated fans.
2. **Oblomov** — Ivan Goncharov
   - why: A masterclass in interiority and inertia — Oblomov's paralysis and unlived life mirror the melancholy of Stevens's missed chances, told through patient, immersive prose that rewards sitting with it.
   - nonObvious: As a 19th-century Russian novel, it sits outside the usual 'if you liked Ishiguro' recommendation set, even though its themes of wasted devotion and self-deception are strikingly close.
3. **A Jest of God** — Margaret Laurence
   - why: A repressed, unmarried schoolteacher's inner life unfolds with the same aching gap between what she feels and what she allows herself to show — restrained, interior, and quietly heartbreaking.
   - nonObvious: Laurence's Canadian prairie fiction rarely appears on Ishiguro comparison lists, but its close psychological focus on a woman's unspoken yearning makes it a genuinely close cousin to Stevens's story.

### Case 2 — Anti-mainstream profile

1. **Oblomov** — Ivan Goncharov
   - why: You describe a book that seemed unassuming on the surface and then quietly devastated you — Oblomov does exactly that: a slow, interior character study of a man paralyzed by his own inertia that ends up saying more about human nature than novels twice as eventful.
   - nonObvious: It's a canonical Russian novel in academic circles, but it rarely appears on general 'quiet literary fiction' lists outside that context, so most readers come to it cold and are unprepared for how sharply it lands.
2. **The Assistant** — Bernard Malamud
   - why: A spare, morally serious story about a struggling grocer and the drifter who starts working for him — it builds its power entirely through small, accumulating character detail rather than plot, which matches the 'quiet but hits hard' quality you're after.
   - nonObvious: Malamud is known mainly for The Natural or The Fixer; this earlier, quieter novel gets passed over even by people familiar with his name, making it a genuine sleeper rather than a default pick.
3. **The Memory of Love** — Aminatta Forna
   - why: A patient, character-driven novel set in Sierra Leone that reveals its emotional weight gradually through the interwoven inner lives of its characters rather than dramatic incident — the kind of book you finish and immediately want to press on someone.
   - nonObvious: Forna's work sits outside the usual war-fiction or bestseller circuits despite its literary prizes, so it tends to surprise readers who expect a louder book given its subject matter.

### Case 3 — Vague input

1. **Hunger** — Knut Hamsun
   - why: A gripping, hallucinatory portrait of a starving writer's mind in 1890s Oslo — for a reader who just wants 'something good,' this is a case study in how a novel can be both deeply readable and psychologically unsettling in under 250 pages.
   - nonObvious: It's a foundational modernist novel that quietly influenced Kafka and Bukowski, but it rarely tops general 'good book' lists the way its literary descendants do.
2. **The Memory of Love** — Aminatta Forna
   - why: A sweeping, emotionally precise story of love and trauma across generations in Sierra Leone — satisfying as pure narrative while leaving a real emotional mark, which is exactly what 'something good to read' usually means.
   - nonObvious: It has the scope and heart of a big literary bestseller without being one of the handful of titles that reflexively get handed to every reader looking for 'a great novel.'
3. **CivilWarLand in Bad Decline** — George Saunders
   - why: A darkly funny, formally inventive short story collection set in decaying theme parks and corporate dystopias — great for a reader who wants something good but doesn't want the safest, most predictable choice.
   - nonObvious: Saunders is well-regarded, but this earlier, rawer collection is less reached-for than his more famous later work, and it hits just as hard.

### Case 4 — Explicit anti-mainstream demand

1. **Memento Mori** — Muriel Spark
   - why: A darkly comic novel about a group of elderly Londoners who each start receiving anonymous phone calls saying 'Remember you must die' — it's sharp, unsettling, and finds real wit in mortality rather than melodrama, which suits a reader craving something with bite rather than the usual gentle literary-fiction comfort read.
   - nonObvious: Spark is often reduced to 'the Jean Brodie author,' so this leaner, stranger, funnier book about aging and death rarely makes the standard recommendation lists.
2. **Too Close to the Edge** — Pascal Garnier
   - why: A slim, pitch-black French noir about a widow whose quiet countryside routine curdles into paranoia and violence — perfect if the appeal is atmosphere and psychological unraveling over plot mechanics, delivered in under 150 pages.
   - nonObvious: Garnier's noir is closer to Simenon filtered through absurdist dread than to typical crime-shelf fare, and his work tends to get skipped over in favor of bigger-name Euro-noir writers.
3. **Los informantes** — Juan Gabriel Vásquez
   - why: A Colombian novel that unspools a family's buried WWII-era betrayal through a journalist's investigation — it's got the moral complexity and slow-burn tension of a great literary thriller without leaning on genre tropes.
   - nonObvious: Vásquez writes in the shadow of García Márquez's reputation, so this quieter, more contemporary, more politically pointed novel gets overlooked despite being arguably his sharpest work.

### Case 5 — Contradictory signals

1. **Three Men in a Boat** — Jerome K. Jerome
   - why: You loved War and Peace for how richly it inhabited each character's inner voice — this Victorian comic classic does the same in miniature, spending its whole quick, breezy length inside the bickering, self-deluding minds of three friends on a river trip.
   - nonObvious: It's often filed as 'classic comedy' rather than reached for by Tolstoy fans, but its close, affectionate psychological comedy of small egos is a genuine cousin to Tolstoy's interest in ordinary human folly, just compressed and played for laughs.
2. **Trouble for Lucia** — E. F. Benson
   - why: War and Peace's pleasure in a whole social world of vain, striving, self-important people finds a light, fast echo here — a small English village run by two rival social climbers, each convinced they're the heroine of the story.
   - nonObvious: Benson's Lucia books get less airtime than Austen or Wodehouse as comfort reads, but they deliver the same dense social interiority Tolstoy fans respond to — just shrunk to village-gossip scale and read in an afternoon.
3. **Haroun and the Sea of Stories** — Salman Rushdie
   - why: It swaps War and Peace's historical sweep for a compact, dreamlike quest, but keeps the sense of a whole vivid world glimpsed through one person's inner journey — light, funny, and finished in a sitting or two.
   - nonObvious: Rushdie is usually approached through his dense, difficult novels, so this slim, buoyant fable — written for his son — is easy to overlook as a 'quick read' pick despite fitting that brief perfectly.

### Case 6 — Hard turn-off

1. **Hunger** — Knut Hamsun
   - why: A ferociously intimate character study of a narrator whose pride, self-deception, and erratic cruelty toward those who try to help him make him morally slippery in exactly the way you're describing — and the prose, even in translation, has a jittery, hallucinatory beauty that gets under your skin.
   - nonObvious: It's the quiet ancestor behind a century of unreliable-narrator fiction, but it rarely tops 'if you loved X' lists the way its literary descendants do, so it tends to land as a genuine discovery rather than a rehash.
2. **The Memory of Love** — Aminatta Forna
   - why: Set in postwar Sierra Leone, it braids together an aging academic, a traumatized surgeon, and a woman haunted by an old betrayal — each morally compromised in believable, unshowy ways, and the sentence-level writing is patient and devastating rather than flashy.
   - nonObvious: It gets less air time than the big diaspora-literature staples, but its slow-burn structure and refusal to resolve its characters' guilt cleanly make it a richer character study than many more frequently cited peers.
3. **Play It as It Lays** — Joan Didion
   - why: A stripped-down, glittering-cold portrait of a woman drifting through a collapsing marriage and a vacant Hollywood, whose passivity and complicity make her fascinatingly hard to fully absolve or condemn — precisely the kind of morally complicated interiority you're after.
   - nonObvious: Didion's essays get recommended constantly, but this novel — arguably her sharpest character work — sits comparatively overlooked next to her nonfiction reputation.

### Case 7a — Rejection → clarify

1. **My Ántonia** — Willa Cather
   - why: It's a quiet, deeply interior character study of a life observed over decades, but its emotional register is nostalgic and tender rather than grim — the hardships of prairie life are always held up against wonder, friendship, and gratitude.
   - nonObvious: Cather gets cited for pastoral Americana more than for 'warm hopeful character study,' so it tends to get overlooked next to the usual quiet-literary-fiction suspects, even though its patient, affectionate narration is exactly that.
2. **The Chosen** — Chaim Potok
   - why: A slow-burning, closely observed character study of two boys and their fathers in 1940s Brooklyn — full of interiority and moral seriousness, but its core is friendship, faith, and reconciliation rather than despair.
   - nonObvious: It's often shelved as 'Jewish-American coming-of-age' rather than considered alongside literary character studies, so it rarely surfaces on generic 'quiet lit fic' lists despite fitting the mold closely.
3. **The Unlikely Pilgrimage of Harold Fry** — Rachel Joyce
   - why: A retired man's solitary walk across England unspools his whole interior life — regret, marriage, fatherhood — in the kind of patient, close-focus character study you're after, but it builds toward grace and connection rather than bleakness.
   - nonObvious: Its premise (an old man walking to visit a dying friend) sounds like it's setting up for tragedy, so readers often brace for heaviness that never fully arrives — it's warmer and more forgiving than the setup suggests.

### Case 7b — Rejection → clarify → widen escalation

1. **Pnin** — Vladimir Nabokov
   - why: It's a quiet character study of an émigré professor bumbling through a life he can't quite fit into, but Nabokov's ironic tenderness gives it a wry, aching texture that keeps it from ever going flat — warmth and sorrow held in the same sentence.
   - nonObvious: It gets overshadowed by Nabokov's more famous novels, so it rarely surfaces on 'quiet character study' lists even though it's arguably his gentlest, most human book.
2. **Convenience Store Woman** — Sayaka Murata
   - why: A deadpan, closely observed portrait of a woman who finds meaning in a life everyone else finds strange — it has the interiority you're after, but its flat comic delivery and quiet defiance make it feel alive rather than merely somber or merely cozy.
   - nonObvious: It sidesteps both traps you named: it's too odd and funny to read as 'dark,' and too spiky and unsentimental to read as soft, hopeful uplift.
3. **A Month in the Country** — J. L. Carr
   - why: A shell-shocked WWI veteran spends a summer restoring a church mural in a small English village — it's restrained, humane, and genuinely warm, but it earns that warmth through precise, unsentimental prose and a devastating quiet ending rather than easy comfort.
   - nonObvious: It's a short, unassuming novel that's easy to overlook next to bigger 'healing after war' books, yet it does the quiet-hopeful register with far more control and less schmaltz than most.

### Case 8 — Texture-match, not genre-match

1. **The Garden of Evening Mists** — Tan Twan Eng
   - why: Set in the misty highlands of post-war Malaya, the novel builds its garden and jungle setting with such sensory precision that you can smell the wet stone and hear the insects, while its central relationship between a former POW and a Japanese gardener with an unclear wartime past refuses to resolve into hero or villain.
   - nonObvious: It's often shelved as historical romance, but its real engine is unresolved moral culpability rendered through painstaking, almost horticultural detail about place.
2. **Drive Your Plow Over the Bones of the Dead** — Olga Tokarczuk
   - why: A snowbound Polish village on the Czech border is rendered in granular, almost obsessive detail — the cold, the animals, the isolated houses — and the narrator, an eccentric older woman implicated in a string of deaths, is never clearly righteous avenger or unreliable fanatic.
   - nonObvious: It wears the costume of a village murder mystery but is really an interior study of a narrator whose moral logic you're never sure to trust.
3. **The Memory of Love** — Aminatta Forna
   - why: Freetown, Sierra Leone, before and after its civil war is built up street by street, hospital ward by hospital ward, and the men at its center — a British psychologist, an aging academic, a young surgeon — all carry complicities and self-deceptions that keep shifting under you.
   - nonObvious: It's frequently framed as a straightforward war novel, but its real interest is in ordinary, sympathetic people's slow compromises rather than any clear victim/perpetrator line.

### Case 9 — Genre/category fidelity & adjacent expansion

1. **ZeroZeroZero** — Roberto Saviano
   - why: A relentless, globe-spanning investigation into the cocaine trade that moves like a thriller — Saviano embeds himself in the material the way a novelist would, tracing money and violence across continents with real narrative propulsion.
   - nonObvious: It sits outside the usual American true-crime canon, using Saviano's own journalistic risk (he's lived under police protection for years because of this reporting) as part of the story's tension rather than as backstory.
2. **Furious Hours** — Casey Cep
   - why: A deep-dive account of a real Alabama murder case and the true-crime book Harper Lee tried and failed to write about it — meticulously reported but paced and structured like a novel, with courtroom drama and literary mystery woven together.
   - nonObvious: It's less a straight crime story than a book about the seduction and difficulty of writing narrative nonfiction itself, which gives it a self-aware layer most 'thriller-paced true crime' picks don't have.
3. **Billion Dollar Whale** — Tom Wright and Bradley Hope
   - why: Wall Street Journal reporters reconstruct one of the largest financial frauds in history — a young Malaysian financier siphoning billions through Hollywood, celebrities, and shell companies — with the twists and reveals of a heist novel.
   - nonObvious: It swaps the familiar true-crime/murder framing for high-finance fraud, giving the same investigative-thriller pacing in a genre (financial journalism) readers rarely expect to grip like fiction.

### Case 10 — Creative-framing-only input

1. **Aura** — Carlos Fuentes
   - why: A young man is drawn into a crumbling old house lit only by candles, where an aging widow and her mysterious niece blur past and present — it's steeped in the exact mix of decay, flickering light, and quiet dread you're describing, without tipping into horror.
   - nonObvious: A Mexican gothic novella (told in eerie second person) that rarely comes up in English-language 'haunted house' recommendation lists, despite being a masterclass in unsettling atmosphere over shock.
2. **The Ocean at the End of the Lane** — Neil Gaiman
   - why: A pond that might be an ocean, an old farmhouse, half-remembered childhood terror resurfacing as an adult — it's moody and melancholic with real menace lurking at the edges, but the horror stays oblique and dreamlike rather than graphic.
   - nonObvious: Its fairy-tale surface makes it easy to underrate as 'just' whimsical Gaiman, but it's genuinely one of his darkest, most atmospheric books — a better fit for this specific mood than the obvious haunted-house classics.
3. **Kit's Wilderness** — David Almond
   - why: Set in a decaying English mining town built over flooded pits, with ghosts of dead children and a game that blurs the living and the lost, it's quietly haunting rather than frightening — atmosphere and grief over gore.
   - nonObvious: Shelved as YA/crossover fiction, it's often overlooked by readers hunting 'literary gothic' despite matching that register almost exactly, making it a genuine find rather than a default pick.

---

## Rubric scoring — Prompt v4 run, scored 2026-08-02

| Case | Relevance | Non-obviousness | Range | Real & correct | Traceability | Variety across sessions |
|---|---|---|---|---|---|---|
| **1** Rich, clear input | excellent | good* | excellent | excellent | excellent | weak† |
| **2** Anti-mainstream profile | excellent | good | excellent | excellent | excellent | weak† |
| **3** Vague input | good | good | excellent | excellent | weak‡ | weak† |
| **4** Explicit anti-mainstream | excellent | excellent | excellent | excellent | excellent | excellent |
| **5** Contradictory signals | excellent | good | good | excellent | excellent | excellent |
| **6** Hard turn-off | excellent | excellent | excellent | excellent | excellent | weak† |
| **7a** Rejection→clarify | excellent | good | good | excellent | excellent | excellent |
| **7b** Rejection→clarify→widen | good | good | excellent | excellent | good | excellent |
| **8** Texture-match | excellent | good | excellent | excellent | excellent | weak† |
| **9** Genre fidelity/expansion | excellent | excellent | excellent | excellent | excellent | excellent |
| **10** Creative-framing-only | excellent | good | good | excellent | excellent | excellent |

\* *Stoner* is now case 1's top pick across three separate prompt versions in this eval's history (Prompt v2 as case 3, the tool-wired run as case 1, and this run as case 1 again). It's a genuinely strong fit each time, but a pick that keeps surfacing as *the* answer to this specific brief is drifting toward becoming its own reflexive default — worth watching, not yet a fail.

† Flagged wherever a case shares a title with another case in this same 11-case run — see the narrow-pool finding in `docs/eval-log.md` (2026-08-02).

‡ Same structural caveat as every prior run: "just something good to read" carries no case-specific signal for the *why*s to trace to in this stateless, no-follow-up version.

### Non-obviousness: did the Prompt v4 reframe fix cases 6, 8, 9, 10, and did it move 7b?

Yes, substantially. Every title flagged as the specific offender in the prior scoring pass is gone, and the replacements hold up under the corrected "would a well-read reader already expect this" test, not just the letter of an award-naming rule:

- **Case 6 — fixed.** *Disgrace* is gone. New picks (*Hunger*, *The Memory of Love*, *Play It as It Lays*) are not reflexive answers to "literary fiction, morally complicated people, no fantasy." *Play It as It Lays* in particular is a clean example of the rule working as intended: the model compares the novel's obscurity to Didion's own more-famous nonfiction rather than leaning on an award claim.
- **Case 8 — improved, not fully fixed.** *Satantango* is gone, resolving the specific cross-case repeat with case 3 from the prior run. *The Garden of Evening Mists* persists unchanged from the prior run's case 8, though under the corrected non-obviousness test it's a defensible pick (decorated, but not the first-guess answer to "granular place + moral ambiguity"). *Drive Your Plow Over the Bones of the Dead* is a genuinely non-obvious addition despite its author being a Nobel laureate — another clean example of decoration not being penalized on its own.
- **Case 9 — fixed.** *Say Nothing* is gone. All three new picks are less-reflexive answers to the brief, and none makes an unconfident reception claim on spot-check (checked *Furious Hours*' bestseller/award status directly — accurate as stated).
- **Case 10 — fixed.** Both *We Have Always Lived in the Castle* and *The Little Stranger* are gone. *Kit's Wilderness* persists, which is expected and fine — it already held up as genuinely non-obvious under the reframe.
- **Case 7b — essentially unchanged.** *Convenience Store Woman* is now in its third consecutive run in this exact case slot. The genuine-widen problem also persists: 2 of 3 picks (*Pnin*, *Convenience Store Woman*) stay in the same quiet-literary register the input explicitly said didn't land twice already.

### New finding: a narrow-pool problem, confirmed and reframed

*The Memory of Love* (Aminatta Forna) appears in four of this run's 11 cases — 2, 3, 6, and 8 — all structurally distinct inputs. *Oblomov* and *Hunger* each appear in two cases. Five of 11 cases now share a title with another case in the same run, versus two of 11 in the prior run (the Satantango finding). A second rerun (below, same prompt, no changes) confirmed this is a repeatable pattern rather than a one-off — see `docs/eval-log.md` (2026-08-02) for the full analysis and the reframed conclusion: this is a general clustering tendency, not a fixed set of offender titles.

### Everything else

Relevance, Range, Real & correct, and Traceability remain strong. All 33 picks checked against real sources (Goodreads, publisher records, prize databases) — no hallucinated titles or misattributed authors.

---

## Prompt v4 — confirmation rerun, identical prompt, no changes (2026-08-02)

_Purpose: re-ran the same 11 `eval-set.md` cases a second time against the exact same Prompt v4 `SYSTEM_PROMPT` (no edits between runs) specifically to check whether the previous run's "Memory of Love" clustering was a one-off artifact of a single `search_books` call or a repeatable pattern. Not rescored against the full rubric — this run exists to answer that one question. See the narrow-pool finding in `docs/eval-log.md` (2026-08-02) for the analysis._

_Note: case 5's first API call in this run returned `stop_reason: end_turn` with an empty final text block — the model spent 312 of 314 output tokens on the `thinking` block and produced no answer, well under the 4000-token cap. Retried once with the same input; the output below is from that successful retry. See the dedicated `docs/eval-log.md` entry for this incident._

### Case 1

1. **Stoner** — John Williams
   - why: Like 'Remains of the Day', this follows an unassuming man whose entire emotional life is lived beneath a placid, dutiful surface — regret, love, and disappointment are all felt but almost never spoken, and the prose stays as restrained as the protagonist himself.
   - nonObvious: It doesn't rely on twists or incident; the quiet accumulation of a whole unremarkable-seeming life is the entire point, rewarding exactly the slow, immersive attention you're asking for rather than any dramatic hook.
2. **A Jest of God** — Margaret Laurence
   - why: A repressed small-town schoolteacher narrates her own stifled longing with the same excruciating self-control and unspoken ache that made Stevens's narration so heartbreaking — the gap between what she feels and what she allows herself to say is the whole novel.
   - nonObvious: It's a Canadian prairie novel rather than an English country-house one, so it gives you the same emotional restraint and interiority in a setting and voice you're less likely to have already encountered.
3. **Oblomov** — Ivan Goncharov
   - why: A slow, immersive character study of a man whose inner life is vast but who is constitutionally unable to act on his feelings or desires — the melancholy comes not from tragedy but from watching a whole life quietly slip away through inertia and reticence.
   - nonObvious: It's a 19th-century Russian novel, not the British or Japanese-diaspora literary fiction that usually gets paired with Ishiguro, so it broadens the tradition you're pulling from while matching the same slow, character-first pacing.

### Case 2

1. **So Long, See You Tomorrow** — William Maxwell
   - why: You described a quiet, character-driven novel whose emotional force snuck up on you — this one does exactly that: a spare, elegiac reconstruction of a childhood friendship shattered by a murder in rural Illinois, told with such restraint that its final gut-punch feels earned rather than engineered.
   - nonObvious: It's a slim, unassuming book about memory and guilt rather than plot — the kind that rewards patience instead of announcing its own importance, so it rarely surfaces on 'best novels' shortlists despite being extraordinarily well-made.
2. **Ties** — Domenico Starnone
   - why: Like the book that surprised you, this is deceptively small in scope — a marriage, an affair, decades of quiet fallout — and it builds to an ending that recasts everything you thought you understood about the characters, which is exactly the kind of sneaky, hits-hard-on-reflection payoff you're after.
   - nonObvious: Its English translation is fairly recent and its author isn't a household name outside Italian-lit circles, so it tends to get skipped even by readers actively hunting for translated fiction, despite being tighter and more devastating than many higher-profile domestic dramas.
3. **The Joys of Motherhood** — Buchi Emecheta
   - why: This traces one woman's life in colonial-era Lagos with the same unshowy, cumulative character focus you loved — no dramatic set pieces, just a life rendered so precisely that its quiet tragedy lands harder than most novels that try much louder.
   - nonObvious: It's a landmark of Nigerian literature that's genuinely underread outside African-literature courses, so it rarely appears on general 'hidden gem' lists even though it's as accomplished as any postcolonial classic you'd name.

### Case 3

1. **The Garden of Evening Mists** — Tan Twan Eng
   - why: A rich, immersive story about memory, grief, and an unlikely apprenticeship in a Malayan garden after WWII — the kind of slow-burn, beautifully written novel that rewards someone who just wants to sink into a good book for a while.
   - nonObvious: It's a decorated novel, but it rarely shows up on generic 'best books' lists, so it still feels like a discovery rather than a default pick.
2. **A Fine Balance** — Rohinton Mistry
   - why: A sweeping, deeply humane novel following four strangers thrown together during India's Emergency — big-hearted, emotionally devastating, and absorbing in the way great character-driven fiction is meant to be.
   - nonObvious: It's often overshadowed by flashier Booker-era titles despite being one of the most fully realized character novels of its period, so it satisfies without being the reflexive answer.
3. **Hunger** — Knut Hamsun
   - why: A short, feverish, darkly funny portrait of a starving writer's unraveling mind in 19th-century Oslo — for a reader who wants something genuinely good rather than merely comfortable, this delivers intensity and strangeness in under 250 pages.
   - nonObvious: It predates and quietly influenced much of modernist psychological fiction, but it's rarely the book people reach for when asked for 'something good to read,' making it a fresher entry point than its more famous descendants.

### Case 4

1. **The Memory of Love** — Aminatta Forna
   - why: A slow-burning, emotionally devastating novel about memory, trauma, and love set in postwar Sierra Leone — the kind of book that rewards patience with real depth rather than easy catharsis.
   - nonObvious: It rarely appears on generic 'best novels' lists despite being as accomplished as many Booker-adjacent books, likely because its setting and quiet pacing don't fit the usual buzz-book mold.
2. **The Melancholy of Resistance** — László Krasznahorkai
   - why: For a reader wanting something that leaves a mark rather than just entertains — this is a hypnotic, unsettling allegory about a town's slow unraveling, built from long, cascading sentences that pull you into a genuinely strange headspace.
   - nonObvious: Krasznahorkai has real critical weight, but this particular novel is less reached-for than his more filmed/adapted work, and its density means it rarely lands on quick 'if you liked X' lists.
3. **The Informers** — Juan Gabriel Vásquez
   - why: A tightly constructed Colombian novel about a hidden wartime betrayal resurfacing decades later — it has the moral complexity and slow-reveal tension of a book that sticks with you and demands to be talked about.
   - nonObvious: Vásquez is a serious, prize-recognized writer, yet this early novel gets overshadowed by louder Latin American 'boom' names, making it a fresher entry point into the region's literature.

### Case 5

1. **The Warden** — Anthony Trollope
   - why: It gives you the same close, sympathetic attention to a character's inner moral struggle that you loved in War and Peace, but wrapped in a novella-length, gently comic story about small-town church politics rather than a continent-spanning epic.
   - nonObvious: Trollope is often recommended for his multi-volume Barchester saga as a whole, but The Warden alone is short, warm, and complete in itself — a way to get his psychological insight without committing to the sprawling series.
2. **Memento Mori** — Muriel Spark
   - why: Spark builds a whole ensemble cast of elderly characters, each with a distinct inner life and history, the way Tolstoy does — but she does it in under 200 pages with dry, mordant wit instead of weighty narration.
   - nonObvious: People new to Spark usually reach for The Prime of Miss Jean Brodie; this earlier, darker comedy about mortality and vanity is a sharper fit for someone who wants dense characterization delivered fast.
3. **Sweet Thursday** — John Steinbeck
   - why: Like War and Peace's community of vividly drawn lives, this gives you a whole cast of Monterey misfits and dreamers, each sketched with real affection and depth, but the tone is sunny, funny, and the pace breezes along.
   - nonObvious: Steinbeck's 'light' reputation usually points readers to Cannery Row or Of Mice and Men (which is anything but light); this sequel is his purest shot of warmth and comedy, and it's easy to miss because it lives in Cannery Row's shadow.

### Case 6

1. **The Informers (Los informantes)** — Juan Gabriel Vásquez
   - why: A slow-burn character study about a father and son unraveling a decades-old betrayal in Colombia — the prose is precise and restrained, and every character's moral position shifts the deeper you go, which fits your love of morally complicated people rendered with real craft.
   - nonObvious: Vásquez is a major voice in contemporary Latin American fiction but this particular novel rarely tops 'best of' lists in English-language circles, so it avoids being the reflexive pick a well-read reader would already have on their shelf.
2. **Play It as It Lays** — Joan Didion
   - why: A spare, devastating portrait of a woman drifting through a hollowed-out Hollywood existence — Didion's sentences are famously exact and cold, and the protagonist is neither sympathetic nor villainous, just achingly human, which suits a taste for beautiful prose over easy moral resolution.
   - nonObvious: Didion's nonfiction gets recommended constantly, but this early novel — arguably her sharpest character work — tends to get passed over in favor of her essays, making it a less predictable route into her writing.
3. **The Memory of Love** — Aminatta Forna
   - why: Set in post-civil-war Sierra Leone, this novel weaves together an aging professor's guilt-ridden past with a young surgeon's present, building complicated, compromised characters through prose that's lyrical without ever tipping into sentimentality.
   - nonObvious: It has real literary weight and craft but sits outside the usual rotation of book-club staples, so it offers genuine surprise rather than a familiar 'if you liked X' suggestion.

### Case 7a

1. **My Ántonia** — Willa Cather
   - why: A quiet, deeply observed character study of pioneer life on the Nebraska prairie, carried by warm, elegiac prose rather than plot tension — it dwells on resilience, friendship, and the dignity of ordinary lives instead of tragedy for its own sake.
   - nonObvious: Cather's prairie novels get cited for 'American classics' lists generally, but she's rarely the reflex answer for 'warm literary character study' requests, which tend to skew contemporary.
2. **The Chosen** — Chaim Potok
   - why: An intimate, slow-burning study of two boys and their fathers in 1940s Brooklyn — full of intellectual and emotional depth but grounded in mutual respect, faith, and reconciliation rather than despair.
   - nonObvious: It's substantial and character-driven like the darker literary fiction often recommended for 'quiet character study' fans, but its emotional center is deliberately generous and hopeful, which keeps it off most bleak-lit adjacent lists.
3. **Eleanor Oliphant is Completely Fine** — Gail Honeyman
   - why: A closely observed, interior character study of a woman rebuilding herself after isolation and old trauma — it doesn't shy from hard material but resolves toward genuine warmth, connection, and hard-won hope rather than bleakness.
   - nonObvious: It's often shelved as upmarket commercial fiction rather than 'literary character study,' so readers coming from a Stoner-adjacent frame of reference tend to overlook it despite the fit.

### Case 7b

1. **The Summer Book** — Tove Jansson
   - why: A grandmother and her granddaughter spend summers on a tiny Finnish island, trading barbs and observations about death, art, and boredom — it's a character study built entirely from small moments, but it has real teeth and dry wit rather than the soft-focus warmth that left you cold last round.
   - nonObvious: Jansson's adult fiction is often eclipsed by her Moomin books, so it rarely shows up on 'quiet literary fiction' lists despite being sharper and stranger than most books sold as cozy or hopeful.
2. **A Month in the Country** — J.L. Carr
   - why: A shell-shocked WWI veteran spends a summer restoring a medieval mural in a Yorkshire church — it's restorative and gentle without ever tipping into saccharine, giving you the hopeful register you asked for but earned through restraint and specificity rather than sentiment.
   - nonObvious: It's a short, unshowy novel that does its emotional work through craft and understatement rather than incident, so it tends to get passed over even though it delivers exactly the texture that 'warm but not flat' recommendations usually fail to.
3. **Convenience Store Woman** — Sayaka Murata
   - why: Keiko has worked the same convenience store for eighteen years and finds in its rules and rhythms a kind of peace the world keeps telling her to be ashamed of — it's a deadpan, deeply interior character study that's funny and unsettling in equal measure, never sliding into either misery or false uplift.
   - nonObvious: Its flatness of affect is the point, not a flaw — it uses the same quiet, understated register as more conventional 'gentle' character studies but toward a much odder, more clear-eyed end, which is why it tends to surprise readers who expect a tidy redemption arc.

### Case 8

1. **The Garden of Evening Mists** — Tan Twan Eng
   - why: The Malayan highlands—the mist, the tea plantations, the Japanese garden being built stroke by stroke—are rendered so precisely you can feel the humidity, and at its center is a former Imperial gardener whose wartime past keeps you guessing whether he's a war criminal, a grieving artist, or both.
   - nonObvious: It's often filed under historical romance, but its moral murkiness and sensory density make it a sharper fit for this request than the more frequently cited WWII-Pacific novels.
2. **Paris Trout** — Pete Dexter
   - why: Small-town 1950s Georgia is built in exacting, oppressive detail—the store, the courthouse, the red dirt roads—and the title character is a genuinely disturbing study in how a community can protect a man everyone half-knows is monstrous, without letting you settle into easy judgment of anyone around him.
   - nonObvious: It won the National Book Award decades ago but has faded from the default 'morally gray Southern fiction' conversation, so it lands as a discovery rather than a repeat suggestion.
3. **The Memory of Love** — Aminatta Forna
   - why: Freetown, Sierra Leone, before and after the civil war is drawn with such granular texture—hospital wards, dust, heat, the weight of unspoken history—that place becomes almost a character, while the three intertwined men at its core each carry complicities that resist clean moral sorting.
   - nonObvious: It's frequently overshadowed by more famous West African war novels, but its psychological ambiguity and slow-built atmosphere are arguably a closer match to this specific request.

### Case 9

1. **Billion Dollar Whale** — Tom Wright and Bradley Hope
   - why: This is investigative journalism at its most propulsive — Wall Street Journal reporters unraveling the 1MDB fraud, tracing stolen billions through shell companies, Hollywood parties, and international cover-ups with the pacing of a heist thriller.
   - nonObvious: Financial-crime journalism rarely gets recommended alongside true crime, but the scale of the con and the reporters' relentless digging make it every bit as tense as a novel — a genuinely under-tapped vein for thriller-pace nonfiction.
2. **Furious Hours** — Casey Cep
   - why: A deep-dive into a string of Alabama insurance murders and Harper Lee's failed attempt to write her own true-crime book — meticulously reported, novelistic in structure, with real suspense about who did what and why.
   - nonObvious: It sits adjacent to the genre's most famous title without being it — Cep uses the specter of 'In Cold Blood' as a subject rather than a template, making it a fresher entry point into literary true crime.
3. **Frozen in Time** — Owen Beattie and John Geiger
   - why: A historical account — the doomed 1845 Franklin Arctic expedition — reconstructed through forensic exhumation and detective work, unfolding with the dread and reveal-by-reveal momentum of a thriller rather than a dry history text.
   - nonObvious: Most 'true story as thriller' lists default to crime or war reporting; this pick shows the same craft applied to a 19th-century polar mystery solved through modern forensic science, a different flavor of deep-dive nonfiction entirely.

### Case 10

1. **Kit's Wilderness** — David Almond
   - why: Set in a crumbling English mining town threaded with old flooded pits and a haunting children's game, it captures exactly the waterlogged, decaying, ghost-adjacent mood you're after without tipping into outright horror.
   - nonObvious: It's shelved as YA/literary crossover, so it rarely appears on 'atmospheric gothic' lists even though its slow-burn dread and lyrical prose earn a place there.
2. **The Death of Jane Lawrence** — Caitlin Starling
   - why: A marriage of convenience unravels inside a decaying manor with a locked wing and something wrong in the walls — candlelit, unsettling, and steeped in dread rather than gore.
   - nonObvious: A recent gothic that reworks Bluebeard/Jane Eyre tropes into something stranger and more clinical, so it dodges the reflexive 'read Rebecca again' answer.
3. **Farewell Miss Julie Logan** — J. M. Barrie
   - why: A minister in an isolated, snowbound Scottish glen becomes entangled with a woman who may not be entirely of the living world — quiet, melancholy, and eerie rather than frightening.
   - nonObvious: Written by the author of Peter Pan late in his career, it's a genuinely haunting ghost novella that almost never surfaces on genre recommendation lists.
