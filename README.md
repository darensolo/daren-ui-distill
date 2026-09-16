# Daren UI Distill

Daren UI Distill is a local-first pipeline for turning authorized UI evidence into inspectable design assets. It keeps source capture, Blueprint, Source Replica, design-system adaptation, registration, publication, and audit evidence separate so each effect can be reviewed and retried.

## Current status

This repository is the public source of truth for Daren UI Distill. It is licensed under Apache-2.0 and distributed as source plus local Codex and Qoder plugin builders. `private: true` in `package.json` prevents accidental npm publication; it does not limit use of the public repository.

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

Host-specific Library/Site adapters must import the supported bridge from `daren-ui-distill/adapter-kit`; internal `packages/` paths are not public API. The exported contract fixture exists for conformance tests only.

## Local verification

```bash
git clone https://github.com/darensolo/daren-ui-distill.git
cd daren-ui-distill
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test
```

Build host packages into new output directories:

```bash
node build.mjs --target codex --out /tmp/daren-ui-distill-codex
node build.mjs --target qoder --out /tmp/daren-ui-distill-qoder
```

## Plugin installation

Build a self-contained host package, run its self-check, and import the resulting directory through the host's local plugin flow:

```bash
pnpm build:codex
node dist/codex/scripts/self-check.mjs

pnpm build:qoder
node dist/qoder/scripts/self-check.mjs
```

Build outputs contain the six canonical skills and a bundled runtime. They do not deploy a public website, upload captured evidence, or enable telemetry.

## License and contributions

Licensed under [Apache-2.0](LICENSE). Bundled dependency licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution and evidence-safety expectations and [SECURITY.md](SECURITY.md) for vulnerability reporting.
