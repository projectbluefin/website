---
name: wolves-content-maintenance
description: Use when adding or editing Wolves page content - lore records, incoming-signal lines, playlist tracks, wallpaper slides, characters, or dinosaurs - on the Seven Days to the Wolves teaser page. Enforces the content-vs-design boundary now that the design is frozen.
---

# Wolves Content Maintenance

The Wolves page (`/wolves`) reached final production design. The canonical reference is `docs/wolves-maintenance.md`. This skill routes agents to it and enforces its core rule.

**Agents edit content. Agents never edit design.**

## When to Use

- Adding a lore entry, character, dinosaur, guardian bond, or location dossier.
- Editing top-bar incoming-signal lines (`src/data/wolves-incoming-signal.txt`).
- Adding, swapping, or fixing metadata for soundtrack tracks (`public/wolves-playlist.json`).
- Adding or removing slideshow images under `public/img/wallpapers/wolves/`, including optional per-slide theater-caption descriptions in `curatedDescriptions` (`scripts/generate-wallpapers.js`).
- Any user request that mentions the Wolves page, lore, thesis, soundtrack, or slideshow.

## When NOT to Use

- Explicitly authorized design work approved by the repository owner (rare; requires the verification regime in `.github/copilot-instructions.md`).
- Pages other than `/wolves`.

## Core Process

1. Read `docs/wolves-maintenance.md` before touching anything. It names every region, lists locked and open surfaces, and gives the exact pattern for each content addition.
2. Confirm the requested change lands entirely on an open surface (see the Open Surfaces table in the reference). If it requires a locked surface, stop and tell the user.
3. Apply user-supplied text verbatim. Never generate fiction, chapter names, or creative prose (see `docs/skills/editorial-policy.md`).
4. Keep the three Track 0 content layers separate: top-bar comms (`wolves-incoming-signal.txt`), thesis overlay (`wolves-thesis-sequence.ts`, locked), lore column (`src/data/lore/*.md`).
5. Run the "Before You Commit" checklist in the reference: diff confined to open surfaces, lint/typecheck/test/build green, `public/dakota-versions.json` unstaged, real-player timestamp verification for timeline-adjacent edits.
6. After pushing, confirm the pushed SHA's "Deploy to GitHub Pages" workflow succeeds before reporting completion.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This tiny style tweak makes the new content fit better." | Style is a locked surface. Split long text across timestamps or ask the user; never adjust design to fit content. |
| "The component needs one extra class for my new record kind." | New record kinds are design work and require explicit owner approval. Existing kinds cover all routine additions. |
| "I can write placeholder lore that fits the tone." | The user authors all fiction. Placeholders are standard lorem ipsum only. |
| "The build passed, so the change is verified." | A green build is not verification. Seek the real Track 0 player at affected timestamps and check the live deploy. |

## Red Flags

- A diff touching any `.vue`, `.scss`, or generated file for a content request.
- Text moved between the top-bar, thesis, and lore layers.
- Reordered lore, music, or timeline entries without explicit user instruction.
- Hand-edits to `src/components/wolves/wallpapers-list.ts` (generated) or thesis constants.
- Adding or changing the theater-caption rendering mechanism itself in `WolvesComicReader.vue` (it already exists; only the `curatedDescriptions` text content is an open surface).
- Emojis or ellipses introduced anywhere.

## Verification

- [ ] `git diff --stat` shows only open surfaces from `docs/wolves-maintenance.md`.
- [ ] `npm run lint:fix`, `npm run typecheck`, `npm run test:run`, `npm run build` all pass.
- [ ] All added prose came verbatim from the user or recovered authored sources.
- [ ] Timeline anchors (0:00, 150-220, 398-425) and thesis text are byte-identical.
- [ ] Affected Track 0 timestamps verified on the real player; deploy workflow for the pushed SHA succeeded.
