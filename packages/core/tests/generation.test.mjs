import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { generateAdaptedAsset, generateSourceReplica } from '../generator.mjs';
import { mapBlueprintToDaren } from '../mapper.mjs';
import { digestObject } from '../digest.mjs';

const fixtures = JSON.parse(await readFile(new URL('../../contracts/fixtures/valid.json', import.meta.url), 'utf8'));
const blueprint = structuredClone(fixtures.cases.find((entry) => entry.name === 'blueprint-generation-ready').value);
blueprint.digest = digestObject(blueprint);
const targetRef = { kind: 'design-token-set', id: 'daren-semantic', revision: 1, digest: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', relativePath: 'daren-design/design-tokens/tokens/semantic.json' };

test('source and adapted assets are deterministic, portable, and physically separate', () => {
  const source = generateSourceReplica(blueprint);
  assert.equal(source.assetPackage.variant, 'source-replica');
  assert.deepEqual(source.assetPackage.dependencies, []);
  assert.equal(generateSourceReplica(blueprint).bundleDigest, source.bundleDigest);
  assert.ok(source.files.some((file) => file.relativePath === 'index.html'));
  assert.doesNotMatch(source.files.map((file) => file.content).join('\n'), /daren-design|node_modules|https?:\/\//);

  const mapping = mapBlueprintToDaren(blueprint, { targetRef });
  assert.deepEqual(mapping.gaps, []);
  const adapted = generateAdaptedAsset(source, mapping);
  assert.equal(adapted.assetPackage.variant, 'adapted');
  assert.notEqual(adapted.assetPackage.assetId, source.assetPackage.assetId);
  assert.equal(adapted.assetPackage.parentArtifactRef.digest, source.bundleDigest);
  assert.match(adapted.files.find((file) => file.relativePath === 'styles.css').content, /var\(--color-foreground\)/);
  assert.equal(generateSourceReplica(blueprint).bundleDigest, source.bundleDigest);
  const component = source.files.find((file) => file.relativePath === 'component.js').content;
  assert.match(component, /fromState/);
  assert.match(component, /toState/);
  assert.match(component, /dataset\.state=event\.toState/);
  assert.match(component, /detail\.preventDefault\(\)/);
});

test('unknown Daren mappings return typed gaps rather than inventing tokens', () => {
  const changed = structuredClone(blueprint);
  changed.styles[0].properties['unknown-visual-axis'] = 'sparkle';
  const mapping = mapBlueprintToDaren(changed, { targetRef });
  assert.deepEqual(mapping.gaps, [{ code: 'UNSUPPORTED_TOKEN_MAPPING', styleId: 'style-root', property: 'unknown-visual-axis' }]);
});

test('one DOM event applies exactly one transition selected from the dispatch-start state', async () => {
  const changed = structuredClone(blueprint);
  const evidenceRefs = structuredClone(changed.events[0].evidenceRefs);
  changed.nodes[0].kind = 'container';
  changed.nodes[0].children = ['toggle'];
  changed.nodes.push({
    id: 'toggle', parentId: 'root', kind: 'control', children: [],
    layoutRef: changed.nodes[0].layoutRef, styleRef: changed.nodes[0].styleRef, evidenceRefs,
  });
  changed.states = [
    { id: 'closed', observation: 'observed', evidenceRefs },
    { id: 'open', observation: 'observed', evidenceRefs },
  ];
  changed.events = [
    { id: 'open', trigger: 'click', targetNodeId: 'toggle', fromState: 'closed', toState: 'open', intent: 'open', evidenceRefs },
    { id: 'close', trigger: 'click', targetNodeId: 'root', fromState: 'open', toState: 'closed', intent: 'close', evidenceRefs },
  ];
  changed.recipe.composition = ['root', 'toggle'];
  changed.recipe.stateExamples = ['closed', 'open'];
  changed.digest = digestObject(changed);

  const source = generateSourceReplica(changed);
  const component = source.files.find((file) => file.relativePath === 'component.js').content;
  const module = await import(`data:text/javascript;base64,${Buffer.from(component).toString('base64')}`);
  const dom = new JSDOM('<main id="preview"></main>');
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    const intents = [];
    const mounted = module.mount(dom.window.document.querySelector('#preview'), { onIntent: (intent) => intents.push(intent) });
    const toggle = mounted.querySelector('[data-node-id="toggle"]');
    const click = new dom.window.Event('click', { bubbles: true });
    toggle.dispatchEvent(click);
    assert.equal(mounted.dataset.state, 'open');
    assert.deepEqual(intents, ['open']);
    toggle.dispatchEvent(click);
    assert.equal(mounted.dataset.state, 'closed');
    assert.deepEqual(intents, ['open', 'close']);
  } finally {
    globalThis.document = previousDocument;
  }
});
