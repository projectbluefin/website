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
npm run test:gate
npm run build
```

Full code checks:

```bash
npm run lint:fix
npm run typecheck
npm run test:gate
npm run build
```

## The suite is red; use the gate

`npm run test:run` is **not** a pass/fail signal in this repository. The vitest
suite has carried failures for over a week (35 failing on 2026-07-29, 33 on
2026-08-05 afternoon, 26 now). A bare run prints a large failure count whether or
not you broke anything, so agents learned to ignore it — which is how a series of
real regressions shipped unnoticed in a single afternoon.

Use the baseline gate instead:

```bash
npm run test:gate
```

It runs the suite, compares the failing set against `tests/known-failures.txt`,
and exits non-zero **only for failures you introduced**. It also lists baseline
failures that now pass, so the baseline shrinks as the suite is repaired.

Re-record only when you have deliberately changed the failure set, and say so in
the commit message:

```bash
npm run test:gate:update
```

Never re-record to silence a failure you caused. Never delete an entry by hand
to hide a still-failing test.
A shrinking `tests/known-failures.txt` is good; a growing one needs a reason.

### Baseline entry format and shrinking it deliberately

Each baseline line is `<test file path> :: <full concatenated describe + test
name>`, one test per line, sorted (see `scripts/test-baseline.mjs`). When you
repair a stale test (the test was wrong, the code was right), the correct
shrink is: fix the test, delete exactly its line from
`tests/known-failures.txt` in the same change, and prove it with
`npm run test:gate` — the gate must report `no new failures (N known,
baseline N)` with the count reduced. Prefer deriving repaired expectations
from the owning source data (e.g. import `buildIntroVideoSequence` /
`INTRO_SEQUENCE_DURATION`) over fresh hardcoded literals, so authored-timing
changes don't re-stale the test. Issue #705 tracks the remaining baseline.

## Red Flags

- Completion is based only on a local build.
- A different commit's deployment is cited.
- Unrelated generated changes are staged.
- A deletion is committed while a manifest still references the missing file.
- Only a build is checked for a route that eagerly loads runtime data.
- `git add .` or `git add -A` is used.
- More than one dev server is listening, or a `vite preview` is up during source
  work.
- A change is called missing from the browser before the serving process and its
  port were identified.
- `npm run test:run` output is used to decide whether a change is safe.
- `tests/known-failures.txt` is re-recorded in the same commit as the change that
  added the failures.
- Something is deleted as "dead code" without checking the non-Wolves
  experiences that share `WolvesComicReader.vue`.

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

## Local dev server hygiene

"I don't see my change in the browser" is usually a server problem, not a code
problem. Before debugging application code, prove which process answers the port.

```bash
ss -ltnp | grep -E '5173|4173|4174|5174'
ps -eo pid,lstart,args | grep vite | grep -v grep
```

Rules:

- Run exactly one dev server. Every extra `vite` or `vite preview` started by a
  previous session is a separate app on its own port, and a stale tab can sit on
  any of them for hours.
- `vite preview` serves a frozen `dist/`. It never hot-reloads and never picks up
  source edits. Never leave one running while doing source work, and delete the
  stale `dist/` so nothing can serve it again.
- Bare `vite` binds `[::1]` only; `vite --host 127.0.0.1` binds IPv4 only. When
  both exist, `localhost` reaches different apps depending on resolution order.
  Start with `--host :: --port 5173 --strictPort` so one server answers both
  stacks on a predictable port, and `--strictPort` fails loudly instead of
  silently drifting to 5174.
- Kill stale servers by explicit numeric PID, one `kill <PID>` per command.

Prove the server is live rather than assuming it:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/wolves/
curl -s http://localhost:5173/src/path/to/Edited.vue | grep -c 'marker-from-your-edit'
```

Then prove HMR actually pushes. Load the page in Chromium, collect console
output, write a real edit to a source file, restore it, and require both
`[vite] connected` and a `[vite] hot updated:` line naming that file. A page that
loads is not evidence that it refreshes.

Also confirm no service worker is registered; a cached worker produces the same
"nothing updates" symptom and this repo intentionally registers none.

## References

- `../../reference/production-entrypoints.md`
- `../../architecture/runtime-data-flow.md`

## Wolves timing validation

For lore timing work, run typecheck, focused lore/timing/timeline tests, build, diff check, and a Chromium smoke of /wolves/. Report focused results separately from full-suite baseline failures. Assert a non-empty rendered body, zero page errors, no failed module requests, preserved locked anchors, contiguous unlocked slots, and readable representative short/long records.
