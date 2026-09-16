import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  normalizeLegacyStages,
  schemaNames,
  validateContract,
} from './validate.mjs';

const fixtures = JSON.parse(
  await readFile(new URL('./fixtures/valid.json', import.meta.url), 'utf8'),
);
const invalidFixtures = JSON.parse(
  await readFile(new URL('./fixtures/invalid.json', import.meta.url), 'utf8'),
);

test('locked production and delivery schemas accept every positive fixture', () => {
  assert.deepEqual(schemaNames, [
    'job',
    'capture-ir',
    'asset-package',
    'quality',
    'feedback',
    'adapters',
    'gap-inventory',
    'stage-execution',
    'blueprint',
    'authorization',
    'registration-receipt',
    'publication-receipt',
  ]);

  for (const fixture of fixtures.cases) {
    const result = validateContract(fixture.schema, fixture.value);
    assert.equal(result.valid, true, `${fixture.name}: ${JSON.stringify(result.errors)}`);
  }
});

test('locked negative fixtures fail with typed, stable errors', () => {
  const positiveByName = new Map(fixtures.cases.map((fixture) => [fixture.name, fixture.value]));
  for (const fixture of invalidFixtures.cases) {
    const value = structuredClone(positiveByName.get(fixture.base));
    assert.ok(value, `${fixture.name}: unknown positive base ${fixture.base}`);
    for (const mutation of fixture.mutations) {
      const segments = mutation.path.split('/').filter(Boolean);
      const key = segments.pop();
      const parent = segments.reduce((current, segment) => current[segment], value);
      if (mutation.operation === 'delete') delete parent[key];
      else parent[key] = mutation.value;
    }
    const result = validateContract(fixture.schema, value);
    assert.equal(result.valid, false, `${fixture.name} unexpectedly passed`);
    assert.ok(
      result.errors.some((error) => error.code === fixture.expectedCode),
      `${fixture.name}: expected ${fixture.expectedCode}, got ${JSON.stringify(result.errors)}`,
    );
  }
});

test('legacy stage names normalize only at the versioned boundary', () => {
  assert.deepEqual(
    normalizeLegacyStages(['replica', 'library', 'site'], { sourceVersion: '0.9.0' }),
    {
      stages: ['replicate', 'register', 'publish'],
      warnings: [
        'legacy-stage:replica->replicate',
        'legacy-stage:library->register',
        'legacy-stage:site->publish',
      ],
    },
  );

  assert.throws(
    () => normalizeLegacyStages(['replica', 'replicate'], { sourceVersion: '0.9.0' }),
    (error) => error.code === 'DUPLICATE_STAGE',
  );
  assert.throws(
    () => normalizeLegacyStages(['replica'], { sourceVersion: '1.0.0' }),
    (error) => error.code === 'LEGACY_STAGE_NOT_ALLOWED',
  );
  assert.throws(
    () => normalizeLegacyStages(['mystery'], { sourceVersion: '0.9.0' }),
    (error) => error.code === 'UNKNOWN_STAGE',
  );
});

test('passed quality and Blueprint reachability guards fail closed', () => {
  const positiveByName = new Map(fixtures.cases.map((fixture) => [fixture.name, fixture.value]));
  const mutated = (fixtureName) => {
    const fixture = invalidFixtures.cases.find((candidate) => candidate.name === fixtureName);
    const value = structuredClone(positiveByName.get(fixture.base));
    for (const mutation of fixture.mutations) {
      const segments = mutation.path.split('/').filter(Boolean);
      const key = segments.pop();
      const parent = segments.reduce((current, segment) => current[segment], value);
      parent[key] = mutation.value;
    }
    return validateContract(fixture.schema, value);
  };

  assert.ok(mutated('empty-checkset-pass').errors.some((error) => error.code === 'SCHEMA_INVALID'));
  assert.ok(mutated('open-blocking-finding-pass').errors.some((error) => error.code === 'SCHEMA_INVALID'));
  const openP0 = structuredClone(positiveByName.get('quality-source-fidelity'));
  openP0.findings = [{
    id: 'release-blocker', severity: 'P0', status: 'open', subjectRef: structuredClone(openP0.subjectRef),
  }];
  assert.ok(validateContract('quality', openP0).errors.some((error) => error.code === 'SCHEMA_INVALID'));
  assert.ok(mutated('blueprint-disconnected-cycle').errors.some((error) => error.code === 'UNREACHABLE_NODE'));
});
