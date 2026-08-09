# Wolves slide scheduling and comic reader

**Agents edit content. Agents never edit design.**

Defect-derived invariants for `WolvesComicReader.vue`: locked slide windows,
preload budgeting, beat grids for segments 1-6, buffer continuity at segment
boundaries, and the non-Wolves experiences the same component serves.

Numbering in this file is the comic reader's `trackIndex`, which is a **segment**
index: 0 is “7 Days to the Wolves”, 1 is “Ghosts In The Mist”, through 6, “Last
Ride of the Day”. `wolves-runtime.md` uses show numbering, where Track 0 is the
Destiny intro and every song is one higher. The show is seven parts and the
segment list matches `public/wolves-playlist.json` 1:1; see
[`wolves-transport-and-clocks.md`](wolves-transport-and-clocks.md).

Procedure and approval gate: [`../skills/wolves-runtime-engineering/SKILL.md`](../skills/wolves-runtime-engineering/SKILL.md).
Show-wide production facts: [`wolves-runtime.md`](wolves-runtime.md).

## Only segment 0 has a measured beat grid, and that is a considered position

Segments 1-6 cut slides on a uniform `floor(elapsed / hold)` grid derived from
the authored `bpm`/`phraseBeats` in `public/wolves-playlist.json`, not on
measured beats. That is weaker than segment 0 and it is tempting to "just run
librosa on the other six". This was attempted and **deliberately not shipped**.
Measure before you retry it, and expect these results (librosa 0.11, 22050 Hz,
hop 512, on the exact video audio):

| segment | authored | librosa global | verdict |
|---|---|---|---|
| ghosts-in-the-mist | 100 | 99.34 | agrees |
| tonight-we-must-be-warriors | 168 | 83.33 | **octave error** — exactly 168/2 |
| not-your-monster | 86 | 86.08 | agrees |
| end-of-you | 95 | not measured | see below |
| soulbound | 124 | 99.34 | **suspect** |
| last-ride-of-the-day | 174 | 161.73 | suspect |

`end-of-you` has no librosa row because the segment had been deleted from
`CINEMATIC_SEGMENTS` when that pass ran; it has since been restored, and its
authored `bpm` 95 / `phraseBeats` 16 come from the playlist manifest. Measure it
with the rest if the pass is ever repeated. Do not infer a value for it.

Two traps, both visible in that table:

- **Octave ambiguity.** librosa reports the pulse it finds, which is freely the
  half or double of the musical tempo. `83.33` is not a disagreement with `168`,
  it is the same tempo counted differently. Taking it literally would have halved
  the cut rate for the whole segment.
- **Tempo-prior clustering.** Ghosts and Soulbound both come back as **99.34**.
  An identical estimate for two unrelated songs is the estimator's prior showing
  through, not a measurement. Any two tracks landing on the same value to two
  decimals is the tell.

The authored `bpm` values are mostly right; the automated estimate is what is
unreliable. Track 0's grid is trustworthy because a human verified it against the
music — that is where "global tempo 152 BPM with a measured slowdown to ~136 BPM
in roughly 172-270s" in `wolves-track-zero-beats.ts` comes from. Nothing in an
automated run produces that annotation.

So: a measured grid for segments 1-6 is a real improvement and is still open, but it
needs a human listening pass to resolve the octave and confirm each tempo. Do not
ship generated beat times straight into the show. Phase is not the shortcut either
— first-beat offsets measure 0.07-0.49 s, all under one beat, so re-phasing the
existing uniform grid buys nothing detectable from a theater seat.

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
- `mixedPhotos` — the eleven albums in `public/experiences/catalogue.json`.

`mixedPhotosToUse` only swaps in `timelineSlides` when `wolvesExperience` is
true, so `mixedPhotos` is live for every non-Wolves album. It reads as dead
legacy code beside the newer Wolves path, and an audit flagged ~113 lines of it
for deletion; deleting it would have broken eleven experiences while leaving
`/wolves/` working, so a `/wolves/` smoke test would not have caught it. Check
whether the non-Wolves experiences reach a symbol before removing it. Likewise
`isExperimental` is a permanently-true flag, not a licence to delete its branch.

Gallery image crossfades must not run inside a `backdrop-filter` surface.
Profiling the “Mein Herz brennt” 3:27-3:35 window isolated 66-83 ms frames when
the slide opacity transition repainted the blurred viewport; removing blur held
the same window to compositor-paced frames. Those slides use static translucent
backgrounds instead.

The same hitch was reported across the Wolves album from “Ghosts In The Mist”
onward, which runs the same rapid gallery crossfade, so the treatment covers
every segment except Track 0. Track 0 is excluded deliberately: its blur is
authored, its look is locked, and it does not drive the gallery the same way.
The switch is `usesFastCrossfade` in `WolvesComicReader.vue`, pinned by tests in
`src/tests/wolvesComicReader.test.ts`.

The month wallpaper dissolve underneath is a second, smaller contributor. It is
pinned for the back catalogue only; on Wolves it carries authored meaning
(progress across the seven parts) and is left running. If the hitch persists on
the later tracks after the blur change, that is the next lever — not a silent
one to pull.

## Nulling both slide buffers is a hard cut

`WolvesComicReader`'s slide watcher has a cold-start branch, taken when
`photoA` and `photoB` are both null, that assigns the incoming photo
**synchronously** and leaves `crossfadeActive` false. It bypasses the decode
gate and `beginCrossfade()` — the two guarantees the file exists to provide.

The segment-boundary reset used to blank both buffers, which put every boundary
through that branch: the outgoing image vanished and a multi-megabyte remote
photo popped in as it downloaded. The transition overlay hid it at five of six
boundaries, but not at Part I → Part II, where `CinematicTransition.vue`
deliberately skips the overlay.

Reset the **off-stage** buffer only. The visible frame holds until the incoming
image decodes and the normal preload-then-crossfade path swaps it, and the
outgoing track's photo still cannot be reused. Because the display watcher may
not re-fire when the index happens to be unchanged across the boundary, bump a
`trackChangeSerial` ref that is one of its watch sources.

jsdom never fires `image.onload`, so the whole suite exercised that same
synchronous branch and saw nothing wrong — which is why this shipped. To get
real coverage, stub `Image` with a controllable lifecycle (push instances on
`src` assignment, fire `onload` by hand, `decode()` resolves) and assert the
displayed `src` is *unchanged* immediately after the boundary flush. See
`describe('segment boundary slide continuity')` in
`src/tests/wolvesComicReader.test.ts`.

**Holding the outgoing frame is only half the fix.** `preloadUpcoming()` walks
the *current* track's list, so nothing warms the first slide of the next track.
Gating the boundary on decode therefore traded a hard cut for a stall: Part II
opened on Part I's final photo until the Jorge hero plate — a remote,
multi-megabyte Flickr image — finished downloading. Measured in the browser, the
correct image landed more than 250 ms after the boundary, which is why
`tests/wolves-movie-flow.mjs` failed three Ghosts assertions while every unit
test passed.

The runtime already publishes the incoming segment one crossfade window early
(`store.pendingSegmentIndex`, also set immediately on a manual skip). Pass it in
as `pendingTrackIndex` and prefetch that track's **authored** opening at `'high'`
priority, so the decode gate resolves from the HTTP cache instead of the network.
Only the “Ghosts In The Mist” opening (segment index 1, PART II) is authored and
therefore knowable ahead of the boundary
(`ghostsInTheMistOpeningSlide`, whose `trackIndex` is 1); the other boundaries
are covered by the transition overlay, so they can afford the fetch.

The general rule: **a decode gate is only as good as what has been fetched before
it.** Any time you make a swap wait for readiness, check what warms the thing it
is waiting on — and if nothing does, the gate is a stall, not a guarantee.
