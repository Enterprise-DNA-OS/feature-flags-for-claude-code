---
description: Propose a return to an earlier release snapshot
---

# Propose a return to an earlier release snapshot

Read the selected release and current environment first. This proposes a new revision: test, separate review and release are still required. No deployed application changes from this command.

Run:

```bash
npm run flags -- rollback --env="<environment>" --ref="<release id>" --code="<unique code>" --actor="<requester>" --reason="<reason>" --impact="<impact>" --rollback="<rollback plan>" --due-on=YYYY-MM-DD
```

Replace angle-bracket fields with supplied values. Arguments: $ARGUMENTS
