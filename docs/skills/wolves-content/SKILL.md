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
2. Resolve any video ordinal or timestamp in
   `../../reference/wolves-video-order.md` before opening a file.
3. Match the request to an open content surface.
4. Use exact user-supplied or recovered authored copy.
5. Add manifest entries for new registered records.
6. Regenerate generated files with their scripts.
7. Run the relevant tests, build, and browser checks.

## Resolve the artifact before you audit it

"The first video" is the prologue, and videos 1 and 2 exist only on the
`wolves-directors-cut` branch. The running order and the branch map are in
`../../reference/wolves-video-order.md` — read it before opening a file for any
request naming a video ordinal or a timestamp.

Answer "what is on screen at m:ss" with the show's own data, never by eye:

```bash
node scripts/wolves-cue-at.mjs 4:41
```

Screenshotting the seconds *around* a reported timestamp is not verification: a
prior session probed 263s, 266s and 320s, never rendered the 281s cue in
question, and reported it as checked. Quote the cue text in your report. Note
that a cue's shot outlives its text, so "the shot contains 4:41" and "words are
on screen at 4:41" are different questions; the tool answers the second.

## Red Flags

- A `.vue`, style, or runtime synchronization file changes.
- Authored prose is generated or summarized.
- A generated manifest is hand-edited.
- Text moves between signal, thesis, lore, and chat layers.
- A video ordinal or timestamp is answered without `scripts/wolves-cue-at.mjs`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It is in an official press kit, so it is freely licensed." | Availability is not a reuse license; record the governing policy and approved usage basis. See [`references/licensing-and-provenance.md`](references/licensing-and-provenance.md). |
| "The audience will not notice one missing image." | A late or failed image is a visible broken beat in an unattended theater show; validate every local asset. |
| "A short quote can be paraphrased safely." | Quotes and attribution are authored content; preserve exact verified wording or omit them. |
| "These cut windows are short, so rebasing them from zero is simpler." | Director's Cut keep ranges are pinned to absolute YouTube source timestamps; rebasing them breaks playback timing and the intro timeline math. |
| "This overlay text is obvious enough to paraphrase." | Wolves content surfaces use exact supplied wording only; changing even a short overlay changes authored content. |
| "It is only intro data, so I don't need to update tests." | Intro segment ids and timestamps are contract data for store and overlay tests; pin them when they change. |
| "I checked the seconds either side, so the timestamp is fine." | A cue can sit entirely between two probes. Resolve it with the lookup tool and quote the cue text. |

## Detail

Load only the reference the change needs.

| Reference | Covers |
|---|---|
| [`references/projection-typography.md`](references/projection-typography.md) | Paging at thoughts, measure caps, photo fitting, overlay contrast, readability inside a locked range. |
| [`references/galleries-and-artwork.md`](references/galleries-and-artwork.md) | Gallery pools, photo sourcing, captions, hero labels, wallpaper numbering. |
| [`references/licensing-and-provenance.md`](references/licensing-and-provenance.md) | Third-party asset rights, including the Bungie fan-content guidelines. |
| [`references/video-and-scene-work.md`](references/video-and-scene-work.md) | Source clips, keep ranges, encoders, reusable silent scene masters. |
| [`references/directors-cut-intro.md`](references/directors-cut-intro.md) | Composing either intro variant, and keeping content out of the standard show. |

## Verification

- [ ] Diff contains only documented content surfaces.
- [ ] Authored copy is exact.
- [ ] Generated files were regenerated from source.
- [ ] Affected player timestamps were checked when applicable.
- [ ] `../validation/SKILL.md` is complete.

## Sources

- Context7: `/addyosmani/agent-skills` (skill file structure and required sections)
- Context7: `/websites/ffmpeg_documentation` (encoder discovery and `-c:v libx264`)
- Context7: `/yt-dlp/yt-dlp` (format selection and output templates)

