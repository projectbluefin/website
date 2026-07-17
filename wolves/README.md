# Project Bluefin: Wolves — Cinematic

A unified cinematic web experience that presents the seven-part Wolves series as a
single, uninterrupted epic. Deployed at wolves.projectbluefin.io as the `/wolves`
entry of the Bluefin website build.

## Architecture

Vue 3 (Composition API) + Pinia. Three independent systems, each modifiable without
touching the others:

- **Lobby** (`src/components/wolves/cinematic/CinematicLobby.vue`) — pre-flight
  authorization staging ground. The user connects with exactly one provider,
  YouTube (Google OAuth) or Spotify (PKCE); entry unlocks only once the chosen
  token is in the auth store.
- **Cinematic runtime** (`CinematicStage.vue` + `src/composables/useDualBufferPlayer.ts`)
  — double-buffered YouTube playback with pre-end handoff and programmatic
  audio/visual crossfades.
- **Persistent media widget** (`MediaWidget.vue`) — bottom-anchored, subscribes only
  to `useCinematicStore`. It receives no props from and holds no references to the
  players; play/pause intent is emitted upward and wired by the app shell.

All runtime state lives in two Pinia stores: `src/stores/cinematic.ts` (segment
index, elapsed times, metadata, Spotify state, crossfade state) and
`src/stores/auth.ts` (provider, tokens, expiry).

## Setup

```bash
npm install --include=dev
cp .env.example .env.local   # fill in client ids
npm run dev                  # http://localhost:5173/wolves/
```

Verification: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`.

## OAuth app configuration

Both providers are public browser clients. No secrets exist anywhere in this app.

### Google (YouTube path)

1. Google Cloud Console > APIs and Services > Credentials > Create OAuth client ID,
   type "Web application".
2. Authorized JavaScript origins: `https://wolves.projectbluefin.io` and
   `http://localhost:5173`.
3. Put the client id in `VITE_GOOGLE_CLIENT_ID`.

Flow: Google Identity Services token model (`initTokenClient`). Scope:
`https://www.googleapis.com/auth/youtube.readonly`. Public SPA clients cannot hold
Google refresh tokens; renewal is a silent `prompt: ''` re-request against the live
Google session, done automatically five minutes before expiry. If the session is
gone the lobby surfaces a reconnect error.

### Spotify

1. Spotify Developer Dashboard > Create app.
2. Redirect URIs: add the exact value of `VITE_OAUTH_REDIRECT_URI`
   (production: `https://wolves.projectbluefin.io/wolves/`; local:
   `http://localhost:5173/wolves/`).
3. Put the client id in `VITE_SPOTIFY_CLIENT_ID`.

Flow: Authorization Code with PKCE (full-page redirect), scopes
`streaming user-read-email user-read-private user-modify-playback-state
user-read-playback-state`. Refresh uses the standard PKCE `refresh_token` grant,
also automatic. In-browser streaming via the Web Playback SDK requires Spotify
Premium; the store surfaces a clear error otherwise.

## Segment configuration

Everything lives in `src/config/wolves-cinematic.ts`. A segment is:

```ts
const segment: CinematicSegment = {
  youtubeId: 'LASru9j0oIc', // 11-char YouTube video id
  chapter: 'PART I', // nameplate detail line
  title: '7 Days to the Wolves',
  artist: 'Nightwish',
  artwork: 'wolves-artwork/LASru9j0oIc.jpg', // relative to public/
  crossfadeMs: 1500, // optional; DEFAULT_CROSSFADE_MS (800) otherwise
  captionsUrl: 'captions/part1.txt', // optional; `seconds|text` per line
}
```

Adding, removing, reordering, or swapping videos is purely a data change here —
no component or composable changes required. Related tunables in the same file:
`PRE_END_THRESHOLD_S` (0.3s early handoff, hides YouTube's trailing black frame)
and `TIME_POLL_MS` (250ms current-time poll; the IFrame API has no timeupdate
event).

Caption tracks use the existing repository format (`seconds|text`, one cue per
line, a cue displays until the next begins — see
`src/data/wolves-destiny-captions.txt`). No caption data is currently authored for
these seven segments; the styled render pipeline activates as soon as a
`captionsUrl` is set.

## The dual-buffer player

While side A plays segment N, side B holds segment N+1 cued, muted, invisible
(`opacity: 0`, `pointer-events: none`). At `duration - 0.3s` (or on the `ENDED`
event as a fallback for throttled tabs) the composable flips `activeSide`: CSS
transitions the two layers' opacity over the segment's crossfade window while a
`requestAnimationFrame` loop ramps `setVolume()` on both players over the same
window. The freed player then cues segment N+2. A transparent shield element
covers both iframes so no YouTube-native control, link, or overlay is ever
reachable; clicks become the app's own play/pause.

Player chrome is stripped with `controls: 0, rel: 0, iv_load_policy: 3,
disablekb: 1, fs: 0, playsinline: 1, modestbranding: 1` (`modestbranding` and
`showinfo` are deprecated upstream no-ops; the former is kept for older embed
behavior, the latter omitted).

## Spotify track list

The application assembles and owns the playlist — there is no user-managed
playlist. The track list mirrors the authored Wolves soundtrack manifest
(`public/wolves-playlist.json`, tracks 1–7), which is the repository's canonical,
human-curated soundtrack for this story. Rationale per track: each is the authored
soundtrack entry for the corresponding part of the series, in series order —
this app deliberately adds no editorial curation of its own.

| # | Track | Artist |
|---|-------|--------|
| 1 | 7 Days to the Wolves | Nightwish |
| 2 | Ghosts In The Mist | Unleash The Archers |
| 3 | Tonight We Must Be Warriors | Avatar |
| 4 | Not Your Monster | The Dark Element |
| 5 | End of You | Poppy |
| 6 | Soulbound | Unleash The Archers |
| 7 | Last Ride of the Day | Nightwish |

At runtime the titles/artists are resolved to Spotify URIs via the Search API and
queued onto the in-browser Web Playback SDK device with a single
`PUT /v1/me/player/play` call. Unresolvable tracks are skipped rather than failing
the show. When the user authenticates with Spotify, both YouTube players are muted
for the entire runtime; when they authenticate with YouTube, Spotify is never
loaded.

## Spotify policy note (read before enabling in production)

`docs/skills/wolves-content-maintenance.md` (commit 3850bf0) records that Spotify's
Web Playback SDK developer policy prohibits synchronizing sound recordings with
visual media, and a prior Wolves Spotify integration was reverted on those
grounds. This application's Spotify path plays the assembled soundtrack while the
YouTube video layer runs, which is exactly that synchronization. The integration
is implemented per the product brief, but a provider-approved audiovisual
arrangement should be obtained before enabling the Spotify path in production;
until then, deploy with only `VITE_GOOGLE_CLIENT_ID` set — the Spotify lobby
choice fails cleanly when its client id is absent.

## Deployment (wolves.projectbluefin.io)

The app builds as the `wolves` entry of the site (`npm run build`, output in
`dist/wolves/`). To serve it at the dedicated domain:

1. Point a CNAME for `wolves.projectbluefin.io` at the GitHub Pages host for this
   repository (or front it with the existing reverse proxy).
2. Serve `dist/wolves/index.html` at the domain root (a Pages redirect or proxy
   rewrite from `/` to `/wolves/` both work; the app itself is path-agnostic —
   all asset fetches use `import.meta.env.BASE_URL`).
3. Register the final public URL as the Spotify redirect URI and Google authorized
   origin (see above).
4. Set the two client ids as build-time env vars in the deploy workflow.

## Simplicity audit findings

Conducted before implementation; every system was reduced to the simplest thing
that solves the actual problem.

**Simplified (complexity rejected):**

- No vue-router: the app has three phases (lobby, cinematic, finished) — a single
  store field, not routes.
- No auth library: Spotify PKCE is ~100 lines of documented fetch calls; Google's
  own GIS script is the documented SPA path and owns all popup/consent UX.
- No animation library: the visual crossfade is a CSS opacity transition keyed off
  one reactive value; only the audio ramp needs JavaScript (rAF) because
  `setVolume` has no CSS equivalent.
- No WebVTT machinery: the repository already has a trivial `seconds|text` caption
  format; the parser is ~30 lines.
- No server-side Spotify playlist creation: search-resolve + play-with-uris ships
  the same result with zero playlist lifecycle management.
- Flat store state: no nested modules, no state machines; the dual-buffer swap is
  a boolean (`swapping`) plus an index.
- sessionStorage over localStorage for tokens: correct lifetime for a one-sitting
  event, smaller exposure surface.

**Complexity kept (and why it is required):**

- Two player instances with cue/swap logic (`useDualBufferPlayer`): a single
  player's `loadVideoById` visibly buffers at every boundary — the one artifact
  this experience must not have. This is the only structurally complex component.
- 250ms polling loop: the IFrame API has no time event; polling is the only way to
  drive captions, progress, and the pre-end handoff.
- Pre-end threshold (0.3s): YouTube videos end on a black frame; swapping exactly
  at `ENDED` shows it. The `ENDED` handler remains as a fallback for throttled
  background tabs.
- Token auto-refresh timer: without it a 60-minute token dies mid-show — the one
  place defensive code is the feature.

## Assumptions

- The seven segments are the first seven tracks of the authored Wolves soundtrack
  manifest, in order. Swapping in different series videos is a config-only change.
- The "segment 3 widget layout" is implemented as the compact unified layout:
  artwork | chapter + title + progress + times | transport controls.
- No caption data exists for these segments yet; the styled caption system is
  fully wired and data-activated.
- Google token renewal uses silent re-request (the only option for a public SPA
  client); a fully expired Google session requires one reconnect click.
