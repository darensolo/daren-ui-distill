# Host Adapter

Design Asset Registrar can depend on design-system host capabilities and Agent capabilities. It must not depend on external business systems, hidden local services, or private manual queues.

## Manifest

Each host provides an adapter manifest that conforms to `schemas/adapter-manifest.schema.json`.

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

When moving Design Asset Registrar to another design system, replace the manifest and adapter mappings. Do not change workflow semantics or copy host-specific contracts into the skill.
