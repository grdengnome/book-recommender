# Architecture

> **Status:** Living · Describes the engine as it runs today and where it's heading. Last updated Nov 1, 2026.

## Today: one engine behind one API route
`app/api/recommend/route.ts` takes a taste description and returns three picks (the [spec §4b](../product/spec.md) contract). About 25 seconds and $0.08 per request.

```mermaid
flowchart LR
  IN[Taste description] --> T[Taste → Hardcover tags<br/>Sonnet 5]
  IN --> OL[Open Library searches<br/>model-invoked, up to 3 rounds]
  T --> HC[Hardcover pool<br/>one fixed fetch]
  OL --> M[Merge, dedupe, shuffle<br/>~400–500 candidates]
  HC --> M
  M --> S[Select 3 picks<br/>Sonnet 5, streamed]
  S --> G[Grounding check<br/>pick must be in the pool]
  G --> L[Catalog lookup per pick]
  L --> C[Write each card<br/>Sonnet 5]
  C --> V[Validate lengths · shorten<br/>Haiku 4.5]
  L --> D[Description check<br/>Haiku 4.5, when flagged]
  V --> OUT[Three picks]
  D --> OUT
```

Rules enforced in code (see [CLAUDE.md](../../CLAUDE.md)): picks come only from the retrieved pools; the model sees only title, author and subjects, shuffled; tag selection never sees tag counts; length overflow never fails a request.

## Heading: features on shared infrastructure
The app is organized by feature, on top of shared infrastructure that every feature uses ([repo guide](./repo-guide.md)). Every swappable part sits behind a contract ([contracts and adapters](./contracts-and-adapters.md)).

```mermaid
flowchart LR
  UI[features/discover<br/>screens + theme] --> API[app/api/recommend]
  API --> SEC[InputGuard + RateLimiter]
  SEC --> P[lib/engine pipeline]
  P --> Q[QuestionChooser + TasteProfile]
  P --> SRC[BookSource adapters]
  SRC --> M[merge + shuffle]
  M --> SEL[select 3 picks]
  SEL --> VER[verify + grounding]
  VER --> CARDS[cards + covers]
  SEL -.-> AI[AI gateway → slots.ts]
  CARDS -.-> AI
  VER -.-> AI
  CARDS --> ST[(Store)]
  FB[features/feedback] --> ST
```

Every box talks to the next through a contract. Dotted lines are AI jobs, each choosing its model in one settings file.

## Hosting
Vercel (Hobby plan), private: Deployment Protection is on for all deployments. Production keys are Vercel secrets in a separate, spend-capped API workspace. The recommend route allows up to 300 seconds.
