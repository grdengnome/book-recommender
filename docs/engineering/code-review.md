# How code gets reviewed

> **Status:** In use from Nov 23, 2026 (decision 11.11). Changes to the reviewer go through a pull request.

Every code change is checked by several reviewers that think differently, so one reviewer's blind spots are covered by another. No single reviewer is trusted on its own.

## The layers

| Layer | Catches | Runs | Where |
|---|---|---|---|
| Automatic checks | Broken code, type errors, sloppy patterns, unintended engine changes (golden test) | Every PR and push to main | `.github/workflows/checks.yml` |
| Code scanning (CodeQL) | Common security bugs in app code and workflows | Every PR, push to main, weekly | `.github/workflows/codeql.yml`; results in the repo's Security tab |
| Secret scanning and push protection | Keys or passwords committed by mistake (blocked before they land) | Always on | Repo settings |
| Dependabot | Vulnerable or outdated libraries and actions | Security fixes as published, grouped; routine updates weekly or monthly, grouped; major versions only deliberately ([dependencies](./dependencies.md)) | `.github/dependabot.yml`, repo settings |
| The reviewer | Logic mistakes, missed edge cases, breaking our own rules | Every code PR | `.claude/commands/review-pr.md` |
| Security review | Exploitable security problems in the change | Every code PR | Claude Code's built-in `/security-review`; in claude.ai sessions, where that command isn't available, a separate reviewer agent applies the same method |
| A human expert | Blind spots shared by the AI builder and the AI reviewer | At a major gate, such as before public launch | Booked when needed |

## The reviewer

One file, `.claude/commands/review-pr.md`, holds the reviewer's process, our checklist and its output format, so every part of the code gets the same lens. It's adapted from Anthropic's code-review plugin: parallel reviewing agents, then a separate agent that validates each finding, keeping only those at 80% confidence or more.

- **Light mode:** low-stakes code PRs (scripts, tests, tooling).
- **Full mode:** high-stakes PRs (what the model sees, hard rules, the input guard, anything reaching readers, safety or money). It adds a second bug reader and a security pass. When unsure, use full.
- **Baseline mode:** a one-time review of existing code.

**Running it:**
- In Claude Code (a Codespace or terminal): `/review-pr <PR number> [light|full] --comment`.
- In a claude.ai session, Claude follows the same file step by step and posts the result on the PR.

Either way, the reviewer is a separate agent that didn't build the change.

## Triage: what blocks a merge

- **Must fix:** a concrete failure (a bug, a security risk, a broken rule of ours, or a measured cost or speed problem), stated as "given X, Y goes wrong." It blocks the merge.
- **Suggestion:** a real improvement that doesn't block. The owner decides now, later or never.
- **Declined as noise:** style preferences, rewrites with no measurable benefit, anything a linter catches.
- **Out-of-scope ideas** go to the backlog; clean-ups wait until we're working on that code anyway.

## Proving a fix is an improvement

- Every fix comes with a test that fails before the fix and passes after.
- The golden test confirms nothing else in the engine changed.
- Anything touching picks or speed is checked with the eval or with timings.

## The escaped-bug log

[`docs/quality/escaped-bugs.md`](../quality/escaped-bugs.md) records any bug found after merge that review missed. It's how the reviewer is measured: each miss becomes a fix to the reviewer file, and if misses keep piling up, we trial a second reviewer (CodeRabbit first).

## Paid automatic security review

The GitHub Action version of the security review runs the same analysis automatically on every PR, but bills per use. It stays off until the owner turns it on: when code changes happen outside our sessions, when others contribute, or before public launch, with its own spend-capped key.
