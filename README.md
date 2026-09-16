# Daren UI Distill

**Turn authorized UI evidence into inspectable, adaptable design assets — locally.**

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Release](https://img.shields.io/badge/release-v0.2.3-6b5ce7)](https://github.com/darensolo/daren-ui-distill/releases/tag/v0.2.3)
[![Node](https://img.shields.io/badge/node-%3E%3D24.20%20%3C26-3c873a)](package.json)

Daren UI Distill is a local-first pipeline that decomposes authorized UI sources — installed-app archives, asset directories, saved evidence bundles — into Blueprints, faithful Source Replicas, and design-system-adapted assets. Every stage keeps its own evidence and receipts, so each effect can be reviewed, retried, or rolled back. It ships as local plugins for Codex Desktop and Qoder IDE. Product page: [daren.design/distill](https://www.daren.design/distill/).

## Highlights

- **Local-first** — capture, generation, and audit run on your machine; no telemetry service.
- **Six task skills** — dissect, replicate, adapt, register, publish, plus a cross-cutting audit/repair skill.
- **Source stays intact** — the Source Replica and the Daren-adapted output are physically separate deliverables.
- **Writes are gated** — candidate output, library registration, and site publication each require explicit approval and emit receipts.
- **Evidence over scores** — differences and residuals are reported per track, not hidden behind a single similarity number.
- **Audit-only by default** — repair runs only when requested, scoped, and capped at three rounds per job.

## Quick start

Requirements: macOS (Apple Silicon or Intel) · Node.js >= 24.20 < 26 · pnpm.

```bash
git clone https://github.com/darensolo/daren-ui-distill.git
cd daren-ui-distill
pnpm install --frozen-lockfile

# Build a self-contained host package and verify it
pnpm build:codex    # or: pnpm build:qoder
node dist/codex/scripts/self-check.mjs
```

Then import the `dist/codex` (or `dist/qoder`) directory through your host's local plugin flow — see [plugins/codex/README.md](plugins/codex/README.md) or [plugins/qoder/README.md](plugins/qoder/README.md). Build outputs contain the six canonical skills and a bundled runtime; they do not deploy a public website, upload captured evidence, or enable telemetry.

To run the full local verification suite:

```bash
pnpm exec playwright install chromium
pnpm test
```

## How it works

```text
authorized source → CaptureBundle → Blueprint → Source Replica → Adaptation → Registration → Publication
```

Audit is a cross-cutting, read-only action over any stage. Contracts and Core are host-neutral; registration and publication are effect Ports, so a design system can provide its own adapters without changing Core. See [docs/architecture.md](docs/architecture.md) for the full picture.

## Six skills

| Skill | What it does | Key deliverable |
| --- | --- | --- |
| `ui-decomposer` | Turns authorized evidence into a structured, generation-ready Blueprint. | C9 Blueprint |
| `ui-replica-engine` | Rebuilds a runnable, faithful replica from a valid Blueprint. | Source Replica |
| `design-system-adapter` | Maps an existing asset to target tokens and conventions without overwriting the source replica. | Adapted AssetPackage |
| `design-asset-registrar` | Validates and registers an approved adapted L2 asset after explicit `library-write` approval. | RegistrationReceipt |
| `design-asset-publisher` | Projects a freshly registered asset onto the local design site after explicit `site-write` approval. | PublicationReceipt |
| `ui-audit-repair` | Inspects assets at any stage; performs bounded repair only when explicitly requested. | QualityReport |

## Capability boundary

Supported sources today: installed-app / application archives (`codex-macos-asar`), declared ESM asset directories, and evidence bundles (static, screenshot, accessibility, interaction, computed-style). Explicitly out of scope for v0.2.3: generic web-URL capture, public deployment, and any telemetry. The machine-readable boundary is [release.json](release.json); security invariants (read-only source, per-write approval, fail-closed preview isolation) are enforced in Core.

## Repository layout

- `packages/contracts` — JSON contracts and validation.
- `packages/core` — deterministic capture, Blueprint, generation, audit, repair, authorization, and Port behavior.
- `packages/cli` — thin command-line host.
- `adapters/local-folder` — public reference adapter for register/publish.
- `plugins/codex`, `plugins/qoder` — thin host manifests over one shared package builder.
- `skills` — canonical source for the six product skills.

Host-specific Library/Site adapters must import the supported bridge from `daren-ui-distill/adapter-kit`; internal `packages/` paths are not public API.

## Contributing, security, license

Licensed under [Apache-2.0](LICENSE). Bundled dependency licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution and evidence-safety expectations, [SECURITY.md](SECURITY.md) for vulnerability reporting, and [CHANGELOG.md](CHANGELOG.md) for release history.
