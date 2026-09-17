import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseArgs, resolveActionPlan } from './args.mjs';
import { digestObject, publicationApprovalInputDigest, runBlueprintPipeline, sha256Bytes } from '../core/index.mjs';
import { buildCodexDistribution } from '../../plugins/codex/scripts/build.mjs';

function authorize(baseDir, payload) {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'authorize', '--base-dir', baseDir, '--json',
  ], { input: JSON.stringify({ confirmed: true, revision: 1, subjectRevision: 1, ...payload }), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).approval;
}

test('legacy replica depth resolves to explicit canonical stages', () => {
  const parsed = parseArgs(['run', '--source-version', '0.9.0', '--input-kind', 'blueprint', '--reproduction-depth', 'source+adapt', '--target-design-system', 'daren']);
  assert.deepEqual(resolveActionPlan(parsed).resolvedStages, ['replicate', 'adapt']);
  const sourceOnly = parseArgs(['run', '--source-version', '0.9.0', '--input-kind', 'source', '--reproduction-depth', 'source-only', '--target-design-system', 'none']);
  assert.deepEqual(resolveActionPlan(sourceOnly).resolvedStages, ['dissect', 'replicate']);
});

test('public core and CLI run materialize a validated Blueprint into an explicit output directory', async (t) => {
  assert.equal(typeof runBlueprintPipeline, 'function');
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-cli-run-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixtures = JSON.parse(await readFile(new URL('../contracts/fixtures/valid.json', import.meta.url), 'utf8'));
  const blueprint = structuredClone(fixtures.cases.find((entry) => entry.name === 'blueprint-generation-ready').value);
  blueprint.digest = digestObject(blueprint);
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'run', '--base-dir', root,
    '--input-kind', 'blueprint', '--reproduction-depth', 'source-only', '--target-design-system', 'none',
    '--out-dir', 'output', '--job-root', 'jobs', '--job-id', 'cli-run', '--json',
  ], { input: JSON.stringify(blueprint), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const runOutput = JSON.parse(result.stdout);
  assert.equal(runOutput.artifacts.source.materialization.status, 'succeeded');
  for (const file of ['index.html', 'styles.css', 'component.js', 'asset-package.json']) {
    assert.equal((await stat(path.join(root, 'output', file))).isFile(), true);
  }
  const audit = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'audit', '--base-dir', root, '--json',
  ], { input: JSON.stringify({ bundle: runOutput.artifacts.source.bundle, checksetDigest: 'e'.repeat(64) }), encoding: 'utf8' });
  assert.equal(audit.status, 0, audit.stderr);
  const report = JSON.parse(audit.stdout);
  assert.equal(report.qualityOutcome, 'passed');
  report.findings.push({ id: 'F-cli', severity: 'P1', status: 'open', subjectRef: structuredClone(report.subjectRef) });
  report.qualityOutcome = 'blocked';
  const optimize = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'optimize', '--base-dir', root,
    '--job-root', 'jobs', '--job-id', 'cli-run', '--operation-id', 'cli-repair-1', '--json',
  ], { input: JSON.stringify({ bundle: runOutput.artifacts.source.bundle, report, selectedFindingIds: ['F-cli'], patches: [] }), encoding: 'utf8' });
  assert.equal(optimize.status, 0, optimize.stderr);
  assert.equal(JSON.parse(optimize.stdout).accepted, true);
  const resume = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'resume', '--base-dir', root,
    '--job-root', 'jobs', '--job-id', 'cli-run', '--json',
  ], { input: JSON.stringify({ binding: runOutput.binding, input: blueprint }), encoding: 'utf8' });
  assert.equal(resume.status, 0, resume.stderr);
  assert.equal(JSON.parse(resume.stdout).chain.status, 'completed');

  const targetRef = { kind: 'design-token-set', id: 'daren-semantic', revision: 1, digest: 'c'.repeat(64), relativePath: 'daren-design/design-tokens/tokens/semantic.json' };
  const sourceAdapt = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'run', '--base-dir', root,
    '--input-kind', 'blueprint', '--reproduction-depth', 'source+adapt', '--target-design-system', 'daren', '--out-dir', 'source-adapt', '--json',
  ], { input: JSON.stringify({ blueprint, targetRef }), encoding: 'utf8' });
  assert.equal(sourceAdapt.status, 0, sourceAdapt.stderr);
  assert.equal((await stat(path.join(root, 'source-adapt/source-replica/asset-package.json'))).isFile(), true);
  assert.equal((await stat(path.join(root, 'source-adapt/adapted/adaptation-report.json'))).isFile(), true);
  const sourceAdaptOutput = JSON.parse(sourceAdapt.stdout);
  const adaptOnly = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'run', '--base-dir', root,
    '--input-kind', 'asset', '--stages', 'adapt', '--out-dir', 'adapt-only', '--json',
  ], { input: JSON.stringify({ bundle: sourceAdaptOutput.source.bundle, targetRef }), encoding: 'utf8' });
  assert.equal(adaptOnly.status, 0, adaptOnly.stderr);
  assert.equal((await stat(path.join(root, 'adapt-only/adaptation-report.json'))).isFile(), true);

  const deliverySlug = sourceAdaptOutput.adapted.bundle.assetPackage.assetId;
  const deliveryAssetId = `local/${deliverySlug}`;
  const publicationMetadata = { title: 'Codex Tool Call', description: 'Registered and published fixture.', category: 'Distilled', visibility: 'listed' };
  const registrationApproval = authorize(root, { id: 'library-write-approved', capability: 'library-write', targetRoot: `library/assets/${deliverySlug}`, subjectId: deliveryAssetId, inputDigest: sourceAdaptOutput.adapted.bundle.bundleDigest });
  const publicationApproval = authorize(root, { id: 'site-write-approved', capability: 'site-write', targetRoot: `site/publications/${deliverySlug}`, subjectId: deliveryAssetId, inputDigest: publicationApprovalInputDigest(sourceAdaptOutput.adapted.bundle.bundleDigest, publicationMetadata) });
  const registrationPayload = {
    bundle: sourceAdaptOutput.adapted.bundle,
    registrationApproval,
    publicationApproval,
    publication: publicationMetadata,
  };
  const combinedApprovalRejected = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'run', '--base-dir', root,
    '--input-kind', 'asset', '--stages', 'register,publish', '--out-dir', 'rejected', '--job-root', 'jobs', '--job-id', 'combined-approval-rejected',
    '--library-root', 'library', '--site-root', 'site', '--json',
  ], { input: JSON.stringify({ bundle: registrationPayload.bundle, approval: registrationApproval, publication: registrationPayload.publication }), encoding: 'utf8' });
  assert.equal(combinedApprovalRejected.status, 1);
  assert.equal(JSON.parse(combinedApprovalRejected.stderr).code, 'APPROVAL_REQUIRED');
  await assert.rejects(readFile(path.join(root, `library/assets/${deliverySlug}/registration.json`)), /ENOENT/);
  const registration = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'run', '--base-dir', root,
    '--input-kind', 'asset', '--stages', 'register,publish', '--out-dir', 'resumable', '--job-root', 'jobs', '--job-id', 'register-publish',
    '--library-root', 'library', '--site-root', 'site', '--json',
  ], { input: JSON.stringify(registrationPayload), encoding: 'utf8' });
  assert.equal(registration.status, 0, registration.stderr);
  const registrationOutput = JSON.parse(registration.stdout);
  assert.equal(registrationOutput.chain.status, 'completed');
  assert.deepEqual(registrationOutput.chain.stageRuns.map((stage) => stage.kind), ['register', 'publish']);
  assert.equal((await stat(path.join(root, `library/assets/${deliverySlug}/registration-receipt.json`))).isFile(), true);
  assert.equal((await stat(path.join(root, `site/publications/${deliverySlug}/publication-receipt.json`))).isFile(), true);
  const publishOnly = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'run', '--base-dir', root,
    '--input-kind', 'library-asset', '--stages', 'publish', '--out-dir', 'publish-only', '--job-root', 'jobs', '--job-id', 'publish-only',
    '--library-root', 'library', '--site-root', 'site', '--json',
  ], {
    input: JSON.stringify({
      registrationReceiptPath: `library/assets/${deliverySlug}/registration-receipt.json`,
      publicationApproval: registrationPayload.publicationApproval,
      publication: registrationPayload.publication,
    }),
    encoding: 'utf8',
  });
  assert.equal(publishOnly.status, 0, publishOnly.stderr);
  assert.equal(JSON.parse(publishOnly.stdout).chain.stageRuns[0].kind, 'publish');
  const resumedDelivery = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'resume', '--base-dir', root,
    '--job-root', 'jobs', '--job-id', 'register-publish', '--library-root', 'library', '--site-root', 'site', '--json',
  ], { input: JSON.stringify({ binding: registrationOutput.binding, input: registrationPayload }), encoding: 'utf8' });
  assert.equal(resumedDelivery.status, 0, resumedDelivery.stderr);
  assert.equal(JSON.parse(resumedDelivery.stdout).chain.status, 'completed');
  const distribution = path.join(root, 'distribution');
  await buildCodexDistribution(distribution);
  const launched = spawnSync(process.execPath, [
    path.join(distribution, 'bin/ui-distiller.mjs'), 'run', '--base-dir', root,
    '--input-kind', 'blueprint', '--reproduction-depth', 'source-only', '--target-design-system', 'none',
    '--out-dir', 'launcher-output', '--json',
  ], { input: JSON.stringify(blueprint), encoding: 'utf8' });
  assert.equal(launched.status, 0, launched.stderr);
  assert.equal((await stat(path.join(root, 'launcher-output', 'asset-package.json'))).isFile(), true);
});

test('conflicting or unsafe CLI arguments fail closed', () => {
  assert.throws(() => parseArgs(['dissect', '--shell', 'rm -rf']), (error) => error.code === 'UNKNOWN_ARGUMENT');
  assert.throws(
    () => resolveActionPlan(parseArgs(['run', '--input-kind', 'source', '--reproduction-depth', 'source-only', '--target-design-system', 'daren'])),
    (error) => error.code === 'ACTION_CONFLICT',
  );
  assert.throws(
    () => resolveActionPlan(parseArgs(['run', '--stages', 'replica,replicate', '--source-version', '0.9.0', '--input-kind', 'blueprint'])),
    (error) => error.code === 'DUPLICATE_STAGE',
  );
});

test('CLI executes authorized source capture through dissect into source-only and source+adapt', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-cli-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'source-input'));
  const bytes = Buffer.from('{"role":"button"}');
  await writeFile(path.join(root, 'source-input/component.json'), bytes);
  const fixtures = JSON.parse(await readFile(new URL('../contracts/fixtures/valid.json', import.meta.url), 'utf8'));
  const blueprint = fixtures.cases.find((entry) => entry.name === 'blueprint-generation-ready').value;
  const evidenceRef = { kind: 'evidence', id: 'resource-1', revision: 1, digest: sha256Bytes(bytes), relativePath: 'source-input/component.json' };
  const proposal = {
    granularity: blueprint.granularity,
    nodes: blueprint.nodes.map((entry) => ({ ...entry, evidenceRefs: [evidenceRef] })),
    layout: blueprint.layout.map((entry) => ({ ...entry, evidenceRefs: [evidenceRef] })),
    styles: blueprint.styles.map((entry) => ({ ...entry, evidenceRefs: [evidenceRef] })),
    resources: [], props: blueprint.props,
    states: blueprint.states.map((entry) => ({ id: entry.id, evidenceRefs: [evidenceRef] })),
    events: blueprint.events.map((entry) => ({ ...entry, evidenceRefs: [evidenceRef] })),
    recipe: blueprint.recipe, checkBaseline: evidenceRef,
    requiredStates: blueprint.states.map((entry) => entry.id), requiredEvents: blueprint.events.map((entry) => entry.id),
  };
  const targetRef = { kind: 'design-token-set', id: 'daren-semantic', revision: 1, digest: 'c'.repeat(64), relativePath: 'daren-design/design-tokens/tokens/semantic.json' };
  const payload = { source: { kind: 'evidence-bundle', id: 'source-fixture', relativePath: 'source-input' }, selectors: ['component.json'], proposal, blueprintId: 'source-control', rights: 'allowed', targetRef };
  let captured;
  for (const [depth, outDir] of [['source-only', 'source-only'], ['source+adapt', 'source-adapt']]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./main.mjs', import.meta.url)), 'run', '--base-dir', root, '--read-root', 'source-input', '--input-kind', 'source', '--reproduction-depth', depth, '--target-design-system', depth === 'source-only' ? 'none' : 'daren', '--out-dir', outDir, '--json'], { input: JSON.stringify(payload), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    if (depth === 'source-only') captured = JSON.parse(result.stdout).capture;
  }
  assert.equal((await stat(path.join(root, 'source-only/asset-package.json'))).isFile(), true);
  assert.equal((await stat(path.join(root, 'source-adapt/source-replica/asset-package.json'))).isFile(), true);
  assert.equal((await stat(path.join(root, 'source-adapt/adapted/adaptation-report.json'))).isFile(), true);
  const captureRun = spawnSync(process.execPath, [fileURLToPath(new URL('./main.mjs', import.meta.url)), 'run', '--base-dir', root, '--input-kind', 'capture', '--reproduction-depth', 'source-only', '--target-design-system', 'none', '--out-dir', 'capture-only', '--json'], { input: JSON.stringify({ bundle: captured, proposal, blueprintId: 'capture-control', rights: 'allowed' }), encoding: 'utf8' });
  assert.equal(captureRun.status, 0, captureRun.stderr);
  assert.equal((await stat(path.join(root, 'capture-only/asset-package.json'))).isFile(), true);
});

test('thin CLI check prints machine-readable capability facts', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./main.mjs', import.meta.url)), 'check', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.toolId, 'ui-distiller');
  assert.equal(output.security.executeSourceScripts, false);
  assert.equal(output.security.liveWebPageScripts, 'isolated-ephemeral-browser-only');
  assert.equal(output.supportedSources['web-url'].status, 'supported');
});

test('capture payload cannot replace CLI base directory or read-root authority', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-cli-boundary-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'allowed'));
  await writeFile(path.join(root, 'allowed', 'safe.txt'), 'safe');
  const missingWebOutput = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)), 'capture', '--base-dir', root, '--json',
  ], { input: JSON.stringify({ source: { kind: 'web-url', url: 'https://example.com/' } }), encoding: 'utf8' });
  assert.equal(missingWebOutput.status, 1);
  assert.equal(JSON.parse(missingWebOutput.stderr).code, 'MISSING_OUT_DIR');
  const payload = {
    baseDir: '/',
    scope: { readRoots: ['private'] },
    source: { kind: 'evidence-bundle', relativePath: 'allowed' },
    selectors: ['safe.txt'],
  };
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)),
    'capture', '--base-dir', root, '--read-root', 'allowed', '--json',
  ], { input: JSON.stringify(payload), encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).code, 'PAYLOAD_AUTHORITY_CONFLICT');

  const authorized = spawnSync(process.execPath, [
    fileURLToPath(new URL('./main.mjs', import.meta.url)),
    'capture', '--base-dir', root, '--read-root', 'allowed', '--json',
  ], {
    input: JSON.stringify({ source: payload.source, selectors: payload.selectors }),
    encoding: 'utf8',
  });
  assert.equal(authorized.status, 0, authorized.stderr);
  assert.equal(JSON.parse(authorized.stdout).resources[0].relativePath, 'allowed/safe.txt');
});
