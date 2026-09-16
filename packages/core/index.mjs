import { materializeAsset } from './artifact.mjs';
import { generateAdaptedAsset, generateSourceReplica } from './generator.mjs';
import { mapBlueprintToDaren } from './mapper.mjs';
import { assertRelativePath } from './scope.mjs';

export { materializeAsset, reconcileMaterialization } from './artifact.mjs';
export { buildBlueprint, resolveBlueprintRef } from './blueprint.mjs';
export { captureSource } from './capture.mjs';
export { compileCapture } from './compiler.mjs';
export { canonicalJson, digestObject, sha256Bytes, sha256File } from './digest.mjs';
export { DistillError } from './errors.mjs';
export { generateAdaptedAsset, generateSourceReplica } from './generator.mjs';
export { createJobStore } from './job-store.mjs';
export { optimizeAsset, optimizeAssetWithJournal } from './optimizer.mjs';
export { projectBlueprintMarkdown } from './projection.mjs';
export { auditAsset, isReportFresh, verifyAuditEvidence } from './quality.mjs';
export { assertRelativePath, resolveAuthorizedPath } from './scope.mjs';
export { executeStages } from './stage-runner.mjs';
export { mapBlueprintToDaren } from './mapper.mjs';
export { publicationApprovalInputDigest } from './delivery-utils.mjs';
export { createDeliveryAuthorization } from './authorization.mjs';

async function materializeBundle(bundle, { baseDir, targetRoot, expectedFiles = {}, extraFiles = [] }) {
  const manifestContent = `${JSON.stringify(bundle.assetPackage, null, 2)}\n`;
  const materialization = await materializeAsset({
    ...bundle,
    files: [...bundle.files, { relativePath: 'asset-package.json', content: manifestContent }, ...extraFiles],
  }, { baseDir, writeRoots: [targetRoot], targetRoot, expectedFiles });
  return { bundle, materialization };
}

export async function runBlueprintPipeline({ blueprint, baseDir, outDir, expectedFiles = {} }) {
  assertRelativePath(outDir);
  const bundle = generateSourceReplica(blueprint);
  return materializeBundle(bundle, { baseDir, targetRoot: outDir, expectedFiles });
}

export async function runAssetAdaptPipeline({ sourceBundle, baseDir, outDir, targetRef, expectedFiles = {} }) {
  assertRelativePath(outDir);
  if (!sourceBundle?.assetPackage || !sourceBundle?.blueprint) throw new TypeError('adapt-only requires an existing AssetPackage bundle with its retained Blueprint');
  const mapping = mapBlueprintToDaren(sourceBundle.blueprint, { targetRef });
  const bundle = generateAdaptedAsset(sourceBundle, mapping);
  const report = { schemaVersion: '1.0.0', kind: 'adaptation-report', sourceDigest: sourceBundle.bundleDigest, adaptedDigest: bundle.bundleDigest, targetRef, mapping: mapping.mapping, gaps: mapping.gaps };
  return { ...(await materializeBundle(bundle, { baseDir, targetRoot: outDir, expectedFiles, extraFiles: [{ relativePath: 'adaptation-report.json', content: `${JSON.stringify(report, null, 2)}\n` }] })), report };
}

export async function runBlueprintAdaptPipeline({ blueprint, baseDir, outDir, targetRef }) {
  assertRelativePath(outDir);
  const source = await runBlueprintPipeline({ blueprint, baseDir, outDir: `${outDir}/source-replica` });
  const adapted = await runAssetAdaptPipeline({ sourceBundle: source.bundle, baseDir, outDir: `${outDir}/adapted`, targetRef });
  return { source, adapted, report: adapted.report };
}
