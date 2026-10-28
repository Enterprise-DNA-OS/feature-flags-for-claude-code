# Verification record

Checked 28 October 2026 for the initial build.

| Check | Result |
|---|---|
| npm test, Linux, Node 22.23.4, PGlite | PASS, 88 assertions and all 33 CLI commands |
| npm test, Linux, Node 20.20.2, PGlite | PASS, 88 assertions and all 33 CLI commands |
| npm test, Linux, Postgres 17.10 | PASS, 89 assertions including the empty-database preflight |
| npm run demo | PASS, fictional overdue and missing-owner records shown |
| npm run docs | PASS, two environment registers and one release handover |
| npm run view | PASS, week, ownership and control reports |
| Agent command recipes | 35, including customise and new-view |
| Windows and hosted test jobs | Not executed: GitHub blocked runners on the organisation's billing or spending limit |

The test suite uses disposable data. It checks atomic and idempotent imports, native targeting with segments and prerequisites, deterministic percentage evaluation, changed-key and dependent-key coverage, separate-reviewer handling, failed test blocking, stale proposals, reviewed rollback, output escaping and private export overwrite refusal. Tests also render the documents and views and exercise the CLI process boundary.

The Windows/Linux workflow is committed at .github/workflows/test.yml. Its initial run was blocked before any step started: https://github.com/Enterprise-DNA-OS/feature-flags-for-claude-code/actions/runs/40786638239. A blocked runner is not a passing Windows test. The Postgres result above came from a separate disposable local server, which was stopped after the test.

The landing-page gate passed. Desktop and mobile preview checks found no horizontal overflow or browser errors. All three captured-demo tabs worked, the booking links carried the ConfigCat campaign identifier, and the draft rendered noindex,nofollow. Preview evidence belongs to the Command Centre run record, not this business-data repository.
