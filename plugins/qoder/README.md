# Daren UI Distiller · Qoder package

This is the Qoder host projection of the shared Daren UI Distill runtime and its six canonical MECE skills. Qoder-specific content is limited to the manifest and this installation guide; runtime code and skill bodies stay shared with the Codex package.

## Build and validate

Node `>=24.20 <26` is required. From the repository root:

```bash
node build.mjs --target qoder --out /tmp/daren-ui-distill-qoder
node /tmp/daren-ui-distill/scripts/self-check.mjs
node /tmp/daren-ui-distill/bin/daren-ui-distill.mjs check --json
```

The output directory must not already exist. Import the built directory as a local plugin from Qoder's plugin management UI. Do not import `plugins/qoder` directly: it intentionally omits generated runtime and skill projections.

## Capability boundaries

- Qoder discovers the same six skill entry points as Codex; there are no Qoder-only workflow forks.
- `audit-only` remains the inspection default; repair requires explicit user intent and scope.
- Daren adaptation, library registration, and local site publication remain separate stages.
- Registration and publication require separate, target-bound approvals and emit separate receipts.
- Public deployment and marketplace submission remain unsupported.
- Removing the plugin must not delete user-selected jobs, artifacts, registered assets, or site projections outside the plugin root.
