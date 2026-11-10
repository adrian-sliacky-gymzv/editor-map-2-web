import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  clientToMap,
  doubleTapTargetZoom,
  isDoubleTap,
  pinchView,
  tapSlop,
  wheelZoomFactor,
} from '../js/map-gestures.js';

test('touch gestures use a larger accidental-tap tolerance than mouse', () => {
  assert.equal(tapSlop('mouse'), 4);
  assert.equal(tapSlop('pen'), 8);
  assert.equal(tapSlop('touch'), 12);
  assert.equal(tapSlop(undefined), 4);
});

test('wheel zoom is smooth, directional and clamped', () => {
  const zoomIn = wheelZoomFactor(-100, 0, false, 800);
  const zoomOut = wheelZoomFactor(100, 0, false, 800);
  assert.ok(zoomIn > 1 && zoomIn < 1.5);
  assert.ok(zoomOut < 1 && zoomOut > 0.6);
  assert.ok(wheelZoomFactor(-1, 1, true, 800) > wheelZoomFactor(-1, 0, true, 800));
  assert.equal(wheelZoomFactor(-100000, 0, false, 800), 2);
  assert.equal(wheelZoomFactor(100000, 0, false, 800), 0.5);
});

test('pinch keeps the initial map point under the moving finger midpoint', () => {
  const result = pinchView({
    startZoom: 2,
    startDistance: 100,
    currentDistance: 150,
    fitScale: 0.5,
    startMidpoint: { x: 200, y: 200 },
    currentMidpoint: { x: 220, y: 180 },
    viewportLeft: 0,
    viewportTop: 0,
    baseX: 20,
    baseY: 10,
    anchorMapX: 400,
    anchorMapY: 300,
  });
  assert.equal(result.zoom, 3);
  const screenX = result.panX + 20 + 400 * (0.5 * 3);
  const screenY = result.panY + 10 + 300 * (0.5 * 3);
  assert.ok(Math.abs(screenX - 220) < 1e-9);
  assert.ok(Math.abs(screenY - 180) < 1e-9);
});

test('pinch clamps zoom but still anchors the final zoom level', () => {
  const result = pinchView({
    startZoom: 9,
    startDistance: 40,
    currentDistance: 400,
    fitScale: 1,
    startMidpoint: { x: 100, y: 100 },
    currentMidpoint: { x: 160, y: 140 },
    viewportLeft: 10,
    viewportTop: 20,
    baseX: 0,
    baseY: 0,
    anchorMapX: 50,
    anchorMapY: 60,
  });
  assert.equal(result.zoom, MAX_MAP_ZOOM);
  assert.equal(result.panX + 10 + 50 * MAX_MAP_ZOOM, 160);
  assert.equal(result.panY + 20 + 60 * MAX_MAP_ZOOM, 140);
});

test('pinch never zooms below the fit view', () => {
  assert.equal(MIN_MAP_ZOOM, 1);
  const result = pinchView({
    startZoom: 1,
    startDistance: 200,
    currentDistance: 1,
    fitScale: 1,
    startMidpoint: { x: 0, y: 0 },
    currentMidpoint: { x: 0, y: 0 },
    anchorMapX: 0,
    anchorMapY: 0,
  });
  assert.equal(result.zoom, 1);
});

test('double tap detection honours time and distance windows', () => {
  const first = { x: 100, y: 100, time: 1000 };
  assert.equal(isDoubleTap(first, { x: 120, y: 110, time: 1250 }), true);
  assert.equal(isDoubleTap(first, { x: 120, y: 110, time: 1400 }), false);
  assert.equal(isDoubleTap(first, { x: 160, y: 100, time: 1200 }), false);
  assert.equal(isDoubleTap(null, { x: 100, y: 100, time: 1200 }), false);
});

test('double tap toggles between fit and a readable zoom level', () => {
  assert.equal(doubleTapTargetZoom(1), 2.4);
  assert.equal(doubleTapTargetZoom(1.1), 2.4);
  assert.equal(doubleTapTargetZoom(2.4), 1);
  assert.equal(doubleTapTargetZoom(5), 1);
});

test('clientToMap reverses the canvas transform', () => {
  const point = clientToMap({
    clientX: 220,
    clientY: 180,
    viewportLeft: 0,
    viewportTop: 0,
    baseX: 20,
    baseY: 10,
    panX: -400,
    panY: -280,
    scale: 1.5,
  });
  assert.equal(point.x, 400);
  assert.equal(point.y, 300);
});
