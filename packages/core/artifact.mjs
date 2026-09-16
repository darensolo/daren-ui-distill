import { randomUUID } from 'node:crypto';
import { access, cp, lstat, mkdir, open, readlink, readdir, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';

import { sha256Bytes, sha256File } from './digest.mjs';
import { fail } from './errors.mjs';
import { assertRelativePath } from './scope.mjs';

const within = (candidate, root) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function nearestExistingAncestor(candidate) {
  let current = candidate;
  while (!await exists(current)) {
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`no existing ancestor for ${candidate}`);
    current = parent;
  }
  return realpath(current);
}

async function treeDigest(root) {
  if (!await exists(root)) return null;
  const records = [];
  async function visit(current, relativePath) {
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink()) {
      records.push(['link', relativePath, metadata.mode, await readlink(current)]);
      return;
    }
    if (metadata.isDirectory()) {
      records.push(['directory', relativePath, metadata.mode]);
      const entries = await readdir(current);
      for (const entry of entries.sort()) await visit(path.join(current, entry), relativePath ? `${relativePath}/${entry}` : entry);
      return;
    }
    if (!metadata.isFile()) fail('UNSUPPORTED_TARGET_ENTRY', `unsupported target entry: ${relativePath}`);
    records.push(['file', relativePath, metadata.mode, await sha256File(current)]);
  }
  await visit(root, '');
  return sha256Bytes(Buffer.from(JSON.stringify(records)));
}

async function assertStableTarget(target, expectedDigest) {
  if (await treeDigest(target) !== expectedDigest) fail('WRITE_CONFLICT', 'target changed while materialization was staged');
}

async function matchesExpectedFiles(target, expectedFiles) {
  const entries = Object.entries(expectedFiles ?? {});
  if (!entries.length || !await exists(target)) return false;
  for (const [relativePath, expectedDigest] of entries) {
    const file = path.resolve(target, assertRelativePath(relativePath));
    if (!within(file, target) || !await exists(file) || !(await lstat(file)).isFile() || await sha256File(file) !== expectedDigest) return false;
  }
  return true;
}

async function recoverOrphanTransaction(target, desiredFiles = {}) {
  const parent = path.dirname(target);
  if (!await exists(parent)) return { status: 'clean', action: 'none' };
  const prefix = `.${path.basename(target)}.dh05-`;
  const transactionPattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:backup|stage)-[0-9]+-[0-9a-f-]{36}$`);
  const names = (await readdir(parent)).filter((name) => transactionPattern.test(name));
  const backups = names.filter((name) => name.startsWith(`${prefix}backup-`));
  const stages = names.filter((name) => name.startsWith(`${prefix}stage-`));
  if (backups.length > 1) fail('ORPHAN_TRANSACTION_CONFLICT', `multiple orphan backups exist for ${path.basename(target)}`);
  if (backups.length === 1) {
    const backup = path.join(parent, backups[0]);
    if (await exists(target)) {
      if (!await matchesExpectedFiles(target, desiredFiles)) {
        await rm(target, { recursive: true, force: true });
        await rename(backup, target);
        for (const name of stages) await rm(path.join(parent, name), { recursive: true, force: true });
        return { status: 'recovered', action: 'promotion-conflict' };
      }
      await rm(backup, { recursive: true, force: true });
      for (const name of stages) await rm(path.join(parent, name), { recursive: true, force: true });
      return { status: 'recovered', action: 'promotion-confirmed' };
    }
    await rename(backup, target);
  }
  for (const name of stages) await rm(path.join(parent, name), { recursive: true, force: true });
  return { status: backups.length || stages.length ? 'recovered' : 'clean', action: backups.length ? 'backup-restored' : stages.length ? 'staging-cleared' : 'none' };
}

export async function reconcileMaterialization({ baseDir, writeRoots, targetRoot, expectedFiles = {} }) {
  assertRelativePath(targetRoot);
  const realBase = await realpath(baseDir);
  const target = path.resolve(realBase, targetRoot);
  const authorized = writeRoots.map((root) => path.resolve(realBase, assertRelativePath(root)));
  if (!authorized.some((root) => within(target, root)) || authorized.some((root) => !within(root, realBase))) fail('SCOPE_ESCAPE', 'reconciliation target is outside write roots');
  const recovered = await recoverOrphanTransaction(target, expectedFiles);
  return { ...recovered, classification: ['backup-restored', 'staging-cleared'].includes(recovered.action) ? 'retry' : recovered.action === 'promotion-confirmed' ? 'committed' : 'conflict' };
}

export async function materializeAsset(bundle, { baseDir, writeRoots, targetRoot, expectedFiles = {}, testHooks = {} }) {
  assertRelativePath(targetRoot);
  const realBase = await realpath(baseDir);
  const allowedRoots = [];
  for (const root of writeRoots) {
    assertRelativePath(root);
    const lexical = path.resolve(realBase, root);
    if (!within(lexical, realBase)) fail('SCOPE_ESCAPE', 'write root escapes base directory');
    const resolvedAncestor = await nearestExistingAncestor(lexical);
    if (!within(resolvedAncestor, realBase)) fail('SCOPE_ESCAPE', 'write root symlink escapes base directory');
    allowedRoots.push(await exists(lexical) ? await realpath(lexical) : lexical);
  }
  const target = path.resolve(realBase, targetRoot);
  if (!allowedRoots.some((root) => within(target, root))) fail('SCOPE_ESCAPE', 'asset target is outside write roots');
  const desiredFiles = Object.fromEntries(bundle.files.map((file) => [file.relativePath, sha256Bytes(Buffer.from(file.content))]));
  const orphan = await recoverOrphanTransaction(target, desiredFiles);
  if (orphan.action === 'promotion-confirmed') {
    return { status: 'succeeded', targetRoot, receipts: bundle.files.map((file) => ({ relativePath: file.relativePath, digest: desiredFiles[file.relativePath] })) };
  }
  const targetPresent = await exists(target);
  if (targetPresent) {
    const realTarget = await realpath(target);
    if (!allowedRoots.some((root) => within(realTarget, root))) fail('SCOPE_ESCAPE', 'asset target resolves outside write roots');
  } else {
    const realAncestor = await nearestExistingAncestor(path.dirname(target));
    if (!within(realAncestor, realBase)) fail('SCOPE_ESCAPE', 'asset target parent resolves outside base directory');
  }

  const plans = [];
  for (const file of bundle.files) {
    assertRelativePath(file.relativePath);
    const destination = path.resolve(target, file.relativePath);
    if (!within(destination, target)) fail('SCOPE_ESCAPE', 'asset file escapes target root');
    const present = await exists(destination);
    const expected = expectedFiles[file.relativePath];
    if (present && !(await lstat(destination)).isFile()) fail('WRITE_CONFLICT', `refusing to replace non-file entry: ${file.relativePath}`);
    if (present && expected === undefined) fail('WRITE_CONFLICT', `refusing to overwrite unversioned file: ${file.relativePath}`);
    if (present && await sha256File(destination) !== expected) fail('WRITE_CONFLICT', `expected digest mismatch: ${file.relativePath}`);
    if (!present && expected) fail('WRITE_CONFLICT', `expected existing file is missing: ${file.relativePath}`);
    plans.push({ ...file, expected, present });
  }

  const expectedTargetDigest = await treeDigest(target);
  const parent = path.dirname(target);
  await mkdir(parent, { recursive: true });
  const realParent = await realpath(parent);
  if (!within(realParent, realBase)) fail('SCOPE_ESCAPE', 'asset target parent resolves outside base directory');
  const transactionId = `${process.pid}-${randomUUID()}`;
  const staging = path.join(parent, `.${path.basename(target)}.dh05-stage-${transactionId}`);
  const backup = path.join(parent, `.${path.basename(target)}.dh05-backup-${transactionId}`);
  let originalMoved = false;
  let promoted = false;
  let committed = false;

  try {
    if (targetPresent) await cp(target, staging, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
    else await mkdir(staging);
    const realStaging = await realpath(staging);
    if (!within(realStaging, realParent)) fail('SCOPE_ESCAPE', 'staging directory escaped target parent');
    for (const plan of plans) {
      const destination = path.resolve(staging, plan.relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      const resolvedParent = await realpath(path.dirname(destination));
      if (!within(resolvedParent, realStaging)) fail('SCOPE_ESCAPE', 'asset file parent escapes staging root');
      await rm(destination, { force: true });
      const handle = await open(destination, 'wx', 0o600);
      try { await handle.writeFile(plan.content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    }

    await testHooks.beforeCommit?.({ target, staging });
    await assertStableTarget(target, expectedTargetDigest);
    for (const plan of plans) {
      const destination = path.resolve(target, plan.relativePath);
      if (plan.present) {
        if (!await exists(destination) || await sha256File(destination) !== plan.expected) fail('WRITE_CONFLICT', `concurrent edit detected: ${plan.relativePath}`);
      } else if (await exists(destination)) {
        fail('WRITE_CONFLICT', `concurrent file creation detected: ${plan.relativePath}`);
      }
    }

    if (targetPresent) {
      await rename(target, backup);
      originalMoved = true;
      await testHooks.afterBackup?.({ target, staging, backup });
    }
    await rename(staging, target);
    promoted = true;
    await testHooks.afterPromote?.({ target, backup });
    committed = true;
    if (originalMoved) {
      await rm(backup, { recursive: true, force: true });
      originalMoved = false;
    }
  } catch (error) {
    try {
      if (promoted) {
        await rm(target, { recursive: true, force: true });
        promoted = false;
      }
      if (originalMoved) {
        await rename(backup, target);
        originalMoved = false;
      }
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'asset transaction failed and rollback was incomplete');
    }
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
    if (committed) await rm(backup, { recursive: true, force: true });
  }

  const receipts = plans.map((plan) => ({ relativePath: plan.relativePath, digest: sha256Bytes(Buffer.from(plan.content)) }));
  return { status: 'succeeded', targetRoot, receipts };
}
