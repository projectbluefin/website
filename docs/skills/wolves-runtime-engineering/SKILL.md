---
name: wolves-runtime-engineering
description: Use only for explicitly approved Wolves overlay, transport, player, or runtime engineering.
metadata:
  verified-sources:
    - https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap (text-wrap balance six-line cap)
  context7-sources:
    - /websites/developers_google_youtube
  context7-sources:
    - /websites/developers_google_youtube
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
- Releasing a scored card to its own clock (`releaseAudioClock()`) clears
  everything about the *stall watchdog* but leaves the `ended` flag that
  triggered the release still set. That flag is stale the instant the release
  happens — it was only ever true for a reading outside the end window — but it
  is still read by the next completion check. If the audio clock never
  recovers, the card's own free-running clock eventually re-enters the end
  window on its own, and the stale `true` completes the card there instead of
  at the authored duration: up to `TEXT_SEGMENT_END_SLACK_SECONDS` (1s) early.
  Bounded by the same measurement that makes the window safe to complete in at
  all (entirely after the source's last audible sample), so it never truncates
  audible content — but it is still wrong, and cheap to fix: clear the `ended`
  flag in the same place that clears everything else about the release.
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
- A Director prologue cue uses the shared 7.8s somber fade. That consumes most
  of a short musical window and makes a seek look blank; the Director's Cut has
  its own short reveal followed by a real reading hold.
- A browser seek probe declares success because the outgoing image stayed
  stable twice. Wait for the transport to publish the target time **and** for
  the intended image to decode and take the active layer.
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
- A drift or retry rate limiter has no test that drives *repeated* out-of-
  tolerance polls inside one suppression interval. Assert one corrective seek
  across the burst and another after the interval, or deleting the guard —
  which turns the corner into a stutter loop in front of the room — stays green.
- An optional embed's availability is a plain `let`, not reactive state ANDed
  into its visibility. A dead player still paints its lit frame — black fill,
  ring, shadow — for the whole reveal window, which from the back row is a
  broken slide. Mark unavailable on every failure path: loader rejection,
  missing constructor or host, and `onError`.
- `destroy()` is reachable twice for the same player, typically the handle the
  component holds and the memoised build result it came from. `YT.Player`
  teardown is not idempotent; guard disposal by instance identity and count
  destroys *per instance* in tests, because aggregate counts cannot tell two
  players destroyed once from one player destroyed twice.
- A player whose `onError` fires from inside `new YT.Player(...)` is discarded
  without teardown. The instance is already a live iframe, a window message
  listener and a media element, and the handler runs before the expression
  returns — so the constructor's own return has to finish the disposal.
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
- A component correctly branches **one** of its `presentationProfile`-dependent
  computeds and ships that as proof the component is profile-aware.
  `TheaterExperience.vue`'s `displayedNarrativeSlot` called
  `getNarrativeSlotForTime()` — the standard show's own narrative timeline —
  unconditionally, with no profile branch, in the same file whose
  `WolvesComicReader` slide-schedule prop *did* correctly switch on
  `presentationProfile` (Task 7). The Director's Cut's nine registered
  science-quote panel and closing bulletin
  (`getDirectorsCutNarrativeSlotForTime()`, `wolves-directors-cut-timeline.ts`)
  were fully built, scheduled, and covered by data-layer tests, but a live
  Director's Cut run never reached them — it silently rendered whatever the
  standard show's Jono/Marina/Hikari/Bluefin timeline resolves to at the same
  clock reading instead, because nothing that mounts `WolvesLoreColumn` inside
  `TheaterExperience.vue` had ever been given a real `artifact-id` probe for
  the Director's Cut profile. Every existing test either stubbed
  `WolvesLoreColumn` entirely (`wolvesHeroTypography.test.ts`'s Director's Cut
  probe tests, added for the *comic-reader* wiring) or tested the timeline data
  module in isolation (`wolvesNarrativeTimeline.test.ts`) — none mounted the
  component and read what it actually passed down. A component with more than
  one profile-dependent prop needs a probe test *per prop*, not one test that
  happens to cover the prop most recently worked on.
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
- A set of large assets is predecoded by firing every `new Image()` at once
  "because there is idle time". There is no idle network in this show: the
  Track 0 slide preloader and the scored audio embed are on the same connection
  pool. Warming the ten Director's Cut concept paintings ten-wide starved the
  gallery hard enough that `tests/wolves-directors-cut-slides.mjs` found the
  previous slide still on stage at the measured 35.666s cut — the harness saw
  it, no unit test could. Chain the warms on `decode()` so exactly one is in
  flight, warm in the order the assets are displayed so the chain stays ahead of
  the cue that needs each one, and abandon the chain in `onBeforeUnmount` so a
  skipped intro stops taking bandwidth from the show that replaced it.
- A predecode is keyed to a *kind* of segment ("any text card") rather than to
  the authored segment id that owns the assets. The standard intro then pays for
  assets it never shows. Assert the negative: mount the other sequence and
  require zero requests for those URLs.
- A surface with a sub-second hidden lead is hidden with `v-show`. `display:
  none` licenses a browser to skip layout, paint and compositing for the whole
  subtree, so the element can be asked for its first composite on the exact
  frame it was supposed to be already playing — the Director's Cut companion's
  lead is one measured beat, 0.395s. Keep it rendered and make it invisible
  (`opacity: 0`, `pointer-events: none`, `aria-hidden`, `inert`, and
  `will-change: opacity` to force the layer up front); reserve removal from the
  DOM for the surface being genuinely unavailable. Note that `visibility:
  hidden` is not a substitute — it suppresses paint for the subtree too.
- A browser harness computes `visible` from `display`/`visibility` and bounds
  only. Once anything is deliberately rendered-but-transparent, that helper
  scores a warming surface as on stage. Read `opacity` too, and expose
  `rendered` as its own field so "hidden" and "not there" stay separable.
- A per-segment treatment is gated on position (`trackIndex !== 0`) when a
  second presentation runs a different schedule at the same position. The
  backdrop blur was excluded from Track 0 because the *standard* cut does not
  crossfade rapidly there; the Director's Cut runs 190 lock-free cuts at the
  same index and put blur work back on the slide-change path. Gate treatments
  on what the segment actually does — the profile — not on where it sits.
- A trust boundary that validates only *structure* lets a generated file carry
  *authority*. `parseBackCatalogue()` checks ids, titles and segments, but
  `presentationProfile` selects the authored Wolves intro, timeline, slide
  schedule and finale — the generator never writes it, so anything but
  absent/`'generic'` is refused at the boundary rather than trusted.

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
