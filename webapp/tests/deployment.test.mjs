import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function localReferences(html) {
  return [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(?:[a-z]+:|#|\/\/)/i.test(value));
}

test('app entry point uses only relative asset paths', () => {
  const html = read('index.html');
  const refs = localReferences(html);
  assert.ok(refs.length >= 12);
  for (const ref of refs) {
    assert.ok(!ref.startsWith('/'), `absolute path is not GitHub Pages safe: ${ref}`);
    const file = ref.split(/[?#]/)[0];
    const target = path.join(ROOT, file);
    assert.ok(fs.existsSync(target), `missing local asset: ${ref}`);
  }
  assert.match(html, /<link rel="stylesheet" href="styles\.css">/);
  assert.match(html, /<link rel="stylesheet" href="classic\.css">/);
  assert.match(html, /<link rel="stylesheet" href="dark\.css">/);
  assert.ok(html.indexOf('classic.css') < html.indexOf('dark.css'));
});

test('web manifest stays inside the repository subpath', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.ok(Array.isArray(manifest.icons));
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'));
    assert.ok(fs.existsSync(path.join(ROOT, icon.src)));
  }
});

test('all JavaScript imports are relative', () => {
  for (const name of fs.readdirSync(path.join(ROOT, 'js'))) {
    if (!name.endsWith('.js')) continue;
    const source = read(path.join('js', name));
    const imports = [
      ...[...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]),
      ...[...source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]),
    ];
    for (const specifier of imports) {
      if (/^(?:[a-z]+:|#)/i.test(specifier)) continue;
      assert.ok(specifier.startsWith('./') || specifier.startsWith('../'), `${name} imports an absolute path: ${specifier}`);
      const target = path.resolve(path.dirname(path.join(ROOT, 'js', name)), specifier);
      assert.ok(fs.existsSync(target), `${name} imports a missing file: ${specifier}`);
    }
  }
});

test('help pages are mobile-ready and deployment-safe', () => {
  const files = fs.readdirSync(path.join(ROOT, 'help')).filter((name) => name.endsWith('.html'));
  assert.equal(files.length, 6);
  for (const name of files) {
    const html = read(path.join('help', name));
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /<html lang="sk">/);
    assert.match(html, /name="viewport"/);
    assert.match(html, /name="description"/);
    assert.equal((html.match(/<main>/g) || []).length, 1);
    for (const ref of localReferences(html)) {
      assert.ok(!ref.startsWith('/'), `${name} has an absolute path: ${ref}`);
      const file = ref.split(/[?#]/)[0];
      assert.ok(fs.existsSync(path.join(ROOT, 'help', file)), `${name} links to missing ${ref}`);
    }
  }
});

test('GitHub Pages deployment files are present', () => {
  assert.ok(fs.existsSync(path.join(ROOT, '.nojekyll')));
  const fallback = read('404.html');
  assert.match(fallback, /href="\.\/"/);
  assert.match(fallback, /Táto adresa neexistuje/);
  const workflow = fs.readFileSync(path.join(REPO, '.github', 'workflows', 'pages.yml'), 'utf8');
  assert.match(workflow, /actions\/configure-pages@/);
  assert.match(workflow, /actions\/upload-pages-artifact@/);
  assert.match(workflow, /path:\s*webapp/);
  assert.match(workflow, /actions\/deploy-pages@/);
});

test('the test script runs every test file', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.test, /tests\//);
  const tests = fs.readdirSync(path.join(ROOT, 'tests')).filter((name) => name.endsWith('.test.mjs'));
  assert.ok(tests.includes('map-gestures.test.mjs'));
  assert.ok(tests.includes('practice-stats.test.mjs'));
});

test('keyboard shortcuts are documented and exposed to assistive technology', () => {
  const html = read('index.html');
  for (const key of ['1', '2', '3', '4', '5']) {
    assert.match(html, new RegExp(`aria-keyshortcuts="${key}"`));
  }
  assert.match(html, /aria-keyshortcuts="Enter Space"/);
  assert.match(html, /aria-keyshortcuts="Control\+S"/);
  assert.match(html, /aria-keyshortcuts="Control\+Shift\+S"/);
  assert.match(html, /aria-keyshortcuts="Shift\+\/"/);
  assert.match(html, /aria-keyshortcuts="\/"/);
  assert.match(html, /Klávesové skratky/);
  assert.match(html, /class="shortcut-list"/);
  assert.match(html, /class="mode-kbd"/);
});

test('mission HUDs, legend and marker callouts stay explicit', () => {
  const html = read('index.html');
  assert.match(html, /class="mission-hud" id="classicMission"/);
  assert.match(html, /id="classicMissionName"/);
  assert.match(html, /id="classicMissionType"/);
  assert.match(html, /id="classicAverageValue"/);
  assert.match(html, /id="classicQuestionCounter"/);
  assert.match(html, /class="mission-hud" id="gameMission"/);
  assert.match(html, /id="gameAverageValue"/);
  assert.match(html, /id="gameQuestionCounter"/);
  assert.match(html, /id="classicResultBtn"/);
  assert.match(html, /id="gameResultBtn"/);
  assert.match(html, /class="win-btn result-reopen-btn"/);
  assert.match(html, /id="classicDistanceLegend"/);
  assert.match(html, /class="distance-legend-foot"/);
  assert.match(html, /id="classicDistanceValue"/);
  assert.match(html, /Vzdialenosť/);

  const classic = read('js/classic-activities.js');
  assert.match(classic, /setMissionTarget\(/);
  assert.match(classic, /averageText\(/);
  assert.match(classic, /syncResultReopen\(/);
  assert.match(classic, /labelPlacement: targetAbove \? 'above' : 'below'/);
  assert.match(classic, /labelPlacement: targetAbove \? 'below' : 'above'/);
  assert.match(classic, /dom\.distanceValue\.textContent/);
  assert.match(classic, /labelObstacles:/);

  const app = read('js/app.js');
  assert.match(app, /setGameMissionTarget\(/);
  assert.match(app, /gameAverageText\(/);
  assert.match(app, /syncLegacyResultReopen\(/);
  assert.match(app, /LEGACY_PIN_PATH/);

  assert.match(html, /id="mapImg" class="map-img map-img-inline"/);
  assert.match(app, /LEGACY_MAP_SOURCES/);
  assert.match(app, /renderLegacyMap\(/);
  const styles = read('styles.css');
  assert.match(styles, /\.legacy-map-svg path/);
  assert.match(styles, /vector-effect: non-scaling-stroke/);

  const mapView = read('js/map-view.js');
  assert.match(mapView, /data-label-placement/);
  assert.match(mapView, /beginInteractiveDrag/);
  assert.match(mapView, /_requestRender/);
  assert.match(mapView, /_refreshPlacedLabels/);

  const classicCss = read('classic.css');
  assert.match(read('styles.css'), /\.distance-legend-foot/);
  assert.match(classicCss, /\.mission-hud/);
  assert.match(classicCss, /vector-effect: non-scaling-stroke/);
  assert.match(classicCss, /\.map-canvas\.is-gesturing/);
  assert.match(classicCss, /#classicResultBtn/);
  assert.match(classicCss, /\.mission-stat-time/);
});
