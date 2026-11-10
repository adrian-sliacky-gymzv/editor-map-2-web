import test from 'node:test';
import assert from 'node:assert/strict';

import { SOUND_KEY, isMuted, setMuted } from '../js/sound.js';

test('sound preference starts unmuted and can be toggled in memory', () => {
  assert.equal(SOUND_KEY, 'editorMap2.sound.v1');
  assert.equal(isMuted(), false);
  setMuted(true);
  assert.equal(isMuted(), true);
  setMuted(false);
  assert.equal(isMuted(), false);
});
