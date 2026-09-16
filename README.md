# Daren UI Distill

Daren UI Distill is a local-first pipeline for turning authorized UI evidence into inspectable design assets. It keeps source capture, Blueprint, Source Replica, design-system adaptation, registration, publication, and audit evidence separate so each effect can be reviewed and retried.

## Current status

This directory is a **local open-source candidate**, extracted from Mindex-Next by an explicit allowlist. No public remote or release has been created yet. The candidate intentionally uses `UNLICENSED` until the project owner selects the public license.

## Six task skills

1. `ui-decomposer` — authorized evidence to C9 Blueprint.
2. `ui-replica-engine` — valid Blueprint to retained Source Replica.
3. `design-system-adapter` — explicit design-system adaptation without overwriting the source replica.
4. `design-asset-registrar` — approved adapted L2 asset to RegistrationReceipt.
5. `design-asset-publisher` — fresh RegistrationReceipt to local site projection and PublicationReceipt.
6. `ui-audit-repair` — audit-only by default; bounded repair when explicitly requested.

## Repository boundaries

- `packages/contracts` owns JSON contracts and validation.
- `packages/core` owns deterministic capture, Blueprint, generation, audit, repair, authorization and Port behavior.
- `packages/cli` owns the thin command-line host.
- `adapters/local-folder` is the public reference implementation for register/publish.
- `plugins/codex` and `plugins/qoder` are thin host manifests over one shared package builder.
- `skills` is the canonical source for the six product skills.

Daren Design-specific Registry and Astro publication adapters are not part of this repository. They consume the public contracts from the Daren Design side.

## Local verification

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test
```

Build host packages into new output directories:

```bash
node build.mjs --target codex --out /tmp/daren-ui-distill-codex
node build.mjs --target qoder --out /tmp/daren-ui-distill-qoder
```

## Public release hold

Before the first public release, choose a license, complete provenance review, create the GitHub remote, replace candidate links, and repeat the fresh-clone verification. Those are deliberate Human authorization points.
