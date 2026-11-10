import test from 'node:test';
import assert from 'node:assert/strict';

import { CITIES } from '../js/cities.js';
import {
  percentOf,
  buildQuizOptions,
  normalizeText,
  filterCities,
  puzzleTolerance,
  isPuzzleCorrect,
  emptyStats,
  averageStats,
  mergeStats,
} from '../js/modes.js';

test('quiz/puzzle percentage rounds like the original', () => {
  assert.equal(percentOf(0, 0), 0);
  assert.equal(percentOf(7, 10), 70);
  assert.equal(percentOf(1, 3), 33);
  assert.equal(percentOf(2, 3), 67);
  assert.equal(percentOf(10, 10), 100);
});

test('quiz options include the target once and stay unique', () => {
  const target = CITIES.find((c) => c.label === 'Žilina');
  const options = buildQuizOptions(target, CITIES, 7, () => 0.42);
  assert.equal(options.length, 7);
  assert.equal(new Set(options.map((c) => c.entity)).size, 7);
  assert.ok(options.some((c) => c.entity === target.entity));
  assert.equal(options.filter((c) => c.entity === target.entity).length, 1);
});

test('quiz options clamp to the pool and never mutate the pool', () => {
  const pool = CITIES.slice(0, 4);
  const target = pool[0];
  const before = JSON.stringify(pool);
  assert.equal(buildQuizOptions(target, pool, 99).length, 4);
  assert.equal(buildQuizOptions(target, pool, 1).length, 1);
  assert.equal(JSON.stringify(pool), before);
});

test('quiz options contain no duplicate cities even with repeated rng', () => {
  const target = CITIES.find((c) => c.label === 'Bratislava');
  const options = buildQuizOptions(target, CITIES, 7, () => 0.5);
  assert.equal(new Set(options.map((c) => c.entity)).size, options.length);
  assert.ok(options.some((c) => c.entity === target.entity));
});

test('search normalization ignores Slovak diacritics', () => {
  assert.equal(normalizeText('Žilina'), 'zilina');
  assert.equal(normalizeText('Banská Štiavnica'), 'banska stiavnica');
  assert.equal(normalizeText('Košice'), 'kosice');
  assert.equal(normalizeText('  Nové Zámky  '), 'nove zamky');
});

test('atlas level filters are cumulative like the game difficulties', () => {
  assert.equal(filterCities(CITIES, { level: 'all' }).length, 74);
  assert.equal(filterCities(CITIES, { level: 1 }).length, 12);
  assert.equal(filterCities(CITIES, { level: 2 }).length, 49);
  assert.equal(filterCities(CITIES, { level: 3 }).length, 74);
});

test('atlas search combines with the level filter', () => {
  const zilina = filterCities(CITIES, { query: 'zilina' });
  assert.deepEqual(zilina.map((c) => c.label), ['Žilina']);

  const banska = filterCities(CITIES, { query: 'banska' });
  assert.deepEqual(banska.map((c) => c.label).sort(), ['Banská Bystrica', 'Banská Štiavnica']);

  assert.equal(filterCities(CITIES, { query: 'zilina', level: 1 }).length, 1);
  assert.equal(filterCities(CITIES, { query: 'zilina', level: 3 }).length, 1);
  assert.equal(filterCities(CITIES, { query: 'neexistuje' }).length, 0);
});

test('puzzle tolerance keeps at least 15 map units and scales on tiny screens', () => {
  assert.equal(puzzleTolerance(0), 15);
  assert.equal(puzzleTolerance(0.5), 15);
  assert.ok(Math.abs(puzzleTolerance(1.1519721577726219) - 23.039443155452438) < 1e-9);
  assert.ok(Math.abs(puzzleTolerance(2.546153846153846) - 50.92307692307693) < 1e-9);
  assert.ok(Math.abs(puzzleTolerance(2.546153846153846, 30, 15) - 76.38461538461539) < 1e-9);
});

test('puzzle correctness uses the rounded distance and the tolerance', () => {
  const target = { x: 100, y: 100 };
  assert.equal(isPuzzleCorrect({ x: 100, y: 100 }, target, 15), true);
  assert.equal(isPuzzleCorrect({ x: 115, y: 100 }, target, 15), true);
  assert.equal(isPuzzleCorrect({ x: 116, y: 100 }, target, 15), false);
  assert.equal(isPuzzleCorrect({ x: 100, y: 100 }, target, 0), true);
});

test('stats merge keeps best, games and totals without mutating the input', () => {
  const stats = emptyStats();
  const snapshot = JSON.stringify(stats);

  const first = mergeStats(stats, 'distance', { percent: 50, points: 100, possible: 200 });
  assert.equal(first.distance.games, 1);
  assert.equal(first.distance.best, 50);
  assert.equal(first.distance.points, 100);
  assert.equal(first.distance.possible, 200);
  assert.equal(JSON.stringify(stats), snapshot);

  const second = mergeStats(first, 'distance', { percent: 80, points: 160, possible: 200 });
  assert.equal(second.distance.games, 2);
  assert.equal(second.distance.best, 80);
  assert.equal(second.distance.points, 260);
  assert.equal(second.distance.possible, 400);

  const quiz = mergeStats(second, 'quiz', { percent: 70, correct: 7, total: 10 });
  assert.equal(quiz.quiz.games, 1);
  assert.equal(quiz.quiz.best, 70);
  assert.equal(quiz.quiz.correct, 7);
  assert.equal(quiz.quiz.total, 10);
  assert.equal(quiz.distance.games, 2);
});

test('stats averages are derived from the stored totals', () => {
  const stats = emptyStats();
  assert.equal(averageStats(stats.distance, 'distance'), 0);
  assert.equal(averageStats(stats.quiz, 'quiz'), 0);

  const withDistance = mergeStats(stats, 'distance', { percent: 75, points: 300, possible: 400 });
  assert.equal(averageStats(withDistance.distance, 'distance'), 75);

  const withQuiz = mergeStats(withDistance, 'quiz', { percent: 60, correct: 6, total: 10 });
  assert.equal(averageStats(withQuiz.quiz, 'quiz'), 60);
});
