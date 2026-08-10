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

`buildDirectorsCutVideoSequence()` is a second, separate list. A segment meant to
open the show must be prepended to **both** or the Director's Cut will not have
it.

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
