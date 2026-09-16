import { validateContract } from '../contracts/validate.mjs';
import { digestObject, sha256File } from './digest.mjs';
import { fail } from './errors.mjs';
import { resolveAuthorizedPath } from './scope.mjs';

const refKey = (ref) => `${ref.id}:${ref.digest}`;

function interactionLocator(ref) {
  const matched = /^interaction-(event|state)-([a-zA-Z0-9_-]+)$/.exec(ref.id);
  if (!matched) return null;
  try { return { kind: matched[1], id: Buffer.from(matched[2], 'base64url').toString('utf8') }; } catch { return null; }
}

function deriveObservation(evidenceRefs, evidence, entityKind, entityId) {
  const selected = new Set(evidenceRefs.map(refKey));
  const matches = evidence.filter((item) => {
    if (item.subject !== 'source' || !selected.has(refKey(item.ref))) return false;
    if (item.kind !== 'interaction') return true;
    const locator = interactionLocator(item.ref);
    return locator?.kind === entityKind && locator.id === entityId;
  });
  const observedKinds = entityKind === 'event'
    ? new Set(['interaction'])
    : new Set(['screenshot', 'accessibility', 'interaction', 'computed-style']);
  if (matches.some((item) => item.observation === 'observed' && observedKinds.has(item.kind))) return 'observed';
  if (matches.some((item) => ['observed', 'inferred'].includes(item.observation))) return 'inferred';
  if (matches.some((item) => item.observation === 'unsupported')) return 'unsupported';
  return 'unknown';
}

export function buildBlueprint({ capture, proposal, blueprintId, revision = 1, rights = 'unknown' }) {
  const captureResult = validateContract('capture-ir', capture);
  if (!captureResult.valid) fail('INVALID_CAPTURE', JSON.stringify(captureResult.errors));
  const evidenceKeys = new Set(capture.evidence.map((item) => refKey(item.ref)));
  const states = (proposal.states ?? []).map((state) => ({
    id: state.id,
    observation: deriveObservation(state.evidenceRefs ?? [], capture.evidence, 'state', state.id),
    evidenceRefs: structuredClone(state.evidenceRefs ?? []),
  }));
  const events = (proposal.events ?? []).map((event) => ({
    id: event.id,
    trigger: event.trigger,
    targetNodeId: event.targetNodeId,
    fromState: event.fromState,
    toState: event.toState,
    intent: event.intent,
    evidenceRefs: structuredClone(event.evidenceRefs ?? []),
  }));
  const blockingIssues = [];
  for (const state of proposal.requiredStates ?? []) {
    if (!states.some((candidate) => candidate.id === state)) blockingIssues.push(`missing-state:${state}`);
  }
  for (const event of proposal.requiredEvents ?? []) {
    if (!events.some((candidate) => candidate.id === event)) blockingIssues.push(`missing-event:${event}`);
  }
  const evidenceOwners = [
    ...(proposal.nodes ?? []).map((entry) => ['node', entry]),
    ...(proposal.layout ?? []).map((entry) => ['layout', entry]),
    ...(proposal.styles ?? []).map((entry) => ['style', entry]),
  ];
  for (const [kind, entry] of evidenceOwners) {
    if (!entry.evidenceRefs?.length || entry.evidenceRefs.some((ref) => !evidenceKeys.has(refKey(ref)))) blockingIssues.push(`missing-evidence:${kind}:${entry.id}`);
  }
  if (rights !== 'allowed') blockingIssues.push(`rights:${rights}`);

  const runtimeEvidenceGaps = [
    ...events.filter((event) => deriveObservation(event.evidenceRefs, capture.evidence, 'event', event.id) !== 'observed').map((event) => `event:${event.id}`),
    ...states.filter((state) => state.observation !== 'observed').map((state) => `state:${state.id}`),
  ].sort();
  const blueprint = {
    schemaVersion: '1.0.0',
    producerVersion: '0.1.0',
    blueprintId,
    revision,
    sourceRef: structuredClone(capture.source.ref),
    granularity: proposal.granularity,
    nodes: structuredClone(proposal.nodes ?? []),
    layout: structuredClone(proposal.layout ?? []),
    styles: structuredClone(proposal.styles ?? []),
    resources: structuredClone(proposal.resources ?? []),
    props: structuredClone(proposal.props ?? []),
    states,
    events,
    recipe: structuredClone(proposal.recipe),
    checkBaseline: structuredClone(proposal.checkBaseline),
    evidenceRefs: capture.evidence.map((item) => structuredClone(item.ref)),
    rights,
    blockingIssues: [...new Set(blockingIssues)].sort(),
    generationReady: blockingIssues.length === 0,
    runtimeVerification: runtimeEvidenceGaps.length === 0 ? 'verified' : 'unverified',
    runtimeEvidenceGaps,
  };
  blueprint.digest = digestObject(blueprint);
  const result = validateContract('blueprint', blueprint);
  if (!result.valid) fail('INVALID_BLUEPRINT', JSON.stringify(result.errors));
  return blueprint;
}

export async function resolveBlueprintRef(ref, { baseDir, readRoots }) {
  const file = await resolveAuthorizedPath(ref.relativePath, { baseDir, roots: readRoots });
  if (await sha256File(file) !== ref.digest) fail('BLUEPRINT_DIGEST_MISMATCH', 'blueprint reference digest does not match current bytes');
  return file;
}
