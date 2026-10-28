---
description: Record a tested and approved configuration revision
---

# Record a tested and approved configuration revision

Read the change, latest tests and decisions first. Record only a review or release decision actually supplied by the operator. Never invent a different actor to satisfy the separate-reviewer check. A recorded release does not deploy software.

Run:

```bash
npm run flags -- release --ref="<change>" --actor="<operator>" --evidence="<release evidence>"
```

Replace angle-bracket fields with supplied values. Arguments: $ARGUMENTS
