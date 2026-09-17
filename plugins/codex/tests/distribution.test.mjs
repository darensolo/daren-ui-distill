import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { digestObject } from '../../../packages/core/digest.mjs';

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

test('canonical skills route explicit and natural-language intents without widening stages', async () => {
  for (const skill of expectedSkills) {
    const canonical = await readFile(path.join(repoRoot, 'skills', skill, 'SKILL.md'), 'utf8');
    assert.match(canonical, new RegExp(`name: ${skill}`));
    assert.doesNotMatch(canonical.match(/^metadata:.*$/m)?.[0] ?? '', /kyber\/skills-library\//);
  }
  const decompose = await readFile(path.join(repoRoot, 'skills/ui-decomposer/SKILL.md'), 'utf8');
  assert.match(decompose, /只拆解|dissect-only/);
  assert.match(decompose, /不生成|must not generate/);
  const replicate = await readFile(path.join(repoRoot, 'skills/ui-replica-engine/SKILL.md'), 'utf8');
  assert.match(replicate, /有效 Blueprint[^\n]+不重新捕获|valid Blueprint[^\n]+no re-capture/i);
  assert.match(replicate, /不得隐式适配|must not implicitly adapt/i);
  const audit = await readFile(path.join(repoRoot, 'skills/ui-audit-repair/SKILL.md'), 'utf8');
  assert.match(audit, /默认[^\n]+audit-only|audit-only[^\n]+默认|default[^\n]+audit-only/i);
  assert.match(audit, /Blueprint[^\n]+unsupported/i);
  const registrar = await readFile(path.join(repoRoot, 'skills/design-asset-registrar/SKILL.md'), 'utf8');
  const publisher = await readFile(path.join(repoRoot, 'skills/design-asset-publisher/SKILL.md'), 'utf8');
  assert.match(registrar, /RegistrationReceipt/);
  assert.match(registrar, /NATIVE_CANDIDATE_REGISTRATION_UNSUPPORTED/);
  assert.match(registrar, /must never copy native source into `src\/distilled`/);
  assert.match(registrar, /local-folder/);
  assert.match(publisher, /never registers assets or deploys publicly/i);
  assert.match(publisher, /local-folder/);
  const adapterSchema = JSON.parse(await readFile(path.join(repoRoot, 'skills/design-asset-registrar/schemas/adapter-manifest.schema.json'), 'utf8'));
  const localAdapter = JSON.parse(await readFile(path.join(repoRoot, 'skills/design-asset-registrar/references/local-folder-adapter-manifest.json'), 'utf8'));
  assert.equal(new Ajv2020({ strict: true }).compile(adapterSchema)(localAdapter), true);
});

test('build is deterministic and built package self-checks with version parity', async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), 'dh05-codex-dist-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const first = path.join(temp, 'first');
  const second = path.join(temp, 'second');
  for (const output of [first, second]) {
    const result = spawnSync(process.execPath, [path.join(toolRoot, 'build.mjs'), '--out', output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  assert.equal(await treeDigest(first), await treeDigest(second));
  const manifest = JSON.parse(await readFile(path.join(first, '.codex-plugin/plugin.json'), 'utf8'));
  const release = JSON.parse(await readFile(path.join(first, 'runtime/release.json'), 'utf8'));
  assert.equal(manifest.version, release.contracts.plugin);
  assert.equal(manifest.license, 'Apache-2.0');
  await access(path.join(first, 'LICENSE'));
  assert.match(await readFile(path.join(first, 'THIRD_PARTY_NOTICES.md'), 'utf8'), /Ajv 8\.20\.0[\s\S]+fast-uri 3\.1\.8/);
  await access(path.join(first, 'runtime/vendor/ajv.mjs'));
  await assert.rejects(access(path.join(first, 'node_modules')), /ENOENT/);
  const check = spawnSync(process.execPath, [path.join(first, 'scripts/self-check.mjs')], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.equal(JSON.parse(check.stdout).status, 'passed');
});

test('self-check accepts the Codex cachebuster suffix used for local plugin updates', async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), 'dh05-codex-cachebuster-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const built = path.join(temp, 'built');
  const build = spawnSync(process.execPath, [path.join(toolRoot, 'build.mjs'), '--out', built], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const manifestPath = path.join(built, '.codex-plugin/plugin.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version = `${manifest.version}+codex.test`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const check = spawnSync(process.execPath, [path.join(built, 'scripts/self-check.mjs')], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.equal(JSON.parse(check.stdout).version, manifest.version);
});

test('temporary install, launcher, and uninstall preserve user artifacts', async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), 'dh05-codex-install-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const built = path.join(temp, 'built');
  let result = spawnSync(process.execPath, [path.join(toolRoot, 'build.mjs'), '--out', built], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const installed = path.join(temp, 'plugins/ui-distiller');
  await mkdir(path.dirname(installed), { recursive: true });
  await cp(built, installed, { recursive: true });
  const artifact = path.join(temp, 'artifacts/asset.txt');
  await mkdir(path.dirname(artifact));
  await writeFile(artifact, 'preserve me');
  result = spawnSync(process.execPath, [path.join(installed, 'bin/ui-distiller.mjs'), 'check', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).toolId, 'ui-distiller');
  const fixtures = JSON.parse(await readFile(path.join(toolRoot, 'packages/contracts/fixtures/valid.json'), 'utf8'));
  const blueprint = structuredClone(fixtures.cases.find((entry) => entry.name === 'blueprint-generation-ready').value);
  blueprint.digest = digestObject(blueprint);
  const targetRef = { kind: 'design-token-set', id: 'daren-semantic', revision: 1, digest: 'c'.repeat(64), relativePath: 'daren-design/design-tokens/tokens/semantic.json' };
  result = spawnSync(process.execPath, [path.join(installed, 'bin/ui-distiller.mjs'), 'run', '--base-dir', temp, '--input-kind', 'blueprint', '--reproduction-depth', 'source+adapt', '--target-design-system', 'daren', '--out-dir', 'launcher-adapt', '--json'], { input: JSON.stringify({ blueprint, targetRef }), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await readFile(path.join(temp, 'launcher-adapt/source-replica/asset-package.json'), 'utf8')).includes('source-replica'), true);
  assert.equal((await readFile(path.join(temp, 'launcher-adapt/adapted/adaptation-report.json'), 'utf8')).includes('adaptation-report'), true);
  await rm(installed, { recursive: true });
  assert.equal(await readFile(artifact, 'utf8'), 'preserve me');
});
