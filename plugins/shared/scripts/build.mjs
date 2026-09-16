import { access, chmod, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as bundle } from 'esbuild';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const sharedRoot = path.resolve(scriptRoot, '..');
const pluginsRoot = path.resolve(sharedRoot, '..');
const repoRoot = path.resolve(pluginsRoot, '..');
const requireFromTool = createRequire(path.join(repoRoot, 'package.json'));

export const packagedSkills = [
  'design-asset-publisher',
  'design-asset-registrar',
  'design-system-adapter',
  'ui-audit-repair',
  'ui-decomposer',
  'ui-replica-engine',
];

const platforms = {
  codex: { manifestDirectory: '.codex-plugin', verifyReviewedSkillProjection: false },
  qoder: { manifestDirectory: '.qoder-plugin', verifyReviewedSkillProjection: false },
};

async function absent(target) {
  try { await access(target); return false; } catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}

export async function buildPluginDistribution(platform, outputDirectory) {
  const config = platforms[platform];
  if (!config) throw new Error(`unsupported distribution target: ${platform}`);
  const distributionRoot = path.join(pluginsRoot, platform);
  const output = path.resolve(outputDirectory);
  const repositoryDist = path.join(repoRoot, 'dist');
  if (output === '/' || output === repoRoot || (output.startsWith(`${repoRoot}${path.sep}`) && !output.startsWith(`${repositoryDist}${path.sep}`))) {
    throw new Error('output must be a new directory outside the repository');
  }
  if (!await absent(output)) throw new Error(`output already exists: ${output}`);
  await mkdir(output, { recursive: true });

  await cp(path.join(distributionRoot, config.manifestDirectory), path.join(output, config.manifestDirectory), { recursive: true });
  await cp(path.join(sharedRoot, 'bin'), path.join(output, 'bin'), { recursive: true });
  await cp(path.join(distributionRoot, 'README.md'), path.join(output, 'README.md'));
  await mkdir(path.join(output, 'scripts'), { recursive: true });
  await cp(path.join(sharedRoot, 'scripts/self-check.mjs'), path.join(output, 'scripts/self-check.mjs'));

  for (const skill of packagedSkills) {
    const canonicalRoot = path.join(repoRoot, 'skills', skill);
    if (config.verifyReviewedSkillProjection) {
      const canonicalSkill = await readFile(path.join(canonicalRoot, 'SKILL.md'));
      const projectedSkill = await readFile(path.join(distributionRoot, 'skills', skill, 'SKILL.md'));
      if (!canonicalSkill.equals(projectedSkill)) throw new Error(`packaged skill drift: ${skill}`);
    }
    await cp(canonicalRoot, path.join(output, 'skills', skill), { recursive: true, dereference: true });
  }

  await mkdir(path.join(output, 'runtime/packages'), { recursive: true });
  for (const directory of ['cli', 'core', 'contracts']) {
    await cp(path.join(repoRoot, 'packages', directory), path.join(output, 'runtime/packages', directory), { recursive: true, dereference: true });
  }
  await cp(path.join(repoRoot, 'adapters/local-folder'), path.join(output, 'runtime/adapters/local-folder'), { recursive: true, dereference: true });
  for (const file of ['package.json', 'release.json']) await cp(path.join(repoRoot, file), path.join(output, 'runtime', file));

  // Qoder deliberately omits node_modules when importing a local plugin. Bundle
  // the production validator into a host-neutral runtime directory so the
  // installed cache remains executable on both supported agent platforms.
  const packageManifest = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  const productionDependencies = Object.keys(packageManifest.dependencies ?? {}).sort();
  if (productionDependencies.join(',') !== 'ajv') throw new Error('plugin bundler must explicitly handle every production dependency');
  const vendorDirectory = path.join(output, 'runtime/vendor');
  await mkdir(vendorDirectory, { recursive: true });
  await bundle({
    entryPoints: [requireFromTool.resolve('ajv')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    outfile: path.join(vendorDirectory, 'ajv.mjs'),
    logLevel: 'silent',
  });
  const validatorPath = path.join(output, 'runtime/packages/contracts/validate.mjs');
  const validator = await readFile(validatorPath, 'utf8');
  const bundledValidator = validator.replace("import Ajv from 'ajv';", "import Ajv from '../../vendor/ajv.mjs';");
  if (bundledValidator === validator) throw new Error('Ajv import projection was not applied');
  await writeFile(validatorPath, bundledValidator);
  await chmod(path.join(output, 'bin/daren-ui-distill.mjs'), 0o755);

  return { status: 'built', platform, output, skills: packagedSkills, productionDependencies };
}
