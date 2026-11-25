# Dependencies: how updates work, and what we're holding back

> **Status:** Living. Update the held-back table whenever we decline or defer an upgrade.

## How updates arrive

Dependabot (`.github/dependabot.yml`, decision 11.11) opens PRs to update the outside packages the app uses:

| Kind | When | How it arrives |
|---|---|---|
| **Security fixes** | As soon as a fix for a known vulnerability is published | Grouped: one PR per run. Never blocked by the rules below |
| **Routine library updates** (minor and patch) | Weekly, Mondays | One grouped PR |
| **GitHub Actions updates** | Monthly | One grouped PR, including major versions (low risk for actions) |
| **Major versions of app libraries (npm)** | Never automatic | Upgraded deliberately, in our own PR, with a reason recorded below |

Grouping of security fixes is set in `.github/dependabot.yml`, and the repo's **Grouped security updates** setting is also on (turned on Nov 24, 2026, so the first regrouping happened right away); the config file's rules decide how updates are grouped.

Every update PR gets the normal checks and a light review before merging. Nothing yet sends a real request to a PR's preview before merge; a smoke test on previews is planned alongside live monitoring, before the friend test (see the plan). Updates to Next.js get extra care: this project's Next.js version has breaking changes from older ones (see `AGENTS.md`), so read its upgrade notes first.

## Held-back upgrades

Packages we're deliberately not upgrading yet. Each has a reason and a trigger to revisit it.

| Package | We're on | Held back from | Why | Revisit when | Since |
|---|---|---|---|---|---|
| `typescript` | 5.x | 7.x | A major rewrite; our linting tools aren't compatible yet (the Dependabot PR failed the lint step and the Vercel build) | The linter (typescript-eslint) supports TypeScript 7; upgrade in a planned PR | Nov 24, 2026 (PR #41 closed) |
| `@types/node` | 22.x | 26.x | These type definitions should match the Node version the app runs on (Node 22, per `.github/workflows/checks.yml`) | We upgrade Node itself | Nov 24, 2026 (PR #40 closed) |
