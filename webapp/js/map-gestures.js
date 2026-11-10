/* ------------------------------------------------------------------------- */
/* Map gesture maths                                                         */
/*                                                                           */
/* Small, DOM-free helpers used by the shared map renderer and the legacy    */
/* city game. Keeping the maths here makes pinch/zoom behaviour testable in  */
/* Node and keeps the pointer handlers short.                                */
/* ------------------------------------------------------------------------- */

export const MIN_MAP_ZOOM = 1;
export const MAX_MAP_ZOOM = 10;

export function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function tapSlop(pointerType = 'mouse') {
  if (pointerType === 'touch') return 12;
  if (pointerType === 'pen') return 8;
  return 4;
}

/**
 * Convert wheel deltas from lines/pages to pixels and return a smooth,
 * bounded zoom factor. Trackpad pinch gestures arrive as ctrl+wheel.
 */
export function wheelZoomFactor(deltaY, deltaMode = 0, ctrlKey = false, viewportHeight = 800) {
  const pixels = Number(deltaY) * (deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1);
  const sensitivity = ctrlKey ? 0.012 : 0.0024;
  const factor = Math.exp(-pixels * sensitivity);
  return Math.min(2, Math.max(0.5, factor));
}

/**
 * Map a pointer position back to map coordinates for a viewport whose canvas
 * is transformed by translate(base + pan) scale(scale).
 */
export function clientToMap({
  clientX,
  clientY,
  viewportLeft = 0,
  viewportTop = 0,
  baseX = 0,
  baseY = 0,
  panX = 0,
  panY = 0,
  scale = 1,
}) {
  const safeScale = Math.abs(scale) > 0.00001 ? scale : 1;
  return {
    x: (clientX - viewportLeft - baseX - panX) / safeScale,
    y: (clientY - viewportTop - baseY - panY) / safeScale,
  };
}

/**
 * Two-finger pinch + pan. The map point that was under the initial midpoint
 * stays under the current midpoint while the distance between the fingers
 * controls zoom. This makes pinch feel anchored and lets both fingers move
 * the map at the same time.
 */
export function pinchView({
  startZoom,
  startDistance,
  currentDistance,
  fitScale,
  startMidpoint,
  currentMidpoint,
  viewportLeft = 0,
  viewportTop = 0,
  baseX = 0,
  baseY = 0,
  mapWidth = null,
  mapHeight = null,
  viewportWidth = null,
  viewportHeight = null,
  anchorMapX = 0,
  anchorMapY = 0,
  minZoom = MIN_MAP_ZOOM,
  maxZoom = MAX_MAP_ZOOM,
}) {
  const safeStart = Math.max(0.0001, Number(startDistance) || 0.0001);
  const safeCurrent = Math.max(0.0001, Number(currentDistance) || 0.0001);
  const zoom = clampNumber(startZoom * (safeCurrent / safeStart), minZoom, maxZoom);
  const scale = fitScale * zoom;
  // The canvas is always centred when pan is zero. Callers that know the map
  // and viewport dimensions get the exact centre origin at the new scale;
  // `baseX`/`baseY` remain as a fallback for callers working in a local frame.
  const originX = mapWidth != null && viewportWidth != null
    ? (viewportWidth - mapWidth * scale) / 2
    : baseX;
  const originY = mapHeight != null && viewportHeight != null
    ? (viewportHeight - mapHeight * scale) / 2
    : baseY;
  return {
    zoom,
    panX: currentMidpoint.x - viewportLeft - originX - anchorMapX * scale,
    panY: currentMidpoint.y - viewportTop - originY - anchorMapY * scale,
  };
}

/**
 * Pan range for a finite map canvas. Unlike a strict photo viewer, a map may
 * be moved a little past its edges; at least `keep` pixels of the map remain
 * visible so it can always be recovered, and a pinch near an edge is never
 * stopped immediately. Returns symmetric offsets from the centred view.
 */
export function canvasPanLimits({
  mapWidth,
  mapHeight,
  viewportWidth,
  viewportHeight,
}) {
  const safeMapW = Math.max(1, Number(mapWidth) || 1);
  const safeMapH = Math.max(1, Number(mapHeight) || 1);
  const safeViewW = Math.max(1, Number(viewportWidth) || 1);
  const safeViewH = Math.max(1, Number(viewportHeight) || 1);
  const keepX = Math.min(140, safeMapW * 0.4, safeViewW * 0.3);
  const keepY = Math.min(140, safeMapH * 0.4, safeViewH * 0.3);
  return {
    maxX: Math.max(0, (safeMapW + safeViewW) / 2 - keepX),
    maxY: Math.max(0, (safeMapH + safeViewH) / 2 - keepY),
  };
}

export function isDoubleTap(previous, next, { maxDelay = 320, slop = 28 } = {}) {
  if (!previous || !next) return false;
  const elapsed = Number(next.time) - Number(previous.time);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > maxDelay) return false;
  return Math.hypot(Number(next.x) - Number(previous.x), Number(next.y) - Number(previous.y)) <= slop;
}

export function doubleTapTargetZoom(zoom, { zoomIn = 2.4, threshold = 1.15 } = {}) {
  return Number(zoom) > threshold ? 1 : zoomIn;
}
