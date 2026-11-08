// Cards are honest (decision 2.26): enthusiastic, but never claiming a book is something it isn't,
// including how it feels to read, and naming a real gap with what the reader asked for. The
// golden-request test pins the exact wording; this pins the rules it must keep.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CARD_SYSTEM_PROMPT } from "@/lib/engine/cards/writeCards";

test("the card writer's instructions keep the honesty rules", () => {
  assert.match(CARD_SYSTEM_PROMPT, /never say the book is something it isn't or promise what it won't deliver/);
  assert.match(CARD_SYSTEM_PROMPT, /tone, mood, pace and style must agree with the catalog descriptions and the Hardcover moods/);
  assert.match(CARD_SYSTEM_PROMPT, /Never claim it matches something it doesn't/);
  assert.match(CARD_SYSTEM_PROMPT, /say so briefly and kindly/);
});
