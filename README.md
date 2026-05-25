# Development

This website is built with [Vite](https://vitejs.dev/) and [Vue](https://vuejs.org/). npm is the primary package manager; `just` is optional to simplify common commands.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)
- Optional: [just](https://github.com/casey/just) (for simplified commands)

### Getting Started

First, install the dependencies:

```bash
npm install
```

Then, you can use `just` to run the common commands:

-   `just build`: Build for production
-   `just serve`: Preview the production build locally

<details>
<summary>Don't have `just`? Use npm</summary>

-   `npm run dev`: Run the development server
-   `npm run build`: Build for production
-   `npm run preview`: Preview the production build locally
-   `npm run lint`: Lint the project
-   `npm run lint:fix`: Lint and fix all possible errors
-   `npm run typecheck`: Typechecks the project with `vue-tsc`

### Formatting

The project utilizes the [@antfu/eslint-config](https://github.com/antfu/eslint-config) to standardize formatting. This means that we solely utilize ESLint to lint and format the project.

Since the `@antfu/eslint-config` doesn't support formatting for CSS files, we have to utilize an external formatter (in this case prettier) under `eslint-plugin-format` to actually format the files.

Please ensure that you format your code before submitting a PR!

</details>

## Repository Structure

This is a **Vite multi-page application**. Each top-level subdirectory with an
`index.html` is a separate entry point that mounts its own Vue app, but all
pages share the same `src/` source tree.

```
website/
├── index.html            # projectbluefin.io — main Bluefin marketing site
├── dakota/
│   └── index.html        # /dakota/ — Dakota homelab management UI
├── knuckle/
│   └── index.html        # /knuckle/ — Knuckle bare-metal installer page
├── bluespeed/
│   └── index.html        # /bluespeed/ — Bluespeed home-infra sub-app (noindex)
│
├── src/                  # Shared Vue source for all pages
│   ├── App.vue           # Main site root component
│   ├── DakotaApp.vue     # Dakota root component
│   ├── KnuckleApp.vue    # Knuckle root component
│   ├── main.ts           # Main site entry point
│   ├── dakota-main.ts    # Dakota entry point
│   ├── knuckle-main.ts   # Knuckle entry point
│   ├── components/       # Vue components
│   │   ├── common/       # Site-wide UI primitives
│   │   ├── sections/     # Main-site content sections
│   │   ├── scenes/       # Hero / scene sections
│   │   ├── dakota/       # Dakota-specific components
│   │   └── knuckle/      # Knuckle-specific components
│   ├── composables/      # Reusable Vue composables
│   ├── locales/          # i18n JSON files (one per locale)
│   ├── assets/           # Images, fonts, and other static assets
│   └── style/            # Global CSS
│
├── public/               # Copied verbatim to build output (favicons, etc.)
├── scripts/              # Build-time helper scripts
└── tests/                # Playwright end-to-end tests
```

### Which directory should I edit?

| I want to change… | Edit here |
|--------------------|-----------|
| Main site copy / text | `src/locales/en-US.json` |
| Main site layout / logic | `src/components/sections/` or `src/components/scenes/` |
| Dakota UI | `src/components/dakota/` and `src/DakotaApp.vue` |
| Knuckle landing page | `src/components/knuckle/` and `src/KnuckleApp.vue` |
| A translation | `src/locales/<locale>.json` — see [TRANSLATION-GUIDE.md](TRANSLATION-GUIDE.md) |
| Site-wide nav or footer | `src/components/common/` or `src/App.vue` |
| Vite build config / entry points | `vite.config.ts` |

## Contributing

If you want to add another language to this website, add a JSON file to
[src/locales](src/locales) with your language file named following the
[BCP 47 / Navigator.language](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language)
convention (e.g. `pt-BR.json`, `ja-JP.json`).

See [TRANSLATION-GUIDE.md](TRANSLATION-GUIDE.md) for a full walkthrough,
including which fields support plain text, Markdown, or HTML.

For all other contributions, see [CONTRIBUTING.md](CONTRIBUTING.md).
