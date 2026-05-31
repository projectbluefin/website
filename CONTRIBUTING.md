# Contributing to the Project Bluefin Website

Thanks for helping out! This repository contains the source for
[projectbluefin.io](https://projectbluefin.io) — a multi-page
[Vite](https://vitejs.dev/) + [Vue 3](https://vuejs.org/) application.

> **Looking to change Bluefin itself?**
> This repo is for the website only. Head to
> [@ublue-os/bluefin](https://github.com/ublue-os/bluefin) or
> [@projectbluefin/common](https://github.com/projectbluefin/common) for the OS
> images. See the
> [architecture diagram](https://docs.projectbluefin.io/contributing#understanding-bluefins-architecture)
> for the full picture.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | 24+ (current LTS) | Runtime + build toolchain |
| [npm](https://www.npmjs.com/) | bundled with Node.js | Package manager |
| [just](https://github.com/casey/just) | any | Optional — wraps common npm commands |

Install Node.js via your system package manager, [nvm](https://github.com/nvm-sh/nvm),
or the [official installer](https://nodejs.org/en/download/).

---

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/projectbluefin/website.git
cd website

# 2. Install dependencies
npm install

# 3. Start the dev server (http://localhost:5173)
npm run dev
# or, if you have just installed:
just serve
```

The dev server supports hot module replacement — changes to `.vue` files and
locale JSON are reflected instantly without a full page reload.

### Other useful commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start the local dev server |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | Check for linting / formatting issues |
| `npm run lint:fix` | Auto-fix linting and formatting issues |
| `npm run typecheck` | TypeScript type check (via `vue-tsc`) |
| `just build` / `npm run build` | Build for production (not needed for PRs) |

---

## Repository Structure

```plaintext
website/
├── index.html            # Main Bluefin site entry point
├── dakota/index.html     # Dakota app entry point
├── knuckle/index.html    # Knuckle product page entry point
├── bluespeed/index.html  # Bluespeed sub-app entry point (noindex)
├── src/
│   ├── App.vue           # Main site root component
│   ├── DakotaApp.vue     # Dakota root component
│   ├── KnuckleApp.vue    # Knuckle root component
│   ├── main.ts           # Main site bootstrap
│   ├── dakota-main.ts    # Dakota bootstrap
│   ├── knuckle-main.ts   # Knuckle bootstrap
│   ├── components/       # Shared Vue components
│   │   ├── common/       # Site-wide UI primitives
│   │   ├── sections/     # Main-site content sections
│   │   ├── scenes/       # Scene / hero sections
│   │   ├── dakota/       # Dakota-specific components
│   │   └── knuckle/      # Knuckle-specific components
│   ├── composables/      # Reusable Vue composables
│   ├── locales/          # i18n translation files (JSON)
│   ├── assets/           # Static images, fonts, etc.
│   └── style/            # Global CSS
├── public/               # Files copied verbatim to build output
├── scripts/              # Build helper scripts
├── tests/                # Playwright end-to-end tests
├── vite.config.ts        # Vite config — defines multi-page inputs
├── eslint.config.js      # ESLint config (@antfu/eslint-config)
└── tailwind.config.js    # Tailwind CSS config
```

The site uses Vite's
[multi-page app](https://vitejs.dev/guide/build.html#multi-page-app) mode.
Each subdirectory (`dakota/`, `knuckle/`, `bluespeed/`) is a separate HTML
entry point that mounts its own Vue app root. They share the same `src/`
source tree and all locale data.

See [TRANSLATION-GUIDE.md](TRANSLATION-GUIDE.md) for the full i18n workflow.

---

## Making Changes

### Main website content

Text strings that appear on the main site live in `src/locales/en-US.json`.
Visual layout and logic live in the Vue components under `src/components/sections/`
and `src/components/scenes/`.

### Adding or editing a component

Components follow the
[Vue 3 `<script setup>` / Composition API](https://vuejs.org/api/sfc-script-setup.html)
style. Keep new components in the most specific subdirectory (`common/`,
`sections/`, `dakota/`, `knuckle/`, etc.).

### Translations

To add or update a translation, edit (or create) the relevant file in
`src/locales/`. See [TRANSLATION-GUIDE.md](TRANSLATION-GUIDE.md) for a full
walkthrough, including which fields support Markdown or HTML.

---

## Code Style and Formatting

This project uses [ESLint](https://eslint.org/) via
[@antfu/eslint-config](https://github.com/antfu/eslint-config) for both
**linting and formatting** — there is no separate Prettier config. Key rules:

- **Indent:** 2 spaces
- **Quotes:** single quotes
- **CSS / `<style>` blocks:** formatted via Prettier (via `eslint-plugin-format`)
- **`console.log` is banned** — use `console.info`, `console.warn`, or
  `console.error` instead

Before opening a PR, run the auto-fixer:

```bash
npm run lint:fix
```

If `npm run lint` reports errors that `--fix` cannot auto-correct, address them
manually before submitting.

---

## Submitting a Pull Request

1. **Fork** the repository and create a branch from `main`.
2. **Make your change** — keep the scope focused.
3. **Run the linter** — `npm run lint:fix` then `npm run lint` must be clean.
4. **Sign your commits** (DCO required):
   ```bash
   git commit -s -m "fix(locales): correct German translation for Landing.Title"
   ```
5. **Open a PR** against `main` and fill out the description.

### Commit message convention

Use conventional commits: `<type>(<scope>): <short description>`

Common types: `feat`, `fix`, `docs`, `chore`, `i18n`, `style`, `refactor`

Examples:
```plaintext
feat(knuckle): add download counter to hero section
fix(locales): correct typo in fr-FR Mission.Text.Change
i18n: add Polish (pl-PL) locale
docs: expand CONTRIBUTING guide
```

### DCO — Developer Certificate of Origin

All commits must be signed with `-s` (`--signoff`). This adds a
`Signed-off-by:` trailer certifying you have the right to submit the
contribution under the project's license.

```bash
# Sign a new commit
git commit -s -m "your message"

# Add sign-off to the most recent commit
git commit --amend -s --no-edit
```

---

## Questions?

- [Discord](https://discord.gg/projectbluefin) — quickest way to get help
- [GitHub Discussions](https://github.com/projectbluefin/website/discussions)
- [Open an issue](https://github.com/projectbluefin/website/issues) for bugs
  or feature requests
