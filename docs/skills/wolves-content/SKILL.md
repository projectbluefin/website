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

"The first video" is the Director's Cut prologue. The running order and source
ownership are in `../../reference/wolves-video-order.md` — read it before
opening a file for any request naming a video ordinal or a timestamp.

Answer "what is on screen at m:ss" with the show's own data, never by eye:

```bash
node scripts/wolves-cue-at.mjs 1:50
```

Screenshotting the seconds *around* a reported timestamp is not verification.
Quote the cue text in your report. A cue's shot outlives its text, so "the shot
contains 1:50" and "words are on screen at 1:50" are different questions; the
tool answers the second.

## Red Flags

- A `.vue`, style, or runtime synchronization file changes.
- Authored prose is generated or summarized.
- A generated manifest is hand-edited.
- Text moves between signal, thesis, lore, and chat layers.
- A video ordinal or timestamp is answered without `scripts/wolves-cue-at.mjs`.
- Downloaded artwork is trusted by its URL or host instead of verified as the
  claimed format: the Wolves playlist generator writes any response to a fixed
  `.jpg` path, so the downloaded bytes must be checked (JPEG start marker), not
  the URL extension or the host allow-list that only gates which hosts are hit.

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
| "The vision model scored the pool, so its top picks are vetted." | Roughly one in five model top picks mislabels what is literally in the frame; use the scores to narrow the pool, then confirm every finalist by eye before it enters a registry. See [`references/galleries-and-artwork.md`](references/galleries-and-artwork.md). |
| "The rejection criteria are obvious, so the scoring pass can start." | A wrong disqualifying criterion silently discards the best material and the scores look plausible either way; confirm the criteria with the owner before an expensive pass. |
| "This asset has no source page, so a plausible upstream URL will do." | A fabricated link is read as verified evidence by the next agent; record the gap as `provenance: 'owner-supplied-local'`. See [`references/licensing-and-provenance.md`](references/licensing-and-provenance.md). |

## Detail

Load only the reference the change needs.

| Reference | Covers |
|---|---|
| [`references/projection-typography.md`](references/projection-typography.md) | Paging at thoughts, measure caps, photo fitting, overlay contrast, readability inside a locked range. |
| [`references/galleries-and-artwork.md`](references/galleries-and-artwork.md) | Gallery pools, photo sourcing and model-assisted curation, captions, hero labels, wallpaper numbering. |
| [`references/licensing-and-provenance.md`](references/licensing-and-provenance.md) | Third-party asset rights, including the Bungie fan-content guidelines, and recording provenance gaps honestly. |
| [`references/video-and-scene-work.md`](references/video-and-scene-work.md) | Source clips, keep ranges, encoders, reusable silent scene masters. |
| [`references/directors-cut-intro.md`](references/directors-cut-intro.md) | Composing either intro variant, and keeping content out of the standard show. |


## `/wolves/` is the teaser; the show is `/wolves/experience/`

`wolves/index.html` mounts `WolvesTeaserApp.vue`: the recreated trailer and the
back-catalogue album strip. The cinematic presentation is
`wolves/experience/index.html`, registered as the `'wolves/experience'` rollup
input in `vite.config.ts`. Moving an entry point means updating the vite inputs
and `../../reference/wolves-runtime.md` together.

Teaser album cards deep-link into the show: `/wolves/experience/?album=<id>`
makes `WolvesApp` fetch `catalogue.json`, resolve the id, and launch that
experience; an unknown id falls back to the lobby.

Donation surfaces were removed at the owner's direction — the org-ads strip
(`WolvesOrgAds.vue`, `wolves-org-ads.ts`, its test, the QR SVGs and the
`generate-qrs.js` wiring) is deleted, including its mount in
`CinematicStage.vue`. `WolvesQrCodes.vue` is misnamed: it is a Chromecast
launcher, not donation, and stays.

Trailer copy, plate windows, composition, iframe geometry and the mark
treatments belong to [`../wolves-teaser/SKILL.md`](../wolves-teaser/SKILL.md).
Load it rather than restating it here.

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
