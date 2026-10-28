---
description: Prepare a versioned change with an impact and rollback plan
---

# Prepare a versioned change with an impact and rollback plan

Read the relevant environment and change history first. Use real records only. Report missing information and list ambiguous matches. Add --json when you need structured output. Never send or deploy anything.

Run:

```bash
npm run flags -- propose --env="<environment>" --file="<native-v6.json>" --code="<unique code>" --actor="<requester>" --reason="<reason>" --impact="<impact>" --rollback="<rollback plan>" --due-on=YYYY-MM-DD
```

Replace angle-bracket fields with supplied values. Arguments: $ARGUMENTS
