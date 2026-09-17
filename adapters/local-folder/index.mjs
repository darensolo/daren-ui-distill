import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { validateContract } from '../../packages/contracts/validate.mjs';
import { materializeAsset } from '../../packages/core/artifact.mjs';
import { canonicalJson, digestObject, sha256File } from '../../packages/core/digest.mjs';
import { fail } from '../../packages/core/errors.mjs';
import {
  assertReceiptDigest,
  contentFiles,
  exists,
  normalizePublicationMetadata,
  publicationApprovalInputDigest,
  readJson,
  receiptDigest,
  ref,
  requireApproval,
  resolveWithin,
} from '../../packages/core/delivery-utils.mjs';

function assertBundle(bundle) {
  const validation = validateContract('asset-package', bundle?.assetPackage);
  if (!validation.valid) fail('INVALID_ASSET_PACKAGE', JSON.stringify(validation.errors));
  if (bundle.assetPackage.variant !== 'adapted' || bundle.assetPackage.level !== 'L2') {
    fail('UNSUPPORTED_ASSET_KIND', 'local-folder v1 accepts adapted L2 component AssetPackages only');
  }
  if (bundle.assetPackage.rights !== 'allowed') fail('RIGHTS_BLOCK_REGISTRATION', 'registration requires rights=allowed');
  const digestInput = structuredClone(bundle);
  delete digestInput.bundleDigest;
  if (digestObject(digestInput) !== bundle.bundleDigest) fail('ASSET_BUNDLE_DIGEST_MISMATCH', 'bundle digest mismatch');
  const declared = new Map(bundle.assetPackage.files.map(file => [file.relativePath, file.digest]));
  const actual = new Map((bundle.files ?? []).map(file => [file.relativePath, file]));
  if (declared.size !== bundle.assetPackage.files.length || actual.size !== bundle.files?.length) fail('DUPLICATE_ASSET_PATH', 'AssetPackage file paths must be unique');
  if (declared.size !== actual.size || [...declared.keys()].some(relativePath => !actual.has(relativePath))) fail('ASSET_FILE_SET_MISMATCH', 'bundle files differ from AssetPackage files');
  for (const required of ['component.js', 'styles.css', 'index.html']) if (!actual.has(required)) fail('UNSUPPORTED_ASSET_LAYOUT', `adapted component is missing ${required}`);
}

async function existingReceipt({ baseDir, targetRoot, fileName, desiredFiles, receipt, conflictCode }) {
  const relativePath = `${targetRoot}/${fileName}`;
  if (!await exists(path.resolve(baseDir, relativePath))) return null;
  const current = await readJson(await resolveWithin(baseDir, targetRoot, relativePath));
  assertReceiptDigest(current);
  if (current.digest !== receipt.digest) fail(conflictCode, `${targetRoot} already contains different content`);
  for (const file of desiredFiles) {
    const absolute = await resolveWithin(baseDir, targetRoot, `${targetRoot}/${file.relativePath}`);
    if (await sha256File(absolute) !== contentFiles([file])[0].digest) fail(conflictCode, `${file.relativePath} drifted`);
  }
  return current;
}

export async function registerLocalAsset({ bundle, approval, baseDir, libraryRoot = '.ui-distiller/library' }) {
  assertBundle(bundle);
  const slug = bundle.assetPackage.assetId;
  const assetId = `local/${slug}`;
  const targetRoot = `${libraryRoot}/assets/${slug}`;
  const approvalRef = await requireApproval({
    approval, capability: 'library-write', baseDir, targetRoot, subjectId: assetId,
    subjectRevision: bundle.assetPackage.revision, inputDigest: bundle.bundleDigest,
  });
  const sourceSnapshot = structuredClone(bundle);
  delete sourceSnapshot.bundleDigest;
  const sourceFiles = [
    ...bundle.files.map(file => ({ relativePath: file.relativePath, content: file.content })),
    { relativePath: 'asset-package.json', content: `${JSON.stringify(bundle.assetPackage, null, 2)}\n` },
    { relativePath: 'asset-bundle.json', content: canonicalJson(sourceSnapshot) },
  ];
  const sourceRef = ref('asset-package', slug, bundle.assetPackage.revision, bundle.bundleDigest, `${targetRoot}/asset-bundle.json`);
  const registration = {
    schemaVersion: 1,
    adapter: 'local-folder',
    asset: { id: assetId, slug, kind: 'component', level: 'L2', sourceRef },
  };
  const registrationFile = { relativePath: 'registration.json', content: `${JSON.stringify(registration, null, 2)}\n` };
  const preReceiptFiles = [...sourceFiles, registrationFile];
  const receiptBase = {
    schemaVersion: '1.0.0',
    kind: 'registration-receipt',
    assetRef: ref('library-asset', assetId, bundle.assetPackage.revision, digestObject(registration.asset), `${targetRoot}/registration.json`),
    sourceRef,
    registryRef: ref('registry-entry', assetId, bundle.assetPackage.revision, digestObject(registration), `${targetRoot}/registration.json`),
    publicEntry: `./assets/${slug}`,
    files: contentFiles(preReceiptFiles).map(file => ({ ...file, relativePath: `${targetRoot}/${file.relativePath}` })),
    approvalRef,
    rollback: { strategy: 'remove-registration-and-rebuild', targetRoot, projectionCommand: 'not-required' },
  };
  const receipt = { ...receiptBase, digest: receiptDigest(receiptBase) };
  const validation = validateContract('registration-receipt', receipt);
  if (!validation.valid) fail('INVALID_REGISTRATION_RECEIPT', JSON.stringify(validation.errors));
  const desiredFiles = [...preReceiptFiles, { relativePath: 'registration-receipt.json', content: `${JSON.stringify(receipt, null, 2)}\n` }];
  const current = await existingReceipt({ baseDir, targetRoot, fileName: 'registration-receipt.json', desiredFiles, receipt, conflictCode: 'REGISTRATION_CONFLICT' });
  if (current) return { receipt: current, materialization: { status: 'succeeded', targetRoot, idempotent: true } };
  const materialization = await materializeAsset({ files: desiredFiles }, { baseDir, writeRoots: [`${libraryRoot}/assets`], targetRoot });
  return { receipt, materialization };
}

export async function readLocalRegistrationReceipt({ baseDir, libraryRoot = '.ui-distiller/library', receiptPath }) {
  const receipt = JSON.parse(await readFile(await resolveWithin(baseDir, libraryRoot, receiptPath), 'utf8'));
  const validation = validateContract('registration-receipt', receipt);
  if (!validation.valid) fail('INVALID_REGISTRATION_RECEIPT', JSON.stringify(validation.errors));
  assertReceiptDigest(receipt);
  return receipt;
}

async function verifyRegistration({ baseDir, libraryRoot, receipt }) {
  const validation = validateContract('registration-receipt', receipt);
  if (!validation.valid) fail('INVALID_REGISTRATION_RECEIPT', JSON.stringify(validation.errors));
  assertReceiptDigest(receipt);
  const registration = await readJson(await resolveWithin(baseDir, libraryRoot, receipt.registryRef.relativePath), 'REGISTRATION_NOT_FOUND');
  if (digestObject(registration) !== receipt.registryRef.digest) fail('STALE_REGISTRATION_RECEIPT', 'registration entry no longer matches its receipt');
  for (const file of receipt.files) {
    const absolute = await resolveWithin(baseDir, libraryRoot, file.relativePath);
    if (await sha256File(absolute) !== file.digest) fail('STALE_REGISTRATION_RECEIPT', `registered file drift: ${file.relativePath}`);
  }
  await requireApproval({
    approval: { approved: true, capabilities: ['library-write'], ref: receipt.approvalRef },
    capability: 'library-write', baseDir, targetRoot: receipt.rollback.targetRoot,
    subjectId: receipt.assetRef.id, subjectRevision: receipt.assetRef.revision, inputDigest: receipt.sourceRef.digest,
  });
  return registration;
}

export async function publishLocalAsset({ registrationReceipt, metadata, approval, baseDir, libraryRoot = '.ui-distiller/library', siteRoot = '.ui-distiller/site' }) {
  await verifyRegistration({ baseDir, libraryRoot, receipt: registrationReceipt });
  const normalized = normalizePublicationMetadata(metadata);
  const slug = registrationReceipt.assetRef.id.replace(/^local\//, '');
  const targetRoot = `${siteRoot}/publications/${slug}`;
  const approvalRef = await requireApproval({
    approval, capability: 'site-write', baseDir, targetRoot,
    subjectId: registrationReceipt.assetRef.id, subjectRevision: registrationReceipt.assetRef.revision,
    inputDigest: publicationApprovalInputDigest(registrationReceipt, normalized),
  });
  const sourceRoot = path.dirname(await resolveWithin(baseDir, libraryRoot, registrationReceipt.registryRef.relativePath));
  const componentSource = await readFile(path.join(sourceRoot, 'component.js'), 'utf8');
  const styles = await readFile(path.join(sourceRoot, 'styles.css'), 'utf8');
  const route = `/assets/${slug}/`;
  const previewRoute = `/previews/${slug}.html`;
  const publication = {
    schemaVersion: 1, kind: 'distilled-publication', adapter: 'local-folder', slug,
    assetRef: registrationReceipt.assetRef,
    registrationReceiptRef: ref('registration-receipt', registrationReceipt.assetRef.id, registrationReceipt.assetRef.revision, registrationReceipt.digest, `${registrationReceipt.rollback.targetRoot}/registration-receipt.json`),
    ...normalized, route, previewRoute,
  };
  const preReceiptFiles = [
    { relativePath: 'publication.json', content: `${JSON.stringify(publication, null, 2)}\n` },
    { relativePath: 'component.js', content: componentSource },
    { relativePath: 'styles.css', content: styles },
  ];
  const receiptBase = {
    schemaVersion: '1.0.0', kind: 'publication-receipt', assetRef: registrationReceipt.assetRef,
    registrationReceiptRef: publication.registrationReceiptRef,
    projectionRef: ref('site-projection', registrationReceipt.assetRef.id, registrationReceipt.assetRef.revision, digestObject(publication), `${targetRoot}/publication.json`),
    route, previewRoute, visibility: normalized.visibility, deploymentStatus: 'not-requested',
    files: contentFiles(preReceiptFiles).map(file => ({ ...file, relativePath: `${targetRoot}/${file.relativePath}` })),
    approvalRef, rollback: { strategy: 'remove-site-projection', targetRoot },
  };
  const receipt = { ...receiptBase, digest: receiptDigest(receiptBase) };
  const validation = validateContract('publication-receipt', receipt);
  if (!validation.valid) fail('INVALID_PUBLICATION_RECEIPT', JSON.stringify(validation.errors));
  const desiredFiles = [...preReceiptFiles, { relativePath: 'publication-receipt.json', content: `${JSON.stringify(receipt, null, 2)}\n` }];
  const current = await existingReceipt({ baseDir, targetRoot, fileName: 'publication-receipt.json', desiredFiles, receipt, conflictCode: 'PUBLICATION_CONFLICT' });
  if (current) return { receipt: current, materialization: { status: 'succeeded', targetRoot, idempotent: true } };
  const materialization = await materializeAsset({ files: desiredFiles }, { baseDir, writeRoots: [`${siteRoot}/publications`], targetRoot });
  return { receipt, materialization };
}

export { publicationApprovalInputDigest } from '../../packages/core/delivery-utils.mjs';
