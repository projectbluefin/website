# Wolves scene library

## Purpose

The scene library contains reusable silent video masters selected for later
Wolves video assembly. It is a media-production input, not a new runtime
playlist and not part of the live `/wolves/` player.

## Owners

- Authored source windows and overlay instructions:
  `scripts/wolves-scenes/scene-manifest.json`
- Reviewed visual exclusions and probed source metadata:
  `scripts/wolves-scenes/scene-decisions.json` and
  `scripts/wolves-scenes/scene-lock.json`
- Renderer and verifier: `scripts/wolves-scenes/render-scenes.js`
- Analysis/contact-sheet generator: `scripts/wolves-scenes/analyze-scenes.js`
- Final silent masters and assembly index: `recordings/wolves-scenes/`

Source videos are local production inputs. Keep them outside git under
`/var/tmp/website-agent/wolves-scenes/sources/`, named `<youtube-id>.mp4`.
The repository records their provenance and edits, not browser cookies,
credentials, or source-download machinery.

The selected FFmpeg binary must decode H.264 and AV1 and encode `libx264`.
Set `WOLVES_FFMPEG_BIN=/path/to/ffmpeg` when the host's default FFmpeg omits
patent-encumbered codecs.

## Boundary model

All timestamps in the manifest use the source video's native clock. Each
selection becomes one independently reusable MP4. A visual exclusion applies
to complete camera shots:

- face exclusions remove any shot where the face appears at any point;
- astronaut exclusions include reflections, silhouettes, distant figures, and
  partial helmet or body visibility;
- title-card exclusions begin and end on hard visual cuts.

The analysis command writes a contact sheet containing the first and last frame
of every retained range. Review that artifact before rendering final masters.

## Overlay metadata

Scene masters stay clean. Timed replacement titles and Guardian nameplates live
in `recordings/wolves-scenes/index.json` for a later approved assembler.
Overlay times are output-relative:

```text
overlay time = source time - retained selection start
```

The current authored overlays are exact owner copy:

- `Project Bluefin`
- Warlock nameplate: `Ahmed Adan`

Do not invent a subclass, honorific, affiliation, or additional lore.

## Commands

Generate the source lock and boundary review:

```bash
node scripts/wolves-scenes/analyze-scenes.js \
  --input-dir /var/tmp/website-agent/wolves-scenes/sources \
  --analysis-dir /var/tmp/website-agent/wolves-scenes/analysis
```

Prefix the command with `WOLVES_FFMPEG_BIN=/path/to/ffmpeg` when using an
alternate codec-complete binary.

Review:

```text
/var/tmp/website-agent/wolves-scenes/analysis/review.html
```

Print the complete render job list without writing media:

```bash
npm run render:wolves-scenes -- \
  --input-dir /var/tmp/website-agent/wolves-scenes/sources \
  --output-dir recordings/wolves-scenes \
  --dry-run
```

`WOLVES_FFMPEG_BIN` applies to both dry runs and real renders.

Render and verify every master:

```bash
npm run render:wolves-scenes -- \
  --input-dir /var/tmp/website-agent/wolves-scenes/sources \
  --output-dir recordings/wolves-scenes \
  --verify
```

The renderer uses accurate input seeking while transcoding, limits output with
`-t`, maps only `0:v:0`, disables audio with `-an`, encodes H.264 with
`libx264`, writes `yuv420p`, and enables MP4 fast start. It rejects outputs
that do not contain exactly one video stream and zero audio streams.

## Verification

- [ ] Every manifest source has a local input and probed lock record.
- [ ] Every visual review policy has exact resolved selections.
- [ ] The contact sheet confirms complete-shot boundaries.
- [ ] Every output is H.264 and preserves source dimensions and frame rate.
- [ ] Every output has one video stream and no audio stream.
- [ ] Output duration matches the authored selection within one source frame
  plus 20 milliseconds.
- [ ] `recordings/wolves-scenes/index.json` matches the rendered files.
- [ ] Every committed MP4 reports `filter: lfs` through `git check-attr`.
- [ ] No source video or `/var/tmp` artifact is staged.

## Source

- FFmpeg CLI options and accurate input seeking:
  Context7 `/websites/ffmpeg_documentation`
