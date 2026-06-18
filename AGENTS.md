# Bluefin Website — Agent Instructions

**Deployed at:** https://projectbluefin.io/  
**Framework:** Vue 3 + Vite + TailwindCSS 4 + TypeScript  
**Fork-aware:** all public asset fetches MUST use `import.meta.env.BASE_URL`, not absolute `/` paths.

## Quick Start

```bash
npm install --include=dev         # ~6s, installs 102 packages. MUST use --include=dev
npm run dev                       # serves on http://localhost:5173/
npm run build                     # ~1.7s, outputs to ./dist/
npm run lint:fix                  # format before committing
```

## Non-obvious gotchas

- 🌐 **vue-i18n is in LEGACY mode:** use `(i18n.global as any).locale = x` — NOT `.locale.value = x` (will silently no-op)
- 📐 **TopNavbar uses `px` not `rem`** — site root font-size is 63.5% (~10 px base); pixel values are intentional
- 🔒 **Dakota page is `noindex` / unlisted** — hidden from search engines and nav; do not add to sitemap or main nav
- 🔒 **Bluespeed page is `noindex` / unlisted** — same pattern; `src/KnuckleApp.vue`, `bluespeed/index.html`
- ✅ **Run `node tests/navbar-visual.mjs`** to validate navbar against docs.projectbluefin.io (38 Playwright assertions)
- **Public asset fetches** — MUST use `import.meta.env.BASE_URL` prefix, not absolute `/` paths:
  ```ts
  fetch(`${import.meta.env.BASE_URL}knuckle-versions.json`) // ✅
  fetch('/knuckle-versions.json') // ❌ breaks on subpath deploy
  ```

## Data Pipeline

### ISO Download URL format
`https://download.projectbluefin.io/bluefin[-gdx][-nvidia-open]-{stream}[-hwe]-{arch}.iso`

### Version data files
- `public/dakota-versions.json` — Dakota versions (kernel, gnome, mesa, bootc, etc.)
- `public/stream-versions.yml` — stream kernel/gnome/mesa/nvidia versions, updated daily at 08:00 UTC by `update-content.yml`
- `src/assets/svg/growth_bluefins.svg` — growth chart from ublue-os/countme

### Data flow
Stream versions parsed from GitHub Release markdown tables (format-dependent — see TODO in `scripts/update-stream-versions.js` for SBOM-based fix).

## Git / Fork Workflow

**Never push directly to main.** Work on a topic branch:
```bash
git remote add upstream git@github.com:projectbluefin/website.git
git fetch upstream
git checkout -b <feature-branch> upstream/main
```

**Never open PRs to `projectbluefin/*` directly** — provide compare URL for human review.

## Attribution Requirements

AI agents must disclose tool and model in commit footer:
```text
Assisted-by: [Model] via [Tool]
```
