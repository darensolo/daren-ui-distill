import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { captureSource } from '../capture.mjs';
import { compileCapture } from '../compiler.mjs';
import { digestObject, sha256Bytes } from '../digest.mjs';

test('capture reads only selected authorized files and compilation is deterministic', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-capture-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'inputs', 'source'), { recursive: true });
  await writeFile(path.join(root, 'inputs', 'source', 'component.json'), '{"role":"button"}');
  await writeFile(path.join(root, 'inputs', 'source', 'instructions.js'), 'throw new Error("must not execute")');

  const capture = await captureSource({
    baseDir: root,
    scope: { readRoots: ['inputs/source'] },
    source: { kind: 'evidence-bundle', relativePath: 'inputs/source' },
    selectors: ['component.json'],
  });
  assert.equal(capture.evidence.length, 1);
  assert.equal(capture.evidence[0].kind, 'static');
  assert.equal(capture.evidence[0].observation, 'observed');
  assert.equal(capture.evidence[0].ref.relativePath, 'inputs/source/component.json');

  const proposal = {
    nodeRefs: [capture.evidence[0].ref],
    states: [{ id: 'default', evidenceRefs: [capture.evidence[0].ref] }],
    events: [{ id: 'activate', trigger: 'click', evidenceRefs: [capture.evidence[0].ref], observation: 'observed' }],
  };
  const first = compileCapture(capture, proposal);
  const second = compileCapture(capture, proposal);
  assert.deepEqual(first, second);
  assert.equal(first.events[0].observation, 'inferred');
  assert.equal(digestObject(first), digestObject(second));

  const screenshotCapture = structuredClone(capture);
  screenshotCapture.evidence[0].kind = 'screenshot';
  assert.equal(compileCapture(screenshotCapture, proposal).events[0].observation, 'inferred');
});

test('capture imports source observations only after scoped byte digest verification', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-observation-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'inputs', 'source'), { recursive: true });
  await writeFile(path.join(root, 'inputs', 'source', 'component.json'), '{}');
  const request = {
    baseDir: root, scope: { readRoots: ['inputs/source'] },
    source: { kind: 'evidence-bundle', relativePath: 'inputs/source' }, selectors: ['component.json'],
  };
  const preliminary = await captureSource(request);
  const evidenceBytes = Buffer.from(JSON.stringify({ schemaVersion: '1.0.0', subject: 'source', kind: 'interaction', eventId: 'observed-activate', observation: 'observed', sourceDigest: preliminary.source.ref.digest, buildRef: null }));
  await writeFile(path.join(root, 'inputs', 'source', 'interaction.json'), evidenceBytes);
  const observation = {
    id: 'observed-activate', subject: 'source', kind: 'interaction', observation: 'observed',
    sourceBuildContext: preliminary.sourceBuildContext,
    ref: { kind: 'evidence', id: 'activate', revision: 1, digest: sha256Bytes(evidenceBytes), relativePath: 'inputs/source/interaction.json' },
  };
  const captured = await captureSource({ ...request, observations: [observation] });
  assert.equal(captured.evidence.at(-1).observation, 'observed');
  await assert.rejects(() => captureSource({ ...request, observations: [{ ...observation, ref: { ...observation.ref, digest: 'f'.repeat(64) } }] }), (error) => error.code === 'EVIDENCE_DIGEST_MISMATCH');
  const forged = Buffer.from(JSON.stringify({ schemaVersion: '1.0.0', subject: 'source', kind: 'interaction', eventId: 'observed-activate', observation: 'observed', sourceDigest: 'f'.repeat(64), buildRef: null }));
  await writeFile(path.join(root, 'inputs', 'source', 'interaction.json'), forged);
  await assert.rejects(() => captureSource({ ...request, observations: [{ ...observation, ref: { ...observation.ref, digest: sha256Bytes(forged) } }] }), (error) => error.code === 'INVALID_OBSERVATION_ENVELOPE');
});
