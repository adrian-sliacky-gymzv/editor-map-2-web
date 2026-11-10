/* ------------------------------------------------------------------------- */
/* Language engine                                                           */
/*                                                                           */
/* Slovak is the source language and the default. English is applied both to  */
/* static markup and to text that games/editor create later, using a subtree  */
/* observer plus an exact-string dictionary and a small set of patterns.      */
/* The module stays DOM-free at import time so the pure helpers can be        */
/* exercised by Node tests.                                                  */
/* ------------------------------------------------------------------------- */

import {
  COUNT_NOUNS,
  EN,
  EN_HTML,
  EN_TEMPLATES,
  GAME_MESSAGES_EN,
  META_EN,
  SEGMENT_SEPARATORS,
} from './translations.js';

export const STORAGE_KEY = 'editorMap2.language';
export const PREFERENCES = ['auto', 'sk', 'en'];

let current = 'sk';
let preference = 'auto';
let started = false;
let observer = null;
let observerRoot = null;
let defaultTitle = '';
let defaultDescription = '';

const TEXT_ORIGINALS = new WeakMap();
const ATTRIBUTE_ORIGINALS = new WeakMap();
const HTML_ORIGINALS = new WeakMap();
const TRACKED_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'];
const SKIP_SELECTOR = '[data-i18n-skip], [translate="no"], script, style, noscript, template';

/* ------------------------------------------------------------------------- */
/* Pure helpers                                                              */
/* ------------------------------------------------------------------------- */

export function resolveLanguage(value, languages) {
  if (value === 'sk' || value === 'en') return value;
  const list = Array.isArray(languages) && languages.length
    ? languages
    : (typeof navigator !== 'undefined'
      ? [navigator.language, ...(navigator.languages || [])]
      : ['en']);
  return list.some((tag) => String(tag || '').toLowerCase().startsWith('sk')) ? 'sk' : 'en';
}

export function getLanguage() {
  return current;
}

export function getLanguagePreference() {
  return preference;
}

function normalise(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function translateCount(match) {
  const digits = match[1].trim().replace(/\s+/g, '');
  const count = Number(digits);
  if (!Number.isFinite(count)) return null;
  const noun = COUNT_NOUNS[match[2]];
  if (!noun) return null;
  const word = count === 1 ? noun[0] : noun[1];
  return `${count.toLocaleString('en-US')} ${word}`;
}

/**
 * Translate one normalised string. Kept pure and exported so tests can cover
 * the exact behaviour without a browser.
 */
export function translateCore(core, lang = current) {
  if (lang !== 'en') return core;
  const text = normalise(core);
  if (!text) return core;
  if (EN[text] != null) return EN[text];

  // Translate each side of separators such as "Hard · Slovakia". Text nodes
  // often end with a separator because a <b> element follows, so handle the
  // trimmed leading/trailing forms too.
  for (const separator of SEGMENT_SEPARATORS) {
    if (text.includes(separator)) {
      return text
        .split(separator)
        .map((part) => translateCore(part, lang))
        .join(separator);
    }
    const symbol = separator.trim();
    const trailing = new RegExp(`^(.+?) ${symbol}$`).exec(text);
    if (trailing) return `${translateCore(trailing[1], lang)} ${symbol}`;
    const leading = new RegExp(`^${symbol} (.+)$`).exec(text);
    if (leading) return `${symbol} ${translateCore(leading[1], lang)}`;
  }

  const parenthesised = /^(.+) \((\d+)\)$/.exec(text);
  if (parenthesised) return `${translateCore(parenthesised[1], lang)} (${parenthesised[2]})`;

  const parenthesisedText = /^(.+) \((.+)\)$/.exec(text);
  if (parenthesisedText) {
    return `${translateCore(parenthesisedText[1], lang)} (${translateCore(parenthesisedText[2], lang)})`;
  }

  const countedPair = /^([\d][\d\s]*?)\s+(\S+) \+ ([\d][\d\s]*?)\s+(\S+)$/.exec(text);
  if (countedPair) {
    const first = translateCount([null, countedPair[1], countedPair[2]]);
    const second = translateCount([null, countedPair[3], countedPair[4]]);
    if (first && second) return `${first} + ${second}`;
  }

  const counted = /^([\d][\d\s]*?)\s+(.+)$/.exec(text);
  const countedText = counted && translateCount(counted);
  if (countedText) return countedText;

  const inEachQuestion = /^V každej otázke (\d+) (možnosť|možnosti|možností)\.$/.exec(text);
  if (inEachQuestion) {
    const translated = translateCount([null, inEachQuestion[1], inEachQuestion[2]]);
    return `${translated} in each question.`;
  }

  const skippedGroups = /^Prázdne skupiny sa preskočia \((.+)\)\.$/.exec(text);
  if (skippedGroups) return `Empty groups are skipped (${skippedGroups[1]}).`;

  const scoreTime = /^Skóre (\d+) (?:bodov|body|bod), čas (.+)$/.exec(text);
  if (scoreTime) return `Score ${scoreTime[1]} points, time ${scoreTime[2]}`;

  const correctWrong = /^Správne (\d+), nesprávne (\d+), čas (.+)$/.exec(text);
  if (correctWrong) {
    return `Correct ${correctWrong[1]}, incorrect ${correctWrong[2]}, time ${correctWrong[3]}`;
  }

  if (/^\d+ j\.$/.test(text)) return text.replace(' j.', ' u.');
  if (/^\d+ b\.$/.test(text)) return text.replace(' b.', ' pts');

  const feedback = /^(.+)! \+(\d+) b\.$/.exec(text);
  if (feedback) return `${translateCore(feedback[1], lang)}! +${feedback[2]} pts`;

  const question = /^Otázka (\d+): (.+)$/.exec(text);
  if (question) return `Question ${question[1]}: ${question[2]}`;

  const marker = /^Značka: (.+)$/.exec(text);
  if (marker) return `Marker: ${marker[1]}`;

  const gameLabel = /^Hra (.+)$/.exec(text);
  if (gameLabel) return `Game ${translateCore(gameLabel[1], lang)}`;

  const mapLabel = /^Mapa (.+)$/.exec(text);
  if (mapLabel) return `Map of ${translateCore(mapLabel[1], lang)}`;

  const color = /^Farba (#[0-9a-fA-F]{6})$/.exec(text);
  if (color) return `Color ${color[1]}`;

  const loading = /^Načítavam (.+)…$/.exec(text);
  if (loading) return `Loading ${translateCore(loading[1], lang)}…`;

  const prefixes = [
    [/^Nová mapa: (.+)$/, 'New map: '],
    [/^Mapu sa nepodarilo načítať: (.+)$/, 'Could not load the map: '],
    [/^Súbor sa nepodarilo otvoriť: (.+)$/, 'Could not open the file: '],
    [/^Súbor sa nepodarilo uložiť: (.+)$/, 'Could not save the file: '],
    [/^Otvorené: (.+)$/, 'Opened: '],
    [/^Uložené: (.+)$/, 'Saved: '],
    [/^Export hotový: (.+)$/, 'Export complete: '],
    [/^Export zlyhal: (.+)$/, 'Export failed: '],
    [/^Tlač zlyhala: (.+)$/, 'Print failed: '],
  ];
  for (const [pattern, replacement] of prefixes) {
    const match = pattern.exec(text);
    if (match) return `${replacement}${match[1]}`;
  }

  const unsupported = /^Mapa „(.+)“ nie je podporovaná\.$/.exec(text);
  if (unsupported) return `The map “${unsupported[1]}” is not supported.`;

  const csv = /^CSV bolo stiahnuté \((.+)\)\.$/.exec(text);
  if (csv) return `CSV downloaded (${csv[1]}).`;

  const removeMarker = /^Naozaj odstrániť „(.+)“\?$/.exec(text);
  if (removeMarker) return `Really remove “${removeMarker[1]}”?`;

  const unsaved = /^V dokumente sú neuložené zmeny\. Chceš ich zahodiť a pokračovať \((.+)\)\?$/.exec(text);
  if (unsaved) {
    return `The document has unsaved changes. Discard them and continue (${translateCore(unsaved[1], lang)})?`;
  }

  const openMap = /^Otvoriť mapu (.+) v hre Vyskúšaj sa$/.exec(text);
  if (openMap) return `Open the ${translateCore(openMap[1], lang)} map in Test yourself`;

  const cityLevel = /^(.+), (Ľahká|Stredná|Ťažká)$/.exec(text);
  if (cityLevel) return `${cityLevel[1]}, ${translateCore(cityLevel[2], lang)}`;

  const correctCount = /^(\d+) správne$/.exec(text);
  if (correctCount) return `${correctCount[1]} correct`;

  return core;
}

/** Translate a text node while preserving its leading/trailing whitespace. */
export function translateText(input, lang = current) {
  if (lang !== 'en' || input == null) return input;
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(String(input));
  if (!match) return input;
  const [, lead, core, trail] = match;
  if (!core) return input;
  const translated = translateCore(core, lang);
  return translated === normalise(core) ? input : `${lead}${translated}${trail}`;
}

/** Translate a complete sentence containing {placeholders}. */
export function t(source, params = null) {
  let out = source;
  if (current === 'en') {
    out = EN_TEMPLATES[source];
    if (out == null) out = EN[normalise(source)];
    if (out == null) out = translateCore(source);
  }
  if (params) {
    out = out.replace(/\{(\w+)\}/g, (whole, key) => (
      Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole
    ));
  }
  return out;
}

/** Original config.xml message, with an English equivalent when available. */
export function gameMessage(name, fallback = '') {
  if (current !== 'en') return fallback;
  return GAME_MESSAGES_EN[name] != null ? GAME_MESSAGES_EN[name] : fallback;
}

/** The page title for the current language, used after leaving the editor. */
export function defaultTitleForLanguage() {
  return current === 'en' ? META_EN.title : defaultTitle;
}

/* ------------------------------------------------------------------------- */
/* DOM localisation                                                          */
/* ------------------------------------------------------------------------- */

function isSkipped(node) {
  const element = node && node.nodeType === 1 ? node : node?.parentElement;
  return Boolean(element?.closest?.(SKIP_SELECTOR));
}

function localizeTextNode(node) {
  if (!node || node.nodeType !== 3 || isSkipped(node)) return;
  if (!node.nodeValue || !node.nodeValue.trim()) return;
  if (!TEXT_ORIGINALS.has(node)) TEXT_ORIGINALS.set(node, node.nodeValue);
  const source = TEXT_ORIGINALS.get(node);
  const next = current === 'en' ? translateText(source) : source;
  if (next !== node.nodeValue) node.nodeValue = next;
}

function rememberAttribute(element, name) {
  if (!element || !name) return;
  let values = ATTRIBUTE_ORIGINALS.get(element);
  if (!values) {
    values = new Map();
    ATTRIBUTE_ORIGINALS.set(element, values);
  }
  values.set(name, element.getAttribute(name) ?? '');
}

function localizeAttribute(element, name) {
  if (!element || isSkipped(element)) return;
  const value = element.getAttribute(name);
  if (value == null) return;
  let values = ATTRIBUTE_ORIGINALS.get(element);
  if (!values) {
    values = new Map();
    ATTRIBUTE_ORIGINALS.set(element, values);
  }
  if (!values.has(name)) values.set(name, value);
  const source = values.get(name);
  const next = current === 'en' ? translateText(source) : source;
  if (next !== value) element.setAttribute(name, next);
}

function applyHtmlTranslations(root) {
  if (!root) return;
  const elements = [];
  if (root.nodeType === 1 && root.matches?.('[data-i18n-html]')) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll('[data-i18n-html]'));
  for (const element of elements) {
    const key = element.getAttribute('data-i18n-html');
    if (!key || !EN_HTML[key]) continue;
    if (!HTML_ORIGINALS.has(element)) HTML_ORIGINALS.set(element, element.innerHTML);
    const source = HTML_ORIGINALS.get(element);
    const next = current === 'en' ? EN_HTML[key] : source;
    if (element.innerHTML !== next) element.innerHTML = next;
  }
}

function localizeTree(root) {
  if (!root) return;
  if (root.nodeType === 3) {
    localizeTextNode(root);
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1 && isSkipped(root)) return;

  applyHtmlTranslations(root);

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === 1 && isSkipped(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node = walker.currentNode;
  while (node) {
    if (node.nodeType === 3) {
      localizeTextNode(node);
    } else if (node.nodeType === 1) {
      for (const attribute of TRACKED_ATTRIBUTES) localizeAttribute(node, attribute);
    }
    node = walker.nextNode();
  }
}

function updateDocumentMeta() {
  if (typeof document === 'undefined') return;
  if (current === 'en') {
    document.title = META_EN.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', META_EN.description);
  } else {
    document.title = defaultTitle;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', defaultDescription);
  }
  document.documentElement.lang = current === 'en' ? 'en' : 'sk';
  document.documentElement.dataset.lang = current;
}

function syncPreferenceControls() {
  document.querySelectorAll('[data-language]').forEach((button) => {
    const active = button.dataset.language === preference;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function applyLanguage(lang, options = {}) {
  if (typeof document === 'undefined') {
    current = lang;
    return;
  }
  current = lang;
  const root = document.body;
  if (!root) return;
  if (observer) observer.disconnect();
  try {
    applyHtmlTranslations(root);
    localizeTree(root);
    updateDocumentMeta();
    syncPreferenceControls();
  } finally {
    if (observer && observerRoot) {
      observer.observe(observerRoot, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: TRACKED_ATTRIBUTES,
      });
    }
  }
  if (options.announce !== false) {
    window.dispatchEvent(new CustomEvent('i18n:change', {
      detail: { language: current, preference },
    }));
  }
}

function processMutations(records) {
  if (!observer) return;
  observer.disconnect();
  try {
    for (const record of records) {
      if (record.type === 'characterData') {
        const node = record.target;
        if (!node.nodeValue || !node.nodeValue.trim() || isSkipped(node)) continue;
        TEXT_ORIGINALS.set(node, node.nodeValue);
        localizeTextNode(node);
      } else if (record.type === 'attributes') {
        const element = record.target;
        if (isSkipped(element)) continue;
        rememberAttribute(element, record.attributeName);
        localizeAttribute(element, record.attributeName);
      } else {
        for (const node of record.addedNodes) {
          if (node.nodeType === 3) localizeTextNode(node);
          else if (node.nodeType === 1) localizeTree(node);
        }
      }
    }
  } finally {
    if (observerRoot) {
      observer.observe(observerRoot, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: TRACKED_ATTRIBUTES,
      });
    }
  }
}

function observe(root) {
  if (!root || typeof MutationObserver === 'undefined') return;
  observerRoot = root;
  observer = new MutationObserver(processMutations);
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRACKED_ATTRIBUTES,
  });
}

function readPreference() {
  if (typeof localStorage === 'undefined') return 'auto';
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return PREFERENCES.includes(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

function savePreference(value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* the site still works without storage */
  }
}

export function setLanguagePreference(value) {
  preference = PREFERENCES.includes(value) ? value : 'auto';
  savePreference(preference);
  const lang = resolveLanguage(preference);
  applyLanguage(lang);
  return lang;
}

export function initI18n() {
  if (typeof document === 'undefined' || started) return current;
  started = true;
  defaultTitle = document.title;
  defaultDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  preference = readPreference();
  current = resolveLanguage(preference);

  observe(document.body);
  applyLanguage(current, { announce: false });

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-language]');
    if (!button) return;
    event.preventDefault();
    setLanguagePreference(button.dataset.language);
  });

  return current;
}

/** Test/utility hook: forget DOM state and re-read the stored preference. */
export function resetI18nForTests() {
  current = 'sk';
  preference = 'auto';
  started = false;
  observer = null;
  observerRoot = null;
}
