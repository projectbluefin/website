# Contributing

## Boundary

**Agents edit content. Agents never edit design.**

Content changes may update prose, translations, URLs, data values, registered
records, and approved assets inside existing structures. They do not authorize
layout, markup, component behavior, styles, typography, responsive behavior,
navigation prominence, or animation changes.

## Setup

```bash
npm install --include=dev
npm run dev
```

Read `AGENTS.md` and `docs/skills/INDEX.md` before editing. Read the source file
that owns the requested content.

## Checks

Documentation-only changes:

```bash
git diff --check
```

Content or data changes:

```bash
npm run typecheck
npm run test:run
npm run build
```

Code or runtime changes require explicit design or engineering approval and the
full relevant validation workflow.

## Git and production handoff

Use a Conventional Commit. Stage explicit paths only. Do not use `git add .` or
`git add -A`. Do not modify, restore, or commit unrelated dirty files.

The production remote is `upstream` (`projectbluefin/website`). Check remotes
before pushing; remove an accidental fork remote rather than pushing production
work to it.

Before reporting completion, follow `docs/skills/validation/SKILL.md`. A local
build does not prove deployment; verify the exact pushed commit's deployment run
and then check the live URL. Use `/var/tmp/website-agent/` for temporary logs and
screenshots; do not use `/tmp`.
