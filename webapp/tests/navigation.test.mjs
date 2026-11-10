import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRoute, routeKey, routeUrl } from '../js/navigation.js';

test('parseRoute understands the public deep links', () => {
  assert.deepEqual(parseRoute('?view=atlas'), { screen: 'atlas' });
  assert.deepEqual(parseRoute('?editor=1&map=europa'), { screen: 'editor', mapKey: 'europa' });
  assert.deepEqual(parseRoute(''), { screen: 'home' });
});

test('parseRoute separates setup from autostart', () => {
  assert.deepEqual(
    parseRoute('?mode=distance&map=svet&testIndex=2&levelIndex=1&numQ=5'),
    {
      screen: 'classic-setup',
      mode: 'distance',
      mapKey: 'svet',
      mapIndex: 0,
      testIndex: 2,
      levelIndex: 1,
      numQ: 5,
    }
  );
  assert.deepEqual(
    parseRoute('?mode=puzzle&map=europa&autostart=1&numQ=4'),
    {
      screen: 'classic-game',
      mode: 'puzzle',
      mapKey: 'europa',
      mapIndex: 0,
      testIndex: 0,
      levelIndex: 0,
      numQ: 4,
    }
  );
});

test('history state restores a game snapshot', () => {
  const route = {
    screen: 'game',
    mode: 'distance',
    pool: ['mesta_Bratislava_mesto', 'mesta_Kosice_mesto'],
    numQ: 2,
    returnScreen: 'atlas',
    contextLabel: 'Výber',
  };
  assert.deepEqual(parseRoute('', { app: 'editor-map-2', route }), route);
});

test('routeUrl writes stable, shareable URLs', () => {
  assert.equal(routeUrl({ screen: 'home' }), '/');
  assert.equal(routeUrl({ screen: 'atlas' }), '/?view=atlas');
  assert.equal(routeUrl({ screen: 'editor', mapKey: 'europa' }), '/?editor=1&map=europa');
  assert.equal(
    routeUrl({ screen: 'classic-setup', mode: 'test', mapKey: 'slovensko', testIndex: 1, levelIndex: 0, numQ: 4 }),
    '/?mode=test&map=slovensko&testIndex=1&numQ=4'
  );
  assert.equal(
    routeUrl({ screen: 'classic-game', mode: 'distance', mapKey: 'svet', testIndex: 0, levelIndex: 2, numQ: 10 }),
    '/?mode=distance&map=svet&levelIndex=2&numQ=10&autostart=1'
  );
});

test('routeKey ignores unknown route values through normalisation', () => {
  assert.equal(routeKey({ screen: 'home' }), routeKey({ screen: 'unknown' }));
  assert.equal(
    routeKey({ screen: 'classic-setup', mode: 'nonsense' }),
    routeKey({ screen: 'classic-setup', mode: 'distance' })
  );
});
