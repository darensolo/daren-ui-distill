import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { chromium } from '@playwright/test';

import { digestObject } from '../../../packages/core/digest.mjs';
import { generateSourceReplica } from '../../../packages/core/generator.mjs';
import { prepareConsumer, startConsumerServer } from './consumer.mjs';
import { consumerViewports } from './playwright.config.mjs';

test('copied public package renders at three widths and exposes click and keyboard state changes', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-consumer-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const valid = JSON.parse(await readFile(new URL('../../../packages/contracts/fixtures/valid.json', import.meta.url), 'utf8'));
  const blueprint = structuredClone(valid.cases.find((entry) => entry.name === 'blueprint-generation-ready').value);
  blueprint.layout[0].values = { ...blueprint.layout[0].values, padding: 8, width: '100%' };
  blueprint.states.push({ ...blueprint.states[0], id: 'expanded' });
  blueprint.events[0] = { ...blueprint.events[0], fromState: 'default', toState: 'expanded' };
  blueprint.events.push({ ...blueprint.events[0], id: 'keyboard-toggle', trigger: 'keyboard', fromState: 'expanded', toState: 'default', intent: 'keyboard activate' });
  blueprint.digest = digestObject(blueprint);
  const bundle = generateSourceReplica(blueprint);
  const publicPackage = path.join(root, 'public-package');
  await mkdir(publicPackage);
  await writeFile(path.join(publicPackage, 'asset-package.json'), JSON.stringify(bundle.assetPackage));
  for (const file of bundle.files) await writeFile(path.join(publicPackage, file.relativePath), file.content);
  const consumer = path.join(root, 'consumer');
  await prepareConsumer({ packageDirectory: publicPackage, outputDirectory: consumer });
  const server = await startConsumerServer(consumer);
  t.after(() => server.close());
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  for (const viewport of consumerViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(server.url);
    await page.waitForFunction(() => Boolean(globalThis.__consumer));
    const width = await page.locator('#consumer').evaluate((element) => element.getBoundingClientRect().width);
    assert.ok(width > 0 && width <= viewport.width, `${viewport.name} width escaped its container`);
    assert.equal(await page.locator('[data-state="default"]').count(), 1);
  }
  const control = page.locator('[data-node-id="root"]');
  await control.click();
  assert.equal(await control.getAttribute('data-state'), 'expanded');
  assert.match(await page.locator('#event-log').textContent(), /toggle details/);
  await control.press('Enter');
  assert.equal(await control.getAttribute('data-state'), 'default');
  const intents = await page.evaluate(() => globalThis.__consumer.events.map((event) => event.intent));
  assert.deepEqual(intents, ['toggle details', 'keyboard activate']);
  assert.equal(intents.filter((intent) => intent === 'keyboard activate').length, 1, 'Enter must not double-dispatch keyboard intent');
});
