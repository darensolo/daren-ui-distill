import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [html, css, js, baseline, plan] = await Promise.all([
  readFile(path.join(root, 'index.html'), 'utf8'),
  readFile(path.join(root, 'styles.css'), 'utf8'),
  readFile(path.join(root, 'app.js'), 'utf8'),
  readFile(path.join(root, 'baseline.md'), 'utf8'),
  readFile(path.join(root, 'plan.md'), 'utf8'),
]);

for (const label of [
  'New chat', 'Search chats', 'Images', 'Plugins', 'Deep research', 'Chat history',
  'See plans and pricing', 'Settings', 'Help', 'Get responses tailored to you',
  'Log in', 'Sign up for free', 'Where should we begin?', 'Ask anything',
]) assert.ok(html.includes(label), `missing observed label: ${label}`);

for (const action of [
  'new-chat', 'search-chats', 'toggle-sidebar', 'toggle-mobile-sidebar', 'plans',
  'settings', 'help', 'model-info', 'attachments', 'microphone', 'voice',
  'return-home', 'close-search', 'close-auth',
]) {
  assert.ok(html.includes(`data-action="${action}"`), `missing action control: ${action}`);
  assert.ok(js.includes(`action === '${action}'`) || js.includes(`action === \"${action}\"`) || ['close-search', 'close-auth'].includes(action), `missing action handler: ${action}`);
}

assert.match(html, /<textarea[^>]+aria-label="Message ChatGPT"/);
assert.match(html, /<dialog[^>]+id="authDialog"/);
assert.match(html, /role="dialog" aria-modal="true"/);
assert.match(css, /--cg-sidebar-w:\s*260px/);
assert.match(css, /--cg-composer-w:\s*768px/);
assert.match(css, /@media \(max-width: 680px\)/);
assert.match(css, /:focus-visible/);
assert.match(js, /localStorage\.setItem\('chatgpt-replica-sidebar'/);
assert.match(baseline, /observationStatus|Capture limitation|Known gaps/i);
assert.match(plan, /INT-014/);

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'duplicate ids found');

const visibleButtons = [...html.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
assert.ok(visibleButtons.length >= 20, 'expected a fully interactive shell');
for (const button of visibleButtons) {
  assert.ok(/data-(?:action|route|auth|attachment)=|type="submit"/.test(button), `button lacks an interaction binding: ${button}`);
}

console.log(`verified ${visibleButtons.length} interactive buttons, ${ids.length} unique ids, responsive and accessibility contracts`);
