# Feature Flags for Claude Code

**The open-source feature flag system that is just a database and Claude Code.** Built by [Enterprise DNA](https://www.enterprisedna.co). Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free, MIT. [Quick start](#quick-start). | Your fields, release rules and ConfigCat records brought across. [Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=configcat). | Installed and operated inside Omni. One setup fee, then a retainer. [Talk to Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=configcat). |

## What this does

An owned change-control record for software teams: flag ownership, review dates, proposed native configurations, offline targeting tests, separate named review, recorded releases and rollback proposals. ConfigCat [lists Dedicated at US$4,500 per month](https://configcat.com/pricing/), equivalent to US$54,000 over twelve months, checked 28 October 2026. That is a public list-price scenario, not a verified customer invoice or a promise to replace its hosting service for free.

The runtime uses ConfigCat's MIT-licensed SDK in offline, local-only mode. It preserves the imported v6 targeting rules, segments, prerequisites and percentage assignments. Release writes change the owned database; they never deploy to applications or contact ConfigCat. Application owners must integrate and test delivery of approved local configuration separately. This is useful as a local release desk without a front end or a connected vendor account.

## Quick start

Node 20 or later:

```bash
git clone https://github.com/Enterprise-DNA-OS/feature-flags-for-claude-code.git
cd feature-flags-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
```

Open this folder in your coding agent and ask for /weekly-review. Kauri Software, Mere and Lin are fictional. The demo deliberately contains overdue reviews, an unowned flag and an overdue change. Seed only a demo database. For real data, start with an empty database, run npm run migrate and import your own environment.

The default database is embedded PGlite in .data/db. Set DATABASE_URL in your local environment for your own Postgres database, or DATA_DIR for a different embedded location. Credentials and business exports belong outside version control. npm test always uses disposable embedded data unless TEST_DATABASE_URL names an empty disposable Postgres database. It refuses a nonempty public schema before applying migrations.

## The weekly rituals

Run /attention, /changes-due, /review-due, /compliance and /weekly-review to plan the week. A change goes from proposal to tested, separately reviewed and recorded release. Changing the current revision makes competing proposals stale: they must be recreated and tested. Rollback follows the same process. A failed latest test blocks approval. Actor names are operator-supplied, not authenticated identities.

### A complete demo change

```bash
npm run flags -- test-change --ref=CHECKOUT-01 --cases=fixtures/checkout-tests.json --actor=Lin
npm run flags -- approve --ref=CHECKOUT-01 --actor=Mere --evidence="Reviewed NZ and AU test cases"
npm run flags -- release --ref=CHECKOUT-01 --actor=Lin --evidence="Approved local revision recorded"
npm run flags -- releases
```

The example records two fictional people, not real approvals. In a business session, use only decisions those people actually supplied. No external deployment has happened.

## The commands

33 CLI operations and 35 agent command recipes. Every CLI operation supports --json. References accept an exact case-insensitive name or partial identifier; ambiguous matches print the choices and exit 1. See [docs/cli.md](docs/cli.md) for all arguments.

| Command | What it does |
|---|---|
| /environments | List environments and their current recorded revisions |
| /inventory | Read active flags, ownership, purpose and review dates |
| /attention | Find overdue changes and missing ownership or reviews |
| /changes-due | Plan the release review and spot stale proposals |
| /compliance | Check the documented change-control policy |
| /review-due | Find flag reviews due within thirty days |
| /owner-load | See whose flag review workload needs help |
| /environment-drift | Compare default values between environments |
| /releases | Read the recorded release history |
| /test-history | Find the latest test evidence for a change |
| /decisions | Read recorded approvals and rejections |
| /activity | Read who changed ownership or added a note |
| /imports | Reconcile import counts and source digests |
| /help | List the supported CLI operations |
| /show | Read a complete record before acting |
| /weekly-review | Run the Monday release review |
| /add-environment | Create an empty environment with a named owner |
| /add | Propose a new typed flag |
| /set-default | Propose a changed default without discarding targeting rules |
| /assign | Record the owner, purpose and next review date |
| /propose | Prepare a versioned change with an impact and rollback plan |
| /test-change | Test proposed targeting before approval |
| /approve | Record the separate reviewer and evidence |
| /reject | Close a pending or approved proposal without applying it |
| /release | Record a tested and approved configuration revision |
| /rollback | Propose a return to an earlier release snapshot |
| /evaluate | Check a flag for a supplied user without network access |
| /import | Bring in one ConfigCat environment with a trial run first |
| /export | Write a complete private record backup |
| /write-release | Write one recorded release to a local configuration file |
| /log | Add a factual note to a known record |
| /draft-review | Draft the weekly flag review for a person to read |
| /draft-release | Draft a release handover with tests and rollback details |
| /customise | Add a field or adapt a documented rule |
| /new-view | Add a read-only HTML report |

## Ten questions your own records answer

These combine your own release policy and ownership history. They are demonstrated queries, not a claim that ConfigCat has no reporting or that every competing system lacks these answers.

| Question | Read command |
|---|---|
| Which flags have no owner and an overdue review? | attention |
| Which change is overdue before its first release? | changes-due |
| Which proposals were prepared against an older revision? | changes-due |
| Which owner has the most reviews due? | owner-load |
| Where do staging and production defaults differ? | environment-drift |
| Which named reviewer approved a change and why? | decisions |
| Did the latest test run fail after an earlier pass? | test-history |
| Which recorded version is available for a rollback proposal? | releases |
| Who changed a flag owner and what was there before? | activity |
| Which imported environment came from this configuration digest? | imports |

## Your first hour: ten things to ask for

1. Show the overdue flag reviews.
2. Show changes due this week and their test results.
3. Explain why this proposal is stale.
4. Compare production and staging defaults.
5. Show each owner's review workload.
6. Draft the weekly review without sending it.
7. Render a release handover with the recorded evidence.
8. Preview an import of my native environment export.
9. Add a business service field with /customise.
10. Add a release-risk report with /new-view.

## Instead of ConfigCat

One command imports an existing native v6 environment export, retaining its full configuration. Run it with --dry-run first. A whole-product backup is a different format and is rejected. [The switch guide](docs/replace-configcat.md) explains export, mapping, verification and the application change required for a live switch. Team permissions, audit history and vendor hosting are not inferred from a configuration file.

## Documents and views

Set your business name, logo and colours in brand.json. npm run docs writes environment registers and release handovers to docs-out. npm run view writes read-only week, ownership and control reports to views. /draft-review and /draft-release write private HTML to drafts. Print locally to PDF when needed. Nothing sends, deploys or uploads these files.

## Compliance and access

[docs/compliance.md](docs/compliance.md) maps the local checks to NIST change-control practices and states their limits. The database uses RLS with no public policies. Run migrations and the CLI as a trusted database owner; do not expose this role to browsers. Operator names are not authentication, and database owners can edit the history. Access control, immutable logging, backup restoration and production delivery need an agreed implementation for a shared business deployment.

## Why no front end

The release record is the working surface. Your agent reads it, proposes changes and renders documents. [docs/why-no-front-end.md](docs/why-no-front-end.md) explains the mobile, offline and live-dashboard limits. Enterprise DNA can build the interface, connections or different stack your business needs.

## Architecture

Eight domain tables, five reporting views, one CLI and versioned SQL migrations. The complete original environment configuration is retained as JSON, alongside ownership and change evidence. Shared scripts render documents and views. See CLAUDE.md for the operating rules; AGENTS.md points other runtimes to those same rules.

## Installed and run for you

Enterprise DNA brings across your ConfigCat records, agrees the application connections and runs your version through Omni. One setup fee, then a retainer. [Book 30 minutes with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=configcat).

## License

MIT. Copyright 2026 Enterprise DNA. ConfigCat is a third-party product; this independent project is not affiliated with ConfigCat. The ConfigCat SDK remains under its own MIT licence.
