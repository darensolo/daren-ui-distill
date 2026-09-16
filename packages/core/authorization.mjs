import { validateContract } from '../contracts/validate.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { materializeAsset } from './artifact.mjs';
import { sha256Bytes } from './digest.mjs';
import { fail } from './errors.mjs';
import { exists, ref, resolveWithin } from './delivery-utils.mjs';

export async function createDeliveryAuthorization({
  confirmed, id, revision = 1, capability, targetRoot, subjectId, subjectRevision,
  inputDigest, expiresAt, baseDir,
}) {
  if (confirmed !== true) fail('CONFIRMATION_REQUIRED', 'creating a delivery authorization requires current explicit confirmation');
  const authorization = {
    schemaVersion: '1.0.0', kind: 'authorization', id, revision, approved: true,
    capability, targetRoot, subjectId, subjectRevision, inputDigest,
    ...(expiresAt ? { expiresAt } : {}),
  };
  const validation = validateContract('authorization', authorization);
  if (!validation.valid) fail('INVALID_AUTHORIZATION', JSON.stringify(validation.errors));
  const content = `${JSON.stringify(authorization, null, 2)}\n`;
  const relativePath = `authorizations/${id}.json`;
  const authorizationRef = ref('authorization', id, revision, sha256Bytes(Buffer.from(content)), relativePath);
  const absolute = path.resolve(baseDir, relativePath);
  if (await exists(absolute)) {
    const current = await readFile(await resolveWithin(baseDir, 'authorizations', relativePath));
    if (sha256Bytes(current) !== authorizationRef.digest) fail('AUTHORIZATION_CONFLICT', `${id} already exists with a different scope or input`);
    return {
      authorization,
      approval: { approved: true, capabilities: [capability], ref: authorizationRef },
      materialization: { status: 'succeeded', targetRoot: 'authorizations', receipts: [{ relativePath: `${id}.json`, digest: authorizationRef.digest }], idempotent: true },
    };
  }
  const materialization = await materializeAsset(
    { files: [{ relativePath: `${id}.json`, content }] },
    { baseDir, writeRoots: ['authorizations'], targetRoot: 'authorizations' },
  );
  return {
    authorization,
    approval: { approved: true, capabilities: [capability], ref: authorizationRef },
    materialization,
  };
}
