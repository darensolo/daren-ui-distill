import assert from 'node:assert/strict';
import test from 'node:test';

import { captureWebUrl, isPublicNetworkAddress, normalizePublicWebUrl } from '../web-capture.mjs';
import { compileCapture } from '../compiler.mjs';

const artifacts = () => [
  { kind: 'static', relativePath: 'dom.html', content: '<main><button>Save</button></main>' },
  { kind: 'screenshot', relativePath: 'page.png', bytes: Buffer.from('png') },
  { kind: 'accessibility', relativePath: 'accessibility.json', content: '{"role":"main"}' },
  { kind: 'computed-style', relativePath: 'computed-style.json', content: '{"display":"block"}' },
];

function driver(overrides = {}) {
  return {
    capability: {
      status: 'available', isolation: 'ephemeral-profile', credentials: 'none',
      networkPolicy: 'public-only', downloads: 'blocked', extensions: 'blocked', serviceWorkers: 'blocked',
    },
    capture: async (request) => ({
      finalUrl: request.url,
      redirects: [],
      networkUrls: [request.url],
      resolvedAddresses: [{ hostname: 'example.com', address: '93.184.216.34' }],
      artifacts: artifacts(),
      ...overrides,
    }),
  };
}

test('web capture normalizes public HTTPS evidence into a deterministic CaptureBundle', async () => {
  const request = { url: 'https://EXAMPLE.com/page#section', viewport: { width: 1280, height: 720 }, theme: 'dark', locale: 'en-US', driver: driver() };
  const first = await captureWebUrl(request);
  const second = await captureWebUrl({ ...request, driver: driver({ networkUrls: ['https://example.com/page', 'https://example.com/page'], artifacts: artifacts().toReversed() }) });
  assert.deepEqual(first.capture, second.capture);
  assert.equal(first.observation.requestedUrl, 'https://example.com/page');
  assert.equal(first.capture.source.kind, 'web-url');
  assert.deepEqual(first.capture.evidence.map((entry) => entry.kind), ['static', 'screenshot', 'accessibility', 'computed-style']);
  assert.equal(first.artifacts.every((entry) => Buffer.isBuffer(entry.bytes)), true);
  const rooted = await captureWebUrl({ ...request, artifactRoot: 'captures/example' });
  assert.match(rooted.capture.source.ref.relativePath, /^captures\/example\/web-capture\//);
  assert.match(rooted.artifacts[0].relativePath, /^web-capture\//);

  const proposal = {
    nodeRefs: [first.capture.evidence[0].ref],
    states: [{ id: 'default', evidenceRefs: [first.capture.evidence[0].ref] }],
    events: [{ id: 'activate', trigger: 'click', evidenceRefs: [first.capture.evidence[0].ref], observation: 'observed' }],
  };
  assert.equal(compileCapture(first.capture, proposal).kind, 'ui-replica-ir');
});

test('web capture rejects unsafe URLs before invoking a driver', async () => {
  let invoked = false;
  const isolatedDriver = driver();
  isolatedDriver.capture = async () => { invoked = true; return {}; };
  const invalid = [
    ['http://example.com', 'WEB_URL_HTTPS_REQUIRED'],
    ['https://localhost', 'WEB_URL_HOST_FORBIDDEN'],
    ['https://printer', 'WEB_URL_HOST_FORBIDDEN'],
    ['https://service.local', 'WEB_URL_HOST_FORBIDDEN'],
    ['https://user:secret@example.com', 'WEB_URL_CREDENTIALS_FORBIDDEN'],
    ['https://127.0.0.1', 'WEB_URL_IP_LITERAL_FORBIDDEN'],
    ['https://example.com:444', 'WEB_URL_PORT_UNSUPPORTED'],
  ];
  for (const [url, code] of invalid) {
    await assert.rejects(() => captureWebUrl({ url, driver: isolatedDriver }), (error) => error.code === code);
  }
  assert.equal(invoked, false);
});

test('web capture fails closed for driver, DNS, redirect, and artifact gaps', async () => {
  await assert.rejects(() => captureWebUrl({ url: 'https://example.com', driver: { capability: { status: 'missing', reason: 'not installed' } } }), (error) => error.code === 'WEB_CAPTURE_DRIVER_UNAVAILABLE');
  await assert.rejects(() => captureWebUrl({ url: 'https://example.com', driver: driver({ resolvedAddresses: [{ hostname: 'example.com', address: '127.0.0.1' }] }) }), (error) => error.code === 'WEB_CAPTURE_NETWORK_BLOCKED');
  await assert.rejects(() => captureWebUrl({ url: 'https://example.com', driver: driver({ finalUrl: 'https://cdn.example.net', resolvedAddresses: [{ hostname: 'example.com', address: '93.184.216.34' }] }) }), (error) => error.code === 'WEB_CAPTURE_ATTESTATION_INCOMPLETE');
  await assert.rejects(() => captureWebUrl({ url: 'https://example.com', driver: driver({ artifacts: artifacts().filter((entry) => entry.kind !== 'accessibility') }) }), (error) => error.code === 'WEB_CAPTURE_EVIDENCE_INCOMPLETE');
  await assert.rejects(() => captureWebUrl({ url: 'https://example.com', driver: driver({ artifacts: [{ kind: 'static', relativePath: '../escape.html', content: 'x' }, ...artifacts().slice(1)] }) }), (error) => error.code === 'INVALID_RELATIVE_PATH');
});

test('web capture validates resource limits and malformed driver results', async () => {
  await assert.rejects(() => captureWebUrl({ url: 'https://example.com', driver: driver(), limits: { maxRedirects: -1 } }), (error) => error.code === 'INVALID_WEB_LIMIT');
  await assert.rejects(() => captureWebUrl({ url: 'https://example.com', driver: driver(), limits: { timeoutMs: 999 } }), (error) => error.code === 'INVALID_WEB_LIMIT');
  await assert.rejects(() => captureWebUrl({ url: 'https://example.com', driver: driver(), limits: { maxArtifactBytes: 100, maxTotalBytes: 99 } }), (error) => error.code === 'INVALID_WEB_LIMIT');
  const malformedDriver = driver();
  malformedDriver.capture = async () => undefined;
  await assert.rejects(() => captureWebUrl({ url: 'https://example.com', driver: malformedDriver }), (error) => error.code === 'INVALID_WEB_CAPTURE_RESULT');
});

test('public network classification blocks private, reserved, and documentation ranges', () => {
  for (const address of ['0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.1.1', '172.16.0.1', '192.168.1.1', '198.51.100.2', '203.0.113.2', '::1', 'fc00::1', 'fe80::1', '2001:db8::1', '2001::1', '2002:a00:1::1', '2620:4f:8000::1', '3fff::1']) {
    assert.equal(isPublicNetworkAddress(address), false, address);
  }
  assert.equal(isPublicNetworkAddress('93.184.216.34'), true);
  assert.equal(isPublicNetworkAddress('2606:4700:4700::1111'), true);
  assert.equal(normalizePublicWebUrl('https://example.com/#x'), 'https://example.com/');
});
