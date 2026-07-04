# Question Bank

The actual candidate wording, phrasing pools, and mechanics for the recommender's question flow. This is content, not architecture — the *decisions* about how this content behaves live in `spec.md` Section 4a; this file is the material itself, and is expected to grow (more phrasings per pool) independent of the spec.

---

## The always-asked backbone

Structure is fixed; wording rotates through a pool per category (draft below has 1 example per category — expand to 4–5 each before this is v0-ready).

**1. The anchor** — the highest-signal question: a known point in the user's taste that everything else calibrates against.
> "Tell me a book you loved and couldn't put down."
Free text or quick-pick.

**2. The why** (adaptive follow-up to the anchor) — where taste *texture* comes from (e.g. "granular sense of place + moral ambiguity" lives here, not in genre tags).
> "What stuck with you about it?"
Optional quick-pick facets: *the writing* / *the world* / *the characters* / *the ideas* / *the feeling it left* — plus an open field.

**3. Appetite** — a spectrum, not a binary. The user-controlled anti-mainstream lever; tells the recommender how far off the beaten path to go.
> "Comfort and satisfying, or surprising and a little strange?"

---

## Adaptive questions (asked only when signal is thin or contradictory)

**4. Mood** — what they want from a read right now.
> Escape / provoke / learn / unwind.
(This is the question most often dressed as image-answer — see the creative pool below.)

**5. Commitment**
> "A quick read or a long immersion?"

**6. The turn-off** — genres/themes to avoid. High signal, prevents the one bad rec that breaks trust. Never forced.
> "Anything you're *not* in the mood for?"

---

## Creative/visual/emoji framing

**[RESOLVED — Option A, see spec.md 4a]** Not a separate track. These are alternate *phrasings* woven into the pools above — capped at ~1 (occasionally 2) creative-style question per session. Variety comes from *which* category goes creative that session, not from stacking multiple.

Candidate creative phrasings (assign these into the category pools above as alternates, don't run them as a separate step):

- **Emoji cluster (the wildcard):** "Pick three, no labels" → the model infers a vibe from the emoji chosen. Bold, ambiguous, fun. Use rarely, and always *alongside* substantive signal, never alone.
- **Image-as-mood:** mood shown as evocative images (a fireside, a storm, a neon street, a sunlit window) instead of words. Maps to the Mood question (#4).
- **Creative provocation:** "Which world would you rather be lost in?" / "A door, a map, or a letter?" — flavorful, on-theme, occasional. Maps to Appetite (#3) or Mood (#4).

**Build note:** emoji are free (just text characters) — usable in v0. Custom mood-illustrations are real design work — defer bespoke art to v1, use emoji/simple iconography for now.

---

## Adaptive logic (how the model decides what to ask)

1. Run the always-asked trio (anchor → why → appetite).
2. Evaluate signal:
   - **Rich + coherent → recommend.** Don't ask more just because more questions are available.
   - **Vague or contradictory → ask 1–2 targeted follow-ups** from the adaptive set (mood/commitment/turn-off), specifically targeting whichever category is thin — not a generic "ask another question."
3. No hard question cap (see spec.md 4a) — stop once confidence is genuinely no longer improving, using best judgment as the guardrail rather than a fixed number.

---

## Rejection path (redesigned — see spec.md 4a)

User dislikes the 3 cards:

1. **Clarify step** — a small rotating pool of clarifying questions, e.g.:
   > "Too safe? Too heavy? Wrong mood?"
2. **If that doesn't land — clean exit, two steps:**
   - **Editable taste read-back:** surface the model's current read of the user's taste in plain language, and let them correct the specific wrong part.
     > "Here's what I'm hearing: comfort read, character-driven, nothing too dark." *(user edits/corrects)*
   - **Deliberate widening:** if still unresolved, don't narrow further — offer intentionally varied "wildcard" picks instead.
   - *(Deferred to v1: browse-by-category mode as a further fallback.)*

---

## Reflect-back ("generation theater")

Shown while the model generates (real latency, not a spinner) — a short sequence of transition screens that progressively mirror the user's *actual* inputs. Must be built dynamically from whichever questions actually fired that session (can't assume mood/commitment/turn-off were asked).

Rule: **built from real answers, quoted concretely** — specific enough that it couldn't describe just anyone. That's the difference between "how did it know me" and a horoscope; the astrology *feel*, not the astrology *vagueness*.

Example sequence (illustrative — the real one is generated per-session, not scripted):
> "You loved *Stoner*…" → "…you want something that lingers…" → "…and you're feeling adventurous…" → "Here's what I found."

---

## Open / not yet decided

- Expand each backbone category from 1 example phrasing to a full pool of 4–5.
- How many creative/spice variants to write for v0 rotation.
- Scoring mechanic for evals: pure self-review vs. a small structured scorecard (see `eval-set.md`).
