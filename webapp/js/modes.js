import { pickTargets, distanceBetween } from './scoring.js';

/**
 * Percentage used by "Vyskúšaj sa!" and "Poskladaj!":
 * Math.round(correct / answered * 100), as in the original Test/PuzzleTest.
 */
export function percentOf(correct, total) {
  if (!total || total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * Build the candidate set for one "Vyskúšaj sa!" question.
 * The original Test.getRandomSeq(numTargets, chosenIndex) puts the target first
 * and fills the rest with random nodes from the same group. We do the same,
 * then shuffle so the correct point is not visually first.
 */
export function buildQuizOptions(target, pool, count, rng = Math.random) {
  const size = Math.max(1, Math.min(Math.floor(count) || 1, pool.length));
  if (size === 1) return [target];

  const others = pool.filter((city) => city.entity !== target.entity);
  const distractors = pickTargets(others, size - 1, rng);
  const options = [target, ...distractors];

  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

/** Diacritics-insensitive search normalization ("Žilina" -> "zilina"). */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Atlas filtering. The level filters are cumulative like the game difficulties:
 * 1 = 12 cities, 2 = 49 cities, 3 = all 74.
 */
export function filterCities(cities, { query = '', level = 'all' } = {}) {
  const needle = normalizeText(query);
  const maxLevel = level === 'all' ? Infinity : Number(level);
  return cities.filter((city) => {
    if (Number(city.level) > maxLevel) return false;
    return !needle || normalizeText(city.label).includes(needle);
  });
}

/**
 * Puzzle tolerance in map units. The original uses a fixed 15 map units, which
 * becomes physically tiny on a phone. We keep the minimum 15 and otherwise use
 * a 20 screen-pixel radius so the activity stays fair on every screen size.
 */
export function puzzleTolerance(mapUnitsPerPixel, screenPixels = 20, minimum = 15) {
  const unitsPerPixel = Number(mapUnitsPerPixel);
  if (!Number.isFinite(unitsPerPixel) || unitsPerPixel <= 0) return minimum;
  return Math.max(minimum, screenPixels * unitsPerPixel);
}

export function isPuzzleCorrect(drop, target, tolerance) {
  return distanceBetween(drop, target) <= Math.max(0, Number(tolerance) || 0);
}

export function emptyStats() {
  return {
    distance: { games: 0, best: 0, points: 0, possible: 0 },
    quiz: { games: 0, best: 0, correct: 0, total: 0 },
    puzzle: { games: 0, best: 0, correct: 0, total: 0 },
  };
}

export function averageStats(entry, mode) {
  if (!entry || !entry.games) return 0;
  if (mode === 'distance') {
    return entry.possible > 0 ? Math.round((entry.points / entry.possible) * 100) : 0;
  }
  return entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
}

/** Return a new stats object with one finished game merged in. */
export function mergeStats(stats, mode, result) {
  const base = stats && typeof stats === 'object' ? stats : emptyStats();
  const current = base[mode] || (mode === 'distance'
    ? { games: 0, best: 0, points: 0, possible: 0 }
    : { games: 0, best: 0, correct: 0, total: 0 });

  const entry = {
    ...current,
    games: Number(current.games || 0) + 1,
    best: Math.max(Number(current.best || 0), Number(result.percent || 0)),
  };

  if (mode === 'distance') {
    entry.points = Number(current.points || 0) + Number(result.points || 0);
    entry.possible = Number(current.possible || 0) + Number(result.possible || 0);
  } else {
    entry.correct = Number(current.correct || 0) + Number(result.correct || 0);
    entry.total = Number(current.total || 0) + Number(result.total || 0);
  }

  return { ...base, [mode]: entry };
}
