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

  // Two-stage counter so the bubble appears AFTER the user's own message
  // is already in the DOM:
  //   Stage 0: idle
  //   Stage 1: user triggered send — waiting for user message node
  //   Stage 2: user message node seen — typing bubble visible, waiting for agent reply
  let stage = 0;

  // Called whenever the user triggers a send (Enter key or send-button click)
  function onSendTriggered() {
    if (stage !== 0) return; // already in flight
    stage = 1;
  }

  // MutationObserver: every new DOM node that isn't our own bubble counts
  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1 || node.id === 'leumi-typing') continue;

        if (stage === 1) {
          // First new node = user's message. Show bubble and advance.
          stage = 2;
          showTyping();
        } else if (stage === 2) {
          // Second new node = agent's reply. Hide bubble and reset.
          hideTyping();
          stage = 0;
        }
      }
    }
  });
  observer.observe(container, { childList: true });

  // Attach send-event listeners via delegation on the widget window
  const chatWindow = document.querySelector(WINDOW_SELECTOR);
  if (chatWindow) {
    // Enter key in the input field
    chatWindow.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      const input = e.target.closest('input, textarea');
      if (input && input.value.trim()) onSendTriggered();
    }, true);

    // Click on the send / submit button
    chatWindow.addEventListener('click', (e) => {
      if (e.target.closest(SEND_BTN_SELECTOR)) {
        const input = chatWindow.querySelector(INPUT_SELECTOR);
        if (input && input.value.trim()) onSendTriggered();
      }
    }, true);
  }

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

function tryOpenWidget() {
  for (const sel of LAUNCHER_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && !el.closest(WINDOW_SELECTOR)) {
      el.click();
      // Immediately hide it again after the click opens the window
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
