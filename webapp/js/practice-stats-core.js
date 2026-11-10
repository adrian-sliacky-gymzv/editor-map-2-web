/* ------------------------------------------------------------------------- */
/* Practice weaknesses — pure data model                                     */
/*                                                                           */
/* Kept free of DOM/storage so the ranking, migration and aggregate logic     */
/* can be unit-tested in Node and reused by the browser wrapper.              */
/* ------------------------------------------------------------------------- */

export const STORE_VERSION = 1;
export const WEAK_THRESHOLD = 0.75;
export const MAX_SESSIONS = 40;
export const MAX_OBJECTS = 2500;
export const MAX_SELECTION = 50;

export const MODE_LABELS = {
  test: 'Vyskúšaj sa!',
  distance: 'Traf sa!',
  puzzle: 'Poskladaj!',
};

export const FORMAT_LABELS = {
  mixed: 'Zmiešané',
  test: 'Vyskúšaj sa!',
  distance: 'Traf sa!',
  puzzle: 'Poskladaj!',
};

const MODE_KEYS = new Set(['test', 'distance', 'puzzle']);
const MODE_LABEL_TO_KEY = {
  'vyskúšaj sa!': 'test',
  'traf sa!': 'distance',
  'poskladaj!': 'puzzle',
};

export function objectKey(mapKey, entity) {
  return `${String(mapKey || '').trim()}::${String(entity || '').trim()}`;
}

export function clampNumber(value, min, max = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function normalizeSearch(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sk')
    .trim();
}

export function normalizeMode(value) {
  if (MODE_KEYS.has(value)) return value;
  return MODE_LABEL_TO_KEY[String(value || '').toLocaleLowerCase('sk')] || null;
}

export function emptyStore(now = Date.now()) {
  return {
    version: STORE_VERSION,
    createdAt: now,
    updatedAt: now,
    objects: {},
    sessions: [],
  };
}

function emptyModeStats() {
  return { attempts: 0, correct: 0, score: 0, maxScore: 0 };
}

function normalizeModeStats(raw) {
  const stats = emptyModeStats();
  if (!raw || typeof raw !== 'object') return stats;
  stats.attempts = Math.max(0, Math.round(Number(raw.attempts) || 0));
  stats.correct = clampNumber(raw.correct, 0, stats.attempts);
  stats.score = Math.max(0, Number(raw.score) || 0);
  stats.maxScore = Math.max(0, Number(raw.maxScore) || 0);
  if (stats.maxScore < stats.score) stats.maxScore = stats.score;
  return stats;
}

function normalizeRecord(raw, fallbackKey = '') {
  if (!raw || typeof raw !== 'object') return null;
  const mapKey = String(raw.mapKey || '').trim();
  const entity = String(raw.entity || '').trim();
  if (!mapKey || !entity) return null;
  const modes = {};
  for (const mode of MODE_KEYS) {
    modes[mode] = normalizeModeStats(raw.modes?.[mode]);
  }
  const attempts = Math.max(
    Math.round(Number(raw.attempts) || 0),
    ...Object.values(modes).map((m) => m.attempts),
  );
  let correct = clampNumber(raw.correct, 0, attempts);
  let score = Math.max(0, Number(raw.score) || 0);
  let maxScore = Math.max(0, Number(raw.maxScore) || 0);
  const modeScore = Object.values(modes).reduce((sum, m) => sum + m.score, 0);
  const modeMax = Object.values(modes).reduce((sum, m) => sum + m.maxScore, 0);
  if (modeMax > 0) {
    score = modeScore;
    maxScore = modeMax;
    correct = Math.min(attempts, Object.values(modes).reduce((sum, m) => sum + m.correct, 0));
  }
  if (maxScore < score) maxScore = score;
  const lastScore = maxScore > 0
    ? Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)))
    : clampNumber(raw.lastScore, 0, 100);
  return {
    key: String(raw.key || fallbackKey || objectKey(mapKey, entity)),
    mapKey,
    mapLabel: String(raw.mapLabel || mapKey).slice(0, 120),
    entity,
    label: String(raw.label || entity).slice(0, 220),
    markSymbol: String(raw.markSymbol || '').slice(0, 40),
    attempts,
    correct,
    score,
    maxScore,
    firstSeenAt: Math.max(0, Number(raw.firstSeenAt) || 0),
    lastSeenAt: Math.max(0, Number(raw.lastSeenAt) || 0),
    lastMode: normalizeMode(raw.lastMode) || 'test',
    lastSource: raw.lastSource === 'practice' ? 'practice' : 'game',
    lastResult: raw.lastResult === 'incorrect' ? 'incorrect' : 'correct',
    lastScore,
    modes,
  };
}

export function normalizeStore(raw) {
  const base = emptyStore(Number(raw?.createdAt) || Date.now());
  if (!raw || typeof raw !== 'object') return base;
  base.version = STORE_VERSION;
  base.createdAt = Math.max(0, Number(raw.createdAt) || base.createdAt);
  base.updatedAt = Math.max(0, Number(raw.updatedAt) || base.updatedAt);

  const rawObjects = raw.objects;
  if (rawObjects && typeof rawObjects === 'object') {
    const entries = Array.isArray(rawObjects)
      ? rawObjects.map((record) => [record?.key, record])
      : Object.entries(rawObjects);
    for (const [fallbackKey, record] of entries) {
      const normalized = normalizeRecord(record, fallbackKey);
      if (normalized) base.objects[normalized.key] = normalized;
    }
  }

  if (Array.isArray(raw.sessions)) {
    base.sessions = raw.sessions
      .filter((session) => session && typeof session === 'object')
      .map((session) => ({
        id: String(session.id || ''),
        startedAt: Math.max(0, Number(session.startedAt) || 0),
        endedAt: Math.max(0, Number(session.endedAt) || 0),
        mode: String(session.mode || 'practice'),
        source: String(session.source || 'game'),
        format: String(session.format || ''),
        maps: Array.isArray(session.maps) ? [...new Set(session.maps.map((m) => String(m).slice(0, 120)))].slice(0, 8) : [],
        questions: Math.max(0, Math.round(Number(session.questions) || 0)),
        answered: Math.max(0, Math.round(Number(session.answered) || 0)),
        correct: Math.max(0, Math.round(Number(session.correct) || 0)),
        score: Math.max(0, Number(session.score) || 0),
        maxScore: Math.max(0, Number(session.maxScore) || 0),
        percent: clampNumber(session.percent, 0, 100),
      }))
      .filter((session) => session.answered > 0)
      .slice(0, MAX_SESSIONS);
  }
  pruneObjects(base);
  return base;
}

export function recordAttemptInStore(store, attempt = {}) {
  const mapKey = String(attempt.mapKey || '').trim();
  const entity = String(attempt.entity || '').trim();
  const mode = normalizeMode(attempt.mode) || 'test';
  if (!mapKey || !entity) return null;
  const at = Math.max(0, Number(attempt.at) || Date.now());
  const key = objectKey(mapKey, entity);
  let record = store.objects[key];
  if (!record) {
    record = {
      key,
      mapKey,
      mapLabel: String(attempt.mapLabel || mapKey).slice(0, 120),
      entity,
      label: String(attempt.label || entity).slice(0, 220),
      markSymbol: String(attempt.markSymbol || '').slice(0, 40),
      attempts: 0,
      correct: 0,
      score: 0,
      maxScore: 0,
      firstSeenAt: at,
      lastSeenAt: at,
      lastMode: mode,
      lastSource: attempt.source === 'practice' ? 'practice' : 'game',
      lastResult: 'correct',
      lastScore: 0,
      modes: {
        test: emptyModeStats(),
        distance: emptyModeStats(),
        puzzle: emptyModeStats(),
      },
    };
    store.objects[key] = record;
  }

  const maxScore = Math.max(0.0001, Number(attempt.maxScore) || 1);
  const hasScore = attempt.score != null && Number.isFinite(Number(attempt.score));
  const correct = attempt.correct != null
    ? !!attempt.correct
    : hasScore && Number(attempt.score) >= maxScore * 0.7;
  const score = clampNumber(hasScore ? attempt.score : (correct ? maxScore : 0), 0, maxScore);

  record.mapLabel = String(attempt.mapLabel || record.mapLabel || mapKey).slice(0, 120);
  record.label = String(attempt.label || record.label || entity).slice(0, 220);
  record.markSymbol = String(attempt.markSymbol || record.markSymbol || '').slice(0, 40);
  record.attempts += 1;
  if (correct) record.correct += 1;
  record.score += score;
  record.maxScore += maxScore;
  record.lastSeenAt = at;
  record.lastMode = mode;
  record.lastSource = attempt.source === 'practice' ? 'practice' : 'game';
  record.lastResult = correct ? 'correct' : 'incorrect';
  record.lastScore = Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
  if (!record.firstSeenAt) record.firstSeenAt = at;

  const modeStats = record.modes[mode] || emptyModeStats();
  modeStats.attempts += 1;
  if (correct) modeStats.correct += 1;
  modeStats.score += score;
  modeStats.maxScore += maxScore;
  record.modes[mode] = modeStats;

  store.updatedAt = Math.max(store.updatedAt, at);
  pruneObjects(store);
  return record;
}

export function recordSessionInStore(store, session = {}) {
  const answered = Math.max(0, Math.round(Number(session.answered) || 0));
  if (!answered) return null;
  const endedAt = Math.max(0, Number(session.endedAt) || Date.now());
  const maxScore = Math.max(0, Number(session.maxScore) || 0);
  const score = clampNumber(session.score, 0, maxScore || Number.POSITIVE_INFINITY);
  const normalized = {
    id: String(session.id || `${endedAt}-${Math.random().toString(36).slice(2, 8)}`),
    startedAt: Math.max(0, Number(session.startedAt) || endedAt),
    endedAt,
    mode: String(session.mode || 'practice').slice(0, 30),
    source: String(session.source || 'game').slice(0, 30),
    format: String(session.format || '').slice(0, 30),
    maps: Array.isArray(session.maps)
      ? [...new Set(session.maps.map((m) => String(m).slice(0, 120)))].slice(0, 8)
      : [],
    questions: Math.max(0, Math.round(Number(session.questions) || answered)),
    answered,
    correct: Math.max(0, Math.round(Number(session.correct) || 0)),
    score,
    maxScore,
    percent: maxScore > 0
      ? Math.round((score / maxScore) * 100)
      : Math.round((Number(session.correct) || 0) / answered * 100),
  };
  normalized.correct = Math.min(normalized.correct, normalized.answered);
  store.sessions.unshift(normalized);
  store.sessions = store.sessions.slice(0, MAX_SESSIONS);
  store.updatedAt = Math.max(store.updatedAt, endedAt);
  return normalized;
}

export function modeStatsFor(record, mode = 'all') {
  if (!record) return emptyModeStats();
  const normalized = normalizeMode(mode);
  if (!normalized) {
    return {
      attempts: record.attempts,
      correct: record.correct,
      score: record.score,
      maxScore: record.maxScore,
    };
  }
  return record.modes?.[normalized] || emptyModeStats();
}

export function accuracyFor(record, mode = 'all') {
  const stats = modeStatsFor(record, mode);
  if (!stats.maxScore) return 0;
  return Math.max(0, Math.min(1, stats.score / stats.maxScore));
}

export function isWeakRecord(record, { mode = 'all', threshold = WEAK_THRESHOLD } = {}) {
  const stats = modeStatsFor(record, mode);
  return stats.attempts > 0 && accuracyFor(record, mode) < threshold;
}

export function answerSuccess(points, maxPoints, threshold = 0.7) {
  const max = Number(maxPoints) || 1;
  return (Number(points) || 0) >= max * threshold;
}

export function listWeaknesses(store, options = {}) {
  const {
    mapKey = 'all',
    mode = 'all',
    minAttempts = 1,
    query = '',
    sort = 'weakest',
    includeStrong = false,
    threshold = WEAK_THRESHOLD,
    limit = 100,
  } = options;
  const normalizedMode = normalizeMode(mode) || 'all';
  const normalizedQuery = normalizeSearch(query);
  const items = [];
  for (const record of Object.values(store?.objects || {})) {
    if (mapKey !== 'all' && record.mapKey !== mapKey) continue;
    const stats = modeStatsFor(record, normalizedMode);
    if (stats.attempts < Math.max(1, Number(minAttempts) || 1)) continue;
    const accuracy = stats.maxScore > 0 ? stats.score / stats.maxScore : 0;
    if (!includeStrong && accuracy >= threshold) continue;
    if (normalizedQuery) {
      const haystack = normalizeSearch(`${record.label} ${record.mapLabel} ${record.entity} ${record.markSymbol}`);
      if (!haystack.includes(normalizedQuery)) continue;
    }
    items.push({
      ...record,
      attempts: stats.attempts,
      correct: stats.correct,
      score: stats.score,
      maxScore: stats.maxScore,
      accuracy,
      accuracyPct: Math.round(accuracy * 100),
      weak: accuracy < threshold,
      modesUsed: [...MODE_KEYS].filter((key) => (record.modes?.[key]?.attempts || 0) > 0),
    });
  }
  switch (sort) {
    case 'recent':
      items.sort((a, b) => b.lastSeenAt - a.lastSeenAt || a.accuracy - b.accuracy);
      break;
    case 'attempts':
      items.sort((a, b) => b.attempts - a.attempts || a.accuracy - b.accuracy);
      break;
    case 'label':
      items.sort((a, b) => a.label.localeCompare(b.label, 'sk'));
      break;
    case 'weakest':
    default:
      items.sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || b.lastSeenAt - a.lastSeenAt);
      break;
  }
  return items.slice(0, Math.max(1, Number(limit) || 100));
}

export function summarizeStore(store) {
  const records = Object.values(store?.objects || {});
  let attempts = 0;
  let correct = 0;
  let score = 0;
  let maxScore = 0;
  let weakCount = 0;
  const maps = new Set();
  for (const record of records) {
    attempts += record.attempts;
    correct += record.correct;
    score += record.score;
    maxScore += record.maxScore;
    maps.add(record.mapKey);
    if (isWeakRecord(record)) weakCount += 1;
  }
  const sessions = store?.sessions || [];
  return {
    tracked: records.length,
    attempts,
    correct,
    weakCount,
    strongCount: Math.max(0, records.length - weakCount),
    mapsTracked: maps.size,
    accuracy: maxScore > 0 ? score / maxScore : 0,
    accuracyPct: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    sessions: sessions.length,
    lastSession: sessions[0] || null,
    recentSessions: sessions.slice(0, 6),
    topWeak: listWeaknesses(store, { limit: 3, minAttempts: 1 }),
    hasData: records.length > 0,
  };
}

export function pruneObjects(store) {
  const entries = Object.entries(store.objects || {});
  if (entries.length <= MAX_OBJECTS) return store;
  entries.sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0));
  store.objects = Object.fromEntries(entries.slice(0, MAX_OBJECTS));
  return store;
}

export function serializeStore(store) {
  return JSON.stringify(normalizeStore(store), null, 2);
}

export function parseImportedStore(text) {
  let raw;
  try {
    raw = JSON.parse(String(text || ''));
  } catch {
    throw new Error('Súbor nie je platný JSON.');
  }
  if (!raw || typeof raw !== 'object' || !raw.objects || typeof raw.objects !== 'object') {
    throw new Error('Súbor neobsahuje štatistiky tréningu.');
  }
  const store = normalizeStore(raw);
  if (!Object.keys(store.objects).length) throw new Error('Súbor neobsahuje žiadne objekty.');
  return store;
}
