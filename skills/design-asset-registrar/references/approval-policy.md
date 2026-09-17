# Approval Policy

Design Asset Registrar separates report-only work from writeback work.

## Allowed Without Write Approval

- Inventory.
- Benchmark audit.
- Gap report.
- Proposal.
- Workflow retrospective.
- Skill improvement proposal.
- Evidence reports under the configured `evidenceRoot`.

## Requires Explicit Approval

Before changing any of these, ask for confirmation unless the user has already explicitly authorized the write:

- Component source.
- Component source/examples.
- Registry, catalog, public export, or asset hub mapping.
- Design-system truth files.
- Package dependencies.
- Gate scripts.
- Existing registered assets.
- Skill files themselves.

For UI Distiller registration, confirmation is persisted through the Core `authorize` command using `schemas/authorization.schema.json`. The authorization must bind `capability=library-write`, the exact distilled target, `subjectId`, `subjectRevision`, and the adapted bundle digest as `inputDigest`. A boolean embedded in the register payload is not approval.

## Upgrade And Realign

`upgrade` and `realign` default to report-only. After approval, record before gates, perform the scoped write, rerun previously green gates, and apply no-regression rules.

## Human Review

If `humanReview.required=true`, registration is blocked until `humanReview.ok=true` or a valid waiver exists.
