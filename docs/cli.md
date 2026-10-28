# CLI reference

Use npm run flags -- OPERATION. Every operation accepts --json. Most writes require --actor. Record references accept case-insensitive names/codes and partial identifiers, with ambiguity errors. Read reports are current recorded state, not live application telemetry.

## environments

List environments and their current recorded revisions.

```bash
npm run flags -- environments
```

## inventory

Read active flags, ownership, purpose and review dates.

```bash
npm run flags -- inventory
```

## attention

Find overdue changes and missing ownership or reviews.

```bash
npm run flags -- attention
```

## changes-due

Plan the release review and spot stale proposals.

```bash
npm run flags -- changes-due
```

## compliance

Check the documented change-control policy.

```bash
npm run flags -- compliance
```

## review-due

Find flag reviews due within thirty days.

```bash
npm run flags -- review-due
```

## owner-load

See whose flag review workload needs help.

```bash
npm run flags -- owner-load
```

## environment-drift

Compare default values between environments.

```bash
npm run flags -- environment-drift
```

## releases

Read the recorded release history.

```bash
npm run flags -- releases
```

## test-history

Find the latest test evidence for a change.

```bash
npm run flags -- test-history
```

## decisions

Read recorded approvals and rejections.

```bash
npm run flags -- decisions
```

## activity

Read who changed ownership or added a note.

```bash
npm run flags -- activity
```

## imports

Reconcile import counts and source digests.

```bash
npm run flags -- imports
```

## help

List the supported CLI operations.

```bash
npm run flags -- help
```

## show

Read a complete record before acting.

```bash
npm run flags -- show --kind=changes --ref="<code or id>"
```

## weekly-review

Run the Monday release review.

```bash
npm run flags -- weekly-review
```

## add-environment

Create an empty environment with a named owner.

```bash
npm run flags -- add-environment --name="<environment>" --owner="<owner>" --actor="<operator>"
```

## add

Propose a new typed flag.

```bash
npm run flags -- add --env="<environment>" --key="<key>" --value="<JSON scalar>" --code="<unique code>" --actor="<requester>" --reason="<reason>" --impact="<impact>" --rollback="<rollback plan>" --due-on=YYYY-MM-DD
```

## set-default

Propose a changed default without discarding targeting rules.

```bash
npm run flags -- set-default --env="<environment>" --key="<key>" --value="<JSON scalar>" --code="<unique code>" --actor="<requester>" --reason="<reason>" --impact="<impact>" --rollback="<rollback plan>" --due-on=YYYY-MM-DD
```

## assign

Record the owner, purpose and next review date.

```bash
npm run flags -- assign --env="<environment>" --key="<key>" --owner="<owner>" --purpose="<purpose>" --review-on=YYYY-MM-DD --actor="<operator>"
```

## propose

Prepare a versioned change with an impact and rollback plan.

```bash
npm run flags -- propose --env="<environment>" --file="<native-v6.json>" --code="<unique code>" --actor="<requester>" --reason="<reason>" --impact="<impact>" --rollback="<rollback plan>" --due-on=YYYY-MM-DD
```

## test-change

Test proposed targeting before approval.

```bash
npm run flags -- test-change --ref="<change>" --cases="<cases.json>" --actor="<operator>"
```

## approve

Record the separate reviewer and evidence.

```bash
npm run flags -- approve --ref="<change>" --actor="<reviewer>" --evidence="<review evidence>"
```

## reject

Close a pending or approved proposal without applying it.

```bash
npm run flags -- reject --ref="<change>" --actor="<reviewer>" --evidence="<reason>"
```

## release

Record a tested and approved configuration revision.

```bash
npm run flags -- release --ref="<change>" --actor="<operator>" --evidence="<release evidence>"
```

## rollback

Propose a return to an earlier release snapshot.

```bash
npm run flags -- rollback --env="<environment>" --ref="<release id>" --code="<unique code>" --actor="<requester>" --reason="<reason>" --impact="<impact>" --rollback="<rollback plan>" --due-on=YYYY-MM-DD
```

## evaluate

Check a flag for a supplied user without network access.

```bash
npm run flags -- evaluate --env="<environment>" --key="<key>" --user='{"identifier":"sample","country":"NZ"}'
```

## import

Bring in one ConfigCat environment with a trial run first.

```bash
npm run flags -- import configcat --file="<config-v6.json>" --env="<new environment>" --owner="<owner>" --actor="<operator>" --dry-run
```

## export

Write a complete private record backup.

```bash
npm run flags -- export --file="<new-backup.json>"
```

## write-release

Write one recorded release to a local configuration file.

```bash
npm run flags -- write-release --ref="<release id>" --file="<new-release.json>"
```

## log

Add a factual note to a known record.

```bash
npm run flags -- log --ref="<change>" --note="<note>" --actor="<operator>"
```

## draft-review

Draft the weekly flag review for a person to read.

```bash
npm run flags -- draft-review
```

## draft-release

Draft a release handover with tests and rollback details.

```bash
npm run flags -- draft-release --ref="<change>"
```

## Proposal and test semantics

propose takes the full native v6 environment document, not a patch. add and set-default retain all other configuration. add infers boolean, string, integer or decimal from the supplied JSON scalar; set-default preserves the existing type. Numbers must be finite and integer flags use safe integers. Rules and segments must have valid references; cycles and percentage totals other than 100 are rejected.

Cases are a nonempty JSON array. Each has key, expected and optional user; a removed flag uses absent:true. User fields follow the ConfigCat JavaScript SDK: identifier, email, country and custom. Use fictitious users for fixtures. Never populate tests with personal data unnecessarily. An evaluation error or mismatch is saved as a failed check and the CLI exits 1. Malformed case files are rejected before a completed check is recorded. Latest completed tests must pass. Tests after approval are refused: reject and create a new proposal to revise the decision. Inputs and proposals are immutable through the CLI.

```json
[
  {"key":"new_checkout","user":{"identifier":"sample-nz","country":"NZ"},"expected":true},
  {"key":"new_checkout","user":{"identifier":"sample-au","country":"AU"},"expected":false}
]
```

Every changed or removed key and every dependent prerequisite flag must be represented. A shared configuration change requires all keys. This is a minimum coverage check: add every meaningful cohort and boundary yourself. A single example cannot establish correctness for all users.

## Private outputs

export creates a consistent full record backup with format feature-flags-backup-v1. It is not a ConfigCat product backup or an automatic restore command. write-release writes one recorded native configuration. Both refuse existing files. Keep outputs private; confidential comparisons retain their original salt and hashes. Permissions are owner-only where the operating system supports them. Windows access control remains your responsibility.

--dry-run rolls back database mutations. The import recipe uses it for trial reconciliation. It does not suppress export, document or draft file creation. Use an empty environment name for import; add-environment creates an empty baseline for hand-authored proposals, not an import destination.

## Application consumption

The CLI does not run a remote delivery service. An application can use a local exported snapshot with the same offline evaluator, after its owner has tested the integration:

```js
import fs from 'node:fs';
import { createEvaluator } from './scripts/lib/evaluate.mjs';
const evaluator = createEvaluator(JSON.parse(fs.readFileSync('approved-release.json', 'utf8')));
try {
  const result = await evaluator.evaluate('new_checkout', { identifier: 'test-user', country: 'NZ' });
  console.log(result.value);
} finally {
  evaluator.close();
}
```

Choose and test your application's fallback behaviour, distribution, reload cadence and access separately. No migration command switches an application automatically.
