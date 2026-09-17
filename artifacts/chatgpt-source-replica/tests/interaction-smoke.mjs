import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const baseUrl = process.env.REPLICA_URL ?? 'http://127.0.0.1:4173/artifacts/chatgpt-source-replica/';
const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => consoleErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('h1', { hasText: 'Where should we begin?' }).waitFor();
  assert.equal(await page.locator('#destinationPanel').isVisible(), false);
  assert.equal(await page.locator('.send-button').isVisible(), false);

  await page.getByRole('button', { name: 'Close sidebar' }).click();
  assert.equal(await page.locator('#appShell').evaluate((node) => node.classList.contains('is-collapsed')), true);
  await page.getByRole('button', { name: 'Open sidebar' }).click();

  await page.getByRole('button', { name: 'Search chats' }).click();
  assert.equal(await page.locator('#searchOverlay').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#searchOverlay').isVisible(), false);

  await page.getByRole('button', { name: 'Images Updated' }).click();
  await page.getByRole('heading', { name: 'Images' }).waitFor();
  await page.getByRole('button', { name: 'Back to ChatGPT' }).click();

  await page.getByRole('button', { name: 'Add photos and files' }).click();
  assert.equal(await page.locator('#attachmentMenu').isVisible(), true);
  await page.getByRole('menuitem', { name: /Create image/ }).click();
  await page.getByRole('heading', { name: 'Images' }).waitFor();
  await page.getByRole('button', { name: 'Back to ChatGPT' }).click();

  await page.getByRole('textbox', { name: 'Message ChatGPT' }).fill('Hello from the local replica');
  assert.equal(await page.getByRole('button', { name: 'Send prompt' }).isVisible(), true);
  await page.getByRole('button', { name: 'Send prompt' }).click();
  await page.getByText('This interaction is a visual demo.').waitFor();
  await page.getByRole('button', { name: 'New chat' }).click();
  assert.equal(await page.locator('#conversation').isVisible(), false);

  await page.getByRole('button', { name: 'Log in', exact: true }).last().click();
  assert.equal(await page.locator('#authDialog').evaluate((node) => node.open), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#authDialog').evaluate((node) => node.open), false);

  const microphone = page.locator('[data-action="microphone"]');
  await microphone.click();
  assert.equal(await microphone.getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Start voice mode' }).click();
  assert.equal(await page.locator('#toast').isVisible(), true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open sidebar' }).first().click();
  assert.equal(await page.locator('#appShell').evaluate((node) => node.classList.contains('mobile-sidebar-open')), true);
  await page.locator('#mobileScrim').click({ position: { x: 350, y: 100 } });
  assert.equal(await page.locator('#appShell').evaluate((node) => node.classList.contains('mobile-sidebar-open')), false);

  assert.deepEqual(consoleErrors, []);
  console.log('interaction smoke passed: desktop controls, overlays, local conversation, auth gate and mobile sidebar');
} finally {
  await browser.close();
}
