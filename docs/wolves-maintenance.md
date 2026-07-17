# Wolves Maintenance Reference

Production documentation for **Bluefin: Seven Days to the Wolves** (`/wolves`), the official comic book teaser landing page. This is the operating manual for agents and maintainers updating the page after its final production design.

## The Boundary

**Agents edit content. Agents never edit design.**

The design is frozen and on rails. When a user says "add a character" or "swap a track," the change lands in a data file or an asset folder, never in a component, stylesheet, or template. Layout, spacing, typography, color, class names, animation timing, transition curves, markup structure, and component logic are all off limits. Prose, data fields, and registered content items within existing structures are the only things agents change.

Every section below repeats this boundary for its own surface. If a request cannot be satisfied without touching a locked surface, stop and tell the user instead of making the change.

## Architecture

- Entry point: `wolves/index.html`. Loads `src/wolves-main.ts`, which mounts `src/WolvesApp.vue` into `<div id="app"></div>`.
- `src/stores/cinematic.ts` is the sole runtime state path. Its five-phase flow is `lobby -> intro -> cinematic Part I -> creator-shorts -> cinematic Parts II-VII -> finished`.
- `src/components/wolves/cinematic/CinematicStage.vue` owns the dual-buffer YouTube stage. `src/composables/useDualBufferPlayer.ts` keeps one player active while the next is cued, then crossfades video opacity and volume.
- `src/components/wolves/cinematic/TheaterExperience.vue` mounts the authored visual layer above the YouTube audio source. Track 0 keeps the fixed `2fr 1fr` desktop split. Parts II-VII use the centered gallery with desktop ad gutters.
- `src/components/wolves/cinematic/MediaWidget.vue` is the only transport surface for the intro and cinematic. Its 140px footer budget is locked. The stage nameplate occupies the top safe region.
- `WolvesCreatorShortsInterstitial.vue` is a one-time bridge between Part I and Part II. The cinematic stage and both players are destroyed during the bridge and remounted at Part II.
- **Design target: fullscreen, mobile-first UX.** Touch ergonomics, viewport containment, and readable typography are primary. Desktop is a widescreen adaptation, not permission to redesign the mobile experience.
- **Theater-view typography:** The Wolves intro is authored for a 10-foot theater audience. Every intro cue must be readable at theater distance; do not shrink text to accommodate a long line. Preserve hierarchy through authored line breaks, timing, and cue splitting. Follow Nielsen Norman Group's TV/10-foot UX guidance for large type, strong contrast, clear hierarchy, and minimal clutter.

## Named Regions

Use these names when talking to users. They map one-to-one to production markup.

- **Lobby** (`.wc-lobby`): the BEGIN TRANSMISSION gate. Its click is the browser autoplay gesture.
- **Intro** (`.wolves-intro-overlay`): the authored 94-second prologue and guardian trailer.
- **Stage nameplate** (`.wc-stage-nameplate`): the top communication/title placard. During Track 0, `WolvesThesisState.hudLabel` supplies the large incoming-signal label. On later parts it shows chapter and title.
- **Content viewer** (`src/components/wolves/WolvesComicReader.vue`, left column): the primary viewing surface.
  - During Track 0 it plays the authored beat-matched slideshow: the comic cover (from `public/color-with-bluefin.pdf`) followed by the local wallpaper artwork, scheduled so every image shows exactly once with transition pacing that tightens toward the climax.
  - During later tracks it becomes a centered gallery of CNCF community photos from `public/flickr-photos.json`, shuffled once across songs 2 onward without event grouping, rotation, or reuse.
  - Images come from asset folders through a generated list (see Slideshows). The scheduling, shuffling, crossfade keyframes, and pacing logic are locked.
- **Thesis overlay** (`.wc-thesis` in `TheaterExperience.vue`): large lower-overlay signal text during the Track 0 finale (345 to 425 seconds). `WolvesThesisState.text` drives this region; `hudLabel` drives the stage nameplate. Never route text between them.
- **Lore viewer** (`src/components/wolves/WolvesLoreColumn.vue`, right column): the narrative record surface. Hidden during later-track gallery presentation. See Lore Records for how entries are organized and added.
- **Transition shell** (`.wc-transition-shell`): the authored terminal block plus incoming chapter/title/artist. It holds at full opacity for 10 seconds, decays for four seconds, and is removed at 14 seconds, all from player time.
- **Team chat** (`.wc-team-chat`): a separate Parts II-VII authored layer. It is not inside the transition shell and does not inherit the shell decay.
- **Organization ads** (`.wc-org-ads`): desktop-only Parts II-VII pairs. GNOME/KubeCon and Flathub/KDE alternate together every 30 seconds with a four-second player-clock crossfade.
- **Media widget** (`.wc-widget`): the persistent footer transport and telemetry. Telemetry strings are stylized design copy, not live data.
- **Background wallpaper layers** (`.wc-wallpaper-container`): monthly Bluefin day/night pairs that crossfade over 1.5 seconds. December remains intentionally out of rotation.

## Content Layers

Three separate authored layers exist during Track 0. They never share or exchange text:

1. **Top-bar communications**: `src/data/wolves-incoming-signal.txt` via `hudLabel`.
2. **Thesis story** (lower overlay): text constants in `src/data/wolves-thesis-sequence.ts`. Locked.
3. **Lore-column narrative**: records in `src/data/lore/*.md` scheduled by `src/data/wolves-narrative-timeline.ts`.

Editing one layer must never erase, replace, reorder, or otherwise alter another.

A fourth, separate authored layer exists only for Parts II-VII: the per-song **team chat**, authored in `src/data/wolves-team-chats.ts`. Agents may add or reorder chat message records and their timestamps, but never write the `text`/`speaker` dialogue itself. Production ships every song's `messages` array empty by design.

## Lore Records

The lore viewer renders typed records parsed from Markdown with YAML frontmatter.

- **Files**: `src/data/lore/*.md`. Frontmatter plus body. The parser is `src/data/wolves-lore-records.ts`; the record manifest at the bottom of that file (`id`, `chapterId`, `relativePath`) controls which files load and which chapter they belong to.
- **Kinds** (`kind` in frontmatter) and their views in `src/components/wolves/lore/`:

  | kind | view |
  |---|---|
  | `chatlog` | `ChatlogLoreView.vue` |
  | `quote` | `QuoteLoreView.vue` |
  | `news` | `NewsLoreView.vue` |
  | `source` | `SourceLoreView.vue` |
  | `character-sheet` | `GuardianDossierView.vue`, or `DinosaurDossierView.vue` when `subject_kind: dinosaur` |
  | `field-report` | `FieldReportLoreView.vue` |
  | `location-dossier` | `LocationDossierView.vue` |
  | `guardian-bond` | `GuardianBondLoreView.vue` |

- **Chapters**: defined in `src/data/wolves-story.ts` (`prologue` / "The Kube", `pursuit` / "The Illustrius", `awakening` / "The Wolves"). Chapter definitions are locked.
- **Scheduling**: `src/data/wolves-narrative-timeline.ts` maps every Track 0 second to one record. The timeline is locked authored data with hard anchors: `arthur-c-clarke-1` at 0:00, `lorem-pursuit-1` at 150 to 220 seconds, and `blue-universal-acquires-wayland-yutani` at 398 to 425 seconds. (The original 0:00 anchor, `arthur-c-clarke-4`, was moved out of Track 0 by explicit user request and is now reused verbatim as an intro-overlay cue in `src/data/wolves-intro-sequence.ts`; its manifest entry was removed from `src/data/wolves-lore-records.ts` and its Markdown file is otherwise untouched.) Order is strictly chronological and narrative-driven; quotes are interleaved between chats to fill in context while chats move the story forward. Never reorder or reshuffle.
- **Provenance**: external source URLs (the Ishtar Collective entries) are registered in `sourceUrlsByRecordId` in `wolves-story.ts`. Dinosaur artwork resolves only through an explicit `species` frontmatter value matched against `src/data/wolves-dinosaur-species.ts`. Never infer filenames or invent provenance.

### Adding a lore entry

1. Get the exact body text and frontmatter values from the user. Agents never write fiction, chapter names, or creative prose. Placeholders are standard lorem ipsum only.
2. Create `src/data/lore/<id>.md` with frontmatter (`kind`, `title`, `timestamp` required; other fields per kind, matching an existing record of the same kind).
3. Add a manifest entry in `src/data/wolves-lore-records.ts` with the user-specified `chapterId`.
4. If the record must appear in the Track 0 rotation, that requires a timeline change. Timeline changes are restricted: update only unlocked boundaries, preserve the three anchors, update the independent oracle in `src/tests/wolvesNarrativeTimeline.test.ts`, and verify by seeking the real Track 0 player at every changed boundary.
5. Run the checklist below.

If authored lore appears to be missing from the worktree, never ask the user to retype it. Recover in order: working tree, Git history and reflog, editor local history or backups. Ask the user only if recovery fails. Never recreate, summarize, or alter recovered prose.

### Adding a character or dinosaur

1. For a dinosaur, add a registry entry to `src/data/wolves-dinosaur-species.ts` (`id`, `scientificName`, `documentationUrl`, `artwork`) with artwork committed under `public/characters/` as compressed WebP.
2. Add a `character-sheet` lore record (with `subject_kind: dinosaur` and `species: <registry-id>` for dinosaurs) plus any `guardian-bond` record the user specifies, following the lore-entry steps above.
3. Do not touch the dossier views or the team roster markup in `WolvesLoreColumn.vue` unless the user explicitly asks for a roster change, and then edit only the label and id strings.
4. Guardian `class` is a strict enum in the parser (`titan | warlock | hunter` — `src/data/wolves-lore-records.ts`); a compound or invalid value throws at load time. For a user-supplied dual-class character, pick the primary class the user lists first and note the secondary in `titles`; do not invent a compound value.
5. A character's dinosaur pairing may be an intentional narrative mystery. Recording it as `relations: { dinosaur: '[REDACTED]' }` (a plain string, not a `subjectprofile/...` reference) is safe and will not fail validation, because `validateGuardianBonds()` only enforces the reference format on `guardian-bond` kind records — simply do not create a `guardian-bond` record (or a dinosaur `character-sheet`) until the user reveals the real pairing.
6. Every new lore record needs a manifest entry in `src/data/wolves-lore-records.ts` (see step 3 under "Adding a lore entry" above) **and** a bump to the hardcoded total in `src/tests/wolvesLoreRecords.test.ts` (`expect(records).toHaveLength(N)`) — increment `N` by exactly the number of new manifest entries.

## Soundtrack and Player

`src/composables/useDualBufferPlayer.ts` creates the two YouTube players used by `CinematicStage.vue` and reports active playback into the Pinia store at 100ms resolution. Player controls, layout, crossfade behavior, and progress wiring are locked.

- **Track registry**: `public/wolves-playlist.json`, loaded at runtime through `src/data/wolves-soundtrack.ts`. Track fields: `id`, `title`, `artist`, `youtubeVideoId`, `artwork`, plus optional tempo metadata (`bpm`, `phraseBeats`, `fadeDuration`, `slideInterval`).
- **Regeneration**: `npm run update:wolves-playlist` rebuilds the manifest from the YouTube playlist and downloads artwork to `public/wolves-artwork/`. Tempo overrides live in `TEMPO_CONFIGS`; canonical artist overrides for uploader aliases live in `ARTIST_OVERRIDES`, both in `scripts/update-wolves-playlist.js`.
- **Runtime segment registry**: `src/config/wolves-cinematic.ts` maps the seven authored playlist entries into stable segment ids and optional trims. Keep it consistent with playlist changes.
- **Adding, swapping, or reordering tracks**: change the YouTube playlist itself, regenerate, then update the cinematic segment registry if required. Track 0 is special: the entire authored narrative is built against "7 Days to the Wolves" at position 0. Never move or replace Track 0.
- The music is part of the narrative sequence. Track order beyond position 0 follows the user's authored playlist order; never reorder it on your own.

## Intro Overlay System

The lobby's BEGIN TRANSMISSION action enters a two-part intro sequence before `WolvesApp.vue` mounts the cinematic stage:

1. `wolves-prologue` — a 94-second text cold open driven by a background-only YouTube audio embed. Per-cue static or day/night-crossfade background artwork is supported for authored beats. The final 2.5 seconds follow the source phrase's decay. Multi-line cue text uses real `\n` characters and `white-space: pre-line`.

2. `wolves-intro` — the official YouTube IFrame Player embed of Bungie's "Destiny 2: Into the Light Cinematic" trailer (`youtubeVideoId: 'BKm0TPqeOjY'`) with HTML/CSS character overlay text introducing the six Guardian characters. This is a standard IFrame API embed (autoplay, no controls) and is treated like other playlist embeds.

On completion, `WolvesIntroOverlay.vue` emits `complete`; `WolvesApp.vue` clears the intro display override, enters the cinematic phase, mounts `CinematicStage.vue`, and calls `stage.start()` for Track 0.

Architecture:

- `src/data/wolves-intro-sequence.ts`: pure, unit-tested state machine (`createIntroSequenceState`, `advanceIntroSequence`, `skipIntroSequence`, `activeOverlayText`/`activeOverlayCue`) plus `buildIntroVideoSequence()`, the config listing each segment. Two segment kinds exist, discriminated by `kind`: `video` (a real YouTube embed, `youtubeVideoId`, optional `maxDuration` to force an early advance before the video's natural end) and `text` (no video; `duration` drives auto-advance off a local clock instead of a player's `getCurrentTime()`, optional `audioYoutubeVideoId` for a background-only audio embed). Every segment carries the same character-overlay text cues (`{ text, start, end }`), which may also carry `backgroundImage` or `backgroundCrossfade` for the two authored visual beats in the prologue. This is the **content surface** for the intro sequence: segment data, video/audio ids, and overlay text/timing/background are editable with exact user-supplied copy.
- `src/composables/useYoutubeIframeApi.ts`: shared YouTube IFrame API script-loader (`loadYoutubeIframeApi()`, `getYoutubePlayerConstructor()`, `getYoutubePlayerState()`). It also exports the test-only `resetYoutubeIframeApiCacheForTests()` because the module cache persists across tests.
- `src/components/wolves/WolvesIntroOverlay.vue`: fullscreen sequencer consuming that state machine, branching on segment `kind`. For `video` segments: constructs a `YT.Player` (`autoplay: 1, controls: 0, playsinline: 1, rel: 0, modestbranding: 1`), polls `getCurrentTime()` every 200ms to drive overlay text cues and any `maxDuration` cutoff (the IFrame API has no `timeupdate` event), advances on `onStateChange` `ENDED`, auto-advances on `onError` (a load failure never blocks the live experience). For `text` segments: renders a black background (plus any active cue's background artwork), drives a local `setInterval` clock instead of a player, and optionally mounts a tiny/hidden `YT.Player` purely for `audioYoutubeVideoId`. Both paths expose the same "Skip" button that jumps straight to the live experience. This component's markup/logic is locked, same as other Wolves components — only the data it's given (`wolves-intro-sequence.ts`) is editable.
- `src/WolvesApp.vue`: mounts the intro directly as the `intro` phase and wires its transport methods to `MediaWidget.vue`.

**What agents may touch**: segment data, `youtubeVideoId`/`audioYoutubeVideoId`, `maxDuration`/`duration`, and overlay text/timing/background in `buildIntroVideoSequence()` (`src/data/wolves-intro-sequence.ts`), with exact user-supplied copy only — same editorial rule as everywhere else on this page. The Collapse artwork (`public/wolves-intro/bluefin-collapse-{day,night}.webp`) is exclusive to this sequence by explicit user request; do not restore it to the Track 0 wallpaper rotation.

### Guardian plate

Each `wolves-intro` cue in the form `"{class} — {name} — {title}"` (parsed by `parseGuardianCue()`) renders as a Destiny-style card in `WolvesIntroOverlay.vue`. Two owner-authorized changes to this card, on top of the base system above:

- The plate's header label reads **`MAINTAINER // GUARDIAN`** (maintainer first), matching the narrative's own wording ("They were Maintainer-Guardians...", `wolves-intro-sequence.ts`). The lore-column `GuardianDossierView.vue` header must always read the same text — keep both in sync.
- A guardian's bonded-dinosaur icon (small artwork next to their name) appears when a documented `guardian-bond` lore record exists for them. The lookup lives in `src/data/wolves-guardian-dinosaur-bonds.ts` — a small curated `guardianName -> dinosaurSpeciesId` list, intentionally *not* parsed from lore markdown at runtime (the intro overlay is a lightweight, performance-sensitive component and shouldn't depend on the full lore loader). Update this list whenever a new `guardian-bond` record is added for a guardian who also appears in the intro sequence. Guardians with no documented bond render with no icon — this is expected, not a bug.
- **Kat Cosgrove's cue is deliberately 1s ahead of the frame-verified footage cut** (16.5s instead of 17.5s), per explicit user request (2026-07-15) that her nameplate "come forward." Robert Killen's preceding window was shortened to match (5-16.5s instead of 5-17.5s) so the two stay adjacent rather than overlapping — neither has a `position`, so simultaneous cues here would stack instead of rendering side-by-side. This is an intentional, documented exception to the otherwise frame-accurate cueing described above; do not revert it to 17.5 without a fresh user request. See the comment above the `wolves-intro` segment in `wolves-intro-sequence.ts` for the full rationale.
  - **Open/unresolved as of 2026-07-15**: the user reported her nameplate "still showing too late" after the 16.5s fix. A fresh frame-by-frame Playwright verification (real playback, not seek-based scrubbing) shows the opposite: the plate already switches to her at ~16.8s while Robert Killen's static void-arm shot is still on screen — the whip-pan toward her Titan doesn't start until ~17.4s, and she isn't clearly visible until ~18s. This contradicts "too late," so no timing change was made pending the user watching the live site themselves and reporting the exact second they want. **Do not change this value based on the frame-capture evidence alone or based on "too late" alone — wait for the user's own reported timestamp**, since their perception of normal-speed playback may differ from seek-based frame inspection (e.g. YouTube's on-embed caption text, audio cues, or a different sense of "when she's introduced" than the strict pixel-cut).
- **Christopher Blecker's cue is gilded gold** via the `leader: true` field (`wolves-guardian-plate-leader` CSS in `WolvesIntroOverlay.vue`), per explicit user request (2026-07-15) to signify leadership, pairing with his existing "First Among Equals" title line. His window was also extended from 83-90s to 83-96s (matching Natali Vlatko's own end) so his plate stays up longer — re-verified via frame capture that his green Strand arm is still visibly in frame through 94-96s, so this is also a footage-accuracy correction, not purely a stylistic hold. `leader` is reserved for him alone; do not apply it to other guardians without a fresh user request. His title line carries two segments ("First Among Equals — The North Star"), joined and rendered with equal visual weight. **"Uncompromising Purity" and "Platinum Member" (added 2026-07-15, the latter with a `blingTitle: 'Platinum Member'` shimmer) were removed the same day** per a follow-up explicit user request to drop back to just the original two titles — do not re-add either without a fresh user request. `blingTitle` must match a substring of the cue's title exactly (case-sensitive) or it silently renders with no effect.
- **The `wolves-intro` segment now cuts off via `maxDuration: 114`**, ending right after the narrator's last line ("...for all time.", confirmed on screen through 113.2-113.5s via frame capture) instead of running to the trailer's natural 120s end. This skips roughly 7s of dead time (a black cut, then a "Destiny 2: Season of the Wish" promotional card) that isn't Guardian content, per explicit user request (2026-07-15). Do not remove `maxDuration` or extend it back toward 120s without a fresh user request; if the narrator's dialogue is re-verified as ending earlier or later, adjust this value to match, not the rationale.
- **Natali Vlatko's title now reads "Boss B*tch — He's wearing a dress, I'm wearing a FIST"**, per explicit user request (2026-07-15). The user's original line ended with a trailing ellipsis, which was substituted with an em dash (matching this file's title-join convention) per the sitewide ellipsis ban documented earlier on this page.
- **Multi-segment titles render with a blue vertical bar (`|`) between segments instead of the literal em-dash text**, per explicit user request (2026-07-15). The cue's authored `text` still uses ` — ` joins in `wolves-intro-sequence.ts` (that convention is unchanged), but `WolvesIntroOverlay.vue`'s `titleTokens()` helper now splits the assembled title on ` — ` and renders each em-dash join as a `wolves-guardian-plate-title-sep` span (color `#93c5fd`, the same blue accent already used for the plate's crest/horizon lines/class label) instead of the raw punctuation. This only affects guardians with more than one title segment (currently Christopher Blecker's two and Natali Vlatko's two); single-title guardians (Robert Killen, Kat Cosgrove, Kaslin Fields, Laura Santamaria) are unaffected since there is nothing to separate.

## Creator Shorts Interstitial

A one-time, fullscreen bridge between Track 0 ("7 Days to the Wolves") and Track 1 ("Ghosts In The Mist") plays a fixed four-video chapter: the first three Cassidy Williams (`@cassidoo`) entries, then the first Lindsay Nikole (`@LindsayNikole`) entry. It automatically continues to Track 1 when that Lindsay turn ends. The four-video order is deliberate; do not extend it with the remaining source-list entries without a fresh user request.

Architecture:

- `src/data/wolves-creator-shorts.ts`: the **content surface** — two independent typed, ordered arrays, `wolvesCreatorShortsLindsayNikole` and `wolvesCreatorShortsCassidyWilliams`, each of `{ videoId, title, creatorName, channelUrl, orientation }`, plus `wolvesCreatorShortsChapter`, which derives the first three Cassidy and first Lindsay entries. `orientation` is `'vertical'` for normal 9:16 Shorts and `'horizontal'` for the rare real 16:9 video (see below).
- `src/components/wolves/WolvesCreatorShortsInterstitial.vue`: fullscreen, `<Teleport to="body">` player that creates exactly two persistent `YT.Player` instances. It pre-cues inactive sources, advances the fixed chapter on an active player's `ENDED` or `onError`, and emits `complete` immediately after the single Lindsay chapter turn. Each side keeps its title and creator attribution. The current-month wallpaper backdrop, scrim, and Pause/Resume and Skip controls are locked design.
- `src/stores/cinematic.ts` and `src/composables/useDualBufferPlayer.ts`: the pure coordinator owns intro, cinematic, and Creator Shorts phase changes (see `docs/wolves-cinematic.md` for full architecture). It opens Shorts only for the first Part I → Part II transition in a session (`store.creatorShortsDueFor()`, gated on the one-time `shortsConsumed` flag); returning to Part I and moving forward does not replay the chapter. `CinematicStage.vue` — and its two `YT.Player` instances — is unmounted and destroyed for the duration of the interstitial, then remounted from `store.segmentIndex === 1` (Part II) once `WolvesCreatorShortsInterstitial.vue` emits `complete`. Native playlist previous/next controls are available only during the cinematic stage.
- `src/composables/useYoutubeIframeApi.ts`: the shared player contract includes optional volume methods and a cancellable volume-fade helper. Keep volume control progressive: unsupported browsers must still advance cleanly.

**Note on the one horizontal exception**: "Animals that are METAL AS F*CK" (`hqbR6Kt2McY`) is a real, verified Lindsay Nikole video but is a horizontal long-form upload, not a vertical Short — confirmed via YouTube's oEmbed API (`width:200,height:113` vs. a real Short's `width:113,height:200`) since no literal vertical "metal af animals" Short exists on her channel. Kept per explicit user decision; embeds and plays correctly, letterboxed automatically by YouTube's player.

**Removed entries**: Lindsay Nikole's "Hammerheads are getting hammered" (`K1DJNw2zHlo`), Cassidy Williams's "React is like paella" (`cIaNRGkZQdM`), and Cassidy Williams's "I accidentally discovered a clustering algorithm with Magna-Tiles" (`xCjuz1Q4qbE`) were removed from the rotation per explicit user request.

**Added entries**: four more real, verified Cassidy Williams Shorts were added per explicit user request (2026-07-15) — "Friday deploys" (`gpoT1YH9deM`), "Legacy code" (`VBqh13NOYLQ`), "Every team has that one issue that everyone avoids" (`q4Sg8WjSIJE`), and "Interviewing is all a game" (`q_EsHzjmx-4`) — all pulled from her actual `@cassidoo` channel and verified real via YouTube's oEmbed API (confirmed vertical, `width:113,height:200`, `author_name: Cassidy Williams`). Cassidy's list is now **9 entries** (was 5), two longer than Lindsay's 7 -- the "longer list continue solo" test now expects Lindsay's list to run out first and Cassidy to finish solo on her last entry, the reverse of before.

**What agents may touch**: only the two video lists in `src/data/wolves-creator-shorts.ts`, with exact real, non-fictional video ids/titles/creator credit — same editorial rule as everywhere else on this page (verify any new entry via YouTube's oEmbed API before adding it, never invent an id). The fixed four-video selection, one-time stage trigger, pause/resume behavior, preloading mechanics, and interstitial markup/logic are locked.

**What agents must not touch without a fresh, explicit user request**: `WolvesIntroOverlay.vue` markup/styles/logic, `useYoutubeIframeApi.ts`, the phase wiring in `WolvesApp.vue`, or the pure functions in `wolves-intro-sequence.ts` (only its `buildIntroVideoSequence()` data payload is content).

## Slideshows

This is the feature users depend on most. Its whole value is that adding a slide requires zero code.

**User flow**: drop a `.webp` image into one of `public/img/wallpapers/wolves/{wolves,showcase,people}/`, using a `-day` / `-night` filename suffix pair when a day/night pair exists. The build and dev pipelines run `scripts/generate-wallpapers.js`, which scans those folders and regenerates `src/components/wolves/wallpapers-list.ts`. The new image joins the Track 0 rotation automatically with a title from the curated dictionary in the script, or a title generated from the filename.

**Interview / hero-video thumbnail slides**: a recurring pattern is adding a slide for a YouTube video (an interview, panel, or episode relevant to the project). These always use YouTube's official public thumbnail (`https://i.ytimg.com/vi/<id>/maxresdefault.jpg`, falling back to `sddefault.jpg`/`hqdefault.jpg`), saved into `public/img/wallpapers/wolves/people/` as WebP. **Never download, screen-capture, or re-encode the actual video footage** — only the sanctioned public thumbnail image, per the copyright rule in the Editorial Rules section below.

**Theater captions (optional, per-slide)**: a slide may optionally carry a longer `description` in the `curatedDescriptions` dictionary in `scripts/generate-wallpapers.js` (parallel to `curatedTitles`), when the video's real description has substantive narrative prose worth surfacing (not just timestamps, SEO keyword lists, or affiliate links — skip the description field entirely for those). When present, `WolvesComicReader.vue` renders that slide with a large `.wallpaper-theater-caption` (title + paragraphs, `clamp()`-sized for 10-foot/TV-distance legibility) instead of the standard small `.wallpaper-caption`/`.flickr-caption` pill. Every slide without a `description` keeps the small pill unchanged. Use the real video description text (via `yt-dlp --skip-download --print description "<url>"`), verbatim, not summarized or invented — paragraph breaks (`\n\n`) may be chosen for readability, but wording must not be altered. **Owner-authorized exception:** `interview-jono-bacon-cult-psychology-kubernetes.webp` sets `theaterTitleOnly` so its existing title renders alone as the dramatic 10-foot Track 0 banner; it does not add or alter authored copy.

**Jono Bacon, Marina Moore, Sherman, and m2 timing locks**: `interview-jono-bacon-cult-psychology-kubernetes.webp` occupies the fixed Track 0 data window from **167.8s to 171.88s** (2:47.8 to 2:51.88). `kubecon-55168684055.webp`, titled **Marina Moore**, follows from **171.88s to 175.96s**; `sherman.webp` follows from **175.96s to 180.04s**; and `m2.jpg` immediately follows Sherman from **180.04s to 184.12s**. The standard `TIMELINE_BOUNDARY_EPSILON_SECONDS` handoff selects the next slide at 184.119s. `src/data/wolves-track-zero-slides.ts` owns the identifiers, intervals, and reorder-safe pin; do not move or remove these locks without an explicit owner request. `src/tests/wolvesTrackZeroSlides.test.ts`, `src/tests/wolvesComicReader.test.ts`, and `tests/wolves-movie-flow.mjs` are the independent ordering, rendered-boundary, and player-progress assertions.

**Later-track shuffle**: after the Track 0 hero presentation, the Flickr gallery uses one complete Fisher-Yates shuffle of its available photos across songs 2 onward. It does not group, rotate, reuse, or order photos by title. Once the available pool is exhausted, the final image holds rather than restarting the sequence. This does not change Track 0's authored slideshow or its timing locks. `src/data/wolves-gallery-shuffle.ts` owns the shuffle behavior.

**What agents may touch**:

- Image files in the three wallpaper folders (add or remove, compressed WebP only).
- Title strings in the `curatedTitles` dictionary in `scripts/generate-wallpapers.js`.
- Description strings in the `curatedDescriptions` dictionary in `scripts/generate-wallpapers.js` (verbatim video description text only, per above).
- `src/data/wolves-track-zero-slides.ts` only for an owner-authorized fixed Track 0 slide window.

**What agents must not touch**:

- `src/components/wolves/wallpapers-list.ts` (generated; header says so).
- Any scheduling, shuffling, transition, or pacing code in `WolvesComicReader.vue`, including the `fadeInBuffer` / `fadeOutBuffer` keyframes in its scoped styles, and the `.wallpaper-theater-caption` / `.wallpaper-caption` / `.flickr-caption` CSS and conditional rendering logic itself (only the per-slide `description` content is editable, not the caption mechanism).
- The scan logic in `generate-wallpapers.js`.

Users rely on this flow working predictably. An unauthorized design change here breaks the promise that "add a picture" is always safe.

## Locked Surfaces

Do not modify these under any circumstance. If a task seems to require it, stop and escalate to the user.

- `wolves/index.html` and `src/wolves-main.ts`.
- `src/WolvesApp.vue` and `src/components/wolves/cinematic/*.vue`: phase wiring, layout, transition shell, stage, ads, chat rendering, widget, typography, and telemetry.
- `src/components/wolves/WolvesComicReader.vue`, `WolvesLoreColumn.vue`, `WolvesIntroOverlay.vue`, `WolvesCreatorShortsInterstitial.vue`, and every view in `src/components/wolves/lore/`.
- `src/components/wolves/lore.ts` and `wallpapers-list.ts` (the latter is generated).
- `src/data/wolves-thesis-sequence.ts` (thesis text, mode windows, BPM and phrase constants).
- `src/data/wolves-narrative-timeline.ts` outside an explicitly authorized timing update, and its locked anchors always (currently `arthur-c-clarke-1` at 0:00, `lorem-pursuit-1` at 150 to 220, `blue-universal-acquires-wayland-yutani` at 398 to 425 — the original 0:00 anchor moved to the intro sequence by explicit user request, see Intro Overlay System).
- `src/data/wolves-story.ts` chapter definitions.
- Existing authored lore bodies in `src/data/lore/*.md` (edit only with exact user-supplied replacement text).
- All shared styles, style tokens, class names, transition durations, and keyframes anywhere on the page.
- Script logic in `scripts/generate-wallpapers.js`, `scripts/update-wolves-playlist.js`, and `scripts/update-flickr-photos.js` (data values inside them, like `curatedTitles`, `curatedDescriptions`, and `TEMPO_CONFIGS`, are content).

## Open Surfaces

The complete list of places agents may edit, and nothing else:

| Surface | What is editable |
|---|---|
| `src/data/lore/*.md` | New records; user-supplied edits to frontmatter values and body prose |
| `src/data/wolves-lore-records.ts` | Manifest entries only (`id`, `chapterId`, `relativePath`) |
| `src/data/wolves-incoming-signal.txt` | Top-bar communication lines (one message per line). Affects the top status bar only; never a substitute for thesis or lore text |
| `public/wolves-playlist.json` | Track metadata values; regenerate via `npm run update:wolves-playlist` |
| `src/data/wolves-dinosaur-species.ts` | New registry entries; `scientificName` and `documentationUrl` fixes |
| `public/img/wallpapers/wolves/{wolves,showcase,people}/` | Add or remove WebP images |
| `curatedTitles` in `scripts/generate-wallpapers.js` | Title strings |
| `curatedDescriptions` in `scripts/generate-wallpapers.js` | Optional per-slide theater-caption description text, verbatim from the real source (e.g. a YouTube video description); omit entirely for slides that don't need one |
| `TEMPO_CONFIGS` in `scripts/update-wolves-playlist.js` | Per-track tempo values, when the user supplies them |
| `buildIntroVideoSequence()` in `src/data/wolves-intro-sequence.ts` | Intro-sequence segment data: `video`/`text` kind, `youtubeVideoId`/`audioYoutubeVideoId`, `maxDuration`/`duration`, and character-overlay text/timing/background cues; exact user-supplied copy only |
| `public/wolves-intro/` | Intro-sequence-exclusive artwork (e.g. the Collapse day/night pair); add or remove WebP images referenced only from `wolves-intro-sequence.ts` |
| `src/data/wolves-team-chats.ts` | Message records and `atSeconds` timestamps for the Parts II-VII team chat; dialogue text itself is user-supplied copy only, never agent-generated |
| `src/data/wolves-creator-shorts.ts` | Verified real video ids, titles, creator credit, and orientation in the existing ordered lists |
| `src/data/wolves-org-ads.ts` and `src/assets/wolves/org-ads/` | Exact organization destinations, current official static assets, and attribution; pair order and timing remain locked |

## Editorial Rules

- The user authors all fiction. Agents never generate lore, dialogue, chapter names, prologues, or story explanations. See `docs/skills/editorial-policy.md`.
- Placeholders are standard lorem ipsum only.
- No emojis anywhere: code, comments, commits, docs, responses.
- No ellipses in displayed content added by agents (authored text keeps whatever the user wrote).
- Never truncate, summarize, or shorten content to fix layout. Split long text across sequential timestamps instead, and only with user approval.
- Lore and music order is narrative-driven and chronological. Never reorder, randomize, or rebalance.

## Before You Commit

Run through this every time:

1. `git diff --stat` shows changes confined to the Open Surfaces table above. Any `.vue`, style, or config diff outside the listed exceptions means you crossed the boundary; revert it.
2. No class names, keyframes, transition durations, layout values, or markup structure changed anywhere.
3. Thesis text, timeline anchors (0:00, 150 to 220, 398 to 425), chapter definitions, transition terminal text, and telemetry strings are byte-identical.
4. All prose you added came verbatim from the user or from recovered authored sources.
5. `npm run lint:fix`, `npm run typecheck`, `npm run test:run`, `npm run build` all pass. Leave `public/dakota-versions.json` unstaged; the test suite rewrites it as a side effect.
6. For anything near Track 0: load `/wolves/`, seek the real player to each affected timestamp, and assert the stage nameplate and lower thesis overlay separately. A green build is not verification.
7. For browser verification, run `node tests/wolves-movie-flow.mjs` against a local dev server. Use `http://projectbluefin.io.localhost:<port>/wolves/` for real YouTube playback; numeric loopback origins may receive embed error 150.
8. Conventional commit message, no emojis, `Assisted-by` footer for AI-assisted work.
9. After pushing, a deploy is not done until the pushed SHA's "Deploy to GitHub Pages" workflow succeeds and the affected live timestamp passes the browser check.

## Appendix: Why the Design Is Frozen

These invariants are the reason the design layer is locked. They exist because breaking any of them produced visible failures during development. Agents do not act on this section; it explains what the locks protect.

- Fullscreen image crossfades use linear timing with `will-change: opacity` and `translateZ(0)`. Eased or non-composited fades drop the page to single-digit framerates.
- The crossfade keyframes live inside `WolvesComicReader.vue` scoped styles because scoped compilation attributes make external keyframes unresolvable.
- Timeline slot lookup uses `findIndex(s => time < s.endTime - 0.001)`. Strict boundary checks strand exact timestamps on the previous slide through floating-point error.
- Playback progress is polled at 100ms. Slower polling desynchronizes the HUD text effects from the audio.
- Every flex and grid ancestor of the content viewer carries `min-height: 0` / `min-width: 0` so the 16:10 viewport cannot push the footer off screen, at every breakpoint.
- The desktop split is `2fr 1fr` by mandate; HUD budgets are 80px top and 140px bottom.
- Track galleries snapshot their image sequence per song into component-local reactive arrays. Mutating shared arrays causes repeats and missed slides.
- HUD panels use `rgba(16, 21, 31, 0.45)` with `backdrop-filter: blur(12px)` so the seasonal artwork stays visible under readable text; letterbox gaps stay transparent for the same reason.
- `import.meta.env` is exposed through script-level constants, never bound directly in templates.
- Props that drive playback use immediate watchers because the soundtrack component mounts conditionally.
