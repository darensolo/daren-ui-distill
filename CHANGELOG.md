# Changelog

## 0.2.2 — 2026-09-16

- Made publication and preview routes host-neutral while retaining traversal-safe URL path patterns.
- Added conformance coverage for both reference and Daren Design routes plus traversal, case and query-string rejection.

## 0.2.1 — 2026-09-16

- Made `RegistrationReceipt.publicEntry` host-neutral while retaining a traversal-safe package-subpath pattern.
- Added conformance coverage for both the reference `./assets/*` entry and Daren Design `./distilled/*` entries.

## 0.2.0 — 2026-09-16

- Extracted contracts, core, CLI and the six UI Distill skills from Mindex-Next by allowlist.
- Added Codex and Qoder local plugin package targets.
- Added the generic `local-folder` registration and publication reference adapter.
- Published the source under Apache-2.0 with fresh-clone verification.
- Kept public website deployment, marketplace submission and Daren Design-specific adapters out of scope.
