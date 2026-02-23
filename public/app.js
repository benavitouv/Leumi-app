// app.js — Leumi AI chat initialisation helper
// The WonderfulChat widget is loaded and auto-opened from index.html.
// This file watches for the widget to appear and applies any
// runtime tweaks that CSS alone cannot handle.

const POLL_INTERVAL = 200;
const MAX_POLLS = 50; // ~10 s

let polls = 0;

function tryOpenWidget() {
  // Common selectors used by chat-widget launchers
  const candidates = [
    '[class*="wonderful"][class*="button"]',
    '[class*="wonderful"][class*="launcher"]',
    '[class*="wonderful"][class*="toggle"]',
    '.wonderful-chat-button',
  ];

  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) {
      el.click();
      return true;
    }
  }
  return false;
}

function poll() {
  if (tryOpenWidget()) return;
  if (++polls < MAX_POLLS) setTimeout(poll, POLL_INTERVAL);
}

// Start polling once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', poll);
} else {
  poll();
}
