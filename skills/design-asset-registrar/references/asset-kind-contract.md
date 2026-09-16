# Asset Kind Contract

Design Asset Registrar distinguishes executable asset kinds from reserved and out-of-scope kinds.

## Executable

```text
component
```

`component` may run `proposal`, `prepare`, `register`, `upgrade`, and `realign` when host prerequisites are available.

## Reserved

```text
block
template
icon
recipe
```

Reserved kinds must return a clear message:

```text
This asset kind is reserved for Design Asset Registrar but not implemented yet.
```

Do not invent gates or contracts for reserved kinds during a component run.

## Out Of Scope

```text
foundation
token
pattern
governance
```

Route these to token governance, recipe/template, or documentation governance workflows. Do not process them as Design Asset Registrar assets.
