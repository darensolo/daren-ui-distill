# UI Distiller · Qoder package

This is the Qoder host projection of the shared UI Distiller runtime and its six canonical MECE skills. Qoder-specific content is limited to the manifest and this installation guide; runtime code and skill bodies stay shared with the Codex package.

## Build and validate

Node `>=24.20 <26` is required. From the repository root:

```bash
node build.mjs --target qoder --out /tmp/ui-distiller-qoder
node /tmp/ui-distiller-qoder/scripts/self-check.mjs
node /tmp/ui-distiller-qoder/bin/ui-distiller.mjs check --json
```

The output directory must not already exist. Import the built directory as a local plugin from Qoder's plugin management UI. Do not import `plugins/qoder` directly: it intentionally omits generated runtime and skill projections.

After install or upgrade, refresh skill discovery and start with a goal in ordinary language; skill names are optional:

- “Capture https://example.com at 1440×900, then decompose it into a page Blueprint.”
- “Inspect this local page, report the UI problems, and do not modify source files.”
- “Analyze this supported source into a Blueprint only.”
- “Repair only the P1 findings in this report, then re-audit the affected states.”

Public HTTPS URL capture is supported through the packaged isolated Chromium driver. It requires an installed Chrome, Chromium, Edge, or Brave executable and does not accept authentication, existing sessions, localhost, intranet, IP literals, HTTP, or non-default ports. A screenshot is accepted only as part of a valid evidence bundle.

## Capability boundaries

- Qoder discovers the same six skill entry points as Codex; there are no Qoder-only workflow forks.
- `audit-only` remains the inspection default; repair requires explicit user intent and scope.
- Daren adaptation, library registration, and local site publication remain separate stages.
- Registration and publication require separate, target-bound approvals and emit separate receipts.
- Public deployment and marketplace submission remain unsupported.
- Removing the plugin must not delete user-selected jobs, artifacts, registered assets, or site projections outside the plugin root.
