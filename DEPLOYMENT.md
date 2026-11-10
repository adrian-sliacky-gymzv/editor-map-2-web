# GitHub Pages deployment

## Current deployment

| | |
| --- | --- |
| Repository | <https://github.com/adrian-sliacky-gymzv/editor-map-2-web> |
| **Live site** | **<https://em.adriansliacky.sk/>** |
| Default Pages URL | <https://adrian-sliacky-gymzv.github.io/editor-map-2-web/> (redirects to the live site) |
| Custom domain | `em.adriansliacky.sk` (HTTPS enforced) |
| Pages source | **GitHub Actions** |
| Workflow | `.github/workflows/pages.yml` |
| Published folder | `webapp/` |
| Default branch | `master` |

The site is live on the custom domain. The workflow is enabled to create the
Pages site automatically when needed. `webapp/CNAME` keeps the domain attached
across deployments.

## Updating the live site

Every push to `master` (or `main`) rebuilds and redeploys the site:

```bash
git add .
git commit -m "Describe your change"
git push
```

There is no build step, no `npm install` and no manual upload.

You can also run the deployment manually:

1. Open the repository’s **Actions** tab.
2. Select **Deploy to GitHub Pages**.
3. Choose **Run workflow**.

## How the workflow works

1. Checks out the repository.
2. Configures GitHub Pages (`actions/configure-pages@v5`, with
   `enablement: true`).
3. Uploads only the `webapp/` directory.
4. Deploys it with `actions/deploy-pages@v4`.

The site is static. `server.mjs` is only for local/LAN preview and is not used
by GitHub Pages.

## Local preview

```bash
cd webapp
npm start
```

Open <http://localhost:8124/>. Node.js 18+ is required.

Do not open `index.html` through `file://`; ES modules and map data need HTTP.

## Re-creating the deployment from scratch

This is only necessary if the repository or Pages configuration is ever
deleted.

### 1. Create the repository

Create an empty **public** GitHub repository. A free GitHub account requires a
public repository for GitHub Pages.

### 2. Add the remote and push

From `C:\Users\adkos\Downloads\Editor_map_GEG`:

```bash
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin master
```

For `main` instead of `master`:

```bash
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

The workflow listens for both branches.

### 3. Set the Pages source

Repository → **Settings → Pages** → **Build and deployment** → **Source**:
choose **GitHub Actions**.

### 4. Run the workflow

Push, or run **Actions → Deploy to GitHub Pages → Run workflow**.

The site is available at:

```text
https://<user>.github.io/<repo>/
```

### 5. Custom domain

The production domain is **`em.adriansliacky.sk`**, configured with a Cloudflare
CNAME and HTTPS enforced. See [`CUSTOM_DOMAIN.md`](CUSTOM_DOMAIN.md) for the
existing setup and the bare-domain alternative.

## Deployment checklist

- [x] Public repository created.
- [x] `origin` remote configured.
- [x] GitHub Pages enabled with **GitHub Actions**.
- [x] Deployment workflow green.
- [x] Default URL returns HTTP 200.
- [x] Homepage, CSS, JS, map data and thumbnails load.
- [x] A game starts from the live site without console errors.
- [x] Custom `404.html` is served.
- [x] Custom domain `em.adriansliacky.sk` configured.
- [x] HTTPS certificate approved and HTTPS enforced.

## Troubleshooting

- **The Actions run fails at “Deploy to GitHub Pages”** — check
  **Settings → Pages → Source** is **GitHub Actions**.
- **Deployment is blocked by environment protection** — the `github-pages`
  environment must allow the pushed branch. This repository currently allows
  both `master` and `main`.
- **CSS or JS is missing** — the workflow must upload `webapp/` as the artifact
  root; do not change the `path` unless the site structure changes.
- **A route shows GitHub’s default 404** — use the site root URL and navigate
  with the app. `webapp/404.html` is the custom fallback.
- **A custom domain is stuck on “DNS check failed”** — make sure the Cloudflare
  records are **DNS only**, not proxied, until GitHub issues the certificate.
- **The page is stale after a deployment** — hard-refresh with `Ctrl+F5`.
