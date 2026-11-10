/* ------------------------------------------------------------------------- */
/* Editor máp 2 — full map editor                                            */
/*                                                                           */
/* Reproduces the original tree editor, visibility/colour model, user marks,  */
/* drawing tools, .mef new/open/save/save-as, PNG/JPEG export and printing.   */
/* ------------------------------------------------------------------------- */

import {
  childrenByTag,
  classicData,
  entityNodes,
  firstChildByTag,
  getNumberAttr,
  nodeLabel,
  parseXml,
  serializeMef,
  valueFromHex,
  normalizeHex,
} from './classic-data.js';
import { MapView } from './map-view.js';
import {
  $,
  clamp,
  closeOverlay,
  confirmDialog,
  downloadBlob,
  openOverlay,
  promptDialog,
  toast,
} from './classic-ui.js';
import { goHome } from './classic-activities.js';
import { defaultTitleForLanguage, getLanguage, t } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LAST_MAP_KEY = 'editorMap2.lastMap.v1';

const PALETTE_VALUES = [
  0, 2236962, 4473924, 6710886, 8947848, 12303291, 14540253, 16777215,
  16744319, 14663567, 16777119, 8380287, 8375551, 8355839, 13402111,
  16744447, 16711680, 16746496, 16776960, 52224, 39423, 2237183,
  10027263, 16711935, 11468800, 13583360, 11513600, 32512, 26303, 191,
  6684863, 12517567,
];
const PALETTE_TRANS_VALUES = [
  65793, 0, 3355443, 6710886, 8947848, 12303291, 14540253, 16777215,
  16744319, 14663567, 16777119, 8380287, 8375551, 8355839, 13402111,
  16744447, 16711680, 16746496, 16776960, 52224, 39423, 2237183,
  10027263, 16711935, 11468800, 13583360, 11513600, 32512, 26303, 191,
  6684863, 12517567,
];

const D = {};

const E = {
  initialized: false,
  doc: null,
  mapKey: null,
  mapDef: null,
  mapView: null,
  filename: 'slovensko.mef',
  fileHandle: null,
  dirty: false,
  saveAsRequired: true,
  treeRoot: null,
  rowByNode: new Map(),
  markByNode: new Map(),
  expanded: new Set(),
  selectedNode: null,
  searchQuery: '',
  showMarks: true,
  showDrawings: true,
  drawTool: null,
  drawColor: '#ff0000',
  drawThickness: 1,
  drawFill: false,
  colorPopover: null,
  contextMenu: null,
  labelEditor: null,
  loading: false,
  focusEntity: null,
  loadToken: 0,
};

/* ------------------------------------------------------------------------- */
/* init / open                                                               */
/* ------------------------------------------------------------------------- */

export async function initEditor() {
  if (E.initialized) return;
  E.initialized = true;
  cacheDom();
  createContextMenu();
  bindToolbar();
  bindEditorTree();
  bindDrawing();
  bindExport();
  bindAbout();
  bindNewMapEvents();
  bindKeyboard();
  document.addEventListener('editor:open', () => openEditor());
  window.addEventListener('beforeunload', (event) => {
    if (!E.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

function cacheDom() {
  D.screen = $('#editorScreen');
  D.back = $('#editorBackBtn');
  D.fileLabel = $('#editorFileLabel');
  D.fileMeta = $('#editorFileMeta');
  D.actions = $$Deep('.editor-actions [data-editor-action]');
  D.panelToggle = $('#editorPanelToggle');
  D.treeClose = $('#editorTreeClose');
  D.sidebar = $('#editorTreePanel');
  D.tree = $('#editorTree');
  D.treeSearch = $('#editorTreeSearch');
  D.treeCount = $('#editorTreeCount');
  D.addMark = $('#editorAddMarkBtn');
  D.expandAll = $('#editorExpandAll');
  D.collapseAll = $('#editorCollapseAll');
  D.showMarks = $('#editorShowMarks');
  D.showDrawings = $('#editorShowDrawings');
  D.drawToggle = $('#editorDrawToggle');
  D.drawToolbar = $('#drawToolbar');
  D.drawColor = $('#drawColor');
  D.drawThickness = $('#drawThickness');
  D.drawThicknessValue = $('#drawThicknessValue');
  D.drawFill = $('#drawFill');
  D.drawDeleteLast = $('#drawDeleteLast');
  D.drawClose = $('#drawClose');
  D.drawTools = $$Deep('.draw-btn[data-draw-tool]');
  D.zoomIn = $('#editorZoomIn');
  D.zoomOut = $('#editorZoomOut');
  D.zoomCenter = $('#editorZoomCenter');
  D.zoomFit = $('#editorZoomFit');
  D.zoomValue = $('#editorZoomValue');
  D.mapHost = $('#editorMapHost');
  D.mapTag = $('#editorMapTag');
  D.mapHint = $('#editorMapHint');
  D.loading = $('#editorLoading');
  D.loadingText = $('#editorLoadingText');
  D.newOverlay = $('#editorNewOverlay');
  D.newMaps = $('#editorNewMaps');
  D.newClose = $('#editorNewClose');
  D.newCancel = $('#editorNewCancel');
  D.exportOverlay = $('#exportOverlay');
  D.exportClose = $('#exportClose');
  D.exportCancel = $('#exportCancel');
  D.exportOk = $('#exportOk');
  D.exportWatermark = $('#exportWatermark');
  D.aboutOverlay = $('#aboutOverlay');
  D.aboutClose = $('#aboutClose');
  D.aboutOk = $('#aboutOk');
}

function $$Deep(selector) {
  return Array.from(document.querySelectorAll(selector));
}

async function openEditor() {
  await openEditorAt(null);
}

export async function openEditorAt(mapKey = null) {
  await classicData.init();
  showEditorScreen();
  if (mapKey) {
    await loadNewMap(mapKey, { initial: true });
    return;
  }
  if (!E.doc) {
    let key = 'slovensko';
    try {
      const saved = localStorage.getItem(LAST_MAP_KEY);
      if (saved && classicData.mapDef(saved)) key = saved;
    } catch {}
    await loadNewMap(key, { initial: true });
  } else {
    requestAnimationFrame(() => {
      E.mapView?.layout();
      updateZoomLabel();
    });
  }
}

function showEditorScreen() {
  $('#homeScreen').hidden = true;
  $('#atlasScreen').hidden = true;
  $('#gameScreen').hidden = true;
  $('#classicScreen').hidden = true;
  D.screen.hidden = false;
  document.body.classList.remove('game-active', 'classic-active');
  document.body.classList.add('editor-active');
  document.title = getLanguage() === 'en'
    ? `${E.filename || 'Map editor'} – Map Editor 2`
    : `${E.filename || 'Editor máp'} – Editor máp 2`;
  requestAnimationFrame(() => {
    E.mapView?.layout();
    updateZoomLabel();
  });
  D.screen.focus?.();
  window.scrollTo({ top: 0 });
}

function hideEditorScreen() {
  cancelCurrentDrawing();
  closeContextMenu();
  closeColorPopover();
  document.body.classList.remove('editor-tree-open');
  D.screen.hidden = true;
  document.body.classList.remove('editor-active');
  document.title = defaultTitleForLanguage();
}

function setLoading(visible, text = 'Načítavam…') {
  if (!D.loading) return;
  E.loading = visible;
  if (text) D.loadingText.textContent = text;
  D.loading.hidden = !visible;
}

/* ------------------------------------------------------------------------- */
/* documents                                                                 */
/* ------------------------------------------------------------------------- */

async function loadNewMap(key, { initial = false } = {}) {
  const def = classicData.mapDef(key);
  if (!def) {
    toast('Neznáma mapa.', 'error');
    return;
  }
  const loadToken = ++E.loadToken;
  setLoading(true, `Načítavam ${def.label}…`);
  try {
    const doc = await classicData.getMefDocument(key);
    if (loadToken !== E.loadToken) return;
    E.doc = doc;
    E.mapKey = key;
    E.mapDef = def;
    E.filename = `${key}.mef`;
    E.fileHandle = null;
    E.dirty = false;
    E.saveAsRequired = true;
    E.selectedNode = null;
    E.searchQuery = '';
    D.treeSearch.value = '';
    ensureDrawingList();
    await mountDocument();
    if (loadToken !== E.loadToken) return;
    try {
      localStorage.setItem(LAST_MAP_KEY, key);
    } catch {}
    updateDocumentChrome();
    if (!initial) toast(`Nová mapa: ${def.label}`, 'success');
  } catch (error) {
    if (loadToken !== E.loadToken) return;
    console.error(error);
    toast(`Mapu sa nepodarilo načítať: ${error.message}`, 'error');
  } finally {
    if (loadToken === E.loadToken) setLoading(false);
  }
}

async function openFile() {
  if (!(await confirmDiscard('Otvoriť iný súbor'))) return;
  try {
    let opened = false;
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: 'Editor máp (*.mef)', accept: { 'application/xml': ['.mef'] } }],
        });
        const file = await handle.getFile();
        await openFileFromFile(file, handle);
        opened = true;
      } catch (error) {
        if (error?.name === 'AbortError') return;
        console.warn('File System Access API unavailable, using file input.', error);
      }
    }
    if (!opened) {
      const file = await pickFileFallback();
      if (file) await openFileFromFile(file, null);
    }
  } catch (error) {
    console.error(error);
    toast(`Súbor sa nepodarilo otvoriť: ${error.message}`, 'error');
  }
}

function pickFileFallback() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'editor-file-input';
    input.name = 'mefFile';
    input.setAttribute('aria-label', 'Vybrať súbor .mef');
    input.accept = '.mef,application/xml,text/xml';
    input.style.display = 'none';
    document.body.append(input);
    input.addEventListener('change', () => {
      resolve(input.files?.[0] || null);
      input.remove();
    }, { once: true });
    input.click();
  });
}

async function openFileFromFile(file, handle) {
  const text = await file.text();
  const doc = parseXml(text, file.name);
  const root = doc.documentElement;
  if (!root || root.nodeName !== 'mapdata') throw new Error('Súbor nie je mapa .mef.');
  const mapName = root.getAttribute('mapName') || '';
  const key = classicData.keyForMefMapName(mapName);
  if (!key) throw new Error(`Mapa „${mapName}“ nie je podporovaná.`);
  const def = classicData.mapDef(key);
  const loadToken = ++E.loadToken;
  setLoading(true, `Otváram ${file.name}…`);
  try {
    E.doc = doc;
    E.mapKey = key;
    E.mapDef = def;
    E.filename = file.name || `${key}.mef`;
    E.fileHandle = handle || null;
    E.dirty = false;
    E.saveAsRequired = !handle;
    E.selectedNode = null;
    E.searchQuery = '';
    D.treeSearch.value = '';
    ensureDrawingList();
    await mountDocument();
    if (loadToken !== E.loadToken) return;
    try {
      localStorage.setItem(LAST_MAP_KEY, key);
    } catch {}
    updateDocumentChrome();
    toast(`Otvorené: ${E.filename}`, 'success');
  } finally {
    if (loadToken === E.loadToken) setLoading(false);
  }
}

function ensureDrawingList() {
  if (!E.doc) return null;
  const root = E.doc.documentElement;
  let list = firstChildByTag(root, 'drawinglist');
  if (!list) {
    list = E.doc.createElement('drawinglist');
    root.append(list);
  }
  return list;
}

async function mountDocument() {
  const loadToken = E.loadToken;
  const key = E.mapKey || classicData.keyForMefMapName(E.doc.documentElement.getAttribute('mapName'));
  if (!key) throw new Error('Nepodarilo sa určiť typ mapy.');
  E.mapKey = key;
  E.mapDef = classicData.mapDef(key);
  const mapDef = E.mapDef;
  if (!mapDef) throw new Error('Mapa nie je v zozname máp.');

  const scene = await classicData.getSceneText(key);
  if (loadToken !== E.loadToken) return;
  if (E.mapView) E.mapView.destroy();
  const view = new MapView(D.mapHost, {
    interaction: 'pan',
    paddingX: 28,
    paddingY: 28,
    onZoom: updateZoomLabel,
  });
  E.mapView = view;
  await view.load(mapDef, E.doc, scene);
  if (loadToken !== E.loadToken) {
    view.destroy();
    if (E.mapView === view) E.mapView = null;
    return;
  }
  const list = ensureDrawingList();
  view.setDrawingList(list);
  view.setMarksVisible(E.showMarks);
  view.setDrawingsVisible(E.showDrawings);
  view.applyDocument();
  if (loadToken !== E.loadToken) return;
  E.treeRoot = firstChildByTag(E.doc.documentElement, 'nodelist') || E.doc.documentElement;
  E.expanded = new Set([E.treeRoot]);
  E.rowByNode.clear();
  E.markByNode.clear();
  E.selectedNode = null;
  rebuildTree();
  rebuildMarks();
  updateMeta();
  D.mapTag.textContent = mapDef.label;
  if (D.mapHint) {
    D.mapHint.textContent = 'Ťahaj značky, klikni na objekt alebo kresli';
  }
  requestAnimationFrame(() => {
    E.mapView.layout();
    updateZoomLabel();
    // Auto-fit after the editor screen has a real size.
    E.mapView.fit();
  });
}

/* ------------------------------------------------------------------------- */
/* chrome / metadata                                                         */
/* ------------------------------------------------------------------------- */

function updateDocumentChrome() {
  const base = E.filename || `${E.mapKey}.mef`;
  D.fileLabel.textContent = `${base}${E.dirty ? ' *' : ''}`;
  document.title = getLanguage() === 'en'
    ? `${base}${E.dirty ? ' *' : ''} – Map Editor 2`
    : `${base}${E.dirty ? ' *' : ''} – Editor máp 2`;
  updateMeta();
}

function updateMeta() {
  if (!E.doc) return;
  const leaves = entityNodes(E.doc.documentElement);
  const visible = leaves.filter((n) => n.getAttribute('nodeVisible') === 'visible').length;
  const drawings = E.doc.querySelectorAll('drawinglist > drawing').length;
  const marks = Array.from(E.rowByNode.keys()).filter((n) => {
    if (n.getAttribute('markVisible') !== 'visible') return false;
    return n.hasAttribute('entity') || childrenByTag(n, 'node').length === 0;
  }).length;
  D.fileMeta.textContent = `${leaves.length} ${pluralSk(leaves.length, 'objekt', 'objekty', 'objektov')} · ${visible} viditeľných · ${marks} ${pluralSk(marks, 'značka', 'značky', 'značiek')} · ${drawings} ${pluralSk(drawings, 'kresba', 'kresby', 'kresieb')}`;
  const base = E.filename || `${E.mapKey}.mef`;
  D.fileLabel.textContent = `${base}${E.dirty ? ' *' : ''}`;
}

function markDirty() {
  if (!E.doc) return;
  E.dirty = true;
  updateDocumentChrome();
}

async function confirmDiscard(action) {
  if (!E.dirty) return true;
  return confirmDialog({
    title: 'Neuložené zmeny',
    message: `V dokumente sú neuložené zmeny. Chceš ich zahodiť a pokračovať (${action})?`,
    okLabel: 'Zahodiť zmeny',
    cancelLabel: 'Zrušiť',
    danger: true,
  });
}

/* ------------------------------------------------------------------------- */
/* save / export                                                             */
/* ------------------------------------------------------------------------- */

async function saveFile() {
  if (!E.doc) return;
  if (E.fileHandle) {
    const ok = await writeHandle(E.fileHandle);
    if (ok) return;
    E.fileHandle = null;
  }
  await saveAsFile();
}

async function saveAsFile() {
  if (!E.doc) return;
  const suggested = ensureMefName(E.filename || `${E.mapKey}.mef`);
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggested,
        types: [{ description: 'Editor máp (*.mef)', accept: { 'application/xml': ['.mef'] } }],
      });
      E.fileHandle = handle;
      E.filename = handle.name || suggested;
      E.saveAsRequired = false;
      await writeHandle(handle);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.warn('File System Access API unavailable, using download.', error);
    }
  }
  const name = await promptDialog({
    title: 'Uložiť mapu ako',
    label: 'Názov súboru (.mef)',
    value: suggested,
    okLabel: 'Uložiť',
  });
  if (!name) return;
  E.filename = ensureMefName(name);
  E.saveAsRequired = false;
  const xml = serializeMef(E.doc);
  downloadBlob(new Blob([xml], { type: 'application/xml;charset=utf-8' }), E.filename);
  E.dirty = false;
  updateDocumentChrome();
  toast(`Uložené: ${E.filename}`, 'success');
}

async function writeHandle(handle) {
  try {
    const xml = serializeMef(E.doc);
    const writable = await handle.createWritable();
    await writable.write(new Blob([xml], { type: 'application/xml;charset=utf-8' }));
    await writable.close();
    E.dirty = false;
    E.saveAsRequired = false;
    updateDocumentChrome();
    toast(`Uložené: ${E.filename}`, 'success');
    return true;
  } catch (error) {
    console.error(error);
    toast(`Súbor sa nepodarilo uložiť: ${error.message}`, 'error');
    return false;
  }
}

async function exportImage() {
  if (!E.mapView) return;
  openOverlay(D.exportOverlay, D.exportOk);
}

async function runExport() {
  const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'png';
  const resolution = Number.parseFloat(document.querySelector('input[name="exportResolution"]:checked')?.value || '1') || 1;
  const crop = document.querySelector('input[name="exportCrop"]:checked')?.value || 'all';
  const watermark = D.exportWatermark.checked;
  closeOverlay(D.exportOverlay);
  setLoading(true, 'Pripravujem export…');
  try {
    const canvas = await renderExportCanvas({ crop, resolution, watermark });
    const base = (E.filename || `${E.mapKey}.mef`).replace(/\.mef$/i, '');
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${base}-${crop === 'view' ? t('vyrez') : t('mapa')}-${stamp}.${format === 'jpeg' ? 'jpg' : 'png'}`;
    const blob = await canvasToBlob(canvas, format);
    downloadBlob(blob, filename);
    toast(`Export hotový: ${filename}`, 'success');
  } catch (error) {
    console.error(error);
    toast(`Export zlyhal: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

async function renderExportCanvas({ crop = 'all', resolution = 1, watermark = true } = {}) {
  const svgText = E.mapView.buildExportSvg({
    crop,
    includeMarks: true,
    includeDrawings: true,
    watermark,
    scale: resolution,
  });
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('SVG sa nepodarilo vykresliť.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, image.naturalWidth || image.width);
    canvas.height = Math.max(1, image.naturalHeight || image.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    return trimWhiteCanvas(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function trimWhiteCanvas(source) {
  const w = source.width;
  const h = source.height;
  if (w < 4 || h < 4) return source;
  const ctx = source.getContext('2d', { willReadFrequently: true });
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return source;
  }
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 4) continue;
      if (r > 250 && g > 250 && b > 250) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return source;
  const pad = 10;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  if (cw < w * 0.2 || ch < h * 0.2) return source;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, cw, ch);
  octx.drawImage(source, minX, minY, cw, ch, 0, 0, cw, ch);
  return out;
}

function canvasToBlob(canvas, format) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Obrázok sa nepodarilo vytvoriť.'));
    }, format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.93);
  });
}

async function printMap() {
  if (!E.mapView) return;
  setLoading(true, 'Pripravujem tlač…');
  try {
    const canvas = await renderExportCanvas({ crop: 'all', resolution: 2, watermark: true });
    const dataUrl = canvas.toDataURL('image/png');
    const sheet = document.createElement('div');
    sheet.id = 'printSheet';
    sheet.innerHTML = `<img src="${dataUrl}" alt="Mapa ${escapeAttr(E.mapDef?.label || '')}">`;
    document.body.append(sheet);
    document.body.classList.add('is-printing');
    const cleanup = () => {
      document.body.classList.remove('is-printing');
      sheet.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1000);
    }, 120);
  } catch (error) {
    console.error(error);
    toast(`Tlač zlyhala: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function ensureMefName(name) {
  const clean = String(name || 'mapa').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'mapa';
  return /\.mef$/i.test(clean) ? clean : `${clean}.mef`;
}

/* ------------------------------------------------------------------------- */
/* tree                                                                      */
/* ------------------------------------------------------------------------- */

function rebuildTree() {
  if (!E.treeRoot) return;
  E.rowByNode.clear();
  D.tree.replaceChildren();
  const fragment = document.createDocumentFragment();
  const rootEntry = buildTreeNode(E.treeRoot, 0, fragment);
  D.tree.append(fragment);
  applyTreeFilter();
  const selected = E.selectedNode;
  if (selected && E.rowByNode.has(selected)) {
    E.rowByNode.get(selected).row.classList.add('is-selected');
  }
  updateTreeCount();
}

function buildTreeNode(node, depth, parent) {
  const childrenNodes = childrenByTag(node, 'node');
  const isBranch = childrenNodes.length > 0;
  const isLeaf = !isBranch && node.hasAttribute('entity');
  const isUser = !isBranch && !isLeaf;
  const wrap = document.createElement('div');
  wrap.className = 'tree-node-wrap';
  const row = document.createElement('div');
  row.className = `tree-row ${isBranch ? 'tree-row-branch' : isLeaf ? 'tree-row-leaf' : 'tree-row-user'}`;
  row.setAttribute('role', 'treeitem');
  row.dataset.depth = String(depth);
  row.style.setProperty('--tree-depth', String(depth));
  row.tabIndex = 0;

  const entry = {
    node,
    wrap,
    row,
    childrenEl: null,
    labelEl: null,
    eyeBtn: null,
    markBtn: null,
    colorBtn: null,
    toggleBtn: null,
  };
  E.rowByNode.set(node, entry);

  if (isBranch) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'tree-toggle';
    toggle.setAttribute('aria-label', 'Rozbaliť / zbaliť');
    toggle.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleExpanded(node);
    });
    row.append(toggle);
    entry.toggleBtn = toggle;
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'tree-toggle-spacer';
    row.append(spacer);
  }

  if (!isUser) {
    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'tree-icon-btn tree-eye';
    eye.title = 'Viditeľnosť objektu / vetvy';
    eye.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleNodeAttr(node, 'nodeVisible');
    });
    row.append(eye);
    entry.eyeBtn = eye;
  }

  if (!isBranch) {
    const markBtn = document.createElement('button');
    markBtn.type = 'button';
    markBtn.className = 'tree-icon-btn tree-mark';
    markBtn.title = 'Viditeľnosť značky';
    markBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleNodeAttr(node, 'markVisible');
    });
    row.append(markBtn);
    entry.markBtn = markBtn;
  } else {
    const markState = document.createElement('span');
    markState.className = 'tree-mark-aggregate';
    markState.title = 'Stav značiek detí';
    row.append(markState);
    entry.markAggregate = markState;
  }

  if (!isUser) {
    const color = document.createElement('button');
    color.type = 'button';
    color.className = 'tree-color';
    color.title = 'Farba objektu / vetvy';
    color.addEventListener('click', (event) => {
      event.stopPropagation();
      openColorPopover(color, node);
    });
    row.append(color);
    entry.colorBtn = color;
  } else {
    const markIcon = document.createElement('span');
    markIcon.className = 'tree-user-pin';
    markIcon.innerHTML = markSymbolIcon(node.getAttribute('markSymbol'));
    row.append(markIcon);
  }

  const label = document.createElement('span');
  label.className = 'tree-label';
  label.textContent = nodeLabel(node) || (isUser ? 'vlastná popiska' : '(bez názvu)');
  label.title = label.textContent;
  row.append(label);
  entry.labelEl = label;

  if (isBranch) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'tree-row-action tree-add-user';
    add.title = 'Pridať vlastnú značku do tejto vetvy';
    add.setAttribute('aria-label', 'Pridať vlastnú značku');
    add.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    add.addEventListener('click', (event) => {
      event.stopPropagation();
      addUserMark(node);
    });
    row.append(add);
    entry.addBtn = add;
  }

  if (isUser) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'tree-row-action tree-remove-user';
    remove.title = 'Odstrániť vlastnú značku';
    remove.setAttribute('aria-label', 'Odstrániť vlastnú značku');
    remove.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 2 8 8M10 2l-8 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      removeUserMark(node);
    });
    row.append(remove);
    entry.removeBtn = remove;
  }

  row.addEventListener('click', () => selectNode(node));
  row.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    focusNode(node);
  });
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isBranch && (event.altKey || event.key === ' ')) toggleExpanded(node);
      else selectNode(node);
    }
    if (event.key === 'ArrowRight' && isBranch) toggleExpanded(node, true);
    if (event.key === 'ArrowLeft' && isBranch) toggleExpanded(node, false);
  });

  wrap.append(row);

  if (isBranch) {
    const childrenEl = document.createElement('div');
    childrenEl.className = 'tree-children';
    childrenEl.setAttribute('role', 'group');
    entry.childrenEl = childrenEl;
    for (const child of childrenNodes) buildTreeNode(child, depth + 1, childrenEl);
    wrap.append(childrenEl);
  }

  parent.append(wrap);
  updateRowState(node);
  return entry;
}

function setToggleVisual(entry, open) {
  if (!entry || !entry.childrenEl) return;
  entry.childrenEl.hidden = !open;
  entry.row.classList.toggle('is-expanded', open);
  if (entry.toggleBtn) {
    entry.toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    entry.toggleBtn.innerHTML = open
      ? '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
}

function toggleExpanded(node, force = null) {
  const entry = E.rowByNode.get(node);
  if (!entry || !entry.childrenEl) return;
  const open = force == null ? !E.expanded.has(node) : force;
  if (open) E.expanded.add(node);
  else E.expanded.delete(node);
  setToggleVisual(entry, open);
}

function applyTreeFilter() {
  if (!E.treeRoot) return;
  const query = E.searchQuery.trim().toLocaleLowerCase('sk');
  const apply = (node) => {
    const entry = E.rowByNode.get(node);
    if (!entry) return false;
    const own = !query || matchesQuery(node, query);
    let childMatch = false;
    for (const child of childrenByTag(node, 'node')) {
      childMatch = apply(child) || childMatch;
    }
    const visible = own || childMatch;
    entry.row.hidden = !visible;
    if (entry.childrenEl) {
      const open = query ? childMatch : E.expanded.has(node);
      setToggleVisual(entry, open);
    }
    return visible;
  };
  apply(E.treeRoot);
  updateTreeCount();
}

function matchesQuery(node, query) {
  const text = `${nodeLabel(node)} ${node.getAttribute('entity') || ''} ${node.getAttribute('markLabel') || ''}`.toLocaleLowerCase('sk');
  return text.includes(query);
}

function selectNode(node) {
  if (E.selectedNode && E.rowByNode.has(E.selectedNode)) {
    E.rowByNode.get(E.selectedNode).row.classList.remove('is-selected');
  }
  E.selectedNode = node;
  const entry = E.rowByNode.get(node);
  if (entry) entry.row.classList.add('is-selected');
  if (E.mapView?.scene) {
    for (const el of E.mapView.scene.querySelectorAll('.entity-focus')) el.classList.remove('entity-focus');
    if (node.hasAttribute('entity')) {
      const el = E.mapView.entityElement(node.getAttribute('entity'));
      if (el) el.classList.add('entity-focus');
    }
  }
  if (window.matchMedia('(max-width: 900px)').matches) {
    // On phones the tree is a slide-over; selecting something should reveal the map.
    if (document.body.classList.contains('editor-tree-open')) {
      document.body.classList.remove('editor-tree-open');
      D.panelToggle?.setAttribute('aria-expanded', 'false');
    }
  }
}

function focusNode(node) {
  if (!node) return;
  if (node.hasAttribute('entity')) {
    E.mapView?.focusEntity(node.getAttribute('entity'));
    return;
  }
  const entry = E.rowByNode.get(node);
  if (entry?.childrenEl && !E.expanded.has(node)) toggleExpanded(node, true);
  const mark = E.markByNode.get(node);
  if (mark && E.mapView) {
    E.mapView.focusPoint(mark.x, mark.y, 1.7);
  }
}

function toggleExpandedAll(open) {
  E.expanded.clear();
  if (open && E.treeRoot) {
    const addAll = (node) => {
      if (childrenByTag(node, 'node').length) {
        E.expanded.add(node);
        for (const child of childrenByTag(node, 'node')) addAll(child);
      }
    };
    addAll(E.treeRoot);
  } else if (E.treeRoot) {
    E.expanded.add(E.treeRoot);
  }
  for (const [node, entry] of E.rowByNode) {
    if (!entry.childrenEl) continue;
    setToggleVisual(entry, E.expanded.has(node));
  }
}

function toggleNodeAttr(node, attr) {
  const current = node.getAttribute(attr) || 'hidden';
  const next = current === 'visible' ? 'hidden' : 'visible';
  applyAttrRecursive(node, attr, next);
  propagateUp(node, attr);
  if (attr === 'nodeVisible') E.mapView?.applyDocument();
  updateAllRows();
  if (attr === 'markVisible') rebuildMarks();
  markDirty();
  updateMeta();
}

function applyAttrRecursive(node, attr, value) {
  node.setAttribute(attr, value);
  for (const child of childrenByTag(node, 'node')) {
    applyAttrRecursive(child, attr, value);
  }
}

function parentNodeOf(node) {
  let cur = node?.parentElement;
  while (cur && cur.tagName !== 'node' && cur.tagName !== 'nodelist') {
    if (cur.tagName === 'mapdata') return null;
    cur = cur.parentElement;
  }
  return cur && (cur.tagName === 'node' || cur.tagName === 'nodelist') ? cur : null;
}

function propagateUp(node, attr) {
  let cur = parentNodeOf(node);
  while (cur) {
    recomputeAggregate(cur, attr);
    cur = parentNodeOf(cur);
  }
}

function recomputeAggregate(node, attr) {
  const kids = childrenByTag(node, 'node');
  if (!kids.length) return;
  const values = kids.map((kid) => kid.getAttribute(attr));
  if (values.every((value) => value != null && value === values[0])) {
    node.setAttribute(attr, values[0]);
  } else {
    node.setAttribute(attr, 'any');
  }
}

function updateAllRows() {
  for (const node of E.rowByNode.keys()) updateRowState(node);
  updateTreeCount();
}

function updateRowState(node) {
  const entry = E.rowByNode.get(node);
  if (!entry) return;
  if (entry.eyeBtn) {
    const state = normalizeState(node.getAttribute('nodeVisible'));
    entry.eyeBtn.innerHTML = eyeIcon(state);
    entry.eyeBtn.dataset.state = state;
    entry.eyeBtn.title = state === 'visible' ? 'Skryť objekt / vetvu' : state === 'hidden' ? 'Zobraziť objekt / vetvu' : 'Zmiešaná viditeľnosť';
  }
  if (entry.markBtn) {
    const state = normalizeState(node.getAttribute('markVisible'));
    entry.markBtn.innerHTML = pinIcon(state);
    entry.markBtn.dataset.state = state;
    entry.markBtn.title = state === 'visible' ? 'Skryť značku' : state === 'hidden' ? 'Zobraziť značku' : 'Zmiešaná viditeľnosť značiek';
  }
  if (entry.markAggregate) {
    const state = normalizeState(node.getAttribute('markVisible'));
    entry.markAggregate.innerHTML = pinIcon(state);
    entry.markAggregate.dataset.state = state;
  }
  if (entry.colorBtn) {
    const value = node.getAttribute('nodeColor');
    const hex = normalizeHex(value);
    entry.colorBtn.innerHTML = '';
    const swatch = document.createElement('span');
    swatch.className = 'tree-color-swatch';
    if (hex) {
      swatch.style.background = hex;
    } else {
      swatch.classList.add('is-any');
    }
    entry.colorBtn.append(swatch);
    entry.colorBtn.title = hex ? `Farba ${hex}` : 'Zmiešaná farba';
  }
  if (entry.labelEl) {
    entry.labelEl.textContent = nodeLabel(node) || 'vlastná popiska';
    entry.labelEl.title = entry.labelEl.textContent;
  }
}

function normalizeState(value) {
  if (value === 'visible') return 'visible';
  if (value === 'any') return 'any';
  return 'hidden';
}

function eyeIcon(state) {
  if (state === 'visible') {
    return '<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M1 8s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="8" r="2.6" fill="currentColor"/></svg>';
  }
  if (state === 'any') {
    return '<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M1 8s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2.4 2.4"/><circle cx="10" cy="8" r="2" fill="currentColor" opacity=".55"/></svg>';
  }
  return '<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M1 8s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".38"/><path d="M3 14 17 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
}

function pinIcon(state) {
  const opacity = state === 'hidden' ? '.36' : '1';
  const slash = state === 'hidden' ? '<path d="M4 15 16 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' : '';
  const dot = state === 'any' ? '<circle cx="14.5" cy="4.5" r="2.2" fill="currentColor"/>' : '';
  return `<svg viewBox="0 0 18 18" aria-hidden="true" style="opacity:${opacity}"><path d="M9 16.5S14.5 11 14.5 6.8a5.5 5.5 0 0 0-11 0C3.5 11 9 16.5 9 16.5Z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="6.8" r="1.9" fill="currentColor"/>${slash}${dot}</svg>`;
}

function markSymbolIcon(symbol) {
  const icon = {
    town: '●', region: '▣', district: '◆', river: '≈', lake: '◉', sea: '≋', island: '●', reservation: '▲', geo: '▲', legend: '★',
  }[symbol] || '●';
  const span = document.createElement('span');
  span.textContent = icon;
  span.className = `tree-user-symbol symbol-${symbol || 'default'}`;
  return span.outerHTML;
}

function updateTreeCount() {
  if (!D.treeCount) return;
  const query = E.searchQuery.trim();
  if (query) {
    const matches = Array.from(E.rowByNode.values()).filter((entry) => !entry.row.hidden).length;
    D.treeCount.textContent = `${matches} zhôd`;
  } else {
    const leaves = E.doc ? entityNodes(E.doc.documentElement).length : 0;
    const users = E.doc ? Array.from(E.doc.getElementsByTagName('node')).filter((n) => !n.hasAttribute('entity') && !childrenByTag(n, 'node').length).length : 0;
    D.treeCount.textContent = `${leaves} ${pluralSk(leaves, 'objekt', 'objekty', 'objektov')}${users ? ` + ${users} ${pluralSk(users, 'značka', 'značky', 'značiek')}` : ''}`;
  }
}

/* ------------------------------------------------------------------------- */
/* colours                                                                   */
/* ------------------------------------------------------------------------- */

function isTransparent(node) {
  let cur = node;
  while (cur && cur.tagName === 'node') {
    if (cur.getAttribute('transparent') === 'true') return true;
    cur = cur.parentElement;
  }
  return node?.getAttribute('transparent') === 'true';
}

function openColorPopover(anchor, node) {
  closeColorPopover();
  const pop = document.createElement('div');
  pop.className = 'color-popover';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Paleta farieb');
  const values = isTransparent(node) ? PALETTE_TRANS_VALUES : PALETTE_VALUES;
  const current = normalizeHex(node.getAttribute('nodeColor'));
  const grid = document.createElement('div');
  grid.className = 'color-grid';
  for (const value of values) {
    const hex = `#${value.toString(16).padStart(6, '0')}`;
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch';
    swatch.style.background = hex;
    swatch.title = hex;
    swatch.setAttribute('aria-label', `Farba ${hex}`);
    if (hex === current) swatch.classList.add('is-selected');
    swatch.addEventListener('click', () => {
      setColor(node, hex);
      closeColorPopover();
    });
    grid.append(swatch);
  }
  pop.append(grid);
  const custom = document.createElement('label');
  custom.className = 'color-custom';
  custom.innerHTML = '<span>Vlastná farba</span>';
  const input = document.createElement('input');
  input.type = 'color';
  input.id = 'editor-custom-color';
  input.name = 'nodeColor';
  input.setAttribute('aria-label', 'Vlastná farba objektu');
  input.value = current || '#000000';
  input.addEventListener('input', () => setColor(node, input.value, { live: true }));
  custom.append(input);
  pop.append(custom);
  document.body.append(pop);
  const rect = anchor.getBoundingClientRect();
  pop.style.position = 'fixed';
  const popRect = pop.getBoundingClientRect();
  pop.style.left = `${clamp(rect.left, 8, window.innerWidth - popRect.width - 8)}px`;
  pop.style.top = `${clamp(rect.bottom + 6, 8, window.innerHeight - popRect.height - 8)}px`;
  E.colorPopover = pop;
  setTimeout(() => {
    const onDown = (event) => {
      if (!pop.contains(event.target) && event.target !== anchor) {
        closeColorPopover();
        document.removeEventListener('pointerdown', onDown, true);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
  }, 0);
}

function closeColorPopover() {
  if (E.colorPopover) {
    E.colorPopover.remove();
    E.colorPopover = null;
  }
}

function setColor(node, hex, { live = false } = {}) {
  const value = valueFromHex(hex);
  applyColorRecursive(node, value);
  propagateUp(node, 'nodeColor');
  updateAllRows();
  E.mapView?.applyDocument();
  if (!live) markDirty();
  else {
    E.dirty = true;
    updateDocumentChrome();
  }
}

function applyColorRecursive(node, value) {
  node.setAttribute('nodeColor', value);
  for (const child of childrenByTag(node, 'node')) applyColorRecursive(child, value);
}

/* ------------------------------------------------------------------------- */
/* marks                                                                     */
/* ------------------------------------------------------------------------- */

function rebuildMarks() {
  if (!E.mapView) return;
  E.mapView.clearMarks();
  E.markByNode.clear();
  if (!E.doc) return;
  const walk = (node) => {
    for (const child of childrenByTag(node, 'node')) {
      const isBranch = childrenByTag(child, 'node').length > 0;
      const isLeaf = !isBranch && child.hasAttribute('entity');
      const isUser = !isBranch && !isLeaf;
      if ((isLeaf || isUser) && child.getAttribute('markVisible') === 'visible') {
        addMarkForNode(child, isUser);
      }
      if (isBranch) walk(child);
    }
  };
  walk(E.treeRoot);
  if (E.mapView) E.mapView.setMarksVisible(E.showMarks);
  updateMeta();
}

function addMarkForNode(node, isUser) {
  const id = `node-${++markCounter}`;
  const symbol = node.getAttribute('markSymbol') || 'default';
  const mark = E.mapView.addMark({
    id,
    x: getNumberAttr(node, 'markX', 0),
    y: getNumberAttr(node, 'markY', 0),
    label: node.getAttribute('markLabel') || nodeLabel(node),
    symbol,
    state: isUser ? 'user' : 'edit',
    labelVisible: true,
    draggable: true,
    user: isUser,
    meta: { node },
    onMove: () => {
      node.setAttribute('markX', String(Math.round(mark.x * 10) / 10));
      node.setAttribute('markY', String(Math.round(mark.y * 10) / 10));
      markDirty();
    },
    onLabelChange: (_mark, value) => {
      node.setAttribute('markLabel', value);
      if (isUser) {
        node.setAttribute('label', value);
        updateRowState(node);
      }
      markDirty();
    },
    onContextMenu: (m, event) => openMarkContextMenu(m, node, event),
  });
  E.markByNode.set(node, mark);
}

let markCounter = 0;

function openMarkContextMenu(mark, node, event) {
  closeContextMenu();
  const menu = E.contextMenu;
  menu.replaceChildren();
  const addItem = (label, action, danger = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `context-item${danger ? ' is-danger' : ''}`;
    button.textContent = label;
    button.addEventListener('click', () => {
      closeContextMenu();
      action();
    });
    menu.append(button);
  };
  addItem('Premenovať značku', () => E.mapView.beginLabelEdit(mark));
  addItem('Prejsť na objekt', () => {
    if (node.hasAttribute('entity')) E.mapView.focusEntity(node.getAttribute('entity'));
  });
  addItem('Skryť značku', () => {
    applyAttrRecursive(node, 'markVisible', 'hidden');
    propagateUp(node, 'markVisible');
    updateAllRows();
    rebuildMarks();
    markDirty();
  });
  if (!node.hasAttribute('entity') && !childrenByTag(node, 'node').length) {
    addItem('Odstrániť vlastnú značku', () => removeUserMark(node), true);
  }
  menu.hidden = false;
  menu.style.position = 'fixed';
  menu.style.left = `${clamp(event.clientX, 8, window.innerWidth - 220)}px`;
  menu.style.top = `${clamp(event.clientY, 8, window.innerHeight - 180)}px`;
}

function createContextMenu() {
  const menu = document.createElement('div');
  menu.id = 'editorContextMenu';
  menu.className = 'context-menu';
  menu.hidden = true;
  document.body.append(menu);
  E.contextMenu = menu;
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target)) closeContextMenu();
  }, true);
  window.addEventListener('blur', closeContextMenu);
}

function closeContextMenu() {
  if (E.contextMenu) E.contextMenu.hidden = true;
}

/* ------------------------------------------------------------------------- */
/* user marks                                                                */
/* ------------------------------------------------------------------------- */

function getAddTarget() {
  let node = E.selectedNode;
  while (node && childrenByTag(node, 'node').length === 0) {
    node = parentNodeOf(node);
  }
  return node || E.treeRoot;
}

function addUserMark(targetNode = null) {
  if (!E.doc) return;
  const branch = targetNode || getAddTarget();
  if (!branch) return;
  const user = E.doc.createElement('node');
  user.setAttribute('label', 'vlastná popiska');
  user.setAttribute('markSymbol', branch.getAttribute('markSymbol') || 'legend');
  user.setAttribute('markLabel', 'vlastná popiska');
  const cx = E.mapView ? Math.round(E.mapView.W / 2) : 0;
  const cy = E.mapView ? Math.round(E.mapView.H / 2) : 0;
  user.setAttribute('markX', String(cx));
  user.setAttribute('markY', String(cy));
  user.setAttribute('markVisible', 'visible');
  branch.append(user);
  recomputeAggregate(branch, 'markVisible');
  propagateUp(branch, 'markVisible');
  E.expanded.add(branch);
  rebuildTree();
  rebuildMarks();
  markDirty();
  selectNode(user);
  const entry = E.rowByNode.get(user);
  if (entry) {
    entry.row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => entry.row.focus(), 220);
  }
  const mark = E.markByNode.get(user);
  if (mark) setTimeout(() => E.mapView.beginLabelEdit(mark), 260);
  toast('Vlastná značka pridaná. Premenuj ju na mape.', 'success');
}

async function removeUserMark(node) {
  if (!node || node.hasAttribute('entity') || childrenByTag(node, 'node').length) return;
  const ok = await confirmDialog({
    title: 'Odstrániť značku?',
    message: `Naozaj odstrániť „${node.getAttribute('markLabel') || nodeLabel(node)}“?`,
    okLabel: 'Odstrániť',
    cancelLabel: 'Zrušiť',
    danger: true,
  });
  if (!ok) return;
  const parent = node.parentElement;
  const mark = E.markByNode.get(node);
  if (mark) E.mapView.removeMark(mark);
  node.remove();
  recomputeAggregate(parent, 'markVisible');
  propagateUp(parent, 'markVisible');
  if (E.selectedNode === node) E.selectedNode = null;
  rebuildTree();
  rebuildMarks();
  markDirty();
  toast('Značka odstránená.', 'success');
}

/* ------------------------------------------------------------------------- */
/* drawing                                                                   */
/* ------------------------------------------------------------------------- */

function cancelCurrentDrawing() {
  if (!E.drawState) return;
  E.drawState.preview?.remove();
  window.removeEventListener('pointermove', onEditorDrawMove, true);
  window.removeEventListener('pointerup', onEditorDrawEnd, true);
  window.removeEventListener('pointercancel', onEditorDrawEnd, true);
  E.drawState = null;
}

function setDrawTool(tool) {
  cancelCurrentDrawing();
  E.drawTool = tool || null;
  for (const button of D.drawTools) {
    const active = button.dataset.drawTool === E.drawTool;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  const active = !!E.drawTool;
  D.drawToggle?.classList.toggle('is-active', active);
  D.drawToggle?.setAttribute('aria-pressed', active ? 'true' : 'false');
  if (active) {
    D.drawToolbar.hidden = false;
    if (E.mapView) {
      E.mapView.interaction = 'draw';
      E.mapView.markLayer.style.pointerEvents = 'none';
      E.mapView.viewport.classList.add('is-drawing');
    }
    if (D.mapHint) D.mapHint.textContent = 'Kresli na mape. Vyber nástroj alebo zavri panel.';
  } else {
    if (E.mapView) {
      E.mapView.interaction = 'pan';
      E.mapView.markLayer.style.pointerEvents = '';
      E.mapView.viewport.classList.remove('is-drawing');
    }
    if (D.mapHint) D.mapHint.textContent = 'Ťahaj značky, klikni na objekt alebo kresli';
  }
}

function toggleDrawingPanel(force = null) {
  const show = force == null ? D.drawToolbar.hidden : force;
  if (show) {
    setDrawTool(E.drawTool || null);
    D.drawToolbar.hidden = false;
    D.drawToggle?.classList.add('is-active');
    D.drawToggle?.setAttribute('aria-pressed', 'true');
    if (!E.drawTool) {
      // The original has no default tool selected; keep the panel open with no
      // active tool and let the user pick one.
      if (E.mapView) {
        E.mapView.interaction = 'pan';
        E.mapView.markLayer.style.pointerEvents = '';
      }
    }
  } else {
    D.drawToolbar.hidden = true;
    setDrawTool(null);
    D.drawToggle?.classList.remove('is-active');
    D.drawToggle?.setAttribute('aria-pressed', 'false');
  }
}

function bindDrawing() {
  D.drawToggle?.addEventListener('click', () => toggleDrawingPanel());
  D.drawClose?.addEventListener('click', () => toggleDrawingPanel(false));
  for (const button of D.drawTools) {
    button.addEventListener('click', () => {
      const tool = button.dataset.drawTool;
      setDrawTool(E.drawTool === tool ? null : tool);
    });
  }
  D.drawColor?.addEventListener('input', () => {
    E.drawColor = D.drawColor.value;
  });
  D.drawThickness?.addEventListener('input', () => {
    E.drawThickness = Number(D.drawThickness.value);
    D.drawThicknessValue.textContent = String(E.drawThickness);
  });
  D.drawFill?.addEventListener('change', () => {
    E.drawFill = D.drawFill.checked;
  });
  D.drawDeleteLast?.addEventListener('click', deleteLastDrawing);
  D.mapHost?.addEventListener('pointerdown', onEditorDrawStart, true);
}

function onEditorDrawStart(event) {
  if (!E.drawTool || !E.mapView) return;
  if (event.button != null && event.button !== 0) return;
  if (event.target.closest('.map-mark')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const start = E.mapView.toMapPoint(event.clientX, event.clientY);
  const tool = E.drawTool;
  const state = {
    tool,
    start,
    points: tool === 'free' ? [[start.x, start.y]] : [],
    current: { ...start },
    color: E.drawColor,
    thickness: E.drawThickness,
    fill: E.drawFill,
    preview: null,
  };
  E.drawState = state;
  state.preview = createPreviewElement(state);
  E.mapView.drawLayer.append(state.preview);
  window.addEventListener('pointermove', onEditorDrawMove, true);
  window.addEventListener('pointerup', onEditorDrawEnd, true);
  window.addEventListener('pointercancel', onEditorDrawEnd, true);
}

function onEditorDrawMove(event) {
  const state = E.drawState;
  if (!state || !E.mapView) return;
  event.preventDefault();
  const pt = E.mapView.toMapPoint(event.clientX, event.clientY);
  state.current = pt;
  if (state.tool === 'free') {
    const last = state.points[state.points.length - 1];
    if (Math.hypot(pt.x - last[0], pt.y - last[1]) > 0.6) state.points.push([pt.x, pt.y]);
  }
  updatePreviewElement(state);
}

function onEditorDrawEnd(event) {
  const state = E.drawState;
  if (!state) return;
  event.preventDefault();
  window.removeEventListener('pointermove', onEditorDrawMove, true);
  window.removeEventListener('pointerup', onEditorDrawEnd, true);
  window.removeEventListener('pointercancel', onEditorDrawEnd, true);
  E.drawState = null;
  state.preview?.remove();
  const record = E.doc.createElement('drawing');
  record.setAttribute('type', state.tool);
  record.setAttribute('sx', String(round1(state.start.x)));
  record.setAttribute('sy', String(round1(state.start.y)));
  if (state.tool === 'free') {
    record.setAttribute('cx', state.points.map((p) => round1(p[0])).join(','));
    record.setAttribute('cy', state.points.map((p) => round1(p[1])).join(','));
  } else {
    record.setAttribute('cx', String(round1(state.current.x)));
    record.setAttribute('cy', String(round1(state.current.y)));
  }
  record.setAttribute('fill', String(state.fill));
  record.setAttribute('color', valueFromHex(state.color));
  record.setAttribute('thickness', String(state.thickness));
  ensureDrawingList().append(record);
  E.mapView.redrawDrawings();
  markDirty();
  updateMeta();
}

function createPreviewElement(state) {
  const el = document.createElementNS(SVG_NS, state.tool === 'rect' ? 'rect' : state.tool === 'oval' ? 'ellipse' : 'path');
  el.setAttribute('fill', state.fill && (state.tool === 'rect' || state.tool === 'oval') ? state.color : 'none');
  el.setAttribute('stroke', state.color);
  el.setAttribute('stroke-width', String(Math.max(0.5, state.thickness)));
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('pointer-events', 'none');
  el.classList.add('drawing-preview');
  updatePreviewElement(state, el);
  return el;
}

function updatePreviewElement(state, el = state.preview) {
  if (!el) return;
  const { start, current, tool, points } = state;
  if (tool === 'line') {
    el.setAttribute('d', `M ${start.x} ${start.y} L ${current.x} ${current.y}`);
  } else if (tool === 'rect') {
    el.setAttribute('x', String(Math.min(start.x, current.x)));
    el.setAttribute('y', String(Math.min(start.y, current.y)));
    el.setAttribute('width', String(Math.abs(current.x - start.x)));
    el.setAttribute('height', String(Math.abs(current.y - start.y)));
  } else if (tool === 'oval') {
    el.setAttribute('cx', String((start.x + current.x) / 2));
    el.setAttribute('cy', String((start.y + current.y) / 2));
    el.setAttribute('rx', String(Math.abs(current.x - start.x) / 2));
    el.setAttribute('ry', String(Math.abs(current.y - start.y) / 2));
  } else {
    el.setAttribute('d', points.map((p, index) => `${index === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' '));
  }
}

function deleteLastDrawing() {
  const list = ensureDrawingList();
  if (!list || !list.children.length) {
    toast('Žiadna kresba na vymazanie.', 'info');
    return;
  }
  list.lastElementChild.remove();
  E.mapView.redrawDrawings();
  markDirty();
  updateMeta();
  toast('Posledná kresba vymazaná.', 'success');
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

/* ------------------------------------------------------------------------- */
/* bindings                                                                  */
/* ------------------------------------------------------------------------- */

function bindToolbar() {
  for (const button of D.actions) {
    button.addEventListener('click', () => handleAction(button.dataset.editorAction));
  }
  D.back.addEventListener('click', () => {
    // The document stays open in memory; unsaved changes are protected by
    // beforeunload and by the New/Open confirmation.
    hideEditorScreen();
    goHome();
  });
  D.panelToggle?.addEventListener('click', () => {
    const open = !document.body.classList.contains('editor-tree-open');
    document.body.classList.toggle('editor-tree-open', open);
    D.panelToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    requestAnimationFrame(() => E.mapView?.layout());
  });
  D.treeClose?.addEventListener('click', () => {
    document.body.classList.remove('editor-tree-open');
    D.panelToggle?.setAttribute('aria-expanded', 'false');
    requestAnimationFrame(() => E.mapView?.layout());
  });
  D.addMark.addEventListener('click', () => addUserMark());
  D.expandAll.addEventListener('click', () => toggleExpandedAll(true));
  D.collapseAll.addEventListener('click', () => toggleExpandedAll(false));
  D.showMarks.addEventListener('change', () => {
    E.showMarks = D.showMarks.checked;
    E.mapView?.setMarksVisible(E.showMarks);
  });
  D.showDrawings.addEventListener('change', () => {
    E.showDrawings = D.showDrawings.checked;
    E.mapView?.setDrawingsVisible(E.showDrawings);
  });
  D.zoomIn.addEventListener('click', () => E.mapView?.zoomIn());
  D.zoomOut.addEventListener('click', () => E.mapView?.zoomOut());
  D.zoomCenter?.addEventListener('click', () => E.mapView?.center());
  D.zoomFit.addEventListener('click', () => E.mapView?.fit());
}

function handleAction(action) {
  if (!action) return;
  if (action === 'new') {
    openNewMapOverlay();
  } else if (action === 'open') {
    openFile();
  } else if (action === 'save') {
    saveFile();
  } else if (action === 'saveas') {
    saveAsFile();
  } else if (action === 'export') {
    exportImage();
  } else if (action === 'print') {
    printMap();
  } else if (action === 'help') {
    window.open('help/index.html', '_blank', 'noopener');
  } else if (action === 'about') {
    openOverlay(D.aboutOverlay, D.aboutOk);
  }
}

function bindEditorTree() {
  D.treeSearch.addEventListener('input', () => {
    E.searchQuery = D.treeSearch.value;
    applyTreeFilter();
  });
}

async function openNewMapOverlay() {
  if (!(await confirmDiscard('Nová mapa'))) return;
  buildNewMapCards();
  openOverlay(D.newOverlay, D.newMaps.querySelector('button'));
}

function buildNewMapCards() {
  D.newMaps.replaceChildren();
  for (const def of classicData.maps) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'setup-map-card';
    button.innerHTML = `
      <span class="setup-map-thumb"><img src="${def.thumb}" alt="" loading="lazy"></span>
      <span class="setup-map-copy">
        <strong>${escapeHtml(capitalize(def.label))}</strong>
        <span>${def.entities} ${pluralSk(def.entities, 'objekt', 'objekty', 'objektov')} · ${def.width}×${def.height}</span>
      </span>`;
    button.addEventListener('click', async () => {
      closeOverlay(D.newOverlay);
      await loadNewMap(def.key);
    });
    D.newMaps.append(button);
  }
}

function bindNewMapEvents() {
  D.newClose.addEventListener('click', () => closeOverlay(D.newOverlay));
  D.newCancel.addEventListener('click', () => closeOverlay(D.newOverlay));
  D.newOverlay.addEventListener('click', (event) => {
    if (event.target === D.newOverlay) closeOverlay(D.newOverlay);
  });
}

function bindExport() {
  D.exportClose.addEventListener('click', () => closeOverlay(D.exportOverlay));
  D.exportCancel.addEventListener('click', () => closeOverlay(D.exportOverlay));
  D.exportOk.addEventListener('click', runExport);
  D.exportOverlay.addEventListener('click', (event) => {
    if (event.target === D.exportOverlay) closeOverlay(D.exportOverlay);
  });
}

function bindAbout() {
  D.aboutClose.addEventListener('click', () => closeOverlay(D.aboutOverlay));
  D.aboutOk.addEventListener('click', () => closeOverlay(D.aboutOverlay));
  D.aboutOverlay.addEventListener('click', (event) => {
    if (event.target === D.aboutOverlay) closeOverlay(D.aboutOverlay);
  });
}

function bindKeyboard() {
  document.addEventListener('keydown', (event) => {
    if (D.screen.hidden) return;
    if (!document.querySelector('#helpOverlay')?.hidden) return;
    const inControl = event.target.closest?.('input, select, textarea, [contenteditable]');
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (event.shiftKey) saveAsFile();
      else saveFile();
      return;
    }
    if (mod && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      openFile();
      return;
    }
    if (mod && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      openNewMapOverlay();
      return;
    }
    if (event.key === 'Escape') {
      if (E.drawState) {
        cancelCurrentDrawing();
        return;
      }
      if (!D.exportOverlay.hidden) {
        closeOverlay(D.exportOverlay);
        return;
      }
      if (!D.newOverlay.hidden) {
        closeOverlay(D.newOverlay);
        return;
      }
      if (!D.aboutOverlay.hidden) {
        closeOverlay(D.aboutOverlay);
        return;
      }
      if (document.body.classList.contains('editor-tree-open')) {
        document.body.classList.remove('editor-tree-open');
        D.panelToggle?.setAttribute('aria-expanded', 'false');
        requestAnimationFrame(() => E.mapView?.layout());
        return;
      }
      if (!D.drawToolbar.hidden) {
        toggleDrawingPanel(false);
        return;
      }
      closeContextMenu();
      closeColorPopover();
    }
    if (!inControl) {
      const inMapControl = event.target.closest?.('button, a, .tree-row');
      const overlayOpen = Boolean(document.querySelector('.overlay.is-open'));
      if (!inMapControl && !overlayOpen && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && !mod) {
        event.preventDefault();
        const step = event.shiftKey ? 190 : 64;
        if (event.key === 'ArrowLeft') E.mapView?.panBy(step, 0);
        else if (event.key === 'ArrowRight') E.mapView?.panBy(-step, 0);
        else if (event.key === 'ArrowUp') E.mapView?.panBy(0, step);
        else E.mapView?.panBy(0, -step);
      } else if (event.key === '0' && !mod) {
        E.mapView?.fit();
      } else if ((event.key === '+' || event.key === '=') && !mod) {
        E.mapView?.zoomIn();
      } else if (event.key === '-' && !mod) {
        E.mapView?.zoomOut();
      }
    }
  });
}

function updateZoomLabel() {
  if (!D.zoomValue) return;
  D.zoomValue.textContent = E.mapView ? `${E.mapView.percent()}%` : '100%';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalize(value) {
  const text = String(value == null ? '' : value);
  return text ? text.charAt(0).toLocaleUpperCase('sk') + text.slice(1) : text;
}

function pluralSk(count, one, few, many) {
  const n = Math.abs(Number(count) || 0);
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
