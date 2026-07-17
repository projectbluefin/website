# Task 4 Report

## Status

Complete in this worktree. No commit made.

## Task 4 files changed

- `src/WolvesApp.vue`
- `src/components/wolves/WolvesIntroOverlay.vue`
- `src/components/wolves/cinematic/MediaWidget.vue`
- `src/composables/useYoutubeIframeApi.ts`
- `src/data/wolves-destiny-captions.txt`
- `src/data/wolves-intro-sequence.ts`
- `src/tests/wolvesApp.test.ts`
- `src/tests/wolvesIntroOverlay.test.ts`
- `src/tests/wolvesIntroSequence.test.ts`
- `tests/wolves-intro-destiny-toggle.mjs`
- `tests/wolves-intro-segments.mjs`
- `tests/wolves-movie-flow.mjs`
- `docs/wolves-cinematic.md`
- `docs/wolves-maintenance.md`

## What changed

- Switched the default Destiny intro source to unvoiced `BV3BZKbpBns`.
- Added optional voiced override `BKm0TPqeOjY` behind the exact `Ikora voice over` checkbox, shown only during the Destiny intro segment.
- Preserved native time across source swaps with object-form `loadVideoById({ videoId, startSeconds })`.
- Preserved paused state across source swaps and clamped swap seeks to the active source cutoff.
- Kept `src/data/wolves-destiny-captions.txt` canonical in both modes.
- Updated the outro captions to:
  - stop the old narration after `Pushing back buys us only time, but the alternative is unthinkable.`
  - pause captions after that line via an explicit cue end
  - show `We built a city none of us dared` at the verified black frame
  - remove `Define us in this moment for all time.`
- Restored title-card/canonical-caption coexistence during `Comic Hero Shots of YOU`.
- Added application-owned top-left masking and paused-state masking for the YouTube chrome.
- Removed `unloadModule()` typing/usages/mocks.
- Added a real-player Playwright verification script for desktop/mobile plus screenshots.

## Measured video durations and outro cutoff

Measured from the real local page with the YouTube player loaded through the app:

- Default unvoiced source `BV3BZKbpBns`
  - natural duration: `123.221s`
  - authored cutoff (`maxDuration`): `121.5s`
- Optional voiced source `BKm0TPqeOjY`
  - natural duration: `120.221s`
  - authored cutoff (`alternateMaxDuration`): `120.2s`

Black-frame verification for the default source:

- fine-grained paused frame scan directory: `.superpowers/sdd/task4-blackframe-fine/`
- sampled range: `118.2s` to `119.2s` in `0.1s` steps
- first screenshot whose grayscale mean dropped to the black threshold (`<= 4.0`) was `119.0s`
- final canonical outro line therefore starts at `119.0s`
- final cutoff updated to `121.5s` to preserve the parser’s trailing `2.5s` authored hold

## Exact verification commands and results

### Focused unit tests

Command:

```bash
npm run test:run -- src/tests/wolvesIntroSequence.test.ts src/tests/wolvesIntroOverlay.test.ts src/tests/wolvesApp.test.ts
```

Result:

- passed
- `3` files
- `54` tests passed

### Lint / formatting

Command:

```bash
npm run lint:fix
```

Result:

- passed

### Typecheck

Command:

```bash
npm run typecheck
```

Result:

- passed

### Production build

Command:

```bash
npm run build
```

Result:

- passed
- Vite build completed successfully
- existing Lightning CSS warnings still appeared for Tailwind `@theme` / `@tailwind` at-rules

### Desktop real-player browser verification

Command:

```bash
WOLVES_SCREENSHOT_DIR=.superpowers/sdd/task4-shots-desktop WOLVES_VIEWPORT=1440x900 node tests/wolves-intro-destiny-toggle.mjs
```

Result:

- passed
- verified:
  - checkbox hidden before Destiny and on the slate
  - checkbox visible only on Destiny
  - default source id is `BV3BZKbpBns`
  - title card and canonical caption coexist at `24.2s`
  - source toggle while playing preserves time and stays playing
  - source toggle while paused preserves time and stays paused
  - top-left mask, pause veil, and checkbox bounds remain inside the viewport/widget
  - black-frame outro caption appears at `119.0s`

### Mobile real-player browser verification

Command:

```bash
WOLVES_SCREENSHOT_DIR=.superpowers/sdd/task4-shots-mobile WOLVES_VIEWPORT=390x844 node tests/wolves-intro-destiny-toggle.mjs
```

Result:

- passed
- repeated the same assertions under mobile layout

## Screenshot artifacts

Desktop:

- `.superpowers/sdd/task4-shots-desktop/destiny-desktop-title-card-captions.png`
- `.superpowers/sdd/task4-shots-desktop/destiny-paused-voice-mask.png`
- `.superpowers/sdd/task4-shots-desktop/destiny-black-frame-outro.png`

Mobile:

- `.superpowers/sdd/task4-shots-mobile/destiny-desktop-title-card-captions.png`
- `.superpowers/sdd/task4-shots-mobile/destiny-paused-voice-mask.png`
- `.superpowers/sdd/task4-shots-mobile/destiny-black-frame-outro.png`

## Concerns

1. The optional voiced source is naturally shorter than the unvoiced default, so the canonical final caption hold is shorter in voice-over mode by design (`120.2s` source cutoff vs `121.5s` default authored cutoff).
2. `npm run build` still emits the pre-existing Lightning CSS warnings about Tailwind at-rules even though the build succeeds.

## 2026-07-17 comic hero QR addendum

### Status

Complete in this worktree. No commit made.

### Additional files changed

- `src/assets/svg/qr-makemeacomic.svg`
- `src/components/wolves/WolvesIntroOverlay.vue`
- `src/tests/wolvesIntroOverlay.test.ts`
- `tests/wolves-intro-destiny-toggle.mjs`

### What changed

- Generated a scannable SVG QR for exactly `https://makemeacomic.com` with the existing `qrcode` dependency.
- Imported the QR asset into `WolvesIntroOverlay.vue` and rendered it only inside the `Comic Hero Shots of YOU` title card.
- Added visible `makemeacomic.com` text plus accessible link and alt text.
- Added focused component assertions for the QR URL, imported SVG render, visible domain text, and title-card-only rendering.
- Extended the real-player Task 4 browser script to assert QR bounds, non-overlap with the Chonky hero shot and canonical caption, and to capture a dedicated QR title-card screenshot.

### Exact verification commands and results

#### Focused component tests

Command:

```bash
npm run test:run -- src/tests/wolvesIntroOverlay.test.ts src/tests/wolvesQrCodes.test.ts
```

Result:

- passed
- `2` files
- `33` tests passed

#### Lint / formatting

Command:

```bash
npm run lint:fix
```

Result:

- passed

#### Typecheck

Command:

```bash
npm run typecheck
```

Result:

- passed

#### Production build

Command:

```bash
npm run build
```

Result:

- passed
- Vite build completed successfully
- existing Lightning CSS warnings still appeared for Tailwind `@theme` / `@tailwind` at-rules

#### Desktop real-player browser verification

Command:

```bash
WOLVES_SCREENSHOT_DIR=.superpowers/sdd/task4-shots-desktop WOLVES_VIEWPORT=1440x900 node tests/wolves-intro-destiny-toggle.mjs
```

Result:

- passed
- verified:
  - QR link href is exactly `https://makemeacomic.com`
  - QR link aria label is `Open makemeacomic.com`
  - QR image alt text is `QR code linking to makemeacomic.com`
  - visible domain text is `makemeacomic.com`
  - QR asset rendered from the imported SVG
  - QR/image/link/title-card bounds stayed within the viewport
  - QR did not overlap the Chonky hero shot
  - QR did not overlap the canonical caption band
  - dedicated QR title-card screenshot captured

#### Mobile real-player browser verification

Command:

```bash
WOLVES_SCREENSHOT_DIR=.superpowers/sdd/task4-shots-mobile WOLVES_VIEWPORT=390x844 node tests/wolves-intro-destiny-toggle.mjs
```

Result:

- passed
- repeated the same QR/link/bounds assertions under `390x844`

### Screenshot artifacts

Desktop:

- `.superpowers/sdd/task4-shots-desktop/destiny-title-card-qr.png`
- `.superpowers/sdd/task4-shots-desktop/destiny-desktop-title-card-captions.png`
- `.superpowers/sdd/task4-shots-desktop/destiny-paused-voice-mask.png`
- `.superpowers/sdd/task4-shots-desktop/destiny-black-frame-outro.png`

Mobile:

- `.superpowers/sdd/task4-shots-mobile/destiny-title-card-qr.png`
- `.superpowers/sdd/task4-shots-mobile/destiny-desktop-title-card-captions.png`
- `.superpowers/sdd/task4-shots-mobile/destiny-paused-voice-mask.png`
- `.superpowers/sdd/task4-shots-mobile/destiny-black-frame-outro.png`
