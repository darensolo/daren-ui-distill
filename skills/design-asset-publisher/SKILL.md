---
name: design-asset-publisher
description: "Publish an already registered UI Distiller component through the configured local SiteAdapter. Supports the bundled local-folder reference host and Daren Design when its host adapter is available; requires a fresh RegistrationReceipt and never registers assets or deploys publicly."
metadata: {"skill_id":"design-asset-publisher","governance_status":"active","required_references":[],"optional_references":[],"historical_references":[],"publication_kind":"copy","publication_platforms":["codex","qoder"]}
---

# Design Asset Publisher（设计资产上架）

Use this skill when the requested endpoint is visibility through a configured local site adapter. It is the only site-publication entry for UI Distiller assets.

## Boundary

- Input: a fresh `RegistrationReceipt` emitted by the selected LibraryAdapter, plus title, description, category, and `listed | unlisted` visibility.
- Output: a local site projection and a `PublicationReceipt`.
- Writes only through the selected SiteAdapter: Daren Astro projection when the Daren host is available, otherwise the bundled `.ui-distiller/site/publications/<slug>` reference projection.
- Never creates or repairs component-library truth. Route missing or stale registration back to `design-asset-registrar`.
- Never deploys a public site. `deploymentStatus` must remain `not-requested`; hosting or release needs separate authorization.

## Workflow

1. Locate the registered asset and its RegistrationReceipt. Select the Daren adapter only when the current host declares it; otherwise select `local-folder`.
2. Verify the receipt digest, registered entry, source files, revision, and route availability. Fail closed on drift or collision.
3. Collect the smallest site metadata needed by the selected adapter. Do not generate a hand-written page per asset.
4. Before any site write, require explicit `site-write` approval. After confirmation, use the Core `authorize` command to persist a separate authorization bound to the exact asset, revision, site projection target, registered source bundle digest, and normalized publication metadata. Never reuse the registration authorization.
5. Invoke the selected SiteAdapter. Daren writes the isolated projection consumed by its catalog, detail route, preview endpoint, and search index; `local-folder` writes a portable publication directory and receipt.
6. Run the host's declared verification. For Daren this includes the site build; for `local-folder` verify projection bytes and receipt. Do not invent a route or build when the adapter does not provide one.
7. Return the PublicationReceipt with route, preview route, source registration reference, file digests, visibility, and rollback target.

## Failure and retry

- Missing or reused approval, stale or fabricated receipt, source drift, unsupported asset kind, and route collision block publication before writes.
- Repeating the same receipt and metadata is idempotent.
- Different metadata or source at an existing route is a conflict, not an overwrite.
- Site rollback removes only the site projection and rebuilds the site; it must not remove or downgrade the registered library asset.

## Current support

- Hosts: bundled `local-folder` reference host; current local Daren Design Astro site when its adapter is available.
- Asset kind: UI Distiller adapted L2 `component` registered in the `distilled` collection.
- Site effects: `local-folder` portable publication projection, or Daren catalog/detail/isolated-preview/search projection.
- Unsupported: block, template, icon, recipe, public hosting deployment, marketplace submission, and legacy-site writers.
