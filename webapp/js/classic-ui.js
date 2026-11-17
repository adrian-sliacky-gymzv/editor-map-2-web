/* Shared small UI helpers for the classic/editor part of the app. */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const heightAnimations = new WeakMap();

/**
 * Run a DOM mutation that may change an element's natural height and animate
 * the height change instead of letting the surrounding layout jump. The old
 * height is locked before the mutation, the new natural height is measured
 * without painting the intermediate state, and the element then transitions
 * between the two. Used by the mission HUD when a target name wraps to a
 * second line. Reduced-motion visitors get the new layout immediately.
 */
export function animateHeightChange(element, mutate, {
  duration = 180,
  easing = 'cubic-bezier(0.2, 0.7, 0.3, 1)',
} = {}) {
  if (!element || typeof element.getBoundingClientRect !== 'function') {
    mutate();
    return;
  }

  // Capture the current painted height first so an interrupted animation
  // continues from where it is instead of snapping to its target.
  const before = element.getBoundingClientRect().height;
  const running = heightAnimations.get(element);
  if (running) {
    cancelAnimationFrame(running.frame);
    clearTimeout(running.timer);
    heightAnimations.delete(element);
    element.style.height = '';
    element.style.transition = '';
  }

  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced || before <= 0 || element.offsetParent === null) {
    mutate();
    return;
  }

  // Lock the starting height so the text mutation cannot make the page jump
  // before we know how tall the new content is.
  element.style.transition = 'none';
  element.style.height = `${before}px`;
  void element.offsetHeight;
  mutate();

  // Measure the natural target height. Setting height:auto and putting the
  // locked height back happens in the same task, so the browser never paints
  // the intermediate layout.
  element.style.height = 'auto';
  const after = element.getBoundingClientRect().height;
  element.style.height = `${before}px`;
  void element.offsetHeight;

  if (Math.abs(after - before) < 0.5) {
    element.style.height = '';
    element.style.transition = '';
    return;
  }

  const state = { frame: 0, timer: 0 };
  heightAnimations.set(element, state);
  element.style.transition = `height ${duration}ms ${easing}`;
  state.frame = requestAnimationFrame(() => {
    if (heightAnimations.get(element) !== state) return;
    element.style.height = `${after}px`;
  });

  const finish = () => {
    if (heightAnimations.get(element) !== state) return;
    heightAnimations.delete(element);
    element.style.height = '';
    element.style.transition = '';
  };
  element.addEventListener('transitionend', (event) => {
    if (event.target === element && event.propertyName === 'height') finish();
  }, { once: true });
  state.timer = setTimeout(finish, duration + 80);
}

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

export function formatClock(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let toastTimer = null;

export function toast(message, tone = 'info', ms = 2800) {
  const el = document.getElementById('classicToast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = message;
  el.dataset.tone = tone;
  el.hidden = false;
  el.classList.add('is-visible');
  toastTimer = setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => {
      if (!el.classList.contains('is-visible')) el.hidden = true;
    }, 220);
  }, ms);
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function trapOverlayFocus(event) {
  if (event.key !== 'Tab') return;
  const overlay = event.currentTarget;
  const items = Array.from(overlay.querySelectorAll(FOCUSABLE)).filter((el) => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function openOverlay(overlay, focus = null) {
  if (!overlay) return;
  overlay._openToken = (overlay._openToken || 0) + 1;
  const token = overlay._openToken;
  clearTimeout(overlay._closeTimer);
  clearTimeout(overlay._focusTimer);
  overlay._previousFocus = document.activeElement;
  overlay.hidden = false;
  overlay.classList.add('is-open');
  document.body.classList.add('has-classic-overlay');
  overlay.addEventListener('keydown', trapOverlayFocus);
  if (focus) {
    overlay._focusTimer = setTimeout(() => {
      if (overlay._openToken === token) focus.focus?.();
    }, 30);
  }
}

export function closeOverlay(overlay) {
  if (!overlay) return;
  overlay._openToken = (overlay._openToken || 0) + 1;
  const token = overlay._openToken;
  clearTimeout(overlay._closeTimer);
  clearTimeout(overlay._focusTimer);
  overlay.classList.remove('is-open');
  overlay.removeEventListener('keydown', trapOverlayFocus);
  const previous = overlay._previousFocus;
  overlay._previousFocus = null;
  if (previous && typeof previous.focus === 'function' && document.documentElement.contains(previous)) {
    setTimeout(() => {
      if (overlay._openToken === token && overlay.hidden) previous.focus();
    }, 30);
  }
  overlay._closeTimer = setTimeout(() => {
    if (overlay._openToken === token && !overlay.classList.contains('is-open')) {
      overlay.hidden = true;
      if (!document.querySelector('.overlay.is-open')) document.body.classList.remove('has-classic-overlay');
    }
  }, 160);
}

export function confirmDialog({
  title = 'Potvrdenie',
  message = '',
  okLabel = 'OK',
  cancelLabel = 'Zrušiť',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('classicConfirmOverlay');
    if (!overlay) {
      resolve(window.confirm(message || title));
      return;
    }
    const titleEl = document.getElementById('classicConfirmTitle');
    const msgEl = document.getElementById('classicConfirmMessage');
    const okBtn = document.getElementById('classicConfirmOk');
    const cancelBtn = document.getElementById('classicConfirmCancel');
    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = okLabel;
    okBtn.classList.toggle('btn-danger', danger);
    okBtn.classList.toggle('btn-primary', !danger);
    cancelBtn.textContent = cancelLabel;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      closeOverlay(overlay);
      resolve(value);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onBackdrop = (event) => {
      if (event.target === overlay) finish(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
    openOverlay(overlay, okBtn);
  });
}

export function promptDialog({
  title = 'Názov',
  label = 'Názov súboru',
  value = '',
  okLabel = 'Uložiť',
  cancelLabel = 'Zrušiť',
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('classicPromptOverlay');
    if (!overlay) {
      resolve(window.prompt(title, value));
      return;
    }
    const titleEl = document.getElementById('classicPromptTitle');
    const labelEl = document.getElementById('classicPromptLabel');
    const input = document.getElementById('classicPromptInput');
    const okBtn = document.getElementById('classicPromptOk');
    const cancelBtn = document.getElementById('classicPromptCancel');
    titleEl.textContent = title;
    labelEl.textContent = label;
    input.value = value;
    okBtn.textContent = okLabel;
    cancelBtn.textContent = cancelLabel;
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', onBackdrop);
      closeOverlay(overlay);
      resolve(result);
    };
    const onOk = () => finish(input.value.trim() || value);
    const onCancel = () => finish(null);
    const onKey = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onOk();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    const onBackdrop = (event) => {
      if (event.target === overlay) onCancel();
    };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
    overlay.addEventListener('click', onBackdrop);
    openOverlay(overlay, input);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 40);
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function setPressed(button, pressed) {
  if (!button) return;
  button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  button.classList.toggle('is-active', pressed);
}

export async function copyText(text) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function announce(message) {
  const el = document.getElementById('classicSr');
  if (el) el.textContent = message;
}
