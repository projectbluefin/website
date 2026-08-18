---
name: guardian-character-cards
description: Use when adding, updating, or regenerating Wolves guardian character cards, their share pages, or the lobby character gallery manifest.
---

# Guardian character cards

## Overview

`scripts/guardian-cards/` generates the Destiny-styled character cards under
`public/wolves/characters/`: one 1200×630 Open Graph card PNG per guardian, a
share page per guardian that forwards to that guardian's scene in the official
Bungie trailer on YouTube, and the `characters.json` manifest that
`WolvesCharacterGallery.vue` renders on the Wolves lobby.

Canonical share URL shape: `https://projectbluefin.io/wolves/characters/<slug>/`
(`wolves.projectbluefin.io` 301s to `/wolves/` and drops the path).

## When to Use

Use when adding a new guardian, changing a guardian's plate copy or scene
timestamp, or regenerating cards, share pages, or the gallery manifest.

## When NOT to Use

Do not use for other Wolves content (`wolves-content/SKILL.md`) or for changing
the gallery component's design (`design-gate/SKILL.md`).

## Legal Conditions

Cards use frames from official Destiny trailers under Bungie's fan-content
policy (<https://help.bungie.net/hc/en-us/articles/360049201911>). Every card
and share page must stay compliant:

- Non-commercial community use only; never behind payment or ads.
- Transformative: plates, theming, and composition over raw frames — never
  publish an unmodified trailer clip or frame alone.
- Keep the disclaimer on cards, share pages, and the gallery: "Destiny 2 ©
  Bungie, Inc. Fan-made, non-commercial community art — not affiliated with or
  endorsed by Bungie."
- Deep links point to the official YouTube uploads, never re-hosted video.

## Core Process

1. Add or edit the guardian's entry in `scripts/guardian-cards/characters.json`
   (slug, label, class, name, title, videoId, videoTitle, sceneTime, linkTime,
   optional trustee/leader flags and dino bond).
2. Capture the scene still: `node scripts/guardian-cards/capture-scenes.mjs
   [slug ...]`. Stills land in `scripts/guardian-cards/scenes/` (gitignored;
   re-capturable). Pick `sceneTime` a few seconds after any in-video overlay
   fades; the tool seeks 6 s early and screenshots while playing.
3. Generate outputs: `node scripts/guardian-cards/generate.mjs [slug ...]`.
   Writes `public/wolves/characters/<slug>.png`, `<slug>/index.html`, and
   refreshes `characters.json` (the public gallery manifest) for all entries.
4. View the rendered PNG and confirm the plate copy and scene read well.
5. Commit the changed files under `public/wolves/characters/` plus any
   manifest/tooling edits with explicit paths.

## Renaming the person on a card

A guardian's name is not a single string. Renaming one touches four kinds of
reference, and the difference between them decides what is safe to change:

| Kind | Example | Rename it? |
|---|---|---|
| Displayed name | `characters.json` `name`, the intro cue text | **Yes** — this is the rename |
| Cross-file join key | `wolves-guardian-dinosaur-bonds.ts` `guardianName` | **Yes, in the same commit** |
| Published identifier | the card `slug` | **No** — see below |
| Internal key | the lore record id and its filename | Safe, if the manifest moves with it |

**The bond lookup is an exact string match against the cue text.** The overlay
resolves a guardian's dinosaur companion by matching `guardianName` against the
name rendered on the plate, so renaming the cue text without renaming the bond
silently drops the companion plate — with no error and no failing type check.
Change both together.

**A slug is a published URL.** `slug` appears in
`https://projectbluefin.io/wolves/characters/<slug>/` and in the generated
`<slug>.png` and `<slug>/index.html`. Renaming it breaks every shared link that
already exists, so keep the slug stable and let it disagree with the displayed
name. The same applies to companion identifiers and artwork filenames
(`bob-torosaurus`, `bob-torosaurus.webp`): they are keys, not copy, and no
audience-facing text derives from them.

**Finish the rename in the generated output.** The name is baked into the card
PNG, so `characters.json` alone leaves the share page and its OG image showing
the old name. Regenerate (`capture-scenes.mjs` then `generate.mjs <slug>`) —
and note that capture needs a browser that can actually play the source video,
which a codec-limited Chromium cannot.

## Red Flags

- Hand-editing files in `public/wolves/characters/` — they are generated.
- A card without the Bungie disclaimer line.
- Share page URLs referencing `/wolves/social/` (the retired path).
- Committing `scripts/guardian-cards/scenes/` stills.
- Adding monetized or affiliate destinations to card links.
- A rename that changes the displayed name but not
  `wolves-guardian-dinosaur-bonds.ts`, or that changes a `slug` that is already
  published.
- A placeholder entry with `videoId: "TODO"`. It breaks both generator stages:
  `capture-scenes.mjs` navigates to `?v=TODO`, and `generate.mjs` then exits
  non-zero on the missing still. An absent record is better than one that stops
  the generator.

## Verification

- `node scripts/guardian-cards/generate.mjs <slug>` exits cleanly and the PNG
  looks correct.
- The share page redirects to the right YouTube timestamp in Chromium via
  `npx vite preview`.
- The lobby gallery at `/wolves/` shows the new card
  (`WolvesCharacterGallery.vue` fetches the public manifest at runtime).

## References

- `scripts/guardian-cards/characters.json` — source-of-truth manifest.
- `src/components/wolves/WolvesCharacterGallery.vue` — lobby gallery.
- `src/components/wolves/WolvesIntroOverlay.vue` — authoritative plate design
  the card template mirrors.
- `docs/skills/wolves-content/SKILL.md`, `docs/skills/validation/SKILL.md`.
