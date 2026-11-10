import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_DIST,
  MAP_WIDTH,
  MAP_HEIGHT,
  scoreForDistance,
  scoreForGuess,
  distanceBetween,
  finalPercent,
  formatTime,
  formatScore,
  feedbackForScore,
  citiesForLevel,
  pickTargets,
} from '../js/scoring.js';
import { CITIES, CITY_COUNT, LEVEL_COUNTS } from '../js/cities.js';

test('map constants match the original 993 x 520 vector map', () => {
  assert.equal(MAP_WIDTH, 993);
  assert.equal(MAP_HEIGHT, 520);
  assert.equal(MAX_DIST, 1121);
});

test('original distance formula gives exact known scores', () => {
  // score = round((1121 - 3 * dist) / 1121 * 100), then < 5 becomes 0
  assert.equal(scoreForDistance(0), 100);
  assert.equal(scoreForDistance(1), 100);
  assert.equal(scoreForDistance(37), 90);
  assert.equal(scoreForDistance(40), 89);
  assert.equal(scoreForDistance(112), 70);
  assert.equal(scoreForDistance(114), 69);
  assert.equal(scoreForDistance(300), 20);
  assert.equal(scoreForDistance(355), 5);
  assert.equal(scoreForDistance(356), 5);
  assert.equal(scoreForDistance(357), 0);
  assert.equal(scoreForDistance(374), 0);
  assert.equal(scoreForDistance(1000), 0);
  assert.equal(scoreForDistance(MAX_DIST), 0);
});

test('scores below five are always rewritten to zero', () => {
  for (let dist = 356; dist < 1200; dist += 1) {
    const raw = Math.round(((MAX_DIST - 3 * dist) / MAX_DIST) * 100);
    const expected = raw < 5 ? 0 : raw;
    assert.equal(scoreForDistance(dist), expected, `distance ${dist}`);
  }
});

test('distanceBetween rounds the Euclidean distance like Point.distance + Math.round', () => {
  assert.equal(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(distanceBetween({ x: 0, y: 0 }, { x: 37.4, y: 0 }), 37);
  assert.equal(distanceBetween({ x: 10, y: 10 }, { x: 10, y: 10 }), 0);
});

test('scoreForGuess rounds distance before scoring', () => {
  assert.equal(scoreForGuess({ x: 0, y: 0 }, { x: 37.4, y: 0 }), 90);
  assert.equal(scoreForGuess({ x: 0, y: 0 }, { x: 0, y: 0 }), 100);
});

test('final percentage matches the original Math.round(total / numQ)', () => {
  assert.equal(finalPercent(127, 3), 42);
  assert.equal(finalPercent(100, 3), 33);
  assert.equal(finalPercent(0, 10), 0);
  assert.equal(finalPercent(300, 3), 100);
  assert.equal(finalPercent(1, 0), 0);
});

test('time formatting matches the mm:ss score box', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(4), '00:04');
  assert.equal(formatTime(59), '00:59');
  assert.equal(formatTime(60), '01:00');
  assert.equal(formatTime(90), '01:30');
  assert.equal(formatTime(65.9), '01:05');
  assert.equal(formatTime(3599), '59:59');
  assert.equal(formatTime(-5), '00:00');
  assert.equal(formatTime(undefined), '00:00');
});

test('score box formatting is zero padded to three digits', () => {
  assert.equal(formatScore(0), '000');
  assert.equal(formatScore(5), '005');
  assert.equal(formatScore(45), '045');
  assert.equal(formatScore(127), '127');
  assert.equal(formatScore(-3), '000');
});

test('feedback thresholds match config.xml exactly', () => {
  assert.deepEqual(
    [100, 95, 90].map((s) => feedbackForScore(s).tone),
    ['great', 'great', 'great']
  );
  assert.equal(feedbackForScore(90).title, 'Výborne!');
  assert.deepEqual(
    [89, 80, 70].map((s) => feedbackForScore(s).tone),
    ['good', 'good', 'good']
  );
  assert.equal(feedbackForScore(70).title, 'Celkom dobre!');
  assert.deepEqual(
    [69, 30, 1].map((s) => feedbackForScore(s).tone),
    ['poor', 'poor', 'poor']
  );
  assert.equal(feedbackForScore(69).title, 'To je bieda!');
  assert.equal(feedbackForScore(0).title, 'Úplne vedľa!');
  assert.equal(feedbackForScore(0).tone, 'miss');
  assert.equal(feedbackForScore(0).text, 'Nezískal si ani bod!');
  assert.equal(feedbackForScore(999).tone, 'great');
  assert.equal(feedbackForScore(-10).tone, 'miss');
});

test('city data contains all 74 original cities and level counts', () => {
  assert.equal(CITY_COUNT, 74);
  assert.deepEqual(LEVEL_COUNTS, { 1: 12, 2: 37, 3: 25 });
  assert.equal(citiesForLevel(CITIES, 1).length, 12);
  assert.equal(citiesForLevel(CITIES, 2).length, 49);
  assert.equal(citiesForLevel(CITIES, 3).length, 74);
  assert.equal(citiesForLevel(CITIES, 3).filter((c) => Number(c.level) === 3).length, 25);
});

test('city coordinates and names survive the extraction', () => {
  const bratislava = CITIES.find((c) => c.label === 'Bratislava');
  const zilina = CITIES.find((c) => c.label === 'Žilina');
  const kosice = CITIES.find((c) => c.label === 'Košice');
  assert.deepEqual({ x: bratislava.x, y: bratislava.y, level: bratislava.level }, {
    x: 52.6,
    y: 402.6,
    level: '1',
  });
  assert.deepEqual({ x: zilina.x, y: zilina.y }, { x: 326.2, y: 106.5 });
  assert.deepEqual({ x: kosice.x, y: kosice.y }, { x: 768, y: 217.4 });
});

test('a guess on the target scores 100 and a far guess scores 0', () => {
  const bratislava = CITIES.find((c) => c.label === 'Bratislava');
  const kosice = CITIES.find((c) => c.label === 'Košice');
  assert.equal(scoreForGuess(bratislava, bratislava), 100);
  assert.equal(scoreForGuess(kosice, bratislava), 0);
});

test('pickTargets returns unique cities without mutating the input', () => {
  const input = CITIES.slice();
  const picked = pickTargets(input, 10, () => 0.42);
  assert.equal(picked.length, 10);
  assert.equal(new Set(picked.map((c) => c.label)).size, 10);
  assert.deepEqual(input, CITIES);
});

test('pickTargets clamps to the pool size and honours the rng', () => {
  const pool = CITIES.slice(0, 5);
  const picked = pickTargets(pool, 99);
  assert.equal(picked.length, 5);
  assert.equal(new Set(picked.map((c) => c.label)).size, 5);
  assert.equal(pickTargets(pool, 0).length, 0);
  assert.equal(pickTargets(pool, -2).length, 0);
});

test('a full hard game can be sampled from all 74 cities', () => {
  const hardPool = citiesForLevel(CITIES, 3);
  const picked = pickTargets(hardPool, 74, () => 0.5);
  assert.equal(picked.length, 74);
  assert.equal(new Set(picked.map((c) => c.entity)).size, 74);
});
