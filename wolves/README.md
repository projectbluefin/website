# Project Bluefin: Wolves Cinematic

The `/wolves/` entry at [projectbluefin.io](https://projectbluefin.io/wolves/)
presents the seven-part Wolves series as one fullscreen Vue 3 and Pinia
experience. It requires no account, login, OAuth application, or API key.

## Runtime

One Pinia field in `src/stores/cinematic.ts` owns the five-phase flow:

```text
lobby -> intro -> cinematic Part I -> creator-shorts -> cinematic Parts II-VII -> finished
```

- `CinematicLobby.vue` provides the autoplay gesture.
- `WolvesIntroOverlay.vue` runs the authored 94-second prologue and guardian
  trailer from `src/data/wolves-intro-sequence.ts`.
- `CinematicStage.vue` and `useDualBufferPlayer.ts` double-buffer the seven
  musical parts.
- `WolvesCreatorShortsInterstitial.vue` runs once between Part I and Part II.
  The cinematic players are destroyed during the interstitial and remounted at
  Part II.
- `TheaterExperience.vue` renders the Track 0 slideshow, lore, thesis, later
  galleries, and wallpapers above the YouTube audio source.
- `MediaWidget.vue` is the shared transport for the intro and cinematic.

All synchronized surfaces use the active YouTube player's `getCurrentTime()`.
Pre-rolls and mid-rolls therefore pause the slideshow, lore, thesis, captions,
transitions, organization ads, and widget together rather than desynchronizing
them.

## Track 0 and later parts

Track 0 keeps the locked `2fr 1fr` desktop split: `WolvesComicReader` on the
left and `WolvesLoreColumn` on the right. The thesis timeline at 345-425 seconds
uses Share Tech Mono through the evolve cue and Michroma for ascended and
legend, with the locked blue presentation.

Parts II-VII use the persistent non-repeating CNCF gallery. Desktop organization
ads show GNOME with KubeCon, then Flathub with KDE, changing both sides together
every 30 seconds with a four-second player-clock crossfade. Per-song team chat
is a fourth independent authored layer; production records remain empty until
the owner supplies dialogue.

Each part opens with a transition shell that holds for 10 seconds and decays
over four seconds. The shell and team chat are separate DOM regions.

## Segment configuration

`src/config/wolves-cinematic.ts` defines stable segment ids, YouTube ids,
chapter/title/artist metadata, artwork, optional authored trims, captions, and
crossfade duration. Track 0 must remain first because its slideshow, lore,
incoming-signal, and thesis timelines are authored against that video.

`public/wolves-playlist.json` remains the source playlist manifest.
`npm run update:wolves-playlist` regenerates it and its artwork.

## Local playback

YouTube may reject Wolves embeds on numeric loopback origins and report embed
error 150. The same Vite server works through the automatically resolving
`projectbluefin.io.localhost` hostname:

```bash
npm run dev -- --host 127.0.0.1
```

If Vite selects port 5173, open:

```text
http://projectbluefin.io.localhost:5173/wolves/
```

Use the actual port printed by Vite. Do not diagnose a localhost-only error 150
as a broken production video until the same video is checked at
`https://projectbluefin.io/wolves/`.

## Verification and deployment

Run:

```bash
npm run lint:fix
npm run typecheck
npm run test:run
npm run build
WOLVES_SCREENSHOT_DIR=/tmp/wolves node tests/wolves-movie-flow.mjs
```

Pushes to `main` deploy through the `Deploy to GitHub Pages` workflow. A change
is complete only after the exact pushed SHA deploys successfully and affected
timestamps pass real-player browser checks on production.

The detailed engineering reference is `docs/wolves-cinematic.md`. Content
boundaries and maintenance procedures are in `docs/wolves-maintenance.md`.
