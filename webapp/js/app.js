import { CITIES, MAP_WIDTH, MAP_HEIGHT } from './cities.js';
import {
  DIFFICULTIES,
  citiesForLevel,
  pickTargets,
  distanceBetween,
  scoreForDistance,
  finalPercent,
  formatTime,
  formatScore,
  feedbackForScore,
} from './scoring.js';
import {
  percentOf,
  buildQuizOptions,
  filterCities,
  puzzleTolerance,
  isPuzzleCorrect,
  emptyStats,
  averageStats,
  mergeStats,
} from './modes.js';
import { tapSlop } from './map-gestures.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const SVG_NS = 'http://www.w3.org/2000/svg';
const SETTINGS_KEY = 'trafSa.settings.v2';
const STATS_KEY = 'trafSa.stats.v2';
const OLD_SETTINGS_KEY = 'trafSa.settings.v1';
const MAX_ZOOM = 6;
const MIN_ZOOM = 1;
const TAP_MOVE_LIMIT = 8;
const QUIZ_HIT_PX = 26;
const PUZZLE_TOLERANCE_PX = 20;
const PUZZLE_MIN_TOLERANCE = 15;

const LEVEL_TARGETS = { 1: 3, 2: 5, 3: 7 }; // original defaultlevels numTargets
const MODE_META = {
  distance: { title: 'Traf sa!', short: 'Traf sa!' },
  quiz: { title: 'Vyskúšaj sa!', short: 'Vyskúšaj sa!' },
  puzzle: { title: 'Poskladaj!', short: 'Poskladaj!' },
};
const LEVEL_LABELS = { 1: 'Ľahká', 2: 'Stredná', 3: 'Ťažká' };

const LEGACY_CITY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V9l4-2v14M9 21V10l5-2v13M14 21V12l5 2v7M7 12h2M7 16h2M11 13h2M11 17h2M16 15h1M16 18h1"></path></svg>';
const LEGACY_MAP_SOURCES = {
  base: 'assets/slovakia-map.svg',
  vuc: 'assets/slovakia-map-vuc.svg',
};
const legacyMapText = new Map();
let legacyMapLoadPromise = null;

const dom = {
  homeScreen: $('#homeScreen'),
  homeTitle: $('#homeTitle'),
  homeHelpBtn: $('#homeHelpBtn'),
  quickPlayBtn: $('#quickPlayBtn'),
  heroAtlasBtn: $('#heroAtlasBtn'),
  atlasCardBtn: $('#atlasCardBtn'),
  modeButtons: $$('.btn-mode[data-mode]'),
  homeLevelButtons: $$('#homeScreen .seg-btn[data-level]'),
  homeNumValue: $('#homeNumValue'),
  homeNumMinus: $('#homeNumMinus'),
  homeNumPlus: $('#homeNumPlus'),
  homeQuickChips: $('#homeQuickChips'),
  homeVucToggle: $('#homeVucToggle'),
  settingsHint: $('#settingsHint'),
  progressList: $('#progressList'),
  resetStatsBtn: $('#resetStatsBtn'),

  atlasScreen: $('#atlasScreen'),
  atlasBackBtn: $('#atlasBackBtn'),
  atlasTitle: $('#atlasTitle'),
  atlasCount: $('#atlasCount'),
  atlasHelpBtn: $('#atlasHelpBtn'),
  atlasCsvBtn: $('#atlasCsvBtn'),
  citySearch: $('#citySearch'),
  levelFilters: $('#levelFilters'),
  trainFilterBtn: $('#trainFilterBtn'),
  atlasMap: $('#atlasMap'),
  atlasMapImg: $('.atlas-map-img'),
  atlasDots: $('#atlasDots'),
  atlasSelectedLabel: $('#atlasSelectedLabel'),
  atlasDetail: $('#atlasDetail'),
  cityList: $('#cityList'),
  atlasEmpty: $('#atlasEmpty'),
  atlasFloating: $('#atlasFloating'),
  atlasFloatingName: $('#atlasFloatingName'),
  atlasFloatingLevel: $('#atlasFloatingLevel'),
  atlasFloatingTrain: $('#atlasFloatingTrain'),
  atlasFloatingClear: $('#atlasFloatingClear'),

  gameScreen: $('#gameScreen'),
  gameTitle: $('#gameTitle'),
  gameContext: $('#gameContext'),
  gameMission: $('#gameMission'),
  gameMissionIcon: $('#gameMissionIcon'),
  gameMissionKicker: $('#gameMissionKicker'),
  gameMissionName: $('#gameMissionName'),
  gameMissionType: $('#gameMissionType'),
  gameAverageValue: $('#gameAverageValue'),
  gameQuestionCounter: $('#gameQuestionCounter'),
  qnum: $('#qnum'),
  questionText: $('#questionText'),
  nextBtn: $('#nextBtn'),
  gameResultBtn: $('#gameResultBtn'),
  nextFloat: $('#gameNextFloat'),
  endBtn: $('#endBtn'),
  progressFill: $('#progressFill'),
  scoreDistanceRow: $('#scoreDistanceRow'),
  scoreCountsRow: $('#scoreCountsRow'),
  scoreValue: $('#scoreValue'),
  correctValue: $('#correctValue'),
  wrongValue: $('#wrongValue'),
  timeValue: $('#timeValue'),
  scoreSr: $('#scoreSr'),
  mapViewport: $('#mapViewport'),
  mapStage: $('#mapStage'),
  mapImg: $('#mapImg'),
  markerLayer: $('#markerLayer'),
  markers: $('#markers'),
  mapHint: $('#mapHint'),
  mapTag: $('#mapTag'),
  zoomIn: $('#zoomIn'),
  zoomOut: $('#zoomOut'),
  zoomReset: $('#zoomReset'),
  vucToggle: $('#vucToggle'),

  helpOverlay: $('#helpOverlay'),
  resultOverlay: $('#resultOverlay'),
  confirmOverlay: $('#confirmOverlay'),
  resultTitle: $('#resultTitle'),
  recordBadge: $('#recordBadge'),
  resultPercent: $('#resultPercent'),
  resultScore: $('#resultScore'),
  resultScoreLabel: $('#resultScoreLabel'),
  resultTime: $('#resultTime'),
  resultText: $('#resultText'),
  resultTableHead: $('#resultTableHead'),
  resultRows: $('#resultRows'),
  playAgainBtn: $('#playAgainBtn'),
  shareResultBtn: $('#shareResultBtn'),
  menuBtn: $('#menuBtn'),
  confirmTitle: $('#confirmTitle'),
  confirmMessage: $('#confirmMessage'),
  confirmOkBtn: $('#confirmOkBtn'),
  confirmCancelBtn: $('#confirmCancelBtn'),
  toast: $('#toast'),
};

const state = {
  screen: 'home',
  mode: 'distance',
  level: 3,
  numQ: 10,
  showVuc: false,
  pool: [],
  targets: [],
  index: 0,
  total: 0,
  correct: 0,
  incorrect: 0,
  answers: [],
  startedAt: 0,
  elapsed: 0,
  timerId: null,
  answered: false,
  final: false,
  current: null,
  quizOptions: [],
  quizGroups: new Map(),
  puzzle: null,
  markerGroups: [],
  view: { zoom: 1, panX: 0, panY: 0 },
  stage: { w: 0, h: 0, left: 0, top: 0 },
  pointers: new Map(),
  drag: null,
  pinch: null,
  suppressTap: false,
  lastGame: null,
  lastResult: null,
  returnScreen: 'home',
  contextLabel: '',
  stats: emptyStats(),
  gameNumQ: 10,
  atlas: {
    query: '',
    level: 'all',
    filtered: CITIES.slice(),
    selected: null,
  },
  lastFocus: null,
  toastTimer: null,
  confirmAction: null,
};

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function cityWord(count) {
  if (count === 1) return 'mesto';
  if (count >= 2 && count <= 4) return 'mestá';
  return 'miest';
}

function gameWord(count) {
  if (count === 1) return 'hra';
  if (count >= 2 && count <= 4) return 'hry';
  return 'hier';
}

function levelName(level) {
  return LEVEL_LABELS[level] || LEVEL_LABELS[3];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function showToast(message, duration = 2600) {
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    dom.toast.hidden = true;
    state.toastTimer = null;
  }, duration);
}

/* ------------------------------------------------------------------ */
/* persistence                                                         */
/* ------------------------------------------------------------------ */

function loadSettings() {
  const read = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  };

  const raw = read(SETTINGS_KEY) || read(OLD_SETTINGS_KEY) || {};
  const level = [1, 2, 3].includes(Number(raw.level)) ? Number(raw.level) : 3;
  return {
    level,
    numQ: Number.isFinite(Number(raw.numQ)) ? Number(raw.numQ) : 10,
    showVuc: Boolean(raw.showVuc),
  };
}

function saveSettings() {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ level: state.level, numQ: state.numQ, showVuc: state.showVuc })
    );
  } catch {
    /* the game still works without storage */
  }
}

function loadStats() {
  const base = emptyStats();
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      for (const mode of Object.keys(base)) {
        base[mode] = { ...base[mode], ...(raw[mode] || {}) };
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return base;
}

function saveStats() {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(state.stats));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* home screen                                                        */
/* ------------------------------------------------------------------ */

function currentPool() {
  return citiesForLevel(CITIES, state.level);
}

function syncHomeLevelUI() {
  const pool = currentPool();

  for (const button of dom.homeLevelButtons) {
    const level = Number(button.dataset.level);
    const count = citiesForLevel(CITIES, level).length;
    const label = $('.seg-count', button);
    if (label) label.textContent = `${count} ${cityWord(count)}`;
    const active = level === state.level;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }

  state.numQ = clamp(Math.round(Number(state.numQ) || 1), 1, pool.length);
  syncHomeNumUI();
  renderHomeHint();
}

function syncHomeNumUI() {
  if (!dom.homeNumValue || !dom.homeNumMinus || !dom.homeNumPlus || !dom.homeQuickChips) return;
  const poolSize = currentPool().length || 1;
  dom.homeNumValue.value = String(state.numQ);
  dom.homeNumMinus.disabled = state.numQ <= 1;
  dom.homeNumPlus.disabled = state.numQ >= poolSize;

  $$('.chip', dom.homeQuickChips).forEach((chip) => {
    const value = chip.dataset.count === 'all' ? poolSize : Number(chip.dataset.count);
    chip.classList.toggle('is-active', value === state.numQ);
  });

  const allChip = $('.chip[data-count="all"]', dom.homeQuickChips);
  if (allChip) allChip.textContent = `Všetky (${poolSize})`;
}

function setNumQ(value) {
  const poolSize = currentPool().length || 1;
  const parsed = Number.parseInt(value, 10);
  state.numQ = clamp(Number.isFinite(parsed) ? parsed : state.numQ, 1, poolSize);
  syncHomeNumUI();
  renderHomeHint();
  saveSettings();
}

function renderHomeHint() {
  if (!dom.settingsHint) return;
  const pool = currentPool();
  dom.settingsHint.textContent =
    `${levelName(state.level)}: ${pool.length} ${cityWord(pool.length)}, ` +
    `kvíz s ${LEVEL_TARGETS[state.level]} možnosťami. Otázky 1–${pool.length}.`;
}

function renderProgress() {
  if (!dom.progressList) return;
  dom.progressList.innerHTML = ['distance', 'quiz', 'puzzle']
    .map((mode) => {
      const entry = state.stats[mode] || {};
      const best = clamp(Number(entry.best || 0), 0, 100);
      const games = Number(entry.games || 0);
      const average = averageStats(entry, mode);
      const value = best > 0 ? `${best}%` : '—';
      const meta = games > 0
        ? `${games} ${gameWord(games)} · Ø ${average}%`
        : 'Zatiaľ bez hry';
      return (
        `<div class="progress-item" data-mode="${mode}">` +
        `<div class="progress-top"><span class="progress-name">${MODE_META[mode].title}</span>` +
        `<span class="progress-value">${value}</span></div>` +
        `<div class="progress-bar"><span style="width:${best}%"></span></div>` +
        `<div class="progress-meta">${meta}</div>` +
        `</div>`
      );
    })
    .join('');
}

function recordResult(mode, result) {
  const previousBest = Number(state.stats[mode]?.best || 0);
  state.stats = mergeStats(state.stats, mode, result);
  saveStats();
  renderProgress();
  return Number(result.percent) > previousBest && Number(result.percent) > 0;
}

function legacyMapSource(showVuc) {
  return showVuc ? LEGACY_MAP_SOURCES.vuc : LEGACY_MAP_SOURCES.base;
}

function renderLegacyMap(showVuc) {
  if (!dom.mapImg) return false;
  const source = legacyMapSource(showVuc);
  const text = legacyMapText.get(source);
  if (!text) return false;
  if (dom.mapImg.dataset.source === source && dom.mapImg.querySelector('svg')) return true;
  dom.mapImg.innerHTML = text.replace(/^\s*<\?xml[^>]*>\s*/i, '');
  const svg = dom.mapImg.querySelector('svg');
  if (svg) {
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    svg.removeAttribute('role');
    svg.removeAttribute('aria-label');
    svg.classList.add('legacy-map-svg');
  }
  dom.mapImg.dataset.source = source;
  dom.mapImg.setAttribute('aria-label', showVuc
    ? 'Mapa Slovenska s hranicami VÚC'
    : 'Obrysová mapa Slovenska s riekami');
  return true;
}

function loadLegacyMaps() {
  if (legacyMapLoadPromise) return legacyMapLoadPromise;
  const sources = [LEGACY_MAP_SOURCES.base, LEGACY_MAP_SOURCES.vuc];
  legacyMapLoadPromise = Promise.all(sources.map(async (source) => {
    try {
      const response = await fetch(source, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      legacyMapText.set(source, await response.text());
    } catch (error) {
      console.error(`Mapový podklad sa nepodarilo načítať: ${source}`, error);
    }
  })).then(() => {
    if (renderLegacyMap(state.showVuc)) return;
    // If the inline fetch is unavailable (for example when opening the file
    // directly), keep the original image fallback instead of a blank map.
    if (dom.mapImg && !dom.mapImg.firstElementChild) {
      const source = legacyMapSource(state.showVuc);
      const image = document.createElement('img');
      image.src = source;
      image.alt = 'Obrysová mapa Slovenska s riekami';
      image.className = 'legacy-map-fallback';
      dom.mapImg.append(image);
    }
  });
  return legacyMapLoadPromise;
}

function syncVucUI() {
  if (dom.homeVucToggle) dom.homeVucToggle.checked = state.showVuc;
  if (dom.vucToggle) dom.vucToggle.setAttribute('aria-pressed', String(state.showVuc));

  const source = legacyMapSource(state.showVuc);
  if (!renderLegacyMap(state.showVuc)) {
    const fallback = dom.mapImg?.querySelector('.legacy-map-fallback');
    if (fallback && fallback.getAttribute('src') !== source) fallback.src = source;
  }
  if (dom.atlasMapImg && dom.atlasMapImg.getAttribute('src') !== source) {
    dom.atlasMapImg.src = source;
  }
}

function bindHomeEvents() {
  dom.homeLevelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.level = Number(button.dataset.level);
      syncHomeLevelUI();
      saveSettings();
    });
  });

  dom.homeNumMinus?.addEventListener('click', () => setNumQ(state.numQ - 1));
  dom.homeNumPlus?.addEventListener('click', () => setNumQ(state.numQ + 1));

  dom.homeNumValue?.addEventListener('input', () => {
    dom.homeNumValue.value = dom.homeNumValue.value.replace(/[^\d]/g, '').slice(0, 3);
  });

  dom.homeNumValue?.addEventListener('change', () => {
    const parsed = Number.parseInt(dom.homeNumValue.value, 10);
    setNumQ(Number.isFinite(parsed) ? parsed : state.numQ);
  });

  dom.homeNumValue?.addEventListener('blur', () => {
    const parsed = Number.parseInt(dom.homeNumValue.value, 10);
    setNumQ(Number.isFinite(parsed) ? parsed : state.numQ);
  });

  dom.homeNumValue?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      dom.homeNumValue.blur();
    }
  });

  dom.homeQuickChips?.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    const value = chip.dataset.count === 'all' ? currentPool().length : Number(chip.dataset.count);
    setNumQ(value);
  });

  dom.homeVucToggle?.addEventListener('change', () => {
    state.showVuc = dom.homeVucToggle.checked;
    syncVucUI();
    saveSettings();
  });

  dom.modeButtons.forEach((button) => {
    button.addEventListener('click', () => startGame(button.dataset.mode));
  });

  dom.quickPlayBtn?.addEventListener('click', () => startGame('distance'));
  dom.heroAtlasBtn?.addEventListener('click', goAtlas);
  dom.atlasCardBtn?.addEventListener('click', goAtlas);
  dom.homeHelpBtn?.addEventListener('click', openHelp);
  dom.resetStatsBtn?.addEventListener('click', resetStats);
}

/* ------------------------------------------------------------------ */
/* screen navigation                                                   */
/* ------------------------------------------------------------------ */

function showScreen(name) {
  state.screen = name;
  dom.homeScreen.hidden = name !== 'home';
  dom.atlasScreen.hidden = name !== 'atlas';
  dom.gameScreen.hidden = name !== 'game';
  document.body.classList.toggle('game-active', name !== 'home');
  syncNextFloat();
  if (name === 'game') requestAnimationFrame(() => layoutMap());
}

function syncNextFloat() {
  if (!dom.nextFloat || !dom.nextBtn) return;
  const screenVisible = !dom.gameScreen.hidden;
  const resultReady = Boolean(state.final && dom.resultOverlay.hidden && screenVisible);
  const canAdvance = Boolean(!dom.nextBtn.disabled && !dom.nextBtn.hidden && !state.final && screenVisible);
  const visible = canAdvance || resultReady;
  const label = resultReady ? 'Výsledok' : 'Ďalej';
  const labelEl = dom.nextFloat.firstElementChild;
  if (labelEl) labelEl.textContent = label;
  dom.nextFloat.setAttribute('aria-label', label);
  dom.nextFloat.classList.toggle('is-result', resultReady);
  dom.nextFloat.hidden = !visible;
  if (visible) requestAnimationFrame(positionNextFloat);
}

function positionNextFloat() {
  if (!dom.nextFloat || dom.nextFloat.hidden) return;
  if (state.final) {
    dom.nextFloat.classList.remove('is-top');
    return;
  }
  const viewport = dom.mapViewport.getBoundingClientRect();
  const markers = [...dom.markers.querySelectorAll('.marker-correct, .marker-guess')]
    .map((marker) => marker.getBoundingClientRect())
    .filter((rect) => rect.width || rect.height);
  if (!markers.length) {
    dom.nextFloat.classList.remove('is-top');
    return;
  }
  const topZone = viewport.top + Math.min(150, viewport.height * 0.28);
  const bottomZone = viewport.bottom - Math.min(170, viewport.height * 0.32);
  const nearTop = markers.filter((rect) => rect.top < topZone).length;
  const nearBottom = markers.filter((rect) => rect.top > bottomZone).length;
  dom.nextFloat.classList.toggle('is-top', nearBottom > nearTop);
}

function resetGameState() {
  stopTimer();
  state.targets = [];
  state.answers = [];
  state.index = 0;
  state.total = 0;
  state.correct = 0;
  state.incorrect = 0;
  state.answered = false;
  state.final = false;
  state.current = null;
  state.quizOptions = [];
  state.quizGroups = new Map();
  state.puzzle = null;
  state.markerGroups = [];
  state.pointers.clear();
  state.drag = null;
  state.pinch = null;
  state.suppressTap = false;
  clearMarkers();
  state.view = { zoom: 1, panX: 0, panY: 0 };
}

function goHome() {
  resetGameState();
  closeAllOverlays();
  showScreen('home');
  renderProgress();
  requestAnimationFrame(() => {
    const target = dom.quickPlayBtn || $('[data-classic-mode="test"]') || dom.homeHelpBtn;
    target?.focus({ preventScroll: true });
  });
}

function goAtlas() {
  resetGameState();
  closeAllOverlays();
  syncVucUI();
  showScreen('atlas');
  renderAtlas();
  requestAnimationFrame(() => dom.atlasBackBtn.focus({ preventScroll: true }));
}

function finishReturn() {
  if (state.returnScreen === 'atlas') goAtlas();
  else goHome();
}

/* ------------------------------------------------------------------ */
/* game start / question flow                                          */
/* ------------------------------------------------------------------ */

function resetGameMission() {
  if (!dom.gameMission) return;
  dom.gameMission.dataset.mode = state.mode || '';
  dom.gameMissionKicker.textContent = 'Načítavam…';
  dom.gameMissionKicker.classList.remove('is-correct', 'is-wrong', 'is-partial');
  dom.gameMissionName.textContent = '—';
  dom.gameMissionName.title = '';
  dom.gameMissionType.textContent = 'Mesto';
  dom.gameMissionIcon.style.setProperty('--mission-color', '#d97706');
  dom.gameMissionIcon.innerHTML = LEGACY_CITY_ICON;
  dom.gameMission.setAttribute('aria-label', 'Načítavam úlohu');
}

function setGameMissionTarget(target) {
  if (!dom.gameMission) return;
  const instruction = state.mode === 'quiz'
    ? 'Vyber na mape'
    : state.mode === 'puzzle'
      ? 'Umiestni na mapu'
      : 'Nájdi na mape';
  dom.gameMissionKicker.textContent = instruction;
  dom.gameMissionKicker.classList.remove('is-correct', 'is-wrong', 'is-partial');
  dom.gameMissionName.textContent = target?.label || '—';
  dom.gameMissionName.title = target?.label || '';
  dom.gameMissionType.textContent = 'Mesto';
  dom.gameMissionIcon.style.setProperty('--mission-color', '#d97706');
  dom.gameMissionIcon.innerHTML = LEGACY_CITY_ICON;
  dom.gameMission.setAttribute('aria-label', `${instruction}: Mesto ${target?.label || ''}`.trim());
}

function setGameMissionFeedback(text, tone = '') {
  if (!dom.gameMissionKicker) return;
  dom.gameMissionKicker.textContent = text;
  dom.gameMissionKicker.classList.remove('is-correct', 'is-wrong', 'is-partial');
  if (tone) dom.gameMissionKicker.classList.add(`is-${tone}`);
}

function gameAverageText() {
  const answered = state.answers.length;
  if (!answered) return '—';
  if (state.mode === 'distance') return `${Math.round(state.total / answered)} b.`;
  return `${Math.round((state.correct / answered) * 100)} %`;
}

function syncGameModeUI() {
  dom.gameScreen.classList.remove('mode-distance', 'mode-quiz', 'mode-puzzle');
  dom.gameScreen.classList.add(`mode-${state.mode}`);
  dom.gameScreen.setAttribute('aria-label', `Hra ${MODE_META[state.mode].title}`);
  dom.gameTitle.textContent = MODE_META[state.mode].title;

  const isDistance = state.mode === 'distance';
  dom.scoreDistanceRow.hidden = !isDistance;
  dom.scoreCountsRow.hidden = isDistance;
  if (dom.gameMission) dom.gameMission.dataset.mode = state.mode;
}

function startGame(mode, options = {}) {
  if (!MODE_META[mode]) return;
  const pool = options.pool && options.pool.length
    ? options.pool.slice()
    : currentPool();
  if (!pool.length) {
    showToast('Pre túto voľbu nie sú dostupné mestá.');
    return;
  }

  stopTimer();
  state.mode = mode;
  state.pool = pool;
  state.gameNumQ = clamp(Math.round(Number(options.numQ ?? state.numQ) || 1), 1, pool.length);
  state.targets = pickTargets(pool, state.gameNumQ);
  state.index = 0;
  state.total = 0;
  state.correct = 0;
  state.incorrect = 0;
  state.answers = [];
  state.startedAt = 0;
  state.elapsed = 0;
  state.answered = false;
  state.final = false;
  state.current = null;
  state.quizOptions = [];
  state.quizGroups = new Map();
  state.puzzle = null;
  state.markerGroups = [];
  state.pointers.clear();
  state.drag = null;
  state.pinch = null;
  state.suppressTap = false;
  state.view = { zoom: 1, panX: 0, panY: 0 };
  state.returnScreen = options.returnScreen || 'home';
  state.contextLabel = options.contextLabel || levelName(state.level);
  state.lastGame = {
    mode,
    pool: pool.slice(),
    numQ: state.gameNumQ,
    returnScreen: state.returnScreen,
    contextLabel: state.contextLabel,
  };

  clearMarkers();
  syncGameModeUI();
  syncVucUI();
  dom.gameContext.textContent = `Rýchla hra · ${state.contextLabel}`;
  resetGameMission();
  dom.gameAverageValue.textContent = '—';
  dom.gameQuestionCounter.textContent = `0/${state.gameNumQ}`;
  dom.nextBtn.hidden = false;
  if (dom.gameResultBtn) dom.gameResultBtn.hidden = true;
  showScreen('game');
  loadLegacyMaps();
  updateScorePanel();
  updateTime(0);
  startTimer();
  layoutMap();
  showQuestion();

  requestAnimationFrame(() => {
    dom.gameScreen.focus({ preventScroll: true });
    layoutMap();
  });
}

function showQuestion() {
  const target = state.targets[state.index];
  if (!target) return;

  state.answered = false;
  state.current = { target, options: null };
  state.quizOptions = [];
  state.quizGroups = new Map();
  state.puzzle = null;
  state.markerGroups = [];
  clearMarkers();
  setGameMissionTarget(target);

  dom.mapViewport.classList.remove('is-answered', 'is-dragging');
  dom.qnum.innerHTML = `Otázka č.<b>${state.index + 1}</b>:`;
  dom.nextBtn.disabled = true;
  dom.nextBtn.classList.remove('is-ready');
  dom.endBtn.disabled = false;
  dom.mapHint.hidden = false;

  updateScorePanel();
  updateProgress();
  updateMapTag();
  setView({ zoom: 1, panX: 0, panY: 0 });

  if (state.mode === 'distance') {
    dom.questionText.innerHTML =
      `Klikni kde sa nachádza mesto <b class="entity">${escapeHtml(target.label)}</b>.`;
    dom.mapHint.textContent = 'Klikni na mapu';
  } else if (state.mode === 'quiz') {
    const options = buildQuizOptions(target, state.pool, LEVEL_TARGETS[state.level]);
    state.current = { target, options };
    state.quizOptions = options;
    drawQuizMarkers(options);
    dom.questionText.innerHTML =
      `Ukáž na mape mesto <b class="entity">${escapeHtml(target.label)}</b>.`;
    dom.mapHint.textContent = 'Klikni na správny bod';
  } else {
    drawPuzzleToken(target);
    dom.questionText.innerHTML =
      `Ťahaním na mape ulož mesto <b class="entity">${escapeHtml(target.label)}</b> na správne miesto.`;
    dom.mapHint.textContent = 'Pretiahni mesto na správne miesto';
  }
}

function onNext() {
  if (state.screen !== 'game' || !state.answered || state.final) return;
  if (state.index >= state.targets.length - 1) {
    showFinal();
  } else {
    state.index += 1;
    showQuestion();
  }
}

function onEnd() {
  if (state.final) {
    finishReturn();
    return;
  }
  if (state.screen !== 'game') return;
  askEndGame();
}

function askEndGame() {
  openConfirm({
    title: 'Ukončiť hru?',
    message: 'Rozohraná hra sa neuloží. Naozaj chceš skončiť?',
    okLabel: 'Ukončiť',
    cancelLabel: 'Pokračovať',
    onConfirm: () => {
      stopTimer();
      finishReturn();
    },
  });
}

function nextPrompt() {
  return state.index < state.targets.length - 1
    ? ' Klikni „Ďalej“ pre ďalšiu otázku.'
    : ' Klikni „Ďalej“.';
}

function answerDistance(guess) {
  if (state.screen !== 'game' || state.answered || state.final) return;
  const target = state.current?.target;
  if (!target) return;

  const distance = distanceBetween(guess, target);
  const score = scoreForDistance(distance);

  state.answered = true;
  state.total += score;
  state.answers.push({ target, guess, distance, score });

  updateScorePanel();
  drawDistanceMarkers(guess, target);
  dom.mapViewport.classList.add('is-answered');
  dom.mapHint.hidden = true;

  const feedback = feedbackForScore(score);
  const feedbackTone = score >= 70 ? 'correct' : score > 0 ? 'partial' : 'wrong';
  const feedbackLabel = score >= 90 ? 'Výborne' : score >= 70 ? 'Dobre' : score > 0 ? 'Tesne vedľa' : 'Vedľa';
  setGameMissionFeedback(`${feedbackLabel}! +${score} b.`, feedbackTone);
  dom.questionText.innerHTML = renderDistanceFeedback(feedback, score) + nextPrompt();
  dom.nextBtn.disabled = false;
  dom.nextBtn.classList.add('is-ready');

  if (state.index === state.targets.length - 1) {
    stopTimer();
    updateScorePanel();
  }
  updateProgress();
  setView({ zoom: 1, panX: 0, panY: 0 });
}

function renderDistanceFeedback(feedback, score) {
  let html = `<b class="tone-${feedback.tone}">${feedback.title}</b> ${escapeHtml(feedback.text)}`;
  if (feedback.scoreWord) {
    html += ` <b class="tone-${feedback.tone}">${score}</b> ${escapeHtml(feedback.scoreWord)}`;
  }
  return html;
}

function answerQuiz(clicked) {
  if (state.screen !== 'game' || state.answered || state.final) return;
  const target = state.current?.target;
  if (!target || !clicked) return;

  const correct = clicked.entity === target.entity;
  state.answered = true;
  if (correct) state.correct += 1;
  else state.incorrect += 1;
  state.answers.push({ target, picked: clicked, correct });

  updateScorePanel();
  markQuizAnswer(target, clicked, correct);
  dom.mapViewport.classList.add('is-answered');
  dom.mapHint.hidden = true;

  const prompt = nextPrompt();
  setGameMissionFeedback(correct ? 'Správne! +1' : 'Nesprávne!', correct ? 'correct' : 'wrong');
  dom.questionText.innerHTML = correct
    ? `<b class="tone-great">Správne!</b>${prompt}`
    : `<b class="tone-miss">Nesprávne!</b> Správna odpoveď je zobrazená v mape!${prompt}`;
  dom.nextBtn.disabled = false;
  dom.nextBtn.classList.add('is-ready');

  if (state.index === state.targets.length - 1) {
    stopTimer();
    updateScorePanel();
  }
  updateProgress();
  setView({ zoom: 1, panX: 0, panY: 0 });
}

function answerPuzzle(drop) {
  if (state.screen !== 'game' || state.answered || state.final) return;
  const target = state.current?.target;
  if (!target) return;

  const rect = dom.mapStage.getBoundingClientRect();
  const tolerance = puzzleTolerance(
    rect.width > 0 ? MAP_WIDTH / rect.width : 1,
    PUZZLE_TOLERANCE_PX,
    PUZZLE_MIN_TOLERANCE
  );
  const distance = distanceBetween(drop, target);
  const correct = isPuzzleCorrect(drop, target, tolerance);

  state.answered = true;
  if (correct) state.correct += 1;
  else state.incorrect += 1;
  state.answers.push({ target, drop, distance, correct, tolerance });

  updateScorePanel();
  finishPuzzleVisual(drop, target, correct);
  dom.mapViewport.classList.add('is-answered');
  dom.mapHint.hidden = true;

  const prompt = nextPrompt();
  setGameMissionFeedback(correct ? 'Správne umiestnené! +1' : 'Nesprávne umiestnenie.', correct ? 'correct' : 'wrong');
  dom.questionText.innerHTML = correct
    ? `<b class="tone-great">Výborne! To je správne miesto.</b>${prompt}`
    : `<b class="tone-miss">Nie, ${escapeHtml(target.label)} tam nepatrí!</b>${prompt}`;
  dom.nextBtn.disabled = false;
  dom.nextBtn.classList.add('is-ready');

  if (state.index === state.targets.length - 1) {
    stopTimer();
    updateScorePanel();
  }
  updateProgress();
  setView({ zoom: 1, panX: 0, panY: 0 });
}

/* ------------------------------------------------------------------ */
/* final result                                                        */
/* ------------------------------------------------------------------ */

function showFinal() {
  state.final = true;
  state.screen = 'final';
  state.answered = true;
  stopTimer();

  const timeText = formatTime(state.elapsed);
  const percent = state.mode === 'distance'
    ? finalPercent(state.total, state.gameNumQ)
    : percentOf(state.correct, state.gameNumQ);

  const result = buildFinalText(percent, timeText);
  const record = recordResult(state.mode, result.stats);
  state.lastResult = {
    mode: state.mode,
    percent,
    timeText,
    summary: state.mode === 'distance'
      ? `${MODE_META[state.mode].title}: ${percent}% · ${state.total} bodov · ${timeText}`
      : `${MODE_META[state.mode].title}: ${percent}% · ${state.correct}/${state.gameNumQ} správne · ${timeText}`,
    context: state.contextLabel,
  };

  dom.qnum.textContent = '';
  dom.questionText.innerHTML = result.topbar;
  dom.nextBtn.disabled = true;
  dom.nextBtn.classList.remove('is-ready');
  dom.endBtn.disabled = false;
  dom.mapHint.hidden = true;
  dom.mapTag.textContent = `Výsledok · ${state.contextLabel}`;
  dom.progressFill.style.width = '100%';
  updateScorePanel();

  dom.resultTitle.textContent = `${MODE_META[state.mode].title} — výsledok`;
  dom.resultPercent.textContent = `${percent}%`;
  dom.resultScore.textContent = String(result.stat2);
  dom.resultScoreLabel.textContent = result.stat2Label;
  dom.resultTime.textContent = timeText;
  dom.resultText.innerHTML = result.summary;
  dom.resultTableHead.innerHTML = result.tableHead;
  dom.resultRows.innerHTML = result.rows;
  dom.recordBadge.hidden = !record;

  dom.nextBtn.hidden = true;
  if (dom.nextFloat) dom.nextFloat.hidden = true;
  openOverlay(dom.resultOverlay, dom.playAgainBtn);
}

function syncLegacyResultReopen() {
  if (!dom.gameResultBtn) return;
  const show = Boolean(state.final && dom.resultOverlay.hidden && !dom.gameScreen.hidden);
  dom.gameResultBtn.hidden = !show;
  syncNextFloat();
}

function buildFinalText(percent, timeText) {
  if (state.mode === 'distance') {
    const stats = {
      percent,
      points: state.total,
      possible: state.gameNumQ * 100,
    };
    const summary =
      `Celkovo si získal <b class="red">${state.total}</b> bodov v čase ` +
      `<b class="red">${timeText}</b>. Tvoja úspešnosť je <b class="red">${percent}%</b>.`;
    const rows = state.answers
      .map((entry) => {
        const cls =
          entry.score === 0
            ? 'score-zero'
            : entry.score >= 90
              ? 'score-good'
              : entry.score >= 50
                ? 'score-mid'
                : 'score-bad';
        return `<tr><td>${escapeHtml(entry.target.label)}</td><td class="${cls}">${entry.score}</td></tr>`;
      })
      .join('');
    return {
      topbar: `${summary} Klikni „Koniec“.`,
      summary,
      stat2: state.total,
      stat2Label: 'bodov',
      tableHead: '<th>Mesto</th><th>Body</th>',
      rows,
      stats,
    };
  }

  const noun = state.mode === 'quiz' ? 'otázok' : 'miest';
  const prefix = state.mode === 'quiz'
    ? 'Zodpovedal si správne'
    : 'Uložil si správne';
  const stats = {
    percent,
    correct: state.correct,
    total: state.gameNumQ,
  };
  const summary =
    `${prefix} <b class="red">${state.correct}</b> z <b class="red">${state.gameNumQ}</b> ${noun} v čase ` +
    `<b class="red">${timeText}</b>. Tvoja úspešnosť je <b class="red">${percent}%</b>.`;
  const rows = state.answers
    .map((entry) => {
      const correct = Boolean(entry.correct);
      return `<tr><td>${escapeHtml(entry.target.label)}</td><td class="${correct ? 'answer-correct' : 'answer-wrong'}">${correct ? '✓' : '✗'}</td></tr>`;
    })
    .join('');
  return {
    topbar: `${summary} Klikni „Koniec“.`,
    summary,
    stat2: state.correct,
    stat2Label: 'správne',
    tableHead: '<th>Mesto</th><th>Výsledok</th>',
    rows,
    stats,
  };
}

/* ------------------------------------------------------------------ */
/* score / timer / progress                                            */
/* ------------------------------------------------------------------ */

function startTimer() {
  stopTimer();
  state.startedAt = performance.now() - state.elapsed * 1000;
  state.timerId = setInterval(() => {
    if (state.final) return;
    state.elapsed = (performance.now() - state.startedAt) / 1000;
    updateTime(state.elapsed);
  }, 250);
}

function stopTimer() {
  if (state.timerId !== null) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  if (state.startedAt) {
    state.elapsed = (performance.now() - state.startedAt) / 1000;
    state.startedAt = 0;
  }
}

function updateTime(seconds) {
  dom.timeValue.textContent = formatTime(seconds);
}

function updateScorePanel() {
  dom.timeValue.textContent = formatTime(state.elapsed);
  if (state.mode === 'distance') {
    dom.scoreValue.textContent = formatScore(state.total);
    dom.scoreSr.textContent = `Skóre ${state.total} bodov, čas ${formatTime(state.elapsed)}`;
  } else {
    dom.correctValue.textContent = String(state.correct);
    dom.wrongValue.textContent = String(state.incorrect);
    dom.scoreSr.textContent =
      `Správne ${state.correct}, nesprávne ${state.incorrect}, čas ${formatTime(state.elapsed)}`;
  }
  if (dom.gameAverageValue) dom.gameAverageValue.textContent = gameAverageText();
}

function updateProgress() {
  const total = state.targets.length || state.gameNumQ || 1;
  const current = state.final ? total : state.index + (state.answered ? 1 : 0);
  dom.progressFill.style.width = `${clamp((current / total) * 100, 0, 100)}%`;
  if (dom.gameQuestionCounter) {
    dom.gameQuestionCounter.textContent = `${Math.max(1, state.final ? total : state.index + 1)}/${total}`;
  }
}

function updateMapTag() {
  if (state.final) {
    dom.mapTag.textContent = `Výsledok · ${state.contextLabel}`;
    return;
  }
  const total = state.targets.length || state.gameNumQ || 0;
  dom.mapTag.textContent = `${state.contextLabel} · ${Math.min(state.index + 1, total)}/${total}`;
}

/* ------------------------------------------------------------------ */
/* map layout / view                                                   */
/* ------------------------------------------------------------------ */

function layoutMap() {
  if (dom.gameScreen.hidden || state.screen === 'home' || state.screen === 'atlas') return;
  const viewport = dom.mapViewport.getBoundingClientRect();
  if (viewport.width < 2 || viewport.height < 2) return;

  const scale = Math.min(viewport.width / MAP_WIDTH, viewport.height / MAP_HEIGHT);
  const width = MAP_WIDTH * scale;
  const height = MAP_HEIGHT * scale;

  state.stage = {
    w: width,
    h: height,
    left: (viewport.width - width) / 2,
    top: (viewport.height - height) / 2,
  };

  dom.mapStage.style.width = `${width}px`;
  dom.mapStage.style.height = `${height}px`;
  dom.mapStage.style.left = `${state.stage.left}px`;
  dom.mapStage.style.top = `${state.stage.top}px`;

  state.view = clampView(state.view);
  applyView();
}

function clampView(view) {
  const zoom = clamp(Number(view.zoom) || MIN_ZOOM, MIN_ZOOM, MAX_ZOOM);
  const viewport = dom.mapViewport.getBoundingClientRect();
  const displayWidth = state.stage.w * zoom;
  const displayHeight = state.stage.h * zoom;
  const factor = viewport.width <= 700 ? 0.4 : 0.2;
  const maxPanX = Math.max(Math.abs(displayWidth - viewport.width) / 2, viewport.width * factor);
  const maxPanY = Math.max(Math.abs(displayHeight - viewport.height) / 2, viewport.height * factor);

  return {
    zoom,
    panX: clamp(Number(view.panX) || 0, -maxPanX, maxPanX),
    panY: clamp(Number(view.panY) || 0, -maxPanY, maxPanY),
  };
}

function applyView() {
  dom.mapStage.style.transform =
    `translate(${state.view.panX}px, ${state.view.panY}px) scale(${state.view.zoom})`;
  updateMarkerScale();
}

function setView(view) {
  state.view = clampView(view);
  applyView();
}

function zoomAt(clientX, clientY, factor) {
  const viewport = dom.mapViewport.getBoundingClientRect();
  if (viewport.width < 2 || viewport.height < 2) return;

  const nextZoom = clamp(state.view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  if (Math.abs(nextZoom - state.view.zoom) < 0.0001) return;

  const screenX = clientX - viewport.left - state.stage.left;
  const screenY = clientY - viewport.top - state.stage.top;
  const centerX = state.stage.w / 2;
  const centerY = state.stage.h / 2;
  const pointX = centerX + (screenX - centerX - state.view.panX) / state.view.zoom;
  const pointY = centerY + (screenY - centerY - state.view.panY) / state.view.zoom;

  state.view = clampView({
    zoom: nextZoom,
    panX: screenX - centerX - (pointX - centerX) * nextZoom,
    panY: screenY - centerY - (pointY - centerY) * nextZoom,
  });
  applyView();
}

function zoomFromButton(factor) {
  const viewport = dom.mapViewport.getBoundingClientRect();
  zoomAt(viewport.left + viewport.width / 2, viewport.top + viewport.height / 2, factor);
}

/* ------------------------------------------------------------------ */
/* markers                                                            */
/* ------------------------------------------------------------------ */

function svgElement(name, attributes = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  if (parent) parent.appendChild(node);
  return node;
}

function clearMarkers() {
  dom.markers.replaceChildren();
  state.markerGroups = [];
  state.quizGroups = new Map();
}

function updateMarkerScale() {
  if (!state.markerGroups.length) return;
  const rect = dom.mapStage.getBoundingClientRect();
  if (rect.width <= 0) return;
  const scale = MAP_WIDTH / rect.width;
  for (const group of state.markerGroups) {
    group.setAttribute(
      'transform',
      `translate(${group.dataset.x} ${group.dataset.y}) scale(${scale})`
    );
  }
}

/* --- distance markers --------------------------------------------- */

const LEGACY_PIN_PATH = '<path fill="currentColor" d="M8 0.7c-3.5 0-6.3 2.7-6.3 6.1 0 4.5 6.3 8.7 6.3 8.7s6.3-4.2 6.3-8.7C14.3 3.4 11.5 0.7 8 0.7Z"/><path d="m5.1 6.9 2 2 3.8-4.1" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>';

function makeResultLabel(parent, { label, placement, fill, stroke, textFill, bgClass, textClass }) {
  const group = svgElement('g', { class: 'marker-result-label' }, parent);
  group.dataset.placement = placement;
  const above = placement === 'above';
  const height = 18;
  const bgY = above ? -40 : 22;
  const stem = svgElement('line', {
    x1: 0,
    y1: above ? -10 : 10,
    x2: 0,
    y2: above ? -22 : 22,
    stroke,
    'stroke-width': 1.4,
    'stroke-dasharray': '2 2',
    'stroke-linecap': 'round',
    'aria-hidden': 'true',
  }, group);
  const bg = svgElement('rect', {
    class: bgClass,
    x: -30,
    y: bgY,
    width: 60,
    height,
    rx: 6,
    fill,
    stroke,
    'stroke-width': 1.2,
  }, group);
  const text = svgElement('text', {
    class: textClass,
    x: 0,
    y: bgY + height / 2,
    fill: textFill,
    'font-family': 'Tahoma, Arial, sans-serif',
    'font-size': 10.5,
    'font-weight': 700,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
  }, group);
  text.textContent = label;
  group._stem = stem;
  group._bg = bg;
  group._text = text;
  return group;
}

function sizeResultLabel(group) {
  const label = group.querySelector('.marker-result-label');
  if (!label) return;
  const text = label._text || label.querySelector('text');
  const bg = label._bg || label.querySelector('rect');
  const stem = label._stem || label.querySelector('line');
  if (!text || !bg) return;
  const width = Math.max(24, (text.getComputedTextLength?.() || text.textContent.length * 6) + 12);
  bg.setAttribute('width', String(width));
  // Keep the chip inside the map viewport; the stem follows sideways.
  const rect = label.getBoundingClientRect();
  const viewport = dom.mapViewport.getBoundingClientRect();
  const margin = 6;
  let dx = 0;
  if (rect.left < viewport.left + margin) dx = viewport.left + margin - rect.left;
  else if (rect.right > viewport.right - margin) dx = viewport.right - margin - rect.right;
  bg.setAttribute('x', String(-width / 2 + dx));
  text.setAttribute('x', String(dx));
  stem?.setAttribute('x2', String(dx));
}

function makeRedMarker(x, y, label = 'Tvoj tip', placement = 'below') {
  const group = svgElement('g', { class: 'marker marker-guess' });
  group.dataset.x = x;
  group.dataset.y = y;

  const icon = svgElement('g', { class: 'marker-icon' }, group);
  svgElement('circle', { cx: 0, cy: 0, r: 6.2, fill: 'none', stroke: '#ffffff', 'stroke-width': 3.4 }, icon);
  svgElement('circle', { cx: 0, cy: 0, r: 6.2, fill: 'none', stroke: '#dc2626', 'stroke-width': 1.8 }, icon);
  const ticks = [
    [0, -10, 0, -7.5],
    [0, 7.5, 0, 10],
    [-10, 0, -7.5, 0],
    [7.5, 0, 10, 0],
  ];
  for (const [x1, y1, x2, y2] of ticks) {
    svgElement('line', { x1, y1, x2, y2, stroke: '#ffffff', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, icon);
    svgElement('line', { x1, y1, x2, y2, stroke: '#dc2626', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, icon);
  }
  svgElement('circle', { cx: 0, cy: 0, r: 1.7, fill: '#dc2626' }, icon);

  makeResultLabel(group, {
    label,
    placement,
    fill: '#fef2f2',
    stroke: '#dc2626',
    textFill: '#991b1b',
    bgClass: 'guess-label-bg',
    textClass: 'guess-label-text',
  });
  return group;
}

function makeGreenMarker(x, y, label, placement = 'above') {
  const group = svgElement('g', { class: 'marker marker-correct' });
  group.dataset.x = x;
  group.dataset.y = y;

  const icon = svgElement('g', { class: 'marker-icon' }, group);
  svgElement('circle', { cx: 0, cy: 0, r: 9.5, fill: '#ffffff', stroke: '#15803d', 'stroke-width': 1.5 }, icon);
  const pin = svgElement('g', { transform: 'translate(-8 -8)', color: '#15803d' }, icon);
  pin.innerHTML = LEGACY_PIN_PATH;

  makeResultLabel(group, {
    label,
    placement,
    fill: '#f0fdf4',
    stroke: '#16a34a',
    textFill: '#14532d',
    bgClass: 'label-bg',
    textClass: 'label-text',
  });
  return group;
}

function drawDistanceMarkers(guess, target) {
  clearMarkers();
  svgElement('line', {
    class: 'distance-guide-underlay',
    x1: guess.x,
    y1: guess.y,
    x2: target.x,
    y2: target.y,
  }, dom.markers);
  svgElement('line', {
    class: 'distance-guide',
    x1: guess.x,
    y1: guess.y,
    x2: target.x,
    y2: target.y,
  }, dom.markers);
  const targetAbove = target.y <= guess.y;
  const green = makeGreenMarker(target.x, target.y, target.label, targetAbove ? 'above' : 'below');
  dom.markers.appendChild(green);
  const red = makeRedMarker(guess.x, guess.y, 'Tvoj tip', targetAbove ? 'below' : 'above');
  dom.markers.appendChild(red);
  sizeResultLabel(green);
  sizeResultLabel(red);
  state.markerGroups = [green, red];
  updateMarkerScale();
}

/* --- quiz candidates ---------------------------------------------- */

function makeQuizCandidate(city) {
  const group = svgElement('g', { class: 'quiz-candidate' });
  group.dataset.x = city.x;
  group.dataset.y = city.y;
  group.dataset.entity = city.entity;

  svgElement('circle', { class: 'candidate-halo', cx: 0, cy: 0, r: 14, fill: 'transparent' }, group);
  svgElement('circle', { class: 'candidate-ring', cx: 0, cy: 0, r: 11, fill: 'none', stroke: '#2f6fed', 'stroke-width': 2.4 }, group);
  svgElement('circle', { class: 'candidate-dot', cx: 0, cy: 0, r: 7, fill: '#1f2937', stroke: '#ffffff', 'stroke-width': 2 }, group);
  svgElement('circle', { cx: 0, cy: 0, r: 1.7, fill: '#ffffff' }, group);

  return group;
}

function drawQuizMarkers(options) {
  clearMarkers();
  state.quizGroups = new Map();
  for (const city of options) {
    const group = makeQuizCandidate(city);
    dom.markers.appendChild(group);
    state.quizGroups.set(city.entity, group);
    state.markerGroups.push(group);
  }
  updateMarkerScale();
}

function addCandidateLabel(city, tone) {
  const group = state.quizGroups.get(city.entity);
  if (!group || group.querySelector('.candidate-label-text')) return;

  const color = tone === 'correct' ? '#0a7a0a' : '#990000';
  const text = svgElement(
    'text',
    {
      class: 'candidate-label-text',
      x: 11,
      y: 4,
      fill: color,
      'text-anchor': 'start',
    },
    group
  );
  text.textContent = city.label;
  const width = Math.max(12, text.getComputedTextLength ? text.getComputedTextLength() : city.label.length * 6);
  const flip = city.x > 800;
  const plate = svgElement(
    'rect',
    {
      class: 'candidate-label-bg',
      x: flip ? -(width + 16) : 8,
      y: -8,
      width: width + 8,
      height: 16,
      rx: 2,
      fill: '#ffffff',
      stroke: '#8a8f98',
      'stroke-width': 1,
    },
    group
  );
  group.insertBefore(plate, text);
  if (flip) {
    text.setAttribute('text-anchor', 'end');
    text.setAttribute('x', -12);
  } else {
    text.setAttribute('x', 12);
  }
}

function markQuizAnswer(target, picked, correct) {
  highlightQuizCandidate(null);
  for (const [entity, group] of state.quizGroups) {
    const isTarget = entity === target.entity;
    const isPicked = entity === picked.entity;
    group.classList.toggle('is-dim', !isTarget && !isPicked);
    group.classList.toggle('is-correct', isTarget);
    group.classList.toggle('is-wrong', isPicked && !correct);
  }
  addCandidateLabel(target, 'correct');
  if (!correct) addCandidateLabel(picked, 'wrong');
}

function highlightQuizCandidate(city) {
  for (const [entity, group] of state.quizGroups) {
    group.classList.toggle('is-near', Boolean(city) && entity === city.entity);
  }
}

function nearestQuizCity(mapPoint, stageWidth) {
  if (!state.quizOptions.length || !stageWidth) return null;
  const radius = QUIZ_HIT_PX * (MAP_WIDTH / stageWidth);
  let nearest = null;
  let nearestDistance = Infinity;
  for (const city of state.quizOptions) {
    const distance = distanceBetween(mapPoint, city);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = city;
    }
  }
  return nearest && nearestDistance <= radius ? nearest : null;
}

/* --- puzzle token -------------------------------------------------- */

function drawPuzzleToken(target) {
  clearMarkers();
  const group = svgElement('g', { class: 'puzzle-token' });
  group.dataset.x = MAP_WIDTH / 2;
  group.dataset.y = MAP_HEIGHT / 2;

  const plate = svgElement('rect', {
    class: 'token-plate',
    x: -50,
    y: -15,
    width: 100,
    height: 30,
    rx: 8,
  }, group);

  const gripA = svgElement('line', { class: 'token-grip', x1: -38, y1: -4, x2: -32, y2: -4 }, group);
  const gripB = svgElement('line', { class: 'token-grip', x1: -38, y1: 4, x2: -32, y2: 4 }, group);

  const text = svgElement(
    'text',
    { class: 'token-text', x: -24, y: 4.5, 'font-family': 'Tahoma, Arial, sans-serif', 'font-size': 12, 'font-weight': 700 },
    group
  );
  text.textContent = target.label;

  dom.markers.appendChild(group);
  const textWidth = Math.max(
    40,
    text.getComputedTextLength ? text.getComputedTextLength() : target.label.length * 6.5
  );
  const width = Math.max(92, textWidth + 54);
  plate.setAttribute('x', -width / 2);
  plate.setAttribute('width', width);
  gripA.setAttribute('x1', -width / 2 + 10);
  gripA.setAttribute('x2', -width / 2 + 16);
  gripB.setAttribute('x1', -width / 2 + 10);
  gripB.setAttribute('x2', -width / 2 + 16);
  text.setAttribute('x', -width / 2 + 24);

  state.puzzle = {
    target,
    token: group,
    dragging: false,
    moved: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  };
  state.markerGroups = [group];

  group.addEventListener('pointerdown', onPuzzlePointerDown);
  group.addEventListener('pointermove', onPuzzlePointerMove);
  group.addEventListener('pointerup', onPuzzlePointerUp);
  group.addEventListener('pointercancel', onPuzzlePointerUp);

  setTokenPosition(MAP_WIDTH / 2, MAP_HEIGHT / 2);
}

function setTokenPosition(x, y) {
  const token = state.puzzle?.token;
  if (!token) return;
  token.dataset.x = clamp(x, 10, MAP_WIDTH - 10);
  token.dataset.y = clamp(y, 10, MAP_HEIGHT - 10);
  const rect = dom.mapStage.getBoundingClientRect();
  const scale = rect.width > 0 ? MAP_WIDTH / rect.width : 1;
  token.setAttribute(
    'transform',
    `translate(${token.dataset.x} ${token.dataset.y}) scale(${scale})`
  );
}

function screenToMap(clientX, clientY) {
  const rect = dom.mapStage.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: clamp(((clientX - rect.left) / rect.width) * MAP_WIDTH, 0, MAP_WIDTH),
    y: clamp(((clientY - rect.top) / rect.height) * MAP_HEIGHT, 0, MAP_HEIGHT),
  };
}

function onPuzzlePointerDown(event) {
  if (state.mode !== 'puzzle' || state.answered || !state.puzzle) return;
  const point = screenToMap(event.clientX, event.clientY);
  if (!point) return;
  event.preventDefault();
  event.stopPropagation();

  const token = state.puzzle.token;
  state.puzzle.dragging = true;
  state.puzzle.moved = false;
  state.puzzle.pointerId = event.pointerId;
  state.puzzle.startX = event.clientX;
  state.puzzle.startY = event.clientY;
  state.puzzle.offsetX = point.x - Number(token.dataset.x);
  state.puzzle.offsetY = point.y - Number(token.dataset.y);
  token.classList.add('is-dragging');

  try {
    token.setPointerCapture(event.pointerId);
  } catch {
    /* ignore */
  }
}

function onPuzzlePointerMove(event) {
  if (!state.puzzle?.dragging || state.puzzle.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();

  if (
    Math.hypot(event.clientX - state.puzzle.startX, event.clientY - state.puzzle.startY) > 4
  ) {
    state.puzzle.moved = true;
  }
  if (!state.puzzle.moved) return;

  const point = screenToMap(event.clientX, event.clientY);
  if (!point) return;
  setTokenPosition(point.x - state.puzzle.offsetX, point.y - state.puzzle.offsetY);
}

function onPuzzlePointerUp(event) {
  if (!state.puzzle?.dragging || state.puzzle.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();

  const token = state.puzzle.token;
  state.puzzle.dragging = false;
  state.puzzle.pointerId = null;
  token.classList.remove('is-dragging');

  try {
    token.releasePointerCapture(event.pointerId);
  } catch {
    /* ignore */
  }

  if (!state.puzzle.moved) return;
  answerPuzzle({
    x: Number(token.dataset.x),
    y: Number(token.dataset.y),
  });
}

function finishPuzzleVisual(drop, target, correct) {
  const token = state.puzzle?.token;
  if (token) {
    token.classList.remove('is-dragging');
    token.classList.add('is-answered');
    token.classList.add(correct ? 'is-correct' : 'is-incorrect');
    setTokenPosition(target.x, target.y);
  }

  if (!correct) {
    const marker = svgElement('g', { class: 'puzzle-drop-marker' });
    marker.dataset.x = drop.x;
    marker.dataset.y = drop.y;
    const casing = 4;
    svgElement('circle', { cx: 0, cy: 0, r: 10, fill: 'rgba(255,255,255,.65)' }, marker);
    for (const [x1, y1, x2, y2] of [
      [-7, -7, 7, 7],
      [7, -7, -7, 7],
    ]) {
      svgElement('line', { x1, y1, x2, y2, stroke: '#ffffff', 'stroke-width': casing + 2.5, 'stroke-linecap': 'round' }, marker);
      svgElement('line', { x1, y1, x2, y2, stroke: '#c62828', 'stroke-width': casing, 'stroke-linecap': 'round' }, marker);
    }
    dom.markers.appendChild(marker);
    state.markerGroups.push(marker);
  }

  updateMarkerScale();
}

function bindGameEvents() {
  dom.nextBtn.addEventListener('click', onNext);
  dom.nextFloat?.addEventListener('click', () => {
    if (state.final && dom.resultOverlay.hidden) openOverlay(dom.resultOverlay, dom.playAgainBtn);
    else if (!dom.nextBtn.disabled) dom.nextBtn.click();
  });
  dom.endBtn.addEventListener('click', onEnd);
  if (dom.nextBtn) {
    new MutationObserver(syncNextFloat).observe(dom.nextBtn, {
      attributes: true,
      attributeFilter: ['disabled', 'hidden'],
    });
  }
  window.addEventListener('resize', () => requestAnimationFrame(positionNextFloat));
  syncNextFloat();
}

/* ------------------------------------------------------------------ */
/* map interaction                                                    */
/* ------------------------------------------------------------------ */

function bindMapEvents() {
  dom.zoomIn.addEventListener('click', () => zoomFromButton(1.45));
  dom.zoomOut.addEventListener('click', () => zoomFromButton(1 / 1.45));
  dom.zoomReset.addEventListener('click', () => setView({ zoom: 1, panX: 0, panY: 0 }));

  dom.vucToggle.addEventListener('click', () => {
    state.showVuc = !state.showVuc;
    syncVucUI();
    saveSettings();
  });

  dom.mapViewport.addEventListener('wheel', (event) => {
    if (state.screen !== 'game') return;
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0016));
  }, { passive: false });

  dom.mapViewport.addEventListener('pointerdown', onPointerDown);
  dom.mapViewport.addEventListener('pointermove', onPointerMove);
  dom.mapViewport.addEventListener('pointerup', onPointerUp);
  dom.mapViewport.addEventListener('pointercancel', onPointerUp);
  dom.mapViewport.addEventListener('pointermove', onMapHover);
  dom.mapViewport.addEventListener('pointerleave', () => {
    if (state.mode === 'quiz') highlightQuizCandidate(null);
  });
  dom.mapViewport.addEventListener('contextmenu', (event) => event.preventDefault());

  const resizeObserver = new ResizeObserver(() => {
    if (state.screen === 'game') layoutMap();
  });
  resizeObserver.observe(dom.mapViewport);

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      layoutMap();
    });
  });

  window.addEventListener('orientationchange', () => setTimeout(layoutMap, 150));
}

function onMapHover(event) {
  if (state.screen !== 'game' || state.mode !== 'quiz' || state.answered) return;
  if (event.pointerType !== 'mouse') return;
  const point = screenToMap(event.clientX, event.clientY);
  const rect = dom.mapStage.getBoundingClientRect();
  if (!point || rect.width <= 0) return;
  const city = nearestQuizCity(point, rect.width);
  highlightQuizCandidate(city);
}

function onPointerDown(event) {
  if (state.screen !== 'game') return;
  if (event.target.closest('.zoom-controls, .map-next-float, button, a, input, select, textarea')) return;
  if (event.target.closest('.puzzle-token')) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  event.preventDefault();
  try {
    dom.mapViewport.setPointerCapture(event.pointerId);
  } catch {
    /* ignore */
  }

  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (state.pointers.size === 1) {
    state.suppressTap = false;
    state.pinch = null;
    state.drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      slop: tapSlop(event.pointerType),
      moved: false,
    };
  } else if (state.pointers.size === 2) {
    state.drag = null;
    state.suppressTap = true;
    const points = Array.from(state.pointers.values());
    state.pinch = {
      dist: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
      midX: (points[0].x + points[1].x) / 2,
      midY: (points[0].y + points[1].y) / 2,
    };
  }
}

function onPointerMove(event) {
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (state.pointers.size >= 2 && state.pinch) {
    const points = Array.from(state.pointers.values());
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    const midX = (points[0].x + points[1].x) / 2;
    const midY = (points[0].y + points[1].y) / 2;

    if (state.pinch.dist > 0 && distance > 0) {
      zoomAt(midX, midY, distance / state.pinch.dist);
    }

    const dx = midX - state.pinch.midX;
    const dy = midY - state.pinch.midY;
    if (dx || dy) {
      state.view = clampView({
        ...state.view,
        panX: state.view.panX + dx,
        panY: state.view.panY + dy,
      });
      applyView();
    }

    state.pinch = { dist: distance, midX, midY };
    event.preventDefault();
    return;
  }

  if (state.drag && state.drag.id === event.pointerId) {
    const dx = event.clientX - state.drag.lastX;
    const dy = event.clientY - state.drag.lastY;
    const travelled = Math.hypot(
      event.clientX - state.drag.startX,
      event.clientY - state.drag.startY
    );

    state.drag.lastX = event.clientX;
    state.drag.lastY = event.clientY;

    if (travelled > (state.drag.slop ?? TAP_MOVE_LIMIT)) {
      state.drag.moved = true;
      state.suppressTap = true;
    }

    if (state.drag.moved) {
      state.view = clampView({
        ...state.view,
        panX: state.view.panX + dx,
        panY: state.view.panY + dy,
      });
      applyView();
      dom.mapViewport.classList.add('is-dragging');
    }

    if (state.drag.moved) event.preventDefault();
  }
}

function onPointerUp(event) {
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.delete(event.pointerId);

  const drag = state.drag;

  if (state.pointers.size === 0) {
    if (drag && drag.id === event.pointerId && !drag.moved && !state.suppressTap) {
      handleTap(event.clientX, event.clientY);
    }
    state.drag = null;
    state.pinch = null;
    state.suppressTap = false;
    dom.mapViewport.classList.remove('is-dragging');
  } else if (state.pointers.size === 1) {
    state.drag = null;
    state.pinch = null;
    state.suppressTap = true;
  }
}

function handleTap(clientX, clientY) {
  if (state.screen !== 'game' || state.answered || state.final) return;
  const rect = dom.mapStage.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return;
  }

  const point = {
    x: clamp(((clientX - rect.left) / rect.width) * MAP_WIDTH, 0, MAP_WIDTH),
    y: clamp(((clientY - rect.top) / rect.height) * MAP_HEIGHT, 0, MAP_HEIGHT),
  };

  if (state.mode === 'distance') {
    answerDistance(point);
  } else if (state.mode === 'quiz') {
    const city = nearestQuizCity(point, rect.width);
    if (city) answerQuiz(city);
  } else if (state.mode === 'puzzle') {
    setTokenPosition(point.x, point.y);
    answerPuzzle(point);
  }
}

/* ------------------------------------------------------------------ */
/* city atlas                                                         */
/* ------------------------------------------------------------------ */

function bindAtlasEvents() {
  dom.atlasBackBtn.addEventListener('click', goHome);
  dom.atlasHelpBtn.addEventListener('click', openHelp);
  dom.atlasCsvBtn.addEventListener('click', downloadCsv);

  dom.citySearch.addEventListener('input', () => {
    state.atlas.query = dom.citySearch.value;
    renderAtlas();
  });

  dom.citySearch.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (dom.citySearch.value) {
      dom.citySearch.value = '';
      state.atlas.query = '';
      renderAtlas();
    } else {
      dom.citySearch.blur();
    }
  });

  dom.levelFilters.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    state.atlas.level = chip.dataset.levelFilter;
    renderAtlas();
  });

  dom.trainFilterBtn.addEventListener('click', () => {
    trainAtlas(state.atlas.filtered);
  });

  dom.atlasDetail.addEventListener('click', (event) => {
    const action = event.target.closest('[data-atlas-action]');
    if (!action) return;
    if (action.dataset.atlasAction === 'train' && state.atlas.selected) {
      const city = CITIES.find((entry) => entry.entity === state.atlas.selected);
      if (city) trainAtlas([city]);
    } else if (action.dataset.atlasAction === 'clear') {
      clearAtlasSelection();
    }
  });

  dom.atlasFloatingTrain.addEventListener('click', () => {
    if (!state.atlas.selected) return;
    const city = CITIES.find((entry) => entry.entity === state.atlas.selected);
    if (city) trainAtlas([city]);
  });
  dom.atlasFloatingClear.addEventListener('click', clearAtlasSelection);
}

function renderAtlasFilters() {
  const counts = {
    all: CITIES.length,
    1: citiesForLevel(CITIES, 1).length,
    2: citiesForLevel(CITIES, 2).length,
    3: citiesForLevel(CITIES, 3).length,
  };
  const labels = { all: 'Všetky', 1: 'Ľahká', 2: 'Stredná', 3: 'Ťažká' };
  $$('.chip', dom.levelFilters).forEach((chip) => {
    const key = chip.dataset.levelFilter;
    chip.textContent = `${labels[key]} (${counts[key]})`;
    const active = key === state.atlas.level;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
}

function renderAtlas() {
  const filtered = filterCities(CITIES, {
    query: state.atlas.query,
    level: state.atlas.level,
  });
  state.atlas.filtered = filtered;

  dom.atlasCount.textContent = `${filtered.length} ${cityWord(filtered.length)}`;
  dom.trainFilterBtn.disabled = filtered.length === 0;
  dom.trainFilterBtn.innerHTML =
    `<span class="ico ico-play" aria-hidden="true"></span>Trénovať zoznam (${filtered.length})`;

  if (state.atlas.selected && !filtered.some((city) => city.entity === state.atlas.selected)) {
    state.atlas.selected = null;
  }

  renderAtlasFilters();

  const dotFragment = document.createDocumentFragment();
  const listFragment = document.createDocumentFragment();

  for (const city of filtered) {
    const levelClass = `level-${city.level}`;
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `map-dot ${levelClass}`;
    dot.dataset.entity = city.entity;
    dot.tabIndex = -1;
    dot.setAttribute('aria-hidden', 'true');
    dot.style.left = `${(city.x / MAP_WIDTH) * 100}%`;
    dot.style.top = `${(city.y / MAP_HEIGHT) * 100}%`;
    dot.setAttribute('aria-label', `${city.label}, ${levelName(city.level)}`);
    dot.title = `${city.label} · ${levelName(city.level)}`;
    dot.addEventListener('click', () => selectAtlasCity(city.entity, true));
    dotFragment.appendChild(dot);

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'city-row';
    row.dataset.entity = city.entity;
    row.setAttribute('aria-pressed', 'false');
    row.innerHTML =
      `<span class="city-dot ${levelClass}" aria-hidden="true"></span>` +
      `<span class="city-name">${escapeHtml(city.label)}</span>` +
      `<span class="city-level ${levelClass}">${levelName(city.level)}</span>` +
      `<span class="city-arrow" aria-hidden="true">›</span>`;
    row.addEventListener('click', () => selectAtlasCity(city.entity, false));
    listFragment.appendChild(row);
  }

  dom.atlasDots.replaceChildren(dotFragment);
  dom.cityList.replaceChildren(listFragment);
  dom.cityList.hidden = filtered.length === 0;
  dom.atlasEmpty.hidden = filtered.length !== 0;

  updateAtlasSelectionUI();
}

function selectAtlasCity(entity, scrollList) {
  state.atlas.selected = entity;
  updateAtlasSelectionUI();
  if (scrollList) {
    const row = dom.cityList.querySelector(`[data-entity="${cssEscape(entity)}"]`);
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function clearAtlasSelection() {
  state.atlas.selected = null;
  updateAtlasSelectionUI();
}

function updateAtlasSelectionUI() {
  const selected = state.atlas.selected;
  $$('.map-dot', dom.atlasDots).forEach((dot) => {
    const active = dot.dataset.entity === selected;
    dot.classList.toggle('is-selected', active);
    dot.setAttribute('aria-pressed', String(active));
  });
  $$('.city-row', dom.cityList).forEach((row) => {
    const active = row.dataset.entity === selected;
    row.classList.toggle('is-selected', active);
    row.setAttribute('aria-pressed', String(active));
  });

  if (!selected) {
    dom.atlasSelectedLabel.hidden = true;
    dom.atlasFloating.hidden = true;
    dom.atlasDetail.innerHTML = '<p class="atlas-empty">Vyber mesto na mape alebo v zozname.</p>';
    return;
  }

  const city = CITIES.find((entry) => entry.entity === selected);
  if (!city) {
    dom.atlasSelectedLabel.hidden = true;
    dom.atlasFloating.hidden = true;
    dom.atlasDetail.innerHTML = '<p class="atlas-empty">Vyber mesto na mape alebo v zozname.</p>';
    return;
  }

  dom.atlasFloating.hidden = false;
  dom.atlasFloatingName.textContent = city.label;
  dom.atlasFloatingLevel.textContent = levelName(city.level);

  const levelClass = `level-${city.level}`;
  dom.atlasSelectedLabel.hidden = false;
  dom.atlasSelectedLabel.textContent = city.label;
  dom.atlasSelectedLabel.className = 'atlas-selected-label';
  dom.atlasSelectedLabel.style.left = `${clamp((city.x / MAP_WIDTH) * 100, 9, 91)}%`;
  dom.atlasSelectedLabel.style.top = `${(city.y / MAP_HEIGHT) * 100}%`;
  if (city.y / MAP_HEIGHT < 0.14) dom.atlasSelectedLabel.classList.add('is-below');

  dom.atlasDetail.innerHTML =
    `<div class="atlas-detail-main">` +
    `<span class="atlas-detail-name">${escapeHtml(city.label)}</span>` +
    `<span class="atlas-level-badge ${levelClass}">${levelName(city.level)}</span>` +
    `</div>` +
    `<div class="atlas-detail-actions">` +
    `<button type="button" class="btn-primary" data-atlas-action="train">Trénovať mesto</button>` +
    `<button type="button" class="btn-soft" data-atlas-action="clear">Zrušiť</button>` +
    `</div>`;
}

function trainAtlas(cities) {
  if (!cities || !cities.length) {
    showToast('Najprv vyber aspoň jedno mesto.');
    return;
  }
  // The legacy quick game settings are hidden in the new shell. Keep
  // list training useful even for browsers that still have an old numQ=1.
  const requested = cities.length === 1 ? 1 : Math.max(5, state.numQ);
  const numQ = Math.min(requested, cities.length);
  startGame('distance', {
    pool: cities,
    numQ,
    returnScreen: 'atlas',
    contextLabel: cities.length === 1 ? 'Mesto' : 'Výber',
  });
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv() {
  const cities = state.atlas.filtered;
  if (!cities.length) {
    showToast('Zoznam je prázdny.');
    return;
  }

  const header = ['Mesto', 'Obtiažnosť', 'testLevel', 'x', 'y', 'entity'];
  const lines = [
    header,
    ...cities.map((city) => [city.label, levelName(city.level), city.level, city.x, city.y, city.entity]),
  ];
  const csv = '\uFEFF' + lines.map((row) => row.map(csvCell).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mesta-slovenska-${cities.length}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast(`CSV bolo stiahnuté (${cities.length} ${cityWord(cities.length)}).`);
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ */
/* settings / statistics actions                                      */
/* ------------------------------------------------------------------ */

function resetStats() {
  openConfirm({
    title: 'Resetovať štatistiky?',
    message: 'Vymažú sa uložené hry, najlepšie skóre a priemery v tomto prehliadači.',
    okLabel: 'Resetovať',
    cancelLabel: 'Zrušiť',
    onConfirm: () => {
      state.stats = emptyStats();
      saveStats();
      renderProgress();
      showToast('Štatistiky boli resetované.');
    },
  });
}

/* ------------------------------------------------------------------ */
/* overlays / keyboard                                                 */
/* ------------------------------------------------------------------ */

function openHelp() {
  openOverlay(dom.helpOverlay, $('[data-close="help"]', dom.helpOverlay));
}

function openConfirm({ title, message, okLabel, cancelLabel, onConfirm }) {
  dom.confirmTitle.textContent = title;
  dom.confirmMessage.textContent = message;
  dom.confirmOkBtn.textContent = okLabel || 'Ukončiť';
  dom.confirmCancelBtn.textContent = cancelLabel || 'Pokračovať';
  state.confirmAction = onConfirm || null;
  openOverlay(dom.confirmOverlay, dom.confirmCancelBtn);
}

function bindOverlayEvents() {
  dom.helpOverlay.addEventListener('click', (event) => {
    if (event.target === dom.helpOverlay) closeOverlay(dom.helpOverlay);
  });
  dom.gameResultBtn?.addEventListener('click', () => {
    openOverlay(dom.resultOverlay, dom.playAgainBtn);
  });
  new MutationObserver(syncLegacyResultReopen).observe(dom.resultOverlay, {
    attributes: true,
    attributeFilter: ['hidden', 'class'],
  });
  dom.resultOverlay.addEventListener('click', (event) => {
    if (event.target === dom.resultOverlay) closeOverlay(dom.resultOverlay);
  });
  dom.confirmOverlay.addEventListener('click', (event) => {
    if (event.target === dom.confirmOverlay) {
      state.confirmAction = null;
      closeOverlay(dom.confirmOverlay);
    }
  });

  $$('[data-close="help"]').forEach((button) => {
    button.addEventListener('click', () => closeOverlay(dom.helpOverlay));
  });

  dom.confirmCancelBtn.addEventListener('click', () => {
    state.confirmAction = null;
    closeOverlay(dom.confirmOverlay);
  });

  dom.confirmOkBtn.addEventListener('click', () => {
    const action = state.confirmAction;
    state.confirmAction = null;
    closeOverlay(dom.confirmOverlay);
    if (action) action();
  });

  dom.playAgainBtn.addEventListener('click', () => {
    closeOverlay(dom.resultOverlay);
    const game = state.lastGame;
    if (!game) {
      finishReturn();
      return;
    }
    startGame(game.mode, {
      pool: game.pool,
      numQ: game.numQ,
      returnScreen: game.returnScreen,
      contextLabel: game.contextLabel,
    });
  });

  dom.shareResultBtn.addEventListener('click', shareResult);

  dom.menuBtn.addEventListener('click', () => {
    closeOverlay(dom.resultOverlay);
    finishReturn();
  });
}

async function shareResult() {
  const result = state.lastResult;
  if (!result) return;

  const text = `${result.summary}${result.context ? ` · ${result.context}` : ''} — Editor máp 2 (web)`;
  const url = window.location.href;
  const payload = {
    title: 'Editor máp 2 — výsledok',
    text,
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }

  const copy = `${text}\n${url}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(copy);
      showToast('Výsledok bol skopírovaný do schránky.');
      return;
    } catch {
      /* fall through to execCommand */
    }
  }

  if (copyTextFallback(copy)) {
    showToast('Výsledok bol skopírovaný do schránky.');
    return;
  }
  showToast('Zdieľanie nie je v tomto prehliadači dostupné.');
}

function copyTextFallback(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

function anyOverlayOpen() {
  return !dom.helpOverlay.hidden || !dom.resultOverlay.hidden || !dom.confirmOverlay.hidden;
}

function openOverlay(overlay, focusTarget = null) {
  state.lastFocus = document.activeElement;
  overlay.hidden = false;
  document.body.classList.add('overlay-open');
  requestAnimationFrame(() => {
    const target =
      focusTarget ||
      overlay.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (target) target.focus({ preventScroll: true });
  });
}

function closeOverlay(overlay) {
  overlay.hidden = true;
  if (!anyOverlayOpen()) document.body.classList.remove('overlay-open');
  const previous = state.lastFocus;
  state.lastFocus = null;
  if (previous && previous.isConnected && !previous.closest('[hidden]')) {
    previous.focus({ preventScroll: true });
  }
}

function closeAllOverlays() {
  dom.helpOverlay.hidden = true;
  dom.resultOverlay.hidden = true;
  dom.confirmOverlay.hidden = true;
  document.body.classList.remove('overlay-open');
  state.confirmAction = null;
  state.lastFocus = null;
}

function trapFocus(event) {
  const overlay = [dom.resultOverlay, dom.helpOverlay, dom.confirmOverlay].find(
    (candidate) => !candidate.hidden
  );
  if (!overlay) return;

  const focusable = Array.from(
    overlay.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.offsetParent !== null);

  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function isTypingTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable]'));
}

function hasBlockingOverlay() {
  return Boolean(document.querySelector('.overlay.is-open'))
    || !dom.helpOverlay.hidden
    || !dom.resultOverlay.hidden
    || !dom.confirmOverlay.hidden;
}

function isVisible(selector) {
  const el = document.querySelector(selector);
  return Boolean(el && !el.hidden);
}

function panLegacyMapBy(dx, dy) {
  state.view = clampView({
    ...state.view,
    panX: state.view.panX + dx,
    panY: state.view.panY + dy,
  });
  applyView();
}

function bindGlobalEvents() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!dom.confirmOverlay.hidden) {
        state.confirmAction = null;
        closeOverlay(dom.confirmOverlay);
        return;
      }
      if (!dom.helpOverlay.hidden) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeOverlay(dom.helpOverlay);
        return;
      }
      if (!dom.resultOverlay.hidden) {
        closeOverlay(dom.resultOverlay);
        return;
      }
      if (state.screen === 'game') {
        askEndGame();
      } else if (state.screen === 'atlas') {
        goHome();
      }
      return;
    }

    if (event.key === 'Tab' && anyOverlayOpen()) {
      trapFocus(event);
    }

    const typing = isTypingTarget(event.target);
    const helpKey = event.key === '?'
      || (event.key === '/' && event.shiftKey)
      || (event.code === 'Slash' && event.shiftKey);
    if (helpKey && !event.repeat && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!dom.helpOverlay.hidden) closeOverlay(dom.helpOverlay);
      else if (!hasBlockingOverlay()) openHelp();
      return;
    }

    if (typing || hasBlockingOverlay() || event.ctrlKey || event.metaKey || event.altKey) return;

    const homeVisible = isVisible('#homeScreen');
    if (homeVisible && !event.repeat && /^[1-5]$/.test(event.key)) {
      const destinations = {
        1: '#homeScreen .mode-grid [data-classic-mode="test"]',
        2: '#homeScreen .mode-grid [data-classic-mode="distance"]',
        3: '#homeScreen .mode-grid [data-classic-mode="puzzle"]',
        4: '#homeScreen .mode-grid [data-editor-open]',
        5: '#atlasCardBtn',
      };
      const target = document.querySelector(destinations[event.key]);
      if (target) {
        event.preventDefault();
        target.click();
        return;
      }
    }

    if (isVisible('#atlasScreen') && event.key === '/') {
      event.preventDefault();
      dom.citySearch.focus();
      dom.citySearch.select();
      return;
    }

    if (state.screen === 'game' && isVisible('#gameScreen')) {
      const inControl = event.target.closest?.('button, a, input, select, textarea, [contenteditable]');
      if (!inControl) {
        if ((event.key === 'Enter' || event.key === ' ') && !dom.nextBtn.disabled) {
          event.preventDefault();
          dom.nextBtn.click();
          return;
        }
        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          dom.zoomIn.click();
          return;
        }
        if (event.key === '-') {
          event.preventDefault();
          dom.zoomOut.click();
          return;
        }
        if (event.key === '0') {
          event.preventDefault();
          dom.zoomReset.click();
          return;
        }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          const step = event.shiftKey ? 190 : 64;
          if (event.key === 'ArrowLeft') panLegacyMapBy(step, 0);
          else if (event.key === 'ArrowRight') panLegacyMapBy(-step, 0);
          else if (event.key === 'ArrowUp') panLegacyMapBy(0, step);
          else panLegacyMapBy(0, -step);
        }
      }
    }
  });
}

/* ------------------------------------------------------------------ */

function init() {
  const settings = loadSettings();
  state.level = settings.level;
  state.numQ = settings.numQ;
  state.showVuc = settings.showVuc;
  state.stats = loadStats();
  state.atlas.filtered = CITIES.slice();

  bindHomeEvents();
  bindAtlasEvents();
  bindGameEvents();
  bindOverlayEvents();
  bindMapEvents();
  bindGlobalEvents();

  syncHomeLevelUI();
  syncHomeNumUI();
  syncVucUI();
  renderProgress();
  renderHomeHint();
  renderAtlas();
  showScreen('home');
}

init();
