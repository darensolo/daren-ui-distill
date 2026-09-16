# Host Adapter

Design Asset Registrar can depend on design-system host capabilities and Agent capabilities. It must not depend on external business systems, hidden local services, or private manual queues.

## Manifest

Each host provides an adapter manifest that conforms to `schemas/adapter-manifest.schema.json`. If no design-system-specific manifest is present, use the bundled `local-folder` adapter; do not block a portable register/publish demonstration merely because Daren Design is absent.

Bundled reference host manifest: `references/local-folder-adapter-manifest.json`.

```json
{
  "host": "local-folder",
  "allowedCapabilities": ["registry", "evidenceStore"],
  "evidenceRoot": ".ui-distill/evidence",
  "forbiddenCapabilities": ["externalBusinessSystems", "privateManualQueue", "localHiddenService"]
}
```

The reference adapter defaults to `.ui-distill/library` and `.ui-distill/site`. It accepts only validated adapted L2 component AssetPackages, requires separate persisted `library-write` and `site-write` authorizations, and emits separate RegistrationReceipt and PublicationReceipt files.

Daren Design default:

```json
{
  "host": "daren-design",
  "allowedCapabilities": [
    "tokens",
    "registry",
    "conformance",
    "renderedHarness",
    "evidenceStore",
    "docs",
    "agentSkills"
  ],
  "evidenceRoot": "evidence/d45",
  "forbiddenCapabilities": [
    "externalBusinessSystems",
    "privateManualQueue",
    "localHiddenService"
  ]
}
```

## Capability Rules

- `tokens`: token files, generated token CSS, token lint/check scripts.
- `registry`: catalog, registry, public export, asset hub metadata.
- `conformance`: machine-readable component/family contract and conformance scripts.
- `renderedHarness`: browser/render runner, selector strategy, screenshots, computed-style reports.
- `evidenceStore`: repo evidence directory configured by `evidenceRoot`.
- `docs`: design-system docs and specs used as guidance.
- `agentSkills`: local Agent skills and their references.

Every run-level evidence report must include the actual `capabilitiesUsed`.

The legacy host `golden-publish:check` must compare:

```text
capabilitiesUsed - allowedCapabilities
```

Any non-empty difference fails closed.

Its name is historical: registrar consumption is limited to registration assertions and cannot claim site publication.

## Migration Rule

When moving Design Asset Registrar to another design system, replace the manifest and adapter mappings. Do not change workflow semantics or copy host-specific contracts into the skill. Adapter selection order is explicit host manifest first, bundled `local-folder` fallback second.
