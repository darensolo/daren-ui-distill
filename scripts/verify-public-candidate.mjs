#!/usr/bin/env node
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoots = ['packages', 'adapters', 'plugins', 'skills', 'examples'];
const ignoredDirectories = new Set(['node_modules', 'dist', '.git']);
const blockedEverywhere = [
  { label: 'absolute user path', pattern: /\/Users\// },
  { label: 'private key material', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { label: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];
const blockedRuntimeReferences = [
  { label: 'legacy monorepo path', pattern: /tooling\/(?:daren-ui-distill|ui-distiller)|Mindex-Next/ },
  { label: 'private governance path', pattern: /kyber\/skills-library|kyber\/rules/ },
  { label: 'unbundled D24 spec path', pattern: /specs\/D24-granularity-replica-engine/ },
];

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) throw new Error(`public candidate contains symlink: ${path.relative(root, absolute)}`);
    if (info.isDirectory()) await walk(absolute, files);
    else if (info.isFile()) files.push(absolute);
  }
  return files;
}

const violations = [];
for (const file of await walk(root)) {
    const bytes = await readFile(file).catch(() => null);
    if (bytes === null || bytes.includes(0)) continue;
    const content = bytes.toString('utf8');
    const relative = path.relative(root, file);
    const topLevel = relative.split(path.sep)[0];
    const rules = blockedEverywhere.concat(runtimeRoots.includes(topLevel) ? blockedRuntimeReferences : []);
    for (const rule of rules) {
      if (rule.pattern.test(content)) violations.push(`${path.relative(root, file)}: ${rule.label}`);
    }
}

if (violations.length) {
  process.stderr.write(`${violations.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ status: 'passed', scanned: 'all candidate files', runtimeRoots })}\n`);
}
