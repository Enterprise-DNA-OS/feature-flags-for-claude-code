---
description: Propose a changed default without discarding targeting rules
---

# Propose a changed default without discarding targeting rules

Read the relevant environment and change history first. Use real records only. Report missing information and list ambiguous matches. Add --json when you need structured output. Never send or deploy anything.

Run:

```bash
npm run flags -- set-default --env="<environment>" --key="<key>" --value="<JSON scalar>" --code="<unique code>" --actor="<requester>" --reason="<reason>" --impact="<impact>" --rollback="<rollback plan>" --due-on=YYYY-MM-DD
```

Replace angle-bracket fields with supplied values. Arguments: $ARGUMENTS
