# UI Distiller · Codex package

This directory is the Codex-specific manifest and guidance for one local plugin. The shared distribution builder adds the six canonical MECE skills, ESM runtime, schemas, and production dependencies. It does not install or publish itself.

## Build and self-check

Node `>=24.20 <26` is required. From the repository root:

```bash
node build.mjs --target codex --out /tmp/ui-distiller-codex
node /tmp/ui-distiller-codex/scripts/self-check.mjs
node /tmp/ui-distiller-codex/bin/ui-distiller.mjs check --json
```

The output directory must not already exist. Repeating the build into two new directories produces byte-identical package trees.

## Install lifecycle

P04-A deliberately does not modify a live Codex marketplace or user configuration. For an approved local marketplace, place the built directory at the source path already registered for `ui-distiller`, validate it, then run:

```bash
codex plugin add ui-distiller@<local-marketplace-name>
```

The default personal marketplace is discovered by Codex; do not add it again with `codex plugin marketplace add`. For a non-default marketplace, confirm it is local and configured before installation. Start a new Codex conversation after install or upgrade so skill discovery refreshes.

Upgrade by building a fresh package, validating it, atomically replacing only the registered plugin source, and running the same `codex plugin add` command. Disable or uninstall with:

```bash
codex plugin remove ui-distiller
```

Removing the plugin removes its installed config/cache entry only. User-selected output and job/artifact directories are outside the plugin root and must be preserved. Back them up separately if the operator chose a plugin-internal output path contrary to this package's instructions.

## Capability boundaries

- `audit-only` is the inspection default; repair requires explicit user intent and scope.
- A valid Blueprint starts replication without re-capture.
- Daren adaptation is explicit in the new route; compatible legacy `reproductionDepth` remains supported.
- Daren Library `register` and local Astro Site `publish` require separate explicit approvals and emit separate receipts. Public deployment remains unsupported.
- LibraryAdapter v1 registers only validated adapted L2 AssetPackages. Existing native Daren `.tsx` candidates may be prepared or previewed, but are not copied into `src/distilled` and cannot receive a fabricated registration receipt.
- After the user confirms each write, persist its content- and target-bound authorization with `ui-distiller authorize`; registration and publication never accept a shared boolean approval.
- Candidate evidence cannot upgrade source runtime truth. Real Codex source capture and cross-conversation host acceptance remain separate, not-yet-run acceptance work.
