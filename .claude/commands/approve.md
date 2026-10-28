---
description: Record the separate reviewer and evidence
---

# Record the separate reviewer and evidence

Read the change, latest tests and decisions first. Record only a review or release decision actually supplied by the operator. Never invent a different actor to satisfy the separate-reviewer check. A recorded release does not deploy software.

Run:

```bash
npm run flags -- approve --ref="<change>" --actor="<reviewer>" --evidence="<review evidence>"
```

Replace angle-bracket fields with supplied values. Arguments: $ARGUMENTS
