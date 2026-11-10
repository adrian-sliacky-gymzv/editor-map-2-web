// Scoring and game-flow helpers for the "Traf sa!" distance test.
// These mirror the original ActionScript in mxm.exam.DistanceTest exactly.

export const MAP_WIDTH = 993;
export const MAP_HEIGHT = 520;

/** Original: Math.round(Math.sqrt(map.width^2 + map.height^2)) === 1121 */
export const MAX_DIST = Math.round(Math.sqrt(MAP_WIDTH * MAP_WIDTH + MAP_HEIGHT * MAP_HEIGHT));

/** The original DistanceTest computes maxDist from the selected map, rounded. */
export function maxDistanceForMap(width, height) {
  return Math.round(Math.sqrt((Number(width) || 0) ** 2 + (Number(height) || 0) ** 2));
}

/**
 * Original: dist = Math.round(Point.distance(rightPoint, userPoint));
 *           score = Math.round((maxDist - 3 * dist) / maxDist * 100);
 *           score = score < 5 ? 0 : score;
 */
export function scoreForDistance(distance, maxDist = MAX_DIST) {
  if (!Number.isFinite(distance) || distance < 0) return 0;
  const score = Math.round(((maxDist - 3 * distance) / maxDist) * 100);
  return score < 5 ? 0 : score;
}

/** Round the pixel distance first, exactly like the original. */
export function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

export function scoreForGuess(guess, target, maxDist = MAX_DIST) {
  return scoreForDistance(distanceBetween(guess, target), maxDist);
}

/** Final success percentage: Math.round(totalScore / numQ). */
export function finalPercent(totalScore, numQ) {
  if (!numQ || numQ <= 0) return 0;
  return Math.round(totalScore / numQ);
}

/** Stopwatch text used by the original score box (mm:ss). */
export function formatTime(totalSeconds) {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

export function formatScore(totalScore) {
  return String(Math.max(0, Math.round(Number(totalScore) || 0))).padStart(3, '0');
}

/**
 * Original feedback thresholds from config.xml:
 *  90-100 "Výborne!" (green)
 *  70-89  "Celkom dobre!" (blue)
 *  1-69   "To je bieda!" (blue)
 *  0      "Úplne vedľa!" (red)
 * Returns the tone used for both the headline and the score number.
 */
export function feedbackForScore(score) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  if (s >= 90) {
    return {
      tone: 'great',
      title: 'Výborne!',
      text: 'Získal si',
      scoreWord: 'bodov.',
    };
  }
  if (s >= 70) {
    return {
      tone: 'good',
      title: 'Celkom dobre!',
      text: 'Získal si',
      scoreWord: 'bodov.',
    };
  }
  if (s >= 1) {
    return {
      tone: 'poor',
      title: 'To je bieda!',
      text: 'Získal si len',
      scoreWord: 'bodov.',
    };
  }
  return {
    tone: 'miss',
    title: 'Úplne vedľa!',
    text: 'Nezískal si ani bod!',
    scoreWord: '',
  };
}

/** Cities available at the chosen difficulty: testLevel > 0 && <= level. */
export function citiesForLevel(cities, level) {
  return cities.filter((city) => {
    const cityLevel = Number(city.level);
    return cityLevel > 0 && cityLevel <= level;
  });
}

/** Random sample without replacement, like TestBase.getRandomSeq(). */
export function pickTargets(cities, count, rng = Math.random) {
  const pool = cities.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
}

export const DIFFICULTIES = [
  { level: 1, key: 'lahka', label: 'Ľahká', maxLevel: 1 },
  { level: 2, key: 'stredna', label: 'Stredná', maxLevel: 2 },
  { level: 3, key: 'tazka', label: 'Ťažká', maxLevel: 3 },
];
