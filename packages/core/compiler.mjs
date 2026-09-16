import { validateContract } from '../contracts/validate.mjs';
import { fail } from './errors.mjs';

const eventObservedKinds = new Set(['interaction']);

function eventObservation(event, evidence) {
  if (event.observation !== 'observed') return event.observation;
  const referenced = new Set((event.evidenceRefs ?? []).map((ref) => `${ref.id}:${ref.digest}`));
  const hasRuntimeObservation = evidence.some((item) => item.subject === 'source'
    && referenced.has(`${item.ref.id}:${item.ref.digest}`)
    && eventObservedKinds.has(item.kind) && item.observation === 'observed');
  return hasRuntimeObservation ? 'observed' : 'inferred';
}

export function compileCapture(capture, proposal = {}) {
  const captureResult = validateContract('capture-ir', capture);
  if (!captureResult.valid || capture.kind !== 'capture-bundle') fail('INVALID_CAPTURE', JSON.stringify(captureResult.errors));
  const ir = {
    schemaVersion: '1.0.0',
    kind: 'ui-replica-ir',
    source: capture.source,
    sourceBuildContext: capture.sourceBuildContext,
    archiveContext: capture.archiveContext,
    evidence: structuredClone(capture.evidence),
    provenance: structuredClone(capture.provenance),
    nodes: structuredClone(proposal.nodeRefs ?? []),
    states: structuredClone(proposal.states ?? []),
    events: (proposal.events ?? []).map((event) => ({
      id: event.id,
      trigger: event.trigger,
      observation: eventObservation(event, capture.evidence),
    })),
    resources: structuredClone(capture.resources ?? []),
  };
  const result = validateContract('capture-ir', ir);
  if (!result.valid) fail('INVALID_CAPTURE_IR', JSON.stringify(result.errors));
  return ir;
}
