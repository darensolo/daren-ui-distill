import { validateContract } from '../contracts/validate.mjs';
import { digestObject } from './digest.mjs';
import { fail } from './errors.mjs';

const terminalFailure = new Set(['failed', 'blocked', 'unsupported', 'cancelled']);

function stageRun(stage, attempt, result) {
  return {
    id: `${stage}-${attempt}`,
    kind: stage,
    inputRefs: structuredClone(result.inputRefs ?? []),
    outputRefs: structuredClone(result.outputRefs ?? []),
    reportRefs: structuredClone(result.reportRefs ?? []),
    status: result.status,
    effectReceipts: structuredClone(result.effectReceipts ?? []),
  };
}

function finish(chain) {
  const validation = validateContract('stage-execution', chain);
  if (!validation.valid) fail('INVALID_STAGE_EXECUTION', JSON.stringify(validation.errors));
  return chain;
}

export async function executeStages({ jobId, requestedActions, resolvedStages, handlers, store, binding }) {
  if (!binding) fail('MISSING_JOB_BINDING', 'stage execution and resume require the canonical job binding');
  if (JSON.stringify(requestedActions) !== JSON.stringify(binding.request?.requestedActions ?? [])
    || JSON.stringify(resolvedStages) !== JSON.stringify(binding.resolvedStages ?? [])) {
    fail('RESUME_DRIFT', 'requested actions or resolved stages differ from the canonical job binding');
  }
  const recovered = await store.recover(jobId, { binding });
  const remainingBudget = Math.max(0, recovered.budget - recovered.consumedBudget);
  if (recovered.cancelled) {
    return finish({ schemaVersion: '1.0.0', chainId: jobId, requestedActions, resolvedStages, stageRuns: [], status: 'cancelled', resumePoint: null, remainingBudget });
  }

  const attempts = new Map();
  const succeeded = new Map();
  const prepared = new Map();
  const terminal = new Set();
  const retryAttempts = new Map();
  for (const event of recovered.events.filter((entry) => entry.type.startsWith('stage-'))) {
    const stage = event.payload.stage;
    if (event.type === 'stage-prepared') {
      const expectedInput = digestObject({ bindingDigest: recovered.bindingDigest, stage, attempt: event.payload.attempt });
      if (event.payload.inputDigest !== expectedInput) fail('CORRUPT_STAGE_CHECKPOINT', `Stage ${stage}:${event.payload.attempt} prepared input does not bind the job`);
      attempts.set(stage, Math.max(attempts.get(stage) ?? 0, event.payload.attempt));
      prepared.set(`${stage}:${event.payload.attempt}`, event);
    } else {
      terminal.add(`${stage}:${event.payload.attempt}`);
      if (event.type === 'stage-succeeded') {
        const preparedEvent = prepared.get(`${stage}:${event.payload.attempt}`);
        const expectedOutput = digestObject({ outputRefs: event.payload.result.outputRefs ?? [], reportRefs: event.payload.result.reportRefs ?? [], effectReceipts: event.payload.result.effectReceipts ?? [] });
        if (!preparedEvent || event.payload.checkpoint?.inputDigest !== preparedEvent.payload.inputDigest || event.payload.checkpoint?.outputDigest !== expectedOutput) {
          fail('CORRUPT_STAGE_CHECKPOINT', `Stage ${stage}:${event.payload.attempt} checkpoint does not bind its input/output summaries`);
        }
        succeeded.set(stage, stageRun(stage, event.payload.attempt, event.payload.result));
      }
    }
  }
  for (const uncertain of [...prepared.keys()].filter((key) => !terminal.has(key))) {
    const event = prepared.get(uncertain);
    const { stage, attempt } = event.payload;
    const reconcile = handlers[stage]?.reconcile;
    if (!reconcile) fail('UNCERTAIN_STAGE_EFFECT', `Stage ${uncertain} requires reconciliation before retry`);
    const resolution = await reconcile({ jobId, stage, attempt, operationId: `${jobId}:${stage}:${attempt}`, prepared: event, recovered });
    if (resolution?.status === 'conflict') fail('STAGE_RECONCILIATION_CONFLICT', `Stage ${uncertain} reconciliation found conflicting effects`);
    if (resolution?.status === 'committed') {
      const result = resolution.result;
      const outputDigest = digestObject({ outputRefs: result.outputRefs ?? [], reportRefs: result.reportRefs ?? [], effectReceipts: result.effectReceipts ?? [] });
      await store.append(jobId, { type: 'stage-succeeded', operationId: `${jobId}:${stage}:${attempt}:terminal`, payload: { stage, attempt, result, checkpoint: { inputDigest: event.payload.inputDigest, outputDigest } } });
      succeeded.set(stage, stageRun(stage, attempt, result));
    } else if (resolution?.status === 'retry') retryAttempts.set(stage, attempt);
    else fail('INVALID_RECONCILIATION', `Stage ${uncertain} reconciliation returned no safe classification`);
  }

  const stageRuns = [];
  for (const stage of resolvedStages) {
    if (succeeded.has(stage)) {
      stageRuns.push(succeeded.get(stage));
      continue;
    }
    const attempt = retryAttempts.get(stage) ?? (attempts.get(stage) ?? 0) + 1;
    const handler = handlers[stage];
    const preparedInputDigest = digestObject({ bindingDigest: recovered.bindingDigest, stage, attempt });
    await store.append(jobId, {
      type: 'stage-prepared', operationId: `${jobId}:${stage}:${attempt}:prepared`,
      payload: { stage, attempt, inputDigest: preparedInputDigest },
    });
    const result = handler
      ? await handler({ jobId, stage, attempt, operationId: `${jobId}:${stage}:${attempt}`, recovered })
      : { status: 'unsupported', inputRefs: [], outputRefs: [], reportRefs: [], effectReceipts: [] };
    if (!['succeeded', 'failed', 'blocked', 'unsupported', 'cancelled'].includes(result?.status)) {
      fail('INVALID_STAGE_RESULT', `Stage ${stage} returned an invalid status`);
    }
    const run = stageRun(stage, attempt, result);
    stageRuns.push(run);
    await store.append(jobId, {
      type: `stage-${result.status}`,
      operationId: `${jobId}:${stage}:${attempt}:terminal`,
      payload: {
        stage, attempt, result: structuredClone(result),
        checkpoint: {
          inputDigest: preparedInputDigest,
          outputDigest: digestObject({ outputRefs: result.outputRefs ?? [], reportRefs: result.reportRefs ?? [], effectReceipts: result.effectReceipts ?? [] }),
        },
      },
    });
    if (terminalFailure.has(result.status)) {
      return finish({
        schemaVersion: '1.0.0', chainId: jobId, requestedActions, resolvedStages, stageRuns,
        status: stageRuns.some((entry) => entry.status === 'succeeded') ? 'partial' : result.status,
        resumePoint: stage, remainingBudget,
      });
    }
  }
  return finish({ schemaVersion: '1.0.0', chainId: jobId, requestedActions, resolvedStages, stageRuns, status: 'completed', resumePoint: null, remainingBudget });
}
