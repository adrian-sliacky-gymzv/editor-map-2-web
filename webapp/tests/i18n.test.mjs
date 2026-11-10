import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveLanguage, t, translateCore, translateText } from '../js/i18n.js';
import { EN, EN_HTML, GAME_MESSAGES_EN } from '../js/translations.js';

test('language detection prefers Slovak only for Slovak browsers', () => {
  assert.equal(resolveLanguage('auto', ['sk-SK', 'en-US']), 'sk');
  assert.equal(resolveLanguage('auto', ['en-US', 'sk-SK']), 'sk');
  assert.equal(resolveLanguage('auto', ['en-US']), 'en');
  assert.equal(resolveLanguage('auto', ['cs-CZ']), 'en');
  assert.equal(resolveLanguage('auto', []), 'en');
  assert.equal(resolveLanguage('sk', ['en-US']), 'sk');
  assert.equal(resolveLanguage('en', ['sk-SK']), 'en');
});

test('exact UI phrases translate', () => {
  assert.equal(translateCore('Hrať', 'en'), 'Play');
  assert.equal(translateCore('Vyskúšaj sa!', 'en'), 'Test yourself!');
  assert.equal(translateCore('Ťažká · 10 otázok', 'en'), 'Hard · 10 questions');
  assert.equal(translateCore('Slovensko · mestá', 'en'), 'Slovakia · cities');
  assert.equal(translateCore('Traf sa! — výsledok', 'en'), 'Aim! — result');
  assert.equal(translateCore('Výsledok', 'en'), 'Result');
});

test('difficulty and map parentheses keep their numbers', () => {
  assert.equal(translateCore('Ťažká (74)', 'en'), 'Hard (74)');
  assert.equal(translateCore('Všetky (74)', 'en'), 'All (74)');
  assert.equal(translateCore('Ľahká (12)', 'en'), 'Easy (12)');
});

test('counted nouns use correct English plurals', () => {
  assert.equal(translateCore('1 objekt', 'en'), '1 object');
  assert.equal(translateCore('3 objekty', 'en'), '3 objects');
  assert.equal(translateCore('1 982 objektov', 'en'), '1,982 objects');
  assert.equal(translateCore('74 miest', 'en'), '74 cities');
  assert.equal(translateCore('3 možnosti', 'en'), '3 options');
  assert.equal(translateCore('10 otázok', 'en'), '10 questions');
  assert.equal(translateCore('0 bodov', 'en'), '0 points');
  assert.equal(translateCore('5 hier', 'en'), '5 games');
  assert.equal(translateCore('123 objektov + 2 značky', 'en'), '123 objects + 2 markers');
});

test('dynamic game sentences keep their values', () => {
  assert.equal(translateCore('Otázka 3: Bratislava', 'en'), 'Question 3: Bratislava');
  assert.equal(translateCore('Otázka č.', 'en'), 'Question');
  assert.equal(translateCore('Skóre 45 bodov, čas 01:23', 'en'), 'Score 45 points, time 01:23');
  assert.equal(translateCore('Správne 7, nesprávne 3, čas 02:00', 'en'), 'Correct 7, incorrect 3, time 02:00');
  assert.equal(translateCore('Výborne! +92 b.', 'en'), 'Excellent! +92 pts');
  assert.equal(translateCore('45 j.', 'en'), '45 u.');
  assert.equal(translateCore('Hra Aim!', 'en'), 'Game Aim!');
});

test('generic map type words translate without changing proper names', () => {
  assert.equal(translateCore('Vodná nádrž Zemplínska Šírava', 'en'), 'Zemplínska Šírava Reservoir');
  assert.equal(translateCore('jazero Kariba', 'en'), 'Lake Kariba');
  assert.equal(translateCore('j. Erie', 'en'), 'Lake Erie');
  assert.equal(translateCore('púšť Atacama', 'en'), 'Atacama Desert');
  assert.equal(translateCore('vodopády Iguaçu', 'en'), 'Iguaçu Falls');
  assert.equal(translateCore('zemepisná sieť', 'en'), 'Geographic grid');
  assert.equal(translateCore('Bratislava', 'en'), 'Bratislava');
});

test('text-node translation preserves surrounding whitespace', () => {
  assert.equal(translateText(' Hrať ', 'en'), ' Play ');
  assert.equal(translateText('Bratislava', 'en'), 'Bratislava');
  assert.equal(translateText('Bratislava', 'sk'), 'Bratislava');
  assert.equal(translateText(' Hrať ', 'sk'), ' Hrať ');
});

test('Slovak mode is a no-op', () => {
  assert.equal(translateCore('Hrať', 'sk'), 'Hrať');
  assert.equal(translateText('Ťažká · 10 otázok', 'sk'), 'Ťažká · 10 otázok');
});

test('template helper interpolates placeholders', () => {
  assert.equal(
    t('Klikni kde sa nachádza mesto <b class="entity">{name}</b>.', { name: 'Bratislava' }),
    'Klikni kde sa nachádza mesto <b class="entity">Bratislava</b>.'
  );
  assert.equal(t('{instruction}: {type} {name}', {
    instruction: 'Nájdi na mape',
    type: 'Mesto',
    name: 'Bratislava',
  }), 'Nájdi na mape: Mesto Bratislava');
});

test('dictionary keys are normalised and mixed-markup keys are present', () => {
  for (const key of Object.keys(EN)) {
    assert.equal(key, key.replace(/\s+/g, ' ').trim(), `unnormalised key: ${key}`);
  }
  for (const key of ['heroTitle', 'helpEditor', 'helpMapControls', 'editorSidebarFoot']) {
    assert.ok(EN_HTML[key], `missing EN_HTML.${key}`);
  }
});

test('all original config game messages have English equivalents', () => {
  for (const key of [
    'testTitle',
    'distanceTitle',
    'puzzleTitle',
    'testQuestion',
    'distanceQuestion',
    'puzzleQuestion',
    'correctTestAnswer',
    'incorrectTestAnswer',
    'correctPuzzleAnswer',
    'incorrectPuzzleAnswer',
    'testFinalScore',
    'distanceFinalScore',
    'puzzleFinalScore',
    'nextTestQuestion',
    'lastTestQuestion',
    'nextPuzzleQuestion',
    'lastPuzzleQuestion',
    'distanceAnswer.90.100',
    'distanceAnswer.70.89',
    'distanceAnswer.1.69',
    'distanceAnswer.0.0',
  ]) {
    assert.ok(GAME_MESSAGES_EN[key], `missing GAME_MESSAGES_EN.${key}`);
  }
});
