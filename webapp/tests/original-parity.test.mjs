import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const ORIGINAL = path.join(REPO, 'software');
const SHIPPED = path.join(ROOT, 'data');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizedConfig(text) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/<\?xmlversion/i, '<?xml version')
    .replace(/\r\n?/g, '\n')
    .trim();
}

test('the eight original .mef datasets are shipped byte-for-byte', () => {
  const originalDir = path.join(ORIGINAL, 'newMapData');
  const files = fs.readdirSync(originalDir).filter((name) => name.endsWith('.mef')).sort();
  assert.equal(files.length, 8);
  const shipped = fs.readdirSync(path.join(SHIPPED, 'maps')).filter((name) => name.endsWith('.mef')).sort();
  assert.deepEqual(shipped, files);
  for (const file of files) {
    const original = fs.readFileSync(path.join(originalDir, file));
    const copy = fs.readFileSync(path.join(SHIPPED, 'maps', file));
    assert.equal(sha256(copy), sha256(original), `${file} differs from the original`);
  }
});

test('config.xml is the original file apart from its BOM and XML declaration', () => {
  const original = fs.readFileSync(path.join(ORIGINAL, 'config.xml'), 'utf8');
  const shipped = fs.readFileSync(path.join(SHIPPED, 'config.xml'), 'utf8');
  assert.equal(normalizedConfig(shipped), normalizedConfig(original));
  assert.ok(original.includes('<?xmlversion'), 'the original keeps its malformed declaration');
  assert.match(shipped, /^<\?xml version=/);
});

test('every shipped scene keeps the map dimensions from maps.json', () => {
  const maps = JSON.parse(fs.readFileSync(path.join(SHIPPED, 'maps.json'), 'utf8'));
  assert.equal(maps.length, 8);
  for (const def of maps) {
    const svg = fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${def.key}.svg`), 'utf8');
    const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    assert.ok(viewBox, `${def.key}: missing viewBox`);
    assert.equal(Math.round(Number(viewBox[1])), def.width, `${def.key}: width`);
    assert.equal(Math.round(Number(viewBox[2])), def.height, `${def.key}: height`);
    assert.equal(
      Math.round(Math.hypot(def.width, def.height)),
      Math.round(Math.hypot(Number(viewBox[1]), Number(viewBox[2]))),
      `${def.key}: max distance`
    );
  }
});
