---
description: Bring in one ConfigCat environment with a trial run first
---

# Bring in one ConfigCat environment with a trial run first

Read docs/replace-configcat.md. Use an existing native v6 environment export, never an SDK key or a whole-product backup. Run the trial, reconcile keys and source digest, then repeat without --dry-run when the requested import is confirmed. Do not overwrite a different environment or cancel a subscription.

Run:

```bash
npm run flags -- import configcat --file="<config-v6.json>" --env="<new environment>" --owner="<owner>" --actor="<operator>" --dry-run
```

Replace angle-bracket fields with supplied values. Arguments: $ARGUMENTS
