# Wolves Cinematic — Architecture and Engineering Reference

Production documentation for **Bluefin: Seven Days to the Wolves** (`/wolves`)
after the 2026-07-16 cinematic rebuild. This supersedes the architecture
sections of `docs/wolves-maintenance.md` (whose content rules — authored lore,
slideshows, editorial policy — still apply) and records the engineering
knowledge accumulated during the rebuild so future maintainers do not relearn
it the hard way.

Companion user-facing document: `wolves/README.md` (setup, deployment,
simplicity audit). Verified live at commit `9d78d25`.

## 1. System overview

The experience is a single Vue 3 + Pinia page with three phases, held in one
store field (`useCinematicStore().phase`), no router:

```
lobby -> intro -> cinematic Parts I-VI
```

| Phase | Component | Role |
|---|---|---|
| lobby | `cinematic/CinematicLobby.vue` | Destiny-styled gate. No account, no OAuth; the click is the browser autoplay gesture. |
| intro | `WolvesIntroOverlay.vue` | The Destiny guardian trailer, driven by `src/data/wolves-intro-sequence.ts`. |
| cinematic | `cinematic/CinematicStage.vue` | Dual-buffer YouTube playback of the six musical parts, with the theater layer above. The final part remains in this phase, paused and available to the normal transport. |

Three invariants hold everywhere:

1. **The store is the only data path.** Players and the intro overlay publish
   into `stores/cinematic.ts`; the widget, plate, captions, theater layer, and
   transitions are pure subscribers. No component passes playback data to
   another.

2. **All sync is `getCurrentTime()`-driven.** Nothing timeline-synced uses
   wall-clock time (see section 7, ad resilience).
3. **One transport.** The full-width hero widget (`MediaWidget.vue`) is the
   only playback control surface in both the intro and the cinematic. The
   intro overlay exposes `next/previous/toggle/seekToRatio` and emits
   `status`; the stage exposes the same shape for the dual-buffer player.
   `WolvesApp.vue` wires whichever phase is active to the widget.

The widget's primary meter and seek position represent the complete authored
intro plus all six cinematic parts. Segment time remains secondary. The
`DEPLOYMENT: five-years-of-universal-blue` telemetry stays visible through the
entire show, including the compact mobile layout.

Track handoffs can carry structured authored speaker, cue, static, and SFX
lines through `CinematicSegment.transitionLore`. The lore conversations are
currently hidden from the overlay — every handoff renders the authored
terminal block instead — but the lines still drive the transition sound
effects. Static, bulkhead knocks, and
the explosion are generated locally with Web Audio and are keyed once per
transition entry; blocked audio never delays the eleven-second visual handoff.
The handoff overlay (`CinematicTransition.vue`) raises for 11 seconds
(`HOLD_MS`), and its status terminal renders steadily — the earlier flicker
animation was removed by owner request; do not reintroduce it.

## 2. The dual-buffer player (`composables/useDualBufferPlayer.ts`)

Two `YT.Player` instances (sides `a`/`b`). While one plays segment N, the
other holds N+1 cued and muted at opacity 0. During the intro, the same pair
is constructed and cues Parts I and II before the overlay handoff. The handoff:

- A 100ms poll reads the active player's `getCurrentTime()`/`getDuration()`.
- At `duration - PRE_END_THRESHOLD_S` (0.3s — YouTube videos end on a black
  frame) the composable flips `activeSide`; CSS transitions the two layers'
  opacity over the segment's `crossfadeMs` while an rAF loop ramps
  `setVolume()` on both players. `ENDED` remains as a fallback for throttled
  background tabs.
- The freed side then cues N+2. Manual prev/next hard-loads the target on the
  inactive side (it has the wrong video buffered for backward jumps); the
  transition shell's 10-second hold and four-second decay cover the buffering
  gap.
- Authored trims are supported per segment (`startSeconds`/`endSeconds` on the
  native timeline); elapsed/duration are reported window-relative while
  `store.nativeTime` keeps the raw clock for caption/lore/thesis sync.

Segments live in `src/config/wolves-cinematic.ts`. Adding/reordering parts is
a data change only.

## 3. The theater layer (`cinematic/TheaterExperience.vue`)

Mounted over the video on every part; the video is the audio source and is
never the visual. This reuses the original immersive theater's locked
components unchanged:

- **7 Days (`trackZeroExperience: true`)**: 2fr/1fr grid — `WolvesComicReader`
  (`trackIndex=0`, the authored beat-synced slideshow with all hero locks,
  including the Bluefin group: sherman-m2, kyle, hikari, jorge-bluefin across
  contiguous windows 175.96-196.36s) plus `WolvesLoreColumn` (narrative
  timeline) on the right, plus the thesis overlay (345-425s) rendered in
  Destiny type. The thesis `warning` string renders **only** in the lore
  sidebar's news record, not in the overlay.
- **Escalating Voice hero typography** (`.wc-thesis` in `TheaterExperience.vue`):
  the thesis overlay's font escalates with `WolvesThesisMode`
  (`src/data/wolves-thesis-sequence.ts`). `welcome`, `corruption`,
  `growing-corruption`, `universal-blue`, and `evolve` render in
  `--wc-font-weyland-mono` (Share Tech Mono); `legend` — which covers both the
  "ascended" and "Become Legend" text — switches to `--wc-font-weyland`
  (Michroma) and adds a `radial-gradient(circle, rgb(26 95 160 / 42%),
  transparent 62%)` blue field behind the text. Every mode's text is blue
  (`#93c5fd`/`#bfdbfe`/`#dbeafe`) with a layered `text-shadow` glow that
  intensifies from the default through `legend`. This is a styling treatment
  only: the underlying thesis text constants, mode windows, and 345-425s
  timing in `wolves-thesis-sequence.ts` remain locked authored data,
  unchanged by this work.
- **Parts 2-6**: centered CNCF community gallery (`grid--gallery` mode). Part II
  starts with the owner-authored Jorge `MN_047` tribute from
  `wolves-gallery-featured.ts`, held for 38.4 seconds before the remaining
  photos enter the shuffle. One **persistent** reader instance across all parts
  preserves the single Fisher-Yates shuffle — remounting it per segment would
  reset `shownLaterTrackPhotoIds` and reuse photos, violating the no-reuse rule.
- **Wallpaper layers**: the original monthly day/night pairs
  (`img/wallpapers/bluefin-NN-{day,night}.webp`) crossfade over 1.5s with a
  sine-modulated night blend; progress spans the whole show as
  `(segmentIndex + trackProgress) / 7`, December stays out of rotation. Do
  not put a darkening scrim over these — the theater renders at full
  brightness (a scrim was added and reverted in production).

The comic-reader portal must fill its full column: the `:deep(#comic-reader)`
height/flex overrides carried over from the original `WolvesApp.vue` are what
make the viewport large; without them the reader letterboxes small.

## 4. The intro overlay (`WolvesIntroOverlay.vue`)

The `wolves-intro` Destiny 2 guardian trailer comes from
`buildIntroVideoSequence()`. It defaults to the unvoiced source
(`BV3BZKbpBns`) and exposes an intro-widget-only `Ikora voice over` toggle to
the voiced cut (`BKm0TPqeOjY`) using object-form
`loadVideoById({ videoId, startSeconds })` so native time and pause state
survive the swap. The default unvoiced source keeps its black-frame cutoff
(`maxDuration: 121.5`) and the voiced cutoff remains
`alternateMaxDuration: 120.2`. A documented guardian bond renders a small
dinosaur icon next to the Guardian name, never a separate dinosaur panel;
`leader: true` and `trustee: true` mark Christoph Blecker as a leader and
trustee. The trustee flag gives him the silver **TRUSTEE // GUARDIAN** plate
while `goldName: true` keeps only his displayed name gold. The gold-name class
disables the shared text blur animation so it remains sharp.

Typography (intro only, by owner direction): **Michroma** for theater text
(the Microgramma/Eurostile Bold Extended stand-in from the Alien/Prometheus
universe) and **Share Tech Mono** for the caption backers, both self-hosted
via Fontsource. Michroma ships a single weight — never synthetic-bold it —
and renders roughly 30% wider than the previous stack, so cue font clamps
were rescaled to keep authored line breaks from double-wrapping. Periods and
commas are stripped from **displayed** intro text only (`stripIntroPunctuation`);
authored data keeps its punctuation.

Accent scheme: default B/F letter highlights are blue (the project is
BLUEfin), but cue-authored `highlightSubstrings` override that fallback for
exact range work such as the LIFE/DROSS/GARDEN cue. Dominant (POWERFUL) cues render in muted gold `#e6d5ae` with a soft
warm glow — the saturated leader-plate yellow proved too jarring at theater
scale. Captions use the plate blue for their edge so gold stays reserved for
power moments.

The overlay's old green debug scrubber and permanent progress bar were
deliberately deleted (marked temporary review tooling); transport lives in the
hero widget.

## 5. Segment transitions and the content boundary (`cinematic/CinematicTransition.vue`)

Mounted inside `CinematicStage.vue` on every part. Its shell (the terminal
block, segment chapter/title/artist) and the separate `WolvesTeamChat` region
share one player-clock-driven timing model but are independent content
surfaces:

- **Shell timing**: `shellOpacity` holds at 1 through `store.segmentElapsed <=
  10` (`TRANSITION_HOLD_SECONDS`), then fades linearly to 0 over the next 4
  seconds (`TRANSITION_DECAY_SECONDS`). Both constants are local to the
  component. Deriving this from `segmentElapsed` (not a wall-clock timer) means
  pause, seek, and YouTube ad freezes hold and restore the shell exactly like
  every other synced surface (section 7).
- **Team chat authoring**: per-song chat is authored in
  `src/data/wolves-team-chats.ts`, keyed by segment id (`ghosts-in-the-mist`,
  `tonight-we-must-be-warriors`, `not-your-monster`, `soulbound`,
  `last-ride-of-the-day` — the five Part II-VI songs; Part I has no entry).
  Each entry is a `WolvesTeamChatSequence` (`messages: []` plus
  `finalMessageEndsAtSeconds`), with messages timestamped by `atSeconds` and
  revealed as `store.segmentElapsed` reaches them; the log holds at full
  opacity through `finalMessageEndsAtSeconds` and then fades over
  `WOLVES_TEAM_CHAT_FADE_SECONDS` (4s). Agents may add or reorder message
  records and adjust timestamps, but the `text`/`speaker` dialogue itself is
  owner-authored only — production `WOLVES_TEAM_CHATS` ships with every
  `messages` array empty by design, and that is not a placeholder to fill in
  with generated lines.
- **Content boundary**: the chat log, the top-bar communications
  (`WolvesThesisState.hudLabel`), the thesis overlay text
  (`WolvesThesisState.text`), and the lore-column records are four independent
  layers. None of this work routes, replaces, or reuses text across them.
- **Factual links, not dialogue**: `WolvesTeamChat.vue` renders two static
  command-style links (`xdg-open contribute.cncf.io`, `xdg-open
  ask.cncf.io`) pointing at `contribute.cncf.io` and `ask.cncf.io`. These are
  fixed factual CNCF contributor resources, not authored chat lines, and are
  unaffected by the empty `messages` arrays above.
- **Dev-only test fixture**: in `import.meta.env.DEV` builds only,
  `CinematicTransition.vue` reads `window.__wolvesTeamChatFixtures` (keyed by
  segment id) if present, falling back to `WOLVES_TEAM_CHATS` otherwise. This
  lets the Playwright flow test (`tests/wolves-movie-flow.mjs`, gated behind
  `WOLVES_BROWSER_FIXTURES=1`) assert the chat region's rendering and timing
  with a placeholder sequence that lives only in the test file. The hook is
  tree-shaken from production builds and production data is never edited with
  fixture dialogue.

## 6. Organization ads (`cinematic/WolvesOrgAds.vue`)

A desktop-only, Parts II-VI-only rotation of open-source project donation
tiles, mounted inside `CinematicStage.vue` alongside the theater layer:

- **Visibility**: `store.phase === 'cinematic' && store.segmentIndex > 0` —
  never rendered on Part I (`segmentIndex === 0`) or during `intro`/`lobby`.
  Hidden entirely below 1024px (`display: none`),
  same breakpoint as `WolvesTeamChat.vue`.
- **Exactly two visible ads at rest**: ads are authored as two fixed pairs in
  `src/data/wolves-org-ads.ts` (`WOLVES_ORG_AD_PAIRS`) — Pair A is
  GNOME + KubeCon CloudNativeCon Japan 2026, Pair B is Flathub + KDE. Only one
  pair is interactive/visible at a time; the other pair's tiles sit at
  `pointer-events: none` underneath.
- **Synchronized 30s rotation**: `getWolvesOrgAdBlend(elapsedSeconds)`, driven
  by `store.segmentElapsed` (not wall clock), holds Pair A at full opacity for
  the first `WOLVES_AD_ROTATION_SECONDS` (30s) of each segment, then
  alternates pairs every 30s with a `WOLVES_AD_FADE_SECONDS` (4s) linear
  crossfade at each boundary; both tiles in a pair fade together. The
  `interactivePairIndex` (and therefore `tabindex`/`aria-hidden`) switches at
  the crossfade midpoint. `usePreferredReducedMotion` skips the crossfade and
  snaps directly to whichever pair is current.
- **Asset provenance and QR links**: each ad's image and QR code are official,
  local assets — `src/assets/wolves/org-ads/{gnome,flathub,kde}.svg` and
  `kubecon-japan-2026.png`, sourced from each project's official brand kit or
  distribution channel, with the exact URLs, licenses, and any substitutions
  (e.g. GNOME's and KDE's originally briefed URLs no longer resolving)
  recorded in `src/assets/wolves/org-ads/ATTRIBUTION.txt`. QR codes
  (`src/assets/svg/qr-{gnome,flathub,kde}-donate.svg`,
  `qr-kubecon-japan-2026.svg`) are generated by `scripts/generate-qrs.js` from
  the same donation/event URLs used as each tile's `href`; they are not a
  separate content surface.
- **Gallery-only gutters**: `--wc-org-ad-gutter` (`clamp(12rem, 16vw, 18rem)`)
  is a CSS custom property scoped to `.wc-trackzero-grid--gallery` in
  `TheaterExperience.vue`, applied only when `!isTrackZero` (Parts 2-7's
  centered gallery mode). Track 0's `2fr 1fr` grid never sets or reads this
  variable — the ad gutters cannot affect the 7 Days layout.

## 7. Ad resilience (design requirement)

There is no official ad-state API in the YouTube IFrame player and CORS
prevents inspecting the iframe DOM. The design therefore never trusts wall
clocks:

- Pre-roll ads: `getCurrentTime()` holds at 0 — synced content waits.
- Mid-roll ads: the main clock freezes — slideshow, ticker, thesis, captions,
  and widget all freeze identically and resume in perfect sync (verified by
  freezing the player and diffing all surfaces across a 3s window).
- The Destiny intro's cues follow the player clock for the same reason.

This is also why Spotify was removed entirely: the Web Playback SDK requires
Premium (excludes viewers), its policy prohibits synchronizing recordings with
visual media, and it added an OAuth wall. YouTube embeds carry the soundtrack
for everyone, with ads simply pausing the show.

## 8. Hard-won engineering knowledge

Lessons that cost real debugging time tonight; check these before touching
related code.

- **CSS containing blocks vs `position: fixed`**: any ancestor `transform`
  (e.g. `translateZ(0)` GPU hints) rescopes fixed descendants. True fullscreen
  overlays inside the experience either teleport to `body` or rely on the
  stage being transform-free.
- **The shared site stylesheet leaks into this page**: `style/app/_topnavbar.scss`
  pads `body` by 60px (fixed with a `body:has(> #app > .wolves-cinematic)`
  override) and global `footer` element styles inflated a `<footer>` used in
  the lobby quote (use a `div`). Check computed styles on any new semantic
  element.
- **Vue scoped styles and the YT API**: `new YT.Player(el, ...)` *replaces*
  the host element with an iframe, so scoped selectors targeting the host's
  children never match; style the wrapper.
- **Component `<style>` blocks are plain CSS unless `lang="scss"`** — `//`
  comments break the build inside `WolvesIntroOverlay.vue`.
- **`loadVideoById`/`cueVideoById` accept `{ videoId, startSeconds }` objects**;
  the string form cannot express authored trims or time-preserving source
  swaps.
- **YouTube paints chrome (title, related videos, logo) on every paused
  embed** — `controls: 0` does not remove it. Both the intro overlay and the
  stage now use application-owned masks (top-left title block + paused-state
  veil) instead of claiming unsupported parameters can remove chrome; the
  transparent shield blocks all pointer interaction with the iframe while
  playing.
- **tsconfig lib is ES2020**: no `Array.prototype.at`, no `String.replaceAll`.
- **`wallpapers-list.ts` is generated with double quotes** while lint wants
  single quotes; `npm run test:run` can regenerate it. Regenerate via
  `scripts/generate-wallpapers.js`, run `lint:fix`, and never hand-edit it.
  The generator indexes *everything* in the wallpaper folders — untracked
  images end up referenced by the committed manifest and break clean clones
  (this happened twice: `r2.png`, then `juju`/`walters`). Commit assets and
  manifest together, compressed (WebP for anything heavy).
- **Raw-imported data files must be tracked**: committed code importing
  `wolves-destiny-captions.txt?raw` while the file was untracked would have
  broken clean builds. After any commit that swept in pre-existing working
  tree changes, stash-verify that HEAD builds and tests standalone.
- **happy-dom + YT API testing**: fake players must fire `onReady`
  asynchronously (`queueMicrotask`) — synchronous fire hits the TDZ on the
  `const player` being constructed. Use
  `vi.useFakeTimers({ toFake: [... 'requestAnimationFrame', 'performance'] })`
  to drive rAF volume ramps deterministically.
- **Verify with the real player, not unit tests alone**: browser verification
  caught intro seek desync, the
  fade not restoring volume after seek-back, the scrim regression, and cue
  double-wrapping — none of which unit tests saw. Seek every changed
  timestamp on the live player before calling work done.
- **Local YouTube origin matters**: some authored embeds return error 150 on
  numeric loopback origins such as `http://127.0.0.1:5173` even though they play
  on production. For local real-player verification, run Vite normally but open
  `http://projectbluefin.io.localhost:<port>/wolves/`; the `.localhost` suffix
  resolves to loopback while preserving the project hostname YouTube accepts.
  Recheck `https://projectbluefin.io/wolves/` before classifying a
  localhost-only error as a broken video.

## 9. Content boundaries (unchanged from the original rules)

- Agents never write fiction, lore, cue copy, or titles; the owner authors all
  creative content. Timing/layout adjustments to authored cues (line-break
  rebalancing, duration extensions) happen only on explicit owner request.
- The three Track 0 content layers stay isolated: incoming-signal communication
  (plate), thesis overlay text, and lore-column records never exchange text.
  (The plate's flip — signal line as the large label during 7 Days — is a
  presentation change within the ticker layer, not cross-layer routing.)
- Track 0's plate uses the owner-authored signal sequence from
  `wolves-incoming-signal.txt`: it rotates on 16-beat phrases until the
  Bluefin group, holds `The Blue Delivers` from 175.96–196.36s, then shows
  the pod, split ImagePullBackOff, and human-fallback lines through 345s.
  The source resumes one message per phrase from 345–408s. Label changes fade
  over 1.5 seconds; the lower thesis text remains independent.
- Slideshow additions remain zero-code: drop compressed WebP into
  `public/img/wallpapers/wolves/{wolves,showcase,people}/` and regenerate.
  Locked Track 0 windows (Jono, Marina, and the Bluefin group) change only by
  owner request, with `wolves-track-zero-slides.ts`, the comic-reader
  boundary test, and a real-player seek as the verification trio.
- No emojis, no ellipses, no truncated content anywhere.

## 10. Deployment

GitHub Pages via the `Deploy to GitHub Pages` workflow on push to `main`.
A green build is not "live": confirm the workflow run for the exact pushed
SHA succeeds, then seek the affected timestamps on the production player.
The app is path-agnostic (`import.meta.env.BASE_URL` everywhere) and needs no
environment variables, API keys, or OAuth apps.
