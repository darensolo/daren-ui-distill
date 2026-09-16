import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

import { digestObject } from './digest.mjs';
import { fail } from './errors.mjs';

const jobPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

function canonicalBinding(inputDigest, binding = {}) {
  if (binding.inputDigest !== undefined && binding.inputDigest !== inputDigest) fail('BINDING_INPUT_MISMATCH', 'binding inputDigest differs from the job input');
  return {
    request: binding.request ?? null,
    inputDigest,
    resolvedStages: structuredClone(binding.resolvedStages ?? []),
    scope: structuredClone(binding.scope ?? null),
    checksetDigest: binding.checksetDigest ?? null,
  };
}

function componentDigests(binding) {
  return {
    requestDigest: digestObject(binding.request),
    inputDigest: binding.inputDigest,
    stagesDigest: digestObject(binding.resolvedStages),
    scopeDigest: digestObject(binding.scope),
    checksetDigest: binding.checksetDigest,
  };
}

function jobPaths(root, jobId) {
  if (!jobPattern.test(jobId)) fail('INVALID_JOB_ID', `Unsafe job id: ${jobId}`);
  const directory = path.join(root, jobId);
  return { directory, journal: path.join(directory, 'events.jsonl'), lock: path.join(directory, 'events.lock') };
}

async function readEvents(journal, { missing = false } = {}) {
  let text;
  try {
    text = await readFile(journal, 'utf8');
  } catch (error) {
    if (missing && error.code === 'ENOENT') return [];
    throw error;
  }
  return text.split('\n').filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      fail('CORRUPT_JOB_JOURNAL', `Invalid JSON at journal line ${index + 1}`, { cause: error });
    }
  });
}

function verifyEvents(events) {
  let previousDigest = null;
  for (const [index, event] of events.entries()) {
    if (event.sequence !== index + 1 || event.previousDigest !== previousDigest || digestObject(event) !== event.digest) {
      fail('CORRUPT_JOB_JOURNAL', `Invalid event chain at sequence ${index + 1}`);
    }
    previousDigest = event.digest;
  }
}

async function withLock(lockPath, operation) {
  let handle;
  try {
    handle = await open(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') fail('JOB_BUSY', 'Another job operation is in progress', { retryable: true, nextAction: 'retry' });
    throw error;
  }
  try {
    return await operation();
  } finally {
    await handle.close();
    await unlink(lockPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export function createJobStore(root) {
  const resolvedRoot = path.resolve(root);

  async function append(jobId, { type, operationId, payload = {} }) {
    const paths = jobPaths(resolvedRoot, jobId);
    await mkdir(paths.directory, { recursive: true });
    return withLock(paths.lock, async () => {
      const events = await readEvents(paths.journal, { missing: true });
      verifyEvents(events);
      if (events.length === 0 && type !== 'job-created') fail('JOB_NOT_FOUND', `Job ${jobId} has not been created`);
      const existing = events.find((event) => event.operationId === operationId);
      if (existing) {
        if (existing.type === type && digestObject(existing.payload) === digestObject(payload)) return { event: existing, idempotent: true };
        fail('OPERATION_CONFLICT', `Operation ${operationId} was already recorded with different input`);
      }
      if (events.some((event) => event.type === 'job-cancelled') && !['job-cancelled', 'stage-cancelled'].includes(type)) {
        fail('JOB_CANCELLED', `Job ${jobId} is cancelled`);
      }
      if (type === 'optimize-attempted') {
        const budget = events[0].payload.budget;
        const consumed = events.filter((event) => event.type === 'optimize-attempted').length;
        if (consumed >= budget) fail('BUDGET_EXHAUSTED', `Job ${jobId} has consumed its ${budget} repair rounds`);
      }
      const previousDigest = events.at(-1)?.digest ?? null;
      const event = {
        schemaVersion: '1.0.0', jobId, sequence: events.length + 1, type, operationId,
        payload: structuredClone(payload), previousDigest, recordedAt: new Date().toISOString(),
      };
      event.digest = digestObject(event);
      const handle = await open(paths.journal, 'a');
      try {
        await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      return { event, idempotent: false };
    });
  }

  return {
    async create(jobId, { inputDigest, budget = 3, binding = {} }) {
      if (!/^[a-f0-9]{64}$/.test(inputDigest)) fail('INVALID_INPUT_DIGEST', 'Job inputDigest must be a sha256 digest');
      if (!Number.isInteger(budget) || budget < 0 || budget > 3) fail('INVALID_BUDGET', 'Job budget must be an integer from zero to three');
      const normalizedBinding = canonicalBinding(inputDigest, binding);
      if (normalizedBinding.checksetDigest !== null && !/^[a-f0-9]{64}$/.test(normalizedBinding.checksetDigest)) fail('INVALID_CHECKSET_DIGEST', 'checksetDigest must be a sha256 digest');
      const bindingDigests = componentDigests(normalizedBinding);
      return append(jobId, { type: 'job-created', operationId: `${jobId}:create`, payload: { inputDigest, budget, binding: normalizedBinding, bindingDigests, bindingDigest: digestObject(bindingDigests) } });
    },
    append,
    async beginOptimizeAttempt(jobId, operationId, payload = {}) {
      return append(jobId, { type: 'optimize-attempted', operationId, payload });
    },
    async cancel(jobId, reason) {
      return append(jobId, { type: 'job-cancelled', operationId: `${jobId}:cancel`, payload: { reason } });
    },
    async recover(jobId, { binding } = {}) {
      const { journal } = jobPaths(resolvedRoot, jobId);
      const events = await readEvents(journal);
      verifyEvents(events);
      if (!events.length || events[0].type !== 'job-created') fail('CORRUPT_JOB_JOURNAL', 'Job journal must begin with job-created');
      if (binding?.inputDigest !== undefined && binding.inputDigest !== events[0].payload.inputDigest) fail('RESUME_DRIFT', 'Resume input differs from the created job');
      if (binding && digestObject(componentDigests(canonicalBinding(events[0].payload.inputDigest, binding))) !== events[0].payload.bindingDigest) fail('RESUME_DRIFT', 'Resume request, input, stages, scope, or checkset differs from the created job');
      const effects = new Map(events.filter((event) => event.type === 'effect-committed').map((event) => [event.operationId, structuredClone(event.payload)]));
      return {
        events,
        inputDigest: events[0].payload.inputDigest,
        budget: events[0].payload.budget,
        binding: structuredClone(events[0].payload.binding),
        bindingDigests: structuredClone(events[0].payload.bindingDigests),
        bindingDigest: events[0].payload.bindingDigest,
        consumedBudget: events.filter((event) => event.type === 'optimize-attempted').length,
        cancelled: events.some((event) => event.type === 'job-cancelled'),
        effects,
      };
    },
  };
}
