---
name: design-asset-publisher
description: "Publish an already registered Daren Design component to the current local Astro design site. Requires a fresh RegistrationReceipt, owns catalog/detail/preview/search projection and PublicationReceipt, and never registers assets or deploys publicly."
metadata: {"skill_id":"design-asset-publisher","governance_status":"active","required_references":[],"optional_references":[],"historical_references":[],"publication_kind":"copy","publication_platforms":["codex","qoder"]}
---

# Design Asset Publisher（设计资产上架）

Use this skill when the requested endpoint is visibility on the Daren Design site. It is the only site-publication entry for UI Distill assets.

## Boundary

- Input: a fresh `RegistrationReceipt` emitted by the Daren LibraryAdapter, plus title, description, category, and `listed | unlisted` visibility.
- Output: current Astro catalog/detail/isolated-preview/search projection and a `PublicationReceipt`.
- Writes only the local Daren Design site projection through the SiteAdapter.
- Never creates or repairs component-library truth. Route missing or stale registration back to `design-asset-registrar`.
- Never deploys a public site. `deploymentStatus` must remain `not-requested`; hosting or release needs separate authorization.

## Workflow

1. Locate the registered asset and its RegistrationReceipt.
2. Verify the receipt digest, registered entry, source files, revision, and route availability. Fail closed on drift or collision.
3. Collect the smallest site metadata needed for the current dynamic site. Do not generate a hand-written Astro page per asset.
4. Before any site write, require explicit `site-write` approval. After confirmation, use the Core `authorize` command to persist a separate authorization bound to the exact asset, revision, site projection target, registered source bundle digest, and normalized publication metadata. Never reuse the registration authorization.
5. Invoke the Daren SiteAdapter. It writes an isolated projection consumed by the existing catalog, detail route, preview endpoint, and search index.
6. Run the current site build. Do not report success when the route, preview, or build is unavailable.
7. Return the PublicationReceipt with route, preview route, source registration reference, file digests, visibility, and rollback target.

## Failure and retry

- Missing or reused approval, stale or fabricated receipt, source drift, unsupported asset kind, and route collision block publication before writes.
- Repeating the same receipt and metadata is idempotent.
- Different metadata or source at an existing route is a conflict, not an overwrite.
- Site rollback removes only the site projection and rebuilds the site; it must not remove or downgrade the registered library asset.

## Current support

- Host: current local Daren Design Astro site.
- Asset kind: UI Distill adapted L2 `component` registered in the `distilled` collection.
- Site effects: local catalog, detail page, isolated interactive preview, and search projection.
- Unsupported: block, template, icon, recipe, public hosting deployment, marketplace submission, and legacy-site writers.
