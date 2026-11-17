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
  assert.match(html, /<link rel="stylesheet" href="redesign\.css">/);
  assert.ok(html.indexOf('classic.css') < html.indexOf('dark.css'));
  assert.ok(html.indexOf('dark.css') < html.indexOf('redesign.css'));
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
  assert.equal(read('CNAME').trim(), 'em.adriansliacky.sk');
  const fallback = read('404.html');
  assert.match(fallback, /href="\.\/"/);
  assert.match(fallback, /This address is not on the map/);
  assert.match(fallback, /Táto adresa na mape nie je|Stránka neexistuje/);
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
  assert.match(html, /home-card-grid/);
  assert.match(html, /class="home-card/);
  assert.match(html, /id="heroPlayBtn"/);
  assert.match(html, /data-classic-preset="hero"/);
});

test('the map picker opens the setup for the selected map', () => {
  const html = read('index.html');
  assert.match(html, /data-classic-map="slovensko"/);
  assert.match(html, /data-classic-map="australia"/);
  assert.match(html, /src="assets\/thumbs\/svet\.png"[^>]*alt="Mapa sveta/);
  const classic = read('js/classic-activities.js');
  assert.match(classic, /preset\?\.mapKey/);
  assert.match(classic, /dataset\.classicMap/);
  assert.match(classic, /keyForConfigMap\(el\) === preset\.mapKey/);
});

test('every map exposes a recenter control', () => {
  const html = read('index.html');
  assert.match(html, /id="classicZoomCenter"/);
  assert.match(html, /id="zoomCenter"/);
  assert.match(html, /id="editorZoomCenter"/);
  assert.match(html, /Vycentrovať mapu/);
  assert.match(read('js/map-view.js'), /center\(\)\s*\{/);
  assert.match(read('js/classic-activities.js'), /zoomCenter\?\.addEventListener/);
  assert.match(read('js/app.js'), /zoomCenter\?\.addEventListener/);
  assert.match(read('js/editor.js'), /zoomCenter\?\.addEventListener/);
  const mapView = read('js/map-view.js');
  assert.match(mapView, /center\(\)\s*\{[\s\S]*?this\.zoom = 1;[\s\S]*?this\.panX = 0;/);
  assert.match(mapView, /if \(zoom <= 1\.001\) return \{ maxX: 0, maxY: 0 \}/);
  const app = read('js/app.js');
  assert.match(app, /function recenterView\(\)[\s\S]*?zoom: 1[\s\S]*?panX: 0/);
  assert.match(app, /if \(zoom <= 1\.001\) return \{ zoom, panX: 0, panY: 0 \}/);
});

test('the hero starts Traf sa on hard with ten questions', () => {
  const html = read('index.html');
  assert.match(html, /id="heroPlayBtn"[^>]*data-classic-mode="distance"[^>]*data-classic-preset="hero"/);
  assert.match(html, /Ťažká · 10 otázok/);
  const classic = read('js/classic-activities.js');
  assert.match(classic, /async function startHeroGame\(/);
  assert.match(classic, /mode: 'distance'/);
  assert.match(classic, /mapKey: 'slovensko'/);
  assert.match(classic, /levelIndex: 2/);
  assert.match(classic, /numQ: 10/);
  assert.match(classic, /classicPreset/);
});

test('the redesign stays deployment-safe', () => {
  const html = read('index.html');
  const css = read('redesign.css');
  assert.ok(css.length > 12000);
  assert.match(css, /--display: Georgia/);
  assert.match(css, /\.home-card-featured/);
  assert.match(css, /\.map-sheet-hit/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.ok(!/#6d28d9|#7c3aed/i.test(css));
  assert.match(html, /id="mapy"/);
  assert.match(html, /class="map-shelf"/);
  assert.match(html, /id="postup"/);
});

test('screens participate in browser history and expose visible back navigation', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  const classic = read('js/classic.js');
  const activities = read('js/classic-activities.js');
  const editor = read('js/editor.js');
  const css = read('redesign.css');
  assert.match(html, /id="atlasBackBtn" class="nav-back"/);
  assert.match(html, /id="editorBackBtn" class="nav-back"/);
  assert.match(html, /class="nav-back-text">Domov</);
  assert.match(html, /data-nav-atlas/);
  assert.match(html, /data-editor-open/);
  assert.match(app, /registerRoute\('home'/);
  assert.match(app, /registerRoute\('atlas'/);
  assert.match(app, /registerRoute\('game'/);
  assert.match(classic, /registerRoute\('classic-setup'/);
  assert.match(classic, /registerRoute\('classic-game'/);
  assert.match(classic, /registerRoute\('editor'/);
  assert.match(classic, /startRouter\(\)/);
  assert.match(activities, /screen: 'classic-game'/);
  assert.match(editor, /screen: 'editor', mapKey: E\.mapKey/);
  assert.match(css, /\.nav-back\b/);
});

test('distance feedback uses guess points and exposes a last-guess stat', () => {
  const html = read('index.html');
  const activities = read('js/classic-activities.js');
  const app = read('js/app.js');
  const mapView = read('js/map-view.js');
  assert.match(html, /id="classicLastRow"/);
  assert.match(html, /id="classicLastValue"/);
  assert.match(html, /id="gameLastRow"/);
  assert.match(html, /id="gameLastValue"/);
  assert.match(html, /id="classicDistanceKm"/);
  assert.match(html, /Vzdialenosť/);
  assert.match(html, /Skóre tipu/);
  assert.match(activities, /dom\.lastValue\.textContent = `\$\{score\} b\.`/);
  assert.match(activities, /columns: \[t\('Objekt'\), t\('Vzdialenosť'\), t\('Skóre tipu'\)\]/);
  assert.match(activities, /kilometresForDistance\(context\.mapKey, dist\)/);
  assert.match(activities, /formatKilometres\(data\.km, getLanguage\(\)\)/);
  assert.match(activities, /revealPoints\(\[point, \{ x: targetX, y: targetY \}\], \{[\s\S]*?paddingBottom: Math\.max\(72, bottomPadding\)/);
  assert.doesNotMatch(activities, /ensurePointsVisible/);
  assert.match(app, /dom\.gameLastValue\.textContent = `\$\{score\} b\.`/);
  assert.match(mapView, /fitAnimated\(/);
  assert.match(mapView, /fitBoundsZoom/);
  assert.match(mapView, /_animateCameraTo\(/);
  assert.match(mapView, /oneFingerZoomTarget/);
  // Answer handlers leave the review at the player's zoom; the reset belongs
  // to the next-question transition so it always has a visible start state.
  const distanceAnswer = app.slice(
    app.indexOf('function answerDistance'),
    app.indexOf('function renderDistanceFeedback')
  );
  assert.doesNotMatch(distanceAnswer, /resetViewAnimated/);
  const quizAnswer = app.slice(app.indexOf('function answerQuiz'), app.indexOf('function answerPuzzle'));
  assert.doesNotMatch(quizAnswer, /resetViewAnimated/);
});

test('mission HUD height changes are animated instead of jumping', () => {
  const ui = read('js/classic-ui.js');
  const activities = read('js/classic-activities.js');
  const app = read('js/app.js');
  assert.match(ui, /export function animateHeightChange/);
  assert.match(ui, /element\.style\.transition = `height \$\{duration\}ms \$\{easing\}`/);
  assert.match(ui, /prefers-reduced-motion: reduce/);
  assert.match(activities, /animateHeightChange\(dom\.mission/);
  assert.match(activities, /setMissionTarget/);
  assert.match(app, /animateHeightChange\(dom\.gameMission/);
  assert.match(app, /setGameMissionTarget/);
});

test('the floating Next action stays docked at the bottom', () => {
  const activities = read('js/classic-activities.js');
  const app = read('js/app.js');
  const styles = read('styles.css');
  assert.match(activities, /GAME\.mapView\?\._fitFrame/);
  assert.match(activities, /nextFloatPending/);
  assert.match(activities, /legendPending/);
  assert.match(activities, /placeDistanceLegend/);
  assert.match(activities, /new ResizeObserver\([\s\S]*?GAME\.mapView\?\.layout\(\)/);
  assert.match(activities, /function nextFloatBottomPadding\(\)/);
  assert.match(activities, /paddingBottom: Math\.max\(72, bottomPadding\)/);
  assert.doesNotMatch(activities, /positionNextFloat/);
  assert.doesNotMatch(activities, /['"]is-top['"]/);
  assert.doesNotMatch(app, /positionNextFloat/);
  assert.doesNotMatch(app, /['"]is-top['"]/);
  assert.doesNotMatch(styles, /\.map-next-float\.is-top/);
});

test('mobile activity setup shows the complete map picker', () => {
  const css = read('redesign.css');
  assert.match(css, /Mobile setup: show the complete map grid/);
  assert.match(css, /\.setup-body \{\s*display: flex;\s*flex-direction: column;[\s\S]*?overflow-y: auto;/);
  assert.match(css, /\.setup-map-column \{[\s\S]*?display: block;[\s\S]*?flex: 0 0 auto;[\s\S]*?min-height: 0;/);
  assert.match(css, /\.setup-maps \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?max-height: none;[\s\S]*?overflow: visible;/);
  assert.match(css, /\.setup-map-copy strong \{[\s\S]*?white-space: normal;[\s\S]*?text-overflow: clip;/);
  assert.match(css, /\.setup-map-card \{\s*min-height: 52px;\s*padding: 5px;\s*gap: 7px;/);
  assert.match(css, /\.setup-map-thumb \{\s*width: 48px;\s*height: 34px;/);
  assert.match(css, /Short landscape: keep the full map grid and controls in view/);
});

test('Aim! results include kilometre breakdowns and average distance', () => {
  const html = read('index.html');
  const activities = read('js/classic-activities.js');
  const translations = read('js/translations.js');
  const css = read('redesign.css');
  assert.match(html, /id="classicResultDistance"/);
  assert.match(html, /id="classicResultDistanceLabel"/);
  assert.match(html, /id="classicResultDistanceValue"/);
  assert.match(activities, /function averageKilometres\(\)/);
  assert.match(activities, /averageKm: averageKilometres\(\)/);
  assert.match(activities, /formatKilometres\(row\.kilometres, getLanguage\(\)\)/);
  assert.match(activities, /columns: \[t\('Objekt'\), t\('Vzdialenosť'\), t\('Skóre tipu'\)\]/);
  assert.match(activities, /dom\.resultDistanceValue\.textContent/);
  assert.match(translations, /'Priemerná vzdialenosť od správnej polohy': 'Average distance from the correct location'/);
  assert.match(css, /\.result-distance/);
  assert.match(css, /\.result-list\.is-distance-result/);
});

test('Aim! holds a touch tap silently so gestures never flash a result', () => {
  const activities = read('js/classic-activities.js');
  const mapView = read('js/map-view.js');
  const css = read('classic.css');
  const answerTimer = /const DISTANCE_TOUCH_COMMIT_MS = (\d+);/.exec(activities);
  const tapWindow = /this\.interaction === 'click' \? (\d+) : 320/.exec(mapView);
  assert.ok(answerTimer && tapWindow);
  assert.ok(
    Number(tapWindow[1]) < Number(answerTimer[1]),
    `the ${tapWindow[1]} ms click double-tap window must end before the ${answerTimer[1]} ms answer timer`,
  );
  assert.match(activities, /function onDistanceClick\(point, event\)[\s\S]*?GAME\.pendingDistanceGuess = point;[\s\S]*?setTimeout\(commitPendingDistanceGuess, DISTANCE_TOUCH_COMMIT_MS\)/);
  assert.match(activities, /function commitPendingDistanceGuess\(\)/);
  assert.match(activities, /function cancelPendingDistanceGuess\(\)/);
  assert.match(activities, /map:doubletapstart', cancelPendingDistanceGuess/);
  assert.match(activities, /map:gesturestart', cancelPendingDistanceGuess/);
  assert.match(activities, /function nextDistanceQuestion\(\)[\s\S]*?cancelPendingDistanceGuess\(\)[\s\S]*?interaction = 'click'[\s\S]*?lastTap = null[\s\S]*?doubleTapDrag = null/);
  assert.doesNotMatch(activities, /distancePreview/);
  assert.doesNotMatch(activities, /pendingGuessMark/);
  assert.match(mapView, /map:doubletapstart/);
  assert.match(mapView, /map:gesturestart/);
  assert.match(mapView, /zoomAnimated\(/);
  assert.match(mapView, /_zoomFromDoubleTap[\s\S]*?zoomAnimated/);
  assert.doesNotMatch(css, /is-pending-guess/);
});

test('the homepage includes a changelog section', () => {
  const html = read('index.html');
  const css = read('redesign.css');
  assert.match(html, /id="novinky"/);
  assert.match(html, /class="changelog-list"/);
  assert.match(html, /class="changelog-entry changelog-entry-current"/);
  assert.match(html, /class="changelog-version">v2\.1</);
  assert.match(html, /Skóre tipu a vzdialenosť v kilometroch namiesto neprehľadných mapových jednotiek/);
  assert.match(html, /href="#novinky">Novinky</);
  assert.match(css, /\.changelog-section/);
  assert.match(css, /\.changelog-entry-current/);
  assert.match(css, /\.distance-legend\.is-top-left/);
  assert.match(css, /bottom: max\(84px, calc\(env\(safe-area-inset-bottom\) \+ 76px\)\)/);
});

test('search engine metadata, robots.txt and sitemap.xml are present', () => {
  const html = read('index.html');
  const robots = read('robots.txt');
  const sitemap = read('sitemap.xml');
  assert.match(html, /<link rel="canonical" href="https:\/\/em\.adriansliacky\.sk\/">/);
  assert.match(html, /<meta name="robots" content="index,follow/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(robots, /Sitemap: https:\/\/em\.adriansliacky\.sk\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/em\.adriansliacky\.sk\/<\/loc>/);
  const jsonLd = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(jsonLd, 'missing JSON-LD block');
  const data = JSON.parse(jsonLd[1]);
  assert.equal(data['@context'], 'https://schema.org');
  assert.ok(data['@graph'].some((item) => item['@type'] === 'WebApplication'));
  assert.match(read('404.html'), /<meta name="robots" content="noindex">/);
});

test('IndexNow key and deployment ping are configured', () => {
  const config = JSON.parse(read('indexnow.json'));
  assert.equal(config.host, 'em.adriansliacky.sk');
  assert.match(config.key, /^[a-f0-9]{32}$/);
  assert.equal(config.keyLocation, `https://em.adriansliacky.sk/${config.key}.txt`);
  assert.equal(read(`${config.key}.txt`).trim(), config.key);
  assert.match(config.urls[0], /^https:\/\/em\.adriansliacky\.sk\/$/);
  const workflow = fs.readFileSync(path.join(REPO, '.github', 'workflows', 'pages.yml'), 'utf8');
  assert.match(workflow, /node webapp\/scripts\/indexnow\.mjs/);
});

test('repository link and reimplementation credit are present', () => {
  const html = read('index.html');
  assert.match(html, /class="footer-github"/);
  assert.match(html, /https:\/\/github\.com\/adrian-sliacky-gymzv\/editor-map-2-web/);
  assert.match(html, /Reimplementácia: <b>Adrian Sliacky<\/b>/);
  assert.match(html, /<dt>Reimplementácia<\/dt><dd>Adrian Sliacky<\/dd>/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /<meta name="author" content="Adrian Sliacky">/);
});

test('sound controls are discoverable and persisted', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  const sound = read('js/sound.js');
  assert.match(html, /id="soundToggle"/);
  assert.match(html, /data-sound-toggle/);
  assert.match(html, /data-sound-checkbox/);
  assert.match(html, /data-sound-state/);
  assert.match(html, /aria-keyshortcuts="M"/);
  assert.match(html, /<kbd>M<\/kbd>/);
  assert.match(app, /initSound\(\)/);
  assert.match(app, /toggleMuted\(\)/);
  assert.match(sound, /editorMap2\.sound\.v1/);
  assert.match(sound, /AudioContext/);
});

test('motion is short, purposeful and reduced-motion aware', () => {
  const css = read('redesign.css');
  assert.match(css, /@keyframes dialog-in/);
  assert.match(css, /@keyframes feedback-pop/);
  assert.match(css, /--motion-fast: 110ms/);
  assert.match(css, /--motion-base: 160ms/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation-duration: 1ms !important/);
  assert.ok(!/animation-duration:\s*(?:[3-9]\d{2,}|\d{4,})ms/.test(css));
});

test('language settings and automatic translation hooks are present', () => {
  const html = read('index.html');
  const css = read('redesign.css');
  assert.match(html, /id="settingsBtn"/);
  assert.match(html, /id="settingsOverlay"/);
  assert.match(html, /data-language="auto"/);
  assert.match(html, /data-language="sk"/);
  assert.match(html, /data-language="en"/);
  assert.match(html, /data-i18n-html="heroTitle"/);
  assert.match(html, /id="homeTitle"[^>]*data-i18n-skip/);
  assert.match(read('js/i18n.js'), /editorMap2\.language/);
  assert.match(read('js/i18n.js'), /MutationObserver/);
  assert.match(read('js/translations.js'), /GAME_MESSAGES_EN/);
  assert.match(css, /\.settings-dialog/);
  assert.match(css, /\.settings-languages/);
  assert.match(css, /clamp\(156px, 20vw, 196px\)/);
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
  assert.match(html, /Skóre tipu/);

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
