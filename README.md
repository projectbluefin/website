# Website

This repository builds a production website and separately mounted
sub-applications with Vue 3, TypeScript, Vite, SCSS, and Tailwind.

## Boundary

**Agents edit content. Agents never edit design.**

Read `AGENTS.md` before editing. Use `docs/skills/INDEX.md` to load only the
workflow needed for the task.

## Production entries

| Path | Entry | Status |
|---|---|---|
| `/` | `index.html` | Public main site |
| `/wolves/` | `wolves/index.html` | Public experience |
| `/dakota/` | `dakota/index.html` | Unlisted |
| `/server/` | `server/index.html` | Separate entry |

## Local development

```bash
npm install --include=dev
npm run dev
```

Available checks:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run preview
```

## Documentation

- `AGENTS.md`: agent entry point and repository boundaries.
- `docs/skills/INDEX.md`: lazy-loaded task workflows.
- `docs/reference/content-map.md`: production content sources.
- `docs/reference/wolves-runtime.md`: Wolves content and runtime boundaries.
- `CONTRIBUTING.md`: contributor workflow.
- `TRANSLATION-GUIDE.md`: locale editing rules.
- `SECURITY.md`: vulnerability reporting.
