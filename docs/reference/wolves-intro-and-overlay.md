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

`isTextSegmentComplete()` takes the player's own signals and ends the card two ways:

1. **Authored duration elapsed** — the normal path.
2. **Inside the track's measured silent tail**, the embed either published `ENDED`
   or its clock froze for longer than `TEXT_SEGMENT_STALL_GRACE_SECONDS` (3s). That
   window is `TEXT_SEGMENT_END_SLACK_SECONDS` (1s) wide, and it is deliberately the
   *only* place an end-of-track claim is believed.

Scoping both signals to the same window matters, and the asymmetry is a trap worth
naming: a YouTube embed publishes state changes around ad breaks, and a mid-roll ad
freezes the main video's clock at a **nonzero** time. A rule that trusted `ENDED`
anywhere the clock had started would end a 325.6s scored act at, say, 120s — live,
unrecoverably — trading a hang for a truncation. An `ENDED` from the body of the
piece is therefore not believed; the card is handed back to its own clock instead.

The window itself sits entirely after the Gayane source's last audible sample
(321.34s, against a 325.6s container), so the backstop can only ever give back
silence, never a note.

Three rules this encodes:

- **The handlers raise flags; the 100ms tick decides.** `onStateChange` and `onError`
  never call `advance()` themselves. One decision point is what makes "advances
  exactly once" true no matter which signals arrive, in which order, or how late.
- **A dead clock is replaced, not raced.** On `onError`, or on an `ENDED` outside the
  end window, `releaseAudioClock()` rebases the card's own origin clock to the current
  elapsed and the card plays its authored windows out in silence. Advancing instead
  would throw away the whole narrated act, and waiting would freeze on whichever cue
  was on screen.
- **A released clock is watched, not abandoned.** The tick keeps reading the real
  clock, and the moment it moves past where it stopped the card snaps back to it and
  clears the end flag. An ad break therefore costs the music, not the synchronisation:
  the player's clock is still the only thing this show is ever in sync with.

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

## Director prologue text must hold, not spend its window appearing

The shared somber treatment can fade for 7.8s. Applied to the Director's Cut, that
left a 9–15s musical cue blank or translucent for most of its life, especially
after a seek restarted the keyed element. The Director prologue now caps its own
reveal at `DIRECTORS_CUT_TEXT_FADE_SECONDS` (1.6s); the rest of each measured
window is a stable reading hold.

The former 35-word Clarke sentence is not split—the presentation rule still
forbids splitting a quote—but it is also not painted as one projected paragraph.
It remains in the sourced lore corpus and is omitted from this intro sequence.
Every displayed prologue cue is at most 18 words.

The ten concept paintings no longer form a 142.42s textless interval. Complete
authored thoughts recur across that movement, and the paintings are static.
The former shared Ken Burns treatment enlarged them from 115% to 165%, which
made already-cropped source art soft and over-framed on projection.

For browser seek probes, wait for two independent conditions: the transport has
published the requested native time, and the intended incoming image has decoded
and become the active layer. "The previous image stayed stable twice" is not a
settle condition.

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
