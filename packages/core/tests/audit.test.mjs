import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { generateSourceReplica } from '../generator.mjs';
import { auditAsset, isReportFresh, verifyAuditEvidence } from '../quality.mjs';
import { digestObject, sha256Bytes } from '../digest.mjs';

const fixtures = JSON.parse(await readFile(new URL('../../contracts/fixtures/valid.json', import.meta.url), 'utf8'));
const blueprint = structuredClone(fixtures.cases.find((entry) => entry.name === 'blueprint-generation-ready').value);
blueprint.digest = digestObject(blueprint);
const available = (id, content = `context:${id}`) => ({ status: 'available', ref: { kind: 'baseline', id, revision: 1, digest: sha256Bytes(Buffer.from(content)), relativePath: `baselines/${id}.json` } });
const na = (reason) => ({ status: 'not-applicable', reason });
const baselineFor = (bundle) => JSON.stringify({ schemaVersion: '1.0.0', kind: 'ui-baseline', assertions: {
  nodes: bundle.blueprint.nodes.map((node) => ({ id: node.id, parentId: node.parentId, kind: node.kind, children: node.children })),
  states: bundle.blueprint.states.map((state) => state.id),
  events: bundle.blueprint.events.map((event) => ({ id: event.id, targetNodeId: event.targetNodeId, fromState: event.fromState, toState: event.toState, intent: event.intent })),
  visual: {
    nodeBindings: bundle.blueprint.nodes.map((node) => ({ id: node.id, layoutRef: node.layoutRef, styleRef: node.styleRef })),
    layout: bundle.blueprint.layout.map(({ id, display, values }) => ({ id, display, values })),
    styles: bundle.blueprint.styles.map(({ id, properties }) => ({ id, properties })),
    resources: bundle.blueprint.resources,
  },
} });

test('audit is read-only, profile-aware, evidence-backed, and freshness-bound', () => {
  const bundle = generateSourceReplica(blueprint);
  const baselineContent = baselineFor(bundle);
  const before = structuredClone(bundle);
  const report = auditAsset({
    bundle,
    profile: 'source-fidelity',
    baselineContext: available('source', baselineContent),
    targetContext: na('source profile'),
    allowedDeltaContext: na('source profile'),
    contextArtifacts: { baseline: { content: baselineContent } },
    checksetDigest: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  });
  assert.deepEqual(bundle, before);
  assert.equal(report.runtimeVerification, 'unverified');
  assert.notEqual(report.qualityOutcome, 'passed');
  assert.equal(isReportFresh(report, { bundle, checksetDigest: report.checksetDigest, baselineContext: report.baselineContext, targetContext: report.targetContext, allowedDeltaContext: report.allowedDeltaContext }), true);
  assert.equal(isReportFresh(report, { bundle, checksetDigest: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', baselineContext: report.baselineContext, targetContext: report.targetContext, allowedDeltaContext: report.allowedDeltaContext }), false);
  for (const check of report.checks.filter((entry) => entry.evidenceRefs.length)) {
    assert.equal(verifyAuditEvidence(bundle, check, check.evidenceRefs[0]), true);
  }
});

test('audit rejects extra, missing, and duplicate paths in either file collection', () => {
  const base = generateSourceReplica(blueprint);
  const variants = [];
  const extraManifest = structuredClone(base);
  extraManifest.assetPackage.files.push({ relativePath: 'extra.txt', digest: 'a'.repeat(64) });
  variants.push(extraManifest);
  const duplicateBundle = structuredClone(base);
  duplicateBundle.files.push(structuredClone(duplicateBundle.files[0]));
  variants.push(duplicateBundle);
  const duplicateManifest = structuredClone(base);
  duplicateManifest.assetPackage.files.push(structuredClone(duplicateManifest.assetPackage.files[0]));
  variants.push(duplicateManifest);
  for (const bundle of variants) {
    const report = auditAsset({ bundle, checksetDigest: 'e'.repeat(64) });
    assert.equal(report.qualityOutcome, 'blocked');
    assert.equal(report.checks.find((check) => check.id === 'file-set').status, 'failed');
  }
});

test('source fidelity without source baseline fails closed', () => {
  assert.throws(() => auditAsset({ bundle: generateSourceReplica(blueprint), profile: 'source-fidelity', baselineContext: { status: 'missing', reason: 'not observed' }, targetContext: na('source profile'), allowedDeltaContext: na('source profile'), checksetDigest: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }), (error) => error.code === 'MISSING_BASELINE');
});

test('source fidelity blocks layout, style, and icon-resource drift that preserves structure and events', () => {
  const sourceBundle = generateSourceReplica(blueprint);
  const baselineContent = baselineFor(sourceBundle);
  const baselineContext = available('source', baselineContent);
  const request = { profile: 'source-fidelity', baselineContext, targetContext: na('source profile'), allowedDeltaContext: na('source profile'), contextArtifacts: { baseline: { content: baselineContent } }, checksetDigest: 'e'.repeat(64) };

  const mutations = [
    (candidate) => { candidate.layout[0].values.justifyContent = 'center'; },
    (candidate) => { candidate.styles[0].properties.padding = '0 12px'; },
    (candidate) => { candidate.resources.push({ kind: 'icon', id: 'brain-from-another-library', revision: 1, digest: 'b'.repeat(64), relativePath: 'icons/brain.svg' }); },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(blueprint);
    mutate(candidate);
    candidate.digest = digestObject(candidate);
    const report = auditAsset({ ...request, bundle: generateSourceReplica(candidate) });
    assert.equal(report.qualityOutcome, 'blocked');
    assert.equal(report.checks.find((check) => check.id === 'baseline-visual-contract').status, 'failed');
  }
});

test('profile context artifacts require real matching bytes and fail after tampering', () => {
  const bundle = generateSourceReplica(blueprint);
  const baselineContent = baselineFor(bundle);
  const baselineContext = available('source', baselineContent);
  const targetContext = available('target');
  const allowedDeltaContext = available('allowed');
  const request = { bundle, profile: 'design-adaptation', baselineContext, targetContext, allowedDeltaContext, checksetDigest: 'e'.repeat(64) };
  const contexts = { baseline: { content: baselineContent }, target: { content: 'context:target' }, allowedDelta: { content: 'context:allowed' } };
  const report = auditAsset({ ...request, contextArtifacts: contexts });
  assert.equal(report.qualityOutcome, 'passed');
  assert.throws(() => auditAsset({ ...request, contextArtifacts: { baseline: { content: 'tampered UI' }, target: { content: 'context:target' }, allowedDelta: { content: 'context:allowed' } } }), (error) => error.code === 'CONTEXT_DIGEST_MISMATCH');
  assert.throws(() => auditAsset(request), (error) => error.code === 'MISSING_CONTEXT_ARTIFACT');
  const tampered = structuredClone(bundle);
  const component = tampered.files.find((file) => file.relativePath === 'component.js');
  component.content = component.content.replace('toggle details', 'destroy data');
  tampered.assetPackage.files.find((file) => file.relativePath === 'component.js').digest = sha256Bytes(Buffer.from(component.content));
  tampered.bundleDigest = digestObject({ ...tampered, bundleDigest: undefined });
  const blocked = auditAsset({ ...request, bundle: tampered, contextArtifacts: contexts });
  assert.equal(blocked.qualityOutcome, 'blocked');
  assert.equal(blocked.checks.find((check) => check.id === 'baseline-assertions').status, 'failed');
  const noOp = structuredClone(bundle);
  const noOpComponent = noOp.files.find((file) => file.relativePath === 'component.js');
  noOpComponent.content = noOpComponent.content.replace('root.replaceChildren(element);return element;', 'return element;');
  assert.notEqual(noOpComponent.content, bundle.files.find((file) => file.relativePath === 'component.js').content);
  noOp.assetPackage.files.find((file) => file.relativePath === 'component.js').digest = sha256Bytes(Buffer.from(noOpComponent.content));
  noOp.bundleDigest = digestObject({ ...noOp, bundleDigest: undefined });
  const noOpReport = auditAsset({ ...request, bundle: noOp, contextArtifacts: contexts });
  assert.equal(noOpReport.qualityOutcome, 'blocked');
  assert.equal(noOpReport.checks.find((check) => check.id === 'baseline-assertions').status, 'failed');
  const hidden = structuredClone(bundle);
  const styles = hidden.files.find((file) => file.relativePath === 'styles.css');
  styles.content = 'body{display:none}';
  hidden.assetPackage.files.find((file) => file.relativePath === 'styles.css').digest = sha256Bytes(Buffer.from(styles.content));
  hidden.bundleDigest = digestObject({ ...hidden, bundleDigest: undefined });
  const hiddenReport = auditAsset({ ...request, bundle: hidden, contextArtifacts: contexts });
  assert.equal(hiddenReport.qualityOutcome, 'blocked');
  assert.equal(hiddenReport.checks.find((check) => check.id === 'baseline-visual-contract').status, 'failed');
});

test('profile context paths are scoped and their on-disk bytes are verified', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-audit-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'baselines'));
  const bundle = generateSourceReplica(blueprint);
  const baselineContent = baselineFor(bundle);
  await writeFile(path.join(root, 'baselines/source.json'), baselineContent);
  const baselineContext = available('source', baselineContent);
  const artifact = { baseDir: root, readRoots: ['baselines'], relativePath: 'baselines/source.json' };
  const request = { bundle, profile: 'source-fidelity', baselineContext, targetContext: na('source profile'), allowedDeltaContext: na('source profile'), checksetDigest: 'e'.repeat(64), contextArtifacts: { baseline: artifact } };
  assert.notEqual(auditAsset(request).qualityOutcome, 'passed');
  await writeFile(path.join(root, 'baselines/source.json'), 'tampered UI');
  assert.throws(() => auditAsset(request), (error) => error.code === 'CONTEXT_DIGEST_MISMATCH');
  await rm(path.join(root, 'baselines/source.json'));
  assert.throws(() => auditAsset(request), (error) => error.code === 'CONTEXT_ARTIFACT_UNAVAILABLE');
});
