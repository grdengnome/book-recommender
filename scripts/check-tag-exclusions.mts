import { readFileSync } from "fs";
import {
  isRatingWidgetTag,
  isShelfNoiseTag,
  isExcludedTag,
} from "../lib/hardcover/tagExclusions";

const tags: { tag: string; count: number }[] = JSON.parse(
  readFileSync("scratchpad/hardcover-tags-gt100.json", "utf8"),
);

const ratingHits = tags.filter((t) => isRatingWidgetTag(t.tag));
const shelfHits = tags.filter((t) => isShelfNoiseTag(t.tag) && !isRatingWidgetTag(t.tag));
const excluded = tags.filter((t) => isExcludedTag(t.tag));
const kept = tags.filter((t) => !isExcludedTag(t.tag));

console.log(`Total tags: ${tags.length}`);
console.log(`Excluded by RATING_WIDGET_TAGS: ${ratingHits.length}`);
console.log(`Excluded by SHELF_NOISE_PATTERNS: ${shelfHits.length}`);
console.log(`Total excluded (isExcludedTag): ${excluded.length}`);
console.log(`Kept: ${kept.length}`);

console.log("\n--- RATING_WIDGET_TAGS matches ---");
for (const t of ratingHits) console.log(`  ${t.tag} (count=${t.count})`);

console.log("\n--- SHELF_NOISE_PATTERNS matches (sample, sorted by count desc) ---");
for (const t of shelfHits.sort((a, b) => b.count - a.count)) {
  console.log(`  ${t.tag} (count=${t.count})`);
}

console.log("\n--- KEPT tags (sanity check — first 40 by count, should look like real taste/genre/mood content) ---");
for (const t of kept.slice(0, 40)) console.log(`  ${t.tag} (count=${t.count})`);
