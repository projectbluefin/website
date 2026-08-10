---
name: wolves-runtime-engineering
description: Use only for explicitly approved Wolves overlay, transport, player, or runtime engineering.
metadata:
  verified-sources:
    - https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap (text-wrap balance six-line cap)
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

## Red Flags

- Content work is used to justify component or style changes.
- A fullscreen overlay lacks the required containing-block treatment.
- A second YouTube API loader or transport is introduced.
- Browser bounds and player states are not checked.
- A musical moment is scheduled with a round number instead of the measured
  beat in `TRACK_ZERO_SECTIONS`.
- A cue window on a scored segment is picked by dividing the track evenly, or by
  ear, instead of from measured section boundaries. Measure the source: the
  Director's Cut Gayane grid in `wolves-directors-cut-intro.ts` is the agreement
  between a voted Laplacian structural segmentation (k = 4..10) and an
  independent MFCC-novelty peak pick.
- A scored `text` segment ends only on `elapsed >= duration`. A real player's
  `getCurrentTime()` routinely plateaus below the duration it reports for the
  same upload, so a card authored to its source's full container hangs on its
  last cue with no way to recover live. Take the completion signal from the
  player: its `ENDED` state, its `onError`, and a bounded stall watchdog scoped
  to the track's measured silent tail — never by shortening the authored music,
  and never by running a wall clock alongside the audio clock.
- A background audio embed is constructed with `events: {}`. That embed is the
  scored card's clock; with no `onStateChange`/`onError` the card has no way to
  learn the clock died.
- An authored window on one video source is transposed to a second upload of the
  same footage without re-measuring that upload's own frames. A content offset
  transposes; a cutoff does not, because two uploads can end differently. See
  `../../reference/wolves-intro-and-overlay.md`.
- A long text beat is given `emphasis: 'dominant'` on the strength of what it
  says rather than how tall it renders. Dominant is priced in frame height, and
  overflows a 1280x720 projector frame past `DOMINANT_EMPHASIS_MAX_WORDS`.
- A browser harness samples an intro cue without waiting out the 3.9s scene
  dissolve and 7.8s somber fade, which both restart on a clock jump, and then
  reports the previous cue's element as the current one.
- A page ends on a title such as `Dr.`, orphaning the name it introduces, or on
  a preposition or article, making the audience wait a page turn for the rest of
  the phrase.
- A slot is assumed to display its record's authored pages without checking
  `affordablePageCount()` against the slot duration.
- A prewarmed buffer is played and never parked, or is promoted without an
  explicit seek to its opening frame.
- A buffer is promoted to air on `sides[side].segmentIndex` alone, without
  checking `getVideoData().video_id` against the segment it is supposed to be.
- An `onError` is handled only for the active side, so a failure on the buffer
  holding the *next* segment is discarded.
- A prewarm is silenced with `setVolume(0)` instead of `mute()`, or a path that
  puts a side on air forgets to lift the mute.
- A boundary, skip, or recovery load can run before `start()`, so it plays a
  segment underneath the intro.
- Only the inactive buffer is prewarmed, so the first track enters cold.
- A crossfade length is read from the outgoing segment.
- A startup or readiness await has no timeout.
- A bounded await sits *inside* an unbounded one, so the bound is decorative.
- A prewarm, cache warm, or other optimisation is awaited on the critical path
  to first audio.
- A cold skip switches sides and ramps before the incoming player reports
  `PLAYING`.
- The transport clock stops publishing while a crossfade runs.
- A clock advances by a hardcoded constant per tick, or by accumulating deltas.
- A crossfade is triggered by a lead shorter than the fade it starts.
- A test double for a player exposes `getCurrentTime()` that never advances, or a
  `pauseVideo()`/`playVideo()` that does not emit the state change the real
  IFrame API emits.
- Buffer bookkeeping (a prewarm park's pause and seek) is published to the store
  as show transport state.
- Playlist metadata is indexed by `segmentIndex`/`trackIndex` instead of
  resolved by `id`/`youtubeVideoId`. (`trackIndex` still drives ordering and
  branching; the ban is on metadata lookup by position.)
- Back-catalogue title credit is baked into generated `segment.title` data
  instead of formatting the normalized `title` and `artist` fields at the
  display boundary. The media widget and stage nameplate share
  `TrackCredit.vue`; transition cards keep their separate artist line.
- A hand-maintained array that parallels `CINEMATIC_SEGMENTS` (durations, BPM,
  chat keys) is not asserted against it by id.
- An authored sequence has a gap (`TRANSITION_FIVE` with no `TRANSITION_FOUR`,
  chapter labels stopping short of the part count) and it is read as style
  rather than as evidence of a deletion.
- A change removes authored content — a segment, lore, prose — without the
  owner's explicit word, or its justification does not match its diff.
- A raw `experienceId === WOLVES_EXPERIENCE.id` (or `manifest.id === ...`) check
  is used to mean "this is an authored Wolves presentation." A second Wolves
  manifest with a different top-level `id` (the Director's Cut) silently reads
  as a generic back-catalogue album, and every place that check is duplicated
  can drift independently (`TheaterExperience.vue` once carried its own inline
  copy of the same check on a single prop, computing a different answer than
  the component's own `isWolvesExperience`). Use the manifest's typed
  `presentationProfile` and the store's `isWolvesPresentation` getter (or the
  `isWolvesPresentationProfile()` helper) instead of comparing manifest
  identity; a "which specific presentation" question (restoring the standard
  show after a Director's Cut run) still compares against
  `WOLVES_STANDARD_PROFILE_ID`/`WOLVES_DIRECTORS_CUT_PROFILE_ID` explicitly.
- A computed derives a fraction of show progress from a hardcoded segment count
  (`TheaterExperience.vue`'s `totalProgress` divides by `7`, sized for the
  standard show's day/night wallpaper cycle). A single-segment presentation
  (the Director's Cut) can never advance `segmentIndex` past `0`, so that
  computed can only ever reach `~1/7` of its cycle. This shipped with the
  presentation-profile boundary as a known, reported gap, not a fix — retiming
  the wallpaper cycle for a variable segment count is a design/animation-cadence
  change and needs its own approval.
- Segments are module-level state too (`activeSegments` in `cinematic.ts`), the
  same class of bug as the intro list documented in
  [`../../reference/wolves-intro-and-overlay.md`](../../reference/wolves-intro-and-overlay.md).
  A test that calls `loadExperience()` with a non-default manifest (Director's
  Cut, a generic album) and does not restore `WOLVES_EXPERIENCE` in `afterEach`
  leaks that manifest's segments into every later test in the file —
  `setActivePinia(createPinia())` alone does not reset it.

## Verification

- [ ] Explicit approval exists.
- [ ] Relevant unit tests, typecheck, and build pass.
- [ ] Chromium checks cover bounds and controls.
- [ ] Production deployment follows the validation skill.

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
- [`../../reference/wolves-test-harnesses.md`](../../reference/wolves-test-harnesses.md) —
  driving Track 0 in a browser, keeping the movie-flow harness alive, player
  mock load lifecycle, and deriving expectations from live modules.
- [`../design-gate/SKILL.md`](../design-gate/SKILL.md),
  [`../wolves-content/SKILL.md`](../wolves-content/SKILL.md).
