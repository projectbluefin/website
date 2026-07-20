---
name: build-verify-deploy
version: "1.1"
last_updated: 2026-07-18
tags: [validation, deployment, github-pages]
description: Use when validating changes, preparing a commit or push, checking GitHub Pages, or deciding whether website work is complete or live.
metadata:
  type: procedure
---

# Build, Verify, Deploy

## When to Use

Use before committing, pushing, reporting completion, or answering whether a change is live.

## When NOT to Use

Do not run every application suite for a documentation-only change.

## Commands

| Purpose | Command |
|---|---|
| Install | `npm install --include=dev` |
| Develop | `npm run dev` |
| Format and lint | `npm run lint:fix` |
| Type-check | `npm run typecheck` |
| Test | `npm run test:run` |
| Build | `npm run build` |
| Preview | `npm run preview` |
| Navbar browser assertions | `node tests/navbar-visual.mjs` |
| Wolves CI oracle | `WOLVES_BASE_URL=http://localhost:5174 node tests/wolves-movie-flow.mjs` |
| Wolves manual oracles | same env: `tests/wolves-lobby-progress.mjs`, `tests/wolves-intro-segments.mjs`, `tests/wolves-transition-chat.mjs` |

Use the smallest relevant checks. Documentation-only changes need path/link checks and `git diff --check`, not unrelated application test suites.

## Core Process

1. Run the smallest checks that prove the changed behavior.
2. Inspect the worktree and stage explicit paths.
3. Push only the intended commit.
4. Verify the exact pushed SHA's Pages run.
5. Complete Wolves or visual browser checks when applicable.

## Worktree Safety

- Inspect `git status --short` before staging.
- Never stage, restore, or commit unrelated user changes.
- `npm run test:run` may modify `public/dakota-versions.json`; leave it unstaged unless intentionally changed.
- Stage explicit paths. Never use `git add .` or `git add -A`.
- A modified-but-unstaged file can satisfy imports during local `typecheck`/`build`. Before pushing, confirm the staged version also compiles and passes tests; CI only sees what is committed.

## Visual and Wolves Verification

- Approved visual changes require desktop and mobile screenshots.
- Wolves changes follow `docs/wolves-maintenance.md`, including real-player checks at affected Track 0 timestamps.
- A successful build is not proof that a visual or timeline change works.
- CI runs Vitest and `tests/wolves-movie-flow.mjs`. Other browser scripts, including navbar and timestamp-specific Wolves oracles, remain manual unless the workflow source shows otherwise.
- If the browser cannot exercise the changed visual flow, stop before pushing. A historical snapshot, unit test, or successful build is not a substitute for browser evidence.
- When Playwright captures screenshots, set `TMPDIR` and `WOLVES_SCREENSHOT_DIR` to a persistent filesystem with adequate free space instead of a full `/tmp` tmpfs. `page.screenshot({ path })` writes the image at the supplied path.

## Wolves Browser Oracles

- Run oracles against `npm run dev` (the `window.__wolvesCinematic.seekTo` hook is dev-only). `npm run preview` binds IPv6 `::1`; use `localhost`, never `127.0.0.1`, in `WOLVES_BASE_URL`.
- Any change to Wolves content, plate wiring, intro stage count, or component markup must update the affected browser oracles in the same change. Stale oracle expectations have turned CI red without any product bug.
- The Track 0 nameplate label crossfades in 200ms (`out-in`). Never assert its text by instant `textContent()` equality; wait for the expected value:
  `await page.waitForFunction(text => document.querySelector('.wc-stage-nameplate .wc-nameplate-label')?.textContent === text, expected, { timeout: 5_000 })`.
- `window.__mockWolvesPlayers` accumulates destroyed instances. Always select the newest match: `[...window.__mockWolvesPlayers].reverse().find(entry => entry.videoId === id)`.
- Transition overlays render the terminal block on every handoff; `transitionLore` conversations are hidden from the overlay but still drive the transition SFX.

## Production Completion

After pushing:

```bash
sha=$(git rev-parse HEAD)
gh run list \
  --repo projectbluefin/website \
  --workflow "Deploy to GitHub Pages" \
  --commit "$sha" \
  --limit 1 \
  --json databaseId,headSha,status,conclusion,url
```

Production is complete only when the run for the exact pushed SHA is `completed` with conclusion `success`. No matching run, an in-progress run, or a failed run is not complete.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The build passed, so it is live." | Only the exact pushed-SHA Pages run proves deployment. |
| "Staging everything is faster." | It risks committing unrelated user work. |
| "The browser is unavailable, but the unit tests pass." | Visual work remains blocked until a browser-capable environment verifies the affected flow. |

## Red Flags

- Completion claimed from a local build.
- A Pages run for a different SHA is cited.
- `git add .` or `git add -A`.
- Pushing a visual change without browser evidence.
- Asserting slow-fading text with instant equality instead of a wait.
- Reading the first `__mockWolvesPlayers` entry instead of the newest match.
- Changing Wolves content or markup without updating the browser oracles in the same change.

## Verification

- [ ] Relevant checks passed.
- [ ] Manual browser checks match the changed behavior.
- [ ] Only intended paths are staged and committed.
- [ ] Exact pushed-SHA Pages deployment succeeded.
- [ ] Wolves live checks passed when applicable.

## Sources

- `package.json`
- `.github/workflows/deploy.yml`
- `docs/wolves-maintenance.md`
- Playwright screenshot API: `/microsoft/playwright`
