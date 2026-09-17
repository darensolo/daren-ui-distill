import { normalizeLegacyStages } from '../contracts/validate.mjs';
import { DistillError } from '../core/errors.mjs';

const valueFlags = new Set([
  '--base-dir', '--input', '--input-kind', '--read-root', '--reproduction-depth',
  '--source-version', '--stages', '--target-design-system', '--out-dir', '--job-root',
  '--job-id', '--operation-id', '--library-root', '--site-root',
]);
const booleanFlags = new Set(['--json']);
const commands = new Set(['check', 'capture', 'compile', 'dissect', 'run', 'audit', 'optimize', 'authorize', 'resume']);

function argumentError(code, message) {
  throw new DistillError(code, message);
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!commands.has(command)) argumentError('UNKNOWN_COMMAND', `unknown or missing command: ${command ?? ''}`);
  const options = {
    command,
    baseDir: process.cwd(),
    input: null,
    inputKind: null,
    readRoots: [],
    reproductionDepth: null,
    sourceVersion: '1.0.0',
    stages: null,
    targetDesignSystem: null,
    outDir: null,
    jobRoot: null,
    jobId: null,
    operationId: null,
    libraryRoot: '.ui-distiller/library',
    siteRoot: '.ui-distiller/site',
    keepSourceReplica: true,
    json: false,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (booleanFlags.has(flag)) {
      options[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = true;
      continue;
    }
    if (flag === '--keep-source-replica') {
      const value = rest[++index];
      if (!['true', 'false'].includes(value)) argumentError('INVALID_ARGUMENT', '--keep-source-replica expects true or false');
      options.keepSourceReplica = value === 'true';
      continue;
    }
    if (!valueFlags.has(flag)) argumentError('UNKNOWN_ARGUMENT', `unknown argument: ${flag}`);
    const value = rest[++index];
    if (!value || value.startsWith('--')) argumentError('MISSING_ARGUMENT_VALUE', `${flag} requires a value`);
    const key = flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (flag === '--read-root') options.readRoots.push(value);
    else options[key] = value;
  }
  return options;
}

function depthStages(options) {
  if (!['blueprint', 'source', 'capture'].includes(options.inputKind)) argumentError('MISSING_INPUT_KIND', 'replica compatibility requires source, capture, or blueprint input-kind');
  if (!['source-only', 'source+adapt'].includes(options.reproductionDepth)) argumentError('INVALID_REPRODUCTION_DEPTH', `unsupported reproduction depth: ${options.reproductionDepth}`);
  if (!options.keepSourceReplica) argumentError('SOURCE_REPLICA_REQUIRED', 'DH05 MVP always preserves Source Replica');
  if (options.reproductionDepth === 'source-only' && options.targetDesignSystem !== 'none') argumentError('ACTION_CONFLICT', 'source-only requires targetDesignSystem=none');
  if (options.reproductionDepth === 'source+adapt' && options.targetDesignSystem !== 'daren') argumentError('ACTION_CONFLICT', 'source+adapt requires targetDesignSystem=daren');
  const prefix = options.inputKind === 'blueprint' ? [] : ['dissect'];
  return [...prefix, 'replicate', ...(options.reproductionDepth === 'source+adapt' ? ['adapt'] : [])];
}

export function resolveActionPlan(options) {
  if (options.command === 'dissect') {
    if (options.stages || options.reproductionDepth) argumentError('ACTION_CONFLICT', 'dissect cannot be combined with production-depth options');
    return { requestedActions: ['dissect'], resolvedStages: ['dissect'], injectedPrerequisites: [] };
  }
  if (options.command !== 'run') return { requestedActions: [], resolvedStages: [], injectedPrerequisites: [] };

  let resolvedStages;
  let warnings = [];
  if (options.stages) {
    ({ stages: resolvedStages, warnings } = normalizeLegacyStages(options.stages.split(','), { sourceVersion: options.sourceVersion }));
  }
  if (options.reproductionDepth) {
    const fromDepth = depthStages(options);
    if (resolvedStages && JSON.stringify(resolvedStages) !== JSON.stringify(fromDepth)) argumentError('ACTION_CONFLICT', 'stages conflict with reproduction depth');
    resolvedStages = fromDepth;
  }
  if (!resolvedStages) argumentError('AMBIGUOUS_ACTION', 'run requires explicit --stages or --reproduction-depth');
  const acceptedInput = {
    dissect: new Set(['source', 'capture']),
    replicate: new Set(['blueprint']),
    adapt: new Set(['asset']),
    register: new Set(['asset']),
    publish: new Set(['library-asset']),
  }[resolvedStages[0]];
  if (!acceptedInput?.has(options.inputKind)) argumentError('MISSING_STAGE_INPUT', `${resolvedStages[0]} cannot start from input-kind=${options.inputKind ?? 'missing'}`);
  const injectedPrerequisites = options.inputKind !== 'blueprint' && resolvedStages[0] === 'dissect' && !options.stages
    ? [{ stage: 'dissect', reason: 'source or capture input requires a Blueprint before replication' }]
    : [];
  return { requestedActions: resolvedStages.filter((stage) => !injectedPrerequisites.some((item) => item.stage === stage)), resolvedStages, injectedPrerequisites, warnings };
}
