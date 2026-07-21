# Agent instructions

## Scope

This repository builds a production website and separately mounted
sub-applications with Vue, TypeScript, Vite, SCSS, and Tailwind.

## Absolute boundary

**Agents edit content. Agents never edit design.**

Content includes prose, translations, URLs, data values, registered records, and
approved assets inside existing structures.

Design includes layout, markup structure, component behavior, styles, typography,
responsive behavior, navigation prominence, and animation.

A content request does not authorize a design change. Stop and ask for explicit
approval if the requested result needs a design file or runtime behavior change.

## Start here

1. Read this file.
2. Read `docs/skills/INDEX.md`.
3. Load one matching skill from `docs/skills/`.
4. Read the source file that owns the requested content.
5. Check `git status --short` before editing.

## Production entry points

| Path | Entry file | Status |
|---|---|---|
| `/` | `index.html` | Public main site |
| `/wolves/` | `wolves/index.html` | Public experience |
| `/dakota/` | `dakota/index.html` | Unlisted sub-application |
| `/server/` | `server/index.html` | Separate production entry |

Do not promote an unlisted path through navigation, metadata, or a sitemap.

## Content sources

- Main-site locale copy: `src/locales/en-US.json`
- Main-site fixed data and links: `src/content.ts`
- Wolves content: `docs/reference/wolves-runtime.md`
- Locale rules: `TRANSLATION-GUIDE.md`
- Generated data: use the generator named by the owning reference

Use `import.meta.env.BASE_URL` for public runtime asset paths.

## Commands

```bash
npm install --include=dev
npm run dev
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run preview
```

For documentation-only changes:

```bash
git diff --check
```

Use the smallest relevant check. See `docs/skills/validation/SKILL.md` before
reporting completion.

## Temporary artifacts

Use `/var/tmp/website-agent/` for logs, screenshots, browser fixtures, and
handoff artifacts. Do not write session artifacts to `/tmp`.

## Worktree safety

- Do not modify unrelated dirty files.
- Stage explicit paths only.
- Never use `git add .` or `git add -A`.
- Do not use destructive reset or restore commands.
- Do not hand-edit generated files.
- Do not claim production completion from a local build.
- Verify the exact pushed commit's deployment workflow before saying the change
  is live.

## Authored content

Do not invent lore, fiction, dialogue, quotes, attributions, or release-note
narrative. Preserve supplied wording, provenance, URLs, and placeholders. Read
`docs/skills/editorial-provenance/SKILL.md`.

## Design gate

If the diff would touch a component, template, style, layout, animation, control,
or navigation surface, stop and load `docs/skills/design-gate/SKILL.md`.

## References

- `docs/reference/content-map.md`
- `docs/reference/production-entrypoints.md`
- `docs/architecture/application-map.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
