#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../runtime/packages/cli/main.mjs', import.meta.url));
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  shell: false,
});
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exitCode = 1;
} else if (result.signal) {
  process.stderr.write(`runtime terminated by ${result.signal}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
