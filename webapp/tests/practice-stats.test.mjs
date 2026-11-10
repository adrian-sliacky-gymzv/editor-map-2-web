import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_OBJECTS,
  MAX_SESSIONS,
  WEAK_THRESHOLD,
  accuracyFor,
  answerSuccess,
  emptyStore,
  isWeakRecord,
  listWeaknesses,
  normalizeSearch,
  normalizeStore,
  objectKey,
  parseImportedStore,
  recordAttemptInStore,
  recordSessionInStore,
  serializeStore,
  summarizeStore,
} from '../js/practice-stats-core.js';

function attempt(store, overrides = {}) {
  return recordAttemptInStore(store, {
    mapKey: 'slovensko',
    mapLabel: 'Slovensko',
    entity: 'mesta_Zilina_mesto',
    label: 'Žilina',
    markSymbol: 'town',
    mode: 'test',
    correct: false,
    maxScore: 1,
    at: 1_700_000_000_000,
    ...overrides,
  });
}

test('empty store has a stable versioned shape', () => {
  const store = emptyStore(123);
  assert.equal(store.version, 1);
  assert.equal(store.createdAt, 123);
  assert.deepEqual(store.objects, {});
  assert.deepEqual(store.sessions, []);
});

test('attempts aggregate current, per-mode and percent values', () => {
  const store = emptyStore();
  attempt(store, { correct: false, score: 0, maxScore: 1 });
  attempt(store, { correct: true, score: 1, maxScore: 1, at: 1_700_000_000_100 });
  attempt(store, { mode: 'distance', correct: true, score: 80, maxScore: 100, at: 1_700_000_000_200 });
  const record = store.objects[objectKey('slovensko', 'mesta_Zilina_mesto')];
  assert.equal(record.attempts, 3);
  assert.equal(record.correct, 2);
  assert.equal(record.score, 81);
  assert.equal(record.maxScore, 102);
  assert.equal(record.modes.test.attempts, 2);
  assert.equal(record.modes.distance.attempts, 1);
  assert.equal(record.lastMode, 'distance');
  assert.equal(record.lastResult, 'correct');
  assert.equal(record.lastScore, 80);
  assert.equal(Math.round(accuracyFor(record) * 100), 79);
});

test('distance attempts can be marked correct only when the caller says so', () => {
  const store = emptyStore();
  attempt(store, { mode: 'distance', correct: false, score: 69, maxScore: 100 });
  const record = Object.values(store.objects)[0];
  assert.equal(record.lastResult, 'incorrect');
  assert.equal(record.lastScore, 69);
  assert.equal(accuracyFor(record, 'distance'), 0.69);
});

test('weakness filter, threshold, map, mode, attempts and query work together', () => {
  const store = emptyStore();
  attempt(store, { mapKey: 'slovensko', entity: 'a', label: 'Žilina', correct: false });
  attempt(store, { mapKey: 'slovensko', entity: 'b', label: 'Košice', correct: true });
  attempt(store, { mapKey: 'europa', entity: 'c', label: 'Viedeň', mapLabel: 'Európa', correct: false });
  attempt(store, { mapKey: 'europa', entity: 'c', label: 'Viedeň', mapLabel: 'Európa', correct: false });
  const weak = listWeaknesses(store, {});
  assert.equal(weak.length, 2);
  assert.equal(weak[0].entity, 'c');
  assert.equal(weak[0].attempts, 2);
  assert.equal(listWeaknesses(store, { mapKey: 'slovensko' }).length, 1);
  assert.equal(listWeaknesses(store, { mode: 'distance' }).length, 0);
  assert.equal(listWeaknesses(store, { minAttempts: 2 }).length, 1);
  assert.equal(listWeaknesses(store, { query: 'zilina' }).length, 1);
  assert.equal(listWeaknesses(store, { includeStrong: true }).length, 3);
});

test('ranking sorts by weakest, recent, attempts and label', () => {
  const store = emptyStore();
  attempt(store, { entity: 'a', label: 'A', correct: true, at: 100 });
  attempt(store, { entity: 'b', label: 'B', correct: false, at: 200 });
  attempt(store, { entity: 'c', label: 'C', correct: false, at: 300 });
  attempt(store, { entity: 'c', label: 'C', correct: false, at: 400 });
  assert.equal(listWeaknesses(store, { sort: 'weakest' })[0].entity, 'c');
  assert.equal(listWeaknesses(store, { sort: 'recent' })[0].entity, 'c');
  assert.equal(listWeaknesses(store, { sort: 'attempts' })[0].entity, 'c');
  assert.equal(listWeaknesses(store, { sort: 'label' })[0].entity, 'b');
});

test('mode-specific accuracy drives mode filtering', () => {
  const store = emptyStore();
  attempt(store, { entity: 'a', mode: 'test', correct: false });
  attempt(store, { entity: 'a', mode: 'distance', correct: true, score: 100, maxScore: 100 });
  const record = Object.values(store.objects)[0];
  assert.equal(Math.round(accuracyFor(record, 'test') * 100), 0);
  assert.equal(Math.round(accuracyFor(record, 'distance') * 100), 100);
  assert.equal(listWeaknesses(store, { mode: 'test' }).length, 1);
  assert.equal(listWeaknesses(store, { mode: 'distance' }).length, 0);
});

test('weakness threshold is exactly 75 percent', () => {
  const store = emptyStore();
  attempt(store, { entity: 'weak', correct: false });
  attempt(store, { entity: 'strong', correct: true });
  assert.equal(isWeakRecord(store.objects[objectKey('slovensko', 'weak')], { threshold: WEAK_THRESHOLD }), true);
  assert.equal(isWeakRecord(store.objects[objectKey('slovensko', 'strong')], { threshold: WEAK_THRESHOLD }), false);
});

test('search normalisation ignores Slovak diacritics and case', () => {
  assert.equal(normalizeSearch('ŽILINA'), 'zilina');
  assert.equal(normalizeSearch('Košice'), 'kosice');
  assert.equal(normalizeSearch('Banská Bystrica'), 'banska bystrica');
});

test('sessions are capped and derive weighted percentages', () => {
  const store = emptyStore();
  for (let i = 0; i < MAX_SESSIONS + 5; i += 1) {
    recordSessionInStore(store, {
      startedAt: i,
      endedAt: i + 1,
      answered: 2,
      correct: 1,
      score: i % 2 ? 100 : 50,
      maxScore: 200,
      maps: ['Slovensko'],
    });
  }
  assert.equal(store.sessions.length, MAX_SESSIONS);
  assert.equal(store.sessions[0].percent, 25);
  assert.ok(store.sessions[0].endedAt > store.sessions[1].endedAt);
});

test('zero-answer sessions are ignored', () => {
  const store = emptyStore();
  assert.equal(recordSessionInStore(store, { answered: 0 }), null);
  assert.equal(store.sessions.length, 0);
});

test('summary counts tracked, weak, attempts and accuracy', () => {
  const store = emptyStore();
  attempt(store, { entity: 'a', correct: false });
  attempt(store, { entity: 'b', correct: true });
  const summary = summarizeStore(store);
  assert.equal(summary.tracked, 2);
  assert.equal(summary.weakCount, 1);
  assert.equal(summary.attempts, 2);
  assert.equal(summary.accuracyPct, 50);
  assert.equal(summary.hasData, true);
});

test('export and import round-trip preserves records and sessions', () => {
  const store = emptyStore();
  attempt(store);
  recordSessionInStore(store, { answered: 1, correct: 0, score: 0, maxScore: 1, endedAt: 99 });
  const json = serializeStore(store);
  const parsed = parseImportedStore(json);
  assert.equal(Object.keys(parsed.objects).length, 1);
  assert.equal(parsed.sessions.length, 1);
  assert.equal(parsed.objects[objectKey('slovensko', 'mesta_Zilina_mesto')].attempts, 1);
});

test('invalid imports are rejected clearly', () => {
  assert.throws(() => parseImportedStore('not json'), /JSON/);
  assert.throws(() => parseImportedStore('{"objects": null}'), /štatistiky/);
  assert.throws(() => parseImportedStore('{"objects": {}}'), /žiadne objekty/);
});

test('normalisation repairs partial and legacy records', () => {
  const store = normalizeStore({
    version: 99,
    objects: {
      'slovensko::mesta_Zilina_mesto': {
        mapKey: 'slovensko',
        entity: 'mesta_Zilina_mesto',
        label: 'Žilina',
        attempts: 2,
        correct: 1,
        modes: {
          test: { attempts: 2, correct: 1, score: 1, maxScore: 2 },
        },
      },
    },
    sessions: [{ answered: 1, correct: 0, score: 0, maxScore: 1 }],
  });
  const record = store.objects[objectKey('slovensko', 'mesta_Zilina_mesto')];
  assert.equal(store.version, 1);
  assert.equal(record.attempts, 2);
  assert.equal(record.correct, 1);
  assert.equal(record.modes.distance.attempts, 0);
  assert.equal(store.sessions.length, 1);
});

test('object cap keeps the most recently seen records', () => {
  const store = emptyStore();
  for (let i = 0; i < MAX_OBJECTS + 3; i += 1) {
    attempt(store, { entity: `e${i}`, at: i + 1 });
  }
  assert.equal(Object.keys(store.objects).length, MAX_OBJECTS);
  assert.equal(store.objects[objectKey('slovensko', 'e0')], undefined);
  assert.ok(store.objects[objectKey('slovensko', `e${MAX_OBJECTS + 2}`)]);
});

test('answer success threshold matches the 70-point feedback boundary', () => {
  assert.equal(answerSuccess(70, 100), true);
  assert.equal(answerSuccess(69, 100), false);
  assert.equal(answerSuccess(1, 1), true);
  assert.equal(answerSuccess(0, 1), false);
});
