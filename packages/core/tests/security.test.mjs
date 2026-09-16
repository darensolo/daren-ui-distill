import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readAsarEntry, readAsarIndex } from '../archive/asar-reader.mjs';
import { captureSource } from '../capture.mjs';
import { sha256File } from '../digest.mjs';
import { resolveAuthorizedPath } from '../scope.mjs';

async function writeAsar(file, entries) {
  let offset = 0;
  const files = {};
  const bodies = [];
  for (const [name, value] of Object.entries(entries)) {
    const bodyText = typeof value === 'object' ? value.body : value;
    const body = Buffer.from(bodyText);
    files[name] = typeof value === 'object' && value.unpacked
      ? { size: body.length, unpacked: true }
      : { size: body.length, offset: String(offset) };
    if (typeof value === 'object' && value.unpacked) continue;
    offset += body.length;
    bodies.push(body);
  }
  const json = Buffer.from(JSON.stringify({ files }));
  const payloadSize = 4 + json.length;
  const headerSize = 4 + payloadSize;
  const sizePickle = Buffer.alloc(8);
  sizePickle.writeUInt32LE(4, 0);
  sizePickle.writeUInt32LE(headerSize, 4);
  const header = Buffer.alloc(headerSize);
  header.writeUInt32LE(payloadSize, 0);
  header.writeUInt32LE(json.length, 4);
  json.copy(header, 8);
  await writeFile(file, Buffer.concat([sizePickle, header, ...bodies]));
}

test('realpath scope rejects traversal and symlink escape', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-scope-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'allowed'), { recursive: true });
  await writeFile(path.join(root, 'outside.txt'), 'secret sentinel');
  await symlink(path.join(root, 'outside.txt'), path.join(root, 'allowed', 'escape'));
  await assert.rejects(() => resolveAuthorizedPath('../outside.txt', { baseDir: root, roots: ['allowed'] }), (error) => error.code === 'INVALID_RELATIVE_PATH');
  await assert.rejects(() => resolveAuthorizedPath('allowed/escape', { baseDir: root, roots: ['allowed'] }), (error) => error.code === 'SCOPE_ESCAPE');
  await symlink(tmpdir(), path.join(root, 'outside-root'));
  await assert.rejects(() => resolveAuthorizedPath('outside-root', { baseDir: root, roots: ['outside-root'] }), (error) => error.code === 'SCOPE_ESCAPE');
});

test('mixed ASAR ignores unrelated unpacked entries but rejects selecting one', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-mixed-asar-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'archives'));
  await writeAsar(path.join(root, 'archives', 'app.asar'), {
    'packed.css': '.safe{}',
    'native.node': { body: 'not-in-archive', unpacked: true },
  });
  const index = await readAsarIndex('archives/app.asar', { baseDir: root, roots: ['archives'] });
  assert.equal((await readAsarEntry(index, 'packed.css')).toString(), '.safe{}');
  await assert.rejects(() => readAsarEntry(index, 'native.node'), (error) => error.code === 'UNSUPPORTED_ASAR_ENTRY');
});

test('installed ChatGPT ASAR can be indexed and a packed entry selected safely', async (t) => {
  const relativePath = 'ChatGPT.app/Contents/Resources/app.asar';
  try {
    await access(path.join('/Applications', relativePath));
  } catch {
    t.skip('ChatGPT.app is not installed on this host');
    return;
  }
  const index = await readAsarIndex(relativePath, { baseDir: '/Applications', roots: ['ChatGPT.app/Contents/Resources'] });
  const selected = index.entries.find((entry) => !entry.unsupported && entry.size > 0 && entry.size <= 4096);
  assert.ok(selected, 'expected at least one small packed entry');
  assert.equal((await readAsarEntry(index, selected.path, { maxBytes: 4096 })).length, selected.size);
});

test('selective ASAR reader is bounded, byte-stable, and never executes contents', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-asar-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'archives'));
  const archive = path.join(root, 'archives', 'app.asar');
  await writeAsar(archive, { 'safe.js': 'globalThis.__DH05_EXECUTED__ = true', 'style.css': '.x{}' });
  const before = await sha256File(archive);
  const index = await readAsarIndex('archives/app.asar', { baseDir: root, roots: ['archives'], maxEntries: 4 });
  assert.deepEqual(index.entries.map((entry) => entry.path), ['safe.js', 'style.css']);
  assert.equal((await readAsarEntry(index, 'style.css', { maxBytes: 16 })).toString(), '.x{}');
  await assert.rejects(() => readAsarEntry(index, 'safe.js', { maxBytes: 4 }), (error) => error.code === 'RESOURCE_LIMIT');
  assert.equal(globalThis.__DH05_EXECUTED__, undefined);
  assert.equal(await sha256File(archive), before);
  assert.equal((await readFile(archive)).length, index.archiveSize);
});

test('capture refuses account and secret storage selectors even inside a broad read root', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-sensitive-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'inputs'), { recursive: true });
  await writeFile(path.join(root, 'inputs', 'Cookies'), 'sentinel');
  await assert.rejects(() => captureSource({
    baseDir: root,
    scope: { readRoots: ['inputs'] },
    source: { kind: 'evidence-bundle', relativePath: 'inputs' },
    selectors: ['Cookies'],
  }), (error) => error.code === 'SENSITIVE_SOURCE_PATH');
});

test('capture inspects the normalized source-relative path for dot directories and key material', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'dh05-key-material-'));
  t.after(async () => (await import('node:fs/promises')).rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'inputs', '.ssh'), { recursive: true });
  await mkdir(path.join(root, 'inputs', 'assets'), { recursive: true });
  await writeFile(path.join(root, 'inputs', '.ssh', 'id_rsa'), 'secret sentinel');
  await writeFile(path.join(root, 'inputs', 'assets', 'identity-rsa.svg'), '<svg/>');

  await assert.rejects(() => captureSource({
    baseDir: root,
    scope: { readRoots: ['inputs'] },
    source: { kind: 'evidence-bundle', relativePath: 'inputs/.ssh' },
    selectors: ['id_rsa'],
  }), (error) => error.code === 'SENSITIVE_SOURCE_PATH');

  const safe = await captureSource({
    baseDir: root,
    scope: { readRoots: ['inputs'] },
    source: { kind: 'evidence-bundle', relativePath: 'inputs' },
    selectors: ['assets/identity-rsa.svg'],
  });
  assert.equal(safe.resources[0].relativePath, 'inputs/assets/identity-rsa.svg');
});
