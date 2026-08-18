# Wolves runtime reference

**Agents edit content. Agents never edit design.**

## What this is

`/wolves/` is a cinematic presentation performed to a live audience seated in a
theater. It is projected on a large screen, synchronized to music by the media
player clock, and it runs unattended from start to finish.

It is a show, not a document and not an app. The audience reads it from a
distance, at a pace the music chooses, with no ability to interact. The
production qualities that follow from that are stated in `AGENTS.md` under
"`/wolves/` is a presentation" and are binding on every change here.

The recurring failure mode in this repository is treating a Wolves surface like
a web page: adding scroll, shrinking type to fit more words, varying chrome per
view, or adding content without checking whether its time window can hold it.

## Boundary

The `/wolves/` presentation has a frozen design. Agents may edit only authored
prose, data values, registered records, and approved assets within existing
structures. Do not edit Vue templates, styles, layout, controls, animation,
player synchronization, or generated files for content work.

## Runtime owners

- Entry: `wolves/index.html`
- Mount: `src/wolves-main.ts` and `src/WolvesApp.vue`
- State: `src/stores/cinematic.ts`
- Intro data: `src/data/wolves-intro-sequence.ts`
- Segment data: `src/config/wolves-cinematic.ts`
- Player buffers: `src/composables/useDualBufferPlayer.ts`
- Content procedures: `docs/skills/wolves-content/SKILL.md`

## Runtime engineering references

Approved runtime engineering is gated by
[`../skills/wolves-runtime-engineering/SKILL.md`](../skills/wolves-runtime-engineering/SKILL.md).
The defect-derived detail behind that gate lives in these companion references:

- [`wolves-transport-and-clocks.md`](wolves-transport-and-clocks.md) — dual-buffer
  player, crossfades, clock derivation, bounded awaits, segment-vs-playlist
  indexing.
- [`wolves-intro-and-overlay.md`](wolves-intro-and-overlay.md) — intro sequences,
  silent title card windows, presenter pacing, overlay text treatments.
- [`wolves-lore-timing.md`](wolves-lore-timing.md) — lore page model, timeline
  oversubscription math, anchoring text to measured beats.
- [`wolves-slide-scheduling.md`](wolves-slide-scheduling.md) — beat grids, locked
  slide windows, preload budgeting, slide buffer continuity.
- [`wolves-test-harnesses.md`](wolves-test-harnesses.md) — browser harnesses and
  player mocks.

## Open content surfaces

- Lore: `src/data/lore/*.md` plus a manifest entry in
  `src/data/wolves-lore-records.ts`. These are coupled records: when deleting a
  lore file, remove its manifest entry and any
  `src/data/wolves-narrative-timeline.ts` artifact entry in the same change, or
  route initialization will fail.
- Incoming signals: `src/data/wolves-incoming-signal.txt`.
- Dinosaur registry: `src/data/wolves-dinosaur-species.ts`.
- Guardian bond data: `src/data/wolves-guardian-dinosaur-bonds.ts`.
- Intro cue data: `buildIntroVideoSequence()` (standard intro) and `buildDirectorsCutVideoSequence()` (Director's Cut with Gayane Ballet Suite prologue + Destiny 2 trailer) in `src/data/wolves-intro-sequence.ts`. Both sequences now open on the silent `wolves-title-card` segment: the presenter's welcome slide, built by `buildOpeningTitleCardSegment()`, showing the recovered orange-shirt stage portrait behind a Ghosts In The Mist-style nameplate (`Jorge Castro` / `Project Bluefin // Universal Blue // Kubernetes`) and the owner-authored welcome quote in four timed paragraphs, then handing off to the Destiny trailer. The portrait is 3:2, so landscape viewports fit it with `object-fit: contain` to keep the full gesture in frame while portrait keeps `cover` biased up the frame; the quote is capped to a readable measure and balanced, and its lower third is a soft scrim rather than an opaque panel. It carries no audio by design so the room hears the speaker. The Director's Cut option is available at the bottom of the `/wolves/experience/` lobby. The standard intro's comic title-card slot uses the approved project copy, restores the MakeMeAComic QR code, and places the recovered Amber Graner quote at the bottom. Its music widget auto-hides during inactivity and reappears on pointer, touch, or keyboard interaction.
- Soundtrack source data: `public/wolves-playlist.json` and its updater.
- Back catalogue: source playlist metadata and
  `scripts/update-back-catalogue.js`.
- Wallpaper content: `public/img/wallpapers/wolves/` and curated values in the
  generator.

Use exact user-supplied or recovered authored copy. Never invent lore, dialogue,
quotes, names, scientific facts, pairings, or provenance.

The Reza Jelveh portrait in “7 Days to the Wolves” (show numbering Track 1,
segment index 0) is a locked 8.16-second hold. The top title
uses “HAMI brings Bazzite to the KubeCon stage, Amsterdam, 2026” for that
entire same player-clock window.

## Later-track gallery policy

**Two track numbering schemes exist. Do not conflate them.**

- *Show numbering* (used in this section and in Wolves content docs): Track 0 is
  the Destiny intro, Track 1 is “7 Days to the Wolves”, Track 2 is “Ghosts In
  The Mist”, and so on through Track 7, “Last Ride of the Day”.
- *Segment numbering* (used by `CINEMATIC_SEGMENTS`, `store.segmentIndex`, and
  the comic reader's `trackIndex`): index 0 is “7 Days to the Wolves”, index 1
  is “Ghosts In The Mist”, through index 6. Chapter labels run PART I..PART VII.

The intro is the offset: show Track *n* is segment index *n − 1*. State which
scheme is in play whenever a number could be read either way.

The cinematic is **seven musical parts**, and they line up 1:1 with the first
seven authored tracks in `public/wolves-playlist.json`. See
[`wolves-transport-and-clocks.md`](wolves-transport-and-clocks.md) for why that
alignment is still not an addressing scheme, and for the deletion that once
broke it.

In show numbering: Track 2 opens with the single Jorge Castro hero plate and its
48.4-second quote sequence. After that opening, and for Tracks 3–7, use only the
curated Flickr CNCF contributor-summit gallery. Do not carry Track 1 hero or
local people images into later authored Wolves tracks.
`.github/workflows/update-content.yml`
rebuilds `public/flickr-photos.json` weekly from scratch from the configured
summit albums in `scripts/flickr-curation.json`; KubeCon + CloudNativeCon Japan
2026 is the first/current source album and must remain included.

## Locked layers

Keep incoming signals, thesis data, lore records, and later-track chat data in
their existing layers. `src/data/wolves-thesis-sequence.ts` and
`src/data/wolves-narrative-timeline.ts` are locked authored data unless the user
explicitly authorizes a timing change.

## Generated files

Never hand-edit:

- `src/components/wolves/wallpapers-list.ts`
- `public/experiences/catalogue.json`
- generated artwork under `public/experiences/`

Change source inputs and run the owning generator.

## Verification

Run the relevant typecheck, tests, and build. For intro, soundtrack, slideshow,
timeline, or player-synchronized content, verify the affected timestamps with the
Wolves browser flow and real player. For lore deletions, open `/wolves/` in
Chromium and assert the page has rendered text with no `pageerror` events; a
successful build does not prove eager lore loading succeeds.

For any transport, buffer, or player change, verify the **intro** and the
**cinematic** as separate phases. The cinematic buffers are prewarmed while the
intro is on screen, so a defect that only affects that window is invisible to a
harness that skips straight to the show — a track once played over the entire
opening with the gate, the build, and the movie-flow harness all green. See
`docs/skills/validation/SKILL.md` for the harness list.

Finish with `docs/skills/validation/SKILL.md` before any production claim.

## Presentation rules

These are the rules that keep the show readable from theater seats. They are
derived from real failures on this route, not preferences.

- Wolves is a passive presentation. Do not require, offer, or depend on
  pointer, click, touch, keyboard, or scrolling interaction to follow its
  narrative text. The renderer must pace and reveal the complete story itself.
- Use a noninteractive paged renderer for chatlogs and quotes: show one
  complete sentence- or word-bounded readable beat, retain the speaker header
  on continued chat beats, then automatically type, hold, and replace it.
  Never accumulate important text behind an overflow viewport.
- All nine lore views share one panel (`lore-dossier.scss`), one metadata block
  (`LoreRecordHeader.vue`), one page model (`lore-pages.ts`) and one
  container-relative type scale. No lore surface scrolls or pans, and no view
  carries its own card chrome, footer telemetry, or body font size.
- Every Wolves presentation image is single-use. Do not schedule duplicate
  assets in the opening “7 Days to the Wolves” slide schedule (segment index 0,
  the comic reader's Track 0) or repeat one of its images in carry-forward
  tracks.
- The active media-player clock remains the only synchronization clock.
- A chat completion event may hold its active record on screen, but it is a
  display lifecycle gate, not a second clock: when it releases, resume from
  the latest player-clock record without replaying elapsed content.
- Reading cadence must not compress to fit a short timeline slot; a chat or
  quote page holds for its full reading cost, and a slot never shows a page it
  cannot hold.
- Preserve locked narrative anchors exactly and allocate only unlocked intervals.
- Use invariant tests for recomputed intervals: completeness, uniqueness, ordering, contiguity, anchor preservation, and readability minimums.
- Do not call an abandoned experiment restored. State which source is active and what was actually changed.
- For accessibility, expose complete active lore text at the article level; do not announce every typed character through a live region.
- Verify short and long records in Chromium, not only with unit tests or a build.

## The time budget is real

Every unlocked lore record is allocated a slice of a fixed musical window.
`estimateLoreReadDuration()` states what a record needs; `allocateLoreSlots()`
divides what the music actually has. When authored content exceeds the window,
the allocator does not warn — it silently compresses slots, and records past the
end of the window never appear on screen at all.

Before adding or lengthening any record, compare the total authored cost of its
range against that range's real duration. Adding words to a full window removes
other words from the show.

That overflow has been resolved by cutting records, not by rescheduling. Eleven
artifacts are held in `hiddenFromWolvesVideoArtifactIds`
(`src/data/wolves-narrative-timeline.ts`) under "Oversubscribed: cut to let the
surviving records play in full." With those hidden, every remaining slot is at
or above its `estimateLoreReadDuration()` ideal and nothing is truncated; the
schedule currently carries a small surplus rather than a shortfall.

That surplus is the entire safety margin. Restoring any hidden record, or
lengthening a surviving one, pushes `allocateLoreSlots()` out of its
proportional-bonus branch and into silent compression — and the caller
(`allocateRange()`) discards the `minimumDuration` the allocator reports, so
nothing downstream can detect it. Which records play is an owner decision, not
an agent decision. Do not "fix" a shortfall by shrinking type, speeding the
typewriter, or lowering the readability minimum.
