import { access, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { fail } from '../errors.mjs';

const defaultProfile = fileURLToPath(new URL('./profile.sb', import.meta.url));

export async function detectMacOSSandbox({ platform = process.platform, binary = '/usr/bin/sandbox-exec', profilePath = defaultProfile } = {}) {
  if (platform !== 'darwin') return { status: 'unavailable', reason: `macOS sandbox is unavailable on ${platform}` };
  try {
    await access(binary, constants.X_OK);
    await access(profilePath, constants.R_OK);
    return { status: 'available', kind: 'macos-sandbox-exec', binary, profilePath };
  } catch {
    return { status: 'unavailable', reason: 'sandbox-exec or the deny-default profile is unavailable' };
  }
}

function runProcess(binary, args, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: '/usr/bin:/bin', LANG: 'C' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ status: 'failed', exitCode: null, signal: null, stdout, stderr: error.message });
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ status: exitCode === 0 ? 'succeeded' : 'failed', exitCode, signal, stdout, stderr });
    });
  });
}

export function createMacOSSandboxDriver({ capability, profilePath = capability.profilePath ?? defaultProfile }) {
  return {
    capability,
    async run({ executable, args = [], cwd, readRoot, writeRoot, timeoutMs = 10_000 }) {
      if (capability.status !== 'available') return { status: 'blocked', reason: capability.reason };
      if (!path.isAbsolute(executable)) fail('UNSAFE_EXECUTABLE', 'Isolated executable must be an absolute path');
      const [realCwd, realReadRoot, realWriteRoot] = await Promise.all([realpath(cwd), realpath(readRoot), realpath(writeRoot)]);
      if (!(realCwd === realReadRoot || realCwd.startsWith(`${realReadRoot}${path.sep}`))) fail('SCOPE_ESCAPE', 'Sandbox cwd must be within its read root');
      return runProcess(capability.binary, [
        '-D', `EXECUTABLE=${executable}`,
        '-D', `READ_ROOT=${realReadRoot}`,
        '-D', `WRITE_ROOT=${realWriteRoot}`,
        '-f', profilePath,
        executable,
        ...args.map(String),
      ], { cwd: realCwd, timeoutMs });
    },
    async runPreview() {
      return { status: 'blocked', reason: 'Preview host materialization is required before isolated execution', executed: false };
    },
  };
}
