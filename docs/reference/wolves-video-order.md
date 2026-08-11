# Wolves video order

The show is a sequence of videos. Ordinals in this table are what "the first
video" means — nothing else in this repository defines that phrase, and agents
have repeatedly audited the wrong artifact because of it.

**When you are asked about "video N" or a timestamp, resolve it here first, then
say in your report which file and which timestamp you inspected.**

## Running order

| # | Video | What it is | Data owner | How to play it |
|---|---|---|---|---|
| 1 | **Prologue** — The Gardener and the Winnower | Scored Gayane Ballet Suite (Adagio) narration over the approved Destiny concept-art montage, ending on the Collapse and the title card. Silent narration, no dialogue. | `src/data/wolves-directors-cut-intro.ts` (`buildDirectorsCutPrologueSegment()`) | `/wolves/` → the **Director's Cut** button |
| 2 | **Destiny** | The Ikora-voiced Destiny trailer the prologue hands off to. | `src/data/wolves-directors-cut-intro.ts` (`buildDirectorsCutDestinySegment()`) | continues from video 1 |
| 3 | **Wolves** — "7 Days to the Wolves" | The comic reader, the lore column and the thesis overlay, on the Nightwish track. Show Track 1; segment index 0. | `src/data/wolves-track-zero-*.ts`, `src/data/wolves-narrative-timeline.ts` | continues from video 2 |
| 4 | *(in review)* | A video the owner is opening a PR for as of 2026-08-10. Fill this row in when it lands rather than renumbering around it. | — | — |
| 5 | **Ghosts In The Mist** | First of the later authored tracks; opens on the Jorge Castro hero plate and its 48.4s quote sequence. Segment index 1. | `src/config/wolves-cinematic.ts` | continues from video 4 |
| 6+ | The rest | Tracks 3–7 in `CINEMATIC_SEGMENTS` order, on the curated Flickr gallery. | `src/config/wolves-cinematic.ts` | continue in order |

Ordinals here are **video numbering** and are a third scheme on top of the two in
[`wolves-runtime.md`](wolves-runtime.md) ("Later-track gallery policy"). They do
not line up:

- Video 1 and 2 are the Director's Cut intro; neither is a "track".
- Video 3 is show Track 1 and segment index 0.
- Video 5 is show Track 2 and segment index 1.

Say which scheme you mean every time a number could be read either way.

## Which checkout owns which video

Videos 1 and 2 do not exist on `main`. Reading `main` and reporting that the
prologue is missing is a false negative, not a finding.

| Branch / worktree | Owns |
|---|---|
| `main` | Videos 3, 5, 6+ and all shared runtime |
| `wolves-directors-cut` | Videos 1 and 2 — the prologue and the Destiny handoff |
| `wolves-directors-finale` | The Director's Cut finale |
| `wolves-directors-trackzero` | Director's Cut cut boundaries for video 3 |
| `wolves-scene-library` | The curated silent scene masters under `recordings/wolves-scenes/` |

## What is on screen at a timestamp

Do not hand-simulate the mark grid, and do not screenshot nearby seconds and
infer. Both have failed here: one session probed 263s, 266s and 320s and stepped
straight over the 281s cue the owner was asking about, then reported the
timestamp as checked.

Ask the show:

```bash
node scripts/wolves-cue-at.mjs 4:41        # defaults to the prologue
node scripts/wolves-cue-at.mjs prologue 281
node scripts/wolves-cue-at.mjs prologue --all
```

It loads the authored modules through Vite, so it reads the same data the app
does and cannot drift from it. It reports the cue window, the exact text, its
word and line counts, the longest line, the emphasis, and whether the words are
still up at the second you asked about — a cue's *shot* outlives its *text*, so
"the shot contains 4:41" and "words are on screen at 4:41" are different
questions.

Only the prologue is registered so far. Add a video to the `VIDEOS` table in the
script when its data becomes addressable, rather than growing a second lookup.

## Reporting a timestamp defect

Quote the tool's output. A report that names a timestamp without the cue text at
that timestamp has not been verified, and this show has lost days to exactly
that.
