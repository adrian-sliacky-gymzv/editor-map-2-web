# Deploying Editor máp 2 to GitHub Pages

The repository is already prepared for a static GitHub Pages deployment.

- The site lives in `webapp/`.
- There is no build step and no `npm install` is required.
- `.github/workflows/pages.yml` uploads only `webapp/` and deploys it with the official GitHub Pages actions.
- All asset paths are relative, so the app works at a project URL such as `https://<user>.github.io/<repo>/`.
- `webapp/.nojekyll`, `webapp/404.html` and `webapp/manifest.webmanifest` are in place.

## What only you can do

These steps require your GitHub account; they cannot be done from this machine without your repository URL and credentials.

### 1. Create the GitHub repository

Create an empty **public** repository on GitHub (for example `Editor_map_GEG`).
Do not initialise it with a README, because the local repository already has history.

> GitHub Pages for **private** repositories requires a paid GitHub plan. If you use a free account, use a public repository.

### 2. Add the remote and push

Run these commands in `C:\Users\adkos\Downloads\Editor_map_GEG`:

```bash
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin master
```

If you prefer the `main` branch instead of `master`:

```bash
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

The workflow listens for both `master` and `main`, so either is fine.

### 3. Enable GitHub Actions as the Pages source

In the GitHub repository:

1. Open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Keep the default branch and `/` settings as they are.

The workflow runs automatically after the first push. You can also run it manually:
**Actions → Deploy to GitHub Pages → Run workflow**.

### 4. Open the site

After the workflow finishes, the deployment URL appears in the workflow summary and under **Settings → Pages**:

```
https://<your-user>.github.io/<your-repo>/
```

The first deployment can take a minute or two. A hard refresh (`Ctrl+F5`) is useful if you previously opened the URL while it was still deploying.

### 5. Optional: custom domain

If you use a custom domain:

1. Add the domain under **Settings → Pages → Custom domain**.
2. Add the DNS records GitHub shows (usually a `CNAME` record for a subdomain).
3. Wait for the TLS certificate to be issued.
4. If you want the domain stored in the repository, add a `CNAME` file to `webapp/` containing only the domain name.

## Updating the site

Every push to `master`/`main` rebuilds and republishes the site:

```bash
git add .
git commit -m "Update the map site"
git push
```

No other deployment command is needed.

## Local preview before deploying

```bash
cd webapp
npm start
```

Then open `http://localhost:8124/`. `server.mjs` is only for local/LAN preview and is not needed by GitHub Pages.

## Troubleshooting

- **The Actions run fails at "Deploy to GitHub Pages"** — check that **Settings → Pages → Source** is set to **GitHub Actions**.
- **The page loads but CSS/JS is missing** — confirm the repository is using the included workflow unchanged. It uploads `webapp/` as the site root.
- **A route shows GitHub's default 404** — use the site root URL (with the trailing slash) and navigate with the app's own buttons. `webapp/404.html` is the custom fallback.
- **The deploy job says the environment is not allowed** — in **Settings → Environments → github-pages**, make sure deployment from the default branch is allowed.
- **Nothing happens after a push** — the workflow must exist on the pushed branch. Check **Actions** and run **Deploy to GitHub Pages** manually once.

## Deployment checklist

- [ ] Public repository created.
- [ ] `origin` remote added and `master`/`main` pushed.
- [ ] **Settings → Pages → Source** set to **GitHub Actions**.
- [ ] Workflow **Deploy to GitHub Pages** is green.
- [ ] Site opens at `https://<user>.github.io/<repo>/`.
- [ ] Homepage hero starts **Traf sa! – ťažká – 10 otázok**.
- [ ] A map can be pinched, zoomed and panned in both axes.
