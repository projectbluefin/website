---
name: validation
description: Use when checking changes, staging files, pushing commits, or deciding whether production is live.
---

# Validation

## Overview

Choose checks that prove the changed behavior without claiming more than they
prove.

## When to Use

Use before completion reports, commits, pushes, deployment checks, or live-status
claims.

## When NOT to Use

Do not run the full application suite for documentation-only changes.

## Core Process

1. Match checks to changed paths.
2. Run `git diff --check`.
3. Inspect `git status --short` and the diff; classify unrelated dirty files
   before staging.
4. For deletions, search manifest, import, timeline, and generated-data
   references before committing.
5. Stage explicit paths only.
6. For a push, verify the exact commit's deployment workflow and smoke-test the
   affected route in Chromium for page errors.

Documentation-only check:

```bash
git diff --check
```

Application content or data checks:

```bash
npm run typecheck
npm run test:run
npm run build
```

Full code checks:

```bash
npm run lint:fix
npm run typecheck
npm run test:run
npm run build
```

## Red Flags

- Completion is based only on a local build.
- A different commit's deployment is cited.
- Unrelated generated changes are staged.
- A deletion is committed while a manifest still references the missing file.
- Only a build is checked for a route that eagerly loads runtime data.
- `git add .` or `git add -A` is used.

## Verification

After pushing, verify the exact commit:

```bash
sha=$(git rev-parse HEAD)
gh run list --repo projectbluefin/website \
  --workflow "Deploy to GitHub Pages" --commit "$sha" --limit 1 \
  --json databaseId,headSha,status,conclusion,url
```

Production is complete only when the run has the same SHA, status `completed`,
and conclusion `success`. For multi-entry builds, also smoke-test every path
listed in `../../reference/production-entrypoints.md`; adding an HTML entry alone
is insufficient unless the Vite Rollup input and directory redirect include it.
For runtime manifests, the browser smoke must assert both a non-empty rendered
body and zero `pageerror` events.

## References

- `../../reference/production-entrypoints.md`
- `../../architecture/runtime-data-flow.md`

## Wolves timing validation

For lore timing work, run typecheck, focused lore/timing/timeline tests, build, diff check, and a Chromium smoke of /wolves/. Report focused results separately from full-suite baseline failures. Assert a non-empty rendered body, zero page errors, no failed module requests, preserved locked anchors, contiguous unlocked slots, and readable representative short/long records.
