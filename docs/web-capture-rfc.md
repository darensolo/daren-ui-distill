# Public Web Capture Driver v1

Status: implemented and packaged; `web-url` is supported for public HTTPS pages in `release.json`.

## Decision

UI Distiller Core still does not execute captured artifacts. Live page scripts run only inside the packaged Chromium driver, in a new ephemeral browser profile and browser context for each capture. The driver is included in Codex and Qoder distributions and uses Chrome, Chromium, Edge, or Brave already installed on the supported macOS host; `UI_DISTILLER_BROWSER_PATH` can select another Chromium executable.

## Supported boundary

The v1 driver accepts only public HTTPS pages with:

- no URL credentials, login flow, cookies, imported browser profile, or private session;
- the default HTTPS port;
- an ephemeral browser profile and context, denied downloads, disabled extensions, bypassed/disabled service workers, disabled QUIC, and non-proxied WebRTC disabled;
- a fixed viewport, light or dark theme, and explicit locale;
- at most five redirects by default;
- source artifacts for DOM/static content, screenshot, accessibility tree, and computed style;
- 8 MiB per-artifact and 24 MiB total defaults.

Every browser connection goes through a loopback HTTPS CONNECT proxy owned by the capture. The proxy resolves each hostname immediately before connection, rejects the whole answer set if any address is private, local, reserved, documentation, benchmarking, multicast, or otherwise non-public, and connects to the selected IP directly. Chromium receives host resolver rules that prevent it from resolving or bypassing the proxy for remote hosts. This removes the DNS-rebinding gap between policy validation and the actual socket.

The Core independently normalizes requested, redirect, final, and observed network URLs; validates driver attestation and public DNS evidence; checks artifact kinds, paths, and byte limits; calculates digests; and emits a standard `CaptureBundle`.

## Driver interface

```js
import { createChromiumWebCaptureDriver } from 'ui-distiller/chromium-web-driver';
import { captureWebUrl } from 'ui-distiller/web-capture';

const driver = await createChromiumWebCaptureDriver();
const result = await captureWebUrl({
  url: 'https://example.com/',
  viewport: { width: 1440, height: 900 },
  theme: 'light',
  locale: 'en-US',
  driver,
});
```

The CLI selects this driver for `source.kind="web-url"`, requires `--out-dir`, materializes every evidence byte and `capture.json` transactionally, and returns the validated `CaptureBundle`.

```bash
printf '%s' '{"source":{"kind":"web-url","url":"https://example.com/"},"viewport":{"width":1440,"height":900}}' \
  | node dist/codex/bin/ui-distiller.mjs capture --base-dir "$PWD" --out-dir captures/example --json
```

## Not in v1

- authentication, consent flows, account pages, session reuse, or imported cookies;
- arbitrary ports, HTTP, local files, localhost, intranet, or IP-literal sources;
- download execution, extension loading, persistent service workers, or public deployment;
- claiming hidden interactions, responsive states, or application logic that were not observed;
- treating a screenshot alone as a complete Web CaptureBundle.

## Acceptance evidence

The promotion gate is executable as `pnpm test:web-e2e` and has passed with the packaged Codex distribution:

1. The driver uses only Node built-ins and an installed Chromium-family executable, not repository dev dependencies.
2. The pinned CONNECT proxy rejects private/reserved address sets at connection time; Core revalidates all network attestations and redirects.
3. Each capture uses a new profile/context with credentials absent and downloads, extensions, service workers, QUIC, and non-proxied WebRTC blocked.
4. DOM, screenshot, accessibility, and computed-style artifacts are materialized and digest-verified.
5. `https://example.com/` completes URL → CaptureBundle → Blueprint → Source Replica at 800×600 and 1280×720.
6. A built Codex package captures the same public fixture through its installed launcher and writes verified evidence.
7. Invalid URLs, addresses, redirects, driver results, artifact paths, missing evidence, limits, and oversized output fail with typed errors.
