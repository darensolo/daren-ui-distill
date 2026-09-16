#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requiredFiles = new Set(['component.js', 'styles.css']);

function safeRelative(value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('\\')) throw new Error('INVALID_PUBLIC_PATH');
  const normalized = path.posix.normalize(value);
  if (normalized === '..' || normalized.startsWith('../')) throw new Error('INVALID_PUBLIC_PATH');
  return normalized;
}

export async function prepareConsumer({ packageDirectory, outputDirectory }) {
  const manifest = JSON.parse(await readFile(path.join(packageDirectory, 'asset-package.json'), 'utf8'));
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error('INVALID_ASSET_PACKAGE');
  const declared = new Set(manifest.files.map((entry) => safeRelative(entry.relativePath)));
  for (const required of requiredFiles) if (!declared.has(required)) throw new Error(`MISSING_PUBLIC_EXPORT:${required}`);
  await mkdir(path.join(outputDirectory, 'package'), { recursive: true });
  for (const entry of manifest.files) {
    const relativePath = safeRelative(entry.relativePath);
    const bytes = await readFile(path.join(packageDirectory, relativePath));
    if (digest(bytes) !== entry.digest) throw new Error(`PACKAGE_DIGEST_MISMATCH:${relativePath}`);
    const destination = path.join(outputDirectory, 'package', relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  }
  await writeFile(path.join(outputDirectory, 'package', 'asset-package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(outputDirectory, 'package.json'), await readFile(new URL('./package.template.json', import.meta.url)));
  await writeFile(path.join(outputDirectory, 'index.html'), await readFile(new URL('./index.template.html', import.meta.url)));
  return { status: 'prepared', variant: manifest.variant, files: [...declared].sort() };
}

export async function startConsumerServer(root) {
  const resolvedRoot = path.resolve(root);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const relative = pathname === '/' ? 'index.html' : safeRelative(pathname.slice(1));
      const absolute = path.resolve(resolvedRoot, relative);
      if (absolute !== resolvedRoot && !absolute.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('SCOPE_ESCAPE');
      const bytes = await readFile(absolute);
      response.setHeader('content-type', relative.endsWith('.html') ? 'text/html' : relative.endsWith('.css') ? 'text/css' : relative.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
      response.end(bytes);
    } catch {
      response.statusCode = 404;
      response.end('not found');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
