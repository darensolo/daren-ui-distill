import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { generateSourceReplica } from '../generator.mjs';
import { createJobStore } from '../job-store.mjs';
import { auditAsset } from '../quality.mjs';
import { optimizeAsset, optimizeAssetWithJournal } from '../optimizer.mjs';
import { digestObject } from '../digest.mjs';

const fixtures = JSON.parse(await readFile(new URL('../../contracts/fixtures/valid.json', import.meta.url), 'utf8'));
const blueprint = structuredClone(fixtures.cases.find((entry) => entry.name === 'blueprint-generation-ready').value);
blueprint.digest = digestObject(blueprint);
const checksetDigest = 'e'.repeat(64);

function findingReport(bundle) {
  const report = auditAsset({ bundle, checksetDigest });
  report.findings.push({ id: 'F-1', severity: 'P1', status: 'open', subjectRef: structuredClone(report.subjectRef) });
  report.findings.push({ id: 'F-2', severity: 'P2', status: 'open', subjectRef: structuredClone(report.subjectRef) });
  report.qualityOutcome = 'blocked';
  return report;
}

const reaudit = (candidate) => auditAsset({ bundle: candidate, checksetDigest });

test('optimizer applies selected findings only and accepts only a passing re-audit', () => {
  const bundle = generateSourceReplica(blueprint);
  const report = findingReport(bundle);
  const result = optimizeAsset({ bundle, report, selectedFindingIds: ['F-1'], patches: [{ findingId: 'F-1', relativePath: 'styles.css', search: '#ffffff', replace: '#fefefe' }], consumedBudget: 0, reaudit });
  assert.equal(result.accepted, true);
  assert.equal(result.bundle.assetPackage.revision, 2);
  assert.equal(result.consumedBudget, 1);
  assert.equal(bundle.files.find((file) => file.relativePath === 'styles.css').content.includes('#ffffff'), true);
  assert.throws(() => optimizeAsset({ bundle, report, selectedFindingIds: ['F-1'], patches: [{ findingId: 'F-2', relativePath: 'styles.css', search: '#ffffff', replace: 'red' }], consumedBudget: 0, reaudit }), (error) => error.code === 'PATCH_OUT_OF_SCOPE');
});

test('optimizer enforces the persisted three-round ceiling and rejects regression', () => {
  const bundle = generateSourceReplica(blueprint);
  const report = findingReport(bundle);
  assert.throws(() => optimizeAsset({ bundle, report, selectedFindingIds: ['F-1'], patches: [], consumedBudget: 3, reaudit }), (error) => error.code === 'BUDGET_EXHAUSTED');
  const rejected = optimizeAsset({ bundle, report, selectedFindingIds: ['F-1'], patches: [{ findingId: 'F-1', relativePath: 'styles.css', search: '#ffffff', replace: '#000000' }], consumedBudget: 1, reaudit: (candidate) => {
    const result = auditAsset({ bundle: candidate, checksetDigest });
    result.findings.push({ id: 'regression', severity: 'P0', status: 'open', subjectRef: structuredClone(result.subjectRef) });
    result.qualityOutcome = 'blocked';
    return result;
  } });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.bundle.bundleDigest, bundle.bundleDigest);
});

test('optimizer rejects incomplete, stale, or scope-drifted C4 re-audits', () => {
  const bundle = generateSourceReplica(blueprint);
  const report = findingReport(bundle);
  const request = { bundle, report, selectedFindingIds: ['F-1'], patches: [], consumedBudget: 0 };
  assert.throws(() => optimizeAsset({ ...request, reaudit: () => ({ qualityOutcome: 'passed' }) }), (error) => error.code === 'INVALID_REAUDIT');
  assert.throws(() => optimizeAsset({ ...request, reaudit: (candidate) => ({ ...reaudit(candidate), checksetDigest: 'f'.repeat(64) }) }), (error) => ['REAUDIT_SCOPE_DRIFT', 'STALE_REAUDIT'].includes(error.code));
  assert.throws(() => optimizeAsset({ ...request, reaudit: (candidate) => ({ ...reaudit(candidate), subjectRef: report.subjectRef }) }), (error) => error.code === 'STALE_REAUDIT');
});

test('journaled optimizer persists rejected attempt budget before every repair', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-optimize-journal-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  const store = createJobStore(root);
  const bundle = generateSourceReplica(blueprint);
  const report = findingReport(bundle);
  await store.create('repair-job', { inputDigest: bundle.bundleDigest, budget: 3 });
  const rejectAudit = (candidate) => {
    const result = reaudit(candidate);
    result.findings.push({ id: 'regression', severity: 'P0', status: 'open', subjectRef: structuredClone(result.subjectRef) });
    result.qualityOutcome = 'blocked';
    return result;
  };
  for (let round = 1; round <= 3; round += 1) {
    const result = await optimizeAssetWithJournal({ store, jobId: 'repair-job', operationId: `repair-${round}`, bundle, report, selectedFindingIds: ['F-1'], patches: [], reaudit: rejectAudit });
    assert.equal(result.accepted, false);
  }
  const restarted = createJobStore(root);
  await assert.rejects(() => optimizeAssetWithJournal({ store: restarted, jobId: 'repair-job', operationId: 'repair-4', bundle, report, selectedFindingIds: ['F-1'], patches: [], reaudit: rejectAudit }), (error) => error.code === 'BUDGET_EXHAUSTED');
  assert.equal((await restarted.recover('repair-job')).consumedBudget, 3);
});
