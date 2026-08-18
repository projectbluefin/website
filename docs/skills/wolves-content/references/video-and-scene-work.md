# Video and scene work

Source clips, keep ranges, encoding, and the reusable scene masters. Loaded from the `wolves-content` skill when producing or re-sourcing video.

Back to [`../SKILL.md`](../SKILL.md).

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

## References

- `../../../reference/wolves-runtime.md`
- `../editorial-provenance/SKILL.md`
- `../validation/SKILL.md`
- `../wolves-runtime-engineering/SKILL.md`

