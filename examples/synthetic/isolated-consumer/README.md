# Isolated public-package consumer

This **E2E_FIXTURE_ONLY** harness copies only files declared by an AssetPackage, verifies each digest, and imports `component.js` through its public exports. It does not install or import the Daren Design source tree, a component library, a design site, or the source application's runtime.

Run the browser check from the repository root:

```bash
pnpm exec playwright install chromium
node --test examples/synthetic/isolated-consumer/consumer.test.mjs
```

The test launches a real Playwright Chromium browser, exercises compact/medium/wide container widths, checks the declared state, and asserts click and keyboard intent callbacks. Missing browser support is BLOCKED at the DH05 E2E runner; it must not be reported as PASS.
