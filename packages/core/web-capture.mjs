import { isIP } from 'node:net';

import { validateContract } from '../contracts/validate.mjs';
import { digestObject, sha256Bytes } from './digest.mjs';
import { fail } from './errors.mjs';
import { assertRelativePath } from './scope.mjs';

const requiredArtifactKinds = ['static', 'screenshot', 'accessibility', 'computed-style'];
const allowedArtifactKinds = [...requiredArtifactKinds, 'interaction'];
const defaultArtifactLimit = 8 * 1024 * 1024;
const defaultTotalLimit = 24 * 1024 * 1024;
const notApplicable = (reason) => ({ status: 'not-applicable', reason });

function ipv4Number(address) {
  return address.split('.').reduce((value, part) => (value << 8n) + BigInt(part), 0n);
}

function inV4Range(value, base, prefix) {
  const shift = BigInt(32 - prefix);
  return value >> shift === ipv4Number(base) >> shift;
}

function publicIpv4(address) {
  const value = ipv4Number(address);
  return ![
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
    ['224.0.0.0', 4], ['240.0.0.0', 4],
  ].some(([base, prefix]) => inV4Range(value, base, prefix));
}

function ipv6Number(address) {
  let input = address.toLowerCase().split('%')[0];
  if (input.includes('.')) {
    const lastColon = input.lastIndexOf(':');
    const v4 = input.slice(lastColon + 1);
    const value = ipv4Number(v4);
    input = `${input.slice(0, lastColon)}:${Number((value >> 16n) & 0xffffn).toString(16)}:${Number(value & 0xffffn).toString(16)}`;
  }
  const halves = input.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.reduce((value, group) => (value << 16n) + BigInt(`0x${group}`), 0n);
}

function inV6Range(value, base, prefix) {
  const shift = BigInt(128 - prefix);
  return value >> shift === ipv6Number(base) >> shift;
}

function publicIpv6(address) {
  const value = ipv6Number(address);
  if (value === null || !inV6Range(value, '2000::', 3)) return false;
  return ![
    ['2001::', 23], ['2001:db8::', 32], ['2002::', 16],
    ['2620:4f:8000::', 48], ['3fff::', 20],
  ].some(([base, prefix]) => inV6Range(value, base, prefix));
}

export function isPublicNetworkAddress(address) {
  const version = isIP(address);
  return version === 4 ? publicIpv4(address) : version === 6 ? publicIpv6(address) : false;
}

export function normalizePublicWebUrl(value) {
  let url;
  try { url = new URL(value); } catch { fail('INVALID_WEB_URL', 'web capture requires a valid absolute URL'); }
  if (url.protocol !== 'https:') fail('WEB_URL_HTTPS_REQUIRED', 'web capture accepts public HTTPS URLs only');
  if (url.username || url.password) fail('WEB_URL_CREDENTIALS_FORBIDDEN', 'web capture URL must not contain credentials');
  if (url.port && url.port !== '443') fail('WEB_URL_PORT_UNSUPPORTED', 'web capture accepts the default HTTPS port only');
  if (isIP(url.hostname)) fail('WEB_URL_IP_LITERAL_FORBIDDEN', 'web capture requires a hostname; IP literals are not accepted');
  const hostname = url.hostname.toLowerCase();
  const forbiddenSuffixes = ['.localhost', '.local', '.internal', '.home.arpa', '.test', '.invalid', '.example'];
  if (!hostname.includes('.') || hostname === 'localhost' || forbiddenSuffixes.some((suffix) => hostname.endsWith(suffix))) {
    fail('WEB_URL_HOST_FORBIDDEN', 'web capture requires a public DNS hostname');
  }
  url.hash = '';
  return url.href;
}

function assertDriver(driver) {
  const capability = driver?.capability;
  if (capability?.status !== 'available') fail('WEB_CAPTURE_DRIVER_UNAVAILABLE', capability?.reason ?? 'no isolated web capture driver is available');
  if (capability.isolation !== 'ephemeral-profile'
    || capability.credentials !== 'none'
    || capability.networkPolicy !== 'public-only'
    || capability.downloads !== 'blocked'
    || capability.extensions !== 'blocked'
    || capability.serviceWorkers !== 'blocked') {
    fail('INVALID_WEB_CAPTURE_DRIVER', 'web capture driver must attest ephemeral isolation, no credentials, public-only networking, and blocked downloads, extensions, and service workers');
  }
  if (typeof driver.capture !== 'function') fail('INVALID_WEB_CAPTURE_DRIVER', 'available web capture driver must expose capture');
}

function normalizeViewport(viewport = {}) {
  const width = viewport.width ?? 1440;
  const height = viewport.height ?? 900;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 320 || width > 3840 || height < 320 || height > 2160) {
    fail('INVALID_WEB_VIEWPORT', 'web capture viewport must be integer width 320-3840 and height 320-2160');
  }
  return { width, height };
}

function normalizeLimits(limits = {}) {
  const normalized = {
    maxRedirects: limits.maxRedirects ?? 5,
    timeoutMs: limits.timeoutMs ?? 30_000,
    maxArtifactBytes: limits.maxArtifactBytes ?? defaultArtifactLimit,
    maxTotalBytes: limits.maxTotalBytes ?? defaultTotalLimit,
  };
  if (!Number.isInteger(normalized.maxRedirects) || normalized.maxRedirects < 0 || normalized.maxRedirects > 20) {
    fail('INVALID_WEB_LIMIT', 'web capture maxRedirects must be an integer from 0 to 20');
  }
  if (!Number.isInteger(normalized.timeoutMs) || normalized.timeoutMs < 1_000 || normalized.timeoutMs > 120_000) {
    fail('INVALID_WEB_LIMIT', 'web capture timeoutMs must be an integer from 1000 to 120000');
  }
  if (!Number.isInteger(normalized.maxArtifactBytes) || normalized.maxArtifactBytes < 1 || normalized.maxArtifactBytes > 32 * 1024 * 1024) {
    fail('INVALID_WEB_LIMIT', 'web capture maxArtifactBytes must be an integer from 1 to 33554432');
  }
  if (!Number.isInteger(normalized.maxTotalBytes) || normalized.maxTotalBytes < normalized.maxArtifactBytes || normalized.maxTotalBytes > 128 * 1024 * 1024) {
    fail('INVALID_WEB_LIMIT', 'web capture maxTotalBytes must be an integer no smaller than maxArtifactBytes and no greater than 134217728');
  }
  return normalized;
}

function validateNetworkAttestation(result, urls) {
  const byHost = new Map();
  for (const entry of result.resolvedAddresses ?? []) {
    if (!entry?.hostname || !entry?.address || !isPublicNetworkAddress(entry.address)) {
      fail('WEB_CAPTURE_NETWORK_BLOCKED', 'web capture resolved a non-public or invalid network address');
    }
    const hostname = entry.hostname.toLowerCase();
    if (!byHost.has(hostname)) byHost.set(hostname, []);
    byHost.get(hostname).push(entry.address);
  }
  for (const value of urls) {
    const hostname = new URL(value).hostname.toLowerCase();
    if (!byHost.get(hostname)?.length) fail('WEB_CAPTURE_ATTESTATION_INCOMPLETE', `web capture lacks public DNS evidence for ${hostname}`);
  }
}

function artifactBytes(artifact) {
  if (Buffer.isBuffer(artifact.bytes)) return artifact.bytes;
  if (artifact.bytes instanceof Uint8Array) return Buffer.from(artifact.bytes);
  if (typeof artifact.content === 'string') return Buffer.from(artifact.content, 'utf8');
  fail('INVALID_WEB_CAPTURE_ARTIFACT', 'web capture artifact requires bytes or UTF-8 content');
}

export async function captureWebUrl({
  url,
  viewport,
  theme = 'light',
  locale = 'en-US',
  driver,
  limits = {},
  artifactRoot,
}) {
  const requestedUrl = normalizePublicWebUrl(url);
  if (!['light', 'dark'].includes(theme)) fail('INVALID_WEB_THEME', 'web capture theme must be light or dark');
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) fail('INVALID_WEB_LOCALE', 'web capture locale is invalid');
  assertDriver(driver);
  const normalizedViewport = normalizeViewport(viewport);
  const normalizedLimits = normalizeLimits(limits);
  const result = await driver.capture({
    url: requestedUrl,
    viewport: normalizedViewport,
    theme,
    locale,
    maxRedirects: normalizedLimits.maxRedirects,
    timeoutMs: normalizedLimits.timeoutMs,
  });
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    fail('INVALID_WEB_CAPTURE_RESULT', 'web capture driver must return a result object');
  }
  for (const field of ['redirects', 'networkUrls', 'resolvedAddresses', 'artifacts']) {
    if (!Array.isArray(result[field])) fail('INVALID_WEB_CAPTURE_RESULT', 'web capture result requires ' + field + '[]');
  }
  const redirects = result.redirects.map(normalizePublicWebUrl);
  if (redirects.length > normalizedLimits.maxRedirects) fail('WEB_CAPTURE_REDIRECT_LIMIT', `web capture exceeded ${normalizedLimits.maxRedirects} redirects`);
  const finalUrl = normalizePublicWebUrl(result.finalUrl ?? requestedUrl);
  const networkUrls = [...new Set(result.networkUrls.map(normalizePublicWebUrl))].sort();
  if (!networkUrls.includes(finalUrl)) fail('WEB_CAPTURE_ATTESTATION_INCOMPLETE', 'web capture must attest the final page in networkUrls');
  const observedUrls = [...new Set([requestedUrl, ...redirects, finalUrl, ...networkUrls])];
  validateNetworkAttestation(result, observedUrls);

  const artifacts = [];
  const seenPaths = new Set();
  const seenKinds = new Set();
  let totalBytes = 0;
  const orderedArtifacts = [...result.artifacts].sort((left, right) => {
    const byKind = allowedArtifactKinds.indexOf(left.kind) - allowedArtifactKinds.indexOf(right.kind);
    return byKind || String(left.relativePath).localeCompare(String(right.relativePath));
  });
  for (const artifact of orderedArtifacts) {
    if (!allowedArtifactKinds.includes(artifact.kind)) {
      fail('INVALID_WEB_CAPTURE_ARTIFACT', `unsupported web evidence kind: ${artifact.kind ?? 'missing'}`);
    }
    const relativePath = assertRelativePath(artifact.relativePath);
    if (seenPaths.has(relativePath)) fail('INVALID_WEB_CAPTURE_ARTIFACT', `duplicate web artifact path: ${relativePath}`);
    seenPaths.add(relativePath);
    seenKinds.add(artifact.kind);
    const bytes = artifactBytes(artifact);
    if (bytes.length > normalizedLimits.maxArtifactBytes) fail('RESOURCE_LIMIT', `${relativePath} exceeds ${normalizedLimits.maxArtifactBytes} bytes`);
    totalBytes += bytes.length;
    if (totalBytes > normalizedLimits.maxTotalBytes) fail('RESOURCE_LIMIT', 'web capture artifacts exceed total byte limit');
    artifacts.push({ kind: artifact.kind, relativePath, bytes, digest: sha256Bytes(bytes), size: bytes.length });
  }
  for (const kind of requiredArtifactKinds) {
    if (!seenKinds.has(kind)) fail('WEB_CAPTURE_EVIDENCE_INCOMPLETE', `web capture requires ${kind} evidence`);
  }

  const captureDigest = digestObject({ requestedUrl, finalUrl, redirects, networkUrls, viewport: normalizedViewport, theme, locale, artifacts: artifacts.map(({ kind, relativePath, digest, size }) => ({ kind, relativePath, digest, size })) });
  const storageRoot = 'web-capture/' + captureDigest.slice(0, 16);
  const root = artifactRoot ? assertRelativePath(artifactRoot) + '/' + storageRoot : storageRoot;
  const sourceRef = { kind: 'source', id: new URL(finalUrl).hostname, revision: 1, digest: captureDigest, relativePath: `${root}/capture.json` };
  const resources = artifacts.map((artifact) => ({ relativePath: `${root}/${artifact.relativePath}`, offset: 0, size: artifact.size, digest: artifact.digest }));
  const sourceBuildContext = notApplicable('web capture has no installed build context');
  const capture = {
    schemaVersion: '1.0.0',
    kind: 'capture-bundle',
    source: { kind: 'web-url', ref: sourceRef },
    sourceBuildContext,
    archiveContext: notApplicable('web capture has no application archive context'),
    evidence: artifacts.map((artifact, index) => ({
      id: `web-${artifact.kind}-${index + 1}`,
      subject: 'source',
      kind: artifact.kind,
      ref: { kind: 'evidence', id: `web-${artifact.kind}-${index + 1}`, revision: 1, digest: artifact.digest, relativePath: resources[index].relativePath },
      sourceBuildContext,
      observation: 'observed',
    })),
    provenance: [sourceRef],
    resources,
  };
  const validation = validateContract('capture-ir', capture);
  if (!validation.valid) fail('INVALID_CAPTURE', JSON.stringify(validation.errors));
  return {
    capture,
    artifacts: artifacts.map((artifact) => ({ relativePath: storageRoot + '/' + artifact.relativePath, bytes: artifact.bytes })),
    observation: { requestedUrl, finalUrl, redirects, networkUrls, viewport: normalizedViewport, theme, locale },
  };
}
