import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lookup as dnsLookup } from 'node:dns/promises';

import { DistillError, fail } from '../errors.mjs';
import { isPublicNetworkAddress, normalizePublicWebUrl } from '../web-capture.mjs';

const executableCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

const computedStyles = [
  'display', 'position', 'box-sizing', 'width', 'height', 'min-width', 'min-height',
  'max-width', 'max-height', 'margin', 'padding', 'gap', 'grid-template-columns',
  'grid-template-rows', 'flex-direction', 'align-items', 'justify-content',
  'overflow', 'color', 'background-color', 'border', 'border-radius', 'box-shadow',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'opacity', 'transform', 'transition', 'z-index',
];

async function executable(pathname) {
  try { await access(pathname, 1); return true; } catch { return false; }
}

export async function findChromiumExecutable(preferred = process.env.UI_DISTILLER_BROWSER_PATH) {
  for (const candidate of [preferred, ...executableCandidates].filter(Boolean)) {
    if (await executable(candidate)) return candidate;
  }
  return null;
}

async function resolvePublicHost(hostname) {
  let answers;
  try { answers = await dnsLookup(hostname, { all: true, verbatim: true }); }
  catch (error) { fail('WEB_CAPTURE_DNS_FAILED', `cannot resolve ${hostname}: ${error.message}`, { retryable: true }); }
  if (!answers.length || answers.some((entry) => !isPublicNetworkAddress(entry.address))) {
    fail('WEB_CAPTURE_NETWORK_BLOCKED', `web capture blocked a non-public address for ${hostname}`);
  }
  return answers;
}

async function createPinnedHttpsProxy() {
  const resolutions = new Map();
  const sockets = new Set();
  const blockedErrors = new Map();
  const server = createServer((request, response) => {
    response.writeHead(403, { connection: 'close', 'content-type': 'text/plain' });
    response.end('HTTPS CONNECT required');
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  server.on('connect', (request, client, head) => {
    void (async () => {
      let target;
      try { target = new URL(`https://${request.url}`); }
      catch { client.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return; }
      if (target.port && target.port !== '443') {
        client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return;
      }
      const hostname = target.hostname.toLowerCase();
      if (!hostname || request.headers['proxy-authorization']) {
        client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return;
      }
      try {
        normalizePublicWebUrl(`https://${hostname}/`);
        const answers = await resolvePublicHost(hostname);
        resolutions.set(hostname, answers.map((entry) => entry.address));
        const selected = answers.find((entry) => entry.family === 4) ?? answers[0];
        const upstream = connect({ host: selected.address, port: 443, family: selected.family });
        sockets.add(upstream);
        upstream.once('close', () => sockets.delete(upstream));
        upstream.setTimeout(30_000, () => upstream.destroy(new Error('upstream timeout')));
        upstream.once('error', () => client.destroy());
        upstream.once('connect', () => {
          client.write('HTTP/1.1 200 Connection Established\r\nProxy-Agent: UI-Distiller\r\n\r\n');
          if (head.length) upstream.write(head);
          client.pipe(upstream);
          upstream.pipe(client);
        });
      } catch (error) {
        blockedErrors.set(hostname, error);
        client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      }
    })();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    resolvedAddresses() {
      return [...resolutions].flatMap(([hostname, addresses]) => addresses.map((address) => ({ hostname, address })));
    },
    blockedErrorFor(urls) {
      for (const value of urls) {
        const error = blockedErrors.get(new URL(value).hostname.toLowerCase());
        if (error) return error;
      }
      return null;
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function waitForDevTools(child, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error('Chromium DevTools endpoint timed out')), timeoutMs);
    const finish = (callback, value) => { clearTimeout(timer); callback(value); };
    child.once('error', (error) => finish(reject, error));
    child.once('exit', (code, signal) => finish(reject, new Error(`Chromium exited before capture (${signal ?? code})`)));
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      const matched = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (matched) finish(resolve, matched[1]);
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-32 * 1024);
    });
  });
}

async function openCdp(endpoint) {
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('cannot connect to Chromium DevTools')), { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
      else request.resolve(message.result ?? {});
      return;
    }
    for (const listener of listeners) listener(message);
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) request.reject(new Error('Chromium DevTools connection closed'));
    pending.clear();
  });
  return {
    send(method, params = {}, sessionId) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    waitFor(method, { sessionId, timeoutMs, predicate = () => true } = {}) {
      let cancel;
      const promise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { listeners.delete(listener); reject(new Error(method + ' timed out')); }, timeoutMs ?? 30_000);
        const listener = (message) => {
          if (message.method !== method || (sessionId && message.sessionId !== sessionId) || !predicate(message.params ?? {})) return;
          clearTimeout(timer);
          listeners.delete(listener);
          resolve(message.params ?? {});
        };
        cancel = () => { clearTimeout(timer); listeners.delete(listener); resolve({ cancelled: true }); };
        listeners.add(listener);
      });
      Object.defineProperty(promise, 'cancel', { value: cancel });
      return promise;
    },
    observe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    close() { socket.close(); },
  };
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
}

async function captureWithChromium({ executablePath, url, viewport, theme, locale, maxRedirects, timeoutMs }) {
  const normalizedUrl = normalizePublicWebUrl(url);
  const profile = await mkdtemp(path.join(tmpdir(), 'ui-distiller-web-'));
  const proxy = await createPinnedHttpsProxy();
  let child;
  let cdp;
  let browserContextId;
  try {
    child = spawn(executablePath, [
      '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-component-update', '--disable-default-apps', '--disable-domain-reliability', '--disable-sync',
      '--disable-extensions', '--disable-features=ServiceWorker,Translate,MediaRouter', '--disable-quic',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--hide-scrollbars', '--mute-audio',
      `--user-data-dir=${profile}`, `--proxy-server=${proxy.url}`, '--proxy-bypass-list=<-loopback>',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-port=0', 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'], shell: false });
    cdp = await openCdp(await waitForDevTools(child));
    ({ browserContextId } = await cdp.send('Target.createBrowserContext', { disposeOnDetach: true }));
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny', browserContextId });
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const networkUrls = new Set();
    const redirects = [];
    let documentFailure = null;
    let mainFrameId = null;
    const stopObserving = cdp.observe((message) => {
      if (message.sessionId !== sessionId) return;
      const params = message.params ?? {};
      if (message.method === 'Network.requestWillBeSent') {
        if (params.request?.url?.startsWith('https://')) networkUrls.add(normalizePublicWebUrl(params.request.url));
        if (params.type === 'Document' && params.frameId === mainFrameId && params.redirectResponse) redirects.push(normalizePublicWebUrl(params.request.url));
      }
      if (message.method === 'Network.loadingFailed' && params.type === 'Document' && params.frameId === mainFrameId) documentFailure = params.errorText ?? 'document load failed';
    });
    await Promise.all([
      cdp.send('Page.enable', {}, sessionId),
      cdp.send('Runtime.enable', {}, sessionId),
      cdp.send('Network.enable', {}, sessionId),
      cdp.send('Accessibility.enable', {}, sessionId),
    ]);
    const frameTree = await cdp.send('Page.getFrameTree', {}, sessionId);
    mainFrameId = frameTree.frameTree?.frame?.id ?? null;
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
    await cdp.send('Network.setBypassServiceWorker', { bypass: true }, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen', features: [{ name: 'prefers-color-scheme', value: theme }],
    }, sessionId);
    await cdp.send('Emulation.setLocaleOverride', { locale }, sessionId);
    const loaded = cdp.waitFor('Page.loadEventFired', { sessionId, timeoutMs });
    let navigation;
    try { navigation = await cdp.send('Page.navigate', { url: normalizedUrl }, sessionId); }
    catch (error) {
      loaded.cancel();
      throw proxy.blockedErrorFor([normalizedUrl, ...networkUrls]) ?? error;
    }
    mainFrameId = navigation.frameId ?? null;
    if (navigation.errorText) {
      loaded.cancel();
      const blocked = proxy.blockedErrorFor([normalizedUrl, ...networkUrls]);
      if (blocked) throw blocked;
      fail('WEB_CAPTURE_NAVIGATION_FAILED', navigation.errorText, { retryable: true });
    }
    try { await loaded; }
    catch (error) { throw proxy.blockedErrorFor([normalizedUrl, ...networkUrls]) ?? error; }
    const blocked = proxy.blockedErrorFor([normalizedUrl, ...networkUrls]);
    if (blocked) throw blocked;
    if (documentFailure) fail('WEB_CAPTURE_NAVIGATION_FAILED', documentFailure, { retryable: true });
    if (redirects.length > maxRedirects) fail('WEB_CAPTURE_REDIRECT_LIMIT', `web capture exceeded ${maxRedirects} redirects`);
    await cdp.send('Runtime.evaluate', {
      expression: 'document.fonts ? document.fonts.ready : Promise.resolve()', awaitPromise: true, returnByValue: true,
    }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const page = await cdp.send('Runtime.evaluate', {
      expression: '({ url: location.href, html: document.documentElement.outerHTML })', returnByValue: true,
    }, sessionId);
    const finalUrl = normalizePublicWebUrl(page.result?.value?.url);
    networkUrls.add(finalUrl);
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
    const accessibility = await cdp.send('Accessibility.getFullAXTree', {}, sessionId);
    const styles = await cdp.send('DOMSnapshot.captureSnapshot', {
      computedStyles, includePaintOrder: true, includeDOMRects: true, includeBlendedBackgroundColors: true,
    }, sessionId);
    stopObserving();
    return {
      finalUrl,
      redirects,
      networkUrls: [...networkUrls].sort(),
      resolvedAddresses: proxy.resolvedAddresses(),
      artifacts: [
        { kind: 'static', relativePath: 'dom.html', content: page.result?.value?.html ?? '' },
        { kind: 'screenshot', relativePath: 'page.png', bytes: Buffer.from(screenshot.data, 'base64') },
        { kind: 'accessibility', relativePath: 'accessibility.json', content: `${JSON.stringify(accessibility)}\n` },
        { kind: 'computed-style', relativePath: 'computed-style.json', content: `${JSON.stringify(styles)}\n` },
      ],
    };
  } finally {
    if (cdp && browserContextId) {
      try { await cdp.send('Target.disposeBrowserContext', { browserContextId }); } catch {}
    }
    cdp?.close();
    if (child) await stopChild(child);
    await proxy.close();
    await rm(profile, { recursive: true, force: true });
  }
}

export async function createChromiumWebCaptureDriver({ executablePath } = {}) {
  const resolvedExecutable = await findChromiumExecutable(executablePath);
  if (!resolvedExecutable) {
    return {
      capability: { status: 'unavailable', reason: 'Chrome, Chromium, Edge, or Brave was not found; set UI_DISTILLER_BROWSER_PATH' },
      async capture() { fail('WEB_CAPTURE_DRIVER_UNAVAILABLE', 'no supported Chromium executable was found'); },
    };
  }
  return {
    capability: {
      status: 'available', isolation: 'ephemeral-profile', credentials: 'none', networkPolicy: 'public-only',
      downloads: 'blocked', extensions: 'blocked', serviceWorkers: 'blocked', executablePath: resolvedExecutable,
    },
    async capture(request) {
      try { return await captureWithChromium({ ...request, executablePath: resolvedExecutable }); }
      catch (error) {
        if (error instanceof DistillError) throw error;
        if (/timed out/i.test(error.message)) fail('WEB_CAPTURE_TIMEOUT', error.message, { retryable: true });
        fail('WEB_CAPTURE_DRIVER_FAILED', error.message, { retryable: true });
      }
    },
  };
}
