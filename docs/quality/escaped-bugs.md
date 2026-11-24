# Escaped-bug log

> **Status:** Living (decision 11.11). One row per bug found **after** a merge that review should have caught. This log is how we measure the reviewer.

**What counts:** a real defect in merged code (wrong behaviour, a security problem, a broken project rule) that the PR's review, tests or scanners didn't flag. Bugs caught before merge don't go here.

**What happens next:** every entry gets a fix with a test that fails before and passes after, and, where review should have caught it, a change to the reviewer file (`.claude/commands/review-pr.md`) so it catches that kind of bug in future. If entries keep piling up despite those changes, we trial a second reviewer (CodeRabbit first).

| Date found | What went wrong | Merged in | Why review missed it | Fix (PR) | Reviewer change |
|---|---|---|---|---|---|
| *(none yet)* | | | | | |
