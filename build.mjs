#!/usr/bin/env node
import { buildCodexDistribution } from './plugins/codex/scripts/build.mjs';
import { buildQoderDistribution } from './plugins/qoder/scripts/build.mjs';

const args = process.argv.slice(2);
let target = 'codex';
let output;
let invalid = false;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (!['--target', '--out'].includes(argument) || !args[index + 1]) { invalid = true; break; }
  const value = args[++index];
  if (argument === '--target') target = value;
  else output = value;
}
const builders = { codex: buildCodexDistribution, qoder: buildQoderDistribution };
if (invalid || !output || !builders[target]) {
  process.stderr.write('usage: node build.mjs [--target codex|qoder] --out <new-output-directory>\n');
  process.exitCode = 2;
} else {
  builders[target](output).then(
    (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
    (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; },
  );
}
