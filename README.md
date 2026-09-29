# Book Recommender

An AI book recommender built to beat the obvious pick. It turns a description of your taste into three recommendations drawn from real catalogs, chosen for fit rather than fame. Built as a portfolio project in product thinking around AI: grounding, evaluation, and honest handling of the model's pull toward mainstream answers.

## The problem

Ask an LLM for book recommendations and you get the same consensus picks every "if you liked X" list surfaces. The interesting problems aren't "call an LLM":

- How do you keep a recommender from defaulting to famous, obvious books?
- How do you make sure every pick is a real book, described accurately?
- How do you know it's working, rather than eyeballing outputs?
- How do you get enough signal about someone's taste without turning the app into a survey?

## How it works

1. **Retrieve real candidates.** The model searches Open Library, a broad catalog, up to three times. In parallel, the taste description is mapped to Hardcover reader tags (moods, genres, tropes) to pull a second, taste-shaped pool.
2. **Merge and neutralize bias.** The pools are deduplicated, shuffled, and stripped of ranking data, so neither catalog's popularity ordering reaches the model.
3. **Pick three, from the pool only.** Code checks every pick against the candidates the model was shown. A pick from outside the pool triggers a retry, never an invented or remembered book.
4. **Verify descriptions.** Each pick is looked up in its catalog. When the catalog flags a mismatch risk, a small model checks the description against the catalog facts and corrects it.

## Approach

- **Eval-driven.** A six-part rubric (relevance, non-obviousness, range, correctness, traceability, variety across sessions) scored against 11 test cases, using outside sources like Goodreads and award records, not the model's own judgment.
- **Evidence before architecture.** Most design calls were settled by a small test before building, and several hypotheses were proven wrong along the way.
- **Rules enforced in code.** Grounding, the search limit, and bias controls are enforced in code, not left to prompt instructions.
- **Question flow, not a form.** A three-question backbone (a book you loved → why → how adventurous you're feeling) with rotating wording and adaptive follow-ups. Designed; the next build phase.

Every decision, including the reversals and rejected paths, is in [`docs/decisions.md`](./docs/decisions.md).

## Status

**v0 engine complete** (September 2026). Baseline: 11/11 test cases delivered, 33/33 picks grounded in retrieved catalogs. Known limitations are documented rather than hidden. Next: the question-flow and card UI. Not yet deployed.

## Stack

- **Next.js** (TypeScript, App Router): the engine runs as an API route
- **Anthropic API**: Claude Sonnet for recommendations and tag mapping, Claude Haiku for description checks
- **Open Library**: breadth catalog (subject lists and search)
- **Hardcover** (GraphQL): reader-applied taste tags

## Getting started

```bash
npm install
npm run dev
```

Add to `.env.local` (not committed):
- `ANTHROPIC_API_KEY`: required
- `HARDCOVER_API_TOKEN`: optional; without it, the engine runs on Open Library alone

There's no UI yet. Call the engine directly:

```bash
curl -X POST localhost:3000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"tasteDescription": "Quiet, character-driven literary fiction with a strong sense of place."}'
```

## Docs

- [`docs/decisions.md`](./docs/decisions.md): every product and architecture decision, what was rejected, and why
- [`docs/spec.md`](./docs/spec.md): product spec
- [`docs/eval-set.md`](./docs/eval-set.md): rubric and test cases
- [`docs/eval-log.md`](./docs/eval-log.md): quality findings from each eval run
- [`docs/progress-log.md`](./docs/progress-log.md): session-by-session build log
- [`docs/question-bank.md`](./docs/question-bank.md): question wording and flow mechanics
- [`scratchpad/README.md`](./scratchpad/README.md): index of the experiments behind the decisions
- [`docs/checkpoint.md`](./docs/checkpoint.md), [`docs/capture-doc.md`](./docs/capture-doc.md): original design notes and idea capture (archival)
