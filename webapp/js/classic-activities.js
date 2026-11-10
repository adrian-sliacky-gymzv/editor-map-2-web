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
  descendantEntityNodes,
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
import { practiceStats } from './practice-stats.js';
import { tapSlop } from './map-gestures.js';
import { FORMAT_LABELS, answerSuccess } from './practice-stats-core.js';
import { candidatesFor, nextGroupIndex, pickUnusedIndex, randomSequence } from './quiz-selection.js';
import {
  distanceBetween,
  maxDistanceForMap,
  scoreForDistance,
} from './scoring.js';
import { gameMessage, getLanguage, t } from './i18n.js';
import { navigate } from './navigation.js';
import { playCorrect, playResult, playScore, playWrong } from './sound.js';
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

/** Original config.xml text, or its English equivalent in English mode. */
const cfgText = (name) => gameMessage(name, classicData.cfg(name));

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

const MISSION_TYPES = {
  town: {
    label: 'Mesto',
    color: '#d97706',
    icon: '<path d="M3 21h18M5 21V9l4-2v14M9 21V10l5-2v13M14 21V12l5 2v7M7 12h2M7 16h2M11 13h2M11 17h2M16 15h1M16 18h1"/>',
  },
  region: {
    label: 'Región',
    color: '#2563eb',
    icon: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
  },
  district: {
    label: 'Okres',
    color: '#0f766e',
    icon: '<path d="M12 3 21 12l-9 9-9-9Z"/>',
  },
  river: {
    label: 'Rieka',
    color: '#0284c7',
    icon: '<path d="M3 7.5c3-3 5.5 3 8.5 0s5.5 3 9 0M3 12.5c3-3 5.5 3 8.5 0s5.5 3 9 0M3 17.5c3-3 5.5 3 8.5 0s5.5 3 9 0"/>',
  },
  lake: {
    label: 'Vodná nádrž',
    color: '#1d4ed8',
    icon: '<path d="M12 3.5s6 6.2 6 10.2a6 6 0 0 1-12 0c0-4 6-10.2 6-10.2Z"/>',
  },
  sea: {
    label: 'More / oceán',
    color: '#0891b2',
    icon: '<path d="M3 10c3-3 5.5 3 8.5 0s5.5 3 9 0M3 15c3-3 5.5 3 8.5 0s5.5 3 9 0M3 20c3-3 5.5 3 8.5 0s5.5 3 9 0"/>',
  },
  island: {
    label: 'Ostrov',
    color: '#0d9488',
    icon: '<path d="M3 18c2.5-2 5.5-3 9-3s6.5 1 9 3M12 15V7M12 7c2-2 5-1.5 5 1M12 7c-2-2-5-1.5-5 1"/>',
  },
  reservation: {
    label: 'Chránené územie',
    color: '#15803d',
    icon: '<path d="M12 3 6 11h3l-3 5h12l-3-5h3Z"/><path d="M12 16v5"/>',
  },
  geo: {
    label: 'Geomorfologický celok',
    color: '#a16207',
    icon: '<path d="m3 20 6-11 4 6 2-3 6 8Z"/>',
  },
  legend: {
    label: 'Legenda',
    color: '#475569',
    icon: '<path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.6"/>',
  },
  default: {
    label: 'Objekt',
    color: '#475569',
    icon: '<path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.6"/>',
  },
};

const MISSION_QUESTION_LABELS = {
  'mesto': 'Mesto',
  'mestá': 'Mesto',
  'hlavné mesto': 'Hlavné mesto',
  'štát': 'Štát',
  'štáty': 'Štát',
  'rieka': 'Rieka',
  'rieku': 'Rieka',
  'rieky': 'Rieka',
  'jazero': 'Jazero',
  'jazera': 'Jazero',
  'jazier': 'Jazero',
  'vodná nádrž': 'Vodná nádrž',
  'vodnú nádrž': 'Vodná nádrž',
  'vodné nádrže': 'Vodná nádrž',
  'more a oceán': 'More / oceán',
  'moria a oceány': 'More / oceán',
  'povrchový celok': 'Povrchový celok',
  'povrchové celky': 'Povrchový celok',
  'geomorfologický celok': 'Geomorfologický celok',
  'geomorfologické celky': 'Geomorfologický celok',
  'chránená oblasť': 'Chránená oblasť',
  'chránenú oblasť': 'Chránená oblasť',
  'chránené územie': 'Chránené územie',
  'vyšší územný celok': 'Vyšší územný celok',
  'vyššie územné celky': 'Vyšší územný celok',
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
  routeReady: false,
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
  startedAtEpoch: 0,
  sessionRecorded: false,
  clockOffset: 0,
  clockPausedAt: 0,
  practiceItems: [],
  practiceIndex: 0,
  practiceFormat: null,
  practiceCurrentItem: null,
  practiceMapKey: null,
  practiceConfig: null,
  practiceFormatCounts: { test: 0, distance: 0, puzzle: 0 },
  practiceErrorCount: 0,
  entityIndex: null,
  lastPracticeFormat: null,
};

const dom = {};

export async function initActivities() {
  cacheDom();
  bindSetupEvents();
  bindGameEvents();
  bindResultEvents();
  watchNextState();
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-classic-mode]');
    if (trigger) {
      event.preventDefault();
      if (trigger.dataset.classicPreset === 'hero') {
        startHeroGame();
      } else if (trigger.dataset.classicMap) {
        openActivitySetup(trigger.dataset.classicMode, { mapKey: trigger.dataset.classicMap });
      } else {
        openActivitySetup(trigger.dataset.classicMode);
      }
    }
    const editorTrigger = event.target.closest('[data-editor-open]');
    if (editorTrigger) {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent('editor:open'));
    }
  });
}

async function startHeroGame() {
  try {
    await startActivityGame({
      mode: 'distance',
      mapKey: 'slovensko',
      testIndex: 0,
      levelIndex: 2,
      numQ: 10,
    });
  } catch (error) {
    console.error(error);
    toast('Hru sa nepodarilo spustiť.', 'error');
  }
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
  dom.mission = $('#classicMission');
  dom.missionIcon = $('#classicMissionIcon');
  dom.missionKicker = $('#classicMissionKicker');
  dom.missionName = $('#classicMissionName');
  dom.missionType = $('#classicMissionType');
  dom.averageValue = $('#classicAverageValue');
  dom.questionCounter = $('#classicQuestionCounter');
  dom.feedback = $('#classicFeedback');
  dom.homeBtn = $('#classicHomeBtn');
  dom.qnum = $('#classicQnum');
  dom.question = $('#classicQuestion');
  dom.next = $('#classicNextBtn');
  dom.nextFloat = $('#classicNextFloat');
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
  dom.distanceLegend = $('#classicDistanceLegend');
  dom.distanceTarget = $('#classicDistanceTarget');
  dom.distanceValue = $('#classicDistanceValue');
  dom.zoomIn = $('#classicZoomIn');
  dom.zoomOut = $('#classicZoomOut');
  dom.zoomCenter = $('#classicZoomCenter');
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
  dom.resultWeak = $('#classicResultWeak');
  dom.resultClose = $('#classicResultClose');
  dom.resultBtn = $('#classicResultBtn');
}

/* ------------------------------------------------------------------------- */
/* setup                                                                     */
/* ------------------------------------------------------------------------- */

export async function openActivitySetup(modeKey, preset = null, options = {}) {
  const mode = MODES[modeKey];
  if (!mode) return;
  await classicData.init();
  closeOverlay(dom.resultOverlay);
  dom.classicScreen.hidden = true;
  document.body.classList.remove('classic-active');
  for (const selector of ['#atlasScreen', '#gameScreen', '#editorScreen']) {
    const screen = $(selector);
    if (screen) screen.hidden = true;
  }
  const home = $('#homeScreen');
  if (home) home.hidden = false;
  SETUP.mode = modeKey;
  SETUP.routeReady = false;
  SETUP.mapList = childrenByTag(classicData.cfgEl(mode.listName), 'map');
  if (!SETUP.mapList.length) {
    toast('V konfigurácii sa nenašla žiadna mapa pre túto aktivitu.', 'error');
    return;
  }
  const saved = readSetup();
  let mapIndex = clamp(preset?.mapIndex ?? saved.mapIndex ?? 0, 0, SETUP.mapList.length - 1);
  if (preset?.mapKey) {
    const found = SETUP.mapList.findIndex((el) => classicData.keyForConfigMap(el) === preset.mapKey);
    if (found >= 0) mapIndex = found;
  }
  SETUP.mapIndex = mapIndex;
  SETUP.testIndex = preset?.testIndex ?? saved.testIndex ?? 0;
  SETUP.levelIndex = preset?.levelIndex ?? saved.levelIndex ?? 0;
  SETUP.numQ = preset?.numQ ?? saved.numQ ?? 3;

  dom.title.textContent = cfgText(mode.titleKey) || mode.defaultTitle;
  dom.subtitle.textContent = mode.description;
  renderMapCards();
  await selectMap(SETUP.mapIndex, SETUP.testIndex, SETUP.levelIndex, SETUP.numQ);
  openOverlay(dom.overlay, dom.start);
  navigate(setupRoute(), { replace: options.replace === true, silent: true });
  SETUP.routeReady = true;
}

export async function openActivityFromQuery(params = {}, options = {}) {
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
      history: options.history,
      replace: options.replace,
    });
  } else {
    await openActivitySetup(mode, preset, options);
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

function setupRoute() {
  const mapEl = SETUP.mapList[SETUP.mapIndex];
  return {
    screen: 'classic-setup',
    mode: SETUP.mode || 'distance',
    mapKey: classicData.keyForConfigMap(mapEl),
    mapIndex: SETUP.mapIndex,
    testIndex: SETUP.testIndex,
    levelIndex: SETUP.levelIndex,
    numQ: SETUP.numQ,
  };
}

function syncSetupRoute() {
  if (!SETUP.routeReady || !SETUP.mode || !SETUP.mapList?.length) return;
  navigate(setupRoute(), { replace: true, silent: true });
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
    const targetWord = pluralSk(level.numTargets, 'možnosť', 'možnosti', 'možností');
    button.innerHTML = `<span class="seg-name">${escapeLabel(level.label)}</span><span class="seg-count">${mode.key === 'test' ? `${level.numTargets} ${targetWord}` : `testLevel ≤ ${level.maxLevel}`}</span>`;
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
  const targetWord = pluralSk(level.numTargets, 'možnosť', 'možnosti', 'možností');
  const targetText = mode.key === 'test'
    ? t('V každej otázke {count} {noun}.', {
      count: level.numTargets,
      noun: t(targetWord),
    })
    : mode.key === 'distance'
      ? t('Skóre podľa vzdialenosti od správneho bodu.')
      : t('Tolerancia uloženia je 15 mapových jednotiek.');
  const noun = mode.key === 'puzzle'
    ? pluralSk(SETUP.totalNodes, 'objekt', 'objekty', 'objektov')
    : pluralSk(SETUP.totalNodes, 'otázka', 'otázky', 'otázok');
  const groupNoun = pluralSk(activeLevels, 'testovacia skupina', 'testovacie skupiny', 'testovacích skupín');
  const emptyText = empty.length
    ? ` ${t('Prázdne skupiny sa preskočia ({groups}).', {
      groups: empty.map((label) => escapeLabel(t(label))).join(', '),
    })}`
    : '';
  dom.summary.innerHTML = `
    <p class="setup-summary-main"><b>${SETUP.totalNodes}</b> ${t('dostupných')} ${t(noun)} · <b>${activeLevels}</b> ${t(groupNoun)}</p>
    <p class="setup-summary-sub">${targetText}${emptyText}</p>`;
  dom.start.disabled = SETUP.totalNodes === 0;

  const levelButtons = dom.levels.querySelectorAll('.setup-level');
  levelButtons.forEach((button, index) => {
    const active = index === SETUP.levelIndex;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  syncSetupRoute();
}

function closeActivitySetup() {
  SETUP.routeReady = false;
  closeOverlay(dom.overlay);
  navigate({ screen: 'home' }, { replace: true });
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
  [dom.cancel, dom.close].forEach((button) => button?.addEventListener('click', closeActivitySetup));
  dom.overlay.addEventListener('click', (event) => {
    if (event.target === dom.overlay) closeActivitySetup();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.querySelector('#classicConfirmOverlay.is-open, #classicPromptOverlay.is-open')) return;
    if (!dom.overlay.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeActivitySetup();
      return;
    }
    if (!dom.resultOverlay?.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeOverlay(dom.resultOverlay);
    }
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
  GAME.distancePool = [];
  GAME.distanceSeq = [];
  GAME.puzzlePool = [];
  GAME.puzzleSeq = [];
  GAME.puzzleTarget = null;
  GAME.puzzlePrevious = null;
  GAME.lastResult = null;
  GAME.marks = [];
  GAME.practiceItems = [];
  GAME.practiceIndex = 0;
  GAME.practiceFormat = null;
  GAME.practiceCurrentItem = null;
  GAME.practiceMapKey = null;
  GAME.practiceConfig = null;
  GAME.practiceFormatCounts = { test: 0, distance: 0, puzzle: 0 };
  GAME.practiceErrorCount = 0;
  GAME.entityIndex = null;
  GAME.lastPracticeFormat = null;
  GAME.startedAtEpoch = Date.now();
  GAME.sessionRecorded = false;

  showClassicScreen();
  setLoading(true, 'Načítavam mapu…');
  dom.titleGame.textContent = cfgText(mode.titleKey) || mode.fallbackTitle;
  resetMission(params.mode);
  dom.context.textContent = `${displayMapLabel(mapEl, mapDef)} · ${testEl.getAttribute('label') || ''}`;
  dom.mapTag.textContent = `${displayMapLabel(mapEl, mapDef)} · ${level.label}`;
  dom.qnum.textContent = '';
  dom.question.textContent = '';
  dom.next.disabled = true;
  dom.next.hidden = false;
  if (dom.resultBtn) dom.resultBtn.hidden = true;
  dom.end.hidden = false;
  dom.progress.style.width = '0%';
  dom.scoreValue.textContent = '000';
  dom.correctValue.textContent = '0';
  dom.wrongValue.textContent = '0';
  dom.timeValue.textContent = '00:00';
  dom.averageValue.textContent = '—';
  dom.questionCounter.textContent = `0/${GAME.numQ}`;
  if (dom.distanceValue) dom.distanceValue.textContent = '—';
  dom.scoreDistance.hidden = params.mode !== 'distance';
  dom.scoreCounts.hidden = params.mode === 'distance';
  dom.zoomValue.textContent = '100%';
  dom.mapViewportWrap.classList.remove('is-answered');
  hideDistanceLegend();
  showMapHint();
  syncNextFloat();

  if (params.history !== false) {
    navigate({
      screen: 'classic-game',
      mode: params.mode,
      mapKey,
      mapIndex: GAME.params.mapIndex,
      testIndex: GAME.params.testIndex,
      levelIndex: clamp(Number(params.levelIndex) || 0, 0, levels.length - 1),
      numQ: GAME.numQ,
    }, { replace: params.replace === true, silent: true });
  }

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
      labelObstacles: () => [dom.mission, dom.distanceLegend]
        .filter((el) => el && !el.hidden)
        .map((el) => el.getBoundingClientRect()),
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
    requestAnimationFrame(() => {
      if (!GAME.mapView) return;
      GAME.mapView.layout();
      dom.zoomValue.textContent = `${GAME.mapView.percent()}%`;
    });

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
  syncNextFloat();
  window.scrollTo({ top: 0 });
}

function showMapHint() {
  if (!dom.hint) return;
  dom.hint.hidden = false;
  if (GAME.mode === 'distance' || (GAME.mode === 'practice' && GAME.practiceFormat === 'distance')) {
    dom.hint.textContent = 'Klikni na miesto na mape';
  } else if (GAME.mode === 'puzzle' || (GAME.mode === 'practice' && GAME.practiceFormat === 'puzzle')) {
    dom.hint.textContent = 'Potiahni žltý objekt na správne miesto';
  } else {
    dom.hint.textContent = 'Klikni na správnu značku';
  }
}

function hideMapHint() {
  if (dom.hint) dom.hint.hidden = true;
}

function showDistanceLegend() {
  if (dom.distanceLegend) dom.distanceLegend.hidden = false;
}

function hideDistanceLegend() {
  if (dom.distanceLegend) dom.distanceLegend.hidden = true;
}

function syncNextFloat() {
  if (!dom.nextFloat || !dom.next) return;
  const screenVisible = !dom.classicScreen?.hidden;
  const resultReady = Boolean(GAME.finalShown && dom.resultOverlay.hidden && screenVisible);
  const canAdvance = Boolean(!dom.next.disabled && !dom.next.hidden && !GAME.finalShown && screenVisible);
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
  if (!dom.nextFloat || dom.nextFloat.hidden || !GAME.mapView) return;
  if (GAME.finalShown) {
    // The result action is a stable bottom action; there are no more answers
    // to dodge, so do not move it to the top based on the last markers.
    dom.nextFloat.classList.remove('is-top');
    dom.nextFloat.style.top = '';
    return;
  }
  const points = [...GAME.marks.values()]
    .filter((mark) => mark.labelVisible)
    .map((mark) => GAME.mapView.mapToScreen(mark.x, mark.y));
  if (!points.length) {
    dom.nextFloat.classList.remove('is-top');
    return;
  }
  const rect = dom.mapViewportWrap.getBoundingClientRect();
  const topZone = rect.top + Math.min(150, rect.height * 0.28);
  const bottomZone = rect.bottom - Math.min(170, rect.height * 0.32);
  const nearTop = points.filter((point) => point.y < topZone).length;
  const nearBottom = points.filter((point) => point.y > bottomZone).length;
  const isTop = nearBottom > nearTop;
  dom.nextFloat.classList.toggle('is-top', isTop);
  if (isTop) {
    // Keep the floating action clear of the mission HUD and marker legend.
    const hudBottom = Math.max(
      dom.mission ? dom.mission.getBoundingClientRect().bottom : rect.top,
      dom.distanceLegend && !dom.distanceLegend.hidden
        ? dom.distanceLegend.getBoundingClientRect().bottom
        : rect.top
    );
    dom.nextFloat.style.top = `${Math.max(16, Math.round(hudBottom - rect.top + 10))}px`;
  } else {
    dom.nextFloat.style.top = '';
  }
}

function watchNextState() {
  if (!dom.next || !dom.nextFloat) return;
  const observer = new MutationObserver(syncNextFloat);
  observer.observe(dom.next, { attributes: true, attributeFilter: ['disabled', 'hidden'] });
  syncNextFloat();
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
  GAME.clockOffset = 0;
  GAME.clockPausedAt = 0;
  const tick = () => {
    const now = performance.now();
    const paused = GAME.clockPausedAt ? now - GAME.clockPausedAt : 0;
    GAME.elapsedMs = Math.max(0, now - GAME.startedAt - GAME.clockOffset - paused);
    dom.timeValue.textContent = formatClock(GAME.elapsedMs / 1000);
  };
  tick();
  GAME.clockId = setInterval(tick, 220);
}

function pauseClock() {
  if (!GAME.clockId || GAME.clockPausedAt) return;
  GAME.clockPausedAt = performance.now();
}

function resumeClock() {
  if (!GAME.clockPausedAt) return;
  GAME.clockOffset += performance.now() - GAME.clockPausedAt;
  GAME.clockPausedAt = 0;
}

function stopClock() {
  if (GAME.clockId) clearInterval(GAME.clockId);
  GAME.clockId = null;
  if (GAME.startedAt) {
    const end = GAME.clockPausedAt || performance.now();
    GAME.elapsedMs = Math.max(0, end - GAME.startedAt - GAME.clockOffset);
  }
  GAME.clockPausedAt = 0;
}

function timeText() {
  return formatClock(GAME.elapsedMs / 1000);
}

function missionIconMarkup(symbol) {
  const info = MISSION_TYPES[symbol] || MISSION_TYPES.default;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${info.icon}</svg>`;
}

function missionInfoFor(node, fallbackType) {
  const symbol = node?.getAttribute('markSymbol') || '';
  const base = MISSION_TYPES[symbol] || MISSION_TYPES.default;
  const question = String(fallbackType || '').trim();
  const fallbackLabel = MISSION_QUESTION_LABELS[question]
    || (question ? question.charAt(0).toLocaleUpperCase('sk') + question.slice(1) : '');
  return {
    symbol: MISSION_TYPES[symbol] ? symbol : 'default',
    label: fallbackLabel || base.label,
    color: base.color,
    icon: base.icon,
  };
}

function resetMission(mode) {
  const info = MISSION_TYPES.default;
  if (!dom.mission) return;
  dom.mission.dataset.mode = mode || '';
  dom.missionKicker.textContent = 'Načítavam…';
  dom.missionKicker.classList.remove('is-correct', 'is-wrong', 'is-partial');
  dom.missionName.textContent = '—';
  dom.missionName.title = '';
  dom.missionType.textContent = info.label;
  dom.missionIcon.dataset.symbol = 'default';
  dom.missionIcon.style.setProperty('--mission-color', info.color);
  dom.missionIcon.innerHTML = missionIconMarkup('default');
  dom.mission.setAttribute('aria-label', 'Načítavam úlohu');
}

function setMissionTarget(node, fallbackType, mode) {
  if (!dom.mission) return;
  const info = missionInfoFor(node, fallbackType);
  const instruction = mode === 'test'
    ? 'Vyber na mape'
    : mode === 'puzzle'
      ? 'Umiestni na mapu'
      : 'Nájdi na mape';
  dom.mission.dataset.mode = mode || '';
  dom.missionKicker.textContent = instruction;
  dom.missionKicker.classList.remove('is-correct', 'is-wrong', 'is-partial');
  dom.missionName.textContent = nodeLabel(node) || '—';
  dom.missionName.title = nodeLabel(node) || '';
  dom.missionType.textContent = info.label;
  dom.missionIcon.dataset.symbol = info.symbol;
  dom.missionIcon.style.setProperty('--mission-color', info.color);
  dom.missionIcon.innerHTML = missionIconMarkup(info.symbol);
  dom.mission.setAttribute('aria-label', t('{instruction}: {type} {name}', {
    instruction: t(instruction),
    type: t(info.label),
    name: nodeLabel(node) || '',
  }).trim());
}

function setMissionFeedback(text, tone = '') {
  if (!dom.missionKicker) return;
  dom.missionKicker.textContent = text;
  dom.missionKicker.classList.remove('is-correct', 'is-wrong', 'is-partial');
  if (tone) dom.missionKicker.classList.add(`is-${tone}`);
}

function averageText() {
  const answered = GAME.answers.length;
  if (!answered) return '—';
  const points = GAME.answers.reduce((sum, row) => sum + (Number(row.points) || 0), 0);
  const maxPoints = GAME.answers.reduce((sum, row) => sum + (Number(row.maxPoints) || 0), 0);
  if (GAME.mode === 'distance' || (GAME.mode === 'practice' && GAME.practiceFormat === 'distance')) {
    return `${Math.round(points / answered)} b.`;
  }
  return `${maxPoints ? Math.round((points / maxPoints) * 100) : 0} %`;
}

function updateScore() {
  if (GAME.mode === 'distance') {
    dom.scoreValue.textContent = String(GAME.totalScore).padStart(3, '0');
  } else {
    dom.correctValue.textContent = String(GAME.correct);
    dom.wrongValue.textContent = String(GAME.incorrect);
  }
  dom.timeValue.textContent = timeText();
  if (dom.averageValue) dom.averageValue.textContent = averageText();
}

function setQuestionHtml(html) {
  dom.question.innerHTML = html;
}

/* ------------------------------------------------------------------------- */
/* weakness tracking                                                         */
/* ------------------------------------------------------------------------- */

function attemptContext() {
  if (GAME.mode === 'practice') {
    return {
      mapKey: GAME.practiceCurrentItem?.mapKey || GAME.practiceMapKey,
      mapLabel: GAME.mapDef?.label || '',
      testLabel: 'Tréning slabých miest',
      source: 'practice',
    };
  }
  return {
    mapKey: GAME.params?.mapKey || GAME.mapKey,
    mapLabel: displayMapLabel(GAME.mapEl, GAME.mapDef),
    testLabel: GAME.testEl?.getAttribute('label') || '',
    source: 'game',
  };
}

function recordAttemptForNode(node, mode, correct, score, maxScore) {
  const entity = nodeEntity(node);
  if (!entity) return;
  const context = attemptContext();
  if (!context.mapKey) return;
  practiceStats.recordAttempt({
    mapKey: context.mapKey,
    mapLabel: context.mapLabel,
    entity,
    label: nodeLabel(node),
    markSymbol: node.getAttribute('markSymbol') || '',
    mode,
    correct: !!correct,
    score,
    maxScore,
    testLabel: context.testLabel,
    source: context.source,
    at: Date.now(),
  });
}

function recordCurrentSession() {
  if (GAME.sessionRecorded || !GAME.answers.length) return;
  const answers = GAME.answers;
  let correct = 0;
  let score = 0;
  let maxScore = 0;
  const maps = [];
  for (const answer of answers) {
    const max = Number(answer.maxPoints) || 1;
    const points = Number(answer.points) || 0;
    if (answerSuccess(points, max)) correct += 1;
    score += points;
    maxScore += max;
    if (answer.mapLabel && !maps.includes(answer.mapLabel)) maps.push(answer.mapLabel);
  }
  practiceStats.recordSession({
    startedAt: GAME.startedAtEpoch || Date.now(),
    endedAt: Date.now(),
    mode: GAME.mode === 'practice' ? 'practice' : GAME.mode,
    source: GAME.mode === 'practice' ? 'practice' : 'game',
    format: GAME.mode === 'practice' ? (GAME.practiceConfig?.format || 'mixed') : GAME.mode,
    maps,
    questions: GAME.numQ,
    answered: answers.length,
    correct,
    score,
    maxScore,
  });
  GAME.sessionRecorded = true;
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
  if (dom.questionCounter) {
    dom.questionCounter.textContent = GAME.numQ ? `${Math.max(1, done)}/${GAME.numQ}` : '—';
  }
}

/* ------------------------------------------------------------------------- */
/* Vyskúšaj sa!                                                              */
/* ------------------------------------------------------------------------- */

function prepareTest() {
  const configGroups = childrenByTag(GAME.testEl, 'group');
  const pools = groupPools(GAME.mapDoc, GAME.testEl, GAME.level.maxLevel, { puzzle: false });
  GAME.testPools = pools
    .map((pool, index) => ({
      ...pool,
      configGroup: configGroups[index] || configGroups[0],
      used: new Set(),
    }))
    .filter((pool) => pool.nodes.length > 0);
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
  dom.mapViewportWrap.classList.remove('is-answered');
  hideDistanceLegend();
  showMapHint();
  GAME.mapView.fit();

  const groupIndex = nextGroupIndex(GAME.currentGroup, GAME.testPools);
  if (groupIndex < 0) {
    showTestFinal();
    return;
  }
  GAME.currentGroup = groupIndex;
  const pool = GAME.testPools[groupIndex];
  const chosenIndex = pickUnusedIndex(pool.nodes, pool.used);
  if (chosenIndex < 0) {
    showTestFinal();
    return;
  }
  const chosen = pool.nodes[chosenIndex];
  pool.used.add(chosen);
  GAME.targetNode = chosen;
  // Original: target pinned first, then a random sample of the full group,
  // so objects already used as answers can still appear as distractors.
  GAME.candidates = candidatesFor(pool.nodes, chosenIndex, GAME.numTargets);

  const groupLabels = visibleLabels(GAME.mapEl, GAME.testEl, pool.configGroup);
  GAME.mapView.showBaseLayers(groupLabels);

  setQuestionNumber(GAME.questionIndex);
  const questionType = questionTypeOf(pool.configGroup);
  setMissionTarget(chosen, questionType, 'test');
  setQuestionHtml(htmlFromConfig(cfgText('testQuestion'), {
    ENTITYTYPE: escapeHtml(typeWithSpace(t(questionType))),
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

function answerTestQuestion(clickedNode) {
  if (!GAME.active || GAME.answered) return;
  GAME.answered = true;
  dom.mapViewportWrap.classList.add('is-answered');
  hideMapHint();
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
    playCorrect();
    setQuestionHtml(cfgText('correctTestAnswer'));
  } else {
    GAME.incorrect += 1;
    playWrong();
    setQuestionHtml(cfgText('incorrectTestAnswer'));
  }
  setMissionFeedback(correct ? 'Správne! +1' : 'Nesprávne!', correct ? 'correct' : 'wrong');
  recordAttemptForNode(GAME.targetNode, 'test', correct, correct ? 1 : 0, 1);
  const context = attemptContext();
  GAME.answers.push({
    label: nodeLabel(GAME.targetNode),
    picked: nodeLabel(clickedNode),
    correct,
    points: correct ? 1 : 0,
    maxPoints: 1,
    mode: 'test',
    mapKey: context.mapKey,
    mapLabel: context.mapLabel,
    markSymbol: GAME.targetNode.getAttribute('markSymbol') || '',
    entity: nodeEntity(GAME.targetNode),
  });
  updateScore();
  updateProgress();
  dom.next.disabled = false;
  const isLast = GAME.questionIndex >= GAME.numQ;
  const suffix = isLast ? cfgText('lastTestQuestion') : cfgText('nextTestQuestion');
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
  GAME.mapView.clearGuides();
}

function showTestFinal() {
  GAME.finalShown = true;
  GAME.active = false;
  stopClock();
  hideMapHint();
  // The original leaves the last question's marks and shapes on screen.
  setQuestionNumber(0);
  const percent = Math.round((GAME.correct / GAME.numQ) * 100);
  playResult(percent);
  let finalHtml = htmlFromConfig(cfgText('testFinalScore'), {
    CORRECTQ: spaced(GAME.correct),
    TOTALQ: spaced(GAME.numQ),
    TOTALTIME: spaced(timeText()),
    PERCENT: spaced(percent),
  });
  if (GAME.numQ === 1) {
    finalHtml = getLanguage() === 'en'
      ? finalHtml.replace(/\bquestions\b/g, 'question')
      : finalHtml.replace(/\botázok\b/g, 'otázky');
  }
  setQuestionHtml(finalHtml);
  dom.next.disabled = true;
  dom.progress.style.width = '100%';
  showResult({
    title: t('Vyskúšaj sa! — výsledok'),
    percent,
    primaryValue: `${GAME.correct}/${GAME.numQ}`,
    primaryLabel: t('správne'),
    time: timeText(),
    finalHtml: dom.question.innerHTML,
    rows: GAME.answers.map((row) => [
      row.label,
      row.correct ? '✓' : `✕ (${row.picked})`,
      row.correct ? '1' : '0',
    ]),
    columns: [t('Objekt'), t('Odpoveď'), t('Body')],
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
  GAME.distanceSeq = randomSequence(GAME.distancePool.length, GAME.numQ);
  GAME.mapView.interaction = 'click';
  GAME.mapView.mapClickHandler = onDistanceClick;
}

function nextDistanceQuestion() {
  if (!GAME.active) return;
  GAME.answered = false;
  GAME.finalShown = false;
  GAME.questionIndex += 1;
  clearMarks();
  dom.mapViewportWrap.classList.remove('is-answered');
  hideDistanceLegend();
  showMapHint();
  GAME.mapView.fit();
  const targetIndex = GAME.distanceSeq[GAME.questionIndex - 1];
  const target = GAME.distancePool[targetIndex];
  GAME.targetNode = target;
  setQuestionNumber(GAME.questionIndex);
  const type = questionTypeOf(GAME.testEl);
  setMissionTarget(target, type, 'distance');
  setQuestionHtml(htmlFromConfig(cfgText('distanceQuestion'), {
    ENTITYTYPE: escapeHtml(typeWithSpace(t(type))),
    ENTITYNAME: escapeHtml(nodeLabel(target)),
  }));
  updateScore();
  updateProgress();
  dom.next.disabled = true;
  GAME.mapView.options.onMapClick = onDistanceClick;
  announce(`Otázka ${GAME.questionIndex}: ${nodeLabel(target)}`);
}

function onDistanceClick(point) {
  if (!GAME.active || GAME.answered) return;
  if (GAME.mode !== 'distance' && !(GAME.mode === 'practice' && GAME.practiceFormat === 'distance')) return;
  GAME.answered = true;
  dom.mapViewportWrap.classList.add('is-answered');
  hideMapHint();
  const target = GAME.targetNode;
  const targetX = getNumberAttr(target, 'markX');
  const targetY = getNumberAttr(target, 'markY');
  // Original DistanceTest: round the pixel distance first, then use a max
  // distance rounded from the selected map's own width and height.
  const dist = distanceBetween(point, { x: targetX, y: targetY });
  const maxDist = maxDistanceForMap(GAME.mapView.W, GAME.mapView.H);
  const score = scoreForDistance(dist, maxDist);
  playScore(score);
  GAME.totalScore += score;
  const success = score >= 70;
  if (GAME.mode === 'practice') {
    if (success) GAME.correct += 1;
    else GAME.incorrect += 1;
  }
  recordAttemptForNode(target, 'distance', success, score, 100);

  // The target is a solid green pin, the guess a hollow red crosshair. The
  // higher point always gets the upper callout and the lower point the lower
  // one, so the two chips stay apart even when the glyphs overlap.
  const targetAbove = targetY <= point.y;
  const targetMark = GAME.mapView.addMark({
    x: targetX,
    y: targetY,
    label: 'Správna poloha',
    symbol: 'target',
    state: 'correct',
    labelPlacement: targetAbove ? 'above' : 'below',
    labelVisible: true,
  });
  const guessMark = GAME.mapView.addMark({
    x: point.x,
    y: point.y,
    label: 'Tvoj tip',
    symbol: 'guess',
    state: 'incorrect',
    labelPlacement: targetAbove ? 'below' : 'above',
    labelVisible: true,
  });
  GAME.marks.push(targetMark, guessMark);
  if (dom.distanceTarget) {
    dom.distanceTarget.textContent = target.getAttribute('markLabel') || nodeLabel(target);
  }
  if (dom.distanceValue) dom.distanceValue.textContent = `${Math.round(dist)} j.`;
  GAME.mapView.addGuide({
    x1: point.x,
    y1: point.y,
    x2: targetX,
    y2: targetY,
    className: 'map-guide-underlay',
  });
  GAME.mapView.addGuide({ x1: point.x, y1: point.y, x2: targetX, y2: targetY });
  GAME.mapView.ensurePointsVisible([point, { x: targetX, y: targetY }]);
  showDistanceLegend();

  const answer = distanceAnswerFor(score);
  setQuestionHtml(answer.html);
  const feedbackTone = score >= 70 ? 'correct' : score > 0 ? 'partial' : 'wrong';
  const feedbackLabel = score >= 90 ? 'Výborne' : score >= 70 ? 'Dobre' : score > 0 ? 'Tesne vedľa' : 'Vedľa';
  setMissionFeedback(`${feedbackLabel}! +${score} b.`, feedbackTone);
  const isLast = GAME.questionIndex >= GAME.numQ;
  const suffix = isLast ? cfgText('lastTestQuestion') : cfgText('nextTestQuestion');
  dom.question.innerHTML += ` ${suffix}`;
  const context = attemptContext();
  GAME.answers.push({
    label: nodeLabel(target),
    correct: success,
    points: score,
    maxPoints: 100,
    mode: 'distance',
    distance: Math.round(dist),
    mapKey: context.mapKey,
    mapLabel: context.mapLabel,
    markSymbol: target.getAttribute('markSymbol') || '',
    entity: nodeEntity(target),
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
      const source = gameMessage(`distanceAnswer.${min}.${max}`, el.innerHTML);
      return { html: htmlFromConfig(source, { SCORE: spaced(score) }), score };
    }
  }
  return {
    html: t('Získal si <b>{score}</b> bodov.', { score }),
    score,
  };
}

function showDistanceFinal() {
  GAME.finalShown = true;
  GAME.active = false;
  stopClock();
  hideMapHint();
  hideDistanceLegend();
  // Keep the final guess and correct position visible for review.
  setQuestionNumber(0);
  const percent = Math.round(GAME.totalScore / GAME.numQ);
  playResult(percent);
  let finalHtml = htmlFromConfig(cfgText('distanceFinalScore'), {
    TOTALSCORE: spaced(GAME.totalScore),
    TOTALTIME: spaced(timeText()),
    PERCENT: spaced(percent),
  });
  if (GAME.totalScore === 1) finalHtml = finalHtml.replace(/\bbodov\b/g, 'bod');
  else if (GAME.totalScore >= 2 && GAME.totalScore <= 4) finalHtml = finalHtml.replace(/\bbodov\b/g, 'body');
  setQuestionHtml(finalHtml);
  dom.next.disabled = true;
  dom.progress.style.width = '100%';
  showResult({
    title: t('Traf sa! — výsledok'),
    percent,
    primaryValue: `${GAME.totalScore}`,
    primaryLabel: t(GAME.totalScore === 1 ? 'bod' : 'bodov'),
    time: timeText(),
    finalHtml: dom.question.innerHTML,
    rows: GAME.answers.map((row) => [
      row.label,
      t(`${row.distance} j.`),
      String(row.points),
    ]),
    columns: [t('Objekt'), t('Vzdialenosť'), t('Body')],
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
  GAME.puzzleSeq = randomSequence(GAME.puzzlePool.length, GAME.numQ);
  GAME.mapView.interaction = 'pan';
}

function nextPuzzleQuestion() {
  if (!GAME.active) return;
  GAME.answered = false;
  GAME.finalShown = false;
  GAME.questionIndex += 1;
  removePuzzleHandle();
  clearMarks();
  dom.mapViewportWrap.classList.remove('is-answered');
  hideDistanceLegend();
  showMapHint();
  GAME.mapView.fit();

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
  const nextSibling = el?.nextSibling || null;
  const parent = el?.parentElement || null;
  if (el && parent) parent.appendChild(el);
  GAME.puzzleTarget = { name: entity, el, original, nextSibling, parent };
  GAME.mapView.centerEntity(entity);

  setQuestionNumber(GAME.questionIndex);
  const type = questionTypeOf(GAME.testEl);
  setMissionTarget(target, type, 'puzzle');
  setQuestionHtml(htmlFromConfig(cfgText('puzzleQuestion'), {
    ENTITYTYPE: escapeHtml(typeWithSpace(t(type))),
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
  let activePointerId = null;
  let cancelForGesture = null;
  const move = (event) => {
    if (!drag) return;
    event.preventDefault();
    if (!drag.moved) {
      const travelled = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
      if (travelled <= tapSlop(event.pointerType)) return;
      drag.moved = true;
    }
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
    if (activePointerId != null) {
      GAME.mapView?.endInteractiveDrag(activePointerId);
      activePointerId = null;
    }
    if (cancelForGesture) {
      GAME.mapView?.viewport.removeEventListener('map:gesturestart', cancelForGesture);
      cancelForGesture = null;
    }
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
    const moved = drag.moved;
    const cancelled = event.type === 'pointercancel';
    cleanup();
    circle.style.cursor = 'grab';
    circle.style.stroke = 'rgba(202, 138, 4, 0)';
    if (cancelled) return;
    if (!moved) {
      announce('Objekt sa neposunul. Potiahni ho na správne miesto.');
      return;
    }
    answerPuzzle(targetNode);
  };
  const start = (event) => {
    if (!GAME.active || GAME.answered || drag) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    const pt = GAME.mapView.toMapPoint(event.clientX, event.clientY);
    activePointerId = event.pointerId;
    GAME.mapView.beginInteractiveDrag(event.pointerId);
    drag = {
      startX: pt.x,
      startY: pt.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
      origX: GAME.mapView.entityPosition(entityName).x,
      origY: GAME.mapView.entityPosition(entityName).y,
    };
    cancelForGesture = () => {
      if (!drag) return;
      const original = { x: drag.origX, y: drag.origY };
      drag = null;
      GAME.mapView.setEntityTranslation(entityName, original.x, original.y);
      const box = GAME.mapView.entityBBox(entityName);
      if (box) {
        circle.setAttribute('cx', box.x + box.width / 2);
        circle.setAttribute('cy', box.y + box.height / 2);
      }
      cleanup();
      circle.style.cursor = 'grab';
      circle.style.stroke = 'rgba(202, 138, 4, 0)';
    };
    GAME.mapView.viewport.addEventListener('map:gesturestart', cancelForGesture);
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
  dom.mapViewportWrap.classList.add('is-answered');
  hideMapHint();
  removePuzzleHandle();

  const key = nodeEntity(targetNode);
  const tolerance = Number.parseFloat(classicData.cfg('puzzleTollerance') || '15') || 15;
  const position = GAME.mapView.entityPosition(key);
  const distance = Math.hypot(position.x - GAME.puzzleOrig.x, position.y - GAME.puzzleOrig.y);
  const correct = distance < tolerance;
  const isLast = GAME.questionIndex >= GAME.numQ;

  if (correct) {
    GAME.correct += 1;
    playCorrect();
    GAME.mapView.setEntityColor(key, '#77ff77');
    setQuestionHtml(cfgText('correctPuzzleAnswer'));
    setMissionFeedback('Správne umiestnené! +1', 'correct');
  } else {
    GAME.incorrect += 1;
    playWrong();
    GAME.mapView.setEntityColor(key, '#ff0000');
    setQuestionHtml(htmlFromConfig(cfgText('incorrectPuzzleAnswer'), {
      ENTITYNAME: escapeHtml(nodeLabel(targetNode)),
    }));
    setMissionFeedback('Nesprávne umiestnenie.', 'wrong');
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
  recordAttemptForNode(targetNode, 'puzzle', correct, correct ? 1 : 0, 1);

  const context = attemptContext();
  GAME.answers.push({
    label: nodeLabel(targetNode),
    correct,
    points: correct ? 1 : 0,
    maxPoints: 1,
    mode: 'puzzle',
    distance: Math.round(distance),
    mapKey: context.mapKey,
    mapLabel: context.mapLabel,
    markSymbol: targetNode.getAttribute('markSymbol') || '',
    entity: nodeEntity(targetNode),
  });
  updateScore();
  updateProgress();
  dom.next.disabled = false;
  const suffix = isLast ? cfgText('lastPuzzleQuestion') : cfgText('nextPuzzleQuestion');
  dom.question.innerHTML += ` ${suffix}`;
  if (isLast) stopClock();
  announce(correct ? 'Správne umiestnené.' : 'Nesprávne umiestnené.');
}

function showPuzzleFinal() {
  GAME.finalShown = true;
  GAME.active = false;
  stopClock();
  hideMapHint();
  removePuzzleHandle();
  clearMarks();
  if (GAME.puzzlePrevious && GAME.puzzlePrevious.wasIncorrect) {
    GAME.mapView.setEntityColor(GAME.puzzlePrevious.entity, '#ff7777');
    GAME.puzzlePrevious = null;
  }
  setQuestionNumber(0);
  const answered = GAME.correct + GAME.incorrect;
  const percent = answered ? Math.round((GAME.correct / answered) * 100) : 0;
  playResult(percent);
  const type = GAME.testEl.getAttribute('answer') || GAME.testEl.getAttribute('question') || GAME.testEl.getAttribute('label') || '';
  const finalType = answered === 1 && type === 'štátov' ? 'štátu' : type;
  setQuestionHtml(htmlFromConfig(cfgText('puzzleFinalScore'), {
    CORRECTQ: spaced(GAME.correct),
    TOTALQ: spaced(answered),
    TOTALTIME: spaced(timeText()),
    PERCENT: spaced(percent),
    ENTITYTYPE: escapeHtml(t(finalType)),
  }));
  dom.next.disabled = true;
  dom.progress.style.width = '100%';
  showResult({
    title: t('Poskladaj! — výsledok'),
    percent,
    primaryValue: `${GAME.correct}/${answered}`,
    primaryLabel: t('správne'),
    time: timeText(),
    finalHtml: dom.question.innerHTML,
    rows: GAME.answers.map((row) => [
      row.label,
      row.correct ? '✓' : '✕',
      row.correct ? '1' : '0',
    ]),
    columns: [t('Objekt'), t('Uloženie'), t('Body')],
  });
}

/* ------------------------------------------------------------------------- */
/* next / end                                                                */
/* ------------------------------------------------------------------------- */

function advanceGame() {
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
}

function bindGameEvents() {
  dom.next.addEventListener('click', advanceGame);
  dom.nextFloat?.addEventListener('click', () => {
    if (GAME.finalShown && dom.resultOverlay.hidden) openOverlay(dom.resultOverlay, dom.resultAgain);
    else advanceGame();
  });
  window.addEventListener('resize', () => requestAnimationFrame(positionNextFloat));
  dom.end.addEventListener('click', () => endActivity());
  dom.homeBtn?.addEventListener('click', () => endActivity());
  dom.zoomIn.addEventListener('click', () => GAME.mapView?.zoomIn());
  dom.zoomOut.addEventListener('click', () => GAME.mapView?.zoomOut());
  dom.zoomCenter?.addEventListener('click', () => GAME.mapView?.center());
  dom.zoomFit.addEventListener('click', () => GAME.mapView?.fit());
  document.addEventListener('keydown', (event) => {
    if (dom.classicScreen.hidden) return;
    if (!document.querySelector('#helpOverlay')?.hidden) return;
    if (document.querySelector('.overlay.is-open')) return;
    const inControl = event.target.closest?.('button, a, input, select, textarea, [contenteditable]');
    if ((event.key === 'Enter' || event.key === ' ') && !inControl && !dom.next.disabled && !dom.next.hidden) {
      event.preventDefault();
      dom.next.click();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      endActivity();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      GAME.mapView?.zoomIn();
    } else if (event.key === '-') {
      event.preventDefault();
      GAME.mapView?.zoomOut();
    } else if (event.key === '0') {
      event.preventDefault();
      GAME.mapView?.fit();
    } else if (!inControl && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 190 : 64;
      if (event.key === 'ArrowLeft') GAME.mapView?.panBy(step, 0);
      else if (event.key === 'ArrowRight') GAME.mapView?.panBy(-step, 0);
      else if (event.key === 'ArrowUp') GAME.mapView?.panBy(0, step);
      else GAME.mapView?.panBy(0, -step);
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

function disposeClassicGame() {
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

export function goHome() {
  disposeClassicGame();
  navigate({ screen: 'home' }, { replace: true });
}

if (typeof window !== 'undefined') {
  window.addEventListener('route:change', (event) => {
    if (event.detail?.route?.screen !== 'classic-game') disposeClassicGame();
  });
}

/* ------------------------------------------------------------------------- */
/* result dialog                                                             */
/* ------------------------------------------------------------------------- */

function syncResultReopen() {
  if (!dom.resultBtn) return;
  const show = Boolean(GAME.finalShown && dom.resultOverlay.hidden && !dom.classicScreen.hidden);
  dom.resultBtn.hidden = !show;
  syncNextFloat();
}

function bindResultEvents() {
  if (!dom.resultOverlay) return;
  dom.resultBtn?.addEventListener('click', () => {
    openOverlay(dom.resultOverlay, dom.resultAgain);
  });
  new MutationObserver(syncResultReopen).observe(dom.resultOverlay, {
    attributes: true,
    attributeFilter: ['hidden', 'class'],
  });
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
  dom.next.hidden = true;
  if (dom.nextFloat) dom.nextFloat.hidden = true;
  openOverlay(dom.resultOverlay, dom.resultAgain);
}

/* ------------------------------------------------------------------------- */
/* helpers                                                                   */
/* ------------------------------------------------------------------------- */

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
