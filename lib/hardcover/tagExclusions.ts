// Excludes two kinds of noise found in Hardcover's `Tag` category (docs/progress-log.md,
// Aug 6 + Aug 9 2026 sessions) before it's used as taste-vocabulary source material.

// Confirmed forced-choice rating-widget tags: per-user decomposition showed every tagger
// picks at most one per axis (valence, development, diversity, drive, pace), matching a
// fixed-choice UI widget rather than organic multi-select tagging. Confirmed exhaustive
// for the `Tag` category at count>100 as of the Aug 9 full-category scan — not checked
// against other tag categories (Pace, Content Warning, Easiness, Queer, Member, ...) or
// against tags below the count>100 threshold.
export const RATING_WIDGET_TAGS: readonly string[] = [
  "Loveable Characters",
  "Unloveable Characters",
  "Strong Character Development",
  "Weak Character Development",
  "Diverse Characters",
  "Not Diverse Characters",
  "Character driven",
  "Plot driven",
  "A mix driven",
  "N/A driven",
  "fast-paced",
  "medium-paced",
  "slow-paced",
];

// Shelf-management / personal-library artifacts: import sources, reading platforms,
// formats, and reading-status markers that ride along in the `Tag` category but carry
// no taste signal. Named entries are confirmed from the Aug 6 scan; the unnamed
// structural patterns (import/from-/#/digitally-) and platform list catch likely variants
// the user flagged rather than every one seen so far.
export const SHELF_NOISE_PATTERNS: readonly RegExp[] = [
  // named noise tags from the Aug 6 scan
  /calibre[\s-]?import/i,
  /digitally-?own/i,
  /\baudible\b/i,
  /\baudiobook\b/i,
  /humble\s?bundle/i,
  /\bvpl\b/i,
  /\blibby\b/i,
  /from-audible/i,
  /\bkindle\b/i,
  /\bebook\b/i,
  /obsidian-?import/i,
  /to-read/i,
  /^#all#$/i,

  // structural patterns for likely variants
  /import/i, // any "X Import" / "X-import" tag
  /^from-/i, // "from-<source>" acquisition tags (from-nas, from-audible, ...)
  /^#/, // hashtag-style personal-shelf markers (#digitally-own, #ALL#, ...)
  /^digitally-/i, // "digitally-<x>" beyond just "own"
  /^\[?"?shelf:/i, // personal custom-shelf labels ("Shelf: 02 ...", incl. the malformed `["Shelf: ...]` variant)

  // other common ebook/audiobook/library platforms and formats
  /\bkobo\b/i,
  /\boverdrive\b/i,
  /\bhoopla\b/i,
  /\bscribd\b/i,
  /\bnook\b/i,
  /google\s?play/i,
  /\bpaperback\b/i,
  /physical\s?book/i,
];

function normalize(tagName: string): string {
  return tagName.trim().toLowerCase();
}

const RATING_WIDGET_SET = new Set(RATING_WIDGET_TAGS.map(normalize));

export function isRatingWidgetTag(tagName: string): boolean {
  return RATING_WIDGET_SET.has(normalize(tagName));
}

export function isShelfNoiseTag(tagName: string): boolean {
  return SHELF_NOISE_PATTERNS.some((pattern) => pattern.test(tagName));
}

export function isExcludedTag(tagName: string): boolean {
  return isRatingWidgetTag(tagName) || isShelfNoiseTag(tagName);
}
