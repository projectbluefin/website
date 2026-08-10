---
name: wolves-runtime-engineering
description: Use only for explicitly approved Wolves overlay, transport, player, or runtime engineering.
metadata:
  verified-sources:
    - https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap (text-wrap balance six-line cap)
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
  overflows a 1280x720 projector frame past `DIRECTORS_CUT_MAX_CUE_WORDS`.
- A cue's window is treated as its text's dwell time. The window is how long the
  *shot* runs; a thought priced at 6.8s reading cost left up on a 38s shot reads
  as a frozen show. Price text separately (`textHoldSeconds`) and let the image
  play on wordless once the words are read.
- A painting is rendered with `object-fit: cover` because it fills the frame.
  Cover crops: `c1-europa-landscape-v1` (2048x771) loses a third of its height on
  a 16:9 stage. Frame paintings `contain`, capped at their source pixels, and buy
  text legibility with a scrim rather than by dimming the art.
- A browser probe asks `getBoundingClientRect()` whether a `contain` image is
  cropped. It reports the element box, so letterboxed and cropped both answer
  1280x720. Derive the painted box from the decoded `naturalWidth`/`naturalHeight`
  and assert the artwork ledger matches that decode.
- A responsive rule hides text globally when only some surfaces should lose it.
  The blanket `@media (max-width: 640px) { .wolves-intro-overlay-text { display: none } }`
  silently blanked the entire Director narration; scope such rules with `:not()`
  and give the surviving surface its own type scale.
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
  by elapsed show time. A backward transport seek moves the clock behind the
  last correction and must be treated as a new alignment opportunity, not
  rejected because its absolute time is inside the suppression interval.
- A companion readiness check ends when the constructor resolves. Construction
  can finish after the measured reveal window has already lost the source cut
  that makes the edit meaningful. Bound readiness to a source-derived clock
  deadline; if it expires, dispose the player, clear the memoised build result,
  and refuse a late pop-in. A backward seek inside the same window must reset
  that verdict and rebuild cleanly, but must align once to the new soundtrack
  time rather than adding a second park seek during the reset.
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
- A finale companion is assumed correct because its constructor was given the
  approved id. Read `getVideoData().video_id` after cueing and again when
  `PLAYING` is reported; a wrong upload must never be synchronized or shown.
  A DEV-only evidence hook should expose the live player id, source time,
  readiness, synchronization, mute and volume state so a browser harness reads
  the runtime rather than mock-player bookkeeping.
- An `onError` is handled only for the active side, so a failure on the buffer
  holding the *next* segment is discarded.
- A prewarm is silenced with `setVolume(0)` instead of `mute()`, or a path that
  puts a side on air forgets to lift the mute.
- YouTube's own captions are suppressed with `cc_load_policy: 0` alone. That is a
  default a viewer preference overrides; the module has to be unloaded, on
  `onApiChange` as well as `onReady`. See
  `../../reference/wolves-intro-and-overlay.md`.
- A background layer's progress is derived from a hardcoded segment count, or
  animated with a curve that returns to where it started. See
  `../../reference/wolves-slide-scheduling.md` on the wallpaper ramp.
- A warmed player is promoted with `loadVideoById()` or a second `seekTo()`. The
  warm buffer is already cued to its opening frame; reloading it discards the
  warm and reintroduces the stutter the prewarm existed to remove. Promote by
  adopting the instance, lifting the mute, and playing.
- A prewarmed player is built with different event handlers than the cold path.
  YouTube fixes handlers at construction, so a parked player cannot be rewired
  later. Share one constructor and have every handler guard on "am I the show
  player?" so a parked player's CUED/ENDED/error traffic cannot drive the
  sequence.
- A parked player is hidden with `display: none` or `v-show`. That can prevent
  composition and un-warm the warm. Use `opacity: 0` plus `aria-hidden`/`inert`.
- A takeover is considered complete because an opaque frame covers the old
  slide. Unmount the ordinary grid and sidecar with the finale; assert zero
  rendered slide layers, not merely that the old image is hard to see. The
  inverse probe must seek back and prove the ordinary chrome returns.
- A handoff holds the outgoing image on an unbounded await of the incoming
  player's `PLAYING`. If that event never arrives the show is stuck on a still
  frame with no recovery. Bound the hold and release on whichever lands first.
- A boundary, skip, or recovery load can run before `start()`, so it plays a
  segment underneath the intro.
- Only the inactive buffer is prewarmed, so the first track enters cold.
- A crossfade length is read from the outgoing segment.
- A startup or readiness await has no timeout.
- A bounded await sits *inside* an unbounded one, so the bound is decorative.
- A prewarm, cache warm, or other optimisation is awaited on the critical path
  to first audio.
- A paging slot and its display-clear beat are conflated. Preserve the
  `(duration, elapsed)` window across a mid-run handoff so the bulletin does
  not re-page, then clear it on its own measured beat before the next clause;
  shortening the slot drops authored pages instead of making them read faster.
- A clause is kept mounted after terminal black because it is "under" the
  fade. Remove terminal content from the DOM when the finished-state backstop
  reaches black; otherwise a later seek or accessibility tree can expose stale
  closing prose.
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
- The `PresentationProfile` type lives in `experience-manifest.ts`; the
  `WOLVES_STANDARD_PROFILE_ID`/`WOLVES_DIRECTORS_CUT_PROFILE_ID` constants and
  the `isWolvesPresentationProfile()` helper live in `cinematic.ts` alongside
  the store that consumes them. No `wolves-presentation-profiles.ts` (or
  similarly named standalone module) exists, and none should be created just
  to match an earlier planning document's file-structure sketch — an external
  plan naming a path is not itself a benefit. Only move these definitions if a
  concrete benefit is identified first (e.g. an import cycle these are
  currently trapped in); otherwise leave them where their nearest consumer
  already imports them from.
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
- A slide schedule is asked to cut faster without checking both the preload
  budget and the projection floor. The decode gate only helps if the lookahead
  is ahead of it: `PRELOAD_WINDOW_SECONDS / MAX_LOOKAHEAD_SLIDES` (8s / 12) is
  ~0.67s on an average hold, while the Director's four-beat Track 0 floor is
  about 1.58s at the fastest passage. Two measured beats produced a random
  slideshow and did not leave enough time for a decoded image to settle and
  register. Keep the preload constants and the schedule's derived floor in one
  test seam.
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
- A profile-specific narrative timeline is tested only as data, while the live
  theater seam still reads the standard timeline or falls back to the last
  record. Mount `TheaterExperience` with a lore probe and walk a quote entrance,
  an intentional image-only gap, the finale-owned bulletin, and its clearing
  boundary. A `null` slot is an authored empty stage, not a request to retain
  the previous artifact; pass an empty id through the component so the renderer
  removes the stale panel.
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
  crossfade rapidly there; the Director's Cut runs a lock-free montage at the
  same index and puts blur work back on the slide-change path. Gate treatments
  on what the segment actually does — the profile — not on where it sits.
- A trust boundary that validates only *structure* lets a generated file carry
  *authority*. `parseBackCatalogue()` checks ids, titles and segments, but
  `presentationProfile` selects the authored Wolves intro, timeline, slide
  schedule and finale — the generator never writes it, so anything but
  absent/`'generic'` is refused at the boundary rather than trusted.

## Director's Cut entry points, the production wall, and autoplay resilience

The Director's Cut has two entrances, and they are gated together by
`DIRECTORS_CUT_ENABLED` in `src/config/wolves-directors-cut-gate.ts`:

1. **Lobby click** — `CinematicLobby` emits `enter-directors-cut`, which calls
   `enterIntro(null, true)`. The click satisfies browser autoplay policy.
2. **Deep link** — `/wolves/?directors-cut` auto-starts the cut on mount. This is
   intended for projection / recording workflows, but it may lack a user gesture,
   so the browser may block autoplay.

Gate both or neither. Hiding the button while the parameter still works is not a
wall: the link outlives the button in URLs, chat logs, and recording scripts.
`src/tests/wolvesDirectorsCutGate.test.ts` mocks the gate off and asserts both
entrances are shut, so the pair cannot drift apart.

The gate is `import.meta.env.DEV`, which Vite statically replaces at build time.
Verify it by inspecting the built bundle, not just the test: the deep-link branch
should be gone entirely (`URLSearchParams` drops to its one unrelated use) and the
lobby block should compile behind a literal-false condition. Dead-branch *strings*
surviving minification is expected and harmless — grep for the compiled condition,
not for the copy.

If the scored prologue's background-audio embed or the Destiny trailer video is
blocked, `currentTime` stops advancing and the show hangs. The intro overlay
handles this with two bounded fallbacks, deliberately given different thresholds
because their costs are not symmetric:

- **Text/audio segments** — `BLOCKED_AUDIO_SECONDS` (5s). A clock pinned at
  exactly `0` this long calls `releaseAudioClock()`, handing the card to its own
  wall clock. Short, because the decision is *reversible*: the existing recovery
  check snaps back to the music the instant the player's clock moves. This is not
  a second transport — it reuses the release mechanism the end-of-track backstop
  already owns, so there is still exactly one thing deciding a card is over.
- **Video segments** — `BLOCKED_VIDEO_SECONDS` (15s). Three times as long,
  because advancing *discards a segment* and cannot be taken back. It must outlast
  a cold buffer on a bad conference network, not merely a hesitation.

An ad does not look like either case: during a pre-roll the embed reports the ad's
own advancing time, so it never sits frozen on exactly `0`. A freeze *inside* the
piece is an ad and must be waited out — that is what the separate
`TEXT_SEGMENT_STALL_GRACE_SECONDS` backstop is for, and it only fires inside the
track's measured end window.

These fallbacks are last-resort unattended behavior. For normal projection, prefer
a real user gesture so the authored music and trailer play as intended.

### Testing a blocked-clock fallback

Give the card a duration comfortably longer than
`TEXT_SEGMENT_END_SLACK_SECONDS`. On a 1-second card the *whole card* is inside
the track-end window, so the stall backstop completes it at its 3s grace and the
blocked-autoplay path never runs — the test passes green while asserting nothing
about the thing it names.

## Before rebuilding a Wolves surface, look for it on another branch

This runtime is developed across several long-lived worktrees
(`git worktree list`). A surface can be fully built, measured, and tested on one
of them while `main` still shows the old version, and nothing in `main` hints
that the work exists.

That has already cost a full rebuild. The Director's Cut prologue was recut
against measured sources on `wolves/directors-cut` — full-length scored track, a
derived cue grid, a varied concept-art montage — and a later session, seeing only
`main`, rebuilt it from scratch as a short excerpt with one background image
repeated four times and hand-picked text windows. The reimplementation reproduced
the exact defects the branch had already fixed, and the two then conflicted in
five files because both had rewritten the same modules.

Before rebuilding any Wolves surface, run `git worktree list` and
`git log --oneline main..<branch>` on anything Wolves-related. If the surface
already exists elsewhere, integrate that work rather than re-authoring it: the
branch version carries measurement evidence that a fresh implementation cannot
reconstruct from the rendered result.

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
