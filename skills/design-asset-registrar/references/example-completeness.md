# Example Completeness

Example completeness checks whether an asset's example bundle teaches and proves the family contract without pretending human quality review is machine-verifiable.

## Machine Checks

For a component asset:

- Required family sections are present.
- Each example has a stable `data-example-*` hook.
- Preview and code blocks share metadata.
- P0 benchmark common capabilities are represented.
- Unsupported states are explicitly marked with a reason.

The required family sections and states must come from the host family contract adapter.

## Human Review

Human review covers:

- Example usefulness.
- Teaching quality.
- Whether adoption/rejection decisions from benchmark audit are sensible.
- Visual and interaction polish.

Machine `ok: true` means the structure is valid. It does not mean the examples are good.
