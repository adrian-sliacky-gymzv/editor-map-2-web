/* ------------------------------------------------------------------------- */
/* Editor máp 2 — shared map renderer                                        */
/*                                                                           */
/* Renders one of the original vector map scenes, applies the .mef colours    */
/* and visibility, and owns the mark/drawing layers plus zoom & pan.          */
/* ------------------------------------------------------------------------- */

import { normalizeHex, hexFromValue } from './classic-data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const MARK_ICONS = {
  town: '<path fill="currentColor" d="M8 0.8c-3.2 0-5.8 2.5-5.8 5.6 0 4.1 5.8 9.2 5.8 9.2s5.8-5.1 5.8-9.2C13.8 3.3 11.2 0.8 8 0.8Z"/><circle cx="8" cy="6.4" r="2.2" fill="#fff"/>',
  region: '<path fill="currentColor" d="M2.2 1.5h11.6v9.2H8l-2.8 3.1v-3.1H2.2Z"/>',
  district: '<path fill="currentColor" d="M8 0.8 15 8l-7 7.2L1 8Z"/>',
  river: '<path d="M1.5 5.8c2-2.5 3.6 2.4 5.5 0s3.2 2.4 5.5 0M1.5 10.3c2-2.5 3.6 2.4 5.5 0s3.2 2.4 5.5 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  lake: '<path fill="currentColor" d="M8 1.2C5.4 5 3.1 7 3.1 10a4.9 4.9 0 0 0 9.8 0c0-3-2.3-5-4.9-8.8Z"/>',
  sea: '<path d="M1.2 6.1c2-2.2 3.6 2.2 5.6 0s3.6 2.2 5.6 0M1.2 10.3c2-2.2 3.6 2.2 5.6 0s3.6 2.2 5.6 0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>',
  island: '<circle cx="8" cy="8" r="5.4" fill="currentColor"/><path d="M4.6 10.4c1.6 1.5 5.3 1.5 6.8 0" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
  reservation: '<path fill="currentColor" d="M8 0.8 14 5v6L8 15.2 2 11V5Z"/><path d="M8 4v7M5.7 6.2 8 8.6l2.3-2.4" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  geo: '<path fill="currentColor" d="m8 1.4 7 12.6H1Z"/>',
  legend: '<path fill="currentColor" d="m8 1 2 4.3 4.7.6-3.5 3.3.9 4.7L8 11.6 3.9 13.9l.9-4.7L1.3 5.9 6 5.3Z"/>',
  default: '<circle cx="8" cy="8" r="5.6" fill="currentColor"/>',
};

const MARK_COLORS = {
  town: '#d97706',
  region: '#2563eb',
  district: '#0f766e',
  river: '#0284c7',
  lake: '#1d4ed8',
  sea: '#0891b2',
  island: '#0d9488',
  reservation: '#15803d',
  geo: '#a16207',
  legend: '#475569',
  default: '#334155',
};

const MARK_STYLE = `
.map-mark { cursor: default; }
.map-mark .mark-halo { fill: #fff; stroke: currentColor; stroke-width: 1.5; }
.map-mark .mark-glyph { color: currentColor; }
.map-mark .mark-label-bg { fill: rgba(255,255,255,.94); stroke: rgba(15,23,42,.16); stroke-width: 1; }
.map-mark .mark-label-text { fill: #0f172a; font: 600 11.5px/1 "Segoe UI", system-ui, sans-serif; dominant-baseline: middle; }
.map-mark[data-state="correct"] { color: #15803d !important; }
.map-mark[data-state="correct"] .mark-halo { stroke-width: 2.5; }
.map-mark[data-state="incorrect"] { color: #dc2626 !important; }
.map-mark[data-state="incorrect"] .mark-halo { stroke-width: 2.5; }
.map-mark[data-state="edit"] { color: #4f46e5 !important; }
.map-mark[data-state="user"] { color: #7c3aed !important; }
`;

let markSeq = 0;

export class MapView {
  constructor(viewport, options = {}) {
    this.viewport = viewport;
    this.options = options;
    this.canvas = document.createElement('div');
    this.canvas.className = 'map-canvas';
    this.canvas.setAttribute('aria-hidden', 'false');
    this.viewport.insertBefore(this.canvas, this.viewport.firstChild);

    this.scene = null;
    this.overlay = null;
    this.drawLayer = null;
    this.markLayer = null;
    this.mapDef = null;
    this.mapDoc = null;
    this.W = 1;
    this.H = 1;
    this.entities = new Map();
    this.marks = new Map();
    this.marksVisible = true;
    this.drawingsVisible = true;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.fitScale = 1;
    this.baseX = 0;
    this.baseY = 0;
    this.interaction = options.interaction || 'pan';
    this.pointers = new Map();
    this.panning = null;
    this.pinch = null;
    this.pointerDragged = false;
    this.lastLayout = { w: 0, h: 0 };
    this.mapClickHandler = options.onMapClick || null;
    this.markScale = 1;
    this._initEvents();
    this._resizeObserver = new ResizeObserver(() => this.layout());
    this._resizeObserver.observe(this.viewport);
  }

  destroy() {
    this._eventAbort?.abort();
    this._resizeObserver?.disconnect();
    if (this._labelEditor) {
      this._labelEditor.remove();
      this._labelEditor = null;
    }
    this.viewport.replaceChildren();
    this.marks.clear();
    this.entities.clear();
  }

  async load(mapDef, mapDoc, sceneText) {
    this.mapDef = mapDef;
    this.mapDoc = mapDoc;
    const parsed = new DOMParser().parseFromString(sceneText, 'image/svg+xml');
    const err = parsed.querySelector('parsererror');
    if (err) throw new Error('Mapový podklad sa nepodarilo načítať.');
    const svg = document.importNode(parsed.documentElement, true);
    svg.classList.add('map-scene');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';
    const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    if (vb.length === 4) {
      this.W = vb[2];
      this.H = vb[3];
    } else {
      this.W = mapDef.width || 1000;
      this.H = mapDef.height || 700;
    }

    this.canvas.replaceChildren();
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.canvas.append(svg);

    this.overlay = document.createElementNS(SVG_NS, 'svg');
    this.overlay.classList.add('map-overlay');
    this.overlay.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    this.overlay.setAttribute('width', '100%');
    this.overlay.setAttribute('height', '100%');
    this.overlay.setAttribute('role', 'group');
    this.overlay.setAttribute('aria-label', 'Značky na mape');
    this.overlay.style.position = 'absolute';
    this.overlay.style.inset = '0';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.overflow = 'visible';
    this.drawLayer = document.createElementNS(SVG_NS, 'g');
    this.drawLayer.classList.add('drawing-layer');
    this.markLayer = document.createElementNS(SVG_NS, 'g');
    this.markLayer.classList.add('mark-layer');
    this.overlay.append(this.drawLayer, this.markLayer);
    this.canvas.append(this.overlay);

    this.scene = svg;
    this.entities.clear();
    for (const el of svg.querySelectorAll('.map-entity')) {
      this.entities.set(el.getAttribute('data-entity'), el);
    }
    this.applyDocument();
    this.redrawDrawings();
    this.marks.clear();
    this.markLayer.replaceChildren();
    this.layout();
    return this;
  }

  /* ---------------------------------------------------------------- */
  /* document -> scene                                                */
  /* ---------------------------------------------------------------- */

  applyDocument() {
    if (!this.mapDoc) return;
    const byEntity = new Map();
    for (const node of this.mapDoc.getElementsByTagName('node')) {
      if (node.hasAttribute('entity')) byEntity.set(node.getAttribute('entity'), node);
    }
    for (const [name, el] of this.entities) {
      const node = byEntity.get(name);
      if (!node) {
        el.style.display = 'none';
        continue;
      }
      const visible = node.getAttribute('nodeVisible') === 'visible';
      el.style.display = visible ? '' : 'none';
      this.setEntityColor(name, node.getAttribute('nodeColor') || '#000000');
    }
  }

  hideAll() {
    for (const el of this.entities.values()) el.style.display = 'none';
  }

  showOnly(names) {
    const set = names instanceof Set ? names : new Set(names);
    for (const [name, el] of this.entities) {
      el.style.display = set.has(name) ? '' : 'none';
    }
  }

  setEntityVisible(name, visible) {
    const el = this.entities.get(name);
    if (el) el.style.display = visible ? '' : 'none';
  }

  isEntityVisible(name) {
    const el = this.entities.get(name);
    return !!el && el.style.display !== 'none';
  }

  setEntityColor(name, colorValue) {
    const el = this.entities.get(name);
    if (!el) return;
    const color = normalizeHex(colorValue) || '#000000';
    const mode = el.getAttribute('data-color-mode');
    if (mode === 'replace') {
      for (const path of el.querySelectorAll('[data-replace-fill]')) {
        const base = path.getAttribute('data-base-fill') || '#ffffff';
        path.setAttribute('fill', color === '#010101' ? base : color);
      }
    } else if (mode === 'add') {
      for (const path of el.querySelectorAll('[data-base-fill], [data-base-stroke]')) {
        if (path.hasAttribute('data-base-fill')) {
          path.setAttribute('fill', additive(path.getAttribute('data-base-fill'), color));
        }
        if (path.hasAttribute('data-base-stroke')) {
          path.setAttribute('stroke', additive(path.getAttribute('data-base-stroke'), color));
        }
      }
    } else if (mode === 'override') {
      for (const path of el.querySelectorAll('path, polygon, polyline, circle, ellipse, rect, line, text')) {
        if (solid(path.getAttribute('fill'))) path.setAttribute('fill', color);
        if (solid(path.getAttribute('stroke'))) path.setAttribute('stroke', color);
      }
    }
    el.setAttribute('data-color', color);
  }

  entityElement(name) {
    return this.entities.get(name) || null;
  }

  entityBBox(name) {
    const el = this.entities.get(name);
    if (!el) return null;
    try {
      return el.getBBox();
    } catch {
      return null;
    }
  }

  entityPosition(name) {
    const el = this.entities.get(name);
    const pos = el && el.querySelector(':scope > .entity-position');
    if (!pos) return { x: 0, y: 0 };
    const x = Number.parseFloat(el.getAttribute('data-x') || '0');
    const y = Number.parseFloat(el.getAttribute('data-y') || '0');
    return { x, y };
  }

  setEntityTranslation(name, x, y) {
    const el = this.entities.get(name);
    const pos = el && el.querySelector(':scope > .entity-position');
    if (!pos) return;
    const scale = el.querySelector(':scope > .entity-position > .entity-scale');
    const matrix = scale ? scale.getAttribute('transform') || '' : '';
    pos.setAttribute('transform', `translate(${x} ${y})`);
    el.setAttribute('data-x', x);
    el.setAttribute('data-y', y);
    // keep the scale child untouched (matrix is part of the original art)
    if (scale && !matrix) scale.setAttribute('transform', 'matrix(1,0,0,1,0,0)');
  }

  centerEntity(name) {
    const el = this.entities.get(name);
    if (!el) return;
    const bbox = this.entityBBox(name);
    if (!bbox) return;
    const orig = this.entityPosition(name);
    const dx = this.W / 2 - (bbox.x + bbox.width / 2);
    const dy = this.H / 2 - (bbox.y + bbox.height / 2);
    this.setEntityTranslation(name, orig.x + dx, orig.y + dy);
  }

  resetEntityPosition(name, origX, origY) {
    this.setEntityTranslation(name, origX, origY);
  }

  showBaseLayers(labels) {
    this.hideAll();
    const shown = showLabelsFromDoc(this.mapDoc, labels);
    for (const name of shown) this.setEntityVisible(name, true);
    return shown;
  }

  /* ---------------------------------------------------------------- */
  /* drawings                                                         */
  /* ---------------------------------------------------------------- */

  setDrawingList(drawingList) {
    this.drawingList = drawingList;
    this.redrawDrawings();
  }

  redrawDrawings() {
    if (!this.drawLayer) return;
    this.drawLayer.replaceChildren();
    const children = this.drawingList ? Array.from(this.drawingList.children) : [];
    for (const record of children) {
      if (record.tagName !== 'drawing') continue;
      this.drawLayer.append(this.createDrawingElement(record));
    }
  }

  createDrawingElement(record) {
    const type = record.getAttribute('type') || 'line';
    const sx = number(record.getAttribute('sx'));
    const sy = number(record.getAttribute('sy'));
    const cx = number(record.getAttribute('cx'));
    const cy = number(record.getAttribute('cy'));
    const fill = record.getAttribute('fill') === 'true';
    const color = hexFromValue(record.getAttribute('color'));
    const thickness = Math.max(0.5, number(record.getAttribute('thickness')));
    const common = {
      fill: fill && (type === 'rect' || type === 'oval') ? color : 'none',
      stroke: color,
      'stroke-width': thickness,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'pointer-events': 'none',
    };

    let el;
    if (type === 'rect') {
      el = svgEl('rect');
      el.setAttribute('x', Math.min(sx, cx));
      el.setAttribute('y', Math.min(sy, cy));
      el.setAttribute('width', Math.abs(cx - sx));
      el.setAttribute('height', Math.abs(cy - sy));
    } else if (type === 'oval') {
      el = svgEl('ellipse');
      el.setAttribute('cx', (sx + cx) / 2);
      el.setAttribute('cy', (sy + cy) / 2);
      el.setAttribute('rx', Math.abs(cx - sx) / 2);
      el.setAttribute('ry', Math.abs(cy - sy) / 2);
    } else if (type === 'free') {
      const xs = String(record.getAttribute('cx') || '').split(',').filter((v) => v !== '');
      const ys = String(record.getAttribute('cy') || '').split(',').filter((v) => v !== '');
      const d = [`M ${sx} ${sy}`];
      for (let i = 0; i < Math.max(xs.length, ys.length); i += 1) {
        if (xs[i] != null && ys[i] != null) d.push(`L ${xs[i]} ${ys[i]}`);
      }
      el = svgEl('path');
      el.setAttribute('d', d.join(' '));
    } else {
      el = svgEl('line');
      el.setAttribute('x1', sx);
      el.setAttribute('y1', sy);
      el.setAttribute('x2', cx);
      el.setAttribute('y2', cy);
    }
    for (const [key, value] of Object.entries(common)) el.setAttribute(key, String(value));
    el.classList.add('map-drawing');
    return el;
  }

  setDrawingsVisible(visible) {
    this.drawingsVisible = visible;
    if (this.drawLayer) this.drawLayer.style.display = visible ? '' : 'none';
  }

  /* ---------------------------------------------------------------- */
  /* marks                                                            */
  /* ---------------------------------------------------------------- */

  addMark(data) {
    const id = data.id || `mark-${++markSeq}`;
    const el = svgEl('g');
    el.classList.add('map-mark');
    el.setAttribute('data-mark-id', id);
    el.setAttribute('data-symbol', data.symbol || 'default');
    el.setAttribute('data-state', data.state || 'ask');
    el.style.color = MARK_COLORS[data.symbol] || MARK_COLORS.default;
    el.style.pointerEvents = 'all';

    const icon = svgEl('g');
    icon.classList.add('mark-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<circle class="mark-hit" r="15" fill="transparent"></circle><circle class="mark-halo" r="9.5"></circle><g transform="translate(-8 -8)" class="mark-glyph">${MARK_ICONS[data.symbol] || MARK_ICONS.default}</g>`;
    el.append(icon);

    const label = svgEl('g');
    label.classList.add('mark-label');
    const bg = svgEl('rect');
    bg.classList.add('mark-label-bg');
    bg.setAttribute('x', '13');
    bg.setAttribute('y', '-10');
    bg.setAttribute('height', '20');
    bg.setAttribute('rx', '6');
    const text = svgEl('text');
    text.classList.add('mark-label-text');
    text.setAttribute('x', '20');
    text.setAttribute('y', '0');
    text.textContent = data.label || '';
    label.append(bg, text);
    el.append(label);

    const mark = {
      id,
      el,
      icon,
      labelGroup: label,
      labelBg: bg,
      labelText: text,
      x: Number(data.x) || 0,
      y: Number(data.y) || 0,
      label: data.label || '',
      symbol: data.symbol || 'default',
      state: data.state || 'ask',
      labelVisible: data.labelVisible !== false,
      draggable: data.draggable === true,
      user: data.user === true,
      onClick: data.onClick || null,
      onMove: data.onMove || null,
      onLabelChange: data.onLabelChange || null,
      onContextMenu: data.onContextMenu || null,
      meta: data.meta || {},
    };

    if (mark.draggable) {
      el.style.cursor = 'grab';
      this._bindMarkDrag(mark);
    } else if (mark.onClick) {
      el.style.cursor = 'pointer';
    }
    if (mark.onClick || mark.onLabelChange) {
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `Značka: ${mark.label}`);
      el.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        if (mark.onClick) mark.onClick(mark, event);
        else this._editMarkLabel(mark);
      });
    }
    if (mark.onClick) {
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        mark.onClick(mark, event);
      });
    }
    if (mark.onLabelChange) {
      el.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        event.preventDefault();
        this._editMarkLabel(mark);
      });
    }
    if (mark.onContextMenu) {
      el.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        mark.onContextMenu(mark, event);
      });
    }

    this.markLayer.append(el);
    this.marks.set(id, mark);
    this._positionMark(mark);
    if (!mark.labelVisible) label.style.display = 'none';
    else this._measureMarkLabel(mark);
    this.updateMarkScale();
    return mark;
  }

  _bindMarkDrag(mark) {
    let drag = null;
    mark.el.addEventListener('pointerdown', (event) => {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const pt = this.toMapPoint(event.clientX, event.clientY);
      drag = { startX: pt.x, startY: pt.y, x: mark.x, y: mark.y, moved: false };
      try {
        mark.el.setPointerCapture?.(event.pointerId);
      } catch {}
      mark.el.style.cursor = 'grabbing';
      this.options.onMarkDragStart?.(mark);
    });
    mark.el.addEventListener('pointermove', (event) => {
      if (!drag) return;
      event.preventDefault();
      event.stopPropagation();
      const pt = this.toMapPoint(event.clientX, event.clientY);
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 0.2) drag.moved = true;
      mark.x = clamp(drag.x + dx, -16, this.W + 16);
      mark.y = clamp(drag.y + dy, -16, this.H + 16);
      this._positionMark(mark);
    });
    const finish = (event) => {
      if (!drag) return;
      event?.preventDefault();
      event?.stopPropagation();
      const moved = drag.moved;
      drag = null;
      mark.el.style.cursor = 'grab';
      try {
        mark.el.releasePointerCapture?.(event?.pointerId);
      } catch {}
      if (moved) mark.onMove?.(mark);
      else mark.onClick?.(mark, event);
    };
    mark.el.addEventListener('pointerup', finish);
    mark.el.addEventListener('pointercancel', finish);
  }

  _positionMark(mark) {
    mark.el.setAttribute('transform', `translate(${mark.x} ${mark.y}) scale(${this.markScale})`);
    mark.el.setAttribute('data-x', mark.x);
    mark.el.setAttribute('data-y', mark.y);
  }

  _measureMarkLabel(mark) {
    if (!mark.labelVisible) return;
    const length = mark.labelText.getComputedTextLength?.() || Math.max(0, mark.label.length * 6.2);
    const width = Math.max(20, length + 14);
    mark.labelBg.setAttribute('width', String(width));
    mark.labelText.setAttribute('x', '20');
  }

  updateMark(markOrId, patch = {}) {
    const mark = typeof markOrId === 'string' ? this.marks.get(markOrId) : markOrId;
    if (!mark) return;
    if (patch.x != null) mark.x = patch.x;
    if (patch.y != null) mark.y = patch.y;
    if (patch.state != null) {
      mark.state = patch.state;
      mark.el.setAttribute('data-state', patch.state);
    }
    if (patch.label != null) {
      mark.label = patch.label;
      mark.labelText.textContent = patch.label;
      if (mark.el.hasAttribute('aria-label')) mark.el.setAttribute('aria-label', `Značka: ${patch.label}`);
    }
    if (patch.labelVisible != null) {
      mark.labelVisible = !!patch.labelVisible;
      mark.labelGroup.style.display = mark.labelVisible ? '' : 'none';
    }
    this._positionMark(mark);
    this._measureMarkLabel(mark);
  }

  removeMark(markOrId) {
    const mark = typeof markOrId === 'string' ? this.marks.get(markOrId) : markOrId;
    if (!mark) return;
    mark.el.remove();
    this.marks.delete(mark.id);
  }

  clearMarks() {
    this.markLayer.replaceChildren();
    this.marks.clear();
  }

  setMarksVisible(visible) {
    this.marksVisible = visible;
    if (this.markLayer) this.markLayer.style.display = visible ? '' : 'none';
  }

  updateMarkScale() {
    this.markScale = 1 / Math.max(0.001, this.fitScale * this.zoom);
    for (const mark of this.marks.values()) this._positionMark(mark);
  }

  beginLabelEdit(markOrId) {
    const mark = typeof markOrId === 'string' ? this.marks.get(markOrId) : markOrId;
    if (mark) this._editMarkLabel(mark);
  }

  focusPoint(cx, cy, zoomAtLeast = 2.2) {
    if (this.zoom < zoomAtLeast) this.setZoom(zoomAtLeast);
    const scale = this.fitScale * this.zoom;
    const rect = this.viewport.getBoundingClientRect();
    this.panX = rect.width / 2 - this.baseX - cx * scale;
    this.panY = rect.height / 2 - this.baseY - cy * scale;
    this._clampPan();
    this._applyTransform();
  }

  focusEntity(name, zoomAtLeast = 2.2) {
    const bbox = this.entityBBox(name);
    if (!bbox) return;
    this.focusPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, zoomAtLeast);
  }

  _editMarkLabel(mark) {
    if (!mark.onLabelChange || this._labelEditor) return;
    const rect = mark.labelGroup.getBoundingClientRect();
    const input = document.createElement('input');
    input.className = 'mark-label-input';
    input.id = 'editor-mark-label-input';
    input.name = 'markLabel';
    input.setAttribute('aria-label', 'Názov značky');
    input.type = 'text';
    input.value = mark.label;
    input.maxLength = 60;
    input.style.position = 'fixed';
    input.style.left = `${Math.max(8, rect.left)}px`;
    input.style.top = `${Math.max(8, rect.top)}px`;
    input.style.width = `${Math.max(140, rect.width + 30)}px`;
    input.style.zIndex = '10000';
    document.body.append(input);
    this._labelEditor = input;
    let cancelled = false;
    input.focus();
    input.select();
    const commit = () => {
      if (!this._labelEditor) return;
      const value = input.value.trim();
      this._labelEditor = null;
      input.remove();
      if (!cancelled && value && value !== mark.label) {
        this.updateMark(mark, { label: value });
        mark.onLabelChange(mark, value);
      }
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelled = true;
        commit();
      }
    });
    input.addEventListener('blur', commit);
  }

  /* ---------------------------------------------------------------- */
  /* viewport, zoom and pan                                           */
  /* ---------------------------------------------------------------- */

  _initEvents() {
    this._eventAbort = new AbortController();
    const { signal } = this._eventAbort;
    this.viewport.addEventListener('pointerdown', (event) => this._onPointerDown(event), { signal });
    this.viewport.addEventListener('pointermove', (event) => this._onPointerMove(event), { signal });
    this.viewport.addEventListener('pointerup', (event) => this._onPointerUp(event), { signal });
    this.viewport.addEventListener('pointercancel', (event) => this._onPointerCancel(event), { signal });
    this.viewport.addEventListener('wheel', (event) => this._onWheel(event), { passive: false, signal });
    this.viewport.addEventListener('contextmenu', (event) => {
      if (event.target.closest('.map-mark')) return;
      event.preventDefault();
    }, { signal });
  }

  _onPointerDown(event) {
    if (event.target.closest('.map-mark')) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.panning = {
        startX: event.clientX,
        startY: event.clientY,
        panX: this.panX,
        panY: this.panY,
        moved: false,
      };
      this.pointerDragged = false;
      if (this.interaction !== 'draw') {
        try {
          this.viewport.setPointerCapture?.(event.pointerId);
        } catch {}
      }
    } else if (this.pointers.size === 2) {
      this.panning = null;
      const [a, b] = [...this.pointers.values()];
      this.pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: this.zoom,
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        panX: this.panX,
        panY: this.panY,
      };
    }
  }

  _onPointerMove(event) {
    if (this.pointers.has(event.pointerId)) {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch.distance > 0) {
        const factor = distance / this.pinch.distance;
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.setZoom(this.pinch.zoom * factor, center, { silent: true });
      }
      return;
    }
    if (!this.panning) return;
    const dx = event.clientX - this.panning.startX;
    const dy = event.clientY - this.panning.startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) {
      this.panning.moved = true;
      this.pointerDragged = true;
    }
    if (this.panning.moved && this.interaction !== 'draw') {
      this.panX = this.panning.panX + dx;
      this.panY = this.panning.panY + dy;
      this._applyTransform();
    }
  }

  _onPointerUp(event) {
    const had = this.pointers.has(event.pointerId);
    this.pointers.delete(event.pointerId);
    if (this.pinch && this.pointers.size < 2) {
      this.pinch = null;
      const remaining = [...this.pointers.values()][0];
      if (remaining) {
        this.panning = {
          startX: remaining.x,
          startY: remaining.y,
          panX: this.panX,
          panY: this.panY,
          moved: false,
        };
      }
    }
    if (this.panning) {
      const wasDrag = this.panning.moved;
      this.panning = null;
      try {
        this.viewport.releasePointerCapture?.(event.pointerId);
      } catch {}
      if (had && !wasDrag && this.interaction === 'click') {
        const pt = this.toMapPoint(event.clientX, event.clientY);
        this.mapClickHandler?.(pt, event);
        this.viewport.dispatchEvent(new CustomEvent('map-click', { detail: { ...pt, originalEvent: event }, bubbles: true }));
      }
    }
  }

  _onPointerCancel(event) {
    this.pointers.delete(event.pointerId);
    this.panning = null;
    this.pinch = null;
  }

  _onWheel(event) {
    if (this.interaction === 'draw') return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.14 : 1 / 1.14;
    this.setZoom(this.zoom * factor, { x: event.clientX, y: event.clientY });
  }

  layout() {
    if (!this.scene) return;
    const rect = this.viewport.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const padX = this.options.paddingX ?? 32;
    const padY = this.options.paddingY ?? 32;
    this.fitScale = Math.max(0.05, Math.min((w - padX) / this.W, (h - padY) / this.H));
    this.baseX = (w - this.W * this.fitScale) / 2;
    this.baseY = (h - this.H * this.fitScale) / 2;
    this.lastLayout = { w, h };
    this._applyTransform();
  }

  _applyTransform() {
    const scale = this.fitScale * this.zoom;
    this.canvas.style.transformOrigin = '0 0';
    this.canvas.style.transform = `translate(${this.baseX + this.panX}px, ${this.baseY + this.panY}px) scale(${scale})`;
    this.updateMarkScale();
    this.options.onTransform?.(this);
  }

  setZoom(zoom, anchorClient = null, { silent = false } = {}) {
    const next = clamp(zoom, 0.6, 10);
    if (Math.abs(next - this.zoom) < 0.0001) return;
    if (anchorClient) {
      const rect = this.viewport.getBoundingClientRect();
      const oldScale = this.fitScale * this.zoom;
      const px = anchorClient.x - rect.left;
      const py = anchorClient.y - rect.top;
      const mapX = (px - this.baseX - this.panX) / oldScale;
      const mapY = (py - this.baseY - this.panY) / oldScale;
      this.zoom = next;
      const newScale = this.fitScale * this.zoom;
      this.panX = px - this.baseX - mapX * newScale;
      this.panY = py - this.baseY - mapY * newScale;
    } else {
      this.zoom = next;
    }
    this._clampPan();
    this._applyTransform();
    if (!silent) this.options.onZoom?.(this.zoom);
  }

  zoomIn(anchor = null) {
    this.setZoom(this.zoom * 1.25, anchor);
  }

  zoomOut(anchor = null) {
    this.setZoom(this.zoom / 1.25, anchor);
  }

  fit() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this._applyTransform();
    this.options.onZoom?.(this.zoom);
  }

  _clampPan() {
    if (!this.lastLayout.w) return;
    const scale = this.fitScale * this.zoom;
    const mapW = this.W * scale;
    const mapH = this.H * scale;
    const rect = this.lastLayout;
    const maxX = Math.max(0, (mapW - rect.w) / 2) + 60;
    const maxY = Math.max(0, (mapH - rect.h) / 2) + 60;
    this.panX = clamp(this.panX, -maxX, maxX);
    this.panY = clamp(this.panY, -maxY, maxY);
  }

  toMapPoint(clientX, clientY) {
    if (!this.scene) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        x: clamp(((clientX - rect.left) / rect.width) * this.W, 0, this.W),
        y: clamp(((clientY - rect.top) / rect.height) * this.H, 0, this.H),
      };
    }
    return { x: 0, y: 0 };
  }

  mapToScreen(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + (x / this.W) * rect.width,
      y: rect.top + (y / this.H) * rect.height,
    };
  }

  effectiveScale() {
    return this.fitScale * this.zoom;
  }

  percent() {
    return Math.round(this.effectiveScale() * 100);
  }

  /* ---------------------------------------------------------------- */
  /* export                                                           */
  /* ---------------------------------------------------------------- */

  buildExportSvg({ crop = 'all', includeMarks = true, includeDrawings = true, watermark = true, watermarkText = 'Editor máp 2 · oslovensku.sk', scale = 1 } = {}) {
    if (!this.scene) return '';
    let x = 0;
    let y = 0;
    let w = this.W;
    let h = this.H;
    if (crop === 'view') {
      const canvasRect = this.canvas.getBoundingClientRect();
      const viewRect = this.viewport.getBoundingClientRect();
      if (canvasRect.width > 0) {
        x = clamp(((viewRect.left - canvasRect.left) / canvasRect.width) * this.W, 0, this.W);
        y = clamp(((viewRect.top - canvasRect.top) / canvasRect.height) * this.H, 0, this.H);
        w = clamp((viewRect.width / canvasRect.width) * this.W, 1, this.W - x);
        h = clamp((viewRect.height / canvasRect.height) * this.H, 1, this.H - y);
      }
    }
    const out = document.createElementNS(SVG_NS, 'svg');
    out.setAttribute('xmlns', SVG_NS);
    out.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    out.setAttribute('width', String(Math.round(w * scale)));
    out.setAttribute('height', String(Math.round(h * scale)));
    const bg = svgEl('rect');
    bg.setAttribute('x', String(x));
    bg.setAttribute('y', String(y));
    bg.setAttribute('width', String(w));
    bg.setAttribute('height', String(h));
    bg.setAttribute('fill', '#ffffff');
    out.append(bg);
    const sceneClone = this.scene.cloneNode(true);
    sceneClone.removeAttribute('class');
    sceneClone.setAttribute('width', '100%');
    sceneClone.setAttribute('height', '100%');
    out.append(sceneClone);

    if (includeDrawings) {
      const drawClone = this.drawLayer.cloneNode(true);
      drawClone.style.display = this.drawingsVisible ? '' : 'none';
      out.append(drawClone);
    }
    if (includeMarks) {
      const markClone = this.markLayer.cloneNode(true);
      markClone.style.display = '';
      for (const el of markClone.querySelectorAll('.map-mark')) {
        const mx = Number(el.getAttribute('data-x') || '0');
        const my = Number(el.getAttribute('data-y') || '0');
        el.setAttribute('transform', `translate(${mx} ${my})`);
      }
      out.append(markClone);
    }
    if (watermark) {
      const wm = svgEl('g');
      wm.setAttribute('transform', `translate(${x + w - 12} ${y + h - 12})`);
      wm.setAttribute('opacity', '0.92');
      const rect = svgEl('rect');
      rect.setAttribute('x', String(-Math.max(150, watermarkText.length * 6.4 + 22)));
      rect.setAttribute('y', '-19');
      rect.setAttribute('width', String(Math.max(150, watermarkText.length * 6.4 + 22)));
      rect.setAttribute('height', '24');
      rect.setAttribute('rx', '12');
      rect.setAttribute('fill', 'rgba(255,255,255,0.86)');
      const text = svgEl('text');
      text.setAttribute('x', '-8');
      text.setAttribute('y', '-2');
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('font-family', '"Segoe UI", system-ui, sans-serif');
      text.setAttribute('font-size', '11');
      text.setAttribute('font-weight', '600');
      text.setAttribute('fill', '#334155');
      text.textContent = watermarkText;
      wm.append(rect, text);
      out.append(wm);
    }

    const style = document.createElementNS(SVG_NS, 'style');
    style.textContent = MARK_STYLE;
    out.insertBefore(style, out.firstChild);
    return new XMLSerializer().serializeToString(out);
  }
}

/* ------------------------------------------------------------------------- */
/* helpers                                                                   */
/* ------------------------------------------------------------------------- */

function svgEl(name) {
  return document.createElementNS(SVG_NS, name);
}

function number(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function solid(color) {
  return normalizeHex(color) != null;
}

function additive(base, tint) {
  const b = normalizeHex(base);
  const t = normalizeHex(tint);
  if (!b || !t) return base;
  const br = Number.parseInt(b.slice(1, 3), 16);
  const bg = Number.parseInt(b.slice(3, 5), 16);
  const bb = Number.parseInt(b.slice(5, 7), 16);
  const tr = Number.parseInt(t.slice(1, 3), 16);
  const tg = Number.parseInt(t.slice(3, 5), 16);
  const tb = Number.parseInt(t.slice(5, 7), 16);
  return `#${hex2(Math.min(255, br + tr))}${hex2(Math.min(255, bg + tg))}${hex2(Math.min(255, bb + tb))}`;
}

function hex2(n) {
  return n.toString(16).padStart(2, '0');
}

function showLabelsFromDoc(mapDoc, labels) {
  const shown = new Set();
  if (!mapDoc || !labels) return shown;
  const all = [];
  const walk = (node) => {
    if (node.nodeType !== 1) return;
    if (node.tagName === 'node') all.push(node);
    for (const child of node.children) walk(child);
  };
  walk(mapDoc.documentElement);
  for (const label of labels) {
    for (const source of all) {
      if (source.getAttribute('label') !== label) continue;
      if (source.hasAttribute('entity')) shown.add(source.getAttribute('entity'));
      const addDesc = (node) => {
        for (const child of node.children) {
          if (child.tagName !== 'node') continue;
          if (child.hasAttribute('entity')) shown.add(child.getAttribute('entity'));
          addDesc(child);
        }
      };
      addDesc(source);
    }
  }
  return shown;
}
