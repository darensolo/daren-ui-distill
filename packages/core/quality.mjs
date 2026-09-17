import { validateContract } from '../contracts/validate.mjs';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, digestObject, sha256Bytes } from './digest.mjs';
import { fail } from './errors.mjs';
import { generateAdaptedAsset, generateSourceReplica } from './generator.mjs';
import { assertRelativePath } from './scope.mjs';

const na = (reason) => ({ status: 'not-applicable', reason });
const contextDigests = (...contexts) => contexts.flatMap((context) => context?.status === 'available' ? [context.ref.digest] : []);

function evidencePayload(bundle, id, status) {
  return { schemaVersion: '1.0.0', kind: 'inline-audit-evidence', subjectDigest: bundle.bundleDigest, checkId: id, status };
}

function auditEvidence(bundle, id, status) {
  const payload = evidencePayload(bundle, id, status);
  const digest = digestObject(payload);
  const encoded = Buffer.from(canonicalJson(payload), 'utf8').toString('base64url');
  return { kind: 'inline-evidence', id: `audit-${id}`, revision: 1, digest, relativePath: `inline-evidence/${encoded}.json` };
}

export function verifyAuditEvidence(bundle, check, ref) {
  if (ref?.kind !== 'inline-evidence') return false;
  const matched = /^inline-evidence\/([a-zA-Z0-9_-]+)\.json$/.exec(ref.relativePath);
  if (!matched) return false;
  try {
    const embedded = JSON.parse(Buffer.from(matched[1], 'base64url').toString('utf8'));
    const expected = evidencePayload(bundle, check.id, check.status);
    return canonicalJson(embedded) === canonicalJson(expected) && ref.digest === digestObject(embedded);
  } catch {
    return false;
  }
}

function fileIntegrity(bundle) {
  const bundlePaths = bundle.files.map((file) => file.relativePath);
  const manifestPaths = bundle.assetPackage.files.map((file) => file.relativePath);
  const uniqueBundle = new Set(bundlePaths);
  const uniqueManifest = new Set(manifestPaths);
  const sameSet = uniqueBundle.size === bundlePaths.length
    && uniqueManifest.size === manifestPaths.length
    && uniqueBundle.size === uniqueManifest.size
    && [...uniqueBundle].every((path) => uniqueManifest.has(path));
  const digestsMatch = sameSet && bundle.files.every((file) => {
    const entry = bundle.assetPackage.files.find((candidate) => candidate.relativePath === file.relativePath);
    return entry?.digest === sha256Bytes(Buffer.from(file.content));
  });
  return { sameSet, digestsMatch };
}

const within = (candidate, root) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

function verifyContextArtifact(name, context, artifact) {
  if (context.status !== 'available') return null;
  if (!artifact) fail('MISSING_CONTEXT_ARTIFACT', `${name} requires verifiable artifact bytes`);
  let bytes;
  if (typeof artifact.content === 'string') bytes = Buffer.from(artifact.content);
  else {
    try {
      const relativePath = assertRelativePath(artifact.relativePath ?? context.ref.relativePath);
      if (relativePath !== context.ref.relativePath) fail('CONTEXT_PATH_MISMATCH', `${name} path differs from its ContextRef`);
      const base = realpathSync(artifact.baseDir);
      const file = realpathSync(path.resolve(base, relativePath));
      const roots = (artifact.readRoots ?? []).map((root) => realpathSync(path.resolve(base, assertRelativePath(root))));
      if (!within(file, base) || roots.some((root) => !within(root, base)) || !roots.length || !roots.some((root) => within(file, root))) fail('SCOPE_ESCAPE', `${name} artifact is outside authorized roots`);
      bytes = readFileSync(file);
    } catch (error) {
      if (error?.code && !['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
      fail('CONTEXT_ARTIFACT_UNAVAILABLE', `${name} artifact does not exist`);
    }
  }
  if (sha256Bytes(bytes) !== context.ref.digest) fail('CONTEXT_DIGEST_MISMATCH', `${name} bytes do not match its ContextRef digest`);
  return bytes;
}

function baselineAssertionsMatch(bundle, bytes) {
  let baseline;
  try { baseline = JSON.parse(bytes.toString('utf8')); } catch { return { structure: false, visual: false }; }
  const assertions = baseline?.assertions;
  if (baseline?.schemaVersion !== '1.0.0' || baseline?.kind !== 'ui-baseline' || !assertions) return { structure: false, visual: false };
  const blueprint = bundle.blueprint;
  const component = bundle.files.find((file) => file.relativePath === 'component.js')?.content;
  const match = /^const blueprint=(.+);\nconst tags=/m.exec(component ?? '');
  if (!blueprint || !match) return { structure: false, visual: false };
  let portable;
  try { portable = JSON.parse(match[1]); } catch { return { structure: false, visual: false }; }
  let expectedBundle;
  try {
    const sourceBundle = generateSourceReplica(blueprint);
    expectedBundle = bundle.assetPackage.variant === 'adapted'
      ? generateAdaptedAsset(sourceBundle, { targetRef: bundle.assetPackage.targetRef, mapping: bundle.assetPackage.mapping, gaps: [] })
      : sourceBundle;
  } catch { return { structure: false, visual: false }; }
  const expectedComponent = expectedBundle.files.find((file) => file.relativePath === 'component.js')?.content;
  const expectedStyles = expectedBundle.files.find((file) => file.relativePath === 'styles.css')?.content;
  const styles = bundle.files.find((file) => file.relativePath === 'styles.css')?.content;
  const actualNodes = blueprint.nodes.map((node) => ({ id: node.id, parentId: node.parentId, kind: node.kind, children: node.children }));
  const actualStates = blueprint.states.map((state) => state.id);
  const actualEvents = blueprint.events.map((event) => ({ id: event.id, targetNodeId: event.targetNodeId, fromState: event.fromState, toState: event.toState, intent: event.intent }));
  const portableEvents = portable.events.map((event) => ({ id: event.id, targetNodeId: event.targetNodeId, fromState: event.fromState, toState: event.toState, intent: event.intent }));
  const structure = canonicalJson(assertions.nodes) === canonicalJson(actualNodes)
    && canonicalJson(assertions.states) === canonicalJson(actualStates)
    && canonicalJson(assertions.events) === canonicalJson(actualEvents)
    && canonicalJson(portable.nodes.map((node) => ({ id: node.id, parentId: node.parentId, kind: node.kind, children: node.children }))) === canonicalJson(actualNodes)
    && portable.initialState === actualStates[0]
    && canonicalJson(portableEvents) === canonicalJson(actualEvents)
    && component === expectedComponent;
  const visual = canonicalJson(assertions.visual) === canonicalJson({
    nodeBindings: blueprint.nodes.map((node) => ({ id: node.id, layoutRef: node.layoutRef, styleRef: node.styleRef })),
    layout: blueprint.layout.map(({ id, display, values }) => ({ id, display, values })),
    styles: blueprint.styles.map(({ id, properties }) => ({ id, properties })),
    resources: blueprint.resources,
  }) && styles === expectedStyles;
  return { structure, visual };
}

const emptyComparison = (reason) => ({
  status: 'not-comparable', reason,
  resolved: [], persisting: [], new: [], notRechecked: [],
});

const findingCheckId = (finding) => finding.checkId ?? finding.id?.replace(/^finding-/, '');

export function compareAuditReports(previousReport, currentReport) {
  if (previousReport?.freshness?.status !== 'fresh') return emptyComparison('previous-report-not-fresh');
  if (previousReport?.subjectRef?.kind !== currentReport?.subjectRef?.kind
    || previousReport?.subjectRef?.id !== currentReport?.subjectRef?.id) return emptyComparison('subject-changed');
  if (previousReport?.profile !== currentReport?.profile) return emptyComparison('profile-changed');
  if (previousReport?.checksetDigest !== currentReport?.checksetDigest) return emptyComparison('checkset-changed');

  const previousFindings = (previousReport.findings ?? []).filter((finding) => finding.status === 'open');
  const currentFindings = (currentReport.findings ?? []).filter((finding) => finding.status === 'open');
  const previousIds = previousFindings.map((finding) => finding.id);
  const currentIds = currentFindings.map((finding) => finding.id);
  if (new Set(previousIds).size !== previousIds.length || new Set(currentIds).size !== currentIds.length) {
    return emptyComparison('duplicate-finding-id');
  }

  const currentById = new Map(currentFindings.map((finding) => [finding.id, finding]));
  const previousById = new Map(previousFindings.map((finding) => [finding.id, finding]));
  const currentChecks = new Map((currentReport.checks ?? []).map((check) => [check.id, check.status]));
  const resolved = [];
  const persisting = [];
  const notRechecked = [];
  for (const finding of previousFindings) {
    if (currentById.has(finding.id)) {
      persisting.push(finding.id);
      continue;
    }
    const status = currentChecks.get(findingCheckId(finding));
    if (status === 'passed') resolved.push(finding.id);
    else notRechecked.push(finding.id);
  }
  const introduced = currentFindings.filter((finding) => !previousById.has(finding.id)).map((finding) => finding.id);
  return {
    status: 'compared',
    previousSubjectRef: structuredClone(previousReport.subjectRef),
    resolved: resolved.sort(),
    persisting: persisting.sort(),
    new: introduced.sort(),
    notRechecked: notRechecked.sort(),
  };
}

export function auditAsset({
  bundle,
  profile = 'common',
  baselineContext = na('common profile has no external baseline'),
  targetContext = na('profile has no design target'),
  allowedDeltaContext = na('profile has no allowed-delta contract'),
  contextArtifacts = {},
  checksetDigest,
  previousReport,
}) {
  if (profile === 'source-fidelity' && baselineContext.status !== 'available') fail('MISSING_BASELINE', 'source-fidelity requires an available source baseline');
  if (profile === 'design-adaptation' && [baselineContext, targetContext, allowedDeltaContext].some((context) => context.status !== 'available')) fail('MISSING_TARGET_CONTEXT', 'design-adaptation requires available baseline, target, and allowed-delta contexts');
  let baselineBytes = null;
  if (profile !== 'common') {
    baselineBytes = verifyContextArtifact('baseline', baselineContext, contextArtifacts.baseline);
    verifyContextArtifact('target', targetContext, contextArtifacts.target);
    verifyContextArtifact('allowedDelta', allowedDeltaContext, contextArtifacts.allowedDelta);
  }
  const manifest = validateContract('asset-package', bundle.assetPackage);
  const integrity = fileIntegrity(bundle);
  const portable = bundle.assetPackage.dependencies.length === 0 && bundle.files.every((file) => !/https?:\/\/|node_modules|daren-design\/src/.test(file.content));
  const baselineMatches = profile === 'common' ? { structure: true, visual: true } : baselineAssertionsMatch(bundle, baselineBytes);
  const checks = [
    ['asset-contract', manifest.valid ? 'passed' : 'failed', true],
    ['file-set', integrity.sameSet ? 'passed' : 'failed', true],
    ['file-digests', integrity.digestsMatch ? 'passed' : 'failed', true],
    ['portable-dependencies', portable ? 'passed' : 'failed', true],
    ['baseline-assertions', baselineMatches.structure ? 'passed' : 'failed', profile !== 'common'],
    ['baseline-visual-contract', baselineMatches.visual ? 'passed' : 'failed', profile !== 'common'],
    ['runtime-evidence', bundle.runtimeVerification === 'verified' ? 'passed' : 'unknown', profile === 'source-fidelity'],
  ].map(([id, status, mandatory]) => ({ id, status, mandatory, evidenceRefs: ['passed', 'failed'].includes(status) ? [auditEvidence(bundle, id, status)] : [] }));
  const findings = checks.filter((check) => check.status === 'failed').map((check) => ({ id: `finding-${check.id}`, checkId: check.id, severity: 'P1', status: 'open', subjectRef: { kind: 'asset-package', id: bundle.assetPackage.assetId, revision: bundle.assetPackage.revision, digest: bundle.bundleDigest, relativePath: `assets/${bundle.assetPackage.assetId}/asset-package.json` } }));
  const qualityOutcome = checks.some((check) => check.status === 'failed') ? 'blocked'
    : checks.some((check) => check.mandatory && ['unknown', 'unsupported'].includes(check.status)) ? 'residual' : 'passed';
  const inputDigests = [...new Set([bundle.bundleDigest, checksetDigest, ...contextDigests(baselineContext, targetContext, allowedDeltaContext)])];
  const report = {
    schemaVersion: '1.0.0', kind: 'fidelity-report', mode: 'audit-only',
    subjectRef: { kind: 'asset-package', id: bundle.assetPackage.assetId, revision: bundle.assetPackage.revision, digest: bundle.bundleDigest, relativePath: `assets/${bundle.assetPackage.assetId}/asset-package.json` },
    profile,
    profileRef: { kind: 'quality-profile', id: profile, revision: 1, digest: digestObject({ profile }), relativePath: `profiles/${profile}.json` },
    checksetDigest, baselineContext, targetContext, allowedDeltaContext,
    freshness: { status: 'fresh', inputDigests }, checks, findings, qualityOutcome,
    runtimeVerification: bundle.runtimeVerification ?? 'unverified',
    runtimeEvidenceGaps: structuredClone(bundle.runtimeEvidenceGaps ?? []),
  };
  if (previousReport) report.comparison = compareAuditReports(previousReport, report);
  const result = validateContract('quality', report);
  if (!result.valid) fail('INVALID_QUALITY_REPORT', JSON.stringify(result.errors));
  return report;
}

export function isReportFresh(report, { bundle, checksetDigest, baselineContext, targetContext, allowedDeltaContext }) {
  const expected = [...new Set([bundle.bundleDigest, checksetDigest, ...contextDigests(baselineContext, targetContext, allowedDeltaContext)])].sort();
  return report.freshness?.status === 'fresh'
    && report.subjectRef?.digest === bundle.bundleDigest
    && JSON.stringify([...report.freshness.inputDigests].sort()) === JSON.stringify(expected);
}
