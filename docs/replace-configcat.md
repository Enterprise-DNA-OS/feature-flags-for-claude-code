# Replace the ConfigCat release record

## 1. Export one environment

ConfigCat documents native v6 configuration export using its CLI in the [SDK guide](https://configcat.com/docs/sdk-reference/go/). An authorised administrator exports the selected environment in their own secure setup and supplies the resulting file. This project never requests or stores the SDK key. Repeat for each environment. See the [FAQ](https://configcat.com/docs/faq/) for the separate full-product export: that backup is a different shape and is not accepted here.

## 2. Import in one command

After npm install and npm run migrate on an empty database:

```bash
npm run flags -- import configcat --file=./imports/production-v6.json --env="Production" --owner="Mere" --actor="Mere" --dry-run
```

Compare the count, source digest and environment. Repeat without --dry-run to save it. The transaction creates the environment, original configuration, active flag register, initial release and import record together. Invalid data leaves no partial environment. Importing identical data again is a no-op. An existing environment with different data is rejected; use a reviewed proposal instead. The fixture in fixtures/configcat-v6.json is a small synthetic native-format example, not a real customer's export.

## 3. Know what maps

| Source | Owned record |
|---|---|
| f: flag keys, types, defaults, rules, percentages and variation identifiers | The complete original native environment document |
| s: segments | Original segment definitions and references |
| p: preferences and salt | Preserved for offline evaluation; no network requests |
| Environment label and owner | Supplied explicitly during import |
| Flag owner, purpose and review date | Added with assign; missing data appears in attention |
| Team roles, past audit history, approvals and product metadata | Not in a native environment snapshot; separately map and reconcile if required |
| Vendor delivery, support agreement, analytics and integrations | Separate operating services to assess before switching |

The source is retained as structured JSON with semantic values unchanged; whitespace and object key order are not preserved. Confidential comparison salt and hashes remain sensitive configuration. Keep source files and backups private.

## 4. Reconcile behaviour

Run inventory and show for each environment. Use evaluate with representative test users, including targeting boundaries, missing attributes, segments, prerequisites and percentage cohorts. Compare against current application behaviour before any live move. The evaluator uses the official SDK in offline, local-only mode. It validates native types, references, percentage totals and cycles. A sample test pass is evidence for those samples only.

Assign owners and review dates. Make a proposal, test it, record the separate review and release it locally. write-release exports the approved snapshot. No application has changed yet.

## 5. Switch the application deliberately

An application owner must wire approved local configuration into its runtime, choose fallback behaviour and test how new versions arrive. The JavaScript example is in docs/cli.md; other languages need their own documented integration. Keep ConfigCat running until you have tested both the switch and rollback. Do not cancel a subscription based on an imported file. This free base has no hosted distribution service, remote polling, telemetry or authenticated multiuser approval service. Enterprise DNA scopes the required connections and operation into your version.

Official sources checked 28 October 2026: [export](https://configcat.com/docs/sdk-reference/go/), [offline overrides and deserializeConfig](https://configcat.com/docs/sdk-reference/js/overview/), [v2 configuration](https://configcat.com/docs/advanced/config-v2/), [product export](https://configcat.com/docs/faq/).
