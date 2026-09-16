# Rendered Interaction Gates

Rendered gates verify real UI states with a browser/render harness. They complement static conformance and do not replace human visual review.

## Required Evidence

Rendered interaction evidence should include:

- Runner identity and host adapter source.
- Local preview route or fixture path.
- Selectors tested.
- Interaction steps.
- Computed-style report.
- Screenshot paths.
- Machine result.
- Human review status.

## Choice Input Minimum

For `choice-input-family`, cover:

- Default.
- Hover.
- Focus-visible.
- Open.
- Keyboard ArrowDown / Enter / Escape.
- Disabled no-op.
- Invalid.
- Empty or no results.

If the rendered harness is unavailable, record the gate as unavailable. Do not mark rendered quality as passed.

## Dependency Rule

Do not add Playwright, Puppeteer, or another browser dependency without an explicit dependency proposal and user approval.
