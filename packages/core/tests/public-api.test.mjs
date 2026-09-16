import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import * as adapterKit from 'daren-ui-distill/adapter-kit';

test('host adapters consume one explicit public kit and exported contract fixtures', async () => {
  for (const name of [
    'assertReceiptDigest', 'assertRelativePath', 'canonicalJson', 'contentFiles',
    'createDeliveryAuthorization', 'digestObject', 'exists', 'fail',
    'generateAdaptedAsset', 'generateSourceReplica', 'mapBlueprintToDaren', 'materializeAsset',
    'normalizePublicationMetadata', 'publicationApprovalInputDigest', 'readJson', 'receiptDigest',
    'ref', 'requireApproval', 'resolveWithin', 'sha256Bytes', 'sha256File', 'validateContract',
  ]) {
    assert.equal(typeof adapterKit[name], 'function', `${name} is not exported`);
  }
  const fixture = JSON.parse(await readFile(new URL(import.meta.resolve('daren-ui-distill/contracts/fixtures/valid.json')), 'utf8'));
  assert.equal(Array.isArray(fixture.cases), true);
  assert.equal(fixture.cases.length > 0, true);
  const release = JSON.parse(await readFile(new URL(import.meta.resolve('daren-ui-distill/release.json')), 'utf8'));
  assert.equal(release.version, '0.2.3');
});
