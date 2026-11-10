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

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const SVG_NS = 'http://www.w3.org/2000/svg';
const SETTINGS_KEY = 'trafSa.settings.v2';
const STATS_KEY = 'trafSa.stats.v2';
const OLD_SETTINGS_KEY = 'trafSa.settings.v1';
const MAX_ZOOM = 6;
const MIN_ZOOM = 1;
const TAP_MOVE_LIMIT = 8;
const QUIZ_HIT_PX = 22;
const PUZZLE_TOLERANCE_PX = 20;
const PUZZLE_MIN_TOLERANCE = 15;

const LEVEL_TARGETS = { 1: 3, 2: 5, 3: 7 }; // original defaultlevels numTargets
const MODE_META = {
  distance: { title: 'Traf sa!', short: 'Traf sa!' },
  quiz: { title: 'Vyskúšaj sa!', short: 'Vyskúšaj sa!' },
  puzzle: { title: 'Poskladaj!', short: 'Poskladaj!' },
};
const LEVEL_LABELS = { 1: 'Ľahká', 2: 'Stredná', 3: 'Ťažká' };

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
  qnum: $('#qnum'),
  questionText: $('#questionText'),
  nextBtn: $('#nextBtn'),
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

function syncVucUI() {
  if (dom.homeVucToggle) dom.homeVucToggle.checked = state.showVuc;
  if (dom.vucToggle) dom.vucToggle.setAttribute('aria-pressed', String(state.showVuc));

  const source = state.showVuc ? 'assets/slovakia-map-vuc.svg' : 'assets/slovakia-map.svg';
  if (dom.mapImg.getAttribute('src') !== source) dom.mapImg.src = source;
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
  if (name === 'game') requestAnimationFrame(() => layoutMap());
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
  requestAnimationFrame(() => dom.quickPlayBtn.focus({ preventScroll: true }));
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

function syncGameModeUI() {
  dom.gameScreen.classList.remove('mode-distance', 'mode-quiz', 'mode-puzzle');
  dom.gameScreen.classList.add(`mode-${state.mode}`);
  dom.gameScreen.setAttribute('aria-label', `Hra ${MODE_META[state.mode].title}`);
  dom.gameTitle.textContent = MODE_META[state.mode].title;

  const isDistance = state.mode === 'distance';
  dom.scoreDistanceRow.hidden = !isDistance;
  dom.scoreCountsRow.hidden = isDistance;
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
  showScreen('game');
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

  openOverlay(dom.resultOverlay, dom.playAgainBtn);
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
}

function updateProgress() {
  const total = state.targets.length || state.gameNumQ || 1;
  const current = state.final ? total : state.index + (state.answered ? 1 : 0);
  dom.progressFill.style.width = `${clamp((current / total) * 100, 0, 100)}%`;
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
  const maxPanX = Math.max(0, (displayWidth - viewport.width) / 2);
  const maxPanY = Math.max(0, (displayHeight - viewport.height) / 2);

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

function makeRedMarker(x, y) {
  const group = svgElement('g', { class: 'marker marker-guess' });
  group.dataset.x = x;
  group.dataset.y = y;

  const target = svgElement('g', { class: 'marker-target' }, group);
  svgElement('circle', { cx: 0, cy: 0, r: 10, fill: 'none', stroke: '#ffffff', 'stroke-width': 4 }, target);
  svgElement('circle', { cx: 0, cy: 0, r: 10, fill: 'none', stroke: '#1b1b1b', 'stroke-width': 1.5 }, target);
  svgElement('circle', { cx: 0, cy: 0, r: 5, fill: 'none', stroke: '#ffffff', 'stroke-width': 3.4 }, target);
  svgElement('circle', { cx: 0, cy: 0, r: 5, fill: 'none', stroke: '#1b1b1b', 'stroke-width': 1.3 }, target);

  const ticks = [
    [-13, 0, -10.5, 0],
    [10.5, 0, 13, 0],
    [0, -13, 0, -10.5],
    [0, 10.5, 0, 13],
  ];
  for (const [x1, y1, x2, y2] of ticks) {
    svgElement('line', { x1, y1, x2, y2, stroke: '#ffffff', 'stroke-width': 4, 'stroke-linecap': 'round' }, target);
    svgElement('line', { x1, y1, x2, y2, stroke: '#1b1b1b', 'stroke-width': 1.7, 'stroke-linecap': 'round' }, target);
  }

  svgElement('line', { x1: 0, y1: -2, x2: 0, y2: -34, stroke: '#ffffff', 'stroke-width': 4.6, 'stroke-linecap': 'round' }, group);
  svgElement('line', { x1: 0, y1: -2, x2: 0, y2: -34, stroke: '#2a2a2a', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, group);
  svgElement(
    'path',
    {
      d: 'M0 -34 C6 -35.5 13 -34 21 -30.5 C22.5 -27 22.5 -23 20.5 -19.5 C13 -21.5 6 -22 0 -20.5 Z',
      fill: 'url(#flagRed)',
      stroke: '#790000',
      'stroke-width': 1.1,
      'stroke-linejoin': 'round',
    },
    group
  );

  return group;
}

function makeGreenMarker(x, y, label) {
  const group = svgElement('g', { class: 'marker marker-correct' });
  group.dataset.x = x;
  group.dataset.y = y;

  const plate = svgElement('rect', {
    class: 'label-bg',
    x: -10,
    y: -11,
    width: 80,
    height: 22,
    rx: 2,
    fill: '#ffffff',
    stroke: '#8a8f98',
    'stroke-width': 1,
  }, group);

  svgElement('line', { x1: 0, y1: -1, x2: 0, y2: -34, stroke: '#ffffff', 'stroke-width': 4.6, 'stroke-linecap': 'round' }, group);
  svgElement('line', { x1: 0, y1: -1, x2: 0, y2: -34, stroke: '#2a2a2a', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, group);
  svgElement(
    'path',
    {
      d: 'M0 -34 C6 -35.5 13 -34 21 -30.5 C22.5 -27 22.5 -23 20.5 -19.5 C13 -21.5 6 -22 0 -20.5 Z',
      fill: 'url(#flagGreen)',
      stroke: '#0b4f00',
      'stroke-width': 1.1,
      'stroke-linejoin': 'round',
    },
    group
  );

  svgElement('rect', { x: -6, y: -6, width: 12, height: 12, fill: '#ffffff', stroke: '#111111', 'stroke-width': 1.5 }, group);
  svgElement('rect', { x: -2.5, y: -2.5, width: 5, height: 5, fill: '#111111' }, group);

  const text = svgElement(
    'text',
    {
      class: 'label-text',
      x: 11,
      y: 4,
      fill: '#111111',
      'font-family': 'Tahoma, Arial, sans-serif',
      'font-size': 11.5,
      'text-anchor': 'start',
    },
    group
  );
  text.textContent = label;

  return group;
}

function drawDistanceMarkers(guess, target) {
  clearMarkers();
  const green = makeGreenMarker(target.x, target.y, target.label);
  dom.markers.appendChild(green);
  sizeGreenLabel(green, target);
  const red = makeRedMarker(guess.x, guess.y);
  dom.markers.appendChild(red);
  state.markerGroups = [green, red];
  updateMarkerScale();
}

function sizeGreenLabel(group, target) {
  const text = group.querySelector('.label-text');
  const plate = group.querySelector('.label-bg');
  if (!text || !plate) return;
  const width = Math.max(
    12,
    text.getComputedTextLength ? text.getComputedTextLength() : target.label.length * 6.2
  );
  if (target.x > 800) {
    text.setAttribute('text-anchor', 'end');
    text.setAttribute('x', -11);
    plate.setAttribute('x', -(width + 17));
    plate.setAttribute('width', width + 27);
  } else {
    text.setAttribute('text-anchor', 'start');
    text.setAttribute('x', 11);
    plate.setAttribute('x', -10);
    plate.setAttribute('width', width + 27);
  }
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
  dom.endBtn.addEventListener('click', onEnd);
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
  if (event.target.closest('.zoom-controls')) return;
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

    if (travelled > TAP_MOVE_LIMIT) state.drag.moved = true;

    if (state.drag.moved && state.view.zoom > 1) {
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
  const numQ = Math.min(state.numQ, cities.length);
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

function bindGlobalEvents() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!dom.confirmOverlay.hidden) {
        state.confirmAction = null;
        closeOverlay(dom.confirmOverlay);
        return;
      }
      if (!dom.helpOverlay.hidden) {
        closeOverlay(dom.helpOverlay);
        return;
      }
      if (!dom.resultOverlay.hidden) {
        closeOverlay(dom.resultOverlay);
        finishReturn();
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
