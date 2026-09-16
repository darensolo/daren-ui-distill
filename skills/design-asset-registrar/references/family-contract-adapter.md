# Family Contract Adapter

Family requirements are owned by the host conformance contract. Design Asset Registrar reads them; it does not define them.

## Required Behavior

The adapter must provide:

- Family id for an asset.
- Components registered to that family.
- Required example sections.
- Required states.
- Required interactions.
- Machine-readable source path or command that produced the contract.

## First Family

The first intended family is `choice-input-family`.

Design Asset Registrar may use it only after the host conformance contract defines it and registers `multi-select` / `combobox`.

## Fail Closed

If a family contract is needed but no machine-readable host source exists:

- `proposal` may produce a gap report.
- `prepare`, `register`, `upgrade`, `realign`, and registration success must be blocked.

Do not hand-copy a family matrix into this file. A non-normative planning snapshot in a spec is not an implementation truth source.
