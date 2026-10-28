# Feature Flags for Claude Code: operating instructions

## Who this is for

The software owner and release reviewer who need a record of flags, owners, tests and approved configurations. This checkout starts with fictional Kauri Software demo data. Establish the actual business and operator before recording business changes.

## How to work

Read before writing. The database is the record of supplied facts, not proof of deployment. Use scripts/flags.mjs through npm run flags. Use --json for analysis. Read the complete change and its environment before a write. Never invent an actor, approval, outcome or record. List ambiguous matches and obtain the intended reference.

## Routing table

| Request | Command |
|---|---|
| List environments and their current recorded revisions | /environments |
| Read active flags, ownership, purpose and review dates | /inventory |
| Find overdue changes and missing ownership or reviews | /attention |
| Plan the release review and spot stale proposals | /changes-due |
| Check the documented change-control policy | /compliance |
| Find flag reviews due within thirty days | /review-due |
| See whose flag review workload needs help | /owner-load |
| Compare default values between environments | /environment-drift |
| Read the recorded release history | /releases |
| Find the latest test evidence for a change | /test-history |
| Read recorded approvals and rejections | /decisions |
| Read who changed ownership or added a note | /activity |
| Reconcile import counts and source digests | /imports |
| List the supported CLI operations | /help |
| Read a complete record before acting | /show |
| Run the Monday release review | /weekly-review |
| Create an empty environment with a named owner | /add-environment |
| Propose a new typed flag | /add |
| Propose a changed default without discarding targeting rules | /set-default |
| Record the owner, purpose and next review date | /assign |
| Prepare a versioned change with an impact and rollback plan | /propose |
| Test proposed targeting before approval | /test-change |
| Record the separate reviewer and evidence | /approve |
| Close a pending or approved proposal without applying it | /reject |
| Record a tested and approved configuration revision | /release |
| Propose a return to an earlier release snapshot | /rollback |
| Check a flag for a supplied user without network access | /evaluate |
| Bring in one ConfigCat environment with a trial run first | /import |
| Write a complete private record backup | /export |
| Write one recorded release to a local configuration file | /write-release |
| Add a factual note to a known record | /log |
| Draft the weekly flag review for a person to read | /draft-review |
| Draft a release handover with tests and rollback details | /draft-release |
| Adapt a field or rule | /customise |
| Add a report | /new-view |

## Release rules

A proposal includes the reason, impact, rollback plan and due date. Tests must cover every changed or removed key. A shared segment or preference change requires all keys. Review meaningful cohorts and boundaries, not only defaults. The requester cannot approve their own change. Names are labels, not authentication; never impersonate a reviewer to pass a check. Release records an approved version locally. It never means an application deployed it. Rollback is another reviewed proposal.

## Hard limits

No email, messages, uploads or deployments. Draft only to drafts. Never read or request an SDK key: use an already exported native configuration. Never delete business records without an explicit instruction. Do not seed a real business database. Do not change a native flag type implicitly. Preserve the salt, segments, prerequisites and percentage options. Do not treat NIST mapping as certification or legal advice.

## Where things live

- scripts/flags.mjs: one CLI, documented in docs/cli.md.
- scripts/lib/evaluate.mjs: native validation and offline ConfigCat SDK evaluation.
- supabase/migrations: numbered SQL changes; never rewrite an applied migration.
- supabase/seed.sql and fixtures: fictional demo and tests.
- .claude/commands: the shared agent recipes.
- documents.json, views.json and brand.json: read-only business paperwork.
- docs/replace-configcat.md: the import and switching route.

Use a trusted local database owner. RLS has no public access policies. For a shared deployment, agree real authentication, record integrity and backup operation. Run npm test after changes, then npm run demo on disposable data. Use AGENTS.md for other coding-agent runtimes, never a forked workflow library.

Built by Enterprise DNA. https://enterprisedna.co/omni/instead-of/configcat
