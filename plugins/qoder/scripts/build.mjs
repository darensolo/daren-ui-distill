import { buildPluginDistribution } from '../../shared/scripts/build.mjs';

export async function buildQoderDistribution(outputDirectory) {
  return buildPluginDistribution('qoder', outputDirectory);
}
