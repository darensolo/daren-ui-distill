import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

import { validateContract } from '../contracts/validate.mjs';
import { readAsarEntry, readAsarIndex } from './archive/asar-reader.mjs';
import { digestObject, sha256Bytes, sha256File } from './digest.mjs';
import { fail } from './errors.mjs';
import { assertRelativePath, resolveAuthorizedPath, toPosixRelative } from './scope.mjs';

const notApplicable = (reason) => ({ status: 'not-applicable', reason });
const sensitiveDirectory = /^(cookies?|login data|local storage|session storage|web data|keychain|\.ssh|\.aws|\.gnupg)$/i;
const sensitiveFile = /^(?:\.env(?:\..+)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|authorized_keys|credentials|.+\.(?:pem|p12|pfx|key))$/i;

function isSensitivePath(...values) {
  const normalized = path.posix.normalize(path.posix.join(...values.map(assertRelativePath)));
  return normalized.split('/').some((component) => sensitiveDirectory.test(component) || sensitiveFile.test(component));
}

function makeRef(kind, id, digest, relativePath) {
  return { kind, id, revision: 1, digest, relativePath };
}

async function validateImportedObservations(observations, { baseDir, roots, sourceDigest, sourceBuildContext }) {
  const verified = [];
  for (const observation of observations) {
    if (observation.subject !== 'source') fail('INVALID_EVIDENCE_SUBJECT', 'capture accepts source evidence only');
    if (observation.kind !== 'interaction') fail('INVALID_OBSERVATION_ENVELOPE', 'imported runtime observations must use an interaction evidence envelope');
    const relativePath = observation.ref?.relativePath;
    if (!relativePath) fail('INVALID_OBSERVATION_REF', 'imported observation requires an evidence ref');
    if (isSensitivePath(relativePath)) fail('SENSITIVE_SOURCE_PATH', 'account, cookie, session, or secret evidence cannot be imported');
    const evidenceFile = await resolveAuthorizedPath(relativePath, { baseDir, roots });
    const bytes = await readFile(evidenceFile);
    if (sha256Bytes(bytes) !== observation.ref.digest) fail('EVIDENCE_DIGEST_MISMATCH', `imported observation digest does not match: ${relativePath}`);
    let envelope;
    try { envelope = JSON.parse(bytes.toString('utf8')); } catch { fail('INVALID_OBSERVATION_ENVELOPE', 'interaction evidence must be a JSON envelope'); }
    const locatorCount = Number(Boolean(envelope.eventId)) + Number(Boolean(envelope.stateId));
    const expectedBuildRef = sourceBuildContext.status === 'available' ? sourceBuildContext.ref : null;
    const locatorKind = envelope.eventId ? 'event' : 'state';
    const locator = envelope.eventId ?? envelope.stateId;
    const expectedRefId = `interaction-${locatorKind}-${Buffer.from(locator, 'utf8').toString('base64url')}`;
    if (envelope.schemaVersion !== '1.0.0' || envelope.subject !== 'source' || envelope.kind !== 'interaction'
      || envelope.observation !== observation.observation || envelope.sourceDigest !== sourceDigest
      || locatorCount !== 1 || (envelope.eventId && envelope.eventId !== observation.id)
      || (envelope.stateId && envelope.stateId !== observation.stateId)
      || digestObject({ ref: envelope.buildRef ?? null }) !== digestObject({ ref: expectedBuildRef })
      || digestObject({ context: observation.sourceBuildContext }) !== digestObject({ context: sourceBuildContext })) {
      fail('INVALID_OBSERVATION_ENVELOPE', 'interaction evidence is not bound to this source, build, event/state, and observation');
    }
    verified.push({ ...structuredClone(observation), ref: { ...structuredClone(observation.ref), id: expectedRefId } });
  }
  return verified;
}

export async function captureSource({
  baseDir,
  scope,
  source,
  selectors = [],
  observations = [],
  limits = {},
}) {
  if (!source || !['installed-app', 'application-archive', 'asset-directory', 'evidence-bundle'].includes(source.kind)) {
    fail('UNSUPPORTED_SOURCE', `unsupported source kind: ${source?.kind ?? 'missing'}`);
  }
  if (!Array.isArray(selectors) || selectors.length === 0) fail('EMPTY_SELECTION', 'capture requires explicit resource selectors');
  selectors.forEach(assertRelativePath);
  const sourceRelativePath = assertRelativePath(source.relativePath);
  if (selectors.some((selector) => isSensitivePath(sourceRelativePath, selector))) fail('SENSITIVE_SOURCE_PATH', 'account, cookie, session, or secret storage cannot be captured');
  const realBase = await realpath(baseDir);
  const roots = scope?.readRoots ?? [];
  const resources = [];
  let sourceDigest;
  let sourcePath = sourceRelativePath;
  let sourceBuildContext = notApplicable('source has no installed build context');
  let archiveContext = notApplicable('source has no application archive context');

  if (source.kind === 'application-archive' || source.kind === 'installed-app') {
    if (!source.buildRef || !source.archiveRef) fail('MISSING_SOURCE_CONTEXT', 'installed application capture requires buildRef and archiveRef');
    sourcePath = source.kind === 'installed-app'
      ? path.posix.join(assertRelativePath(source.relativePath), assertRelativePath(source.archiveRelativePath))
      : assertRelativePath(source.relativePath);
    const index = await readAsarIndex(sourcePath, {
      baseDir: realBase,
      roots,
      maxHeaderBytes: limits.maxHeaderBytes,
      maxEntries: limits.maxEntries,
    });
    let totalBytes = 0;
    for (const selector of selectors) {
      const bytes = await readAsarEntry(index, selector, { maxBytes: limits.maxResourceBytes });
      totalBytes += bytes.length;
      if (limits.maxTotalBytes && totalBytes > limits.maxTotalBytes) fail('RESOURCE_LIMIT', 'selected ASAR resources exceed total byte limit');
      resources.push({ relativePath: selector, offset: index.entries.find((entry) => entry.path === selector).offset, size: bytes.length, digest: sha256Bytes(bytes) });
    }
    sourceDigest = await sha256File(index.archivePath);
    sourceBuildContext = { status: 'available', ref: source.buildRef };
    archiveContext = { status: 'available', ref: source.archiveRef };
  } else {
    for (const selector of selectors) {
      const selected = path.posix.join(assertRelativePath(source.relativePath), selector);
      const absolute = await resolveAuthorizedPath(selected, { baseDir: realBase, roots });
      const bytes = await readFile(absolute);
      const maxResourceBytes = limits.maxResourceBytes ?? 8 * 1024 * 1024;
      if (bytes.length > maxResourceBytes) fail('RESOURCE_LIMIT', `${selected} exceeds ${maxResourceBytes} bytes`);
      resources.push({ relativePath: toPosixRelative(realBase, absolute), offset: 0, size: bytes.length, digest: sha256Bytes(bytes) });
    }
    sourceDigest = digestObject({ kind: source.kind, resources });
  }

  const verifiedObservations = await validateImportedObservations(observations, { baseDir: realBase, roots, sourceDigest, sourceBuildContext });

  const sourceRef = makeRef('source', source.id ?? path.posix.basename(source.relativePath), sourceDigest, assertRelativePath(sourcePath));
  const staticEvidence = resources.map((resource, index) => ({
    id: `static-${index + 1}`,
    subject: 'source',
    kind: 'static',
    ref: makeRef('evidence', `resource-${index + 1}`, resource.digest, resource.relativePath),
    sourceBuildContext,
    observation: 'observed',
  }));
  const capture = {
    schemaVersion: '1.0.0',
    kind: 'capture-bundle',
    source: { kind: source.kind, ref: sourceRef },
    sourceBuildContext,
    archiveContext,
    evidence: [...staticEvidence, ...verifiedObservations],
    provenance: [sourceRef],
    resources,
  };
  const result = validateContract('capture-ir', capture);
  if (!result.valid) fail('INVALID_CAPTURE', JSON.stringify(result.errors));
  return capture;
}
