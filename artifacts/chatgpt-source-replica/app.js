const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const appShell = $('#appShell');
const workspace = $('#workspace');
const prompt = $('#prompt');
const composer = $('#composer');
const sendButton = $('.send-button');
const attachmentMenu = $('#attachmentMenu');
const attachmentButton = $('[data-action="attachments"]');
const searchOverlay = $('#searchOverlay');
const searchInput = $('#searchInput');
const authDialog = $('#authDialog');
const authTitle = $('#authTitle');
const destinationPanel = $('#destinationPanel');
const destinationTitle = $('#destinationTitle');
const destinationCopy = $('#destinationCopy');
const conversation = $('#conversation');
const userMessage = $('#userMessage');
const toast = $('#toast');
const mobileScrim = $('#mobileScrim');
let toastTimer;
let focusReturn = null;

const destinations = {
  images: ['Images', 'Create and explore images in ChatGPT.'],
  plugins: ['Plugins', 'Connect tools and services to extend your chats.'],
  research: ['Deep research', 'Explore complex questions with a structured research workflow.'],
};

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function setActiveNav(route) {
  $$('.nav-row').forEach((button) => {
    const active = route === 'home' ? button.dataset.action === 'new-chat' : button.dataset.route === route;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

function resizePrompt() {
  prompt.style.height = 'auto';
  prompt.style.height = `${Math.min(prompt.scrollHeight, 180)}px`;
  const ready = prompt.value.trim().length > 0;
  sendButton.hidden = !ready;
  $('.voice-button').hidden = ready;
}

function closeAttachmentMenu({ restoreFocus = false } = {}) {
  attachmentMenu.hidden = true;
  attachmentButton.setAttribute('aria-expanded', 'false');
  if (restoreFocus) attachmentButton.focus();
}

function returnHome({ focus = false } = {}) {
  workspace.classList.remove('has-destination', 'has-conversation');
  destinationPanel.hidden = true;
  conversation.hidden = true;
  setActiveNav('home');
  if (focus) prompt.focus();
}

function newChat() {
  returnHome();
  prompt.value = '';
  userMessage.textContent = '';
  resizePrompt();
  closeAttachmentMenu();
  showToast('Started a new local chat');
  prompt.focus();
}

function openDestination(route) {
  const destination = destinations[route];
  if (!destination) return;
  workspace.classList.remove('has-conversation');
  workspace.classList.add('has-destination');
  conversation.hidden = true;
  destinationPanel.hidden = false;
  destinationTitle.textContent = destination[0];
  destinationCopy.textContent = destination[1];
  setActiveNav(route);
  closeAttachmentMenu();
}

function openSearch(trigger) {
  focusReturn = trigger;
  searchOverlay.hidden = false;
  requestAnimationFrame(() => searchInput.focus());
}

function closeSearch() {
  if (searchOverlay.hidden) return;
  searchOverlay.hidden = true;
  searchInput.value = '';
  focusReturn?.focus();
  focusReturn = null;
}

function openAuth(kind, trigger) {
  focusReturn = trigger;
  authTitle.textContent = kind === 'signup' ? 'Sign up for ChatGPT' : 'Log in to ChatGPT';
  if (!authDialog.open) authDialog.showModal();
}

function closeAuth() {
  if (authDialog.open) authDialog.close();
  focusReturn?.focus();
  focusReturn = null;
}

function toggleSidebar() {
  const collapsed = appShell.classList.toggle('is-collapsed');
  const button = $('[data-action="toggle-sidebar"]');
  button.setAttribute('aria-label', collapsed ? 'Open sidebar' : 'Close sidebar');
  button.title = collapsed ? 'Open sidebar' : 'Close sidebar';
  try { localStorage.setItem('chatgpt-replica-sidebar', collapsed ? 'collapsed' : 'expanded'); } catch {}
}

function toggleMobileSidebar(force) {
  const open = typeof force === 'boolean' ? force : !appShell.classList.contains('mobile-sidebar-open');
  appShell.classList.toggle('mobile-sidebar-open', open);
  mobileScrim.hidden = !open;
}

function submitPrompt() {
  const value = prompt.value.trim();
  if (!value) return;
  workspace.classList.remove('has-destination');
  workspace.classList.add('has-conversation');
  destinationPanel.hidden = true;
  conversation.hidden = false;
  userMessage.textContent = value;
  prompt.value = '';
  resizePrompt();
  setActiveNav('home');
  showToast('Rendered locally — nothing was sent');
}

document.addEventListener('click', (event) => {
  const auth = event.target.closest('[data-auth]');
  if (auth) { openAuth(auth.dataset.auth, auth); return; }

  const routeButton = event.target.closest('[data-route]');
  if (routeButton) { openDestination(routeButton.dataset.route); return; }

  const attachmentItem = event.target.closest('[data-attachment]');
  if (attachmentItem) {
    closeAttachmentMenu();
    showToast('Uploads are available on the official site after login');
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) {
    if (!attachmentMenu.hidden && !event.target.closest('#attachmentMenu')) closeAttachmentMenu();
    return;
  }

  const action = actionButton.dataset.action;
  if (action === 'new-chat') newChat();
  if (action === 'toggle-sidebar') toggleSidebar();
  if (action === 'toggle-mobile-sidebar') toggleMobileSidebar();
  if (action === 'close-mobile-sidebar') toggleMobileSidebar(false);
  if (action === 'search-chats') openSearch(actionButton);
  if (action === 'close-search') closeSearch();
  if (action === 'close-auth') closeAuth();
  if (action === 'return-home') returnHome({ focus: true });
  if (action === 'attachments') {
    const willOpen = attachmentMenu.hidden;
    attachmentMenu.hidden = !willOpen;
    attachmentButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) $('[role="menuitem"]', attachmentMenu)?.focus();
  }
  if (action === 'microphone') {
    const active = actionButton.getAttribute('aria-pressed') !== 'true';
    actionButton.setAttribute('aria-pressed', String(active));
    actionButton.classList.toggle('is-listening', active);
    actionButton.setAttribute('aria-label', active ? 'Stop microphone' : 'Use microphone');
    showToast(active ? 'Listening simulation started' : 'Listening simulation stopped');
  }
  if (action === 'voice') showToast('Voice mode is not connected in this local replica');
  if (action === 'model-info') showToast('ChatGPT · public logged-out experience');
  if (action === 'plans') showToast('Plans and pricing are available on the official ChatGPT site');
  if (action === 'settings') showToast('Local replica settings have no account data');
  if (action === 'help') window.open('https://help.openai.com/', '_blank', 'noopener,noreferrer');
});

composer.addEventListener('submit', (event) => { event.preventDefault(); submitPrompt(); });
prompt.addEventListener('input', resizePrompt);
prompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    submitPrompt();
  }
});

searchOverlay.addEventListener('click', (event) => { if (event.target === searchOverlay) closeSearch(); });
authDialog.addEventListener('click', (event) => {
  const rect = authDialog.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside) closeAuth();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!attachmentMenu.hidden) closeAttachmentMenu({ restoreFocus: true });
  else if (!searchOverlay.hidden) closeSearch();
  else if (authDialog.open) closeAuth();
  else if (appShell.classList.contains('mobile-sidebar-open')) toggleMobileSidebar(false);
});

try {
  if (localStorage.getItem('chatgpt-replica-sidebar') === 'collapsed') appShell.classList.add('is-collapsed');
} catch {}
resizePrompt();
