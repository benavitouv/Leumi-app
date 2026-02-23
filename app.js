// app.js — Leumi AI chat initialisation helper

/* ── Typing bubble ─────────────────────────────────────────────────────── */

const MSGS_SELECTOR =
  '[class*="wonderful"][class*="messages"], .wonderful-chat-messages';

function createTypingBubble() {
  const wrap = document.createElement('div');
  wrap.id = 'leumi-typing';
  // The > * centering rule in styles.css targets direct children of the
  // messages container, so this div inherits max-width + auto margins.
  wrap.innerHTML =
    '<div class="leumi-typing">' +
      '<span class="leumi-typing__dot"></span>' +
      '<span class="leumi-typing__dot"></span>' +
      '<span class="leumi-typing__dot"></span>' +
    '</div>';
  return wrap;
}

function showTyping() {
  if (document.getElementById('leumi-typing')) return; // already shown
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

  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1 || node.id === 'leumi-typing') continue;
        if (/user/i.test(node.className)) {
          // User just sent — show typing indicator
          showTyping();
        } else if (/agent|bot|assistant/i.test(node.className)) {
          // Agent replied — remove indicator
          hideTyping();
        }
      }
    }
  });

  observer.observe(container, { childList: true });
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
