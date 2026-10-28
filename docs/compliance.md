# Change-control checks and their limits

These checks implement a documented local operating policy for software configuration. They do not assert a statutory duty, certification, SOC 2 compliance or complete NIST implementation. A flag database cannot establish whether a business satisfies those frameworks.

The reference is NIST SP 800-53 Rev. 5, [control text, version 5.1](https://csrc.nist.gov/CSRC/media/Projects/risk-management/800-53%20Downloads/800-53r5/SP_800-53_v5_1-derived-OSCAL.pdf), checked 28 October 2026. CM-3 covers configuration change control; CM-3(2) concerns testing, validation and documentation; CM-4 concerns impact analysis. [NIST baseline configuration](https://csrc.nist.gov/glossary/term/baseline_configuration) describes a formally reviewed specification changed through control procedures.

| Local control | Mechanism | Reference and boundary |
|---|---|---|
| OWNERSHIP | Active flag has an owner and purpose | Our accountability policy supporting CM-3; NIST does not prescribe these fields |
| REVIEW | Active flag has a current review date | Our chosen review practice; no invented legal retention period |
| STALE-CHANGE | Proposal must match current environment revision | Baseline integrity supporting CM-3; recreate and retest stale work |
| TEST-EVIDENCE | Latest completed tests pass before approval and release | CM-3(2); every changed key needs a case, but full cohort coverage is the operator's job |
| SEPARATE-REVIEWER | Reviewer name differs from requester after trimming and case folding | Our separation-of-review policy; names are not authenticated identities |
| Impact and rollback | Proposal requires both plus a reason and due date | CM-4 supports impact consideration; a typed note is not independent impact analysis |

Run /compliance for the affected records. Missing owners and review dates are findings, not hard release blockers. Stale revisions, failed tests and missing separate review are hard blockers through the CLI. This distinction is intentional and visible.

Release and rollback never deploy. A release records the reviewed configuration in the owned database. An operator must verify the consuming application separately. Read-only reports and release handovers retain the supplied evidence. Database owners can change records directly: the history is not tamper-proof. Shared use needs authenticated reviewers, access control, audit integrity, backup recovery and agreed retention. Do not expose the trusted owner database role to untrusted clients.
