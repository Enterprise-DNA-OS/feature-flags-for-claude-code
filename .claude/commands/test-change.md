---
description: Test proposed targeting before approval
---

# Test proposed targeting before approval

Build cases from the operator's expected outcomes, not from the current evaluator output. Cover each changed or removed flag, relevant cohorts and boundaries. Shared segment or salt changes require every affected key. A passing sample is not proof for every possible user. Show failures before further action.

Run:

```bash
npm run flags -- test-change --ref="<change>" --cases="<cases.json>" --actor="<operator>"
```

Replace angle-bracket fields with supplied values. Arguments: $ARGUMENTS
