# Development and release workflow

This repository is a static site. There is no bundler, database or backend.
Everything runs from **`webapp/`** and is published to GitHub Pages.

## Requirements

- Node.js **18+** (tested with current Node).
- No `npm install` is required; there are no dependencies.

## Local preview

```powershell
cd webapp
npm start
```

Open <http://localhost:8124/>. The server prints the LAN address too, so a phone
on the same Wi-Fi network can test touch gestures.

Do not open `index.html` with `file://`; ES modules and the `.mef`/SVG fetches
need HTTP.

If port 8124 is already in use:

```powershell
$env:PORT=8125; npm start
```

## Verification

```powershell
cd webapp
npm run lint:js   # parse every JavaScript module
npm test          # 88 Node tests
npm run verify    # lint + tests
```

Useful checks after a UI change:

- **Languages** — open **⚙ Settings**, switch between Slovenčina and English,
  reload, and confirm the choice is remembered. With no stored preference,
  `navigator.language` decides: `sk-*` → Slovak, everything else → English.
- **Landscape HUD** — test at 568×320, 667×375 and 844×390. The left rail should
  stay between 156 and 196 px, the map should fill the rest, and the rail must
  not scroll horizontally.
- **Map parity** — `npm test` compares every `webapp/data/maps/*.mef` byte with
  `software/newMapData/*.mef` and checks `config.xml` apart from its BOM/XML
  declaration.
- **Activities** — exercise all three games, the setup dialog, a result card and
  the editor on at least one map.
- **Console** — no errors in the browser console.

## Feature workflow

1. **Implement locally.** Do not push while a feature is being reviewed.
2. **Verify** with `npm run verify` and a browser pass.
3. **Preview** at <http://localhost:8124/>. The user reviews the real app.
4. **Wait for explicit approval.** Only then commit and push.
5. **Deploy** by pushing to `master`; the GitHub Actions workflow publishes
   `webapp/` to <https://em.adriansliacky.sk/>.

Commit in small, atomic steps while working; keep the working tree clean before
the preview. Never deploy an unapproved change.

## Where changes go

| Change | Main files |
| --- | --- |
| Pages, dialogs, static text | `webapp/index.html` |
| Shared UI, atlas, quick game | `webapp/js/app.js` |
| Original activities, scoring, setup | `webapp/js/classic-activities.js` |
| `.mef`/`config.xml` parsing | `webapp/js/classic-data.js` |
| Original target/candidate selection | `webapp/js/quiz-selection.js` |
| Map rendering and gestures | `webapp/js/map-view.js` |
| Editor | `webapp/js/editor.js` |
| Slovak → English strings | `webapp/js/translations.js` |
| Language engine | `webapp/js/i18n.js` |
| Visual design and responsive HUD | `webapp/redesign.css` |
| Original look and map UI | `webapp/classic.css`, `webapp/styles.css` |
| Dark theme | `webapp/dark.css` |
| Tests | `webapp/tests/*.test.mjs` |

## Adding a translation

1. Add the exact Slovak source string to `EN` in
   `webapp/js/translations.js`.
2. For markup with inline elements, add a `data-i18n-html` key to `EN_HTML` and
   the attribute to the element in `index.html`.
3. For sentences that contain numbers or names, add a pattern in
   `translateCore()` in `webapp/js/i18n.js` or a template in `EN_TEMPLATES` and
   call `t()` from the game code.
4. Original game messages live in `GAME_MESSAGES_EN` and are read through
   `gameMessage()`.

Original map object names are intentionally not translated; they are part of
the original `.mef` data.

## Data sources

The authoritative originals are in `software/`:

- `software/newMapData/*.mef` — the eight map datasets.
- `software/config.xml` — test groups, levels and game messages.
- `software/blindmaps.swf` — the original application (reference for parity).

Do not edit `webapp/data/maps/*.mef` by hand. If the original data changes,
replace the file and rerun `npm run verify`.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md). The live site is
<https://em.adriansliacky.sk/>; `webapp/CNAME` keeps the custom domain attached.
A normal push to `master` is the only release action.
