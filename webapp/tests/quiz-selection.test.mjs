import test from 'node:test';
import assert from 'node:assert/strict';

import {
  candidatesFor,
  nextGroupIndex,
  pickUnusedIndex,
  randomSequence,
} from '../js/quiz-selection.js';

function fixedRng(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

test('randomSequence returns unique indices and respects the requested count', () => {
  const seq = randomSequence(10, 4, -1, fixedRng([0.9, 0.1, 0.4, 0.7, 0.2, 0.8, 0.3, 0.6, 0.5, 0.05]));
  assert.equal(seq.length, 4);
  assert.equal(new Set(seq).size, 4);
  for (const index of seq) assert.ok(index >= 0 && index < 10);
});

test('randomSequence pins the target first like TestBase.getRandomSeq', () => {
  const seq = randomSequence(8, 5, 3, fixedRng([0.9, 0.1, 0.4, 0.7, 0.2, 0.8, 0.3, 0.6]));
  assert.equal(seq[0], 3);
  assert.equal(seq.length, 5);
  assert.equal(new Set(seq).size, 5);
});

test('randomSequence clamps to the pool and handles empty input', () => {
  assert.deepEqual(randomSequence(0, 5), []);
  assert.deepEqual(randomSequence(3, 0), []);
  assert.deepEqual(randomSequence(3, -2), []);
  const seq = randomSequence(3, 99);
  assert.equal(seq.length, 3);
  assert.deepEqual([...seq].sort((a, b) => a - b), [0, 1, 2]);
});

test('nextGroupIndex cycles groups in order and skips exhausted ones', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };
  const groups = [
    { nodes: [a], used: new Set([a]) },
    { nodes: [b, c], used: new Set() },
    { nodes: [], used: new Set() },
  ];
  assert.equal(nextGroupIndex(-1, groups), 1);
  groups[1].used.add(b);
  assert.equal(nextGroupIndex(1, groups), 1);
  groups[1].used.add(c);
  assert.equal(nextGroupIndex(1, groups), -1);
});

test('nextGroupIndex wraps to the first available group', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const groups = [
    { nodes: [a], used: new Set() },
    { nodes: [b], used: new Set([b]) },
  ];
  assert.equal(nextGroupIndex(1, groups), 0);
});

test('pickUnusedIndex never selects an already used node', () => {
  const nodes = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const used = new Set([nodes[0], nodes[2]]);
  assert.equal(pickUnusedIndex(nodes, used, () => 0), 1);
  assert.equal(pickUnusedIndex(nodes, used, () => 0.999), 1);
  used.add(nodes[1]);
  assert.equal(pickUnusedIndex(nodes, used), -1);
});

test('candidatesFor pins the target first and may include used distractors', () => {
  const nodes = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const used = new Set([nodes[1]]);
  const candidates = candidatesFor(nodes, 2, 3, fixedRng([0.8, 0.2, 0.6, 0.4]));
  assert.equal(candidates[0], nodes[2]);
  assert.equal(new Set(candidates).size, 3);
  // The used node is still eligible as a distractor; it is only excluded from
  // becoming the next target.
  used.add(nodes[0]);
  const withUsed = candidatesFor(nodes, 2, 4, fixedRng([0.5]));
  assert.equal(withUsed.length, 4);
  assert.equal(withUsed[0], nodes[2]);
});

test('candidate count is capped by the group size', () => {
  const nodes = [{ id: 1 }, { id: 2 }];
  const candidates = candidatesFor(nodes, 0, 7);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0], nodes[0]);
});
