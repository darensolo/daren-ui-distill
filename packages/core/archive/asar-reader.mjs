import { open } from 'node:fs/promises';

import { fail } from '../errors.mjs';
import { assertRegularFile, assertRelativePath, resolveAuthorizedPath } from '../scope.mjs';

const DEFAULT_HEADER_LIMIT = 16 * 1024 * 1024;

async function readExact(handle, length, position) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  if (bytesRead !== length) fail('INVALID_ASAR', 'archive ended before the declared boundary');
  return buffer;
}

function flattenFiles(files, prefix, entries, maxEntries) {
  for (const name of Object.keys(files).sort()) {
    if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name)) fail('INVALID_ASAR_PATH', `unsafe ASAR path segment: ${name}`);
    const entry = files[name];
    const entryPath = prefix ? `${prefix}/${name}` : name;
    assertRelativePath(entryPath);
    if (entry.files) flattenFiles(entry.files, entryPath, entries, maxEntries);
    else {
      if (entry.unpacked || entry.link) {
        entries.push({
          path: entryPath,
          size: Number.isSafeInteger(Number(entry.size)) ? Number(entry.size) : 0,
          unsupported: entry.unpacked ? 'unpacked' : 'link',
        });
        if (entries.length > maxEntries) fail('RESOURCE_LIMIT', `ASAR entry limit exceeded: ${maxEntries}`);
        continue;
      }
      const size = Number(entry.size);
      const offset = Number(entry.offset);
      if (!Number.isSafeInteger(size) || size < 0 || !Number.isSafeInteger(offset) || offset < 0) fail('INVALID_ASAR_ENTRY', `invalid size or offset: ${entryPath}`);
      entries.push({ path: entryPath, size, offset });
      if (entries.length > maxEntries) fail('RESOURCE_LIMIT', `ASAR entry limit exceeded: ${maxEntries}`);
    }
  }
}

export async function readAsarIndex(relativePath, {
  baseDir,
  roots,
  maxHeaderBytes = DEFAULT_HEADER_LIMIT,
  maxEntries = 100_000,
} = {}) {
  const archivePath = await resolveAuthorizedPath(relativePath, { baseDir, roots });
  const metadata = await assertRegularFile(archivePath);
  const handle = await open(archivePath, 'r');
  try {
    const sizePickle = await readExact(handle, 8, 0);
    const headerSize = sizePickle.readUInt32LE(4);
    if (headerSize < 8 || headerSize > maxHeaderBytes || 8 + headerSize > metadata.size) fail('RESOURCE_LIMIT', `invalid or oversized ASAR header: ${headerSize}`);
    const header = await readExact(handle, headerSize, 8);
    const payloadSize = header.readUInt32LE(0);
    const jsonSize = header.readUInt32LE(4);
    if (payloadSize + 4 !== headerSize || jsonSize > payloadSize - 4 || 8 + jsonSize > header.length) fail('INVALID_ASAR', 'ASAR pickle size fields are inconsistent');
    let tree;
    try {
      tree = JSON.parse(header.subarray(8, 8 + jsonSize).toString('utf8'));
    } catch (error) {
      fail('INVALID_ASAR', 'ASAR header JSON is invalid', { cause: error });
    }
    if (!tree || typeof tree.files !== 'object' || Array.isArray(tree.files)) fail('INVALID_ASAR', 'ASAR header has no files tree');
    const entries = [];
    flattenFiles(tree.files, '', entries, maxEntries);
    const dataOffset = 8 + headerSize;
    for (const entry of entries.filter((candidate) => !candidate.unsupported)) {
      if (dataOffset + entry.offset + entry.size > metadata.size) fail('INVALID_ASAR_ENTRY', `entry exceeds archive bytes: ${entry.path}`);
    }
    return { archivePath, archiveSize: metadata.size, dataOffset, entries };
  } finally {
    await handle.close();
  }
}

export async function readAsarEntry(index, entryPath, { maxBytes = 8 * 1024 * 1024 } = {}) {
  assertRelativePath(entryPath);
  const entry = index.entries.find((candidate) => candidate.path === entryPath);
  if (!entry) fail('ASAR_ENTRY_NOT_FOUND', `ASAR entry not found: ${entryPath}`);
  if (entry.unsupported) fail('UNSUPPORTED_ASAR_ENTRY', `${entry.unsupported} ASAR entry is not supported: ${entryPath}`);
  if (entry.size > maxBytes) fail('RESOURCE_LIMIT', `ASAR entry exceeds ${maxBytes} bytes: ${entryPath}`);
  const handle = await open(index.archivePath, 'r');
  try {
    return readExact(handle, entry.size, index.dataOffset + entry.offset);
  } finally {
    await handle.close();
  }
}
