// Step 2 verification: run the new taste -> Hardcover tag mapping function against
// 4 structurally different real eval-case inputs (verbatim from scratchpad/run-eval.mjs
// / docs/eval-log.md), checking specifically for the failure mode the design constraint
// was meant to prevent: different inputs collapsing onto the same 2-3 generic tags.
import { mapTasteToHardcoverTags } from "../lib/hardcover/mapTasteToTags";

const CASES = [
  {
    id: "case-1",
    label: "Rich, clear input — restrained, melancholic, quiet character study",
    tasteDescription:
      "My favorite book is 'The Remains of the Day' by Kazuo Ishiguro — I loved how restrained and heartbreaking it was, the way so much emotion stayed unspoken beneath the surface. I'm in the mood for something similarly quiet and melancholic, character-driven rather than plot-heavy. I have plenty of time and want to sit with a slow, immersive book.",
  },
  {
    id: "case-6",
    label: "Hard turn-off — literary fiction, morally complicated people, no fantasy",
    tasteDescription:
      "I love literary fiction — character studies, beautiful prose, morally complicated people. I will not read fantasy under any circumstances: no magic systems, no invented worlds.",
  },
  {
    id: "case-8",
    label: "Texture-match — granular sense of place, morally ambiguous characters",
    tasteDescription:
      "I'm looking for something with a really granular, immersive sense of place — I want to feel like I'm actually there — and characters who are morally ambiguous, not clearly good or bad. Genre doesn't matter much to me as long as it has that texture.",
  },
  {
    id: "case-9",
    label: "Narrative nonfiction — investigative journalism, thriller pacing",
    tasteDescription:
      "I love narrative nonfiction — real events told with the pacing and craft of a novel. Specifically deep-dive investigative journalism or historical accounts that read like thrillers. That's exactly what I'm looking for right now.",
  },
];

const results: { id: string; label: string; tagNames: string[] }[] = [];

for (const c of CASES) {
  const result = await mapTasteToHardcoverTags(c.tasteDescription);
  results.push({ id: c.id, label: c.label, tagNames: result.tagNames });
  console.log(`\n${c.id} — ${c.label}`);
  console.log(`  input: "${c.tasteDescription}"`);
  console.log(`  selected tags: ${JSON.stringify(result.tagNames)}`);
  console.log(`  tag IDs: ${JSON.stringify(result.tagIds)}`);
}

console.log("\n\n########## Collapse check: any two cases landing on the identical tag set? ##########");
let anyCollapse = false;
for (let i = 0; i < results.length; i++) {
  for (let j = i + 1; j < results.length; j++) {
    const a = new Set(results[i].tagNames);
    const b = new Set(results[j].tagNames);
    const sameSize = a.size === b.size;
    const identical = sameSize && [...a].every((t) => b.has(t));
    const overlap = [...a].filter((t) => b.has(t));
    console.log(
      `${results[i].id} vs ${results[j].id}: ${identical ? "IDENTICAL SET (collapse!)" : `overlap ${overlap.length}/${a.size}`}${overlap.length ? ` -> shared: ${overlap.join(", ")}` : ""}`,
    );
    if (identical) anyCollapse = true;
  }
}
console.log(`\nAny full-set collapse detected: ${anyCollapse}`);
