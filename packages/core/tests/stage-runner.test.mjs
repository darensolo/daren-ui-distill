import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createJobStore } from '../job-store.mjs';
import { createPorts } from '../ports.mjs';
import { executeStages } from '../stage-runner.mjs';

const inputRef = { kind: 'blueprint', id: 'fixture', revision: 1, digest: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', relativePath: 'blueprints/fixture.json' };
const stageBinding = (resolvedStages) => ({ request: { action: 'run', requestedActions: resolvedStages }, inputDigest: 'a'.repeat(64), resolvedStages, scope: { readRoots: [], writeRoots: [] }, checksetDigest: null });

test('stage runner preserves upstream output, reports partial, and resumes without replay', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-stage-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  const store = createJobStore(root);
  const binding = stageBinding(['replicate', 'adapt']);
  await store.create('job-stage', { inputDigest: binding.inputDigest, budget: 3, binding });
  const calls = { replicate: 0, adapt: 0 };
  const handlers = {
    replicate: async () => { calls.replicate += 1; return { status: 'succeeded', inputRefs: [], outputRefs: [], reportRefs: [], effectReceipts: [] }; },
    adapt: async () => { calls.adapt += 1; return { status: 'blocked', inputRefs: [], outputRefs: [], reportRefs: [], effectReceipts: [] }; },
  };
  const first = await executeStages({ jobId: 'job-stage', requestedActions: ['replicate', 'adapt'], resolvedStages: ['replicate', 'adapt'], handlers, store, binding });
  assert.equal(first.status, 'partial');
  assert.deepEqual(calls, { replicate: 1, adapt: 1 });
  handlers.adapt = async () => { calls.adapt += 1; return { status: 'succeeded', inputRefs: [], outputRefs: [], reportRefs: [], effectReceipts: [] }; };
  const resumed = await executeStages({ jobId: 'job-stage', requestedActions: ['replicate', 'adapt'], resolvedStages: ['replicate', 'adapt'], handlers, store, binding });
  assert.equal(resumed.status, 'completed');
  assert.deepEqual(calls, { replicate: 1, adapt: 2 });
  const recovered = await store.recover('job-stage');
  const prepared = recovered.events.find((event) => event.type === 'stage-prepared');
  const succeeded = recovered.events.find((event) => event.type === 'stage-succeeded');
  assert.ok(prepared.sequence < succeeded.sequence);
  assert.equal(succeeded.payload.checkpoint.inputDigest, prepared.payload.inputDigest);
  assert.match(succeeded.payload.checkpoint.outputDigest, /^[a-f0-9]{64}$/);
});

test('stage runner rejects a plan that differs from the bound job', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-stage-drift-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  const binding = stageBinding(['replicate']);
  const store = createJobStore(root);
  await store.create('job-drift', { inputDigest: binding.inputDigest, binding });
  await assert.rejects(() => executeStages({ jobId: 'job-drift', requestedActions: ['publish'], resolvedStages: ['publish'], handlers: {}, store, binding }), (error) => error.code === 'RESUME_DRIFT');
});

test('prepared stage without terminal checkpoint is never silently replayed', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-stage-uncertain-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  const store = createJobStore(root);
  const binding = stageBinding(['replicate']);
  await store.create('job-uncertain', { inputDigest: binding.inputDigest, binding });
  const recovered = await store.recover('job-uncertain', { binding });
  const preparedInputDigest = (await import('../digest.mjs')).digestObject({ bindingDigest: recovered.bindingDigest, stage: 'replicate', attempt: 1 });
  await store.append('job-uncertain', { type: 'stage-prepared', operationId: 'job-uncertain:replicate:1:prepared', payload: { stage: 'replicate', attempt: 1, inputDigest: preparedInputDigest } });
  let calls = 0;
  await assert.rejects(() => executeStages({ jobId: 'job-uncertain', requestedActions: ['replicate'], resolvedStages: ['replicate'], handlers: { replicate: async () => { calls += 1; } }, store, binding }), (error) => error.code === 'UNCERTAIN_STAGE_EFFECT');
  assert.equal(calls, 0);
});

test('unsupported Library and Site ports report zero effects', async () => {
  const ports = createPorts();
  for (const kind of ['library', 'site']) {
    assert.equal(ports[kind].check().status, 'unsupported');
    const response = await ports[kind].execute({ inputRef, operationId: `${kind}-fixture` });
    assert.equal(response.result.status, 'unsupported');
    assert.deepEqual(response.result.effectReceipts, []);
  }
});
