import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const toolRoot = fileURLToPath(new URL('../../..', import.meta.url));
const repoRoot = toolRoot;
const expectedSkills = ['design-asset-publisher', 'design-asset-registrar', 'design-system-adapter', 'ui-audit-repair', 'ui-decomposer', 'ui-replica-engine'];

async function treeDigest(root) {
  const entries = [];
  async function walk(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) await walk(absolute);
      else entries.push(`${relative}\0${createHash('sha256').update(await readFile(absolute)).digest('hex')}`);
    }
  }
  await walk(root);
  return createHash('sha256').update(entries.join('\n')).digest('hex');
}

test('Qoder build contains only its host manifest and canonical skill projections', async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), 'daren-ui-distill-qoder-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const first = path.join(temp, 'first');
  const second = path.join(temp, 'second');
  for (const output of [first, second]) {
    const result = spawnSync(process.execPath, [path.join(toolRoot, 'build.mjs'), '--target', 'qoder', '--out', output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).platform, 'qoder');
  }
  assert.equal(await treeDigest(first), await treeDigest(second));
  await access(path.join(first, '.qoder-plugin/plugin.json'));
  await access(path.join(first, 'runtime/vendor/ajv.mjs'));
  await assert.rejects(access(path.join(first, '.codex-plugin/plugin.json')), /ENOENT/);
  await assert.rejects(access(path.join(first, 'node_modules')), /ENOENT/);

  const manifest = JSON.parse(await readFile(path.join(first, '.qoder-plugin/plugin.json'), 'utf8'));
  const release = JSON.parse(await readFile(path.join(first, 'runtime/release.json'), 'utf8'));
  assert.equal(manifest.version, release.contracts.plugin);
  assert.equal(manifest.license, 'Apache-2.0');
  await access(path.join(first, 'LICENSE'));
  assert.match(await readFile(path.join(first, 'THIRD_PARTY_NOTICES.md'), 'utf8'), /Ajv 8\.20\.0[\s\S]+fast-uri 3\.1\.8/);
  assert.equal(manifest.skills, './skills/');
  assert.deepEqual((await readdir(path.join(first, 'skills'))).sort(), expectedSkills);
  for (const skill of expectedSkills) {
    assert.equal(
      await readFile(path.join(first, 'skills', skill, 'SKILL.md'), 'utf8'),
      await readFile(path.join(repoRoot, 'skills', skill, 'SKILL.md'), 'utf8'),
    );
  }

  const check = spawnSync(process.execPath, [path.join(first, 'scripts/self-check.mjs')], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.deepEqual(JSON.parse(check.stdout), {
    status: 'passed',
    platform: 'qoder',
    plugin: 'daren-ui-distill',
    version: manifest.version,
    node: process.version,
    skills: expectedSkills,
  });
});

test('Qoder package launcher reaches the shared runtime', async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), 'daren-ui-distill-qoder-launcher-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const built = path.join(temp, 'daren-ui-distill');
  const build = spawnSync(process.execPath, [path.join(toolRoot, 'build.mjs'), '--target', 'qoder', '--out', built], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const result = spawnSync(process.execPath, [path.join(built, 'bin/daren-ui-distill.mjs'), 'check', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).toolId, 'daren-ui-distill');
});
