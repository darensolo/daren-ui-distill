#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = ['design-asset-publisher', 'design-asset-registrar', 'design-system-adapter', 'ui-audit-repair', 'ui-decomposer', 'ui-replica-engine'];
const manifests = [
  { platform: 'codex', relativePath: '.codex-plugin/plugin.json' },
  { platform: 'qoder', relativePath: '.qoder-plugin/plugin.json' },
];

async function exists(target) {
  try { await access(target); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function selfCheck() {
  const present = [];
  for (const candidate of manifests) {
    if (await exists(path.join(pluginRoot, candidate.relativePath))) present.push(candidate);
  }
  if (present.length !== 1) throw new Error(`expected exactly one host manifest, found ${present.length}`);
  const [{ platform, relativePath }] = present;
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, relativePath), 'utf8'));
  const release = JSON.parse(await readFile(path.join(pluginRoot, 'runtime/release.json'), 'utf8'));
  const runtimePackage = JSON.parse(await readFile(path.join(pluginRoot, 'runtime/package.json'), 'utf8'));
  const pluginBaseVersion = manifest.version.split('+', 1)[0];
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 20) || major >= 26) throw new Error(`unsupported Node ${process.version}; expected >=24.20 <26`);
  if (manifest.name !== 'daren-ui-distill') throw new Error('plugin name mismatch');
  if (manifest.skills !== './skills/') throw new Error('plugin skills path mismatch');
  if (pluginBaseVersion !== release.contracts.plugin || runtimePackage.version !== release.contracts.core) throw new Error('plugin/core/release version mismatch');
  for (const skill of skills) {
    const skillRoot = path.join(pluginRoot, 'skills', skill);
    const text = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    if (!text.startsWith('---\n') || !text.includes(`\nname: ${skill}\n`)) throw new Error(`invalid skill entry: ${skill}`);
    const metadata = JSON.parse(text.match(/^metadata:\s*(\{.*\})\s*$/m)?.[1] ?? 'null');
    if (!metadata) throw new Error(`missing skill metadata: ${skill}`);
    for (const field of ['required_references', 'optional_references']) {
      if (!Array.isArray(metadata[field])) throw new Error(`invalid ${field}: ${skill}`);
      for (const reference of metadata[field]) {
        if (typeof reference !== 'string' || !reference.startsWith('references/') || reference.split('/').includes('..')) {
          throw new Error(`non-portable ${field}: ${skill}:${reference}`);
        }
        await readFile(path.join(skillRoot, reference));
      }
    }
  }
  const launched = spawnSync(process.execPath, [path.join(pluginRoot, 'bin/daren-ui-distill.mjs'), 'check', '--json'], { encoding: 'utf8' });
  if (launched.status !== 0) throw new Error(`launcher check failed: ${launched.stderr.trim()}`);
  const facts = JSON.parse(launched.stdout);
  if (facts.version !== pluginBaseVersion) throw new Error('launcher version mismatch');
  const runtime = await import(path.join(pluginRoot, 'runtime/packages/core/index.mjs'));
  const adapter = await import(path.join(pluginRoot, 'runtime/adapters/local-folder/index.mjs'));
  if (typeof runtime.runBlueprintAdaptPipeline !== 'function' || typeof runtime.runAssetAdaptPipeline !== 'function'
    || typeof adapter.registerLocalAsset !== 'function' || typeof adapter.publishLocalAsset !== 'function') {
    throw new Error('runtime production pipelines are not public');
  }
  return { status: 'passed', platform, plugin: manifest.name, version: manifest.version, node: process.version, skills };
}

selfCheck().then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; },
);
