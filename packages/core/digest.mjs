import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

function normalize(value, depth = 0) {
  if (Array.isArray(value)) return value.map((entry) => normalize(entry, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().flatMap((key) => {
      if (depth === 0 && key === 'digest') return [];
      return [[key, normalize(value[key], depth + 1)]];
    }));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(normalize(value));
}

export function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function digestObject(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), 'utf8'));
}

export async function sha256File(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
