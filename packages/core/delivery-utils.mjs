import { access, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

import { validateContract } from '../contracts/validate.mjs';
import { digestObject, sha256Bytes } from './digest.mjs';
import { fail } from './errors.mjs';
import { assertRelativePath } from './scope.mjs';

export async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

const within = (candidate, root) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

export async function resolveWithin(baseDir, root, relativePath) {
  assertRelativePath(root);
  assertRelativePath(relativePath);
  const absoluteBase = await realpath(baseDir);
  const lexicalRoot = path.resolve(absoluteBase, root);
  const lexicalPath = path.resolve(absoluteBase, relativePath);
  if (!within(lexicalRoot, absoluteBase) || !within(lexicalPath, lexicalRoot)) fail('SCOPE_ESCAPE', `${relativePath} is outside ${root}`);
  let actualRoot;
  let actualPath;
  try { [actualRoot, actualPath] = await Promise.all([realpath(lexicalRoot), realpath(lexicalPath)]); }
  catch (error) { fail('AUTHORIZED_FILE_NOT_FOUND', error.message); }
  if (!within(actualRoot, absoluteBase) || !within(actualPath, actualRoot)) fail('SCOPE_ESCAPE', `${relativePath} resolves outside ${root}`);
  return actualPath;
}

export async function requireApproval({ approval, capability, baseDir, targetRoot, subjectId, subjectRevision, inputDigest }) {
  if (approval?.approved !== true || !approval.capabilities?.includes(capability) || !approval.ref) {
    fail('APPROVAL_REQUIRED', `${capability} requires an explicit approval reference`);
  }
  if (approval.ref.kind !== 'authorization') fail('INVALID_AUTHORIZATION', `${capability} approval ref must be an authorization`);
  const authorizationFile = await resolveWithin(baseDir, 'authorizations', approval.ref.relativePath);
  const bytes = await readFile(authorizationFile);
  if (sha256Bytes(bytes) !== approval.ref.digest) fail('AUTHORIZATION_DIGEST_MISMATCH', `${capability} authorization bytes do not match the approval ref`);
  let authorization;
  try { authorization = JSON.parse(bytes.toString('utf8')); }
  catch (error) { fail('INVALID_AUTHORIZATION', error.message); }
  const validation = validateContract('authorization', authorization);
  if (!validation.valid) fail('INVALID_AUTHORIZATION', JSON.stringify(validation.errors));
  if (authorization.id !== approval.ref.id || authorization.revision !== approval.ref.revision
    || authorization.approved !== true || authorization.capability !== capability
    || authorization.targetRoot !== targetRoot || authorization.subjectId !== subjectId
    || authorization.subjectRevision !== subjectRevision || authorization.inputDigest !== inputDigest) {
    fail('AUTHORIZATION_SCOPE_MISMATCH', `${capability} authorization is not bound to ${subjectId} at ${targetRoot}`);
  }
  if (authorization.expiresAt) {
    const expiresAt = Date.parse(authorization.expiresAt);
    if (Number.isNaN(expiresAt)) fail('INVALID_AUTHORIZATION', `${capability} authorization expiry is invalid`);
    if (expiresAt <= Date.now()) fail('AUTHORIZATION_EXPIRED', `${capability} authorization expired`);
  }
  return structuredClone(approval.ref);
}

export function normalizePublicationMetadata(metadata) {
  for (const key of ['title', 'description', 'category']) {
    if (typeof metadata?.[key] !== 'string' || metadata[key].trim().length === 0) fail('MISSING_PUBLICATION_METADATA', `${key} is required`);
  }
  if (!['listed', 'unlisted'].includes(metadata.visibility ?? 'listed')) fail('INVALID_PUBLICATION_VISIBILITY', 'visibility must be listed or unlisted');
  return { title: metadata.title.trim(), description: metadata.description.trim(), category: metadata.category.trim(), visibility: metadata.visibility ?? 'listed' };
}

export function publicationApprovalInputDigest(registrationReceipt, metadata) {
  const sourceDigest = typeof registrationReceipt === 'string' ? registrationReceipt : registrationReceipt.sourceRef?.digest;
  if (!/^[0-9a-f]{64}$/.test(sourceDigest ?? '')) fail('INVALID_REGISTRATION_SOURCE', 'publication approval requires the registered source bundle digest');
  return digestObject({ sourceDigest, metadata: normalizePublicationMetadata(metadata) });
}

export function receiptDigest(receipt) {
  const value = structuredClone(receipt);
  delete value.digest;
  return digestObject(value);
}

export function assertReceiptDigest(receipt) {
  if (receiptDigest(receipt) !== receipt.digest) fail('RECEIPT_DIGEST_MISMATCH', `${receipt.kind ?? 'receipt'} digest mismatch`);
}

export async function readJson(file, code = 'INVALID_JSON') {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { fail(code, `${file}: ${error.message}`); }
}

export function ref(kind, id, revision, digest, relativePath) {
  return { kind, id, revision, digest, relativePath };
}

export function contentFiles(files) {
  return files.map(file => ({ relativePath: file.relativePath, digest: sha256Bytes(Buffer.from(file.content)) }));
}
