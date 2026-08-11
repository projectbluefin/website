---
name: wolves-runtime-engineering
description: Use only for explicitly approved Wolves overlay, transport, player, or runtime engineering.
metadata:
  verified-sources:
    - https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap (text-wrap balance six-line cap)
  context7-sources:
    - /websites/developers_google_youtube
    - /microsoft/playwright (waitForFunction resolves to a JSHandle of the truthy value; read with jsonValue)
---

# Wolves runtime engineering

## Overview

Gate engineering work on the frozen Wolves runtime.

## When to Use

Use only when the user explicitly authorizes overlay, transport, fullscreen, or
YouTube IFrame engineering.

## When NOT to Use

Do not use for routine content or unapproved visual work.

## Core Process

1. Confirm explicit approval.
2. Read `../../reference/wolves-runtime.md` and
   `../../architecture/runtime-data-flow.md`.
3. Preserve store ownership and player-clock synchronization.
4. Reuse the existing YouTube API loader; check async cancellation and
   fullscreen containing blocks.
5. Read the reference under **References** that owns the subsystem you are
   changing before you change it. Each carries the defects already shipped in
   that area.
6. Verify in Chromium and with relevant tests.

Do not introduce a second transport or wall-clock synchronization. Every YouTube
IFrame player must receive both `origin` and `widget_referrer` from the current
window: `origin` identifies the IFrame API caller, `widget_referrer` identifies
the embedding page and prevents an otherwise playable track from being treated as
an unidentified player request.

## Common Rationalizations

- "The player reported the right time in a mock." Real IFrame readiness,
  buffering, end-state, and error ordering still need a codec-capable browser
  release check.
- "A hidden iframe is prewarmed." `display: none` can prevent composition; keep
  a pre-armed visual player rendered but invisible until its authored reveal.
- "The clock is on the reveal beat, so the iframe is ready." A fast-forward can
  skip the whole pre-arm window. Keep the visual player hidden until the cold
  build has completed, the runtime has issued its source-alignment seek, and
  the player reports `PLAYING`.
  The IFrame API documents that `cueVideoById()` does not request the video
  until `playVideo()` or `seekTo()` is called, so a cued player is not proof
  that the reveal frame has loaded.
- "The final clock will finish the fade." The last-segment transport can stop
  before another useful tick; terminal transitions need an explicit finished
  state backstop.
- "The standard profile test covers the Director's Cut." Profile-specific data
  must be wired through the live component path and exercised in Chromium.
- "The unit suite is green, so the screen is right." A cascade rule that lost
  on source order, a caption bound to the wrong reactive source, and a rule
  stranded inside a `@media (max-width: 640px)` block all shipped under a
  fully green suite; layout, cascade, and paint claims need a browser
  assertion.

## Red Flags

The full catalogue is [`references/red-flags.md`](references/red-flags.md) —
scan the group matching the surface you are changing. The ones that have cost
this show the most:

- Content work is used to justify component or style changes.
- A musical moment is scheduled with a round number instead of the measured
  beat in `TRACK_ZERO_SECTIONS`.
- A cue window on a scored segment is picked by dividing the track evenly or by
  ear, instead of from measured section boundaries.
- A cue's window is treated as its text's dwell time. The window is how long the
  *shot* runs; `textHoldSeconds` is how long the *words* stay up.
- A long text beat is given `emphasis: 'dominant'` on the strength of what it
  says rather than what it costs to read.
- A second YouTube API loader or transport is introduced.
- A takeover is verified by asserting that nothing changed.
- A startup or readiness await has no timeout, or a bounded await sits inside an
  unbounded one.
- A browser probe declares success because the outgoing image stayed stable.
- A browser probe of a cross-fading surface settles on one condition. Settle on
  two — the intended cue's caption **and** the intended record's decoded image —
  or the same probe can invent a collision and hide a real one in one run.
- A new control is wired as a dependency instead of an affordance: the default
  is "the first entry in the list" rather than a separate exported constant,
  with no fallback for an unknown value and no test that an untouched run
  completes.

## Detail

Load only the reference the change needs.

| Reference | Covers |
|---|---|
| [`references/red-flags.md`](references/red-flags.md) | The full defect catalogue: scheduling, transport and buffers, images and framing, store and data integrity. |
| [`references/directors-cut-and-branches.md`](references/directors-cut-and-branches.md) | Director's Cut entry points, the production wall, autoplay resilience, and finding a surface on another branch before rebuilding it. |
| [`references/staging-and-composition.md`](references/staging-and-composition.md) | Why a passing geometry harness is not a picture of the stage, the finale's frame, projected narration set in lines, spending an image once. |

## Verification

- [ ] Explicit approval exists.
- [ ] Relevant unit tests, typecheck, and build pass.
- [ ] Chromium checks cover bounds and controls.
- [ ] Production deployment follows the validation skill.

For the Director's Cut finale, the focused loop is:

```bash
npx vitest run src/tests/wolvesDirectorsCutFinale.test.ts \
  src/tests/wolvesDirectorsCutFinaleStage.test.ts \
  src/tests/wolvesFinaleReveal.test.ts
WOLVES_BASE_URL=http://127.0.0.1:5173 node tests/wolves-directors-cut-finale.mjs
WOLVES_BASE_URL=http://127.0.0.1:5173 WOLVES_VIEWPORT=390x844 \
  node tests/wolves-directors-cut-finale.mjs
```

The harness must identify whether it ran with the deterministic mock or the
live IFrame API. `WOLVES_REAL_MEDIA=1` is evidence about YouTube only when the
browser can decode the soundtrack and companion; a `SKIPPED (no real media
support)` result is an environment limitation, not a green real-media claim.

## References

Procedure lives here; the defect-derived detail lives in these references. Each
one links back to this skill.

- [`../../reference/wolves-runtime.md`](../../reference/wolves-runtime.md) —
  show-wide production facts, boundary, and content surfaces.
- [`../../architecture/runtime-data-flow.md`](../../architecture/runtime-data-flow.md) —
  store ownership and clock flow.
- [`../../reference/wolves-transport-and-clocks.md`](../../reference/wolves-transport-and-clocks.md) —
  dual-buffer parking and promotion, crossfade lead and curve, elapsed-time
  derivation, bounded awaits, intro audio handoff, why a playlist track is
  resolved by identity rather than by index, and the deleted-segment incident
  that proves it.
- [`../../reference/wolves-intro-and-overlay.md`](../../reference/wolves-intro-and-overlay.md) —
  intro sequence lists and everything that counts them, derived silent-card
  windows, presenter pacing, and the overlay's one-text-treatment rule.
- [`../../reference/wolves-lore-timing.md`](../../reference/wolves-lore-timing.md) —
  lore page model and type scale, timeline oversubscription math, timing
  lessons, re-deriving Track 0 timing, and anchoring text to measured beats.
- [`../../reference/wolves-slide-scheduling.md`](../../reference/wolves-slide-scheduling.md) —
  measured beat grids, locked slide windows, preload budgeting, buffer
  continuity at segment boundaries, and the non-Wolves shows the comic reader
  serves.
- [`../../reference/wolves-directors-cut-finale.md`](../../reference/wolves-directors-cut-finale.md) —
  the Director's Cut finale's named anchors, the frame-measured companion video
  window, why the terminal fade is a latched CSS transition rather than a
  per-tick opacity, and the three surfaces that consume the store's finale
  state.
- [`../../reference/wolves-test-harnesses.md`](../../reference/wolves-test-harnesses.md) —
  driving Track 0 in a browser, keeping the movie-flow harness alive, player
  mock load lifecycle, and deriving expectations from live modules.
- [`../design-gate/SKILL.md`](../design-gate/SKILL.md),
  [`../wolves-content/SKILL.md`](../wolves-content/SKILL.md).
