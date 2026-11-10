/* ------------------------------------------------------------------------- */
/* Subtle UI sounds                                                          */
/*                                                                           */
/* Generated with Web Audio: short sine/triangle tones, gentle envelopes and  */
/* no external files. The audio context is created lazily inside a user       */
/* gesture, and the mute preference is stored locally.                        */
/* ------------------------------------------------------------------------- */

import { t } from './i18n.js';

export const SOUND_KEY = 'editorMap2.sound.v1';

let muted = false;
let started = false;
let ctx = null;
let master = null;

function readMuted() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(SOUND_KEY) === 'muted';
  } catch {
    return false;
  }
}

function saveMuted(value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SOUND_KEY, value ? 'muted' : 'on');
  } catch {
    /* the game still works without storage */
  }
}

function audioContext() {
  if (muted || typeof window === 'undefined' || document.hidden) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!ctx) {
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = 0.62;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function note({
  frequency,
  endFrequency = null,
  delay = 0,
  duration = 0.12,
  gain = 0.035,
  type = 'sine',
  detune = 0,
}) {
  const audio = audioContext();
  if (!audio || !master) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const envelope = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (endFrequency && endFrequency !== frequency) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
  }
  osc.detune.setValueAtTime(detune, start);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(envelope);
  envelope.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function play(notes) {
  if (muted) return;
  for (const item of notes) note(item);
}

export function isMuted() {
  return muted;
}

export function isSoundAvailable() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.AudioContext || window.webkitAudioContext);
}

export function syncSoundControls() {
  if (typeof document === 'undefined') return;
  for (const button of document.querySelectorAll('[data-sound-toggle]')) {
    button.setAttribute('aria-pressed', String(!muted));
    const label = t(muted ? 'Zvuk vypnutý' : 'Zvuk zapnutý');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  }
  for (const state of document.querySelectorAll('[data-sound-state]')) {
    state.textContent = t(muted ? 'Vypnutý' : 'Zapnutý');
  }
  for (const checkbox of document.querySelectorAll('[data-sound-checkbox]')) {
    checkbox.checked = !muted;
  }
}

export function setMuted(value, options = {}) {
  muted = Boolean(value);
  saveMuted(muted);
  if (master && ctx) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(muted ? 0 : 0.62, now, 0.012);
  }
  syncSoundControls();
  if (!muted && options.confirm !== false) {
    play([{ frequency: 587.33, duration: 0.08, gain: 0.022 }]);
  }
  return muted;
}

export function toggleMuted() {
  return setMuted(!muted);
}

export function playCorrect(strong = false) {
  if (muted) return;
  play([
    { frequency: 659.25, duration: 0.11, gain: 0.03 },
    { frequency: 987.77, delay: 0.065, duration: 0.16, gain: 0.026 },
    ...(strong ? [{ frequency: 1318.51, delay: 0.13, duration: 0.18, gain: 0.018 }] : []),
  ]);
}

export function playWrong() {
  if (muted) return;
  play([
    {
      frequency: 196,
      endFrequency: 164.81,
      duration: 0.14,
      gain: 0.032,
      type: 'triangle',
    },
  ]);
}

export function playNeutral() {
  if (muted) return;
  play([{ frequency: 440, duration: 0.08, gain: 0.022 }]);
}

export function playScore(score) {
  const value = Number(score) || 0;
  if (value >= 90) playCorrect(true);
  else if (value >= 70) playCorrect(false);
  else if (value > 0) playNeutral();
  else playWrong();
}

export function playResult(percent) {
  const value = Number(percent) || 0;
  if (value >= 90) {
    play([
      { frequency: 523.25, duration: 0.13, gain: 0.028 },
      { frequency: 659.25, delay: 0.075, duration: 0.14, gain: 0.026 },
      { frequency: 783.99, delay: 0.15, duration: 0.15, gain: 0.024 },
      { frequency: 1046.5, delay: 0.23, duration: 0.22, gain: 0.016 },
    ]);
  } else if (value >= 70) {
    play([
      { frequency: 523.25, duration: 0.12, gain: 0.025 },
      { frequency: 659.25, delay: 0.08, duration: 0.16, gain: 0.023 },
    ]);
  } else {
    play([
      { frequency: 392, duration: 0.11, gain: 0.024 },
      { frequency: 329.63, delay: 0.09, duration: 0.16, gain: 0.021 },
    ]);
  }
}

export function initSound() {
  if (started || typeof document === 'undefined') return;
  started = true;
  muted = readMuted();
  syncSoundControls();

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest?.('[data-sound-toggle]');
    if (!toggle) return;
    event.preventDefault();
    toggleMuted();
  });

  document.addEventListener('change', (event) => {
    const checkbox = event.target.closest?.('[data-sound-checkbox]');
    if (!checkbox) return;
    setMuted(!checkbox.checked);
  });

  window.addEventListener('i18n:change', syncSoundControls);
  // The first pointer/key interaction is also a good moment to unlock audio
  // for browsers that suspend it until a gesture.
  for (const eventName of ['pointerdown', 'keydown']) {
    window.addEventListener(eventName, () => {
      if (!muted) audioContext();
    }, { once: true, capture: true });
  }
}
