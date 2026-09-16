# Architecture

The production chain is `authorized source → CaptureBundle → Blueprint → Source Replica → optional adaptation → registration → publication`. Audit is a cross-cutting action and is read-only by default.

Contracts and Core are host-neutral. Codex and Qoder packages contain the same runtime and canonical skills plus exactly one host manifest. Registration and publication are effect Ports: the public repository ships a local-folder reference adapter; a design system may provide its own adapter without changing Core.

Source Replica and adapted output remain physically separate. Registration and publication require different persisted authorizations and emit different receipts. Publication rollback removes only the site projection.
