# Checkpoint — Question Architecture & Eval Set Review

*Converted from the original session checkpoint doc. This is a decision log, not a spec — see `spec.md` for the current merged state. Kept here for historical traceability of *why* each decision was made.*

## Decisions locked this session

1. **Question input mode** — every question presents as clickable/tappable options with a "write your own" free-text fallback. No question requires typing.
2. **Trio structure vs. wording** — anchor/why/appetite stay a fixed structure, but wording rotates through pools of 4–5 phrasings per category.
3. **Creative/visual/emoji framing** — woven into every category's phrasing pool, capped at ~1 per session. Not a separate "spice" layer.
4. **Turn-off question** — never always-asked, fully adaptive.
5. **Rejection path** — redesigned into a mini adaptive loop with a two-step clean exit: editable AI read-back of taste profile, then intentional widening to varied picks.
6. **Reflect-back** — fully dynamic, constructed from whichever questions actually fired that session.
7. **Eval rubric** — added a 6th dimension (variety across sessions), moved to a 4-point scale (fail/weak/good/excellent).
8. **Adaptive logic** — reversed the original hard cap of 5 questions in favor of a confidence-based stopping rule.
9. **Test case updates** — #10 reworded to "creative-framing-only input"; #7 split into clarify-step and clarify→widen-escalation cases.
10. **Cover image source** — Open Library (primary) → Google Books (fallback) → designed placeholder (final fallback).

## Still open at the time of this checkpoint

- Anti-repeat for returning users — **resolved since**: v0 is stateless, deferred to v1 (see `spec.md` Section 6).
- The exact numeric threshold for the "confidence isn't improving" guardrail — still open, needs real testing data.
- New test cases from this session — none identified yet.

## Why this file exists

Anyone (including future-you, including Claude Code) reading this repo cold should be able to see not just *what* the current spec says, but why the reversals happened — e.g., the adaptive-logic hard cap was deliberately removed, not forgotten.
