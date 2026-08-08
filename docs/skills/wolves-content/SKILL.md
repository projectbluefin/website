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
