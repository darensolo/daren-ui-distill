# Design Asset Registrar Workflow

Use this sequence for every Design Asset Registrar run.

## 1. Mode Detect

Infer mode from request and current asset state:

| Signal | Mode |
|---|---|
| User asks for research, ideas, benchmark, audit, or suggestions | `proposal` |
| Source is missing | `proposal`, then `prepare` only after approval |
| Adapted L2 AssetPackage exists but registry/examples/evidence are incomplete | `register` |
| Native Daren source exists but is absent from a public shard/registry | `proposal` or `prepare`; `register` is unsupported |
| Asset is already registered but weak or incomplete | `upgrade` first as report-only |
| Contract changed and asset must catch up | `realign` first as report-only |

If uncertain, choose `proposal`.

## 2. Input Classification and Inventory

Classify the input before selecting a writer:

| Input | Allowed lane | Forbidden shortcut |
|---|---|---|
| `native-daren-source` (`.tsx`, package component, internal extension) | `proposal`, `prepare`, `upgrade`, `realign`, or labelled candidate preview | Do not copy to `src/distilled`; do not emit `RegistrationReceipt` |
| `adapted-asset-package` (validated L2 component with complete portable files) | `register` through LibraryAdapter v1 | Do not treat an arbitrary source directory as an AssetPackage |
| `registered-distilled-asset` with fresh receipt | `upgrade`, `realign`, or explicit handoff to publisher | Do not republish from source without receipt validation |

When a native candidate needs a new registry/public export, route that change through the owning design-system shard or its governing delivery work. Until that contract is implemented, return `NATIVE_CANDIDATE_REGISTRATION_UNSUPPORTED`; an unlisted candidate preview may be used for evaluation only and must say that it is not registered or published.

Read, without writing asset files:

- Asset catalog/registry entry.
- Component source and export path.
- Public export and registry mapping.
- Existing examples, preview/code metadata, and `data-example-*` hooks.
- Existing evidence.
- Current package scripts.
- Conformance and design-system checks available in the host repo.

## 3. Host Adapter

Load the host adapter manifest described in `host-adapter.md`. Track every host capability actually used and include it as `capabilitiesUsed` in run-level evidence.

## 4. Benchmark-First Refill Report

For `proposal`, and for report-only `upgrade` / `realign`, the primary output is a benchmark-driven refill report, not a host compliance report. Existing/registered assets still need the same benchmark-first shape; do not lead with gate blockers unless the user explicitly asks for compliance-only audit.

Use official sources only and make links directly clickable. For each benchmark system:

- State whether the system has a comparable component, field primitive, pattern, or only adjacent examples.
- List the examples or states that system shows.
- Identify the component anatomy, states, interactions, accessibility guidance, and real scenarios worth absorbing.
- Give a short comment on why the system matters for Daren, what to absorb, and what to reject or defer.
- Record source URL, access time, summary, adoption decision, and rejection/defer reasons in evidence.

Then synthesize:

- Common practices shared by at least three systems.
- Useful one- or two-system ideas.
- Rejected ideas with reasons.
- A concrete Daren refill example checklist grouped as P0/P1/P2.

Use the simplified research-report structure from `benchmark-systems.md`: current Daren state, benchmark conclusion table, per-system absorbable points and comments, common practices, Daren positioning, P0/P1/P2 refill checklist, then a brief host compliance tail.

For `prepare` and `register`, benchmark audit still informs implementation. If the current turn is report-only or approval-seeking, use the same benchmark-first report shape before requesting writeback.

## 5. Host Gap Matrix

After the benchmark proposal, output host-specific gaps:

- P0: blocks registration or makes the asset misleading.
- P1: important quality, usability, accessibility, or documentation gap.
- P2: polish, examples, or future extension.

Separate machine-checkable failures from human quality judgments.

## 5.5 User-Facing Final Response

For report-only `proposal`, `upgrade`, or `realign`, the final response must not collapse back to a compliance summary. It must inline a concise benchmark-first report:

1. Current Daren state.
2. Benchmark conclusion table with official links.
3. Per-system absorbable points and comments.
4. P0/P1/P2 refill checklist.
5. Verification/evidence/residual risk tail.

It is acceptable to also link evidence files, but evidence links cannot replace the benchmark table or per-system comments. If the agent wrote a Markdown proposal file, summarize its benchmark conclusion in the final answer instead of merely linking it.

## 6. Approval Gate

Before writing asset/source/registry/catalog/design-system truth files, summarize:

- Files likely to change.
- Mode and reason.
- Risks.
- Gates to run after write.

Proceed only after explicit user confirmation. Evidence reports may be written in `proposal`.

## 7. Implementation

Implement the approved scope only. Do not copy external source code or visual assets. Do not introduce dependencies unless the user approved a dependency proposal.

## 8. Verification

Run the available checks in this order when applicable:

```text
pnpm registry:check
pnpm registry:build
pnpm exec tsc -b
pnpm conformance:check <assetId>
pnpm benchmark-audit:check <assetId>
pnpm asset-examples:check <assetId>
pnpm asset-rendered:check <assetId>
pnpm no-regression:check <assetId>
pnpm golden-publish:check <assetId>  # legacy host gate name; registration assertions only
```

If a command does not exist yet, record it as unavailable and do not claim the corresponding gate passed.

The legacy host command may contain `publish` in its name, but this workflow must not set site-visible/published state, write site routes, or emit a SiteAdapter receipt.

## 9. Retrospective

Every run ends with workflow retrospective evidence. Generic process gaps become a `skill-improvement-proposal`; asset-specific gaps stay in the asset gap report.
