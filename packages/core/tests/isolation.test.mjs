import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { detectMacOSSandbox, createIsolationDriver } from '../isolation/index.mjs';
import { previewAsset } from '../preview.mjs';

test('sandbox profile is deny-default and denies network', async () => {
  const profile = await readFile(new URL('../isolation/profile.sb', import.meta.url), 'utf8');
  assert.match(profile, /\(deny default\)/);
  assert.match(profile, /\(deny network\*\)/);
});

test('preview fails closed when a sandbox is unavailable', async () => {
  const driver = createIsolationDriver({ capability: { status: 'unavailable', reason: 'fixture' } });
  const result = await previewAsset({ files: [] }, { driver });
  assert.deepEqual(result, { status: 'blocked', reason: 'fixture', executed: false });
  const detected = await detectMacOSSandbox({ platform: 'not-darwin' });
  assert.equal(detected.status, 'unavailable');
});
