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
- Swapping, adding, or removing entries in the Creator Shorts interstitial video list (`src/data/wolves-creator-shorts.ts`) — see "Creator Shorts Interstitial" in the reference.
- Any user request that mentions the Wolves page, lore, thesis, soundtrack, or slideshow.

## When NOT to Use

- Explicitly authorized design work approved by the repository owner (rare; requires the verification regime in `.github/copilot-instructions.md`).
- Pages other than `/wolves`.

## Core Process

1. Read `docs/wolves-maintenance.md` before touching anything. It names every region, lists locked and open surfaces, and gives the exact pattern for each content addition.
2. Confirm the requested change lands entirely on an open surface (see the Open Surfaces table in the reference). If it requires a locked surface, stop and tell the user.
3. Apply user-supplied text verbatim. Never generate fiction, chapter names, or creative prose (see `docs/skills/editorial-policy.md`).
4. Keep the three Track 0 content layers separate: top-bar comms (`wolves-incoming-signal.txt`), thesis overlay (`wolves-thesis-sequence.ts`, locked), lore column (`src/data/lore/*.md`).
5. Treat intro copy as a 10-foot theater experience: retain theater-readable type, use user-authorized line breaks and cue splits for long copy, and keep `dominant` cues more forceful than standard cues. Do not make text smaller to fit.
6. For an explicit owner-authorized fixed slide window, put the identifier and interval in `src/data/wolves-track-zero-slides.ts`; add independent reorder, rendered-boundary, and player-progress assertions. Do not turn a generated-order coincidence into an undocumented lock.
7. For post-hero Flickr galleries, use one complete Fisher-Yates shuffle across songs 2 onward. Do not group, rotate, or reuse photos. Preserve Track 0's authored schedule and locks.
8. For a provider-gated soundtrack, record only owner-reviewed exact catalog
   mappings in YouTube playlist order. Never use runtime search, fuzzy matching,
   or a substitute track; leave the Spotify catalog and manifest fields absent
   until every mapping and the owner-created playlist are approved.
   - Once the owner has supplied every exact mapping, run
    `SPOTIFY_CLIENT_ID=<public-client-id> npm run sync:wolves-spotify` locally.
    The command uses local PKCE; never provide, store, or print a client secret.
    Set `SPOTIFY_WOLVES_PLAYLIST_ID` after the initial public playlist is created.
   - The command must fail before authorization when any catalog mapping is absent.
    Keep approved per-track and playlist Spotify URIs when regenerating the
    YouTube manifest; do not accept a newly introduced YouTube video without
    its owner-reviewed URI.
9. Keep Spotify unavailable unless the reviewed catalog validates against the loaded
   YouTube manifest and produces a non-empty ordered URI list. Do not infer, search,
   reorder, or silently fall back to a different Spotify track.
10. After the Web Playback SDK reports its device ID, transfer to that exact device
   with `play: false`, then start the reviewed ordered `uris` against that same
   device. Never combine `context_uri` and `uris`.
11. Preserve the Wolves 100ms progress contract by storing incoming SDK state and
   extrapolating a clamped position only while playing. Do not poll SDK state on the
   100ms timer. Treat an unknown SDK URI as a controlled error that stops the clock.
12. Run the "Before You Commit" checklist in the reference: diff confined to open surfaces, lint/typecheck/test/build green, `public/dakota-versions.json` unstaged, real-player timestamp verification for timeline-adjacent edits.
13. After pushing, confirm the pushed SHA's "Deploy to GitHub Pages" workflow succeeds before reporting completion.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This tiny style tweak makes the new content fit better." | Style is a locked surface. Split long text across timestamps or ask the user; never adjust design to fit content. |
| "The component needs one extra class for my new record kind." | New record kinds are design work and require explicit owner approval. Existing kinds cover all routine additions. |
| "I can write placeholder lore that fits the tone." | The user authors all fiction. Placeholders are standard lorem ipsum only. |
| "The build passed, so the change is verified." | A green build is not verification. Seek the real Track 0 player at affected timestamps and check the live deploy. |
| "The deterministic shuffle already places this slide correctly." | Generated order is not a timing lock. An owner-authorized fixed window needs explicit data plus independent browser assertions. |
| "Photos need event buckets to make the gallery diverse." | The owner selected a simple full-pool shuffle. Do not introduce event grouping or rotation. |

## Red Flags

- A diff touching any `.vue`, `.scss`, or generated file for a content request.
- Text moved between the top-bar, thesis, and lore layers.
- Reordered lore, music, or timeline entries without explicit user instruction.
- Hand-edits to `src/components/wolves/wallpapers-list.ts` (generated) or thesis constants.
- Adding or changing the theater-caption rendering mechanism itself in `WolvesComicReader.vue` (it already exists; only the `curatedDescriptions` text content is an open surface).
- A timing-sensitive slide that remains positioned only by generated-array order.
- A post-hero gallery implementation that groups or rotates photos.
- A Spotify URI, artist, title, or alternate recording inferred without owner review.
- Spotify startup that omits catalog validation, starts a context instead of the
  reviewed URI list, or targets a device other than the SDK-ready device.
- A 100ms Spotify timer that calls `getCurrentState()` instead of extrapolating from
  registered state callbacks.
- Emojis or ellipses introduced anywhere.

## Verification

- [ ] `git diff --stat` shows only open surfaces from `docs/wolves-maintenance.md`.
- [ ] `npm run lint:fix`, `npm run typecheck`, `npm run test:run`, `npm run build` all pass.
- [ ] All added prose came verbatim from the user or recovered authored sources.
- [ ] Timeline anchors (0:00, 150-220, 398-425) and thesis text are byte-identical.
- [ ] Each owner-authorized fixed slide window has ordering, rendered-boundary, and player-progress assertions.
- [ ] Later-track gallery assertions show a non-repeating shuffled sequence.
- [ ] Provider catalog mappings are exact, unique, reviewed, and ordered to match
  the YouTube manifest; no unapproved mapping reaches runtime data.
- [ ] The local Spotify sync tests cover ordered replacement, no-op reconciliation,
  absent-catalog failure before authorization, and Spotify URI preservation.
- [ ] After renaming or converting any Track 0 people asset, regenerate `wallpapers-list.ts` and recalculate finale-photo browser checkpoints. The generator sorts filenames, so an extension change can alter the deterministic finale shuffle even when the image content is unchanged.
- [ ] Affected Track 0 timestamps verified on the real player; deploy workflow for the pushed SHA succeeded.

## Sources

- Spotify Web API PKCE flow: `/websites/developer_spotify_web-api`. PKCE exchanges
  the authorization code using `client_id`, `code_verifier`, and the callback URI;
  it does not require a client secret.
- Spotify playback transfer and ordered URI startup:
  `/websites/developer_spotify_web-api`. Transfer playback with one SDK device ID
  and `play: false`, then call `/me/player/play?device_id=<id>` with `{ uris }`.
