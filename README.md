# Book Recommender

An AI-powered book recommendation app — built as a portfolio project to demonstrate real product thinking around AI: taste elicitation, eval-driven prompt development, and honest handling of the "obvious recommendation" problem most book-rec tools fall into.

## The problem

Most book recommenders default to consensus picks — the same 10 books every "if you liked X" list surfaces. The interesting product problem isn't "call an LLM," it's:

- How do you get enough *signal* about someone's taste without turning the app into a survey?
- How do you keep an AI recommender from defaulting to mainstream, obvious picks?
- How do you know if it's actually working, rather than just eyeballing outputs?

This project treats those three questions as the actual engineering problems, and treats "call the Anthropic API" as the easy part.

## Approach

1. **Question architecture, not a form.** A fixed backbone (anchor book → why it stuck → appetite for the familiar vs. the strange) carries the real signal, with rotating phrasing pools so repeat use doesn't feel like the same quiz every time. Follow-up questions are adaptive — asked only when signal is thin, never on a fixed schedule.
2. **Eval-driven development.** Before writing recommendation logic, this project defines a rubric (relevance, non-obviousness, range, correctness, traceability, variety-across-sessions) and a bank of test cases — including deliberately hard ones (contradictory signals, anti-mainstream demands, rejection-and-recovery). Prompt changes get scored against this set, not vibes.
3. **Honest fallbacks.** Cover images, rejection handling, and low-signal cases all have designed fallback paths rather than silent failure or hallucination.

Full design rationale lives in [`/docs`](./docs) — this repo's decisions are documented as they were made, including the ones that got reversed.

## Stack

- **Next.js** (React) — frontend + co-located API routes for the LLM calls, so the recommendation logic and the UI live in one deployable app.
- **Anthropic API** (Claude) — the recommendation engine itself.
- Deploy target: Vercel.

## Status

🚧 Early build. Current focus: proving the core recommendation loop works against the eval set before layering on UI.

## Getting started

```bash
npm install
npm run dev
```

Requires an `ANTHROPIC_API_KEY` in `.env.local` (not committed — see `.gitignore`).

## Docs

- [`docs/spec.md`](./docs/spec.md) — full product spec, current version
- [`docs/question-bank.md`](./docs/question-bank.md) — actual question wording, phrasing pools, rejection/reflect-back mechanics
- [`docs/eval-set.md`](./docs/eval-set.md) — rubric + test case bank
- [`docs/checkpoint.md`](./docs/checkpoint.md) — decision log from the question-architecture design session
- [`docs/capture-doc.md`](./docs/capture-doc.md) — original raw idea capture, archival, everything else is synthesized from this
