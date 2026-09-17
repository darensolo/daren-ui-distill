# ChatGPT public homepage Source Replica

A standalone, local-only reconstruction of the public logged-out ChatGPT home at a 1440 × 900 light-theme reference viewport.

## Preview

From the repository root:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open:

`http://127.0.0.1:4173/artifacts/chatgpt-source-replica/`

## Verify

```bash
node artifacts/chatgpt-source-replica/tests/verify.mjs
node artifacts/chatgpt-source-replica/tests/interaction-smoke.mjs
```

The interaction test uses the repository's Playwright dependency and expects the preview server above to be running.

## Boundaries

- No ChatGPT login, cookie, API, upload or voice session is used.
- All interactive product behavior is local simulation with visible feedback.
- The candidate is high fidelity to the observed public information architecture, but is not described as pixel-verified because the isolated source screenshot capture was blocked by local network routing.
- See `baseline.md`, `plan.md` and `fidelity-report.json` for evidence and gaps.
