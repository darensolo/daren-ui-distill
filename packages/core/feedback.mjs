import { validateContract } from '../contracts/validate.mjs';
import { fail } from './errors.mjs';

export function routeFeedback(feedback) {
  const validation = validateContract('feedback', feedback);
  if (!validation.valid) fail('INVALID_FEEDBACK', JSON.stringify(validation.errors));
  const route = {
    'implementation-fix': { nextStage: 'optimize', mayChangeBaseline: false, mayChangeTarget: false },
    'target-change': { nextStage: 'adapt', mayChangeBaseline: false, mayChangeTarget: true },
    'source-evidence': { nextStage: 'dissect', mayChangeBaseline: true, mayChangeTarget: false },
  }[feedback.feedbackType];
  return { ...route, invalidatedReportRefs: structuredClone(feedback.invalidatedReportRefs), effectScope: structuredClone(feedback.effectScope) };
}
