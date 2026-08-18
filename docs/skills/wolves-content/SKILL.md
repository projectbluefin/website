---
name: wolves-content
description: Use when editing Wolves lore, signals, characters, soundtrack metadata, gallery data, or approved images.
---

# Wolves content

## Overview

Maintain Wolves content without changing the frozen runtime design.

## When to Use

Use for lore, incoming signals, dinosaurs, guardian bonds, intro data, music
metadata, galleries, and slideshow assets.

## When NOT to Use

Do not use for components, templates, styles, controls, layout, animation,
player synchronization, or generated manifests.

## Core Process

1. Read `../../reference/wolves-runtime.md`.
2. Match the request to an open content surface.
3. Use exact user-supplied or recovered authored copy.
4. Add manifest entries for new registered records.
5. Regenerate generated files with their scripts.
6. Run the relevant tests, build, and browser checks.

For a visible WebP quality regression, compare the optimized asset with its
approved source at identical dimensions. Recover only demonstrated high-loss
PNG or screenshot derivatives as lossless WebP; do not upscale assets whose
source is already low resolution.

For Flickr-backed theater assets, retrieve the largest available Flickr
rendition (prefer 2048px, then 1600px, then the original) before encoding a
WebP derivative at high quality. Keep the existing local filename and do not
upscale when Flickr's original itself is below the target size.

When an official event album uses camera filenames instead of descriptive
titles, add its distinctive prefixes to `peopleFirst.allowPatterns`, run
`node scripts/update-flickr-photos.js`, and verify it adds photos before
claiming the presentation refresh is complete.

To re-source a local people asset whose Flickr identity is unknown, resolve
the album by title rather than guessing: the CNCF account is `143247548@N03`,
its albums index is client-rendered, so collect `/albums/<id>` links from that
page and read each album page's `<title>`. KubeCon + CloudNativeCon Europe 2026
is the Amsterdam album (`72177720332674037`). Album pages are server-rendered,
so `extractPhotosFromAlbumHtml()` from `scripts/update-flickr-photos.js` works
directly. That scraper returns a size-suffixed `secret` such as
`abc123_h`; request `{id}_{secret}.jpg` unchanged, because stripping the
suffix to build another size returns HTTP 410. Camera filenames encode the day
(`KC+CNC_EU_2603DD_Keynote_DK_NNN`), so filter on the day and session before
scanning. Match candidates by content, not title — a perceptual hash of the
local file plus a saturated-hue mask narrows hundreds of frames to a handful
for human confirmation. Confirm the chosen frame with the user before
replacing, then take the largest rendition from `/sizes/o/` and re-encode over
the existing filename so the generated wallpaper manifest stays unchanged.

For a dinosaur addition, use the registry, supplied artwork, and supplied lore
record. Do not invent names, scientific facts, pairings, or provenance.

## Red Flags

- A `.vue`, style, or runtime synchronization file changes.
- Authored prose is generated or summarized.
- A generated manifest is hand-edited.
- Text moves between signal, thesis, lore, and chat layers.

## Verification

- [ ] Diff contains only documented content surfaces.
- [ ] Authored copy is exact.
- [ ] Generated files were regenerated from source.
- [ ] Affected player timestamps were checked when applicable.
- [ ] `../validation/SKILL.md` is complete.

## References

- `../../reference/wolves-runtime.md`
- `../editorial-provenance/SKILL.md`
- `../validation/SKILL.md`
- `../wolves-runtime-engineering/SKILL.md`

## Pages break at thoughts, not at character counts

`splitReadableBeats()` splits on sentence punctuation and then on a character
budget. Left alone, that budget breaks wherever the count runs out — after
`Dr.`, or on a stranded preposition. Both happened in the closing bulletin and
between them they cut the show's central reveal into pieces.

`readable-beats.ts` guards this in three stages:

- `mergeAbbreviationSplits()` rejoins sentences split at a title's period.
- `fuseTitledNames()` fuses a title with the capitalised words after it into one
  unbreakable token, so "Dr. Andy Anderson" is laid out as a single unit.
- `settleBreaks()` repairs a page that ends on a dangling function word by
  moving the whole trailing phrase to the next page. It only touches pages that
  end badly; a page ending on a complete thought is already a good page.

The measurable target: **no page ends on a dangling function word.** At the time
of writing that holds for all 338 pages in the show.

When touching this file, verify no page overflows its budget afterwards. A fuse
that is too greedy silently produces pages too tall to read from the back row:

```bash
npx vite-node <probe that pages every record and compares against
PROSE_PAGE_CHARACTERS / CHAT_PAGE_CHARACTERS>
```

At the time of writing: 338 pages, zero over budget, zero ending on a dangling
word, worst page 150 characters against a 190 budget.

`src/tests/wolvesFinaleReveal.test.ts` asserts the dangling-word rule across
every record, so a greedy change to the splitter fails immediately.

## A photo that is the slide needs different fitting than a backdrop

`.wolves-intro-overlay-background` sets `object-fit: cover`. That is right for a
backdrop and wrong when the photo is the subject. Cover scales the image to fill
the frame and throws away whatever overflows, so a 3:2 stage photo in a 16:9
frame loses its top and bottom, which is exactly where a speaker's gesture and
headroom live.

`contain` fixes landscape but destroys portrait: in a tall phone viewport the
same photo shrinks to a stamp floating in black. Scope it:

- Default (portrait) keeps `cover` with `object-position` biased up the frame, so
  the crop lands on the subject rather than the ceiling.
- `@media (min-aspect-ratio: 4 / 3)` switches to `contain`. That is the projector
  case, and the pillarbox reads as intentional letterboxing on a dark stage.

Check both orientations. A landscape screenshot cannot show you the portrait
failure, and the portrait failure is the ugly one.

## Projected body copy is capped by measure, not by container width

The plate is as wide as the frame allows, but the text must not be. At `68rem`
of container the title card body ran to roughly 90 characters per line; an
audience tracks about 50 to 75. Cap the paragraph itself with `max-width` in
`ch` and centre it with `margin: 0 auto`, leaving the panel free to stay wide.

Add `text-wrap: balance` to the paragraph. Without it the last line collapses to
a one-word orphan, which is the most distracting artefact in projected text.

`balance` has a trap: Chromium applies it only to blocks of **six lines or
fewer** and silently falls back to normal wrapping above that. It costs nothing
and warns about nothing, so a beat that grows past six lines loses the balancing
without any visible signal in the source. If a paragraph outgrows that budget,
either split it into another beat or switch that rule to `text-wrap: pretty`,
which has no line cap but only tidies the last few lines.

Measure the result in the browser rather than trusting the CSS: divide
`getBoundingClientRect().height` by the computed `line-height` for the line
count, then divide the character count by that. Assert both the count and the
resulting characters-per-line for every beat at both orientations.

## An overlay panel can hold contrast without painting a box

A solid `background-color` plus a border plus a drop shadow reads as a lit UI
box sitting on top of the picture. To recede while staying legible, replace the
flat fill with a `radial-gradient` that falls off toward the panel edges, drop
the border and the shadow to `0`/`none`, and raise `backdrop-filter: blur()`.
Contrast then comes from the blur and the existing `text-shadow` instead of from
an opaque rectangle.

## Withhold a gallery image, do not delete it

`src/components/wolves/wallpapers-list.ts` is generated by
`scripts/generate-wallpapers.js`, which scans
`public/img/wallpapers/wolves/<subfolder>/` and turns every image it finds into
a slide. So any photo promoted to a dedicated moment, such as the opening title
card portrait, keeps appearing a second time as an anonymous gallery slide.

There are three wrong fixes and one right one:

- Hand-editing the generated list is reverted by the next generator run, and the
  file's own header forbids it.
- Deleting the file breaks the dedicated slide, which loads it by path.
- Moving the file out of the scanned tree works but scatters the show's assets
  across two conventions.

Use `RESERVED_FOR_DEDICATED_SLIDES` in the generator instead: a subfolder-keyed
set of filenames that `scanDirectory()` filters out. The file stays on disk for
its dedicated slide and is withheld only from the gallery. Re-run
`node scripts/generate-wallpapers.js` and confirm the slide count dropped by
exactly the number of names reserved.

Verify both halves: the entry is gone from the generated list, **and** the
dedicated slide still loads the image. Check `naturalWidth > 0` in the browser
rather than trusting the `src` attribute, because a missing file still leaves
the attribute intact.


## Allocating readability inside a locked range

- Fast music or slideshow slots must not accelerate ordinary chat typing; keep
  explicitly approved dialogue cadence anchors unchanged.
- For a locked chat window, use its full player-clock duration when it exceeds
  the minimum readability estimate. This retains the final sentence through
  the authored endpoint instead of releasing a couch-readable chat early.
- When a narrative range is constrained, allocate chatlog readability before
  static quote or source records; preserve explicitly approved cadence locks.
- Derive Track 0's rotating HUD queue directly from the authored plan and keep
  duplicate status lines; deduping breaks the approved finale cadence.


## The back catalogue draws one unweighted pool, not a curated-versus-CNCF mix

The eleven album experiences in `public/experiences/catalogue.json` share a
single slide pool, ordered by `src/data/back-catalogue-order.ts`:

| Pool | Source | Approx. |
|---|---|---|
| CNCF stream | `public/flickr-photos.json` plus locally mirrored CNCF files | 667 |
| Curated | `wolves/people/` portraits and lore | 77 |
| Showcase | `wolves/showcase/` | 33 |
| Mascot art | `wolves/wolves/` | 8 |
| Hero shots | `public/characters/` via `wolves-comic-hero-shots.ts` | 23 |

Three rules, applied as independent passes:

1. **No category weighting.** Curated slides are placed into gaps between CNCF
   slides, each gap equally likely. CNCF leads because it outnumbers everything
   else, never because the ordering prefers it.
2. **No two non-CNCF slides adjacent**, across the combined curated set. A
   screenshot followed by a dinosaur reads from the back row as "the photos
   stopped", so a per-category rule is not enough.
3. **No two consecutive CNCF slides from the same event.**

Two traps live here.

**Never satisfy an ordering rule by re-drawing.** Re-shuffling until a predicate
holds is rejection sampling: it biases the distribution and silently breaks rule
1 while appearing to enforce rule 2. Place correctly by construction, then
repair what remains in a single deterministic pass.

**Concatenation order is a preference.** Gaps are filled in ascending order, so
passing the pool as portraits-then-showcase-then-mascot-then-heroes put the
first dinosaur at slide 745 of 808 — a category bias created by array order
alone, invisible in every unit test that only checked membership. Shuffle the
curated slides before placing them, and verify by asking where the first slide
of the rarest category actually lands.


## The Bluefin monthly wallpaper numbering does not match upstream, and pair 11 exists nowhere

`public/img/wallpapers/bluefin-{01..12}-{day,night}.webp` (added by `cb85d6c6`,
registered in `src/data/artwork-wallpapers.ts`) are the Bluefin monthly set
from `ublue-os/artwork` `wallpapers/bluefin/`, but the numbering has traps:

- **Local 11 ≡ local 12, byte for byte.** Both are the December mammoth scene;
  pair 11 was mis-encoded as a copy of 12 at import time. Register only
  01–10 and 12 — importing 11 double-books December.
- **Upstream, #11 is now "Collapse - November"** (`fix: replace 11-bluefin
  with Collapse`, and `11-bluefin-day.svg` is byte-identical to
  `wallpapers/collapse/collapse-day.svg`). So "bluefin-11" means the mammoths
  on disk here but the dinosaur-and-asteroid Collapse artwork upstream. Verify
  any claim about this set against the local files, not the upstream index.
- **The Collapse artwork is not in the wallpaper pool at all.** It lives only
  in `public/wolves-intro/bluefin-collapse-{day,night}.webp`, driven by
  `wolves-intro-sequence.ts`. Nothing in `wallpapers-list.ts` references it.

First-party artwork registries (`artwork-wallpapers.ts`) carry `kind`
(`artwork`/`bazzite`), pinned source commits, and licence ids, and their
`name` prefixes are what `classifyCuratedSlide()` branches on. Aurora artwork
is excluded by the owner's permission decision, not by licence: the registries
are an explicit allowlist, and `backCatalogueOrder.test.ts` asserts no record
can reference an Aurora path or the four Aurora-origin `xe_*` duplicates.

The Bazzite press kit forbids modifying artwork ("including spacing, color,
elements, and scaling"). Format conversion at identical geometry (PNG -> WebP,
3940x2160 unchanged) is the compliant reading the owner approved; CI's
`calibreapp/image-actions` recompresses added images ~25% with no dimension
loss, which is expected.


## `wolves/people/` is hand-picked, and two thirds of it is CNCF photography

`wolves/people/` is the owner's selection for the Wolves catalogue. It is **not**
a CNCF mirror, and it is not all Bluefin work either: 136 of its 213 files came
from CNCF albums and kept source-prefixed filenames (`flickr-`, `cncf-`,
`kubecon-`) or `KC+CNC_...` export titles.

So provenance cannot be inferred from the directory, and it cannot be inferred
from whether the file is served locally. Both shortcuts credit someone else's
conference photography to Bluefin. Use `classifyCuratedSlide()`, which checks
the filename stem and the title, and key the on-screen credit on the resulting
`kind`.


## Gallery captions are derived, never invented, and may be withheld

Both feeds ship filenames rather than captions: photographer exports
(`KC+CNC_EU_240319_KCS_GroupPhoto_MN_001`), camera names (`0R0A9083`,
`PXL_20240720_181225593`), and Flickr ids (`Cncf 54927603143`). All of it was
rendered verbatim, at projection size.

`src/data/gallery-captions.ts` reads back only what the filename literally
encodes — event, region, session, date. Everything else is passed through
untouched, because authored titles are already correct.

When a title encodes nothing, **render no caption**. Do not guess, and do not
fall back to a bare timestamp: "July 2024" alone describes no subject and is
noise wearing a caption's clothes. Roughly 79 of 786 titles legitimately produce
no caption.

Verify against the real feeds, not fixtures. `public/flickr-photos.json` and
`wallpapers-list.ts` between them contain grammars no fixture will suggest —
a second photographer convention (`2024-06-06_OHSNAP_...`), wordplay that a
naive camel-case split mangles (`KuberTENes` becoming `Kuber TENes`), and room
codes (`BreakoutsB206`).


## Hero shot labels name the species, ids stay filenames

`wolves-comic-hero-shots.ts` renders each `label` as the slide title in the
back-catalogue reader (`WolvesComicReader.vue` maps `title: shot.label`) and as
`alt` text in the intro overlay, so a pose-derived label like "Youre Holding It
Wrong Post 1" projects a filename onto a theater screen. Labels are the
depicted species' scientific name from `wolves-dinosaur-species.ts`, falling
back to the genus alone when no epithet is recorded in the registry or the
source filename (`Dakosaurus`, `Dromaeosaurus`). Duplicate labels across poses
are expected — the label describes the animal, not the file.

Do **not** rename the `id` fields to match: ids must stay unique for slide
identity and dedupe, and ten of the 23 shots depict *Deinonychus antirrhopus*,
so species-derived ids would collide. Ids are pinned by
`src/tests/wolvesIntroOverlay.test.ts` (full set), `tests/wolves-intro-segments.mjs`
(`youre-holding-it-wrong-post1`, `nest`), and `tests/wolves-movie-flow.mjs`.

Identifying pose-named art (`angry`, `intrigued`, `leaping`, `nest`, `pride`,
`roaring`, the "You're Holding It Wrong" bookends, the PivotRaptor commission):
all of it is the Bluefin mascot. Git history says so (`331867c3` "Add
black-outlined bluefin nest", `3e033b7b` "Resize bluefins" touching
intrigued/leaping/roaring) and a visual check against `bluefin.webp` confirms
the shared design. View the WebP directly; files that fail the viewer
(>~300 KB) can be downscaled with `dwebp <file> -scale 512 512 -o out.png` into
a scratch dir you delete afterwards.

Relabeling exposes the authored order's same-species runs — slots 16–20 are
five consecutive *D. antirrhopus*, slots 10–12 all contain *A. giganticus*, and
22→23→(wrap)→1 is an all-*D. antirrhopus* run across the loop. The id-keyed
adjacency test cannot see this. Reordering is a design decision: report it,
never reshuffle the array to fix it.

## `shuffleWolvesGalleryPhotos` is a primitive, not a diversity mechanism

It is a bare Fisher-Yates. The event-diversity logic lives in
`src/data/wolves-gallery-cycle.ts`.

This matters because it has already gone wrong once: `33a63532` shipped the
event cycle, and `255f61fb` ("retime intro and shuffle galleries") deleted the
module and pointed the call site at the shuffle. The commit subject reads like a
refactor, nothing flagged the lost guarantee, and the catalogue quietly served
long same-event runs from then on. `src/tests/wolvesGalleryCycle.test.ts` now
pins the behaviour.

The cycle spreads each event across its own stratum of the run rather than
dealing round-robin. Round-robin only behaves when events are similar sizes; the
live feed has hundreds of single-photo events, and dealing every bucket once per
round put all of them in round one.


## `/wolves/` is the teaser; the show moved to `/wolves/experience/`

`wolves/index.html` mounts `WolvesTeaserApp.vue`: hero, the recreated trailer,
and the back-catalogue album strip. The full cinematic presentation moved
as-is to `wolves/experience/index.html`, registered as the `'wolves/experience'`
rollup input in `vite.config.ts`. Moving an entry point means updating the vite
inputs and `docs/reference/wolves-runtime.md` together.

Donation surfaces were removed at the owner's direction: the org-ads strip
(`WolvesOrgAds.vue`, `wolves-org-ads.ts`, its test, the QR SVGs, and the
`generate-qrs.js` wiring) is deleted, including the mount in
`CinematicStage.vue` and its assertion in `wolvesCinematicStage.test.ts`.
`WolvesQrCodes.vue` is misnamed — it is a Chromecast launcher, not donation —
and stays.

### Recreating a trailer from the destiny-vids cut list

The source of truth is the owner-authored record
`~/src/destiny-vids/stories/trailer-1-plates.json` — video id, exact duration,
and every plate's window and copy. Port it verbatim into
`src/data/wolves-trailer-plates.ts` and pin windows and copy with
`src/tests/wolvesTrailerPlates.test.ts`. Never reword plate copy; if the cut is
recut, re-port from the record instead of editing the website copy.

The player is a chromeless YouTube iframe behind a poster overlay; plate
overlays are polled against `player.getCurrentTime()` at 100 ms and the clock
is clamped at `TRAILER_DURATION_SECONDS` with a replay affordance.

Traps, all of which already cost a debugging cycle:

- `new YT.Player(div, …)` **replaces** the host div with the iframe — style it
  via `.frame :deep(iframe)` with `position: absolute; inset: 0`.
- An unresolved `var()` inside a `background` shorthand invalidates the whole
  declaration at computed-value time (silently transparent poster). Set shared
  image variables on a common ancestor, never on a sibling of the consumer.
- `wolves-cinematic.scss` sets the root font-size to ~10px, so `rem` widths are
  ~62.5% of what they read as (`78rem` ≈ 780px, not 1248px).
- YouTube rejects numeric loopback origins — test on
  `http://projectbluefin.io.localhost:5173/wolves/`, not `localhost`.
- A 2.39:1 frame is ~160px tall on a phone; the poster's kicker/title stack
  must collapse to the play button alone below ~640px or it overflows and
  overlaps the absolutely-centred button.

Teaser album cards deep-link into the show:
`/wolves/experience/?album=<id>` makes `WolvesApp` fetch `catalogue.json`,
resolve the id, and launch that experience; an unknown id falls back to the
lobby.

### Match the trailer's authored composition, not only its copy

The plate manifest carries timing and copy; the design and the three-picture
composition live in destiny-vids' card templates and builder. Teaser work has
its own procedure: load [`../wolves-teaser/SKILL.md`](../wolves-teaser/SKILL.md).
It preserves the picture/bridge/end-card boundaries, frame-relative sizing,
letter and mark treatments, iframe geometry, and the Tailwind inline-image
trap without turning this content skill into a runtime-engineering manual.

## Wire every generated feed into the weekly refresh

`update-content.yml` refreshed Flickr photos weekly while
`update:back-catalogue` was wired into nothing, so album metadata sat at
whatever a human last ran locally. A single regeneration then pulled six track
changes and replaced a `[ Redacted ]` subtitle that had been resolved upstream
long before.

The catalogue generator shells out to `yt-dlp`, which is unreliable from CI, so
the weekly job runs `--metadata-only`: album prose and cover art over plain
`fetch`, no scraping. It exits non-zero when an upstream album is missing from
the catalogue entirely, because that genuinely needs a human with `yt-dlp`.

When adding a generated feed, check it is actually scheduled. "There is a script
for it" is not the same as "it runs".
