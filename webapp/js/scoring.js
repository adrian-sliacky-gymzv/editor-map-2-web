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
 * Kilometres represented by one map unit. The values come from the scale bar
 * printed inside every original map SVG: the bar's km label divided by the
 * width of the drawn bar in map units. Keeping the source fractions makes the
 * provenance auditable instead of hiding magic numbers.
 *
 *   map               bar label   bar width
 *   Slovensko          50 km       116 u
 *   Svet             4000 km       102 u
 *   Európa           1000 km       138 u
 *   Afrika           2000 km       152 u
 *   Ázia             2000 km       114 u
 *   Severná Amerika  1000 km        78 u
 *   Južná Amerika    1000 km        87 u
 *   Austrália        2000 km       122 u
 */
export const MAP_KM_PER_UNIT = Object.freeze({
  slovensko: 50 / 116,
  svet: 4000 / 102,
  europa: 1000 / 138,
  afrika: 2000 / 152,
  azia: 2000 / 114,
  severna_amerika: 1000 / 78,
  juzna_amerika: 1000 / 87,
  australia: 2000 / 122,
});

/** Scale for a map key, or null when the map has no known scale bar. */
export function kilometresPerMapUnit(mapKey) {
  const key = String(mapKey || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(MAP_KM_PER_UNIT, key)
    ? MAP_KM_PER_UNIT[key]
    : null;
}

/** Convert a distance measured in map units to kilometres. */
export function kilometresForDistance(mapKey, distance) {
  const scale = kilometresPerMapUnit(mapKey);
  const units = Number(distance);
  if (scale == null || !Number.isFinite(units) || units < 0) return null;
  return units * scale;
}

/**
 * Compact, language-aware kilometre text. Small distances keep one decimal so
 * a close guess in Slovakia does not collapse to "0 km"; larger distances use
 * grouped whole kilometres.
 */
export function formatKilometres(kilometres, lang = 'sk') {
  const value = Number(kilometres);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value === 0) return '0';
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  const [whole, fraction] = rounded.toFixed(value < 10 ? 1 : 0).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : '\u00a0');
  if (!fraction || fraction === '0') return grouped;
  return `${grouped}${lang === 'en' ? '.' : ','}${fraction}`;
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
