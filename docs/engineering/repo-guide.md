# Repo guide

> **Status:** Living · Structure approved Oct 29, 2026 ([decision 14.2](../decisions.md)). The repo is moving to this layout in a series of small pull requests; this page shows the target and what's done. Last updated Nov 1, 2026.

## How the repo is organized
**Feature folders for the app, shared folders for the infrastructure.** Each part of the product (Discover, Feedback, Collection, You…) keeps its screens, logic and tests together. The engine, AI gateway, contracts, storage, security and themes are shared: they exist once, and every feature uses the same copy.

```
README.md                 Front door
CLAUDE.md                 Rules for AI coding sessions
.env.example              Every setting name with a one-line purpose, no values
.github/workflows/        Automatic checks on every pull request (type check, lint, tests)
.local/                   Local logs and debug traces (gitignored, never committed)

app/                      Next.js routes only: tiny files that render a feature
features/                 One folder per part of the product
  discover/               question-flow/ loading/ reveal/ detail/ try-again/ server/
  feedback/               Thumbs up/down per pick, "send feedback"
  collection/  you/       "Coming soon" now; built later
  privacy/                Privacy note
ui/                       Truly shared UI: tab bar, buttons, layout shell
themes/                   cafe/ mystery/ fantasy/ superhero/ scifi/ (one Theme contract)
lib/                      Shared infrastructure, no screens
  contracts/              The plug shapes for every swappable part
  config/                 Feature flags and active adapters
  engine/                 The recommendation pipeline and book-source adapters
  questions/              Question chooser, taste profile, question bank as data
  ai/                     AI gateway and slot settings (which model does which job)
  covers/ store/ security/ trace/
evals/                    Eval cases, rubric, one runner, reports
tests/                    Cross-cutting automatic checks (contract tests, grounding, trace)
scripts/                  Maintenance tools
experiments/              One-off investigations and their evidence (was scratchpad/)
prototypes/               Design prototypes (was docs/mockups/)
docs/                     See docs/README.md
```

## Two rules that keep it clean
1. **A piece lives inside its feature until a second feature needs it;** then it moves to `ui/`, `themes/` or `lib/`.
2. **Features never import from each other.** They talk only through `lib/contracts` and shared code, so one feature's changes can't break another.

Plus the swappability rule: app code never calls an outside service directly; it goes through a contract ([contracts and adapters](./contracts-and-adapters.md)), within the YAGNI guardrail.

## Restructure progress
| PR | What | Status |
|---|---|---|
| 1 | Docs restructure: docs by audience, docs map, status lines, archive, Project docs brought in | Done (#11) |
| 2 | Rewrite README and CLAUDE.md for today's product and rules | Done (#12) |
| 3 | Hygiene and automatic checks: `.env.example`, live logs out of the repo, `scratchpad/` split into `experiments/`, `evals/`, `scripts/`; `docs/mockups/` → `prototypes/`; first tests; GitHub Actions | Done (#13) |
| 4a | AI gateway: one front door for every model call, `lib/ai/slots.ts` settings sheet, per-job override settings; golden-request test proves behaviour unchanged | Done |
| 4b | Engine moves into `lib/engine/`; `route.ts` becomes thin; one eval runner with cases as data | Next |
| 5 | App skeleton: `features/`, `ui/`, `themes/`, `lib/config/`, "coming soon" tabs, privacy page | Planned |
| 6 | Store and trust basics: data store, feedback, rate limit, input guard | Planned |

## Other repo decisions (Oct 29)
- **Name:** stays `book-recommender` until the Squirmly name and handles are claimed; then renamed (GitHub redirects old links).
- **Licence:** none for now, so all rights are reserved by default.
- **Prototypes:** kept in the repo for design history.
- **Never commit:** API keys, cover images, debug traces or real readers' answers.
