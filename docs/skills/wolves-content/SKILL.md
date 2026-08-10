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

Director's Cut keep ranges in `buildDirectorsCutVideoSequence()` stay on the
source video's native clock. `startOffset` is the exact source start timestamp
in seconds, `maxDuration` is the exact source end timestamp in seconds, and any
overlay cue windows on those segments stay absolute too — do not rebase them to
segment-relative `0`, or the authored source timing and tests drift.
Use `~/Videos/` as the shared local scratch space for source clips and previews
the owner needs to review. Keep future video work together there, use the
owner-requested tag, and do not invent a repository media directory or a
separate scratch location. Treat owner-renamed filenames as storyboard IDs:
preserve them verbatim and use them when referring to the corresponding clip.

When an owner asks to maximize a storyboard clip's quality, use its filename's
YouTube ID and embedded keep range as the index. First list the available
formats, then download the highest native video stream into the existing
`sources/` directory; do not upscale the low-resolution storyboard derivative
or replace it:

```bash
yt-dlp -F "https://www.youtube.com/watch?v=<storyboard-id>"
yt-dlp -f <selected-video-format> \
  -o "sources/<storyboard-id>.%(ext)s" \
  "https://www.youtube.com/watch?v=<storyboard-id>"
```

Trim the downloaded source with the original, absolute keep ranges. A
constrained social output should downscale from that native source, while a
master retains its native dimensions.

Before rendering an H.264 review artifact, verify the selected FFmpeg binary
offers `libx264`:

```bash
ffmpeg -encoders | grep 'libx264'
```

Some system FFmpeg builds omit external encoders. If that probe is empty, list
available FFmpeg binaries with `which -a ffmpeg` and use a binary that reports
`libx264`; do not silently replace the requested codec with a different one.
Use `-c:v libx264` explicitly in the render command.

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

Approved third-party intro art ships as an explicit allowlist, not as ad-hoc
URLs inside a sequence builder. Store the files locally at
source geometry under `public/wolves-intro/<collection>/`, then register every
approved image in a data ledger with its stable id, local path, artist, work
title, authoritative source URL, exact upstream asset URL, retrieval date,
policy URL, and usage basis. `src/data/wolves-directors-cut-intro.ts` consumes
that registry in its own order, and a test keeps the standard intro free of
those ids and local paths.

Registry entries, not ad-hoc cue literals, own accessible provenance for
approved intro art. Store a `backgroundFigure` object on each registered
artwork using the shared exact credit constant plus a per-artwork label, then
have `IntroOverlayTextCue.backgroundFigure` consume that registry field instead
of retyping it in the sequence. If an approved source does not name an
individual artist, set `artist: null` and record an explicit uncredited state
with the rights holder/source rather than inventing a name.

Expose that credit through `aria-describedby`, not `aria-description`: the
latter is not part of stable ARIA (no accessibility-tree/API mapping in most
browsers, so assistive tech may never announce it), while `aria-describedby`
references a real, visually-hidden DOM node
(`WolvesIntroOverlay.vue`'s `.wolves-intro-overlay-visually-hidden` span) that
every screen reader resolves. Keep the visible design unchanged — this is an
accessible-name/description fix, not a layout change.

## Common Rationalizations

- "It is in an official press kit, so it is freely licensed." Availability is
  not a reuse license; record the governing policy and approved usage basis.
- "The audience will not notice one missing image." A late or failed image is a
  visible broken beat in an unattended theater show; validate every local asset.
- "A short quote can be paraphrased safely." Quotes and attribution are
  authored content; preserve exact verified wording or omit them.

## Red Flags

- A `.vue`, style, or runtime synchronization file changes.
- Authored prose is generated or summarized.
- A generated manifest is hand-edited.
- Text moves between signal, thesis, lore, and chat layers.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "These cut windows are short, so rebasing them from zero is simpler." | Director's Cut keep ranges are pinned to absolute YouTube source timestamps; rebasing them breaks playback timing and the intro timeline math. |
| "This overlay text is obvious enough to paraphrase." | Wolves content surfaces use exact supplied wording only; changing even a short overlay changes authored content. |
| "It is only intro data, so I don't need to update tests." | Intro segment ids and timestamps are contract data for store and overlay tests; pin them when they change. |

## Director's Cut does not share the standard intro's title-card quote slide

`buildIntroVideoSequence()` is the standard front-door intro: silent title-card
quote slide, then the Destiny trailer. The Director's Cut replaces that opening
with the Gayane Ballet Suite prologue, but it still ends with the same Destiny
trailer.

Do not build the Director's Cut by prepending the prologue to
`...buildIntroVideoSequence()`. That places the standard title-card quote slide
after the prologue, so the show appears to return to the opening after the first
song has already played. Instead, compose the Director's Cut from its own
opening segment plus the shared Destiny trailer segment, keeping the two intro
variants as sibling lists rather than a prefix plus a spread.

When either intro list changes, update the store tests that assert on segment
identity and duration rather than on segment count, since both variants now have
the same length.

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

## Sources

- Context7: `/addyosmani/agent-skills` (skill file structure and required sections)
- Context7: `/websites/ffmpeg_documentation` (encoder discovery and `-c:v libx264`)
- Context7: `/yt-dlp/yt-dlp` (format selection and output templates)

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

## Bungie fan-content guidelines are not an open asset license

Bungie's official policy supports some non-commercial fan-created media using
game imagery, but explicitly says the guidelines are not permission to use
Bungie intellectual property:

<https://help.bungie.net/hc/en-us/articles/360049201911-Intellectual-Property-and-Trademarks>

Do not describe Destiny press-kit downloads, screenshots, or concept art as
freely licensed. Bungie retains rights in game scenery and related assets, may
remove fan work, treats donation or monetary-support solicitation as
commercial, and requires permission for commercial use.

When the owner approves the fan-content-guidelines basis for a non-commercial
Wolves use:

- use an official Bungie source or the credited Bungie artist's primary
  portfolio;
- record the exact upstream URL, artist, work title, retrieval date, and policy
  URL in the owning source ledger;
- keep the source geometry and visible content; do not redraw, recolor, upscale,
  remove signatures, or substitute generated approximations;
- credit Bungie and the named artist without implying endorsement;
- stop if the presentation becomes monetized, donation-supported, merchandise,
  or otherwise commercial until written Bungie permission is recorded.

A download button proves availability, not redistribution rights. If an asset
has no authoritative source or the proposed use falls outside the approved
non-commercial fan-content scope, do not add it.

ArtStation asset URLs follow
`https://cdn{a|b}.artstation.com/p/assets/images/images/<id>/{large|4k}/<filename>?<timestamp>`.
The `/4k/` rendition is the largest publicly retrievable size (2200px wide, at
least for the Director's Cut's Mark Goldsworthy concept paintings) and is
preferred over `/large/` (1920px) when the brief calls for the largest
approved source; `cdna`/`cdnb` serve identical bytes for the same asset id, so
keep whichever subdomain the existing record already used to minimize diff.

Not every upstream URL in the artwork ledger is a stable download endpoint.
E1's `upstreamAssetUrl` is a signed, expiring gamespress.com CDN link
(`?otf=y&lightbox=y&sky=...` query parameters). It is retrieval evidence for
where and when the asset was obtained, not a link a future agent can fetch
again once it expires; the ledger's inline comment on that record says so.
Don't "fix" it by swapping in a different, unverified URL just to make it look
durable — record the instability instead.


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

## Registering content that must never reach the standard show

Some records exist only for the Director's Cut and must never be scheduled by
the standard timeline, which is a different guarantee than the existing
oversubscription cuts in `hiddenFromWolvesVideoArtifactIds` (see
[`../../reference/wolves-lore-timing.md`](../../reference/wolves-lore-timing.md)).
An oversubscription cut is reversible curation of records that *are* authored
for the standard show; a Director-only record was never authored for it at
all. Both currently live in the same exclusion set, so label each addition
with its own comment block naming its reason — a future reader must not
assume the whole set shares one cause, or "restore" a Director-only record
into the standard show believing it is an oversubscription fix.

The pattern for one owner-approved batch of Director-only records (the
nine-quote science/humanity panel, Task 6):

1. One Markdown lore file per record, same frontmatter shape and body
   convention as any other record of that `kind` (a `quote` record's body is
   the bare quote text, straight apostrophes, no wrapping quote-mark
   characters — the view renders its own decorative opening mark).
2. Register each in `loreManifest` (`wolves-lore-records.ts`) with the
   chapter id that marks them Director-only (`directors-cut` for this batch),
   not an existing story chapter.
3. Add every new id to `hiddenFromWolvesVideoArtifactIds`
   (`wolves-narrative-timeline.ts`) in its own labeled block. This is the
   entire mechanism that keeps the standard show unaware the records exist;
   nothing else needs to change for the standard show to stay correct.
4. `sourceUrlsByRecordId` (`wolves-story.ts`) accepts a source URL for any
   lore `kind`, not only `kind: 'source'` — register one entry per new record
   there too if the record has independently verifiable provenance.
4a. For a quote panel specifically, also register a typed evidence record per
   quote in `src/data/wolves-directors-cut-quote-evidence.ts`: attribution,
   work, edition/publication, locator, exact source URL, copyright status, and
   a `verificationConfidence` (`primary-print-scan` for a Google
   Books/archive.org page image of the physical edition,
   `primary-web-publication` for the author/org's own first-party web page,
   `official-secondary-reproduction` for an authoritative third party
   reproducing the passage without a print scan of their own). This is the
   single typed authority the sourceUrl tests compare against for exact
   values, not just URL shape — do not let `wolves-story.ts`'s map and this
   ledger's `sourceUrl` field drift to different URLs for the same id.
   Candidate quotes researched but not owner-approved for the ledger (in this
   batch: Dune and Tolkien excerpts) stay excluded — neither is public domain
   and no written estate permission was recorded.
5. Give the batch its own timeline module (`wolves-directors-cut-timeline.ts`)
   rather than teaching the standard scheduler about a second show. It reuses
   the existing `allocateLoreSlots()`/`estimateLoreReadDuration()` primitives
   unmodified; only the window boundaries and the records fed into them are
   new.

To size quote windows from approved musical sections rather than equal
arbitrary slices (a requirement, not a style preference — see "Timeline
oversubscription math" in
[`../../reference/wolves-lore-timing.md`](../../reference/wolves-lore-timing.md)),
partition proportionally to each window's own measured length using a
largest-remainder allocation (assign each window `floor(share)`, then hand out
the leftover items to the windows with the largest fractional remainders
first). This keeps the item count tied to what the music actually offers
instead of splitting a fixed list into equal groups regardless of the section
underneath them.

**Verify every reading-cost estimate against the real timing functions before
trusting it, never by hand.** A hand-computed estimate for the existing
missing-scientist bulletin (roughly 49.5s across 3 pages, by counting authored
paragraph blocks) was wrong by about 10 seconds and 4 pages against the real
`loreProsePages()`/`estimatePageSeconds()` output (59.500s across 7 pages),
because `splitOversizedBlocks()` further divides any block that does not fit
`PROSE_PAGE_CHARACTERS - BLOCK_OVERHEAD_CHARACTERS` into finer "readable
beats" — a per-paragraph count undercounts the real page count it produces.
Import and call the actual functions from a throwaway script (delete it
afterward; never commit it and never write it under `/tmp`) against the real
file content before committing to a window boundary, especially when a
window's margin over its ideal cost is the thing that decides whether new
content fits at all.
