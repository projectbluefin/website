# Task 3 Report

## Status

Implemented Task 3 in this worktree on top of the existing uncommitted Task 2 changes without removing the Comic Hero Shots work.

## Exact files changed for Task 3

- `src/data/wolves-intro-sequence.ts`
- `src/components/wolves/WolvesIntroOverlay.vue`
- `src/WolvesApp.vue`
- `src/config/wolves-cinematic.ts`
- `src/tests/wolvesIntroSequence.test.ts`
- `src/tests/wolvesIntroOverlay.test.ts`
- `src/tests/wolvesApp.test.ts`
- `tests/wolves-intro-segments.mjs`
- `docs/wolves-cinematic.md`
- `docs/wolves-maintenance.md`

## Intro segment order and durations

1. `species-prelude` — 32s
2. `wolves-prologue` — 94s
3. `universal-blue-briefing` — 43s
4. `bluefin-cinematic-universe` — 28s
5. `wolves-intro` — Destiny trailer, `maxDuration: 114`

Total intro runtime before Track 0 handoff: 311s.

## Implemented requirements

- Added a silent factual species prelude before Gayane using only the authored factual notes and concise factual subsets.
- Preserved the Gayane prologue at 94s and kept its cue boundaries unchanged.
- Added the authored `universal-blue-briefing` text segment.
- Added the authored `bluefin-cinematic-universe` slate immediately before the Destiny trailer.
- Changed the trailer intro chapter label from `INTRO` to `UNIVERSAL BLUE BRIEFING`.
- Added optional cue-level `nameplateTitle` support and propagated it through typed intro status into `WolvesApp.vue`.
- Added multiple exact highlight ranges so only `LIFE`, `DROSS`, and `GARDEN` render blue in the specified Gayane cue.
- Styled ``For Nova``` so only the final backtick is blue/bold.
- Updated docs that still described older 75s/85s intro assumptions.

## Tests and validation run

### TDD red/green

- Red: `npm run test:run -- src/tests/wolvesIntroSequence.test.ts src/tests/wolvesIntroOverlay.test.ts src/tests/wolvesApp.test.ts`
- Green: same command after implementation

### Final verification

- `npm run lint:fix`
- `npm run typecheck`
- `npm run test:run -- src/tests/wolvesIntroSequence.test.ts src/tests/wolvesIntroOverlay.test.ts src/tests/wolvesApp.test.ts`
- `WOLVES_BASE_URL=http://127.0.0.1:5173 WOLVES_SCREENSHOT_DIR=.superpowers/sdd/task-3-screenshots/desktop WOLVES_VIEWPORT=1440x900 node tests/wolves-intro-segments.mjs`
- `WOLVES_BASE_URL=http://127.0.0.1:5173 WOLVES_SCREENSHOT_DIR=.superpowers/sdd/task-3-screenshots/mobile WOLVES_VIEWPORT=390x844 node tests/wolves-intro-segments.mjs`
- `npm run build`

## Screenshots captured

### Desktop

- `.superpowers/sdd/task-3-screenshots/desktop/01-species-dimetrodon.png`
- `.superpowers/sdd/task-3-screenshots/desktop/02-species-deinonychus.png`
- `.superpowers/sdd/task-3-screenshots/desktop/03-prologue-life-dross-garden.png`
- `.superpowers/sdd/task-3-screenshots/desktop/04-prologue-nameplate-override.png`
- `.superpowers/sdd/task-3-screenshots/desktop/05-universal-blue-briefing.png`
- `.superpowers/sdd/task-3-screenshots/desktop/06-cinematic-universe-slate.png`
- `.superpowers/sdd/task-3-screenshots/desktop/07-cinematic-universe-for-nova.png`
- `.superpowers/sdd/task-3-screenshots/desktop/08-destiny-trailer.png`

### Mobile

- `.superpowers/sdd/task-3-screenshots/mobile/01-species-dimetrodon.png`
- `.superpowers/sdd/task-3-screenshots/mobile/02-species-deinonychus.png`
- `.superpowers/sdd/task-3-screenshots/mobile/03-prologue-life-dross-garden.png`
- `.superpowers/sdd/task-3-screenshots/mobile/04-prologue-nameplate-override.png`
- `.superpowers/sdd/task-3-screenshots/mobile/05-universal-blue-briefing.png`
- `.superpowers/sdd/task-3-screenshots/mobile/06-cinematic-universe-slate.png`
- `.superpowers/sdd/task-3-screenshots/mobile/07-cinematic-universe-for-nova.png`
- `.superpowers/sdd/task-3-screenshots/mobile/08-destiny-trailer.png`

## Concerns

- `npm run build` still emits pre-existing Lightning CSS warnings about unknown `@theme` and `@tailwind` at-rules during minification; the build succeeds.
- This worktree still contains the pre-existing uncommitted Task 2 changes and assets; Task 3 was layered on top of them and not committed, per request.

## Fix review gap: punctuation-preserving intro cues

- Root cause: `src/components/wolves/WolvesIntroOverlay.vue` stripped periods and commas from every displayed intro cue via `stripIntroPunctuation()`, so the new authored briefing/slate cards could not render their exact punctuation.
- Fix: added cue-level `preservePunctuation?: boolean` in `src/data/wolves-intro-sequence.ts`, used it only on the punctuation-sensitive `universal-blue-briefing` and `bluefin-cinematic-universe` cues, and routed overlay/highlight text through a shared formatter so the `For Nova\`` backtick highlight still matches the rendered text.
- Added focused regression coverage proving briefing/slate punctuation is preserved while a normal Gayane cue still strips periods/commas.

### Exact commands and results

- `npm run test:run -- src/tests/wolvesIntroSequence.test.ts src/tests/wolvesIntroOverlay.test.ts src/tests/wolvesApp.test.ts`
  - Result: passed (`3` files, `46` tests)
- `npm run lint:fix`
  - Result: passed
- `npm run typecheck`
  - Result: passed
- `npm run test:run -- src/tests/wolvesIntroSequence.test.ts src/tests/wolvesIntroOverlay.test.ts src/tests/wolvesApp.test.ts`
  - Result: passed (`3` files, `46` tests)
- `npm run build`
  - Result: passed; pre-existing Lightning CSS warnings for unknown `@theme` / `@tailwind` at-rules still emitted during minification
