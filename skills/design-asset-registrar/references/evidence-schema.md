# Evidence Schema

Evidence root comes from the host manifest. Daren Design default:

```text
evidence/d45
```

Evidence files must not overwrite historical reports.

## File Patterns

```text
<evidenceRoot>/<assetId>-inventory-<timestamp>.json
<evidenceRoot>/<assetId>-benchmark-audit-<timestamp>.json
<evidenceRoot>/<assetId>-gap-report-<timestamp>.json
<evidenceRoot>/<assetId>-upgrade-proposal-<timestamp>.md
<evidenceRoot>/<assetId>-rendered-interaction-<timestamp>.json
<evidenceRoot>/<assetId>-registration-receipt-<timestamp>.json
<evidenceRoot>/<assetId>-workflow-retrospective-<timestamp>.json
<evidenceRoot>/<assetId>-source-attestation-<timestamp>.json
```

## Run-Level Minimum

```json
{
  "schemaVersion": 1,
  "assetId": "combobox",
  "assetKind": "component",
  "mode": "proposal",
  "host": "daren-design",
  "capabilitiesUsed": ["registry", "conformance", "evidenceStore"],
  "ok": false,
  "generatedAt": "2026-06-22T00:00:00.000Z"
}
```

`capabilitiesUsed` is mandatory for every run-level report.

## Human Review

```json
{
  "humanReview": {
    "required": true,
    "reviewedBy": null,
    "reviewedAt": null,
    "ok": false,
    "waivers": []
  }
}
```

If review is required and `ok` is not true, registration fails closed.

## Waiver

```json
{
  "reason": "Temporary rendered harness unavailable.",
  "scope": "rendered-interaction",
  "expiresAt": "2026-07-15"
}
```

Waivers without `reason`, `scope`, or `expiresAt` are invalid.

## Source Attestation

For `prepare` and source-affecting work:

```json
{
  "sourceAttestation": {
    "originalImplementation": true,
    "externalSourceCopied": false,
    "externalVisualAssetsCopied": false,
    "dependenciesAdded": [],
    "notes": []
  }
}
```

## No Regression

For `upgrade` and `realign`:

```json
{
  "noRegression": {
    "beforeGreenGates": ["registry:check", "conformance:check"],
    "afterResults": [
      { "gate": "registry:check", "ok": true },
      { "gate": "conformance:check", "ok": false }
    ],
    "blocksRegistryVerified": true
  }
}
```

## Benchmark Source Record

```json
{
  "name": "material",
  "system": "Material",
  "officialUrl": "https://...",
  "accessedAt": "2026-06-22T00:00:00.000Z",
  "summary": "...",
  "adoptionDecision": "adopt | reject | defer",
  "reason": "...",
  "failureDowngrade": null
}
```

Do not store long external excerpts.

Benchmark audit evidence should group source records under `systems` and include these top-level arrays:

```json
{
  "systems": [],
  "commonCapabilities": [],
  "adoptedIdeas": [],
  "rejectedIdeas": [],
  "darenGaps": [],
  "suggestedRefillActions": []
}
```

Use normalized lowercase `systems[].name` values, e.g. `atlassian`, `antd`, `material`, `carbon`, `slds`, `polaris`, `spectrum`, `fluent`, `shadcn`, `untitledui`. The host gate (`scripts/benchmark-audit-check.mjs`) enforces a **count floor** of at least 3 systems under the current host benchmark standard, each with an official URL and summary/coverageNote. Pick the 3+ systems by relevance to the asset. See `benchmark-systems.md` for the full roster and the roster-vs-floor distinction.
