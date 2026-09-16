import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateContract } from '../../packages/contracts/validate.mjs';
import { createDeliveryAuthorization } from '../../packages/core/authorization.mjs';
import { digestObject } from '../../packages/core/digest.mjs';
import { generateAdaptedAsset, generateSourceReplica } from '../../packages/core/generator.mjs';
import { mapBlueprintToDaren } from '../../packages/core/mapper.mjs';
import { publicationApprovalInputDigest, publishLocalAsset, registerLocalAsset } from './index.mjs';

const fixtures = JSON.parse(await readFile(new URL('../../packages/contracts/fixtures/valid.json', import.meta.url), 'utf8'));

test('local-folder adapter registers and publishes with separate receipts and idempotent retries', async t => {
  const baseDir = await mkdtemp(path.join(tmpdir(), 'ui-distill-local-folder-'));
  t.after(() => rm(baseDir, { recursive: true, force: true }));
  const blueprint = structuredClone(fixtures.cases.find(entry => entry.name === 'blueprint-generation-ready').value);
  blueprint.digest = digestObject(blueprint);
  const targetRef = { kind: 'design-token-set', id: 'fixture-semantic', revision: 1, digest: 'c'.repeat(64), relativePath: 'fixtures/semantic.json' };
  const bundle = generateAdaptedAsset(generateSourceReplica(blueprint), mapBlueprintToDaren(blueprint, { targetRef }));
  const slug = bundle.assetPackage.assetId;
  const assetId = `local/${slug}`;
  const libraryTarget = `.ui-distill/library/assets/${slug}`;
  const registrationApproval = (await createDeliveryAuthorization({
    confirmed: true, id: 'register-fixture', capability: 'library-write', targetRoot: libraryTarget,
    subjectId: assetId, subjectRevision: 1, inputDigest: bundle.bundleDigest, baseDir,
  })).approval;
  const registered = await registerLocalAsset({ bundle, approval: registrationApproval, baseDir });
  assert.equal(registered.receipt.kind, 'registration-receipt');
  assert.equal((await stat(path.join(baseDir, libraryTarget, 'registration.json'))).isFile(), true);
  const hostReceipt = structuredClone(registered.receipt);
  hostReceipt.publicEntry = `./distilled/${slug}`;
  assert.equal(validateContract('registration-receipt', hostReceipt).valid, true);
  for (const publicEntry of [`../distilled/${slug}`, `./distilled/../${slug}`, `./Distilled/${slug}`]) {
    hostReceipt.publicEntry = publicEntry;
    assert.equal(validateContract('registration-receipt', hostReceipt).valid, false, publicEntry);
  }

  const metadata = { title: 'Fixture component', description: 'Synthetic local publication.', category: 'Fixture', visibility: 'listed' };
  const siteTarget = `.ui-distill/site/publications/${slug}`;
  const publicationApproval = (await createDeliveryAuthorization({
    confirmed: true, id: 'publish-fixture', capability: 'site-write', targetRoot: siteTarget,
    subjectId: assetId, subjectRevision: 1, inputDigest: publicationApprovalInputDigest(registered.receipt, metadata), baseDir,
  })).approval;
  const published = await publishLocalAsset({ registrationReceipt: registered.receipt, metadata, approval: publicationApproval, baseDir });
  assert.equal(published.receipt.kind, 'publication-receipt');
  assert.notEqual(published.receipt.digest, registered.receipt.digest);
  assert.equal(published.receipt.route, `/assets/${slug}/`);
  assert.equal((await stat(path.join(baseDir, siteTarget, 'publication.json'))).isFile(), true);
  const hostPublication = structuredClone(published.receipt);
  hostPublication.route = `/components/${slug}/`;
  hostPublication.previewRoute = `/distilled/${slug}.html`;
  assert.equal(validateContract('publication-receipt', hostPublication).valid, true);
  for (const [route, previewRoute] of [
    [`/components/../${slug}/`, `/distilled/${slug}.html`],
    [`/Components/${slug}/`, `/distilled/${slug}.html`],
    [`/components/${slug}/?draft=1`, `/distilled/${slug}.html`],
    [`/components/${slug}/`, `/distilled/../${slug}.html`],
    [`/components/${slug}/`, `/distilled/${slug}.html?draft=1`],
  ]) {
    hostPublication.route = route;
    hostPublication.previewRoute = previewRoute;
    assert.equal(validateContract('publication-receipt', hostPublication).valid, false, `${route} ${previewRoute}`);
  }

  const registeredAgain = await registerLocalAsset({ bundle, approval: registrationApproval, baseDir });
  const publishedAgain = await publishLocalAsset({ registrationReceipt: registered.receipt, metadata, approval: publicationApproval, baseDir });
  assert.equal(registeredAgain.materialization.idempotent, true);
  assert.equal(publishedAgain.materialization.idempotent, true);
  await assert.rejects(() => registerLocalAsset({ bundle, baseDir }), error => error.code === 'APPROVAL_REQUIRED');
});
