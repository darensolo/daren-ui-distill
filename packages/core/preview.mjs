import { fail } from './errors.mjs';

export async function previewAsset(bundle, { driver }) {
  if (!driver?.capability || driver.capability.status !== 'available') {
    return { status: 'blocked', reason: driver?.capability?.reason ?? 'No isolated preview driver is available', executed: false };
  }
  if (typeof driver.runPreview !== 'function') fail('INVALID_ISOLATION_DRIVER', 'Available isolation driver must expose runPreview');
  const result = await driver.runPreview(bundle);
  return { ...result, executed: result.executed ?? result.status !== 'blocked' };
}
