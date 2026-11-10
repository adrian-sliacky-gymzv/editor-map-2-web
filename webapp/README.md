# Editor máp 2 — Technical Documentation

Live application: **https://em.adriansliacky.sk/**

A non-commercial, static web reimplementation of the original Slovak game
**Editor máp 2** (2010). It preserves the original eight maps, 1,982 geographic
objects, tests, difficulty levels and scoring, and adds a modern editor, a city
atlas, responsive touch controls, a curated dark theme and a complete English
interface alongside the original Slovak.

The project is plain HTML, CSS and JavaScript. There is no framework, no
database, no backend and no build step.

---

## 1. What is included

### Original activities

- **Vyskúšaj sa!** — all eight maps and all tests from `data/config.xml`.
  A question shows 3, 5 or 7 candidate pins; one belongs to the requested
  object. Scoring is the share of correct answers.
- **Traf sa!** — seven original maps (the original configuration excludes
  Australia for this activity). The player clicks the map; the original
  distance formula converts the miss distance into points. Feedback thresholds
  match the original game.
- **Poskladaj!** — seven original maps (the original configuration excludes
  Slovakia for this activity). The object starts in the centre of the map and
  must be dragged to its real position. The original tolerance is 15 map units.

All activities support the original question counts, levels, timer and result
messages. The result card can be closed and reopened without leaving the game.

### Languages

- Slovak and English UI, including game messages, result cards, editor labels,
  help and accessibility labels.
- **Automatic** language detection on the first visit: Slovak browsers get
  Slovak, every other browser gets English.
- A language selector is available from the **⚙ Settings** button on the home
  header. The choice is stored locally.
- Original map object names remain in their original Slovak form; the map data
  itself is unchanged.

### Map editor

- New/Open/Save/Save As for the original `.mef` files. The editor uses the File
  System Access API when available and falls back to download/file-picker
  behaviour.
- Full object tree with expand/collapse, search, visibility states and counts.
- Layer and object visibility, including parent/child state propagation.
- Original 32-colour palette plus transparency and a custom colour picker.
  Supports the original `replaceColor`, `colorAdd` and `overrideColor` modes,
  including the special `0x010101` value.
- Custom marks: add to any branch, move, rename, hide or delete. Marks are
  stored in the `.mef` file.
- Drawing: line, rectangle, ellipse and freehand; colour, thickness 0–4 and
  fill; undo of the last drawing. Drawings are stored in `drawinglist`.
- Zoom, pan, fit, mouse wheel, pinch zoom, mobile slide-over tree, drawing
  toolbar and keyboard shortcuts.
- PNG/JPEG export at low/medium/high resolution, whole map or current view,
  with an optional watermark.
- Print support for paper or PDF.
- About and help dialogs with the original credits and licence information.

Activities always use a clean copy of the original `.mef` data, matching the
original `Fileman.getNewMapData` behaviour. An in-progress editor document is
never leaked into a game.

### City atlas

- All 74 Slovak cities with original coordinates, names and `testLevel`.
- Diacritic-insensitive search and cumulative difficulty filters.
- Selection on the map or in the list.
- Training for one city or the whole filtered list.
- CSV export, local statistics and shareable result text.

---

## 2. Running locally

Requirements: **Node.js 18+**. There are no dependencies and no `npm install`
step.

```bash
cd webapp
npm start
# or: node server.mjs
```

Open <http://localhost:8124/>. The server listens on `0.0.0.0` and prints the
LAN address for testing on a phone on the same Wi-Fi network.

Do not open `index.html` through `file://`; ES modules, fetches and SVG scenes
require an HTTP server.

Run the test suite and the syntax check from `webapp/`:

```bash
npm test          # Node test suite
npm run lint:js   # parse every JavaScript module
npm run verify    # lint + tests
```

---

## 3. Project structure

```text
webapp/
├─ index.html                 – application shell and dialogs
├─ 404.html                   – GitHub Pages fallback
├─ styles.css                 – shared UI and atlas foundations
├─ classic.css                – activities, editor and map UI
├─ dark.css                   – curated dark palette
├─ redesign.css               – cartographic editorial design system
├─ js/
│  ├─ app.js                  – legacy quick game, atlas, statistics
│  ├─ cities.js               – 74 cities with original coordinates
│  ├─ scoring.js              – original city scoring
│  ├─ modes.js                – quiz/puzzle modes and statistics
│  ├─ map-gestures.js         – testable pinch/zoom/pan mathematics
│  ├─ map-view.js             – shared SVG map renderer and gestures
│  ├─ classic.js              – application entry point and deep links
│  ├─ classic-data.js         – config.xml, .mef and XML helpers
│  ├─ classic-ui.js           – overlays, toasts and confirmations
│  ├─ classic-activities.js   – the three original activities
│  ├─ quiz-selection.js       – original group cycling, targets and candidates
│  ├─ i18n.js                 – language detection, DOM localizer and helpers
│  ├─ translations.js         – Slovak → English UI, help and config messages
│  └─ editor.js               – tree, colours, marks, drawing, files, export
├─ data/
│  ├─ config.xml              – original activity/test configuration
│  ├─ maps.json               – map index and dimensions
│  └─ maps/*.mef              – eight original data files
├─ assets/
│  ├─ maps/*.svg              – vector scenes for all eight maps
│  ├─ thumbs/*.png            – map thumbnails
│  ├─ slovakia-map.svg        – atlas/quick-game base map
│  ├─ slovakia-map-vuc.svg    – map with regional boundaries
│  ├─ editormap-logo.png
│  └─ icon.svg
├─ help/                      – original help pages (Slovak)
├─ tests/                     – Node test suite
├─ scripts/check.mjs          – JavaScript syntax verification
├─ .nojekyll                  – disables Jekyll for Pages
├─ server.mjs                 – local/LAN preview server
├─ manifest.webmanifest
└─ README.md                  – this document
```

The repository root also contains:

- `README.md` — bilingual, layperson-friendly project overview
- `DEVELOPMENT.md` — local preview, verification and approval-based release flow
- `DEPLOYMENT.md` — GitHub Pages deployment guide
- `CUSTOM_DOMAIN.md` — custom-domain guide for `adriansliacky.sk`
- `screenshots/` — README illustrations

---

## 4. Map data and original formats

`data/config.xml` defines the map lists, tests, groups and default difficulty
levels. The `.mef` files contain the object tree, coordinates, labels, colours,
visibility and mark metadata used by the original application.

The SVG scenes under `assets/maps/` are the original vector map drawings. The
renderer applies the `.mef` colours and visibility at runtime. All assets are
loaded with relative paths so the app works both at the domain root and under a
GitHub Pages project path.

### Map aspect ratios

The maps are intentionally landscape-oriented finite canvases. In portrait the
whole map is fitted by width; in landscape or after zooming, the available map
area is used more fully. The fitted view is fixed in place and panning begins
only after the user zooms in.

---

## 5. Interaction model

- **Fit / default view** — the map is centred and locked. One-finger drags do
  not move it. The fitted view is the button **⌂** and the `0` shortcut.
- **Zoom in** — wheel, trackpad pinch, two-finger pinch, `+`/`−`, double-tap or
  double-click. Zoom is anchored at the cursor/finger midpoint.
- **Pan** — one finger or mouse drag after zooming. Inertia and elastic edges
  make the map feel like a map canvas, not a frozen image.
- **Recenter** — **◎** returns to the centred full-map view and resets the zoom.
  It is equivalent to **⌂** and `0`.
- **Tap safety** — the final touch after a pinch, pan or double-tap never counts
  as an answer. Taps on map controls never answer. Puzzle pieces require a real
  tap; a drag does not submit.
- **New question** — each question starts from the full fitted map. In
  `Traf sa!`, the view zooms out if the guess or correct point is outside the
  viewport.

### Mobile layout

- **Portrait** — compact one-row HUD: target, points and question. Average and
  time are hidden. The map controls remain bottom-right.
- **Landscape** — the HUD moves to a compact left side rail
  (`clamp(156px, 20vw, 196px)`) and the map gets the full remaining height. The
  mission, points/question counters and controls stay readable at 568×320.
  This applies to classic activities, the quick game and the editor (which
  compacts its toolbar).
- **Safe areas** — controls respect `env(safe-area-inset-*)`.

---

## 6. Keyboard shortcuts

| Key | Action |
| --- | --- |
| `1`–`5` | Homepage: activity, editor and atlas cards |
| `Enter` / `Space` | Next question after answering; confirm dialogs |
| `Esc` | Close a dialog/result, or end the current activity |
| `+` / `−` | Zoom in / out |
| `0` | Fit the whole map |
| Arrow keys | Pan the map (hold `Shift` for a larger step) |
| `/` | Atlas search |
| `?` | Open/close help |
| `Ctrl+S` | Editor: save |
| `Ctrl+Shift+S` | Editor: save as |
| `Ctrl+O` | Editor: open |
| `Ctrl+N` | Editor: new map |

Shortcuts are ignored while typing in an input or when a blocking dialog is
open.

---

## 7. Languages

The source language is Slovak. English is applied by
[`js/i18n.js`](js/i18n.js) and the dictionary in
[`js/translations.js`](js/translations.js).

- The stored preference is `auto`, `sk` or `en` in
  `localStorage` under `editorMap2.language`.
- **Auto** resolves to Slovak only when the browser language starts with `sk`;
  all other languages get English.
- Static markup is localised through exact source-string keys and, for mixed
  inline markup, `data-i18n-html` attributes.
- Dynamically generated game/editor text is translated by the same dictionary,
  with a small set of patterns and `t()` templates for sentences containing
  numbers or names.
- Original `config.xml` game messages have explicit English equivalents in
  `GAME_MESSAGES_EN`; the original map data and object names are never modified.
- The `<html lang>`, document title, meta description, ARIA labels and control
  tooltips all follow the selected language.

To add a new UI string, put the exact Slovak source in `EN` (or a mixed-markup
version in `EN_HTML`). If it contains a number or a name, add a pattern in
`translateCore()` or an `EN_TEMPLATES` entry and call `t()`.

---

## 8. Deep links

- `/?mode=test` — open the setup for **Vyskúšaj sa!**
- `/?mode=distance&map=svet` — open the setup for **Traf sa!** on the world map
- `/?mode=puzzle&map=europa` — open the setup for **Poskladaj!** on Europe
- `/?mode=test&map=slovensko&testIndex=0&levelIndex=2&numQ=5&autostart=1`
  — start a game directly
- `/?editor=1&map=europa` — open the editor with the Europe map

Supported map keys: `slovensko`, `svet`, `europa`, `afrika`, `azia`,
`severna_amerika`, `juzna_amerika`, `australia`.

---

## 9. Persistence and privacy

- Activity setup, the last editor map and quick-game statistics are stored in
  `localStorage` in the browser.
- There is no analytics, tracking, account system or server-side storage.
- Replacing the browser storage or using a private window resets local data.
- The application can be exported as a static site and has no secrets.

---

## 10. Accessibility, themes and responsive design

- Semantic landmarks, visible focus rings and keyboard operation.
- `prefers-color-scheme` light/dark themes; the dark theme uses a dark map
  table with inverted map linework for contrast.
- Responsive breakpoints tested at 320, 390, 568 (landscape), 768, 1024 and
  1280+ px.
- `aria-keyshortcuts` on the main shortcuts; the help dialog is keyboard
  accessible.
- No horizontal overflow at the supported widths.
- Lighthouse audits (light and dark, portrait and landscape) report **100**
  Accessibility, Best Practices, SEO and Agentic Browsing on the audited
  screens.

---

## 11. Tests and QA

```bash
npm test
```

Current status: **92 tests, 92 passing**. Coverage includes:

- original scoring, per-map maximum distance and puzzle tolerance;
- original quiz group cycling, unused targets and candidate sampling;
- byte-for-byte `.mef` parity and semantic `config.xml` parity with `software/`;
- question selection and difficulty pools;
- pinch/zoom/pan mathematics and the locked fitted map;
- map dimensions and all eight maps;
- activity HUD, markers and result flows;
- map picker and activity presets;
- recenter controls;
- statistics and city training;
- Slovak/English detection, exact translations, plurals and dynamic sentences;
- relative paths, manifest, help pages and GitHub Pages workflow;
- the `em.adriansliacky.sk` CNAME and custom-domain deployment;
- responsive and dark-theme source guards.

The complete activity matrix was exercised across **94 combinations**
(61 test cases, 26 `Traf sa!`, 7 `Poskladaj!`), including result visibility,
HUD values and the editor on all eight maps. Real CDP touch tests verified
pinch anchoring, panning in both directions, inertia and the fixed fitted view.

---

## 12. Deployment

The project is deployed with GitHub Actions to GitHub Pages. The workflow is
[`../.github/workflows/pages.yml`](../.github/workflows/pages.yml) and publishes
only the `webapp/` folder.

See [`DEPLOYMENT.md`](../DEPLOYMENT.md) for the complete deployment guide and
[`CUSTOM_DOMAIN.md`](../CUSTOM_DOMAIN.md) for using `adriansliacky.sk`.

A push to `master` or `main` triggers a new deployment. The site remains a
plain static site; no server is required.

Local changes are previewed first and deployed only after approval. The full
loop is documented in [`../DEVELOPMENT.md`](../DEVELOPMENT.md).

---

## 13. Credits and licence

Original application: **Editor máp 2.0** (mxm.blindmaps), 2010.

- Author: **RNDr. Štefan Karolčík, PhD**
- Design and programming: **Ing. Juraj Hrabovec — MAX MEDIA**
- Map data: **RNDr. Daniel Gurňák, PhD**

This is a non-commercial educational reimplementation. Original names, map
data and trademarks remain the property of their respective authors. The
original application and its outputs are subject to the original educational
licence; see the in-app **About** section and the original help pages for
details.
