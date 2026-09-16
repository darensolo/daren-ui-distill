import { readFileSync } from 'node:fs';

import Ajv from 'ajv';

export const schemaNames = [
  'job',
  'capture-ir',
  'asset-package',
  'quality',
  'feedback',
  'adapters',
  'gap-inventory',
  'stage-execution',
  'blueprint',
  'authorization',
  'registration-receipt',
  'publication-receipt',
];

const stageOrder = ['dissect', 'replicate', 'adapt', 'register', 'publish'];
const legacyStages = new Map([
  ['replica', 'replicate'],
  ['library', 'register'],
  ['site', 'publish'],
]);

const readSchema = (name) => JSON.parse(
  readFileSync(new URL(`./${name}.schema.json`, import.meta.url), 'utf8'),
);

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false, strictTypes: false });
ajv.addSchema(readSchema('common'));

const validators = Object.fromEntries(schemaNames.map((name) => {
  const schema = readSchema(name);
  return [name, ajv.compile(schema)];
}));

const issue = (code, path, message) => ({ code, path, message });

const orderedStages = (stages) => stages.every(
  (stage, index) => index === 0 || stageOrder.indexOf(stages[index - 1]) < stageOrder.indexOf(stage),
);

function validateJob(value, errors) {
  if (!orderedStages(value.resolvedStages ?? [])) {
    errors.push(issue('INVALID_STAGE_ORDER', '/resolvedStages', 'production stages must be unique and ordered'));
  }

  const requested = value.requestedActions ?? [];
  if (value.operation === 'run') {
    if (requested.includes('inspect')) {
      errors.push(issue('ACTION_CONFLICT', '/requestedActions', 'inspect is not a production stage'));
    }
    for (const action of requested) {
      if (action !== 'inspect' && !(value.resolvedStages ?? []).includes(action)) {
        errors.push(issue('ACTION_STAGE_MISMATCH', '/resolvedStages', `${action} is missing from resolvedStages`));
      }
    }
    const first = value.resolvedStages?.[0];
    const hasInput = {
      dissect: Boolean(value.sourceRef || value.captureRef),
      replicate: Boolean(value.blueprintRef),
      adapt: Boolean(value.assetRef),
      register: Boolean(value.assetRef),
      publish: Boolean(value.assetRef),
    }[first];
    if (first && !hasInput) {
      errors.push(issue('MISSING_STAGE_INPUT', '/', `first stage ${first} lacks its required input reference`));
    }
    if (value.resolvedStages?.length === 1 && first === 'dissect' && value.repairPolicy !== 'none') {
      errors.push(issue('DISSECT_REPAIR_FORBIDDEN', '/repairPolicy', 'dissect-only runs cannot repair'));
    }
  } else if ((value.resolvedStages ?? []).length > 0) {
    errors.push(issue('ACTION_CONFLICT', '/resolvedStages', 'non-run operations cannot resolve production stages'));
  }
}

function validateAsset(value, errors) {
  if (value.deliveryStatus === 'delivered' && ['unknown', 'prohibited'].includes(value.rights)) {
    errors.push(issue('RIGHTS_BLOCK_DELIVERY', '/rights', 'unknown or prohibited rights cannot be delivered'));
  }
}

function validateQuality(value, errors) {
  if (value.kind !== 'fidelity-report' || value.qualityOutcome !== 'passed') return;
  if (value.freshness?.status !== 'fresh') {
    errors.push(issue('STALE_REPORT_PASS', '/freshness/status', 'a stale report cannot pass'));
  }
  for (const [index, check] of (value.checks ?? []).entries()) {
    if (check.status === 'passed' && check.evidenceRefs.length === 0) {
      errors.push(issue('EVIDENCELESS_PASS', `/checks/${index}/evidenceRefs`, 'passed checks require evidence'));
    }
    if (check.mandatory && !['passed', 'not-applicable'].includes(check.status)) {
      errors.push(issue('MANDATORY_CHECK_NOT_PASSED', `/checks/${index}/status`, 'mandatory checks must pass'));
    }
  }
  if ((value.findings ?? []).some((finding) => finding.status === 'open' && ['P0', 'P1'].includes(finding.severity))) {
    errors.push(issue('OPEN_BLOCKING_FINDING', '/findings', 'open P0 or P1 findings prevent a passed outcome'));
  }
  if (value.runtimeVerification === 'verified' && value.runtimeEvidenceGaps?.length) {
    errors.push(issue('RUNTIME_EVIDENCE_GAP', '/runtimeEvidenceGaps', 'verified runtime cannot retain evidence gaps'));
  }
}

function validateAdapter(value, errors) {
  const noEffectStatus = ['unsupported', 'blocked'];
  if (noEffectStatus.includes(value.check?.status)) {
    if (value.result?.status !== value.check.status) {
      errors.push(issue('ADAPTER_STATUS_MISMATCH', '/result/status', 'check and result statuses must agree'));
    }
    if (value.result?.receipt || value.result?.effectReceipts?.length) {
      errors.push(issue('UNSUPPORTED_EFFECT', '/result', 'unsupported or blocked adapters cannot emit effect receipts'));
    }
  }
}

function validateGapInventory(value, errors) {
  const ids = (value.items ?? []).map((item) => item.sampleId);
  if (new Set(ids).size !== ids.length) {
    errors.push(issue('DUPLICATE_SAMPLE', '/items', 'sample IDs must be unique'));
  }
}

function validateStageExecution(value, errors) {
  if (!orderedStages(value.resolvedStages ?? [])) {
    errors.push(issue('INVALID_STAGE_ORDER', '/resolvedStages', 'production stages must be ordered'));
  }
  const runKinds = (value.stageRuns ?? []).map((run) => run.kind);
  if (!orderedStages(runKinds)) {
    errors.push(issue('INVALID_STAGE_ORDER', '/stageRuns', 'stage runs must be ordered and unique'));
  }
  for (const [index, run] of (value.stageRuns ?? []).entries()) {
    if (['blocked', 'unsupported', 'skipped'].includes(run.status) && run.effectReceipts.length) {
      errors.push(issue('FORBIDDEN_STAGE_EFFECT', `/stageRuns/${index}/effectReceipts`, `${run.status} stages cannot have effects`));
    }
  }
  if (value.status === 'completed') {
    const complete = value.resolvedStages?.length === value.stageRuns?.length
      && value.stageRuns.every((run, index) => run.kind === value.resolvedStages[index] && run.status === 'succeeded');
    if (!complete) {
      errors.push(issue('FALSE_CHAIN_COMPLETION', '/status', 'completed requires every resolved stage to succeed'));
    }
  }
}

function validateBlueprint(value, errors) {
  const nodes = value.nodes ?? [];
  const layouts = new Set((value.layout ?? []).map((entry) => entry.id));
  const styles = new Set((value.styles ?? []).map((entry) => entry.id));
  const nodeIds = nodes.map((node) => node.id);
  const nodeSet = new Set(nodeIds);
  const states = new Set((value.states ?? []).map((state) => state.id));

  if (nodeSet.size !== nodeIds.length) {
    errors.push(issue('DUPLICATE_NODE', '/nodes', 'node IDs must be unique'));
  }
  if (nodes.filter((node) => node.parentId === null).length !== 1) {
    errors.push(issue('INVALID_ROOT_COUNT', '/nodes', 'blueprint must have exactly one root'));
  }
  for (const [index, node] of nodes.entries()) {
    if (node.parentId !== null && !nodeSet.has(node.parentId)) {
      errors.push(issue('DANGLING_NODE_REF', `/nodes/${index}/parentId`, 'parent node does not exist'));
    }
    if (node.parentId !== null) {
      const parent = nodes.find((candidate) => candidate.id === node.parentId);
      if (parent && !parent.children.includes(node.id)) {
        errors.push(issue('DANGLING_NODE_REF', `/nodes/${index}/parentId`, 'parent relation is not reciprocal'));
      }
    }
    if (!layouts.has(node.layoutRef) || !styles.has(node.styleRef)) {
      errors.push(issue('DANGLING_STYLE_REF', `/nodes/${index}`, 'layout or style reference does not exist'));
    }
    for (const child of node.children) {
      const childNode = nodes.find((candidate) => candidate.id === child);
      if (!childNode || childNode.parentId !== node.id) {
        errors.push(issue('DANGLING_NODE_REF', `/nodes/${index}/children`, 'child relation is not reciprocal'));
      }
    }
  }
  const root = nodes.find((node) => node.parentId === null);
  if (root) {
    const visits = new Map();
    const walk = (nodeId) => {
      visits.set(nodeId, (visits.get(nodeId) ?? 0) + 1);
      if (visits.get(nodeId) > 1) return;
      const node = nodes.find((candidate) => candidate.id === nodeId);
      for (const child of node?.children ?? []) walk(child);
    };
    walk(root.id);
    for (const [index, node] of nodes.entries()) {
      if (!visits.has(node.id)) errors.push(issue('UNREACHABLE_NODE', `/nodes/${index}`, 'every node must be reachable from the single root'));
      else if (visits.get(node.id) !== 1) errors.push(issue('MULTIPLE_NODE_PATHS', `/nodes/${index}`, 'every node must be reachable exactly once'));
    }
  }
  for (const [index, event] of (value.events ?? []).entries()) {
    if (!nodeSet.has(event.targetNodeId) || !states.has(event.fromState) || !states.has(event.toState)) {
      errors.push(issue('DANGLING_EVENT_REF', `/events/${index}`, 'event references an unknown node or state'));
    }
  }
  const unsafeStyle = (value.styles ?? []).some((style) => Object.values(style.properties).some(
    (entry) => typeof entry === 'string' && /javascript\s*:|expression\s*\(/i.test(entry),
  ));
  if (unsafeStyle) errors.push(issue('EXECUTABLE_STYLE', '/styles', 'executable style values are forbidden'));

  if (value.generationReady) {
    const insufficientEvidence = nodes.some((node) => node.evidenceRefs.length === 0)
      || value.layout.some((entry) => entry.evidenceRefs.length === 0)
      || value.styles.some((entry) => entry.evidenceRefs.length === 0)
      || value.states.some((state) => ['unknown', 'unsupported'].includes(state.observation));
    if (value.blockingIssues.length || ['unknown', 'prohibited'].includes(value.rights) || insufficientEvidence) {
      errors.push(issue('FALSE_GENERATION_READY', '/generationReady', 'generationReady is derived from evidence, structure, rights, and blockers'));
    }
  }
}

const semanticValidators = {
  job: validateJob,
  'asset-package': validateAsset,
  quality: validateQuality,
  adapters: validateAdapter,
  'gap-inventory': validateGapInventory,
  'stage-execution': validateStageExecution,
  blueprint: validateBlueprint,
};

export function validateContract(name, value) {
  const validator = validators[name];
  if (!validator) {
    return { valid: false, errors: [issue('UNKNOWN_CONTRACT', '/', `unknown contract: ${name}`)] };
  }

  const validSchema = validator(value);
  const errors = validSchema ? [] : validator.errors.map((error) => issue(
    'SCHEMA_INVALID',
    error.instancePath || '/',
    error.message ?? 'schema validation failed',
  ));
  if (validSchema) semanticValidators[name]?.(value, errors);
  return { valid: errors.length === 0, errors };
}

export function normalizeLegacyStages(stages, { sourceVersion }) {
  if (!Array.isArray(stages)) {
    const error = new TypeError('stages must be an array');
    error.code = 'INVALID_STAGE_LIST';
    throw error;
  }
  const allowLegacy = /^0\./.test(sourceVersion);
  const warnings = [];
  const normalized = stages.map((stage) => {
    if (stageOrder.includes(stage)) return stage;
    if (legacyStages.has(stage)) {
      if (!allowLegacy) {
        const error = new Error(`legacy stage ${stage} is not accepted by ${sourceVersion}`);
        error.code = 'LEGACY_STAGE_NOT_ALLOWED';
        throw error;
      }
      const replacement = legacyStages.get(stage);
      warnings.push(`legacy-stage:${stage}->${replacement}`);
      return replacement;
    }
    const error = new Error(`unknown stage ${stage}`);
    error.code = 'UNKNOWN_STAGE';
    throw error;
  });
  if (new Set(normalized).size !== normalized.length) {
    const error = new Error('legacy and canonical stages resolve to a duplicate');
    error.code = 'DUPLICATE_STAGE';
    throw error;
  }
  if (!orderedStages(normalized)) {
    const error = new Error('stages are out of order');
    error.code = 'INVALID_STAGE_ORDER';
    throw error;
  }
  return { stages: normalized, warnings };
}
