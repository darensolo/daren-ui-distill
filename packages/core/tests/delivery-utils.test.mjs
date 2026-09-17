import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { requireApproval } from '../delivery-utils.mjs';
import { sha256Bytes } from '../digest.mjs';

const scope = {
  capability: 'library-write',
  targetRoot: '.ui-distiller/library/assets/fixture',
  subjectId: 'local/fixture',
  subjectRevision: 1,
  inputDigest: 'a'.repeat(64),
};

async function approvalAt(baseDir, id, expiresAt) {
  const authorization = {
    schemaVersion: '1.0.0', kind: 'authorization', id, revision: 1, approved: true,
    ...scope,
    ...(expiresAt ? { expiresAt } : {}),
  };
  const content = `${JSON.stringify(authorization, null, 2)}\n`;
  const relativePath = `authorizations/${id}.json`;
  await mkdir(path.join(baseDir, 'authorizations'), { recursive: true });
  await writeFile(path.join(baseDir, relativePath), content);
  return {
    approved: true,
    capabilities: [scope.capability],
    ref: { kind: 'authorization', id, revision: 1, digest: sha256Bytes(Buffer.from(content)), relativePath },
  };
}

async function assertTargetAbsent(baseDir) {
  await assert.rejects(access(path.join(baseDir, scope.targetRoot)), error => error.code === 'ENOENT');
}

test('delivery approval rejects a non-authorization ref before any target write', async t => {
  const baseDir = await mkdtemp(path.join(tmpdir(), 'ui-distiller-approval-kind-'));
  t.after(() => rm(baseDir, { recursive: true, force: true }));
  const approval = await approvalAt(baseDir, 'wrong-ref-kind');
  approval.ref.kind = 'asset-package';
  await assert.rejects(() => requireApproval({ approval, baseDir, ...scope }), error => error.code === 'INVALID_AUTHORIZATION');
  await assertTargetAbsent(baseDir);
});

test('delivery approval rejects an unparseable expiry before any target write', async t => {
  const baseDir = await mkdtemp(path.join(tmpdir(), 'ui-distiller-approval-date-'));
  t.after(() => rm(baseDir, { recursive: true, force: true }));
  const approval = await approvalAt(baseDir, 'invalid-expiry', 'not-a-date');
  await assert.rejects(() => requireApproval({ approval, baseDir, ...scope }), error => error.code === 'INVALID_AUTHORIZATION');
  await assertTargetAbsent(baseDir);
});

test('delivery approval rejects an expired authorization before any target write', async t => {
  const baseDir = await mkdtemp(path.join(tmpdir(), 'ui-distiller-approval-expired-'));
  t.after(() => rm(baseDir, { recursive: true, force: true }));
  const approval = await approvalAt(baseDir, 'expired-approval', '2020-01-01T00:00:00.000Z');
  await assert.rejects(() => requireApproval({ approval, baseDir, ...scope }), error => error.code === 'AUTHORIZATION_EXPIRED');
  await assertTargetAbsent(baseDir);
});
