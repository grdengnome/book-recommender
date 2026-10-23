// Question-core test set (2026-10-23, branch experiment/question-core). Each eval case as
// the real flow's answers (spec §4a): anchor, why, appetite (comfort ↔ strange), plus the
// optional follow-ups mood, length and turn-off. A field is filled only where the original
// text states it; `inferred` lists fields picked to match the text rather than stated in it.
// A length the original didn't state as a band keeps only the reader's words, so no band
// constraint is added.
// Typed answers keep the reader's own words.
//
// Until the taste-summary step exists (§4f), answers become the engine's input through
// toTasteDescription(): the plain stitched template that is §4f's fallback. One line per
// answer, so removing an answer removes exactly one line.

// Draft labels for the appetite scale (spec §4a: comfort ↔ strange, as a scale).
export const APPETITE = {
  1: "Pure comfort: familiar and satisfying",
  2: "Mostly comfort",
  3: "In between",
  4: "Somewhat surprising",
  5: "Surprising and a little strange",
};

export function toTasteDescription(a) {
  const lines = [];
  if (a.anchor) lines.push(`A book I loved: ${a.anchor}`);
  if (a.why) lines.push(`What stuck with me: ${a.why}`);
  if (a.appetite) lines.push(`Comfort or surprise: ${APPETITE[a.appetite]}`);
  if (a.mood) lines.push(`What I'm in the mood for right now: ${a.mood}`);
  if (a.length) lines.push(`Length: ${a.length}`);
  if (a.turnOff) lines.push(`Not in the mood for: ${a.turnOff}`);
  return lines.join("\n");
}

export const CASES = [
  // --- Converted eval cases ---
  {
    id: "case-1",
    anchor: "The Remains of the Day by Kazuo Ishiguro",
    why: "how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface",
    appetite: 2,
    mood: "something similarly quiet and melancholic, character-driven rather than plot-heavy",
    length: "I have plenty of time and want to sit with a slow, immersive book",
    inferred: ["appetite"],
  },
  {
    id: "case-2",
    why: "A novel I read a few years back: quiet, character-driven, nothing anyone around me had heard of, and one of the best books I've ever read. It surprised me how hard it hit.",
    appetite: 4,
    mood: "more like that: no bestsellers, no 'if you liked X' consensus picks, just books that are genuinely great regardless of how well-known they are",
    inferred: ["appetite"],
    note: "No title for the anchor, so its description goes in why.",
  },
  {
    id: "case-3",
    why: "Just something good to read.",
    appetite: 3,
    inferred: ["appetite"],
    note: "Vague input. In the real flow this typed answer could be dropped as unusable (§4a), leaving appetite only.",
  },
  {
    id: "case-4",
    appetite: 5,
    mood: "nothing everyone's already read. I'm tired of every list recommending the same five books.",
    inferred: ["appetite"],
    note: "Stated as an anti-mainstream demand; mapped to the top of the appetite scale.",
  },
  {
    id: "case-5",
    anchor: "War and Peace by Leo Tolstoy",
    why: "the sprawling scope and how deeply it got into every character's inner life",
    appetite: 2,
    mood: "something light, nothing heavy",
    length: "quick to read, nothing slow",
    inferred: ["appetite"],
  },
  {
    id: "case-6",
    why: "I love literary fiction: character studies, beautiful prose, morally complicated people",
    appetite: 3,
    turnOff: "fantasy, under any circumstances: no magic systems, no invented worlds",
    inferred: ["appetite"],
    note: "No anchor book.",
  },
  // case-7a and case-7b test the rejection path (§4g), not the questions; left as free text.
  {
    id: "case-8",
    why: "a really granular, immersive sense of place (I want to feel like I'm actually there) and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture.",
    appetite: 4,
    inferred: ["appetite"],
    note: "No anchor book. 'Genre doesn't matter' read as open to surprise.",
  },
  {
    id: "case-9",
    why: "I love narrative nonfiction: real events told with the pacing and craft of a novel. Specifically deep-dive investigative journalism or historical accounts that read like thrillers.",
    appetite: 2,
    inferred: ["appetite"],
    note: "No anchor book. 'That's exactly what I'm looking for' read as wanting the familiar.",
  },
  {
    id: "case-10",
    appetite: 3,
    mood: "🌊🏚️👻🕯️ moody, atmospheric, a little unsettling",
    turnOff: "full horror",
    inferred: ["appetite"],
    note: "No anchor or why. The emoji are the creative-framing answer, which maps to mood here.",
  },

  // --- New draft cases ---
  {
    id: "new-no-favorite",
    anchor: "I can't really think of one, I haven't read much in years",
    appetite: 2,
    mood: "Funny, Hopeful",
    length: "A weekend (120–300 pages)",
    turnOff: "Long series",
    note: "Anchor typed as a non-answer; why skipped.",
  },
  {
    id: "new-mood-vs-anchor",
    anchor: "Blood Meridian by Cormac McCarthy",
    why: "the writing: biblical, brutal, relentless",
    appetite: 4,
    mood: "Cozy, Uplifting",
    length: "A weekend (120–300 pages)",
    turnOff: "Gore",
  },
  {
    id: "new-gift",
    anchor: "Lonesome Dove by Larry McMurtry. It's my dad's favorite, and this is a gift for him",
    why: "the characters: he loves big characters, the American West and real history",
    appetite: 2,
    mood: "Adventurous",
    turnOff: "Steamy scenes",
    note: "The flow has no 'who is it for' question; the gift is only in the typed anchor.",
  },
  {
    id: "new-nonfiction-only",
    anchor: "Sapiens by Yuval Noah Harari",
    why: "the ideas: it changed how I see everything",
    appetite: 4,
    mood: "Thoughtful",
    turnOff: "Fiction. I only read nonfiction",
  },
  {
    id: "new-strong-dislike",
    anchor: "The Secret History by Donna Tartt",
    why: "the writing: sharp, clever, a little cold",
    appetite: 3,
    turnOff: "Everyone loved Where the Crawdads Sing and I didn't: too sentimental, and the plot felt contrived",
    note: "The flow has no dislike question; it's typed into the rule-out's write-your-own field.",
  },
];

// Step 2 (ablation): cases and the answers removed one at a time ("mood+length" removes both).
// Each case also runs twice with all answers. new-mood-vs-anchor tests whether the engine
// follows the current mood or the anchor.
export const ABLATION = {
  "case-1": ["anchor", "why", "appetite", "mood+length"],
  "case-5": ["anchor", "why", "appetite", "mood+length"],
  "case-6": ["why", "appetite", "turnOff"],
  "case-8": ["appetite"],
  "case-10": ["appetite", "mood", "turnOff"],
  "new-mood-vs-anchor": ["mood"],
};
