import { validateContract } from '../contracts/validate.mjs';
import { fail } from './errors.mjs';

function result(portKind, inputRef, operationId, status, reason, effectReceipts = [], receipt = null) {
  const contract = {
    schemaVersion: '1.0.0', portKind, id: `${portKind}-adapter`, version: '1.0.0', capabilities: status === 'supported' ? ['execute'] : [],
    check: { status, reason },
    result: { operationId, inputRef, status: status === 'supported' ? 'succeeded' : status, effectReceipts, ...(receipt ? { receipt } : {}) },
  };
  const validation = validateContract('adapters', contract);
  if (!validation.valid) fail('INVALID_ADAPTER_RESULT', JSON.stringify(validation.errors));
  return contract;
}

function deliveryReceiptRef(receipt) {
  if (!receipt) return null;
  if (receipt.relativePath && !receipt.assetRef) return receipt;
  const fileName = receipt.kind === 'registration-receipt'
    ? 'registration-receipt.json'
    : receipt.kind === 'publication-receipt'
      ? 'publication-receipt.json'
      : null;
  if (!fileName || !receipt.assetRef || !receipt.rollback?.targetRoot || !receipt.digest) {
    fail('INVALID_ADAPTER_RECEIPT', 'configured effect adapter returned an invalid delivery receipt');
  }
  return {
    kind: receipt.kind,
    id: receipt.assetRef.id,
    revision: receipt.assetRef.revision,
    digest: receipt.digest,
    relativePath: `${receipt.rollback.targetRoot}/${fileName}`,
  };
}

export function createPorts({ host, library, site } = {}) {
  const configuredEffectPort = (kind, adapter) => ({
    check: () => adapter?.execute
      ? { status: 'supported', reason: `configured ${kind} adapter is available` }
      : { status: 'unsupported', reason: `${kind} adapter is not configured for this host` },
    execute: async ({ inputRef, operationId, request }) => {
      if (!adapter?.execute) return result(kind, inputRef, operationId, 'unsupported', `${kind} adapter is not configured for this host`);
      const outcome = await adapter.execute(request);
      const receipt = deliveryReceiptRef(outcome.receiptRef ?? outcome.receipt);
      return result(kind, inputRef, operationId, 'supported', `configured ${kind} adapter is available`, outcome.effectReceipts ?? (receipt ? [receipt] : []), receipt);
    },
  });
  return {
    host: {
      check: () => host?.available ? { status: 'supported', reason: 'authorized agent host adapter is available' } : { status: 'blocked', reason: host?.reason ?? 'host adapter is unavailable' },
      execute: async ({ inputRef, operationId, request }) => {
        if (!host?.available) return result('host', inputRef, operationId, 'blocked', host?.reason ?? 'host adapter is unavailable');
        const receipt = await host.execute(request);
        return result('host', inputRef, operationId, 'supported', 'authorized agent host adapter is available', receipt ? [receipt] : []);
      },
    },
    library: configuredEffectPort('library', library),
    site: configuredEffectPort('site', site),
  };
}
