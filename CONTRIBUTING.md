# Contributing to projectbluefin/website

Thanks for helping out! This guide covers everything you need to contribute to the Bluefin marketing website.

> For broader project contribution (image builds, architecture, community), see the [full Contributing Guide](https://docs.projectbluefin.io/contributing).

## Repository overview

This is the **projectbluefin.io** marketing website — a multi-SPA project built with [Vite](https://vitejs.dev/) and [Vue 3](https://vuejs.org/). It contains three sub-apps:

| Directory | Purpose |
|-----------|---------|
| `bluespeed/` | Main Bluefin landing page |
| `dakota/` | Dakota variant landing page |
| `knuckle/` | Knuckle bare-metal installer page |
| `public/` | Static assets served as-is |

## Local development

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/)
- Optional: [just](https://github.com/casey/just) for simplified commands

### Setup

```bash
git clone https://github.com/projectbluefin/website
cd website
npm install
```

### Dev server

```bash
npm run dev        # Start development server (hot reload)
npm run build      # Build for production
npm run preview    # Preview the production build locally
```

With `just`:
```bash
just build         # Build for production
just serve         # Preview the production build locally
```

### Linting and formatting

The project uses [`@antfu/eslint-config`](https://github.com/antfu/eslint-config) for linting and formatting. Run before submitting a PR:

```bash
npm run lint        # Lint
npm run lint:fix    # Lint and auto-fix
npm run typecheck   # Type-check with vue-tsc
```

## Adding a new language (i18n)

1. Copy an existing locale file from `src/locales/` (e.g., `enUS.json`)
2. Name your file following [Navigator.language](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language) (e.g., `ptBR.json`)
3. Translate all values — keep all keys identical to `enUS.json`
4. Open a PR; CI will validate the JSON schema

### Locale field rendering

Not all locale fields are rendered the same way. Using the wrong markup in a field produces broken output.

**Markdown fields** — support `**bold**`, `[links](url)`, `_italic_`, etc. (rendered via `marked.parse()`):

| Key | Component |
|-----|-----------|
| `Users.Features` | SceneUsers.vue |
| `Devs.TowerJoke` | SceneDevelopers.vue |
| `Devs.RuntimeContainers` | SceneDevelopers.vue |
| `Devs.CNJourney` | SceneDevelopers.vue |
| `Mission.Text.Change` | SectionMission.vue |
| `Mission.Text.CloudNative` | SectionMission.vue |
| `Mission.Text.Sustainability` | SectionMission.vue |
| `Mission.CleverGirl` | SectionMission.vue |
| `TryBluefin.Description` | ImageChooser.vue |
| `TryBluefin.Description.Choice` | ImageChooser.vue |
| `TryBluefin.Description.Updates` | ImageChooser.vue |
| `TryBluefin.Download.Documentation.Intro` | ImageChooser.vue |
| `TryBluefin.Download.Documentation.Downloads` | ImageChooser.vue |
| `TryBluefin.Download.Documentation.SecureBoot` | ImageChooser.vue |
| `Video.Text.Passion` | SceneContent.vue |
| `Video.Text.StateOfTheArt` | SceneContent.vue |
| `Footer.Credits.Intro` | SectionFooter.vue |
| `Footer.Credits.Wallpapers` | SectionFooter.vue |
| `Footer.Credits.Website` | SectionFooter.vue |
| `Footer.Credits.Logos` | SectionFooter.vue |
| `Footer.Credits.Thanks` | SectionFooter.vue |
| `Footer.Credits.Translations` | SectionFooter.vue |
| `Footer.Credits.ImageEdit` | SectionFooter.vue |
| `Footer.Project.Ublue` | SectionFooter.vue |

**Raw HTML fields** — use `<a href="...">link</a>` directly; Markdown syntax will appear literally (rendered via `v-html`):

| Key | Component |
|-----|-----------|
| `Bazaar.Description` | SectionBazaar.vue |
| `Bazaar.Additional` | SectionBazaar.vue |

**Plain text fields** — all other keys. Markdown and HTML tags will appear as literal characters. Do not use markup.

## Testing

Run tests locally before opening a PR.

**Unit tests** (Vitest — fast, no browser needed):

```bash
npm run test:run    # run once and exit
npm test            # run in watch mode
```

**Navbar visual tests** (Playwright — requires a running dev server):

```bash
npm run dev &                   # start dev server (or in a separate terminal)
node tests/navbar-visual.mjs    # 38 assertions against navbar rendering
```

The Playwright tests check that the navigation bar renders correctly at various viewport widths. Run them after any change to `TopNavbar.vue` or layout-affecting CSS.

## PR workflow

1. Fork the repo and create a branch: `git checkout -b feat/my-change`
2. Make your changes
3. Run linting, unit tests, and the navbar visual tests (see **Testing** above)
4. Commit with a [Conventional Commits](https://www.conventionalcommits.org/) message: `feat(section): add X`
5. Push and open a PR against `main`
6. All PRs require at least 1 approving review from a maintainer before merging

## Security issues

Please **do not** file public issues for security vulnerabilities. See `SECURITY.md` or email the maintainers directly.
