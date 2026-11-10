/* ------------------------------------------------------------------------- */
/* Browser-history navigation                                                */
/*                                                                           */
/* The app is a static single page, so screens are represented by query       */
/* parameters and restored from history state. This keeps the browser back    */
/* and forward buttons meaningful without a server or router dependency.      */
/* ------------------------------------------------------------------------- */

const APP_ID = 'editor-map-2';
const handlers = new Map();
let started = false;
let applying = false;
let currentRoute = null;

function basePath() {
  if (typeof location === 'undefined') return '/';
  return location.pathname.replace(/\/index\.html$/i, '/');
}

function toInt(value, fallback = 0) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}

function normaliseRoute(route) {
  if (!route || typeof route !== 'object') return { screen: 'home' };
  const screen = typeof route.screen === 'string' ? route.screen : 'home';
  if (screen === 'editor') {
    return { screen, mapKey: route.mapKey ? String(route.mapKey) : null };
  }
  if (screen === 'classic-setup' || screen === 'classic-game') {
    return {
      screen,
      mode: ['test', 'distance', 'puzzle'].includes(route.mode) ? route.mode : 'distance',
      mapKey: route.mapKey ? String(route.mapKey) : null,
      mapIndex: toInt(route.mapIndex, 0),
      testIndex: toInt(route.testIndex, 0),
      levelIndex: toInt(route.levelIndex, 0),
      numQ: Math.max(1, toInt(route.numQ, 3)),
    };
  }
  if (screen === 'game') {
    return {
      screen,
      mode: ['distance', 'quiz', 'puzzle'].includes(route.mode) ? route.mode : 'distance',
      pool: Array.isArray(route.pool) ? route.pool.map(String) : [],
      numQ: Math.max(1, toInt(route.numQ, 10)),
      returnScreen: route.returnScreen === 'atlas' ? 'atlas' : 'home',
      contextLabel: route.contextLabel ? String(route.contextLabel) : '',
    };
  }
  if (screen === 'atlas') return { screen: 'atlas' };
  return { screen: 'home' };
}

export function parseRoute(search = '', state = null) {
  if (state && state.app === APP_ID && state.route) return normaliseRoute(state.route);
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const editor = params.get('editor') === '1' || params.get('view') === 'editor';
  if (editor) {
    return normaliseRoute({ screen: 'editor', mapKey: params.get('map') });
  }
  const mode = params.get('mode');
  if (mode === 'test' || mode === 'distance' || mode === 'puzzle') {
    const autostart = params.get('autostart') === '1' || params.get('play') === '1';
    return normaliseRoute({
      screen: autostart ? 'classic-game' : 'classic-setup',
      mode,
      mapKey: params.get('map'),
      mapIndex: params.get('mapIndex'),
      testIndex: params.get('testIndex') || params.get('test'),
      levelIndex: params.get('levelIndex') || params.get('level'),
      numQ: params.get('numQ') || params.get('q'),
    });
  }
  if (params.get('view') === 'atlas') return { screen: 'atlas' };
  return { screen: 'home' };
}

export function routeUrl(route) {
  const safe = normaliseRoute(route);
  const base = basePath();
  const params = new URLSearchParams();
  switch (safe.screen) {
    case 'atlas':
      params.set('view', 'atlas');
      break;
    case 'editor':
      params.set('editor', '1');
      if (safe.mapKey) params.set('map', safe.mapKey);
      break;
    case 'classic-setup':
    case 'classic-game':
      params.set('mode', safe.mode);
      if (safe.mapKey) params.set('map', safe.mapKey);
      if (safe.testIndex) params.set('testIndex', String(safe.testIndex));
      if (safe.levelIndex) params.set('levelIndex', String(safe.levelIndex));
      if (safe.numQ) params.set('numQ', String(safe.numQ));
      if (safe.screen === 'classic-game') params.set('autostart', '1');
      break;
    case 'game':
      params.set('view', 'game');
      break;
    default:
      return base;
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function routeKey(route) {
  return JSON.stringify(normaliseRoute(route));
}

export function currentHistoryRoute() {
  return currentRoute;
}

export function navigate(route, options = {}) {
  const safe = normaliseRoute(route);
  const url = routeUrl(safe);
  const state = { app: APP_ID, route: safe };
  const same = typeof history !== 'undefined'
    && history.state
    && history.state.app === APP_ID
    && routeKey(history.state.route) === routeKey(safe);
  try {
    if (options.replace || same) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
  } catch {
    /* file:// or a browser that refuses history still works with the UI */
  }
  if (!options.silent) applyRoute(safe);
  else currentRoute = safe;
  return safe;
}

export function replaceRoute(route) {
  return navigate(route, { replace: true, silent: true });
}

function closeAllOverlaysDom() {
  if (typeof document === 'undefined') return;
  for (const overlay of document.querySelectorAll('.overlay:not([hidden])')) {
    overlay.hidden = true;
    overlay.classList.remove('is-open');
  }
  document.body.classList.remove('overlay-open');
}

function showOverlayDom(id) {
  if (typeof document === 'undefined' || !id) return;
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.hidden = false;
  overlay.classList.add('is-open');
  document.body.classList.add('overlay-open');
  const focus = overlay.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  focus?.focus?.({ preventScroll: true });
}

export function applyRoute(route = parseRoute(location.search, history.state), options = {}) {
  const safe = normaliseRoute(route);
  const sameScreen = currentRoute && routeKey(currentRoute) === routeKey(safe);
  currentRoute = safe;
  applying = true;
  try {
    if (typeof document !== 'undefined') {
      closeAllOverlaysDom();
      window.dispatchEvent(new CustomEvent('route:change', { detail: { route: safe } }));
    }
    if (!sameScreen || options.forceScreen) {
      const handler = handlers.get(safe.screen) || handlers.get('home');
      handler?.(safe);
    }
    if (options.overlay) showOverlayDom(options.overlay);
  } finally {
    applying = false;
  }
}

/** Push an overlay on top of the current screen without changing its route. */
export function pushOverlay(id) {
  if (typeof history === 'undefined' || typeof location === 'undefined' || !id) return;
  if (history.state?.overlay === id) return;
  const route = currentRoute || parseRoute(location.search, history.state);
  try {
    history.pushState({ app: APP_ID, route, overlay: id }, '', location.href);
  } catch {
    /* ignore */
  }
}

/** Consume the current overlay entry when the user closes the overlay. */
export function dismissTopOverlay(id) {
  if (typeof history === 'undefined' || !id) return;
  if (history.state?.overlay === id) history.back();
}

export function registerRoute(screen, handler) {
  if (typeof handler === 'function') handlers.set(screen, handler);
}

export function isApplyingRoute() {
  return applying;
}

/**
 * Go back one entry. If the app was opened in a fresh tab with no in-app
 * history, go to the fallback route instead of leaving the site.
 */
export function goBack(fallback = { screen: 'home' }) {
  if (typeof history === 'undefined') {
    navigate(fallback, { replace: true });
    return;
  }
  if (history.length > 1) history.back();
  else navigate(fallback, { replace: true });
}

export function startRouter() {
  if (started) return currentRoute;
  started = true;
  const initial = normaliseRoute(parseRoute(location.search, history.state));
  try {
    history.replaceState({ app: APP_ID, route: initial }, '', routeUrl(initial));
  } catch {
    /* ignore */
  }
  window.addEventListener('popstate', (event) => {
    const route = parseRoute(location.search, event.state);
    const overlay = event.state?.overlay || null;
    const sameScreen = currentRoute && routeKey(currentRoute) === routeKey(route);
    if (sameScreen) {
      closeAllOverlaysDom();
      if (overlay) showOverlayDom(overlay);
      currentRoute = route;
      return;
    }
    applyRoute(route, { overlay, forceScreen: true });
  });
  applyRoute(initial);
  return initial;
}

/** Test utility. */
export function resetRouterForTests() {
  handlers.clear();
  started = false;
  applying = false;
  currentRoute = null;
}
