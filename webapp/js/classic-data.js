/* ------------------------------------------------------------------------- */
/* Editor máp 2 — original data layer                                        */
/*                                                                           */
/* Loads the shipped config.xml, the original .mef map datasets and the       */
/* generated vector scenes. All game rules and object metadata come from      */
/* these original files.                                                     */
/* ------------------------------------------------------------------------- */

const DATA_ROOT = 'data/';
const parser = new DOMParser();

const cache = {
  configText: null,
  config: null,
  maps: null,
  mefText: new Map(),
  mefDocs: new Map(),
  sceneText: new Map(),
};

const listeners = new Set();

export const classicData = {
  config: null,
  maps: [],
  mapByKey: new Map(),
  ready: false,

  async init() {
    const [configText, mapsJson] = await Promise.all([
      fetchText(`${DATA_ROOT}config.xml`),
      fetchJson(`${DATA_ROOT}maps.json`),
    ]);
    cache.configText = configText;
    // The original file contains a malformed XML declaration (`<?xmlversion`).
    // Browsers reject it; the shipped copy is valid, but this keeps the loader
    // tolerant for re-opened original files too.
    const repaired = configText.replace(/<\?xmlversion/i, '<?xml version');
    const doc = parseXml(repaired, 'config.xml');
    const root = doc.documentElement;
    if (!root || root.nodeName !== 'config') throw new Error('Neplatný config.xml');

    classicData.config = doc;
    classicData.maps = mapsJson;
    classicData.mapByKey = new Map(mapsJson.map((m) => [m.key, m]));
    classicData.ready = true;
    listeners.forEach((fn) => fn(classicData));
    return classicData;
  },

  onReady(fn) {
    if (classicData.ready) fn(classicData);
    else listeners.add(fn);
  },

  cfg(name) {
    if (!classicData.config) return '';
    const el = firstChildByTag(classicData.config.documentElement, name);
    if (!el) return '';
    if (el.hasAttribute('value')) return legacyUnescape(el.getAttribute('value'));
    const html = el.innerHTML.replace(/\n/g, '').replace(/ {2}/g, ' ');
    return legacyUnescape(html);
  },

  cfgEl(name) {
    if (!classicData.config) return null;
    return firstChildByTag(classicData.config.documentElement, name);
  },

  mapDef(key) {
    return classicData.mapByKey.get(key) || null;
  },

  /** Global map definition from <globalMapList>. */
  globalMapByName(mapName) {
    const list = classicData.cfgEl('globalMapList');
    if (!list) return null;
    return Array.from(list.getElementsByTagName('map')).find((m) => m.getAttribute('mapName') === mapName) || null;
  },

  /** Returns the internal map key for a config map element. */
  keyForConfigMap(mapEl) {
    if (!mapEl) return null;
    const mapName = mapEl.getAttribute('mapName');
    const global = classicData.globalMapByName(mapName);
    if (global) return global.getAttribute('dataFileName') || global.getAttribute('objectFileName');
    const byLabel = classicData.maps.find((m) => sameText(m.label, mapEl.getAttribute('label')));
    if (byLabel) return byLabel.key;
    const byMapName = classicData.maps.find((m) => sameText(m.label, mapName) || sameText(m.key, mapName));
    return byMapName ? byMapName.key : null;
  },

  /** Returns the internal map key for a .mef mapName. */
  keyForMefMapName(mapName) {
    const global = classicData.globalMapByName(mapName);
    if (global) return global.getAttribute('dataFileName') || global.getAttribute('objectFileName');
    const byLabel = classicData.maps.find((m) => sameText(m.label, mapName) || sameText(m.key, mapName));
    return byLabel ? byLabel.key : null;
  },

  async getMefText(key) {
    if (cache.mefText.has(key)) return cache.mefText.get(key);
    const text = await fetchText(`${DATA_ROOT}maps/${key}.mef`);
    cache.mefText.set(key, text);
    return text;
  },

  async getMefDocument(key) {
    if (cache.mefDocs.has(key)) return cache.mefDocs.get(key).cloneNode(true);
    const text = await classicData.getMefText(key);
    const doc = parseXml(text, `${key}.mef`);
    const root = doc.documentElement;
    if (!root || root.nodeName !== 'mapdata') throw new Error(`Neplatný súbor ${key}.mef`);
    propagateAttributes(doc);
    cache.mefDocs.set(key, doc);
    return doc.cloneNode(true);
  },

  async getRawMefDocument(key) {
    const text = await classicData.getMefText(key);
    const doc = parseXml(text, `${key}.mef`);
    propagateAttributes(doc);
    return doc;
  },

  async getSceneText(key) {
    if (cache.sceneText.has(key)) return cache.sceneText.get(key);
    const text = await fetchText(`assets/maps/${key}.svg`);
    cache.sceneText.set(key, text);
    return text;
  },

  sceneUrl(key) {
    return `assets/maps/${key}.svg`;
  },

  /** Kept for tests / diagnostics. */
  _cache: cache,
};

/* ------------------------------------------------------------------------- */
/* XML helpers                                                               */
/* ------------------------------------------------------------------------- */

export function parseXml(text, label = 'XML') {
  const doc = parser.parseFromString(text, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) {
    const detail = (err.textContent || '').trim().split('\n').slice(0, 3).join(' ');
    throw new Error(`Nepodarilo sa načítať ${label}: ${detail}`);
  }
  return doc;
}

export function firstChildByTag(parent, tag) {
  if (!parent) return null;
  for (const child of parent.children) {
    if (child.nodeType === 1 && child.tagName === tag) return child;
  }
  return null;
}

export function childrenByTag(parent, tag) {
  if (!parent) return [];
  return Array.from(parent.children).filter((child) => child.tagName === tag);
}

export function walkNodes(node, fn, depth = 0) {
  if (!node || node.nodeType !== 1) return;
  fn(node, depth);
  const isNode = node.tagName === 'node';
  for (const child of node.children) {
    if (child.nodeType === 1) {
      walkNodes(child, fn, isNode ? depth + 1 : depth);
    }
  }
}

export function entityNodes(root) {
  const result = [];
  walkNodes(root, (node) => {
    if (node.hasAttribute('entity')) result.push(node);
  });
  return result;
}

export function descendantEntityNodes(node) {
  const result = [];
  if (!node) return result;
  walkNodes(node, (n) => {
    if (n !== node && n.hasAttribute('entity')) result.push(n);
  });
  return result;
}

export function findNodesByLabel(root, label) {
  const result = [];
  if (!root || label == null) return result;
  walkNodes(root, (node) => {
    if (node.getAttribute('label') === label) result.push(node);
  });
  return result;
}

export function findFirstByLabel(root, label) {
  if (!root || label == null) return null;
  let found = null;
  walkNodes(root, (node) => {
    if (!found && node.getAttribute('label') === label) found = node;
  });
  return found;
}

export function propagateAttributes(doc) {
  const root = doc && doc.documentElement;
  if (!root) return;
  const list = root.getElementsByTagName('nodelist')[0] || root;
  const walk = (node) => {
    for (const child of node.children) {
      if (child.tagName !== 'node') continue;
      for (const attr of ['markSymbol', 'fillColor', 'colorAdd', 'transparent']) {
        if (!child.hasAttribute(attr) && node.hasAttribute(attr)) {
          child.setAttribute(attr, node.getAttribute(attr));
        }
      }
      walk(child);
    }
  };
  walk(list);
}

export function nodeLabel(node) {
  return node ? node.getAttribute('label') || '' : '';
}

export function nodeEntity(node) {
  return node ? node.getAttribute('entity') || '' : '';
}

export function nodeAttrs(node) {
  const obj = {};
  if (!node) return obj;
  for (const attr of node.attributes) obj[attr.name] = attr.value;
  return obj;
}

export function getNumberAttr(node, name, fallback = 0) {
  const raw = node ? node.getAttribute(name) : null;
  if (raw == null || raw === '') return fallback;
  const value = Number.parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(value) ? value : fallback;
}

export function setNodeAttr(node, name, value) {
  if (!node) return;
  node.setAttribute(name, String(value));
}

export function nodePath(node) {
  const parts = [];
  let cur = node;
  while (cur && cur.nodeType === 1 && cur.tagName === 'node') {
    parts.unshift(cur.getAttribute('label') || '');
    cur = cur.parentElement;
  }
  return parts.join('/');
}

export function allTestMapElements(listName) {
  const list = classicData.cfgEl(listName);
  if (!list) return [];
  return childrenByTag(list, 'map');
}

export function testsForMap(mapEl) {
  if (!mapEl) return [];
  return childrenByTag(mapEl, 'test');
}

export function levelsForTest(testEl) {
  const levels = childrenByTag(testEl, 'level');
  if (levels.length) {
    return levels.map((el, index) => ({
      label: el.getAttribute('label') || `Úroveň ${index + 1}`,
      maxLevel: Number.parseInt(el.getAttribute('maxLevel') || '1', 10),
      numTargets: Number.parseInt(el.getAttribute('numTargets') || '3', 10),
    }));
  }
  const defaults = classicData.cfgEl('defaultlevels');
  const list = defaults ? childrenByTag(defaults, 'level') : [];
  return list.map((el, index) => ({
    label: el.getAttribute('label') || `Úroveň ${index + 1}`,
    maxLevel: Number.parseInt(el.getAttribute('maxLevel') || String(index + 1), 10),
    numTargets: Number.parseInt(el.getAttribute('numTargets') || String(3 + index * 2), 10),
  }));
}

export function groupPools(mapDoc, testEl, maxLevel, { puzzle = false } = {}) {
  const groups = childrenByTag(testEl, 'group');
  return groups.map((groupEl) => {
    const label = groupEl.getAttribute('label') || '';
    const source = findFirstByLabel(mapDoc.documentElement, label);
    const nodes = source
      ? descendantEntityNodes(source).filter((node) => {
          const level = Number.parseInt(node.getAttribute('testLevel') || '0', 10);
          if (!(level > 0 && level <= maxLevel)) return false;
          if (puzzle && node.getAttribute('nopuzzle') === 'true') return false;
          return true;
        })
      : [];
    return { label, source, nodes };
  });
}

export function visibleLabels(mapEl, testEl, groupEl) {
  const labels = [];
  if (mapEl) {
    for (const el of childrenByTag(mapEl, 'visibleNode')) labels.push(el.getAttribute('label'));
  }
  if (testEl) {
    for (const el of childrenByTag(testEl, 'visibleNode')) labels.push(el.getAttribute('label'));
  }
  if (groupEl) {
    for (const el of childrenByTag(groupEl, 'visibleNode')) labels.push(el.getAttribute('label'));
  }
  return labels.filter((x) => x != null);
}

export function showVisibleLabels(mapDoc, labels) {
  const shown = new Set();
  for (const label of labels) {
    for (const source of findNodesByLabel(mapDoc.documentElement, label)) {
      if (source.hasAttribute('entity')) shown.add(source.getAttribute('entity'));
      for (const leaf of descendantEntityNodes(source)) {
        shown.add(leaf.getAttribute('entity'));
      }
    }
  }
  return shown;
}

export function newMefSignature(mapDoc) {
  const root = mapDoc.documentElement;
  let sig = firstChildByTag(root, 'signature');
  if (!sig) {
    sig = mapDoc.createElement('signature');
    root.insertBefore(sig, root.firstChild);
  }
  sig.innerHTML = '';
  const add = (tag, text) => {
    const el = mapDoc.createElement(tag);
    el.textContent = text;
    sig.appendChild(el);
  };
  add('id', 'mxm.blindmaps');
  add('name', 'Editor máp 2');
  add('version', '2.0');
  add('copyright', 'STUDIO MAX MEDIA SK, s.r.o.');
  add('url', 'http://www.oslovensku.sk/editor/');
  add('saved', new Date().toLocaleString('sk-SK'));
  return sig;
}

export function serializeMef(mapDoc) {
  newMefSignature(mapDoc);
  return new XMLSerializer().serializeToString(mapDoc.documentElement);
}

export function normalizeHex(value) {
  if (value == null) return null;
  let v = String(value).trim().toLowerCase();
  if (!v || v === 'any' || v === 'none') return null;
  if (v.startsWith('0x')) v = '#' + v.slice(2);
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  return null;
}

export function hexFromValue(value) {
  const v = normalizeHex(value);
  return v || '#000000';
}

export function valueFromHex(hex) {
  const v = normalizeHex(hex) || '#000000';
  return '0x' + v.slice(1);
}

export function sameText(a, b) {
  return String(a == null ? '' : a).trim().toLocaleLowerCase('sk') === String(b == null ? '' : b).trim().toLocaleLowerCase('sk');
}

export function legacyUnescape(value) {
  if (value == null) return '';
  const text = String(value);
  if (!text.includes('%')) return text;
  try {
    return decodeURIComponent(text);
  } catch {
    return text.replace(/%([0-9a-f]{2})/gi, (_, hex) => {
      try {
        return String.fromCharCode(Number.parseInt(hex, 16));
      } catch {
        return `%${hex}`;
      }
    });
  }
}

export function htmlFromConfig(value, replacements = {}) {
  let out = legacyUnescape(value);
  for (const [token, replacement] of Object.entries(replacements)) {
    out = out.split(token).join(String(replacement));
  }
  return out;
}

/* ------------------------------------------------------------------------- */
/* Simple network helpers                                                    */
/* ------------------------------------------------------------------------- */

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
  return res.json();
}
