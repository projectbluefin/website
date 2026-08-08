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
YouTube IFrame engineering. Do not use for routine content or unapproved visual
work.

## Core Process

1. Confirm explicit approval.
2. Read `../../reference/wolves-runtime.md` and
   `../../architecture/runtime-data-flow.md`.
3. Preserve store ownership and player-clock synchronization.
4. Reuse the existing YouTube API loader; check async cancellation and
   fullscreen containing blocks.
5. Verify in Chromium and with relevant tests.

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
- A page ends on a title such as `Dr.`, orphaning the name it introduces, or on
  a preposition or article, making the audience wait a page turn for the rest of
  the phrase.
- A slot is assumed to display its record's authored pages without checking
  `affordablePageCount()` against the slot duration.
- A prewarmed buffer is played and never parked, or is promoted without an
  explicit seek to its opening frame.
- A clock advances by a hardcoded constant per tick, or by accumulating deltas.
- A crossfade is triggered by a lead shorter than the fade it starts.
- A test double for a player exposes `getCurrentTime()` that never advances.

## Transports and clocks

Three invariants, each learned from a defect that reached the theater build.

**A prewarmed buffer must be parked, and promoted by seek.** `cueNext()` starts
the inactive buffer to force YouTube to buffer, but an unparked buffer keeps
playing silently underneath the current segment for its entire duration. When
the next segment is longer than the current one it is already minutes in by the
time it is heard, and the audience loses the opening of the song. Park on the
`PLAYING` state change (pause, seek to opening frame, volume 0) *before* any
`side !== activeSide` early return, and have promotion seek to the opening frame
rather than trusting where the buffer happens to sit. The seek is the guarantee;
parking is the optimisation. This also drove a phantom "progress bar snapping"
report — one root cause, two symptoms, because the elapsed time published on the
first poll after the swap was whatever the runaway buffer had reached.

**Lead a crossfade by the whole fade, not by a threshold.** If the swap fires
`PRE_END_THRESHOLD_S` before the end but the ramp runs `crossfadeMs`, the
outgoing track reaches its real end while the incoming is barely up, and the
room gets a hole in the music. Lead by `PRE_END_THRESHOLD_S + crossfadeMs/1000`.
Do not pause the outgoing side early — let it play out under the fade, or the
last bars of the song are lost. Ramp on an equal-power sin/cos curve: two linear
ramps sum to a dip in perceived loudness at the midpoint.

**Derive elapsed from an origin; never accumulate.** A silent card with no
player to read still needs a clock. `currentTime += 0.2` on a 100ms interval ran
every silent card at double speed. Accumulating a measured delta fixes the speed
but still drifts, and lands on float error exactly at the boundary (ten `+= 0.1`
sum to 0.9999999999999999, so a card never reaches its own duration). Keep an
origin timestamp and compute `(performance.now() - origin) / 1000`. Pause by
trailing the origin; seek by rebasing it. This is the same principle as "every
lore view is a pure function of `elapsed`", applied to the one surface that has
to source the elapsed value.

**A player test double must have a running clock.** These defects were invisible
for the same reason: `FakePlayer.currentTime` only moved on `loadVideoById`, so
a runaway buffer's clock was frozen at 0 forever and every timing assertion was
vacuously true. Model the transport honestly — `tickClock()` advancing time and
firing `ENDED` at the boundary, `seekTo()`, and `playVideo()` restarting a
finished video from 0 the way YouTube does — and drive timers and player clocks
together from one helper. Fixing the double is what makes the runtime fixes
provable; do it first. See `src/tests/wolvesDualBufferPlayer.test.ts`.

The same blind spot existed in the browser mock, so there is now a runtime
harness that runs the clock against the real route, started against a dev server
on 127.0.0.1:5173: `node tests/wolves-buffer-parking.mjs`. It fails on a build
with an unparked prewarm buffer (both buffers `PLAYING`, both clocks in lockstep)
and passes when one is parked at `currentTime` 0 with volume 0. Two things to
know before writing another harness like it: `window.__wolvesDurations.skipIntro()`
is async, so returning its promise from `page.evaluate()` hangs the run, and
`window.__wolvesCinematic` never appears under a mocked player, so assert against
`window.__mockWolvesPlayers` instead of waiting for that hook.

## Verification

- [ ] Explicit approval exists.
- [ ] Relevant unit tests, typecheck, and build pass.
- [ ] Chromium checks cover bounds and controls.
- [ ] Production deployment follows the validation skill.

## References

`../../reference/wolves-runtime.md`, `../../architecture/runtime-data-flow.md`,
`../design-gate/SKILL.md`.

## Lore display model

The Wolves lore column is a theater text display, not a document. One panel,
one metadata block, one page model, one type scale, no scrolling.

- `src/components/wolves/lore/lore-pages.ts` is the single page model. Both the
  scheduler (`src/data/wolves-lore-timing.ts`) and every lore view cost content
  with it. One model is not enough on its own: both sides must also feed it the
  same *authored* string. Never add a second splitter, a per-view character
  constant, or paginate rendered HTML.
- `src/components/wolves/lore/lore-dossier.scss` owns the only panel and the
  only type scale. Sizes are container-relative (`cqi` against
  `.lore-dossier-panel`, which sets `container-type: inline-size`) so type and
  spacing track the panel the theater layout hands the column, not the viewport.
  No view may hardcode a body `font-size`; consume `--lore-body-size`,
  `--lore-title-size`, `--lore-meta-size`, `--lore-gap`. The site sets
  `html { font-size: 63.5% }`, so `1rem` is about `10.16px`: a rem value copied
  from a normal 16px-root design reads roughly 1.6x too small here — a
  `clamp(1.15rem, …)` body size renders at about `12px`, far too small for
  theater seats. Size lore type by measuring `getComputedStyle(el).fontSize` in
  Chromium, not by reading the clamp.
- Every view renders `LoreRecordHeader.vue`: fixed uppercase kind eyebrow,
  record title, and one inline spec row of at most three key/value pairs. No
  footers, no telemetry (status, phase, resource name, fingerprint) - that is
  noise on a theater screen.
- Page budgets must include per-block chrome. `BLOCK_OVERHEAD_CHARACTERS`
  charges each block for its speaker label and block gap; without it a page of
  short speaker blocks renders far taller than its character count predicts.
- Any block longer than a page is split before packing. A page that cannot be
  split is a page that clips. Renderers self-limit with `affordablePageCount()`:
  a slot never shows a page it cannot hold for that page's reading cost, so no
  page flashes past.

## Timeline oversubscription math

The song has 425 seconds. Both locked anchors derive their start from a
measured beat: `lorem-pursuit-1` from `bridgeStart` and
`blue-universal-acquires-wayland-yutani` from `finaleStart`. See "Anchoring
text to the music" below — neither start is a round number.

- Allocation is per whole page: a record's floor is one complete held page, its
  ideal is every authored page held for its reading cost. `allocateLoreSlots()`
  never allocates below the floor.
- **The floor is what makes oversubscription invisible.** When 27 records
  competed for ~400 seconds against ~900 seconds of authored pages, nothing
  errored. Every record was floored at one page, so a record with eight
  authored pages rendered page one and vanished. 17 of 27 records were cut
  mid-record, including Sarah's closing line and the death of Dr. Anderson.
  A record that is cut looks exactly like a record that is short. No renderer
  change can fix that: cutting records or extending the range is a human
  decision. Do not "solve" it by shrinking pages below a readable hold.
- **Curate by dropping the worst-served record, then re-solve.** Hiding
  cascades: freeing a slot lets survivors expand, so the fix is not "hide every
  record currently cut". Greedily drop the record showing the smallest fraction
  of itself (tie-break on largest ideal duration) and recompute until every
  survivor shows 100%. That took 17 cut records down to 11 hidden.
- Hidden records live in `hiddenFromWolvesVideoArtifactIds`. Hiding is
  reversible and lossless; a fragment on screen is neither. **Audit with a probe,
  not by eye:** compare each slot's duration against `affordablePageCount()`
  versus the record's authored page count. Anything below 100% is a record the
  audience sees the beginning of and nothing else.

## Timing lessons

- Keep scheduler and renderer on one content-cost timing model, and treat Wolves
  lore as a self-paced video presentation, not an interactive document: the
  renderer must advance and hold readable content automatically. Never *depend*
  on pointer, click, touch, keyboard, or scrolling interaction, and never expose
  a scrollbar. The audience has no input device. A presenter-only affordance on a
  silent pre-show card is the single exception — see "A presenter may pace a
  silent card".
- Render chatlogs and quotes as noninteractive, sentence- or word-bounded pages:
  one readable beat at a time, speaker header retained on continued chat beats,
  held and then replaced, never accumulated behind an overflow viewport.
- **Every lore view is a pure function of `elapsed`.** Chat and prose share one
  clock-driven page model: `pickPageIndexForElapsed(pages, elapsed, duration)`.
  No view owns a timer. The chat view used to be a typewriter on a `setInterval`
  started at mount that never read `props.elapsed`, which drifted against the
  music, could not be seeked or rehearsed from a fixed point, and held its slot
  open past the end so every later record started late. A view that reads the
  clock is reproducible: same second, same frame, every rehearsal.
- The Track 0 finale barrage begins at the measured 5:55 pickup
  (`TRACK_ZERO_SECTIONS.bkEnd`); spread its curated photos across the following
  measured beats rather than cutting on every beat.
- Add a locked hero photo as a contiguous timed window and shift only the
  following unlocked window: preserve locked anchors, recompute unlocked ones.
- Prefer invariant tests over stale exact timestamps for recomputed intervals.
  A build is not runtime proof; verify the real route in Chromium at short and
  long records and at locked anchors.

## Re-deriving Track 0 timing

Re-derive the unified Track 0 queue and finale timing from source with
`npm run test:run -- src/tests/wolvesThesisSequence.test.ts`.

## The intro sequence is a list, and things count it

`buildIntroVideoSequence()` in `src/data/wolves-intro-sequence.ts` is the
authored intro. It is no longer a single Destiny segment: it opens on
`wolves-title-card`, a silent text segment carrying the presenter's welcome
slide, and then runs `wolves-intro`.

Adding or retiming a segment here has reach beyond the overlay, because
`src/stores/cinematic.ts` derives `overallDuration` by summing every segment
(`INTRO_SEGMENTS = buildIntroVideoSequence()`). The transport widget's
`TOTAL m:ss / m:ss` readout is computed from that sum, so a new segment changes
strings that tests assert. `wolvesMediaWidget.test.ts` hard-coded
`TOTAL 28:45 / 32:29` and broke the moment a 46 s card was prepended. It now
derives the expectation from `store.overallElapsed` / `store.overallDuration`
instead. **Do not reintroduce literal clock strings in intro tests** — they rot
silently the next time the sequence changes, which is the same failure mode that
already bit the `119.5` / `1952.5` duration literals.

`buildDirectorsCutVideoSequence()` is a second, separate list. A segment meant to
open the show must be prepended to **both** or the Director's Cut will not have
it.

## Silent card windows are derived, not hand-picked

`buildOpeningTitleCardSegment()` used to carry `windows = [14, 16, 12, 17]` — a
59 s card for 34 s of prose. On a projected slide the audience finishes reading
and then waits, which reads as the show having stalled. The windows are now
`parts.map(text => Math.ceil(estimatePageSeconds(text)))`, the same reading model
the lore column pages by, giving a 37 s card with every authored word intact.

Retime by changing the model, not the numbers, and make tests derive the same
way: `wolvesIntroSequence.test.ts` asserted `card.duration === 59` and a literal
`[[0, 14], …]` cue table, both of which broke on the first retime. They now
recompute from `estimatePageSeconds`, checking the invariant — cues tile the
segment, each window is its own paragraph's cost — rather than a snapshot.
Shortening further means cutting a paragraph, which is a **content** change and
needs the owner. Do not trim authored wording to hit a duration.

## A presenter may pace a silent card; nothing else

`handleOverlayClick` → `advanceTextCue` in `WolvesIntroOverlay.vue` seeks to the
next authored cue when the presenter clicks the welcome card, and leaves the
segment once the last cue is up. This does not weaken the unattended guarantee:
the auto clock is untouched, so a run with nobody in the booth behaves exactly as
before. Input is an *affordance*, never a dependency — the regression test that
protects this is the one asserting the card still completes with no click at all.

Two exclusions are load-bearing. **Scored cards** (`segment.audioYoutubeVideoId`)
are excluded because the Director's Cut prologue is written against the Gayane
Ballet Suite, and moving its text without moving the track desyncs the rest of
the segment. **Transport chrome** is excluded via
`closest('button, a, input, [role=button]')` so Play/Pause/Next keep their own
meaning. The handler binds to the root `.wolves-intro-overlay`, not the
blackscreen: the quote plate and the transport both render *outside*
`.wolves-intro-overlay-blackscreen`, so a handler there catches neither.

## The overlay renders exactly one text treatment at a time

`isSomberTextSegment` (true for every `kind: 'text'` segment) switches the
overlay between two mutually exclusive branches: the guardian-plate block for
video segments, and a single centered `<p>` for text segments. A cue that needs
its own layout therefore has to both add its block *and* suppress the default
`<p>`, or the same words paint twice. The `titlePlate` cue does this via
`v-else-if="overlayText && !activeTitlePlateCue"`.

Two further traps when adding an overlay layer:

- **Cue background images are dimmed to `opacity: 0.55`** by
  `.wolves-intro-overlay-background`, because they are normally backdrops for
  text. When the photo *is* the slide, override it (the title card uses `0.92`)
  or the subject looks washed out.
- **The transport widget is `position: fixed`, `z-index: 1000`, and sits in the
  bottom ~100 px.** It outranks the overlay's own `z-index: 999`, so any
  bottom-anchored overlay content collides with it. The first title-card layout
  put the quote directly underneath the progress bar. It auto-hides after 3 s of
  pointer inactivity (`auto-hide` in `WolvesApp.vue`), which is why the collision
  is easy to miss — assert `getBoundingClientRect()` overlap between `.wc-widget`
  and the new element rather than trusting a single screenshot.

## Driving Track 0 in a browser

Reaching Track 0 in Chromium is not automatic. The standalone Playwright scripts
in `tests/*.mjs` mock the YouTube IFrame API and must then leave the Destiny
intro before any Track 0 selector exists.

**You cannot leave the intro with the progress bar.** `handleSegmentSeek` in
`src/WolvesApp.vue` routes a bar click to `intro.seekToRatio()` while the intro
overlay is showing, which seeks *inside* the intro sequence. Harnesses that
clicked `.wc-widget-progress` at an "overall" ratio sat in the intro forever and
timed out waiting for `.wc-trackzero-grid`.

Use the DEV-only hooks instead. Three exist, published at different times:
`window.__wolvesDurations` (`WolvesApp.vue`, from app start),
`window.__wolvesIntro` (`WolvesIntroOverlay.vue`, while the overlay is mounted),
and `window.__wolvesCinematic` (`WolvesApp.vue`, only after the stage starts).
Waiting on `__wolvesCinematic` while still in the intro therefore hangs forever.

`__wolvesDurations` exposes `intro()`, `overall()`, and `skipIntro()`. Read the
durations from it rather than hard-coding them: the literals `119.5` and `1952.5`
that both harnesses carried have already drifted, which is what silently broke
them. All three hooks are `import.meta.env.DEV` gated and absent from the
production bundle — verify with
`grep -c __wolvesDurations dist/assets/wolves-*.js`, which must print `0`.

`skipIntro()` starts the real stage, so a harness that has not installed the
YouTube IFrame mock hangs on `stage.start()`. Install the mock first; copy it
from `tests/wolves-trackzero-sidecar-real-player.mjs`.

**Do not build a new full-show harness to check a Track 0 anchor.** This was
tried and abandoned four times; the walk-the-Vue-tree route (clicking
`.wc-lobby-enter`, then looping the overlay's exposed `next()`) is not
repeatable — the step count needed to land in Track 0 is unstable, and
`window.__wolvesCinematic.seekTo` is offset by the intro, so a Track 0 time seeks
back into the intro and unmounts the lore column. Playwright's 30 s default
locator timeout makes each failed read look like a hang. Assert anchored moments
in `src/tests/wolvesLoreColumn.test.ts` against the page model instead, where the
Sarah-on-`bridgeStart` regression test already lives, and reserve browser runs
for the existing `tests/wolves-movie-flow.mjs`.

To reach the welcome card in a probe, click the lobby's **Meet your Teammates**
button (`emit('enter')`); the Director's Cut button opens the same card first.
The card's prose renders as `.wolves-intro-title-card-quote`, *not*
`.wolves-intro-overlay-text` — waiting on the latter silently burns the card's
whole runtime before matching the segment after it.

`tests/wolves-movie-flow.mjs` asserts Track 0 beats but stops at 196.36 (Jorge),
one slide before the Laura -> Tophee -> Reza boundary. That blind spot is exactly
where a dropped portrait shipped unnoticed. Extend coverage past any boundary you
change.

## Locked slide windows

Track 0 hero portraits are pinned to authored windows in
`src/data/wolves-track-zero-slides.ts`, but the schedule is assembled in
`WolvesComicReader.vue`, and the two drift apart in two specific ways. Both have
already shipped bugs.

- **The pool slice must cover every hero index.** `peoplePool1` is built from
  `shuffledPeople` by index range, then hero portraits are found inside it by id.
  A slice that stops short of the last hero index silently drops that portrait:
  `pinTrackZeroPostHeroOpening` prepends six slides, so hero indices run 6..14,
  and `slice(7, 14)` lost Tophee at index 14 while `peoplePool2 = slice(15, 39)`
  never picked him up. Nothing threw, no test failed, and the slide vanished from
  the show.
- **Anchor a locked slide to its own window, never to the running clock.**
  Pushing a locked portrait with `startTime: currentTime` makes it inherit any
  upstream drift. When Tophee disappeared, Reza moved from his locked 204.52 to
  200.44 while his `endTime` stayed 212.68 — so the portrait ran 12.24 s against
  a `duration` field still claiming 8.16 s, the crossfade derived from `duration`
  was wrong, and the "HAMI brings Bazzite" title above him was misaligned by
  4.08 s. The data layer and its unit tests were all correct; only the assembled
  schedule was wrong. Use `startTime: <slide>TrackZeroWindow.startTime`.

Verify a window change by dumping the rendered slide at boundary times, mounting
fresh at each time: `setProps` alone does not swap the displayed buffer in jsdom
because the incoming image never loads, so a stale slide keeps reporting and the
check silently passes.

## Slide preloading is measured in seconds, not slides

`WolvesComicReader.vue` gates each slide swap on the incoming image having
decoded, so the wallpaper cannot flash through an empty buffer. That gate is
correct and must stay: skipping a late image would break slide order, which is
locked.

So preload depth *is* the timing budget. The rule used to be "three slides ahead
if the current slide is under a second, otherwise one", which gave the Track 0
finale barrage — roughly 1.76s per slide — one slide of warning to fetch and
decode a multi-megabyte photo. Depth is now accumulated in seconds of upcoming
slides (`PRELOAD_WINDOW_SECONDS`), capped by `MAX_LOOKAHEAD_SLIDES`. Order
matters as much as depth: lookahead runs only after the slide going on screen
*now* has been fetched, and that fetch is marked `fetchPriority = 'high'`. A
browser opens about six connections per host, so firing a dozen lookahead
requests first puts the visible slide at the back of the queue and causes the
exact stall the lookahead exists to prevent.

Two things were tried and rejected, so they do not get re-proposed: a retained
decoded-image cache (real memory cost, no improvement distinguishable from
run-to-run noise; repeat fetches are left to the browser's HTTP cache), and any
deadline that swaps before decode (it reintroduces the wallpaper flash).

`tests/wolves-movie-flow.mjs :: Comic Hero Shots title card advances to a later
slide without repeating` is **flaky on `main` too**: it allows 250ms for a
decode-gated crossfade of a large photo and fails roughly a third of the time on
either branch. Measure over several runs before blaming a change for it.

## WolvesComicReader serves more than Wolves

`WolvesComicReader.vue` drives three different shows and only one is the
presentation:

- `timelineSlides` — the Wolves Track 0 schedule (`wolvesExperience` true).
- `laterTrackPhotos` — Wolves tracks 1 and later.
- `mixedPhotos` — the ten other albums in `public/experiences/catalogue.json`.

`mixedPhotosToUse` only swaps in `timelineSlides` when `wolvesExperience` is
true, so `mixedPhotos` is live for every non-Wolves album. It reads as dead
legacy code beside the newer Wolves path, and an audit flagged ~113 lines of it
for deletion; deleting it would have broken ten experiences while leaving
`/wolves/` working, so a `/wolves/` smoke test would not have caught it. Check
whether the non-Wolves experiences reach a symbol before removing it. Likewise
`isExperimental` is a permanently-true flag, not a licence to delete its branch.

## Anchoring text to the music

Some moments must land on a measured beat, not near one. There are two:

- The finale: the audience must read that Dr. Andy Anderson is dead on the same
  beat the score says **Become Legend** (`finaleStart`, 408.137).
- The Golden Era transmission: Sarah's closing line, "Thus becoming One, from
  the Seven...", lands on the chanting bridge (`bridgeStart`, 229.204).

The rule is **the text moves to the music, never the music to the text.**
`TRACK_ZERO_SECTIONS` in `src/data/wolves-track-zero-beats.ts` holds measured
beat times. A round number like `408` is an authored guess; a measured beat is
ground truth. Do not write down the start time you happened to measure — derive
it:

```ts
// wolves-narrative-timeline.ts
const finalRecordStartTime = TRACK_ZERO_SECTIONS.finaleStart
  - REVEAL_LEAD_SECONDS
  - costOfPagesBeforeTheReveal
```

`REVEAL_LEAD_SECONDS` (0.01) is not superstition: `pickPageIndexForElapsed`
selects with a strict `<`, so a page timed to the exact beat wins or loses on
float rounding — the first attempt showed the *previous* page on the beat.

Both anchors are also end-anchored, not just start-anchored: an anchored record
must get a slot at least as long as its authored pages cost. The Golden Era
transmission was once pinned to a hard-coded 150-220 — 19 seconds short of its
own content — so it was cut at page 8 of 11 and Sarah's line never reached the
screen. Anchor the *last* page to a beat and size the slot from the record's own
read cost, and both ends are fixed at once. Both sides of a synchronised moment
must read the same constant: the thesis cue uses `TRACK_ZERO_SECTIONS.finaleStart`
too, so the caption and the reveal cannot drift apart.
`src/tests/wolvesFinaleReveal.test.ts` asserts the page shown at the beat, the
page just before it, and the cue text; `wolvesLoreColumn.test.ts` does the same
for Sarah against `bridgeStart`, using the real scheduled slot.

An anchor derived from page costs is only as good as the string those costs are
measured from. The scheduler costs authored blocks (`loreProsePages`), so a view
must page the *same* authored blocks. `parseLoreSpeakerParagraphs` returns
`source` — the authored block with its `**SPEAKER**:` prefix intact — for
`pickBlockPage` to measure, plus separate `speaker`/`text` fields for display.
Paginating rendered HTML instead is silently wrong: escaping, `<strong>`
expansion, and a stripped speaker prefix each change the character count, so a
long turn breaks at a different word than the scheduler predicted. Page *counts*
usually still match, so count-based tests pass while the reveal drifts. That is
how the closing bulletin showed "Dr. Andy Anderson" 8.3 seconds before **Become
Legend**, with the reveal clause dealt across a page turn. A test that pages a
record must page it through the view's path, not the scheduler's. When you change
an anchor, expect tests asserting the old round number to fail: rebind them to
the measured constant; do not re-record them as known failures.

See `../wolves-content/SKILL.md` for page-breaking, image fitting, projected
measure, and gallery-withholding rules.

## Adding a segment breaks the movie-flow harness at the front

`tests/wolves-movie-flow.mjs` (CI job `wolves-movie-flow`) drives the show from
the lobby door. It assumes the Destiny player mounts within ten seconds of
entering, so prepending any segment ahead of it kills the entire run at step
three and the remaining twenty-odd assertions never execute. The job goes red
with a **passing** count of two, which reads like a small failure and is not.
When you add a segment to the front, teach the harness to step past it: assert
the new segment, then advance with the transport control before waiting on the
player. A shrinking "passed" count is the signal that the harness is dying
early rather than failing a check.

Three traps in that harness, all of which cost real time:

- **Cross-dissolves put two elements in the DOM at once.** `[data-comic-hero-shot]`
  matches both the leaving and entering image mid-fade — a strict-mode violation,
  not a failed assertion. Qualify with `:not(.comic-hero-shot-fade-leave-active)`.
- **The transport widget auto-hides.** Scripted `page.evaluate()` seeks are not
  pointer input, so the controls slide off screen and clicks report "outside of
  the viewport". Nudge `page.mouse` and let the reveal transition finish first.
  This also means never clicking `Next` with a raw `page.getByLabel('Next')` —
  two controls share the label (overlay + transport), and the raw locator
  intermittently resolves to the off-viewport one and times out after 30 s. Use
  the harness's `clickControl()` helper, which nudges the pointer and clicks the
  visible match.
- **Cue windows drift out from under seek times.** A seek one second before a
  plate's window opens fails by timeout, which looks like a missing element
  rather than a stale constant. Check the cue's `start`/`end` in
  `wolves-intro-sequence.ts` before believing the component is broken.

## The mock player must emit the real load lifecycle

`useDualBufferPlayer.start()` awaits a promise that only resolves when the
**active** player fires an `onStateChange` to `PLAYING` after
`loadVideoById(...)`. The real IFrame API buffers and autoplays after a load;
a mock whose `loadVideoById` only records the video id never emits that
transition, so `start()` never settles, `handleIntroComplete()` in
`WolvesApp.vue` never reaches `introTransparent = true`, and
`.wolves-intro-overlay--transparent-handoff` never appears. That is issue
#706's exact failure: the harness dies at the intro handoff with the overlay
stuck opaque, and every Track 0 assertion after it silently never runs.

When writing or copying the mock (`tests/wolves-movie-flow.mjs` has the
canonical one):

- `loadVideoById` must set `currentTime` to `startSeconds` and then emit
  `BUFFERING` → `PLAYING` state changes asynchronously (microtask is enough).
- `cueVideoById` must set `currentTime` and emit `CUED` — the dual buffer cues
  the inactive side and then prewarms it with `playVideo`, which parks it back
  on `PLAYING` (`parkPrewarmedSide`).
- Forcing `ENDED` or seeking past the intro cut does **not** unstick the
  handoff; the await is on the *cinematic stage's* load-play transition, not
  on the intro player at all.

## Derive harness expectations from the live modules, not constants

Most of the movie-flow harness's historical failures were stale constants,
not runtime defects. The show's timing is derived — lore slots from reading
cost (`wolves-narrative-timeline.ts`), rotating signals paced by
`getTrackZeroHudLabel`, slide windows re-measured in
`wolves-track-zero-slides.ts` — so any hard-coded time or expected string in a
test drifts the moment content is re-edited. Under the Vite dev server a
Playwright page can import the authored modules directly:

```js
const timeline = await page.evaluate(async () => {
  const mod = await import('/src/data/wolves-narrative-timeline.ts')
  return mod.wolvesNarrativeTimeline
})
```

Use this to compute slot boundaries, slide-window straddles (± a small
epsilon; the hero-run windows have already shifted by 0.001 s once), the
paced finale message list (`getTrackZeroSectionMessages(4)` — the old
`wolves-incoming-signal.txt` is no longer the runtime source), and the air
time of a specific rotating signal (scan `getTrackZeroHudLabel` over the
window). Assert the DOM against those derived values. Selectors go stale the
same way: the lore title is `.lore-dossier-title` (`LoreRecordHeader`), not
the old `.conversation-title`, and the lore page viewport intentionally clips
(`overflow: hidden` in `lore-dossier.scss`) — it is not a scroll surface.
