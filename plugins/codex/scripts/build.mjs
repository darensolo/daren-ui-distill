import { buildPluginDistribution } from '../../shared/scripts/build.mjs';

export async function buildCodexDistribution(outputDirectory) {
  return buildPluginDistribution('codex', outputDirectory);
}
