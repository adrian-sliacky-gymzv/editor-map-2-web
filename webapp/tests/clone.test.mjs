import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const MAPS = JSON.parse(fs.readFileSync(path.join(DATA, 'maps.json'), 'utf8'));
const CONFIG = fs.readFileSync(path.join(DATA, 'config.xml'), 'utf8');

const EXPECTED_ENTITIES = {
  slovensko: 363,
  svet: 749,
  afrika: 168,
  australia: 98,
  azia: 199,
  europa: 202,
  juzna_amerika: 72,
  severna_amerika: 131,
};

function attrs(text) {
  const out = {};
  for (const match of text.matchAll(/([a-zA-Z_:][\w:.-]*)="([^"]*)"/g)) {
    out[match[1]] = match[2];
  }
  return out;
}

function section(xml, tag) {
  const start = xml.indexOf(`<${tag}>`);
  const end = xml.indexOf(`</${tag}>`, start);
  assert.ok(start >= 0 && end > start, `chýba <${tag}>`);
  return xml.slice(start + tag.length + 2, end);
}

function mapsOf(tag) {
  return [...section(CONFIG, tag).matchAll(/<map\b([^>]*)>/g)].map((m) => attrs(m[1]));
}

function globalKeyByMapName(mapName) {
  return mapsOf('globalMapList').find((m) => m.mapName === mapName)?.dataFileName;
}

test('všetkých 8 pôvodných máp a ich dáta sú prítomné', () => {
  assert.equal(MAPS.length, 8);
  assert.deepEqual(new Set(MAPS.map((m) => m.key)), new Set(Object.keys(EXPECTED_ENTITIES)));
  for (const [key, count] of Object.entries(EXPECTED_ENTITIES)) {
    const mef = path.join(DATA, 'maps', `${key}.mef`);
    const svg = path.join(ROOT, 'assets', 'maps', `${key}.svg`);
    assert.ok(fs.existsSync(mef), `chýba ${key}.mef`);
    assert.ok(fs.existsSync(svg), `chýba ${key}.svg`);
    const mefText = fs.readFileSync(mef, 'utf8');
    const entities = [...mefText.matchAll(/\bentity="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(entities.length, count, `${key}: počet objektov v .mef`);
    assert.equal(new Set(entities).size, count, `${key}: duplicitné entity v .mef`);
  }
});

test('každá scéna obsahuje presne tie isté pomenované objekty ako .mef', () => {
  for (const def of MAPS) {
    const mefText = fs.readFileSync(path.join(DATA, 'maps', `${def.key}.mef`), 'utf8');
    const svgText = fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${def.key}.svg`), 'utf8');
    const mefEntities = new Set([...mefText.matchAll(/\bentity="([^"]+)"/g)].map((m) => m[1]));
    const sceneEntities = [...svgText.matchAll(/data-entity="([^"]+)"/g)].map((m) => m[1]);
    const sceneSet = new Set(sceneEntities);
    assert.equal(sceneSet.size, sceneEntities.length, `${def.key}: scéna má duplicity`);
    assert.equal(sceneSet.size, mefEntities.size, `${def.key}: počet objektov v scéne`);
    for (const entity of mefEntities) {
      assert.ok(sceneSet.has(entity), `${def.key}: v scéne chýba ${entity}`);
    }
    const vb = svgText.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    assert.ok(vb, `${def.key}: chýba viewBox`);
    assert.equal(Math.round(Number(vb[1])), def.width);
    assert.equal(Math.round(Number(vb[2])), def.height);
  }
});

test('config.xml odkazuje na existujúce mapy a testovacie skupiny', () => {
  const globals = mapsOf('globalMapList');
  assert.equal(globals.length, 8);
  const keys = new Set(MAPS.map((m) => m.key));
  for (const entry of globals) {
    assert.ok(keys.has(entry.dataFileName), `neznáma mapa ${entry.mapName}`);
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'maps', `${entry.dataFileName}.svg`)), `chýba scéna ${entry.dataFileName}`);
  }

  for (const listName of ['testMapList', 'distanceMapList', 'puzzleMapList']) {
    const list = section(CONFIG, listName);
    for (const block of list.matchAll(/<map\b([^>]*)>([\s\S]*?)<\/map>/g)) {
      const map = attrs(block[1]);
      const body = block[2];
      const key = globalKeyByMapName(map.mapName);
      assert.ok(key, `${listName}: neznáma mapa ${map.mapName}`);
      const mef = fs.readFileSync(path.join(DATA, 'maps', `${key}.mef`), 'utf8');
      const labels = new Set([...mef.matchAll(/\blabel="([^"]*)"/g)].map((m) => m[1]));
      for (const match of body.matchAll(/<(?:group|visibleNode)\b([^>]*)>/g)) {
        const a = attrs(match[1]);
        if (a.label != null) assert.ok(labels.has(a.label), `${listName}/${map.mapName}: chýba skupina „${a.label}“`);
      }
    }
  }
});

test('zoznamy máp pre aktivity zodpovedajú pôvodnému config.xml', () => {
  assert.equal(mapsOf('testMapList').length, 8);
  assert.equal(mapsOf('distanceMapList').length, 7);
  assert.equal(mapsOf('puzzleMapList').length, 7);
  const puzzleNames = mapsOf('puzzleMapList').map((m) => m.mapName);
  assert.ok(!puzzleNames.includes('Slovensko'), 'Poskladaj! nemá obsahovať Slovensko');
  const distanceNames = mapsOf('distanceMapList').map((m) => m.mapName);
  assert.ok(!distanceNames.includes('Austrália'), 'Traf sa! pôvodne neobsahuje Austráliu');
});

test('dátové súbory a ikony potrebné pre editor sú v balíku', () => {
  for (const file of ['config.xml', 'maps.json']) {
    assert.ok(fs.existsSync(path.join(DATA, file)), `chýba ${file}`);
  }
  for (const def of MAPS) {
    assert.ok(fs.existsSync(path.join(ROOT, def.thumb)), `chýba náhľad ${def.thumb}`);
  }
  for (const file of ['js/classic.js', 'js/classic-data.js', 'js/map-view.js', 'js/classic-activities.js', 'js/editor.js', 'classic.css']) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `chýba ${file}`);
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'help', 'index.html')), 'chýba pôvodná pomoc');
});
