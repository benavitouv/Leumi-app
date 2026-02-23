// app.js — Leumi AI chat initialisation helper

/* ── Markdown link renderer ─────────────────────────────────────────────── */

// Matches [label](url) OR bare https?:// URLs in a single pass.
// Group 1+2 = markdown link, group 3 = bare URL.
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>"')\]]+)/g;

/**
 * Walk every text node inside `el` and replace markdown link syntax and
 * bare URLs with real <a> elements.  Safe — no innerHTML with user content.
 */
function renderLinks(el) {
  if (!el || el.id === 'leumi-typing') return;

  // Collect text nodes first (TreeWalker is invalidated by DOM mutations)
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) textNodes.push(n);

  textNodes.forEach((textNode) => {
    const raw = textNode.nodeValue;
    // Quick bail-out — no URL-like content
    if (!raw.includes('http')) return;

    LINK_RE.lastIndex = 0;
    let match;
    let lastIdx = 0;
    const frag = document.createDocumentFragment();
    let replaced = false;

    while ((match = LINK_RE.exec(raw)) !== null) {
      replaced = true;
      if (match.index > lastIdx) {
        frag.appendChild(document.createTextNode(raw.slice(lastIdx, match.index)));
      }
      const a = document.createElement('a');
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      if (match[1] && match[2]) {
        // Markdown link: [label](url)
        a.href = match[2];
        a.textContent = match[1];
      } else {
        // Bare URL
        a.href = match[3];
        a.textContent = match[3];
      }
      frag.appendChild(a);
      lastIdx = match.index + match[0].length;
    }

    if (!replaced) return;
    if (lastIdx < raw.length) {
      frag.appendChild(document.createTextNode(raw.slice(lastIdx)));
    }
    textNode.parentNode.replaceChild(frag, textNode);
  });
}

/* ── Typing bubble ───────────────────────────────────────────────────────── */

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

  // Apply to messages already in the DOM when observation starts
  container.querySelectorAll('[class*="message"], [class*="msg"]').forEach(renderLinks);

  // MutationObserver on the messages container
  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1 || node.id === 'leumi-typing') continue;

        // Render markdown / bare URLs in every new message node
        renderLinks(node);

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
    setInterval(hideLaunchers, 500);
  }

  if (!watchingMessages) watchingMessages = watchMessages();

  if (!watchingMessages && ++polls < MAX_POLLS) {
    setTimeout(poll, POLL_INTERVAL);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', poll);
} else {
  poll();
}
