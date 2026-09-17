import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import * as adapterKit from 'ui-distiller/adapter-kit';
import * as chromiumDriver from 'ui-distiller/chromium-web-driver';
import * as webCapture from 'ui-distiller/web-capture';

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
  const fixture = JSON.parse(await readFile(new URL(import.meta.resolve('ui-distiller/contracts/fixtures/valid.json')), 'utf8'));
  assert.equal(Array.isArray(fixture.cases), true);
  assert.equal(fixture.cases.length > 0, true);
  const release = JSON.parse(await readFile(new URL(import.meta.resolve('ui-distiller/release.json')), 'utf8'));
  assert.equal(release.version, '0.4.0');
  assert.equal(typeof chromiumDriver.createChromiumWebCaptureDriver, 'function');
  assert.equal(typeof chromiumDriver.findChromiumExecutable, 'function');
  assert.equal(typeof webCapture.captureWebUrl, 'function');
  assert.equal(release.supportedSources['web-url'].status, 'supported');
});
