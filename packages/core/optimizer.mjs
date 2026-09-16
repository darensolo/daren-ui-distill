import { validateContract } from '../contracts/validate.mjs';
import { digestObject, sha256Bytes } from './digest.mjs';
import { fail } from './errors.mjs';
import { isReportFresh } from './quality.mjs';
import { assertRelativePath } from './scope.mjs';

export function optimizeAsset({ bundle, report, selectedFindingIds, patches, consumedBudget, reaudit }) {
  if (consumedBudget >= 3) fail('BUDGET_EXHAUSTED', 'the job has consumed its three repair rounds');
  const inputContract = validateContract('quality', report);
  if (!inputContract.valid) fail('INVALID_QUALITY_REPORT', JSON.stringify(inputContract.errors));
  if (!isReportFresh(report, {
    bundle, checksetDigest: report.checksetDigest, baselineContext: report.baselineContext,
    targetContext: report.targetContext, allowedDeltaContext: report.allowedDeltaContext,
  })) fail('STALE_REPORT', 'repair requires a fresh report for the current asset revision');
  const open = new Set((report.findings ?? []).filter((finding) => finding.status === 'open').map((finding) => finding.id));
  if (selectedFindingIds.some((id) => !open.has(id))) fail('UNKNOWN_FINDING', 'repair scope includes a missing or closed finding');
  if (patches.some((patch) => !selectedFindingIds.includes(patch.findingId))) fail('PATCH_OUT_OF_SCOPE', 'patch is not bound to a selected finding');
  const candidate = structuredClone(bundle);
  for (const patch of patches) {
    assertRelativePath(patch.relativePath);
    const file = candidate.files.find((entry) => entry.relativePath === patch.relativePath);
    if (!file) fail('PATCH_TARGET_MISSING', `patch file is missing: ${patch.relativePath}`);
    const pieces = file.content.split(patch.search);
    if (!patch.search || pieces.length !== 2) fail('PATCH_PRECONDITION_FAILED', 'patch search must match exactly once');
    file.content = `${pieces[0]}${patch.replace}${pieces[1]}`;
  }
  candidate.assetPackage.revision += 1;
  candidate.assetPackage.files = candidate.files.map((file) => ({ relativePath: file.relativePath, digest: sha256Bytes(Buffer.from(file.content)) }));
  const contract = validateContract('asset-package', candidate.assetPackage);
  if (!contract.valid) fail('INVALID_ASSET_PACKAGE', JSON.stringify(contract.errors));
  candidate.bundleDigest = digestObject({ ...candidate, bundleDigest: undefined });
  const regressionReport = reaudit(candidate);
  const regressionContract = validateContract('quality', regressionReport);
  if (!regressionContract.valid) fail('INVALID_REAUDIT', JSON.stringify(regressionContract.errors));
  const contextKeys = ['baselineContext', 'targetContext', 'allowedDeltaContext'];
  if (regressionReport.kind !== 'fidelity-report'
    || regressionReport.profile !== report.profile
    || regressionReport.checksetDigest !== report.checksetDigest
    || contextKeys.some((key) => digestObject(regressionReport[key]) !== digestObject(report[key]))) {
    fail('REAUDIT_SCOPE_DRIFT', 're-audit must preserve the C4 profile, checkset, and context bindings');
  }
  if (!isReportFresh(regressionReport, {
    bundle: candidate,
    checksetDigest: report.checksetDigest,
    baselineContext: report.baselineContext,
    targetContext: report.targetContext,
    allowedDeltaContext: report.allowedDeltaContext,
  })) fail('STALE_REAUDIT', 're-audit must be fresh and bound to the candidate digest');
  const blocking = regressionReport.findings.some((finding) => finding.status === 'open' && ['P0', 'P1'].includes(finding.severity));
  const mandatoryIncomplete = regressionReport.checks.some((check) => check.mandatory && !['passed', 'not-applicable'].includes(check.status));
  const accepted = regressionReport.qualityOutcome === 'passed' && !blocking && !mandatoryIncomplete;
  return {
    accepted,
    bundle: accepted ? candidate : bundle,
    candidate: accepted ? null : candidate,
    report: regressionReport,
    consumedBudget: consumedBudget + 1,
    terminalReason: accepted ? 'passed' : 'residual',
  };
}

export async function optimizeAssetWithJournal({ store, jobId, operationId, ...request }) {
  const recovered = await store.recover(jobId);
  await store.beginOptimizeAttempt(jobId, operationId, {
    bundleDigest: request.bundle.bundleDigest,
    reportDigest: digestObject(request.report),
    selectedFindingIds: request.selectedFindingIds,
    patchDigest: digestObject(request.patches),
  });
  const result = optimizeAsset({ ...request, consumedBudget: recovered.consumedBudget });
  await store.append(jobId, {
    type: result.accepted ? 'optimize-accepted' : 'optimize-rejected',
    operationId: `${operationId}:result`,
    payload: { candidateDigest: result.accepted ? result.bundle.bundleDigest : result.candidate.bundleDigest, reportDigest: digestObject(result.report) },
  });
  return result;
}
