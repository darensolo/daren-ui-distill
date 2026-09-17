import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { materializeAsset } from '../artifact.mjs';
import { buildBlueprint } from '../blueprint.mjs';
import { createChromiumWebCaptureDriver } from '../drivers/chromium-web-driver.mjs';
import { sha256File } from '../digest.mjs';
import { runBlueprintPipeline } from '../index.mjs';
import { captureWebUrl } from '../web-capture.mjs';
import { buildCodexDistribution } from '../../../plugins/codex/scripts/build.mjs';

function proposalFor(capture, width) {
  const evidence = Object.fromEntries(capture.evidence.map((item) => [item.kind, item.ref]));
  return {
    granularity: 'page',
    nodes: [{ id: 'root', parentId: null, kind: 'container', children: [], layoutRef: 'layout-root', styleRef: 'style-root', evidenceRefs: [evidence.static] }],
    layout: [{ id: 'layout-root', display: 'block', values: { width }, evidenceRefs: [evidence['computed-style']] }],
    styles: [{ id: 'style-root', properties: { color: 'source-observed' }, evidenceRefs: [evidence['computed-style']] }],
    resources: [],
    props: [],
    states: [{ id: 'default', evidenceRefs: [evidence.screenshot, evidence['computed-style']] }],
    events: [],
    recipe: { composition: ['root'], slots: [], resourceRefs: [], stateExamples: ['default'] },
    checkBaseline: evidence.screenshot,
    requiredStates: ['default'],
    requiredEvents: [],
  };
}

test('public URL completes capture, verified materialization, Blueprint, and Source Replica at two viewports', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'ui-distiller-web-e2e-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const driver = await createChromiumWebCaptureDriver();
  const sourceDigests = [];
  for (const viewport of [{ width: 800, height: 600 }, { width: 1280, height: 720 }]) {
    const evidenceRoot = `evidence-${viewport.width}`;
    const result = await captureWebUrl({
      url: 'https://example.com/', viewport, locale: 'en-US', theme: 'light', driver,
      artifactRoot: evidenceRoot, limits: { timeoutMs: 60_000 },
    });
    const prefix = `${evidenceRoot}/`;
    const capturePath = result.capture.source.ref.relativePath.slice(prefix.length);
    await materializeAsset({
      files: [
        ...result.artifacts.map((artifact) => ({ relativePath: artifact.relativePath, content: artifact.bytes })),
        { relativePath: capturePath, content: `${JSON.stringify(result.capture, null, 2)}\n` },
      ],
    }, { baseDir: root, writeRoots: [evidenceRoot], targetRoot: evidenceRoot });
    for (const resource of result.capture.resources) {
      assert.equal(await sha256File(path.join(root, resource.relativePath)), resource.digest);
    }
    const blueprint = buildBlueprint({
      capture: result.capture,
      proposal: proposalFor(result.capture, viewport.width),
      blueprintId: `example-page-${viewport.width}`,
      rights: 'allowed',
    });
    assert.equal(blueprint.generationReady, true);
    const replicaRoot = `replica-${viewport.width}`;
    const replica = await runBlueprintPipeline({ blueprint, baseDir: root, outDir: replicaRoot });
    assert.equal(replica.materialization.status, 'succeeded');
    assert.equal((await stat(path.join(root, replicaRoot, 'asset-package.json'))).isFile(), true);
    sourceDigests.push(result.capture.source.ref.digest);
  }
  assert.notEqual(sourceDigests[0], sourceDigests[1], 'viewport is part of the capture identity');
  await assert.rejects(
    () => captureWebUrl({ url: 'https://127.0.0.1.nip.io/', viewport: { width: 800, height: 600 }, driver, limits: { timeoutMs: 15_000 } }),
    (error) => error.code === 'WEB_CAPTURE_NETWORK_BLOCKED',
  );
});

test('built Codex package captures a public URL and materializes verified evidence through its launcher', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'ui-distiller-packaged-web-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const distribution = path.join(root, 'codex-package');
  await buildCodexDistribution(distribution);
  const captured = spawnSync(process.execPath, [
    path.join(distribution, 'bin/ui-distiller.mjs'), 'capture', '--base-dir', root,
    '--out-dir', 'packaged-evidence', '--json',
  ], {
    input: JSON.stringify({ source: { kind: 'web-url', url: 'https://example.com/' }, viewport: { width: 1024, height: 768 } }),
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(captured.status, 0, captured.stderr);
  const bundle = JSON.parse(captured.stdout);
  assert.equal(bundle.source.kind, 'web-url');
  assert.equal(bundle.evidence.length, 4);
  for (const resource of bundle.resources) {
    assert.equal(await sha256File(path.join(root, resource.relativePath)), resource.digest);
  }
  assert.equal((await stat(path.join(root, bundle.source.ref.relativePath))).isFile(), true);
});
