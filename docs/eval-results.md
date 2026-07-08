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

