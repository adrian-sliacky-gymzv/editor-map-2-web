/* Shared small UI helpers for the classic/editor part of the app. */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

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
  overlay._previousFocus = document.activeElement;
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  document.body.classList.add('has-classic-overlay');
  overlay.addEventListener('keydown', trapOverlayFocus);
  if (focus) setTimeout(() => focus.focus?.(), 30);
}

export function closeOverlay(overlay) {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.removeEventListener('keydown', trapOverlayFocus);
  const previous = overlay._previousFocus;
  overlay._previousFocus = null;
  if (previous && typeof previous.focus === 'function' && document.documentElement.contains(previous)) {
    setTimeout(() => previous.focus(), 30);
  }
  setTimeout(() => {
    if (!overlay.classList.contains('is-open')) overlay.hidden = true;
    if (!document.querySelector('.overlay.is-open')) document.body.classList.remove('has-classic-overlay');
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
