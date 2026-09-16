# No Regression

No-regression applies to `upgrade` and `realign`.

## Rule

An approved write must not turn a previously green gate red while claiming registry verification.

## Steps

1. Record previously green gates before writeback.
2. Perform only approved changes.
3. Rerun all previously green gates.
4. If any gate turns red, block registration success.
5. If the user keeps the change anyway, record a waiver and keep the asset below registry-verified.

## Evidence

Use the `noRegression` shape in `evidence-schema.md`.

Separate machine failures from human review concerns.
