# Daren UI Distill integration

Read this reference only when the request explicitly uses the Daren UI Distill contracts or asks to compose its stages. The existing D24 manual workflow remains available and unchanged for legacy invocations.

- A valid, digest-matching C9 Blueprint starts at `replicate`; do not capture or dissect it again.
- “原样复刻 / source-only” ends after Source Replica and its required checks. Do not implicitly adapt to Daren.
- Add `dissect` only for a supported source that lacks a valid Blueprint. Add `adapt` only when the user explicitly asks for design-system adaptation or passes the compatible legacy `reproductionDepth=source+adapt` contract.
- Preserve Source Replica as a separate artifact. Adaptation must never overwrite it.
- Replication itself never writes the shared library or site. Explicit delivery continues through `design-system-adapter` and then `design-asset-registrar`; `design-asset-publisher` may create a local Daren site projection only from a valid RegistrationReceipt.
- Preserve source/candidate evidence subjects. Candidate execution can validate the candidate but cannot make source runtime truth verified.

Explicit user endpoint and read-only intent outrank compatibility defaults. Reject conflicting old/new parameters rather than guessing.
