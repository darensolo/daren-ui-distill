---
name: design-asset-registrar
description: "Prepare existing Daren Design candidates or register validated UI Distill AssetPackages. Owns refill, examples/evidence, conflict checks, approval, registration receipts, upgrade, and realignment; never publishes site pages."
metadata: {"skill_id":"design-asset-registrar","governance_status":"active","required_references":["references/workflow.md","references/host-adapter.md","references/approval-policy.md","references/evidence-schema.md"],"optional_references":["references/benchmark-systems.md","references/asset-kind-contract.md","references/family-contract-adapter.md","references/example-completeness.md","references/rendered-interaction-gates.md","references/no-regression.md","references/self-improvement-loop.md"],"historical_references":[],"publication_kind":"copy","publication_platforms":["codex","qoder"]}
---

# Design Asset Registrar（设计资产入库）

Design Asset Registrar is the single entry for making an asset registry-ready and registering it with evidence, gates, and human approval. It absorbs the former Asset Refill workflow; site projection belongs to `design-asset-publisher`.

## Supported Scope

- Skill id: `design-asset-registrar`
- Display name: `Design Asset Registration / 设计资产入库`
- First executable asset kind: `component`
- Reserved asset kinds: `block`, `template`, `icon`, `recipe`
- Out of scope: `foundation`, `token`, `pattern`, `governance`, and site `publish`

Current Daren component preparation/maintenance and UI Distill adapted L2 component registration are two different lanes:

- Existing native Daren source (`.tsx` / package component) may use `proposal`, `prepare`, `upgrade`, or `realign` against its owning source and an explicitly labelled candidate preview. LibraryAdapter v1 does not register this input and must never copy it into `src/distilled` or fabricate a `RegistrationReceipt`.
- Only a validated UI Distill **adapted L2 component AssetPackage** may enter `register`. The adapter writes it under the independent `distilled` collection, emits a `RegistrationReceipt`, and leaves the locked `core` / `agent` shards unchanged.

Adding a native candidate to a locked public shard or package export is a design-system contract change owned by that shard's governing work, not an AssetPackage registration shortcut. Reserved kinds return "reserved but not implemented".

## Modes

Infer mode from user intent and asset state. Do not ask the user to pick a mode as routine setup.

| Mode | Writes asset/source/registry files | Use |
|---|---:|---|
| `proposal` | No; evidence reports only | Benchmark-driven refill proposal: official-source component/example research, per-system absorption list, adoption list, gap analysis, P0/P1/P2 suggestions |
| `prepare` | Yes, after confirmation | Source-missing candidates or incomplete examples/evidence |
| `register` | Yes, after confirmation | Adapted L2 AssetPackage conflict checks, registry write, public export verification, registration receipt |
| `upgrade` | Default no; yes after confirmation | Already registered assets that need improvement |
| `realign` | Default no; yes after confirmation | Re-align assets after a golden contract change |

Default to `proposal` when intent or state is ambiguous. Before modifying asset, source, registry, catalog, or design-system truth files, confirm intended writes unless already authorized. A request whose endpoint is site visibility routes to `design-asset-publisher`; this skill never writes site pages/routes or emits a publication receipt.

## Required Reading

Always read only the references needed for the current run:

- `references/workflow.md`: end-to-end execution order.
- `references/host-adapter.md`: host capability boundary and manifest use.
- `references/approval-policy.md`: write authorization and human review rules.
- `references/evidence-schema.md`: evidence files, `capabilitiesUsed`, `humanReview`, waiver, and source attestation.

Read conditionally:

- Benchmark, proposal output, or asset research prompt work: `references/benchmark-systems.md`.
- Asset kind routing: `references/asset-kind-contract.md`.
- Family examples or conformance: `references/family-contract-adapter.md`.
- Example matrix checks: `references/example-completeness.md`.
- Rendered/interaction evidence: `references/rendered-interaction-gates.md`.
- Upgrade or realign: `references/no-regression.md`.
- End-of-run retrospective: `references/self-improvement-loop.md`.

## Source Ownership

Do not create a parallel truth source.

- Family requirements come from the host conformance contract through `references/family-contract-adapter.md`.
- Component/source readiness rules come from the host replication contract if one is available.
- This skill owns only workflow, approval, host adapter expectations, evidence shape, benchmark policy, and gate orchestration.

If a required host truth source is absent, return a blocked or proposal-only result. Do not copy a family matrix or replication contract into this skill to get past the block.

## Workflow

1. Detect mode from user intent and asset state.
2. Inventory registry/catalog, source, public export, examples, evidence, conformance, and available scripts. Classify the input as `native-daren-source`, `adapted-asset-package`, or `registered-distilled-asset` before choosing any write path.
3. Load the host adapter manifest and record intended host capabilities.
4. For `proposal` and report-only `upgrade` / `realign`, lead with a benchmark-driven refill report before host compliance: benchmark conclusion table, per-system absorbable points and comments, common practices, adoption/rejection decisions, and direct source links.
5. Then produce the host gap matrix: P0/P1/P2 blockers, machine-checkable failures, human quality judgments, and suggested refill scope.
6. Stop for approval before high-risk writes. After current explicit confirmation, use the Core `authorize` command to persist one `library-write` authorization bound to the exact asset id, revision, bundle digest, and `src/distilled/<asset>` target. Never synthesize the ref inside a register request.
7. Implement only the approved refill scope and pass that persisted authorization ref to the LibraryAdapter.
8. Run available registration gates in order: registry, build/typecheck, conformance, benchmark, examples, rendered, no-regression, receipt verification.
9. Write workflow retrospective and any skill improvement proposal.

## Final Response Rule

For report-only `proposal`, `upgrade`, or `realign`, the user-facing final response must inline the benchmark-first report summary. Do not only link evidence files and then list P0/P1/P2 gaps.

Minimum final response order:

1. Current Daren state.
2. Benchmark conclusion table with official links.
3. Per-system absorbable points and comments.
4. P0/P1/P2 refill checklist.
5. Brief verification/evidence tail.

Evidence links are supporting material, not a substitute for the benchmark conclusion.

## Fail Closed

Stop instead of guessing when:

- The host uses a capability not declared in the manifest.
- `capabilitiesUsed` cannot be recorded.
- A required human review is missing.
- A waiver is missing `reason`, `scope`, or `expiresAt`.
- A family contract is required but no machine-readable host source exists.
- `register` receives native Daren source rather than a validated adapted L2 AssetPackage; return `NATIVE_CANDIDATE_REGISTRATION_UNSUPPORTED` and keep any preview explicitly unregistered.
- A write would modify asset/source/registry files without explicit authorization.
- A request would write a site page/route or claim site visibility without `design-asset-publisher`.
