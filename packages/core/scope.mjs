import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { fail } from './errors.mjs';

export function assertRelativePath(candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.includes('\0') || candidate.includes('\\') || path.isAbsolute(candidate)) {
    fail('INVALID_RELATIVE_PATH', `path must be a non-empty POSIX relative path: ${String(candidate)}`);
  }
  const segments = candidate.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail('INVALID_RELATIVE_PATH', `path contains an unsafe segment: ${candidate}`);
  }
  return candidate;
}

const within = (candidate, root) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

export async function resolveAuthorizedPath(candidate, { baseDir, roots }) {
  assertRelativePath(candidate);
  if (!Array.isArray(roots) || roots.length === 0) fail('MISSING_SCOPE', 'at least one authorized root is required');
  const realBase = await realpath(baseDir);
  const realCandidate = await realpath(path.resolve(realBase, candidate));
  const realRoots = await Promise.all(roots.map(async (root) => {
    assertRelativePath(root);
    return realpath(path.resolve(realBase, root));
  }));
  if (realRoots.some((root) => !within(root, realBase))) {
    fail('SCOPE_ESCAPE', 'an authorized root resolves outside baseDir');
  }
  if (!realRoots.some((root) => within(realCandidate, root))) {
    fail('SCOPE_ESCAPE', `${candidate} resolves outside the authorized roots`);
  }
  return realCandidate;
}

export async function assertRegularFile(file) {
  const metadata = await stat(file);
  if (!metadata.isFile()) fail('UNSUPPORTED_SOURCE', `${file} is not a regular file`);
  return metadata;
}

export function toPosixRelative(baseDir, absolutePath) {
  const relative = path.relative(baseDir, absolutePath).split(path.sep).join('/');
  return assertRelativePath(relative);
}
