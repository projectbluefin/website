# Wolves intro sequence and overlay

**Agents edit content. Agents never edit design.**

Defect-derived invariants for the Wolves intro sequences, the silent title
card, presenter pacing, and the intro overlay's text treatments.

Procedure and approval gate: [`../skills/wolves-runtime-engineering/SKILL.md`](../skills/wolves-runtime-engineering/SKILL.md).
Show-wide production facts: [`wolves-runtime.md`](wolves-runtime.md).

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

`buildDirectorsCutVideoSequence()` is a second, separate list, and it now lives in
its own module, `src/data/wolves-directors-cut-intro.ts`. It is **not** the standard
list with extra segments: it is two segments (the full-length scored Gayane prologue
and the Ikora-voiced Destiny handoff) with no opening title card at all, because the
Director's Cut is a one-song cinematic rather than the presenter's slide deck. A
segment meant to open the show therefore belongs in whichever list actually opens
that show — adding it to both is a decision, not a default.

**The store must be told which list is on stage.** `src/stores/cinematic.ts`
used to build `INTRO_TIMELINE` once at module load from the standard sequence
only, while `WolvesApp.vue` can run the Director's Cut. `syncIntroStatus()` then
clamped a Director's Cut index into the shorter standard timeline, so progress,
`sequenceElapsed`, `overallElapsed`, `overallDuration`, and the transport's
`TOTAL m:ss / m:ss` were wrong for the whole Director's Cut intro (2064.8 s
reported for a 2195.8 s show). The store now exposes `setIntroSequence(segments)`,
which rebuilds the intro timeline and re-runs `rebuildTimelines()`; `enterIntro()`
and `restoreIntroForNavigation()` in `WolvesApp.vue` call it with
`introVideos.value` **before** `store.enterIntro()` and before any status sync.

Two traps that come with it:

- `INTRO_SEQUENCE_DURATION` is imported as a value, so it cannot stay a `const`
  snapshot. It is now an exported `let` — ES module bindings are live, so every
  importer (the DEV `__wolvesDurations.intro()` hook, `startCinematicStage()`,
  tests) follows the swap with no call-site change. `import/no-mutable-exports`
  is disabled on that one line on purpose.
- A Pinia getter computed purely from module-level state caches its first value
  forever, because it has no reactive dependency. `overallDuration` did exactly
  that. State now carries `timelineRevision`, bumped by `loadExperience()` and
  `setIntroSequence()`, and the duration getters read it.

The intro list is module-level state, so a test that swaps it must restore the
standard sequence in `afterEach` or it leaks into every later test in the file.
Derive Director's Cut expectations from the store (`store.sequenceDuration`,
`INTRO_SEQUENCE_DURATION`), never from a typed-in runtime.

**Both cuts are now two segments, so a length check no longer proves anything.**
`wolvesCinematicStores.test.ts` used to assert `directorsCut.length >
standard.length`, which stopped discriminating the moment the Director's Cut lost
its title card. A guard that a sequence swap actually took effect has to compare
what the timeline *resolves* — `resolveOverallRatioTarget().segmentId` per index,
and each index's authored `segmentDuration` — not how many entries it has. The
same rule applies to any future assertion about which cut is on stage.

**Fixing the intro list did not fix what plays after it.** `setIntroSequence()`
above only retimes the *intro*; the *cinematic* segments the intro hands off
into are a separate piece of module-level state (`activeSegments`, set by
`loadExperience()`). `enterIntro()` used to publish the Director's Cut intro
list correctly but never call `loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)`
— so choosing the Director's Cut played its own, correctly-timed intro and then
handed off into the full seven-part standard cinematic anyway. The manifest now
carries a `presentationProfile` (`'wolves-standard' | 'wolves-directors-cut' |
'generic'`), and `enterIntro()` calls `store.loadExperience(directorsCut ?
WOLVES_DIRECTORS_CUT_EXPERIENCE : WOLVES_EXPERIENCE)` before publishing the
intro sequence, so the standard lobby's own `Enter` button always restores
`WOLVES_EXPERIENCE` explicitly rather than relying on whatever a previous run
left active. See
[`../skills/wolves-runtime-engineering/SKILL.md`](../skills/wolves-runtime-engineering/SKILL.md)
for the typed `isWolvesPresentation` replacement for raw
`experienceId === WOLVES_EXPERIENCE.id` checks this required across the
runtime.

## A scored card ends when the player says so, not when its clock says so

A `text` segment with an `audioYoutubeVideoId` takes its clock from that background
embed's `getCurrentTime()` — deliberately, because a pre-roll ad holds that clock at
0 and a mid-roll ad freezes it, so the card waits for the music instead of desyncing
from it. That is the right clock, and it is the only clock. It is not, on its own, a
safe way to end a card.

The Director's Cut prologue is authored to the Gayane source's full container
(`GAYANE_TRACK_SECONDS = 325.6`, decoded 325.602s). `elapsed >= 325.6` therefore has
about 2ms of margin against a player that plateaus a few hundredths short of the
duration it reports — a routine YouTube behaviour. The failure is not a glitch: the
closing title sits on a theater screen forever, unattended, with no way to recover
live.

`isTextSegmentComplete()` takes the player's own signals and ends the card three
ways, in order of authority:

1. **Authored duration elapsed** — the normal path.
2. **The embed published `ENDED`** — authoritative wherever the clock got to, because
   the music is demonstrably over. Trusted only once `elapsed > 0`, so an ad's end
   cannot be read as the track's end and skip the entire scored act on the cold open.
3. **The clock froze inside the track's silent tail** for longer than
   `TEXT_SEGMENT_STALL_GRACE_SECONDS` (3s), within `TEXT_SEGMENT_END_SLACK_SECONDS`
   (1s) of the authored end. This is the bounded backstop for a plateau that never
   fires `ENDED`, and its whole window sits after the Gayane source's last audible
   sample (321.34s), so it can only ever give back silence — never a note.

Two rules this encodes:

- **The handlers raise flags; the 100ms tick decides.** `onStateChange` and `onError`
  never call `advance()` themselves. One decision point is what makes "advances
  exactly once" true no matter which signals arrive, in which order, or how late.
- **A dead clock is replaced, not raced.** On `onError`, or on an `ENDED` that lands
  before the track ever started, `releaseAudioClock()` rebases the card's own origin
  clock to the current elapsed and the card plays its authored windows out in silence.
  That is not a second clock running alongside the music; the clock it replaces has
  stopped existing. Advancing instead would throw away the whole narrated act, and
  waiting would freeze on whichever cue was on screen.

Constructing a background audio embed with `events: {}` is the defect this section
exists for.

## Two uploads of the same trailer do not share an outro

The standard intro's Destiny segment defaults to an unvoiced re-upload
(`BV3BZKbpBns`) and offers Bungie's own Ikora-voiced upload (`BKm0TPqeOjY`) as a
toggle. The Director's Cut plays the Ikora upload as its *primary*. Transposing the
authored cue windows between them is a two-line change and one of those lines is a
trap.

Frame measurement, not assumption, settles it. Sampling both sources at 10 fps into
normalised luma signatures and cross-correlating puts the content offset at
**2.10s** (similarity 0.635, against 0.609 at 2.00s and 0.565 at 2.20s), and paired
frames confirm it: Ikora 12.40s is unvoiced 14.50s, 13.70 is 15.80, 87.40 is 89.50.
Every guardian window therefore shifts by −2.10s, which is why the Director's Cut
derives them from `buildIntroVideoSequence()` rather than retyping them.

The cutoff does **not** transpose. The two uploads end differently:

- The unvoiced re-upload dissolves its last shot to black across ~115.7–119.1s and
  then holds black to its end, so `maxDuration: 118.8` lands on its last lit frame.
- Bungie's upload hard-cuts (113.50s is the last content frame, 113.55s is fully
  black) and fades up a **"SEASON OF THE WISH" promotional card** from ~114.5s that
  holds to the end of the video.

`118.8 − 2.10 = 116.7` is inside that promo card. Reusing the standard cutoff would
have put a Destiny seasonal advert on the theater screen. The Ikora cutoff is
`113.5`, measured at 0.05s resolution.

Two more measured differences worth knowing: Bungie's upload carries its own ESRB
"TEEN" card from 0.00–1.99s (so it needs the same `startOffset: 2`), and it is
**full-frame 16:9**, while the unvoiced re-upload has 2.39:1 letterbox bars baked in
(active picture rows 92–627 of 720). On a projector the official upload is simply
the better source.

**Neither switch follows the footage into the Director's Cut.** The overlay's
alternate-source switch is offered by the segment's own data — `canToggleDestinyVoiceOver`
tests for `alternateYoutubeVideoId`, not for a segment id — so the Director's Cut, whose
primary *is* the Ikora upload, structurally cannot expose a stale toggle back to the
unvoiced re-upload. The CC switch stays scoped to `STANDARD_DESTINY_SEGMENT_ID`
(`'wolves-intro'`), the conference cut's trailer, where a laptop viewer can reach it;
the Director's Cut publishes `showCaptionToggle: false` because it is performed to a
room with no input device and its only burned-in cue is the Comic Hero title card,
which renders switch or no switch. Both are asserted in `wolvesIntroOverlay.test.ts`,
from both directions — the standard cut still publishes both switches.

## `emphasis: 'dominant'` is priced in frame height, not just words

`dominant` is an ~81px display treatment, and the cue comment that introduced it
names the Arthur C. Clarke quote as its exemplar. That is true of the quote as a
*line* and false of it as a *page*. The Director's Cut restored the quote to one
unsplit cue — a quote is never split across pages — and at 35 words in dominant type
it renders **878px tall**: cut off at the top of a 1280×720 frame, and colliding with
the top nameplate at 1440×900. Both measured in Chromium.

The fix is the treatment, never the words: the quote drops to the standard somber
size, where it renders 268px at 720p and 161px at 1080p and reads cleanly. The
measured ceiling is recorded as `DOMINANT_EMPHASIS_MAX_WORDS` (13 words, which
renders 488px of a 720p frame) and a unit test holds it, so the next long beat cannot
quietly acquire the treatment and overflow the screen.

Related trap when verifying any of this in a browser: the scene layer cross-dissolves
for `PROLOGUE_SCENE_CROSSFADE_SECONDS` (3.9s) and the somber text fade runs up to
`PROLOGUE_TEXT_FADE_SECONDS` (7.8s), and **both restart from the DOM update when a
harness jumps the clock** rather than playing linearly. Sampling ~200ms after a seek
reads the *previous* cue's scene element and an opacity around 0.05, and polling for
"one `.wolves-intro-overlay-scene` element" resolves instantly because the incoming
element has not been inserted yet. Wait out the fade (8.4s) before asserting, and read
the *last* matching element, not the first.

Do not read a black frame below 641px as a defect either:
`@media (max-width: 640px)` sets `.wolves-intro-overlay-text { display: none }` on
purpose — "Mobile keeps the footage and the app-level playback widget only."

## Silent card windows are derived, not hand-picked

`buildOpeningTitleCardSegment()` used to carry `windows = [14, 16, 12, 17]` — a
59 s card for 34 s of prose. On a projected slide the audience finishes reading
and then waits, which reads as the show having stalled. The windows are now
`estimatePageSeconds(text) * TITLE_CARD_PACE`, the same reading model the lore
column pages by, with every authored word intact.

`TITLE_CARD_PACE` exists because the reading model is the wrong yardstick for
this one surface. `estimatePageSeconds` prices text for an audience reading it
off a projector **in silence**, and nobody reads this card in silence — it is
the presenter's own welcome slide and he speaks these lines from the stage. Held
at full silent-reading cost the speaker waits on his own slide. It is halved on
owner instruction (2026-08-09), taking the card from 37 s to 19 s.

This is the exception, not a licence. Every other Wolves text surface is read,
not narrated, and the readability minimum there is not negotiable — do not
"speed up" a lore record by borrowing this idea.

Retime by changing the model, not the numbers: move `TITLE_CARD_PACE`, never an
individual window, or the relative weighting the card was authored for is lost —
the long CNCF beat has to stay the longest and the "Don't believe me?" punch the
shortest. Make tests derive the same way: `wolvesIntroSequence.test.ts` asserted
`card.duration === 59` and a literal `[[0, 14], …]` cue table, both of which
broke on the first retime. They now recompute from `estimatePageSeconds` and the
exported pace, checking the invariant — cues tile the segment, each window is its
own paragraph's paced cost — rather than a snapshot.
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
