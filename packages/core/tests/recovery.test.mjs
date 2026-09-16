import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { materializeAsset, reconcileMaterialization } from '../artifact.mjs';
import { digestObject, sha256Bytes } from '../digest.mjs';
import { createJobStore } from '../job-store.mjs';
import { executeStages } from '../stage-runner.mjs';

const digest = (value) => sha256Bytes(Buffer.from(value));

test('append-only job journal recovers budget, cancellation, and idempotent effects', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-jobs-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  const store = createJobStore(root);
  await store.create('job-01', { inputDigest: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', budget: 3 });
  await store.beginOptimizeAttempt('job-01', 'op-1', { revision: 2 });
  await store.append('job-01', { type: 'effect-committed', operationId: 'write-1', payload: { resultDigest: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } });
  const duplicate = await store.append('job-01', { type: 'effect-committed', operationId: 'write-1', payload: { resultDigest: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } });
  assert.equal(duplicate.idempotent, true);
  await assert.rejects(() => store.append('job-01', { type: 'effect-committed', operationId: 'write-1', payload: { resultDigest: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' } }), (error) => error.code === 'OPERATION_CONFLICT');
  await store.cancel('job-01', 'user-request');
  const recovered = await store.recover('job-01');
  assert.equal(recovered.consumedBudget, 1);
  assert.equal(recovered.cancelled, true);
  assert.equal(recovered.effects.get('write-1').resultDigest.startsWith('b'), true);
});

test('job binding detects resume drift and rejected attempts exhaust across restart', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-job-binding-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  const binding = { request: { action: 'optimize' }, inputDigest: 'a'.repeat(64), resolvedStages: ['optimize'], scope: { writeRoots: ['out'] }, checksetDigest: 'b'.repeat(64) };
  const store = createJobStore(root);
  await store.create('bound-job', { inputDigest: binding.inputDigest, binding, budget: 3 });
  for (let round = 1; round <= 3; round += 1) await store.beginOptimizeAttempt('bound-job', `reject-${round}`, { status: 'rejected' });
  const restarted = createJobStore(root);
  const bound = await restarted.recover('bound-job', { binding });
  assert.equal(bound.consumedBudget, 3);
  assert.match(bound.bindingDigests.requestDigest, /^[a-f0-9]{64}$/);
  assert.match(bound.bindingDigests.stagesDigest, /^[a-f0-9]{64}$/);
  assert.match(bound.bindingDigests.scopeDigest, /^[a-f0-9]{64}$/);
  await assert.rejects(() => restarted.beginOptimizeAttempt('bound-job', 'reject-4'), (error) => error.code === 'BUDGET_EXHAUSTED');
  await assert.rejects(() => restarted.recover('bound-job', { binding: { ...binding, checksetDigest: 'c'.repeat(64) } }), (error) => error.code === 'RESUME_DRIFT');
});

test('artifact transaction preserves a concurrent file creation and removes staging', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-artifact-conflict-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'output');
  await mkdir(target);
  await writeFile(path.join(target, 'stable.txt'), 'stable');
  await assert.rejects(() => materializeAsset({ files: [
    { relativePath: 'new.txt', content: 'generated' },
  ] }, {
    baseDir: root,
    writeRoots: ['output'],
    targetRoot: 'output',
    testHooks: { beforeCommit: () => writeFile(path.join(target, 'new.txt'), 'external') },
  }), (error) => error.code === 'WRITE_CONFLICT');
  assert.equal(await readFile(path.join(target, 'stable.txt'), 'utf8'), 'stable');
  assert.equal(await readFile(path.join(target, 'new.txt'), 'utf8'), 'external');
  assert.deepEqual((await readdir(root)).filter((entry) => entry.includes('.dh05-')), []);
});

test('artifact transaction rolls every file back after a mid-commit fault', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-artifact-rollback-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'output');
  await mkdir(target);
  await writeFile(path.join(target, 'a.txt'), 'old-a');
  await writeFile(path.join(target, 'b.txt'), 'old-b');
  await assert.rejects(() => materializeAsset({ files: [
    { relativePath: 'a.txt', content: 'new-a' },
    { relativePath: 'b.txt', content: 'new-b' },
  ] }, {
    baseDir: root,
    writeRoots: ['output'],
    targetRoot: 'output',
    expectedFiles: { 'a.txt': digest('old-a'), 'b.txt': digest('old-b') },
    testHooks: { afterBackup: () => { throw new Error('injected mid-commit failure'); } },
  }), /injected mid-commit failure/);
  assert.equal(await readFile(path.join(target, 'a.txt'), 'utf8'), 'old-a');
  assert.equal(await readFile(path.join(target, 'b.txt'), 'utf8'), 'old-b');
  assert.deepEqual((await readdir(root)).filter((entry) => entry.includes('.dh05-')), []);
});

test('next materialization recovers a hard-exit orphan backup and clears staging', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-artifact-hard-exit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'output'));
  await writeFile(path.join(root, 'output', 'asset.txt'), 'old');
  const moduleUrl = new URL('../artifact.mjs', import.meta.url).href;
  const script = `import { materializeAsset } from ${JSON.stringify(moduleUrl)}; await materializeAsset({files:[{relativePath:'asset.txt',content:'new'}]},{baseDir:process.env.DH05_ROOT,writeRoots:['output'],targetRoot:'output',expectedFiles:{'asset.txt':process.env.DH05_OLD},testHooks:{afterBackup:()=>process.exit(86)}});`;
  const crashed = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, DH05_ROOT: root, DH05_OLD: digest('old') }, encoding: 'utf8',
  });
  assert.equal(crashed.status, 86, crashed.stderr);
  assert.equal((await readdir(root)).some((entry) => entry.includes('.dh05-backup-')), true);
  await materializeAsset({ files: [{ relativePath: 'asset.txt', content: 'new' }] }, {
    baseDir: root, writeRoots: ['output'], targetRoot: 'output', expectedFiles: { 'asset.txt': digest('old') },
  });
  assert.equal(await readFile(path.join(root, 'output', 'asset.txt'), 'utf8'), 'new');
  assert.deepEqual((await readdir(root)).filter((entry) => entry.includes('.dh05-')), []);
});

test('stage reconciliation restores an afterBackup hard exit and retries the same operation once', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-stage-artifact-reconcile-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'output'));
  await writeFile(path.join(root, 'output', 'asset.txt'), 'old');
  const binding = { request: { action: 'run', requestedActions: ['replicate'] }, inputDigest: 'a'.repeat(64), resolvedStages: ['replicate'], scope: { baseDir: root, outDir: 'output' }, checksetDigest: null };
  const store = createJobStore(path.join(root, 'jobs'));
  await store.create('reconcile-job', { inputDigest: binding.inputDigest, binding });
  const recovered = await store.recover('reconcile-job', { binding });
  const preparedInputDigest = digestObject({ bindingDigest: recovered.bindingDigest, stage: 'replicate', attempt: 1 });
  await store.append('reconcile-job', { type: 'stage-prepared', operationId: 'reconcile-job:replicate:1:prepared', payload: { stage: 'replicate', attempt: 1, inputDigest: preparedInputDigest } });
  const moduleUrl = new URL('../artifact.mjs', import.meta.url).href;
  const script = `import { materializeAsset } from ${JSON.stringify(moduleUrl)}; await materializeAsset({files:[{relativePath:'asset.txt',content:'new'}]},{baseDir:process.env.DH05_ROOT,writeRoots:['output'],targetRoot:'output',expectedFiles:{'asset.txt':process.env.DH05_OLD},testHooks:{afterBackup:()=>process.exit(86)}});`;
  assert.equal(spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, DH05_ROOT: root, DH05_OLD: digest('old') } }).status, 86);
  let effects = 0;
  const replicate = async () => {
    effects += 1;
    await materializeAsset({ files: [{ relativePath: 'asset.txt', content: 'new' }] }, { baseDir: root, writeRoots: ['output'], targetRoot: 'output', expectedFiles: { 'asset.txt': digest('old') } });
    return { status: 'succeeded', inputRefs: [], outputRefs: [], reportRefs: [], effectReceipts: [] };
  };
  replicate.reconcile = async () => ({ status: (await reconcileMaterialization({ baseDir: root, writeRoots: ['output'], targetRoot: 'output' })).classification });
  const chain = await executeStages({ jobId: 'reconcile-job', requestedActions: ['replicate'], resolvedStages: ['replicate'], handlers: { replicate }, store, binding });
  assert.equal(chain.status, 'completed');
  assert.equal(chain.stageRuns[0].id, 'replicate-1');
  assert.equal(effects, 1);
  assert.equal(await readFile(path.join(root, 'output', 'asset.txt'), 'utf8'), 'new');
  assert.equal((await store.recover('reconcile-job')).events.filter((event) => event.type === 'stage-prepared').length, 1);
});

test('afterPromote reconciliation verifies expected output and commits terminal without replay', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-stage-promoted-reconcile-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'output'));
  await writeFile(path.join(root, 'output', 'asset.txt'), 'old');
  const binding = { request: { action: 'run', requestedActions: ['replicate'] }, inputDigest: 'a'.repeat(64), resolvedStages: ['replicate'], scope: { baseDir: root, outDir: 'output' }, checksetDigest: null };
  const store = createJobStore(path.join(root, 'jobs'));
  await store.create('promoted-job', { inputDigest: binding.inputDigest, binding });
  const recovered = await store.recover('promoted-job', { binding });
  const preparedInputDigest = digestObject({ bindingDigest: recovered.bindingDigest, stage: 'replicate', attempt: 1 });
  await store.append('promoted-job', { type: 'stage-prepared', operationId: 'promoted-job:replicate:1:prepared', payload: { stage: 'replicate', attempt: 1, inputDigest: preparedInputDigest } });
  const moduleUrl = new URL('../artifact.mjs', import.meta.url).href;
  const script = `import { materializeAsset } from ${JSON.stringify(moduleUrl)}; await materializeAsset({files:[{relativePath:'asset.txt',content:'new'}]},{baseDir:process.env.DH05_ROOT,writeRoots:['output'],targetRoot:'output',expectedFiles:{'asset.txt':process.env.DH05_OLD},testHooks:{afterPromote:()=>process.exit(87)}});`;
  assert.equal(spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, DH05_ROOT: root, DH05_OLD: digest('old') } }).status, 87);
  let effects = 0;
  const receipt = { kind: 'materialization-receipt', id: 'promoted-job-replicate', revision: 1, digest: digest('new'), relativePath: 'output/asset.txt' };
  const committedResult = { status: 'succeeded', inputRefs: [], outputRefs: [], reportRefs: [], effectReceipts: [receipt] };
  const replicate = async () => { effects += 1; return committedResult; };
  replicate.reconcile = async () => {
    const outcome = await reconcileMaterialization({ baseDir: root, writeRoots: ['output'], targetRoot: 'output', expectedFiles: { 'asset.txt': digest('new') } });
    return outcome.classification === 'committed' ? { status: 'committed', result: committedResult } : { status: outcome.classification };
  };
  const chain = await executeStages({ jobId: 'promoted-job', requestedActions: ['replicate'], resolvedStages: ['replicate'], handlers: { replicate }, store, binding });
  assert.equal(chain.status, 'completed');
  assert.equal(chain.stageRuns[0].id, 'replicate-1');
  assert.deepEqual(chain.stageRuns[0].effectReceipts, [receipt]);
  assert.equal(effects, 0);
  assert.equal(await readFile(path.join(root, 'output', 'asset.txt'), 'utf8'), 'new');
  const terminal = (await store.recover('promoted-job')).events.find((event) => event.type === 'stage-succeeded');
  assert.equal(terminal.payload.attempt, 1);
  assert.deepEqual(terminal.payload.result.effectReceipts, [receipt]);
});
