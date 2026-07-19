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
    - /vuejs/vue
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
- `controls=0` does not remove all native YouTube visual overlays, and
  `modestbranding`/`showinfo` are deprecated. For a decorative native iframe,
  place an inert app-owned edge mask above the frame to conceal title, action,
  and branding chrome; keep the iframe non-interactive.
- happy-dom tests loading a real script URL set `handleDisabledFileLoadingAsSuccess = true`.
- Re-check cancellation or skip state after every `await` before side effects.
- For an intro-to-cinematic handoff, mount the existing `CinematicStage` beneath
  the opaque `WolvesIntroOverlay`, call its dual-buffer `prepare()` method to
  cue the first segment, and keep the overlay opaque until the active player
  reports `PLAYING`. Make the overlay transparent only then.
- Before an overall seek re-enters the intro from the cinematic, destroy the
  retained stage first so its players and poller stop, then prewarm the same
  stage again under the new intro.
- An intro navigation that interrupts a handoff must increment its cancellation
  token before awaiting, destroy the stage, clear the held/transparent overlay
  flags, then await `nextTick()` while the phase is still cinematic. Enter the
  intro only afterward so Vue remounts a usable overlay before its controls run.
- `destroy()` must reset the dual buffer's active side to `a`; a later intro
  prewarm then starts Part I from its canonical buffer.
- The intro-to-cinematic handoff is a timed dissolve: `handleIntroComplete`
  sets the transparent flag, the overlay's background and chrome fade over
  1.4s (`INTRO_HANDOFF_FADE_MS`, matching the CSS transition in
  `.wolves-intro-overlay--transparent-handoff`), then the overlay unmounts.
  Keep the constant and the CSS duration in sync.
- Read scrub-derived state immediately; the live player poll loop can overwrite test positions.
- Shared control geometry belongs in the shared control component, not a parent's scoped style.
- Test embeds through `projectbluefin.io.localhost`; compare localhost error 150 with production before declaring a source broken.
- Keep fixed media from collapsing adjacent text columns; inspect computed grid columns and bounds.
- Theater typography is owned by `docs/wolves-maintenance.md`; never shrink type to fit copy.
- For a frozen visual recovery, preserve the current player path and its tests; add targeted coverage for the documented element and transplant only the matching template/CSS hunks.
- When a leader cue is also a trustee, exclude leader plates from every trustee color selector so the complete gold leader treatment takes precedence while the trustee label remains intact.
- Pre-decode every Guardian companion image when the intro overlay mounts; a large asset such as Alamo must never perform its first decode in Natali's live cue.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "`position: fixed` is already fullscreen." | Transformed ancestors create containing blocks; use Teleport. |
| "The DOM node exists, so controls work." | Verify bounds and clicks in Chromium. |
| "A historical component and test can be restored together." | Historical snapshots can carry unrelated video regressions; recover only the documented visual contract. |

## Red Flags

- A fullscreen overlay without Teleport.
- Wrapper-scoped selectors for teleported DOM.
- Duplicate YouTube API loaders.
- Async side effects after an unchecked `await`.
- Controls present in DOM with zero or clipped bounds.
- Downloaded or re-encoded third-party footage.
- A visual change without desktop and mobile browser evidence.
- Replacing a current overlay test with a historical test snapshot.

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
