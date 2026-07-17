---
name: wolves-content-maintenance
description: Use when adding or editing Wolves page content - lore records, incoming-signal lines, playlist tracks, wallpaper slides, characters, or dinosaurs - on the Seven Days to the Wolves teaser page. Enforces the content-vs-design boundary now that the design is frozen.
metadata:
  context7-sources:
    - /websites/developer_spotify
---

# Wolves Content Maintenance

The Wolves page (`/wolves`) reached final production design. The canonical reference is `docs/wolves-maintenance.md`. This skill routes agents to it and enforces its core rule.

**Agents edit content. Agents never edit design.**

## When to Use

- Adding a lore entry, character, dinosaur, guardian bond, or location dossier.
- Editing top-bar incoming-signal lines (`src/data/wolves-incoming-signal.txt`).
- Adding, swapping, or fixing metadata for soundtrack tracks (`public/wolves-playlist.json`).
- Adding or removing slideshow images under `public/img/wallpapers/wolves/`, including optional per-slide theater-caption descriptions in `curatedDescriptions` (`scripts/generate-wallpapers.js`).
- Swapping, adding, or removing entries in the Creator Shorts interstitial video list (`src/data/wolves-creator-shorts.ts`) — see "Creator Shorts Interstitial" in the reference.
- Any user request that mentions the Wolves page, lore, thesis, soundtrack, or slideshow.

## When NOT to Use

- Explicitly authorized design work approved by the repository owner (rare; requires the verification regime in `.github/copilot-instructions.md`).
- Pages other than `/wolves`.

## Core Process

1. Read `docs/wolves-maintenance.md` before touching anything. It names every region, lists locked and open surfaces, and gives the exact pattern for each content addition.
2. Confirm the requested change lands entirely on an open surface (see the Open Surfaces table in the reference). If it requires a locked surface, stop and tell the user.
3. Apply user-supplied text verbatim. Never generate fiction, chapter names, or creative prose (see `docs/skills/editorial-policy.md`).
4. Keep the four authored content layers separate: Track 0 incoming-signal communications (`wolves-incoming-signal.txt`), Track 0 thesis overlay (`wolves-thesis-sequence.ts`, locked), Track 0 lore column (`src/data/lore/*.md`), and Parts II-VII team chat (`wolves-team-chats.ts`).
5. Treat intro copy as a 10-foot theater experience: retain theater-readable type, use user-authorized line breaks and cue splits for long copy, and keep `dominant` cues more forceful than standard cues. Do not make text smaller to fit. Follow Nielsen Norman Group's TV/10-foot UX guidance for large type, strong contrast, and clear hierarchy.
6. For an explicit owner-authorized fixed slide window, put the identifier and interval in `src/data/wolves-track-zero-slides.ts`; add independent reorder, rendered-boundary, and player-progress assertions. Do not turn a generated-order coincidence into an undocumented lock.
7. For post-hero Flickr galleries, use one complete Fisher-Yates shuffle across songs 2 onward. Do not group, rotate, or reuse photos. Preserve Track 0's authored schedule and locks.
8. Run the "Before You Commit" checklist in the reference: diff confined to open surfaces, lint/typecheck/test/build green, `public/dakota-versions.json` unstaged, real-player timestamp verification for timeline-adjacent edits.
9. After pushing, confirm the pushed SHA's "Deploy to GitHub Pages" workflow succeeds before reporting completion.
10. Do not add Spotify Web Playback SDK audio to any Wolves state that drives visuals, including the Track 0 slideshow, thesis, HUD, lore, intro, or interstitial. Spotify prohibits synchronizing recordings with visual media. Stop and obtain a provider-approved audiovisual arrangement before planning such work.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This tiny style tweak makes the new content fit better." | Style is a locked surface. Split long text across timestamps or ask the user; never adjust design to fit content. |
| "The component needs one extra class for my new record kind." | New record kinds are design work and require explicit owner approval. Existing kinds cover all routine additions. |
| "I can write placeholder lore that fits the tone." | The user authors all fiction. Placeholders are standard lorem ipsum only. |
| "The build passed, so the change is verified." | A green build is not verification. Seek the real Track 0 player at affected timestamps and check the live deploy. |
| "The deterministic shuffle already places this slide correctly." | Generated order is not a timing lock. An owner-authorized fixed window needs explicit data plus independent browser assertions. |
| "Photos need event buckets to make the gallery diverse." | The owner selected a simple full-pool shuffle. Do not introduce event grouping or rotation. |
| "Spotify playback can drive the same progress events as YouTube." | Wolves progress drives visual media. Spotify's Web Playback SDK policy prohibits synchronizing recordings with visual media. Do not implement this integration. |

## Red Flags

- A diff touching any `.vue`, `.scss`, or generated file for a content request.
- Text moved between incoming-signal, thesis, lore, and team-chat layers.
- Reordered lore, music, or timeline entries without explicit user instruction.
- Hand-edits to `src/components/wolves/wallpapers-list.ts` (generated) or thesis constants.
- Adding or changing the theater-caption rendering mechanism itself in `WolvesComicReader.vue` (it already exists; only the `curatedDescriptions` text content is an open surface).
- A timing-sensitive slide that remains positioned only by generated-array order.
- A post-hero gallery implementation that groups or rotates photos.
- Spotify Web Playback SDK progress routed into Wolves visual, timeline, or interstitial state.
- Emojis or ellipses introduced anywhere.

## Verification

- [ ] `git diff --stat` shows only open surfaces from `docs/wolves-maintenance.md`.
- [ ] `npm run lint:fix`, `npm run typecheck`, `npm run test:run`, `npm run build` all pass.
- [ ] All added prose came verbatim from the user or recovered authored sources.
- [ ] Timeline anchors (0:00, 150-220, 398-425) and thesis text are byte-identical.
- [ ] Each owner-authorized fixed slide window has ordering, rendered-boundary, and player-progress assertions.
- [ ] Later-track gallery assertions show a non-repeating shuffled sequence.
- [ ] After renaming or converting any Track 0 people asset, regenerate `wallpapers-list.ts` and recalculate finale-photo browser checkpoints. The generator sorts filenames, so an extension change can alter the deterministic finale shuffle even when the image content is unchanged.
- [ ] Affected Track 0 timestamps verified on the real player; deploy workflow for the pushed SHA succeeded.
- [ ] Any proposed Spotify integration was checked against the current Web Playback SDK policy; synchronized Wolves audiovisual playback was rejected.

## Sources

- Spotify Web Playback SDK policy notes, verified through Context7: `/websites/developer_spotify`.
