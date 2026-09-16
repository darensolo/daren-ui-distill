import { createMacOSSandboxDriver, detectMacOSSandbox } from './macos-sandbox.mjs';

export { detectMacOSSandbox };

export function createIsolationDriver({ capability, profilePath } = {}) {
  const resolved = capability ?? { status: 'unavailable', reason: 'Isolation capability has not been detected' };
  if (resolved.status !== 'available') {
    return {
      capability: resolved,
      async runPreview() {
        return { status: 'blocked', reason: resolved.reason };
      },
    };
  }
  return createMacOSSandboxDriver({ capability: resolved, profilePath });
}
