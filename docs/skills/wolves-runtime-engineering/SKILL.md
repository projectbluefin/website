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
  player: its `ENDED` state, its `onError`, and a bounded stall watchdog — never
  by shortening the authored music, and never by running a wall clock alongside
  the audio clock.
- An `ENDED` from the background audio embed is trusted outside the track's
  measured silent tail. A YouTube embed publishes state around ad breaks and a
  mid-roll ad freezes the clock at a *nonzero* time, so believing that signal
  mid-piece trades a hang for a truncation — it ends the scored act in front of
  the room. Scope every end-of-track claim to the same measured window.
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
- A closing animation is computed per clock tick. The transport stops publishing
  time in the final `PRE_END_THRESHOLD_S` of a segment and a YouTube clock
  plateaus before that anyway, so `(time - start) / span` freezes the show
  half-faded with no way to recover live. Latch a CSS transition on one boolean
  crossing and complete it from the store's finished state.
- A takeover is verified by asserting that nothing changed. "The same slide is
  still on stage" passes identically whether the thing that should have covered
  it exists or not. Measure the taker: zero rendered area for what should be
  covered, full-viewport bounds for what should be covering.
- A source video's frames are measured after a fast seek (`ffmpeg -ss` before
  `-i`), which offsets every timestamp by up to a GOP — 0.208s on the Director's
  Cut companion. Decode from frame 0 when the frame number is going to be
  anchored to a beat.
- A second surface reads a companion video's own clock as if it were the show's.
  There is one clock, the soundtrack player's; a companion's time is read only
  to detect drift, corrected only when the drift is material, and rate limited
  on the *magnitude* of the gap so a backward seek is corrected too.
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
- A slide schedule is asked to cut faster without checking the preload budget.
  The decode gate only helps if the lookahead is ahead of it:
  `PRELOAD_WINDOW_SECONDS / MAX_LOOKAHEAD_SLIDES` (8s / 12) is a hard floor of
  ~0.67s on an average hold, so "make the cuts frantic" past that point buys a
  stall, not a faster show. Two measured Track 0 beats (0.74-0.88s) is the
  practical floor.
- A count of slides is handed to `trackZeroBeatCuts` from a pool size rather
  than derived from the section's beat budget. Leftover beats all land on
  **slide 0**, so an undersized pool opens the section on one enormous hold; an
  oversized one (past `floor(totalBeats / shortestTier)`) silently abandons the
  measured grid for a uniform division and every cut in that section stops
  landing on a beat. Derive the count from the budget and clamp it to both
  bounds.
- A second cut of a scored segment invents its own handoff timestamp. The
  Director's Cut stops its picture edit on `DIRECTORS_CUT_FINALE_START`, which
  *is* `TRACK_ZERO_SECTIONS.bkEnd` — an existing measured section boundary the
  standard show already uses — not a round number chosen for how much room it
  leaves.
- A browser probe reads the slide on stage after a fixed wait, or as "the first
  layer above half opacity". The swap is gated on fetch, decode and then the
  crossfade, and mid-dissolve both buffers are above half — so the probe samples
  the previous frame or the outgoing buffer and reports a scheduling bug that
  does not exist. Poll until the stage settles and take the highest-opacity
  layer. Related: a `type: 'daynight'` slide renders `dayName`/`nightName`,
  never `path`.

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
