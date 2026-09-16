import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildBlueprint } from '../blueprint.mjs';
import { compileCapture } from '../compiler.mjs';
import { projectBlueprintMarkdown } from '../projection.mjs';

const validFixtures = JSON.parse(await readFile(new URL('../../contracts/fixtures/valid.json', import.meta.url), 'utf8'));
const capture = validFixtures.cases.find((fixture) => fixture.name === 'capture-evidence-bundle').value;

const proposal = {
  granularity: 'component',
  nodes: [{ id: 'root', parentId: null, kind: 'control', children: [], layoutRef: 'layout-root', styleRef: 'style-root', evidenceRefs: [capture.evidence[0].ref] }],
  layout: [{ id: 'layout-root', display: 'flex', values: { gap: 8 }, evidenceRefs: [capture.evidence[0].ref] }],
  styles: [{ id: 'style-root', properties: { color: '#fff' }, evidenceRefs: [capture.evidence[0].ref] }],
  resources: [],
  props: ['status'],
  states: [{ id: 'default', evidenceRefs: [capture.evidence[0].ref] }],
  events: [{ id: 'activate', trigger: 'click', targetNodeId: 'root', fromState: 'default', toState: 'default', intent: 'activate', evidenceRefs: [capture.evidence[0].ref] }],
  recipe: { composition: ['root'], slots: [], resourceRefs: [], stateExamples: ['default'] },
  checkBaseline: capture.source.ref,
  requiredStates: ['default'],
  requiredEvents: ['activate'],
};

test('static definitions can be generation-ready without claiming runtime verification', () => {
  const staticCapture = structuredClone(capture);
  staticCapture.evidence[0].kind = 'static';
  const blueprint = buildBlueprint({ capture: staticCapture, proposal, blueprintId: 'sample-control', rights: 'allowed' });
  assert.equal(blueprint.generationReady, true);
  assert.equal(blueprint.runtimeVerification, 'unverified');
  assert.deepEqual(blueprint.runtimeEvidenceGaps, ['event:activate', 'state:default']);
  assert.equal(buildBlueprint({ capture: staticCapture, proposal, blueprintId: 'sample-control', rights: 'allowed' }).digest, blueprint.digest);
  const markdown = projectBlueprintMarkdown(blueprint);
  assert.match(markdown, /Runtime verification: unverified/);
  assert.match(markdown, /state:default/);
});

test('missing required definitions produce a valid but non-generatable blueprint', () => {
  const blueprint = buildBlueprint({ capture, proposal: { ...proposal, events: [] }, blueprintId: 'sample-control', rights: 'allowed' });
  assert.equal(blueprint.generationReady, false);
  assert.ok(blueprint.blockingIssues.includes('missing-event:activate'));
});

test('candidate interaction evidence never upgrades source runtime truth', () => {
  const candidateCapture = structuredClone(capture);
  const candidateRef = { ...candidateCapture.evidence[0].ref, id: 'candidate-interaction', relativePath: 'evidence/candidate-interaction.json' };
  candidateCapture.evidence.push({ ...candidateCapture.evidence[0], id: 'candidate-event', subject: 'candidate', kind: 'interaction', ref: candidateRef });
  const candidateProposal = structuredClone(proposal);
  candidateProposal.events[0].evidenceRefs.push(candidateRef);
  const blueprint = buildBlueprint({ capture: candidateCapture, proposal: candidateProposal, blueprintId: 'candidate-only-control', rights: 'allowed' });
  assert.equal(blueprint.generationReady, true);
  assert.equal(blueprint.runtimeVerification, 'unverified');
  assert.deepEqual(blueprint.runtimeEvidenceGaps, ['event:activate']);
});

test('compiler preserves observed events only for referenced source interaction evidence', () => {
  const evidenceCapture = structuredClone(capture);
  const candidateRef = { ...capture.evidence[0].ref, id: 'candidate-click', relativePath: 'evidence/candidate-click.json' };
  const sourceRef = { ...capture.evidence[0].ref, id: `interaction-event-${Buffer.from('activate').toString('base64url')}`, relativePath: 'evidence/source-click.json' };
  evidenceCapture.evidence.push(
    { ...capture.evidence[0], id: 'candidate-click', subject: 'candidate', kind: 'interaction', ref: candidateRef },
    { ...capture.evidence[0], id: 'source-click', subject: 'source', kind: 'interaction', ref: sourceRef },
  );
  const event = { id: 'activate', trigger: 'click', observation: 'observed' };
  const candidate = compileCapture(evidenceCapture, { events: [{ ...event, evidenceRefs: [candidateRef] }] });
  const source = compileCapture(evidenceCapture, { events: [{ ...event, evidenceRefs: [sourceRef] }] });
  assert.equal(candidate.events[0].observation, 'inferred');
  assert.equal(source.events[0].observation, 'observed');
});

test('one validated interaction locator cannot prove a different event or state', () => {
  const evidenceCapture = structuredClone(capture);
  const activateRef = { ...capture.evidence[0].ref, id: `interaction-event-${Buffer.from('activate').toString('base64url')}`, relativePath: 'evidence/activate.json' };
  evidenceCapture.evidence.push({ ...capture.evidence[0], id: 'activate-observed', subject: 'source', kind: 'interaction', observation: 'observed', ref: activateRef });
  const changed = structuredClone(proposal);
  changed.events = [
    { ...changed.events[0], evidenceRefs: [activateRef] },
    { ...changed.events[0], id: 'delete', intent: 'delete', evidenceRefs: [activateRef] },
  ];
  changed.requiredEvents = ['activate', 'delete'];
  const blueprint = buildBlueprint({ capture: evidenceCapture, proposal: changed, blueprintId: 'locator-bound', rights: 'allowed' });
  assert.equal(blueprint.runtimeVerification, 'unverified');
  assert.deepEqual(blueprint.runtimeEvidenceGaps, ['event:delete']);
});
