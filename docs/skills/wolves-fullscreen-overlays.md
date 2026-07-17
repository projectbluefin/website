---
name: wolves-fullscreen-overlays
version: "1.0"
last_updated: 2026-07-17
tags: [wolves, overlays, youtube]
description: Use when explicitly authorized to build or debug a Wolves fullscreen overlay, cinematic takeover, shared control surface, or YouTube IFrame Player integration.
metadata:
  type: procedure
  context7-sources:
    - /websites/developers_google_youtube
    - /websites/vuejs_guide
    - /mdn/content
---

# Wolves Fullscreen Overlays

This is engineering work on a frozen design surface. Explicit authorization is required. Read `docs/wolves-maintenance.md` and `docs/wolves-cinematic.md` first.

## When to Use

Use only for explicitly authorized Wolves overlay, cinematic, control, or YouTube IFrame engineering.

## When NOT to Use

Routine Wolves content uses `wolves-content-maintenance.md`. Unapproved visual work stops.

## Core Process

- A transformed ancestor contains `position: fixed`; wrap true fullscreen overlays in `<Teleport to="body">`.
- Tests for teleported content query `document.body`, not the component wrapper.
- Reuse `src/composables/useYoutubeIframeApi.ts`; reset its module cache in tests.
- happy-dom tests loading a real script URL set `handleDisabledFileLoadingAsSuccess = true`.
- Re-check cancellation or skip state after every `await` before side effects.
- For an intro-to-cinematic handoff, mount the existing `CinematicStage` beneath
  the opaque `WolvesIntroOverlay`, call its dual-buffer `prepare()` method to
  cue the first segment, and keep the overlay opaque until the active player
  reports `PLAYING`. Make the overlay transparent only then.
- Feature-detect `document.startViewTransition`; put the reactive handoff
  update in its callback, and run the same update directly when unsupported.
- Read scrub-derived state immediately; the live player poll loop can overwrite test positions.
- Shared control geometry belongs in the shared control component, not a parent's scoped style.
- Test embeds through `projectbluefin.io.localhost`; compare localhost error 150 with production before declaring a source broken.
- Keep fixed media from collapsing adjacent text columns; inspect computed grid columns and bounds.
- Theater typography is owned by `docs/wolves-maintenance.md`; never shrink type to fit copy.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "`position: fixed` is already fullscreen." | Transformed ancestors create containing blocks; use Teleport. |
| "The DOM node exists, so controls work." | Verify bounds and clicks in Chromium. |

## Red Flags

- A fullscreen overlay without Teleport.
- Wrapper-scoped selectors for teleported DOM.
- Duplicate YouTube API loaders.
- Async side effects after an unchecked `await`.
- Controls present in DOM with zero or clipped bounds.
- Downloaded or re-encoded third-party footage.
- A visual change without desktop and mobile browser evidence.

## Verification

- [ ] Explicit design authorization exists.
- [ ] Desktop and mobile Chromium checks cover bounds, controls, overflow, and scroll behavior.
- [ ] YouTube consumers reuse the shared loader and test reset.
- [ ] Relevant real-player states are verified.
- [ ] `build-verify-deploy.md` and the Wolves references are complete.

## Sources

- `docs/wolves-maintenance.md`
- `docs/wolves-cinematic.md`
- Vue Teleport and scoped CSS: `/websites/vuejs_guide`
- YouTube IFrame API: `/websites/developers_google_youtube`
