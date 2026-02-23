// app.js — Leumi AI chat initialisation helper

/* ── Typing bubble ─────────────────────────────────────────────────────── */

const MSGS_SELECTOR =
  '[class*="wonderful"][class*="messages"], .wonderful-chat-messages';

// Selectors for the text input and send button inside the widget
const INPUT_SELECTOR =
  '[class*="wonderful"][class*="footer"] input, ' +
  '[class*="wonderful"][class*="input"]:not([class*="button"]), ' +
  '.wonderful-chat-footer input';

const SEND_BTN_SELECTOR =
  '[class*="wonderful"][class*="send"], ' +
  '[class*="wonderful"][class*="submit"], ' +
  '[class*="wonderful"][class*="footer"] button';

function createTypingBubble() {
  const wrap = document.createElement('div');
  wrap.id = 'leumi-typing';
  wrap.innerHTML =
    '<div class="leumi-typing">' +
      '<span class="leumi-typing__dot"></span>' +
      '<span class="leumi-typing__dot"></span>' +
      '<span class="leumi-typing__dot"></span>' +
    '</div>';
  return wrap;
}

function showTyping() {
  if (document.getElementById('leumi-typing')) return;
  const container = document.querySelector(MSGS_SELECTOR);
  if (!container) return;
  container.appendChild(createTypingBubble());
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  document.getElementById('leumi-typing')?.remove();
}

function watchMessages() {
  const container = document.querySelector(MSGS_SELECTOR);
  if (!container) return false;

  // Two-stage counter:
  //   0 = idle
  //   1 = send fired, waiting for user message node to land in DOM
  //   2 = user message seen, typing bubble visible, waiting for agent reply
  let stage = 0;
  let safetyTimer = null;

  function resetStage() {
    clearTimeout(safetyTimer);
    safetyTimer = null;
    hideTyping();
    stage = 0;
  }

  function onSendTriggered() {
    if (stage !== 0) return;
    stage = 1;
    // Safety net: if the agent never replies (e.g. empty send), reset after 20s
    safetyTimer = setTimeout(resetStage, 20000);
  }

  // MutationObserver on the messages container
  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1 || node.id === 'leumi-typing') continue;
        if (stage === 1) {
          // First new node = user's own message bubble → show typing
          stage = 2;
          showTyping();
        } else if (stage === 2) {
          // Second new node = agent reply → hide typing
          resetStage();
        }
      }
    }
  });
  observer.observe(container, { childList: true });

  // Use document-level CAPTURE listeners so we fire before the widget's
  // own handlers, and don't rely on input.value (which may already be
  // cleared by the time we read it).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    const chatWindow = document.querySelector(WINDOW_SELECTOR);
    if (!chatWindow) return;
    if (!chatWindow.contains(document.activeElement)) return;
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') onSendTriggered();
  }, true);

  document.addEventListener('click', (e) => {
    const chatWindow = document.querySelector(WINDOW_SELECTOR);
    if (!chatWindow || !chatWindow.contains(e.target)) return;
    if (e.target.closest(SEND_BTN_SELECTOR)) onSendTriggered();
  }, true);

  return true;
}

/* ── Launcher / widget init ────────────────────────────────────────────── */

const POLL_INTERVAL = 200;
const MAX_POLLS = 50; // ~10 s

// Selectors that could match the floating launcher FAB
const LAUNCHER_SELECTORS = [
  '[class*="wonderful"][class*="button"]',
  '[class*="wonderful"][class*="launcher"]',
  '[class*="wonderful"][class*="toggle"]',
  '[class*="wonderful"][class*="fab"]',
  '.wonderful-chat-button',
];

// Selectors that match the main chat window (we want this to stay visible)
const WINDOW_SELECTOR = '[class*="wonderful"][class*="window"], .wonderful-chat-window';

function hideLaunchers() {
  LAUNCHER_SELECTORS.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      // Don't hide anything that is part of the main chat window
      if (!el.closest(WINDOW_SELECTOR)) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      }
    });
  });
}

let polls = 0;
let hasOpenedWidget = false;

function tryOpenWidget() {
  if (hasOpenedWidget) return true;
  for (const sel of LAUNCHER_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && !el.closest(WINDOW_SELECTOR)) {
      el.click();
      hasOpenedWidget = true;
      setTimeout(hideLaunchers, 50);
      return true;
    }
  }
  return false;
}

let watchingMessages = false;

function poll() {
  hideLaunchers();
  if (tryOpenWidget()) {
    // Keep hiding in case the widget re-shows the button
    setInterval(hideLaunchers, 500);
  }

  // Start watching messages as soon as the container exists
  if (!watchingMessages) {
    watchingMessages = watchMessages();
  }

  if (!watchingMessages && ++polls < MAX_POLLS) {
    setTimeout(poll, POLL_INTERVAL);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', poll);
} else {
  poll();
}
