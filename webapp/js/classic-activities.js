/* ------------------------------------------------------------------------- */
/* Editor máp 2 — original activities engine                                  */
/*                                                                           */
/* Vyskúšaj sa!, Traf sa! and Poskladaj! exactly as the original: the same    */
/* map data, test groups, difficulty levels, distributed targets, scoring     */
/* formulas, puzzle tolerance and configuration messages.                    */
/* ------------------------------------------------------------------------- */

import {
  classicData,
  childrenByTag,
  getNumberAttr,
  groupPools,
  htmlFromConfig,
  levelsForTest,
  nodeEntity,
  nodeLabel,
  testsForMap,
  visibleLabels,
} from './classic-data.js';
import { MapView } from './map-view.js';
import {
  $,
  announce,
  clamp,
  closeOverlay,
  confirmDialog,
  copyText,
  escapeHtml,
  formatClock,
  openOverlay,
  toast,
} from './classic-ui.js';

const SETUP_KEY = 'editorMap2.activitySetup.v2';

const MODES = {
  test: {
    key: 'test',
    titleKey: 'testTitle',
    listName: 'testMapList',
    fallbackTitle: 'Vyskúšaj sa!',
    defaultTitle: 'Vyskúšaj sa!',
    puzzle: false,
    description: 'Nájdi správnu značku na mape. Počet možností určuje zvolená obtiažnosť.',
  },
  distance: {
    key: 'distance',
    titleKey: 'distanceTitle',
    listName: 'distanceMapList',
    fallbackTitle: 'Traf sa!',
    defaultTitle: 'Traf sa!',
    puzzle: false,
    description: 'Klikni na mapu, kde si myslíš, že objekt leží. Čím bližšie, tým viac bodov.',
  },
  puzzle: {
    key: 'puzzle',
    titleKey: 'puzzleTitle',
    listName: 'puzzleMapList',
    fallbackTitle: 'Poskladaj!',
    defaultTitle: 'Poskladaj!',
    puzzle: true,
    description: 'Pretiahni objekt z prostriedku mapy na jeho skutočné miesto.',
  },
};

const SETUP = {
  mode: null,
  mapList: [],
  mapIndex: 0,
  testIndex: 0,
  levelIndex: 0,
  numQ: 3,
  mapDoc: null,
  pools: [],
  totalNodes: 0,
  levels: [],
  loadToken: 0,
};

const GAME = {
  active: false,
  mode: null,
  params: null,
  mapDef: null,
  mapDoc: null,
  mapView: null,
  mapEl: null,
  testEl: null,
  level: null,
  numQ: 3,
  numTargets: 3,
  startedAt: 0,
  elapsedMs: 0,
  clockId: null,
  questionIndex: 0,
  answered: false,
  finalShown: false,
  correct: 0,
  incorrect: 0,
  totalScore: 0,
  answers: [],
  testPools: [],
  testUsed: [],
  currentGroup: -1,
  candidates: [],
  targetNode: null,
  marks: [],
  distancePool: [],
  distanceSeq: [],
  puzzlePool: [],
  puzzleSeq: [],
  puzzleTarget: null,
  puzzleOrig: null,
  puzzlePrevious: null,
  lastResult: null,
  loadToken: 0,
};

const dom = {};

export async function initActivities() {
  cacheDom();
  bindSetupEvents();
  bindGameEvents();
  bindResultEvents();
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-classic-mode]');
    if (trigger) {
      event.preventDefault();
      openActivitySetup(trigger.dataset.classicMode);
    }
    const editorTrigger = event.target.closest('[data-editor-open]');
    if (editorTrigger) {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent('editor:open'));
    }
  });
}

function cacheDom() {
  dom.overlay = $('#activityOverlay');
  dom.title = $('#activityTitle');
  dom.subtitle = $('#activitySubtitle');
  dom.maps = $('#setupMaps');
  dom.testSelect = $('#setupTest');
  dom.levels = $('#setupLevels');
  dom.numInput = $('#setupNumQ');
  dom.numMinus = $('#setupNumMinus');
  dom.numPlus = $('#setupNumPlus');
  dom.numHint = $('#setupNumHint');
  dom.summary = $('#setupSummary');
  dom.start = $('#setupStart');
  dom.cancel = $('#setupCancel');
  dom.close = $('#setupClose');
  dom.classicScreen = $('#classicScreen');
  dom.titleGame = $('#classicGameTitle');
  dom.context = $('#classicContext');
  dom.gameMeta = $('#classicGameMeta');
  dom.homeBtn = $('#classicHomeBtn');
  dom.qnum = $('#classicQnum');
  dom.question = $('#classicQuestion');
  dom.next = $('#classicNextBtn');
  dom.end = $('#classicEndBtn');
  dom.progress = $('#classicProgressFill');
  dom.scoreDistance = $('#classicScoreDistanceRow');
  dom.scoreCounts = $('#classicScoreCountsRow');
  dom.scoreValue = $('#classicScoreValue');
  dom.correctValue = $('#classicCorrectValue');
  dom.wrongValue = $('#classicWrongValue');
  dom.timeValue = $('#classicTimeValue');
  dom.mapViewport = $('#classicMapHost');
  dom.mapViewportWrap = $('#classicMapViewport');
  dom.hint = $('#classicMapHint');
  dom.mapTag = $('#classicMapTag');
  dom.zoomIn = $('#classicZoomIn');
  dom.zoomOut = $('#classicZoomOut');
  dom.zoomFit = $('#classicZoomFit');
  dom.zoomValue = $('#classicZoomValue');
  dom.loading = $('#classicLoading');
  dom.loadingText = $('#classicLoadingText');
  dom.resultOverlay = $('#classicResultOverlay');
  dom.resultTitle = $('#classicResultTitle');
  dom.resultBadge = $('#classicResultBadge');
  dom.resultPercent = $('#classicResultPercent');
  dom.resultPrimary = $('#classicResultPrimary');
  dom.resultPrimaryLabel = $('#classicResultPrimaryLabel');
  dom.resultTime = $('#classicResultTime');
  dom.resultText = $('#classicResultText');
  dom.resultRows = $('#classicResultRows');
  dom.resultAgain = $('#classicResultAgain');
  dom.resultSetup = $('#classicResultSetup');
  dom.resultHome = $('#classicResultHome');
  dom.resultShare = $('#classicResultShare');
  dom.resultClose = $('#classicResultClose');
}

/* ------------------------------------------------------------------------- */
/* setup                                                                     */
/* ------------------------------------------------------------------------- */

export async function openActivitySetup(modeKey, preset = null) {
  const mode = MODES[modeKey];
  if (!mode) return;
  await classicData.init();
  SETUP.mode = modeKey;
  SETUP.mapList = childrenByTag(classicData.cfgEl(mode.listName), 'map');
  if (!SETUP.mapList.length) {
    toast('V konfigurácii sa nenašla žiadna mapa pre túto aktivitu.', 'error');
    return;
  }
  const saved = readSetup();
  SETUP.mapIndex = clamp(preset?.mapIndex ?? saved.mapIndex ?? 0, 0, SETUP.mapList.length - 1);
  SETUP.testIndex = preset?.testIndex ?? saved.testIndex ?? 0;
  SETUP.levelIndex = preset?.levelIndex ?? saved.levelIndex ?? 0;
  SETUP.numQ = preset?.numQ ?? saved.numQ ?? 3;

  dom.title.textContent = classicData.cfg(mode.titleKey) || mode.defaultTitle;
  dom.subtitle.textContent = mode.description;
  renderMapCards();
  await selectMap(SETUP.mapIndex, SETUP.testIndex, SETUP.levelIndex, SETUP.numQ);
  openOverlay(dom.overlay, dom.start);
}

export async function openActivityFromQuery(params = {}) {
  const mode = MODES[params.mode] ? params.mode : 'distance';
  await classicData.init();
  const list = childrenByTag(classicData.cfgEl(MODES[mode].listName), 'map');
  let mapIndex = Number.isFinite(Number(params.mapIndex)) ? Number(params.mapIndex) : 0;
  if (params.mapKey) {
    const found = list.findIndex((el) => classicData.keyForConfigMap(el) === params.mapKey);
    if (found >= 0) mapIndex = found;
  }
  const preset = {
    mapIndex: clamp(mapIndex, 0, Math.max(0, list.length - 1)),
    testIndex: Number(params.testIndex) || 0,
    levelIndex: Number(params.levelIndex) || 0,
    numQ: Number(params.numQ) || 3,
  };
  if (params.autostart) {
    await startActivityGame({
      mode,
      mapIndex: preset.mapIndex,
      testIndex: preset.testIndex,
      levelIndex: preset.levelIndex,
      numQ: preset.numQ,
    });
  } else {
    await openActivitySetup(mode, preset);
  }
}

function readSetup() {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSetup() {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify({
      mapIndex: SETUP.mapIndex,
      testIndex: SETUP.testIndex,
      levelIndex: SETUP.levelIndex,
      numQ: SETUP.numQ,
    }));
  } catch {}
}

function renderMapCards() {
  const mode = MODES[SETUP.mode];
  dom.maps.replaceChildren();
  SETUP.mapList.forEach((mapEl, index) => {
    const key = classicData.keyForConfigMap(mapEl);
    const def = classicData.mapDef(key);
    if (!def) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'setup-map-card';
    button.dataset.mapIndex = String(index);
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', index === SETUP.mapIndex ? 'true' : 'false');
    if (index === SETUP.mapIndex) button.classList.add('is-selected');
    button.innerHTML = `
      <span class="setup-map-thumb"><img src="${def.thumb}" alt="" loading="lazy"></span>
      <span class="setup-map-copy">
        <strong>${escapeLabel(displayMapLabel(mapEl, def))}</strong>
        <span>${def.entities} objektov</span>
      </span>`;
    button.addEventListener('click', () => {
      if (SETUP.mapIndex === index) return;
      SETUP.mapIndex = index;
      SETUP.testIndex = 0;
      SETUP.levelIndex = 0;
      renderMapCards();
      selectMap(index, 0, 0, SETUP.numQ);
    });
    dom.maps.append(button);
  });
  const active = dom.maps.querySelector('.setup-map-card.is-selected');
  if (active) setTimeout(() => active.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 20);
  if (mode.puzzle) dom.maps.dataset.puzzle = 'true';
}

async function selectMap(mapIndex, preferredTest = 0, preferredLevel = 0, preferredNumQ = 3) {
  const mapEl = SETUP.mapList[mapIndex];
  if (!mapEl) return;
  const key = classicData.keyForConfigMap(mapEl);
  const mode = MODES[SETUP.mode];
  const token = ++SETUP.loadToken;
  dom.testSelect.disabled = true;
  dom.start.disabled = true;
  dom.summary.textContent = 'Načítavam mapu…';
  try {
    const doc = await classicData.getMefDocument(key);
    if (token !== SETUP.loadToken) return;
    SETUP.mapDoc = doc;
    const tests = testsForMap(mapEl);
    dom.testSelect.replaceChildren();
    tests.forEach((test, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = escapeLabel(test.getAttribute('label') || `Test ${index + 1}`);
      dom.testSelect.append(option);
    });
    SETUP.testIndex = clamp(preferredTest, 0, Math.max(0, tests.length - 1));
    dom.testSelect.value = String(SETUP.testIndex);
    dom.testSelect.disabled = tests.length < 2;
    SETUP.levelIndex = preferredLevel;
    SETUP.numQ = preferredNumQ;
    rebuildLevels(true);
    updateSetupSummary();
  } catch (error) {
    console.error(error);
    dom.summary.textContent = 'Mapu sa nepodarilo načítať.';
    toast('Mapu sa nepodarilo načítať.', 'error');
    dom.start.disabled = true;
  }
}

function rebuildLevels(preserve = false) {
  const mode = MODES[SETUP.mode];
  const testEl = testsForMap(SETUP.mapList[SETUP.mapIndex])[SETUP.testIndex];
  if (!testEl) {
    SETUP.levels = [];
    dom.levels.replaceChildren();
    return;
  }
  const oldIndex = SETUP.levelIndex;
  SETUP.levels = levelsForTest(testEl);
  SETUP.levelIndex = preserve
    ? clamp(oldIndex, 0, SETUP.levels.length - 1)
    : 0;
  dom.levels.replaceChildren();
  SETUP.levels.forEach((level, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'seg-btn setup-level';
    button.dataset.levelIndex = String(index);
    button.setAttribute('aria-pressed', index === SETUP.levelIndex ? 'true' : 'false');
    button.innerHTML = `<span class="seg-name">${escapeLabel(level.label)}</span><span class="seg-count">${mode.key === 'test' ? `${level.numTargets} možností` : `testLevel ≤ ${level.maxLevel}`}</span>`;
    button.addEventListener('click', () => {
      SETUP.levelIndex = index;
      rebuildLevels(true);
      updateSetupSummary();
    });
    dom.levels.append(button);
  });
  // Recompute pools with the selected level.
  const level = SETUP.levels[SETUP.levelIndex] || { maxLevel: 3, numTargets: 3 };
  SETUP.pools = groupPools(SETUP.mapDoc, testEl, level.maxLevel, { puzzle: mode.puzzle });
  SETUP.totalNodes = SETUP.pools.reduce((sum, group) => sum + group.nodes.length, 0);
}

function updateSetupSummary() {
  const mapEl = SETUP.mapList[SETUP.mapIndex];
  const tests = testsForMap(mapEl);
  const testEl = tests[SETUP.testIndex];
  if (!testEl) {
    dom.start.disabled = true;
    return;
  }
  const mode = MODES[SETUP.mode];
  const level = SETUP.levels[SETUP.levelIndex] || { maxLevel: 3, numTargets: 3 };
  SETUP.pools = groupPools(SETUP.mapDoc, testEl, level.maxLevel, { puzzle: mode.puzzle });
  SETUP.totalNodes = SETUP.pools.reduce((sum, group) => sum + group.nodes.length, 0);
  const maxQ = Math.max(1, SETUP.totalNodes);
  SETUP.numQ = clamp(SETUP.numQ || 3, 1, maxQ);
  dom.numInput.value = String(SETUP.numQ);
  dom.numInput.max = String(maxQ);
  dom.numInput.disabled = maxQ < 2;
  dom.numMinus.disabled = SETUP.numQ <= 1;
  dom.numPlus.disabled = SETUP.numQ >= maxQ;

  const activeLevels = Math.max(0, SETUP.pools.filter((p) => p.nodes.length).length);
  const empty = SETUP.pools.filter((p) => !p.nodes.length).map((p) => p.label);
  const targetText = mode.key === 'test'
    ? `V každej otázke ${level.numTargets} možností.`
    : mode.key === 'distance'
      ? 'Skóre podľa vzdialenosti od správneho bodu.'
      : 'Tolerancia uloženia je 15 mapových jednotiek.';
  const noun = mode.key === 'puzzle'
    ? pluralSk(SETUP.totalNodes, 'objekt', 'objekty', 'objektov')
    : pluralSk(SETUP.totalNodes, 'otázka', 'otázky', 'otázok');
  const groupNoun = pluralSk(activeLevels, 'testovacia skupina', 'testovacie skupiny', 'testovacích skupín');
  dom.summary.innerHTML = `
    <p class="setup-summary-main"><b>${SETUP.totalNodes}</b> dostupných ${noun} · <b>${activeLevels}</b> ${groupNoun}</p>
    <p class="setup-summary-sub">${targetText}${empty.length ? ` Prázdne skupiny sa preskočia (${empty.map(escapeLabel).join(', ')}).` : ''}</p>`;
  dom.start.disabled = SETUP.totalNodes === 0;

  const levelButtons = dom.levels.querySelectorAll('.setup-level');
  levelButtons.forEach((button, index) => {
    const active = index === SETUP.levelIndex;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function bindSetupEvents() {
  dom.maps.addEventListener('click', () => {});
  dom.testSelect.addEventListener('change', () => {
    SETUP.testIndex = Number(dom.testSelect.value) || 0;
    rebuildLevels(false);
    updateSetupSummary();
  });
  dom.numMinus.addEventListener('click', () => changeNumQ(-1));
  dom.numPlus.addEventListener('click', () => changeNumQ(1));
  dom.numInput.addEventListener('input', () => {
    dom.numInput.value = dom.numInput.value.replace(/[^\d]/g, '').slice(0, 3);
  });
  dom.numInput.addEventListener('change', () => {
    const parsed = Number.parseInt(dom.numInput.value, 10);
    SETUP.numQ = Number.isFinite(parsed) ? parsed : SETUP.numQ;
    updateSetupSummary();
  });
  dom.start.addEventListener('click', () => {
    if (dom.start.disabled) return;
    dom.start.disabled = true;
    const mode = SETUP.mode;
    const params = {
      mode,
      mapIndex: SETUP.mapIndex,
      testIndex: SETUP.testIndex,
      levelIndex: SETUP.levelIndex,
      numQ: Math.min(SETUP.numQ, Math.max(1, SETUP.totalNodes)),
    };
    saveSetup();
    closeOverlay(dom.overlay);
    startActivityGame(params);
  });
  [dom.cancel, dom.close].forEach((button) => button?.addEventListener('click', () => closeOverlay(dom.overlay)));
  dom.overlay.addEventListener('click', (event) => {
    if (event.target === dom.overlay) closeOverlay(dom.overlay);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.querySelector('#classicConfirmOverlay.is-open, #classicPromptOverlay.is-open')) return;
    if (!dom.overlay.hidden) closeOverlay(dom.overlay);
    if (!dom.resultOverlay?.hidden) closeOverlay(dom.resultOverlay);
  });
}

function changeNumQ(delta) {
  const max = Math.max(1, SETUP.totalNodes);
  SETUP.numQ = clamp((SETUP.numQ || 1) + delta, 1, max);
  updateSetupSummary();
}

/* ------------------------------------------------------------------------- */
/* game start / screen                                                       */
/* ------------------------------------------------------------------------- */

export async function startActivityGame(params) {
  const mode = MODES[params.mode];
  if (!mode) return;
  const loadToken = ++GAME.loadToken;
  await classicData.init();
  const list = childrenByTag(classicData.cfgEl(mode.listName), 'map');
  let mapEl = null;
  if (params.mapKey) {
    mapEl = list.find((el) => classicData.keyForConfigMap(el) === params.mapKey) || null;
  }
  if (!mapEl) mapEl = list[params.mapIndex] || list[0];
  const tests = testsForMap(mapEl);
  const testEl = tests[params.testIndex] || tests[0];
  if (!mapEl || !testEl) {
    toast('Výzvu sa nepodarilo spustiť.', 'error');
    return;
  }
  const mapKey = classicData.keyForConfigMap(mapEl);
  const mapDef = classicData.mapDef(mapKey);
  const levels = levelsForTest(testEl);
  const level = levels[clamp(params.levelIndex, 0, levels.length - 1)] || { maxLevel: 3, numTargets: 3, label: 'stredná' };

  GAME.active = false;
  GAME.mode = params.mode;
  GAME.params = { ...params };
  GAME.params.mapIndex = list.indexOf(mapEl);
  GAME.params.mapKey = mapKey;
  GAME.params.testIndex = tests.indexOf(testEl);
  GAME.mapDef = mapDef;
  GAME.mapEl = mapEl;
  GAME.testEl = testEl;
  GAME.level = level;
  GAME.numTargets = level.numTargets;
  GAME.numQ = Math.max(1, params.numQ);
  GAME.answers = [];
  GAME.correct = 0;
  GAME.incorrect = 0;
  GAME.totalScore = 0;
  GAME.questionIndex = 0;
  GAME.answered = false;
  GAME.finalShown = false;
  GAME.currentGroup = -1;
  GAME.candidates = [];
  GAME.testPools = [];
  GAME.testUsed = [];
  GAME.distancePool = [];
  GAME.distanceSeq = [];
  GAME.puzzlePool = [];
  GAME.puzzleSeq = [];
  GAME.puzzleTarget = null;
  GAME.puzzlePrevious = null;
  GAME.lastResult = null;
  GAME.marks = [];

  showClassicScreen();
  setLoading(true, 'Načítavam mapu…');
  dom.titleGame.textContent = classicData.cfg(mode.titleKey) || mode.fallbackTitle;
  if (dom.gameMeta) dom.gameMeta.textContent = dom.titleGame.textContent;
  dom.context.textContent = `${displayMapLabel(mapEl, mapDef)} · ${testEl.getAttribute('label') || ''}`;
  dom.mapTag.textContent = `${displayMapLabel(mapEl, mapDef)} · ${level.label}`;
  dom.qnum.textContent = '';
  dom.question.textContent = '';
  dom.next.disabled = true;
  dom.next.hidden = false;
  dom.end.hidden = false;
  dom.progress.style.width = '0%';
  dom.scoreValue.textContent = '000';
  dom.correctValue.textContent = '0';
  dom.wrongValue.textContent = '0';
  dom.timeValue.textContent = '00:00';
  dom.scoreDistance.hidden = params.mode !== 'distance';
  dom.scoreCounts.hidden = params.mode === 'distance';
  dom.hint.textContent = params.mode === 'distance'
    ? 'Klikni na mapu'
    : params.mode === 'puzzle'
      ? 'Potiahni žltý objekt na správne miesto'
      : 'Klikni na správnu značku';
  dom.zoomValue.textContent = '100%';

  try {
    const [doc, scene] = await Promise.all([
      classicData.getMefDocument(mapKey),
      classicData.getSceneText(mapKey),
    ]);
    if (loadToken !== GAME.loadToken) return;
    GAME.mapDoc = doc;

    if (GAME.mapView) GAME.mapView.destroy();
    GAME.mapView = new MapView(dom.mapViewport, {
      interaction: params.mode === 'distance' ? 'click' : 'pan',
      paddingX: 24,
      paddingY: 24,
      onZoom: () => {
        dom.zoomValue.textContent = `${GAME.mapView ? GAME.mapView.percent() : 100}%`;
      },
    });
    GAME.mapView.setMarksVisible(true);
    await GAME.mapView.load(mapDef, doc, scene);
    if (loadToken !== GAME.loadToken) {
      GAME.mapView?.destroy();
      GAME.mapView = null;
      return;
    }
    requestAnimationFrame(() => GAME.mapView.layout());

    const baseLabels = visibleLabels(mapEl, testEl, null);
    if (params.mode === 'test') {
      prepareTest();
      GAME.mapView.showBaseLayers(baseLabels);
      GAME.active = true;
      startClock();
      nextTestQuestion();
    } else if (params.mode === 'distance') {
      prepareDistance();
      GAME.mapView.showBaseLayers(baseLabels);
      GAME.active = true;
      startClock();
      nextDistanceQuestion();
    } else {
      preparePuzzle();
      GAME.mapView.showBaseLayers(baseLabels);
      GAME.active = true;
      startClock();
      nextPuzzleQuestion();
    }
    GAME.mapView.interaction = params.mode === 'distance' ? 'click' : 'pan';
    // For test/puzzle the pointer is used for zooming/panning; the distance
    // mode receives clean map clicks.
    GAME.mapView.mapClickHandler = params.mode === 'distance' ? onDistanceClick : null;
    if (loadToken === GAME.loadToken) setLoading(false);
  } catch (error) {
    console.error(error);
    if (loadToken !== GAME.loadToken) return;
    setLoading(false);
    toast(`Mapu sa nepodarilo načítať: ${error.message}`, 'error');
    GAME.active = false;
  }
}

function showClassicScreen() {
  $('#homeScreen').hidden = true;
  $('#atlasScreen').hidden = true;
  $('#gameScreen').hidden = true;
  const editor = $('#editorScreen');
  if (editor) editor.hidden = true;
  dom.classicScreen.hidden = false;
  document.body.classList.remove('game-active');
  document.body.classList.add('classic-active');
  dom.classicScreen.focus?.();
  window.scrollTo({ top: 0 });
}

function setLoading(visible, text = 'Načítavam…') {
  if (!dom.loading) return;
  if (text) dom.loadingText.textContent = text;
  dom.loading.hidden = !visible;
}

/* ------------------------------------------------------------------------- */
/* clock / score                                                             */
/* ------------------------------------------------------------------------- */

function startClock() {
  stopClock();
  GAME.startedAt = performance.now();
  GAME.elapsedMs = 0;
  const tick = () => {
    GAME.elapsedMs = performance.now() - GAME.startedAt;
    dom.timeValue.textContent = formatClock(GAME.elapsedMs / 1000);
  };
  tick();
  GAME.clockId = setInterval(tick, 220);
}

function stopClock() {
  if (GAME.clockId) clearInterval(GAME.clockId);
  GAME.clockId = null;
  if (GAME.startedAt) GAME.elapsedMs = performance.now() - GAME.startedAt;
}

function timeText() {
  return formatClock(GAME.elapsedMs / 1000);
}

function updateScore() {
  if (GAME.mode === 'distance') {
    dom.scoreValue.textContent = String(GAME.totalScore).padStart(3, '0');
  } else {
    dom.correctValue.textContent = String(GAME.correct);
    dom.wrongValue.textContent = String(GAME.incorrect);
  }
  dom.timeValue.textContent = timeText();
}

function setQuestionHtml(html) {
  dom.question.innerHTML = html;
}

function setQuestionNumber(number) {
  if (!number) {
    dom.qnum.textContent = '';
    return;
  }
  dom.qnum.innerHTML = `Otázka č.<b>${number}</b>:`;
}

function updateProgress() {
  const done = Math.min(GAME.questionIndex, GAME.numQ);
  const pct = GAME.numQ ? (done - (GAME.answered ? 0 : 1)) / GAME.numQ : 0;
  dom.progress.style.width = `${clamp(pct * 100, 0, 100)}%`;
}

/* ------------------------------------------------------------------------- */
/* Vyskúšaj sa!                                                              */
/* ------------------------------------------------------------------------- */

function prepareTest() {
  const pools = groupPools(GAME.mapDoc, GAME.testEl, GAME.level.maxLevel, { puzzle: false });
  GAME.testPools = pools
    .filter((pool) => pool.nodes.length > 0)
    .map((pool) => ({
      ...pool,
      used: new Set(),
    }));
  const total = GAME.testPools.reduce((sum, pool) => sum + pool.nodes.length, 0);
  GAME.numQ = Math.min(GAME.numQ, Math.max(1, total));
}

function nextTestQuestion() {
  if (!GAME.active) return;
  GAME.answered = false;
  GAME.finalShown = false;
  GAME.questionIndex += 1;
  clearMarks();
  hideCandidates();
  GAME.candidates = [];

  const group = nextTestGroup();
  if (!group) {
    showTestFinal();
    return;
  }
  GAME.currentGroup = group.index;
  const pool = group.pool;
  const unused = pool.nodes.filter((node) => !pool.used.has(node));
  const chosen = unused[Math.floor(Math.random() * unused.length)];
  pool.used.add(chosen);
  GAME.targetNode = chosen;
  const otherNodes = shuffle(pool.nodes.filter((node) => node !== chosen)).slice(0, Math.max(0, GAME.numTargets - 1));
  GAME.candidates = [chosen, ...otherNodes];

  const groupLabels = visibleLabels(GAME.mapEl, GAME.testEl, group.configGroup);
  GAME.mapView.showBaseLayers(groupLabels);

  setQuestionNumber(GAME.questionIndex);
  const questionType = questionTypeOf(group.configGroup);
  setQuestionHtml(htmlFromConfig(classicData.cfg('testQuestion'), {
    ENTITYTYPE: escapeHtml(typeWithSpace(questionType)),
    ENTITYNAME: escapeHtml(nodeLabel(chosen)),
  }));

  for (const node of GAME.candidates) {
    GAME.mapView.setEntityVisible(nodeEntity(node), true);
    const mark = GAME.mapView.addMark({
      x: getNumberAttr(node, 'markX'),
      y: getNumberAttr(node, 'markY'),
      label: node.getAttribute('markLabel') || nodeLabel(node),
      symbol: node.getAttribute('markSymbol') || 'default',
      labelVisible: false,
      state: 'ask',
      meta: { node },
      onClick: () => answerTestQuestion(node),
    });
    GAME.marks.push(mark);
  }
  updateScore();
  updateProgress();
  dom.next.disabled = true;
  announce(`Otázka ${GAME.questionIndex}: ${nodeLabel(chosen)}`);
}

function nextTestGroup() {
  if (!GAME.testPools.length) return null;
  for (let guard = 0; guard < GAME.testPools.length * 4; guard += 1) {
    GAME.currentGroup += 1;
    if (GAME.currentGroup >= GAME.testPools.length) GAME.currentGroup = 0;
    const pool = GAME.testPools[GAME.currentGroup];
    if (pool.nodes.some((node) => !pool.used.has(node))) {
      const configGroup = childrenByTag(GAME.testEl, 'group').find((g) => g.getAttribute('label') === pool.label)
        || childrenByTag(GAME.testEl, 'group')[0];
      return { index: GAME.currentGroup, pool, configGroup };
    }
  }
  return null;
}

function answerTestQuestion(clickedNode) {
  if (!GAME.active || GAME.answered) return;
  GAME.answered = true;
  const correct = clickedNode === GAME.targetNode;
  for (const mark of GAME.marks) {
    if (mark.meta.node === GAME.targetNode) {
      GAME.mapView.updateMark(mark, { state: 'correct', labelVisible: true });
    } else if (mark.meta.node === clickedNode && !correct) {
      GAME.mapView.updateMark(mark, { state: 'incorrect', labelVisible: true });
    } else {
      GAME.mapView.updateMark(mark, { state: 'ask', labelVisible: false });
    }
  }
  if (correct) {
    GAME.correct += 1;
    setQuestionHtml(classicData.cfg('correctTestAnswer'));
  } else {
    GAME.incorrect += 1;
    setQuestionHtml(classicData.cfg('incorrectTestAnswer'));
  }
  GAME.answers.push({
    label: nodeLabel(GAME.targetNode),
    picked: nodeLabel(clickedNode),
    correct,
    points: correct ? 1 : 0,
  });
  updateScore();
  updateProgress();
  dom.next.disabled = false;
  const isLast = GAME.questionIndex >= GAME.numQ;
  const suffix = isLast ? classicData.cfg('lastTestQuestion') : classicData.cfg('nextTestQuestion');
  dom.question.innerHTML += ` ${suffix}`;
  if (isLast) stopClock();
  announce(correct ? 'Správne.' : `Nesprávne. Správna odpoveď je ${nodeLabel(GAME.targetNode)}.`);
}

function hideCandidates() {
  for (const node of GAME.candidates) {
    GAME.mapView?.setEntityVisible(nodeEntity(node), false);
  }
  clearMarks();
}

function clearMarks() {
  if (!GAME.mapView) return;
  for (const mark of GAME.marks) GAME.mapView.removeMark(mark);
  GAME.marks = [];
}

function showTestFinal() {
  GAME.finalShown = true;
  GAME.active = false;
  stopClock();
  // The original leaves the last question's marks and shapes on screen.
  setQuestionNumber(0);
  const percent = Math.round((GAME.correct / GAME.numQ) * 100);
  setQuestionHtml(htmlFromConfig(classicData.cfg('testFinalScore'), {
    CORRECTQ: spaced(GAME.correct),
    TOTALQ: spaced(GAME.numQ),
    TOTALTIME: spaced(timeText()),
    PERCENT: spaced(percent),
  }));
  dom.next.disabled = true;
  dom.progress.style.width = '100%';
  showResult({
    title: 'Vyskúšaj sa! — výsledok',
    percent,
    primaryValue: `${GAME.correct}/${GAME.numQ}`,
    primaryLabel: 'správne',
    time: timeText(),
    finalHtml: dom.question.innerHTML,
    rows: GAME.answers.map((row) => [
      row.label,
      row.correct ? '✓' : `✕ (${row.picked})`,
      row.correct ? '1' : '0',
    ]),
    columns: ['Objekt', 'Odpoveď', 'Body'],
  });
}

/* ------------------------------------------------------------------------- */
/* Traf sa!                                                                  */
/* ------------------------------------------------------------------------- */

function prepareDistance() {
  const pools = groupPools(GAME.mapDoc, GAME.testEl, GAME.level.maxLevel, { puzzle: false });
  GAME.distancePool = pools.flatMap((pool) => pool.nodes);
  const total = GAME.distancePool.length;
  GAME.numQ = Math.min(GAME.numQ, Math.max(1, total));
  GAME.distanceSeq = shuffle([...GAME.distancePool.keys()]).slice(0, GAME.numQ);
  GAME.mapView.interaction = 'click';
  GAME.mapView.mapClickHandler = onDistanceClick;
}

function nextDistanceQuestion() {
  if (!GAME.active) return;
  GAME.answered = false;
  GAME.finalShown = false;
  GAME.questionIndex += 1;
  clearMarks();
  const targetIndex = GAME.distanceSeq[GAME.questionIndex - 1];
  const target = GAME.distancePool[targetIndex];
  GAME.targetNode = target;
  setQuestionNumber(GAME.questionIndex);
  const type = questionTypeOf(GAME.testEl);
  setQuestionHtml(htmlFromConfig(classicData.cfg('distanceQuestion'), {
    ENTITYTYPE: escapeHtml(typeWithSpace(type)),
    ENTITYNAME: escapeHtml(nodeLabel(target)),
  }));
  updateScore();
  updateProgress();
  dom.next.disabled = true;
  GAME.mapView.options.onMapClick = onDistanceClick;
  announce(`Otázka ${GAME.questionIndex}: ${nodeLabel(target)}`);
}

function onDistanceClick(point) {
  if (!GAME.active || GAME.answered || GAME.mode !== 'distance') return;
  GAME.answered = true;
  const target = GAME.targetNode;
  const targetX = getNumberAttr(target, 'markX');
  const targetY = getNumberAttr(target, 'markY');
  const dist = Math.hypot(targetX - point.x, targetY - point.y);
  const maxDist = Math.hypot(GAME.mapView.W, GAME.mapView.H);
  let score = Math.round(((maxDist - 3 * dist) / maxDist) * 100);
  if (score < 5) score = 0;
  GAME.totalScore += score;

  GAME.mapView.addMark({
    x: point.x,
    y: point.y,
    label: 'Tvoj tip',
    symbol: 'town',
    state: 'incorrect',
    labelVisible: false,
  });
  GAME.mapView.addMark({
    x: targetX,
    y: targetY,
    label: target.getAttribute('markLabel') || nodeLabel(target),
    symbol: target.getAttribute('markSymbol') || 'default',
    state: 'correct',
    labelVisible: true,
  });

  const answer = distanceAnswerFor(score);
  setQuestionHtml(answer.html.replace('SCORE', String(answer.score)));
  const isLast = GAME.questionIndex >= GAME.numQ;
  const suffix = isLast ? classicData.cfg('nextTestQuestion') : classicData.cfg('nextTestQuestion');
  // The original uses nextTestQuestion / lastTestQuestion for the distance test.
  dom.question.innerHTML += ` ${isLast ? classicData.cfg('lastTestQuestion') : suffix}`;
  GAME.answers.push({
    label: nodeLabel(target),
    correct: score > 0,
    points: score,
    distance: Math.round(dist),
  });
  updateScore();
  updateProgress();
  dom.next.disabled = false;
  if (isLast) stopClock();
  announce(`Získal si ${score} bodov. Správna poloha je označená.`);
}

function distanceAnswerFor(score) {
  const root = classicData.config?.documentElement;
  const answers = root ? Array.from(root.getElementsByTagName('distanceAnswer')) : [];
  for (const el of answers) {
    const min = Number.parseFloat(el.getAttribute('min') ?? '0');
    const max = Number.parseFloat(el.getAttribute('max') ?? '0');
    if (score >= min && score <= max) {
      return { html: htmlFromConfig(el.innerHTML, { SCORE: spaced(score) }), score };
    }
  }
  return { html: `Získal si <b>${score}</b> bodov.`, score };
}

function showDistanceFinal() {
  GAME.finalShown = true;
  GAME.active = false;
  stopClock();
  // Keep the final guess and correct position visible for review.
  setQuestionNumber(0);
  const percent = Math.round(GAME.totalScore / GAME.numQ);
  setQuestionHtml(htmlFromConfig(classicData.cfg('distanceFinalScore'), {
    TOTALSCORE: spaced(GAME.totalScore),
    TOTALTIME: spaced(timeText()),
    PERCENT: spaced(percent),
  }));
  dom.next.disabled = true;
  dom.progress.style.width = '100%';
  showResult({
    title: 'Traf sa! — výsledok',
    percent,
    primaryValue: `${GAME.totalScore}`,
    primaryLabel: 'bodov',
    time: timeText(),
    finalHtml: dom.question.innerHTML,
    rows: GAME.answers.map((row) => [
      row.label,
      `${row.distance} j.`,
      String(row.points),
    ]),
    columns: ['Objekt', 'Vzdialenosť', 'Body'],
  });
}

/* ------------------------------------------------------------------------- */
/* Poskladaj!                                                                */
/* ------------------------------------------------------------------------- */

function preparePuzzle() {
  const pools = groupPools(GAME.mapDoc, GAME.testEl, GAME.level.maxLevel, { puzzle: true });
  GAME.puzzlePool = pools.flatMap((pool) => pool.nodes);
  const total = GAME.puzzlePool.length;
  GAME.numQ = Math.min(GAME.numQ, Math.max(1, total));
  GAME.puzzleSeq = shuffle([...GAME.puzzlePool.keys()]).slice(0, GAME.numQ);
  GAME.mapView.interaction = 'pan';
}

function nextPuzzleQuestion() {
  if (!GAME.active) return;
  GAME.answered = false;
  GAME.finalShown = false;
  GAME.questionIndex += 1;
  removePuzzleHandle();
  clearMarks();

  if (GAME.puzzlePrevious && GAME.puzzlePrevious.wasIncorrect) {
    GAME.mapView.setEntityColor(GAME.puzzlePrevious.entity, '#ff7777');
  }
  GAME.puzzlePrevious = null;

  const target = GAME.puzzlePool[GAME.puzzleSeq[GAME.questionIndex - 1]];
  GAME.targetNode = target;
  const entity = nodeEntity(target);
  GAME.mapView.setEntityVisible(entity, true);
  GAME.mapView.setEntityColor(entity, '#ffff00');
  const original = GAME.mapView.entityPosition(entity);
  GAME.puzzleOrig = { x: original.x, y: original.y };
  const el = GAME.mapView.entityElement(entity);
  GAME.puzzleTarget = { name: entity, el, original, nextSibling: el?.nextSibling || null, parent: el?.parentElement || null };
  GAME.mapView.centerEntity(entity);

  setQuestionNumber(GAME.questionIndex);
  const type = questionTypeOf(GAME.testEl);
  setQuestionHtml(htmlFromConfig(classicData.cfg('puzzleQuestion'), {
    ENTITYTYPE: escapeHtml(typeWithSpace(type)),
    ENTITYNAME: escapeHtml(nodeLabel(target)),
  }));
  updateScore();
  updateProgress();
  dom.next.disabled = true;
  createPuzzleHandle(entity, target);
  announce(`Otázka ${GAME.questionIndex}: ${nodeLabel(target)}`);
}

function createPuzzleHandle(entityName, targetNode) {
  removePuzzleHandle();
  const bbox = GAME.mapView.entityBBox(entityName);
  if (!bbox) return;
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const scale = Math.max(0.01, GAME.mapView.effectiveScale());
  // Keep the grab target at least ~30 screen pixels wide on phones.
  const radius = Math.max(26 / scale, Math.min(90, Math.hypot(bbox.width, bbox.height) / 2 + 10));
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.classList.add('puzzle-handle');
  g.setAttribute('aria-hidden', 'true');
  const circle = document.createElementNS(ns, 'circle');
  circle.setAttribute('cx', cx);
  circle.setAttribute('cy', cy);
  circle.setAttribute('r', String(radius));
  circle.setAttribute('fill', 'rgba(250, 204, 21, 0.01)');
  circle.setAttribute('stroke', 'rgba(202, 138, 4, 0)');
  circle.setAttribute('stroke-width', '1.5');
  circle.setAttribute('stroke-dasharray', '5 4');
  circle.style.pointerEvents = 'all';
  circle.style.cursor = 'grab';
  g.append(circle);
  GAME.mapView.overlay.append(g);
  GAME.puzzleHandle = g;
  GAME.puzzleHandleCircle = circle;

  const entityEl = GAME.mapView.entityElement(entityName);
  const previousCursor = entityEl ? entityEl.style.cursor : '';
  if (entityEl) {
    entityEl.style.cursor = 'grab';
  }
  const rollOver = () => {
    if (GAME.active && !GAME.answered) GAME.mapView.setEntityColor(entityName, '#ffbb77');
  };
  const rollOut = () => {
    if (GAME.active && !GAME.answered) GAME.mapView.setEntityColor(entityName, '#ffff00');
  };
  if (entityEl) {
    entityEl.addEventListener('pointerenter', rollOver);
    entityEl.addEventListener('pointerleave', rollOut);
  }
  circle.addEventListener('pointerenter', rollOver);
  circle.addEventListener('pointerleave', rollOut);

  let drag = null;
  const move = (event) => {
    if (!drag) return;
    event.preventDefault();
    const pt = GAME.mapView.toMapPoint(event.clientX, event.clientY);
    GAME.mapView.setEntityTranslation(entityName, drag.origX + pt.x - drag.startX, drag.origY + pt.y - drag.startY);
    const newBox = GAME.mapView.entityBBox(entityName);
    if (newBox) {
      circle.setAttribute('cx', newBox.x + newBox.width / 2);
      circle.setAttribute('cy', newBox.y + newBox.height / 2);
    }
  };
  const cleanup = () => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', finish, true);
    window.removeEventListener('pointercancel', finish, true);
    if (entityEl) {
      entityEl.removeEventListener('pointerdown', start, true);
      entityEl.removeEventListener('pointerenter', rollOver);
      entityEl.removeEventListener('pointerleave', rollOut);
      entityEl.style.cursor = previousCursor;
    }
    circle.removeEventListener('pointerenter', rollOver);
    circle.removeEventListener('pointerleave', rollOut);
    drag = null;
  };
  const finish = (event) => {
    if (!drag) return;
    event.preventDefault();
    cleanup();
    circle.style.cursor = 'grab';
    circle.style.stroke = 'rgba(202, 138, 4, 0)';
    answerPuzzle(targetNode);
  };
  const start = (event) => {
    if (!GAME.active || GAME.answered) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const pt = GAME.mapView.toMapPoint(event.clientX, event.clientY);
    drag = {
      startX: pt.x,
      startY: pt.y,
      origX: GAME.mapView.entityPosition(entityName).x,
      origY: GAME.mapView.entityPosition(entityName).y,
    };
    circle.style.cursor = 'grabbing';
    circle.style.stroke = 'rgba(202, 138, 4, 0.85)';
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', finish, true);
  };
  circle.addEventListener('pointerdown', start);
  if (entityEl) entityEl.addEventListener('pointerdown', start, true);
  GAME.puzzleHandleCleanup = cleanup;
}

function removePuzzleHandle() {
  if (GAME.puzzleHandleCleanup) {
    GAME.puzzleHandleCleanup();
    GAME.puzzleHandleCleanup = null;
  }
  if (GAME.puzzleHandle) GAME.puzzleHandle.remove();
  GAME.puzzleHandle = null;
  GAME.puzzleHandleCircle = null;
}

function answerPuzzle(targetNode) {
  if (!GAME.active || GAME.answered) return;
  GAME.answered = true;
  removePuzzleHandle();

  const key = nodeEntity(targetNode);
  const tolerance = Number.parseFloat(classicData.cfg('puzzleTollerance') || '15') || 15;
  const position = GAME.mapView.entityPosition(key);
  const distance = Math.hypot(position.x - GAME.puzzleOrig.x, position.y - GAME.puzzleOrig.y);
  const correct = distance < tolerance;
  const isLast = GAME.questionIndex >= GAME.numQ;

  if (correct) {
    GAME.correct += 1;
    GAME.mapView.setEntityColor(key, '#77ff77');
    setQuestionHtml(classicData.cfg('correctPuzzleAnswer'));
  } else {
    GAME.incorrect += 1;
    GAME.mapView.setEntityColor(key, '#ff0000');
    setQuestionHtml(htmlFromConfig(classicData.cfg('incorrectPuzzleAnswer'), {
      ENTITYNAME: escapeHtml(nodeLabel(targetNode)),
    }));
  }
  GAME.mapView.setEntityTranslation(key, GAME.puzzleOrig.x, GAME.puzzleOrig.y);
  // Put the entity back into its original painting order.
  if (GAME.puzzleTarget && GAME.puzzleTarget.el && GAME.puzzleTarget.parent) {
    const { el, parent, nextSibling } = GAME.puzzleTarget;
    if (el.parentElement === parent) {
      if (nextSibling && nextSibling.parentElement === parent) parent.insertBefore(el, nextSibling);
      else parent.appendChild(el);
    }
  }
  GAME.puzzlePrevious = { entity: key, wasIncorrect: !correct };
  GAME.puzzleTarget = null;

  GAME.answers.push({
    label: nodeLabel(targetNode),
    correct,
    points: correct ? 1 : 0,
    distance: Math.round(distance),
  });
  updateScore();
  updateProgress();
  dom.next.disabled = false;
  const suffix = isLast ? classicData.cfg('lastPuzzleQuestion') : classicData.cfg('nextPuzzleQuestion');
  dom.question.innerHTML += ` ${suffix}`;
  if (isLast) stopClock();
  announce(correct ? 'Správne umiestnené.' : 'Nesprávne umiestnené.');
}

function showPuzzleFinal() {
  GAME.finalShown = true;
  GAME.active = false;
  stopClock();
  removePuzzleHandle();
  clearMarks();
  if (GAME.puzzlePrevious && GAME.puzzlePrevious.wasIncorrect) {
    GAME.mapView.setEntityColor(GAME.puzzlePrevious.entity, '#ff7777');
    GAME.puzzlePrevious = null;
  }
  setQuestionNumber(0);
  const answered = GAME.correct + GAME.incorrect;
  const percent = answered ? Math.round((GAME.correct / answered) * 100) : 0;
  const type = GAME.testEl.getAttribute('answer') || GAME.testEl.getAttribute('question') || GAME.testEl.getAttribute('label') || '';
  setQuestionHtml(htmlFromConfig(classicData.cfg('puzzleFinalScore'), {
    CORRECTQ: spaced(GAME.correct),
    TOTALQ: spaced(answered),
    TOTALTIME: spaced(timeText()),
    PERCENT: spaced(percent),
    ENTITYTYPE: escapeHtml(type),
  }));
  dom.next.disabled = true;
  dom.progress.style.width = '100%';
  showResult({
    title: 'Poskladaj! — výsledok',
    percent,
    primaryValue: `${GAME.correct}/${answered}`,
    primaryLabel: 'správne',
    time: timeText(),
    finalHtml: dom.question.innerHTML,
    rows: GAME.answers.map((row) => [
      row.label,
      row.correct ? '✓' : '✕',
      row.correct ? '1' : '0',
    ]),
    columns: ['Objekt', 'Uloženie', 'Body'],
  });
}

/* ------------------------------------------------------------------------- */
/* next / end                                                                */
/* ------------------------------------------------------------------------- */

function bindGameEvents() {
  dom.next.addEventListener('click', () => {
    if (!GAME.active && !GAME.finalShown) return;
    if (GAME.finalShown) return;
    if (!GAME.answered) return;
    if (GAME.mode === 'test') {
      if (GAME.questionIndex >= GAME.numQ) showTestFinal();
      else nextTestQuestion();
    } else if (GAME.mode === 'distance') {
      if (GAME.questionIndex >= GAME.numQ) showDistanceFinal();
      else nextDistanceQuestion();
    } else if (GAME.mode === 'puzzle') {
      if (GAME.questionIndex >= GAME.numQ) showPuzzleFinal();
      else nextPuzzleQuestion();
    }
  });
  dom.end.addEventListener('click', () => endActivity());
  dom.homeBtn?.addEventListener('click', () => endActivity());
  dom.zoomIn.addEventListener('click', () => GAME.mapView?.zoomIn());
  dom.zoomOut.addEventListener('click', () => GAME.mapView?.zoomOut());
  dom.zoomFit.addEventListener('click', () => GAME.mapView?.fit());
  document.addEventListener('keydown', (event) => {
    if (dom.classicScreen.hidden) return;
    if (document.querySelector('.overlay.is-open')) return;
    if (event.key === 'Enter' && !dom.next.disabled && !dom.next.hidden) {
      event.preventDefault();
      dom.next.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      endActivity();
    } else if (event.key === '+' || event.key === '=') {
      GAME.mapView?.zoomIn();
    } else if (event.key === '-') {
      GAME.mapView?.zoomOut();
    } else if (event.key === '0') {
      GAME.mapView?.fit();
    }
  });
}

async function endActivity() {
  if (!GAME.active && !GAME.finalShown) {
    goHome();
    return;
  }
  if (GAME.active) {
    const ok = await confirmDialog({
      title: 'Ukončiť aktivitu?',
      message: 'Rozohraná hra sa neuloží. Naozaj chceš skončiť?',
      okLabel: 'Ukončiť',
      cancelLabel: 'Pokračovať',
      danger: true,
    });
    if (!ok) return;
  }
  goHome();
}

export function goHome() {
  GAME.loadToken += 1;
  stopClock();
  GAME.active = false;
  GAME.finalShown = false;
  removePuzzleHandle();
  clearMarks();
  if (GAME.mapView) {
    GAME.mapView.destroy();
    GAME.mapView = null;
  }
  closeOverlay(dom.resultOverlay);
  dom.classicScreen.hidden = true;
  document.body.classList.remove('classic-active');
  dom.loading.hidden = true;
  const home = $('#homeScreen');
  if (home) home.hidden = false;
  const atlas = $('#atlasScreen');
  if (atlas) atlas.hidden = true;
  const game = $('#gameScreen');
  if (game) game.hidden = true;
  const editor = $('#editorScreen');
  if (editor) editor.hidden = true;
  document.body.classList.remove('game-active');
  window.scrollTo({ top: 0 });
}

/* ------------------------------------------------------------------------- */
/* result dialog                                                             */
/* ------------------------------------------------------------------------- */

function bindResultEvents() {
  if (!dom.resultOverlay) return;
  dom.resultAgain.addEventListener('click', () => {
    const params = { ...GAME.params };
    closeOverlay(dom.resultOverlay);
    startActivityGame(params);
  });
  dom.resultSetup.addEventListener('click', () => {
    const params = GAME.params;
    closeOverlay(dom.resultOverlay);
    openActivitySetup(params.mode, {
      mapIndex: params.mapIndex,
      testIndex: params.testIndex,
      levelIndex: params.levelIndex,
      numQ: params.numQ,
    });
  });
  dom.resultHome.addEventListener('click', () => {
    closeOverlay(dom.resultOverlay);
    goHome();
  });
  dom.resultClose.addEventListener('click', () => closeOverlay(dom.resultOverlay));
  dom.resultShare.addEventListener('click', async () => {
    const data = GAME.lastResult;
    if (!data) return;
    const text = `${data.title}: ${data.primaryValue} ${data.primaryLabel} · ${data.percent} % · ${data.time}`;
    try {
      if (navigator.share && window.isSecureContext) {
        await navigator.share({ title: data.title, text });
      } else if (await copyText(text)) {
        toast('Výsledok je v schránke.', 'success');
      } else {
        toast('Výsledok sa nepodarilo skopírovať.', 'error');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast('Výsledok sa nepodarilo zdieľať.', 'error');
    }
  });
  dom.resultOverlay.addEventListener('click', (event) => {
    if (event.target === dom.resultOverlay) closeOverlay(dom.resultOverlay);
  });
}

function showResult(result) {
  GAME.lastResult = result;
  dom.resultTitle.textContent = result.title;
  dom.resultPercent.textContent = `${result.percent}%`;
  dom.resultPrimary.textContent = result.primaryValue;
  dom.resultPrimaryLabel.textContent = result.primaryLabel;
  dom.resultTime.textContent = result.time;
  dom.resultText.innerHTML = result.finalHtml || '';
  dom.resultBadge.hidden = result.percent < 90;
  dom.resultBadge.textContent = result.percent >= 100 ? 'Perfektné' : result.percent >= 90 ? 'Výborné' : '';
  dom.resultRows.replaceChildren();
  const head = dom.resultRows.closest('table')?.querySelector('thead tr');
  if (head) {
    head.replaceChildren();
    for (const label of result.columns) {
      const th = document.createElement('th');
      th.textContent = label;
      head.append(th);
    }
  }
  result.rows.forEach((row) => {
    const tr = document.createElement('tr');
    row.forEach((cell) => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.append(td);
    });
    dom.resultRows.append(tr);
  });
  openOverlay(dom.resultOverlay, dom.resultAgain);
}

/* ------------------------------------------------------------------------- */
/* helpers                                                                   */
/* ------------------------------------------------------------------------- */

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function displayMapLabel(mapEl, mapDef) {
  const label = mapEl?.getAttribute('label') || mapDef?.label || '';
  if (!label) return '';
  return label.charAt(0).toLocaleUpperCase('sk') + label.slice(1);
}

function escapeLabel(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The original config concatenates ENTITYTYPE directly with the bold name.
 *  A single separating space keeps the question readable without changing it. */
function typeWithSpace(value) {
  const text = String(value == null ? '' : value).trimEnd();
  return text ? `${text} ` : '';
}

function questionTypeOf(el) {
  if (!el) return '';
  return el.hasAttribute('question') ? el.getAttribute('question') : (el.getAttribute('label') || '');
}

function spaced(value) {
  return ` ${value}`;
}

function pluralSk(count, one, few, many) {
  const n = Math.abs(Number(count) || 0);
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

// Small read-only hook used by the verification tests and useful in the
// browser console. It never mutates game state by itself.
if (typeof window !== 'undefined') {
  window.EditorMap2Game = {
    get state() { return GAME; },
    openActivitySetup,
    startActivityGame,
  };
}
