---
name: wolves-theater-experience
description: Guidelines for managing the fullscreen cinematic immersive experience, double-buffered wallpaper transitions, and integrated cover navigation on the Wolves sub-page.
metadata:
  context7-sources: []
---

# Wolves Theater Experience

Use this skill when modifying the immersive fullscreen dashboard, background wallpaper faders, or comic reader layout on the "Seven Days to the Wolves" sub-page (\`src/WolvesApp.vue\` and \`src/components/wolves/WolvesComicReader.vue\`).

## When to Use
- Adding or modifying immersive layout styles, HUD headers, and HUD footers.
- Adjusting page-scrolling or slideshow image progression rules.
- Modifying dynamic background transition timings or active monthly wallpaper scheduling.

## When NOT to Use
- General website-wide styling or navigation header updates that do not impact the Wolves experience page state.
- Modifying non-immersive content components outside of the \`/wolves\` route context.

## Core Process

1. **State Isolation (\`isImmersive\`):** Toggle layout nodes reactively. Standard page containers (Navbar, standard footer, newsletter block) must be completely hidden using \`.immersive-experience-active\` wrappers on the body/root nodes.
2. **Double-Buffered Wallpaper Transitions:** Avoid snapping wallpapers. Maintain both an \`activeMonth\` and a \`previousMonth\` state. Copy the old index to \`previousMonth\`, update the new one in \`activeMonth\`, and apply a smooth transition CSS rule (1.5s crossfade) using a transient transition class.
3. **Integrated Cover Page Navigation:** The comic book cover (Page 1) is a fully integrated, standard part of the theater presentation. Navigation controls, keyboard bindings, and dropdown jumpers must allow the user to freely navigate back to Page 1, step backwards, and loop back to Page 1 upon autoplay completion.
4. **VFC Base URL Variable Prefixing:** Never bind \`import.meta.env\` properties directly inside Vue SFC \`<template>\` elements. Always declare a script-level constant (e.g., \`const baseUrl = import.meta.env.BASE_URL\`) and reference that in the template to avoid build compiler parser errors.
5. **High-Density Typography:** Telemetry, headers, and footers in immersive mode must remain legible with large scale typography (1.5x larger font sizes) and appropriately budgeted heights (80px header, 140px footer) to prevent vertical layout overflowing.
6. **Content-Aware Dynamic Pacing:** Never use a fixed interval (e.g., static 15s) for rotating sequential texts or dialogue transcripts of variable lengths. Calculate delay dynamically based on character counts (baseline 8s + 45ms per character). Slow speakers (e.g. \`BUR//S\`, \`SARAH\`) type at 1/3 speed with massive punctuation pauses; increase their base buffer to 12s and multiplier to 180ms, clamping between 10s and 120s to ensure clean user experience.
7. **Soundtrack-Synced Dynamic Pacing (Alpha 1 Configuration):** Monitor play progress of the soundtrack (via \`currentTime\` on track 0). This perfect baseline setup, designated as Alpha 1, speeds up slide transition intervals from normal to fast (2s) at 3:21 (201s), and doubles again to hyper (1s) at 4:17 (257s) to create cinematic, high-impact musical sync.
8. **Playlist-Loop True Shuffling:** To prevent slide repeats or omissions, use a component-local reactive array (\`shuffledWallpapers\`) rather than direct global array mutation. Play through every slide exactly once per playlist loop, and trigger an automatic reshuffle only when looping back (crossing back to page 2).
9. **Balanced Glassmorphism (Readability + Artwork Exposure):** Ensure seasonal landscape fading wallpapers remain visible under active overlay UI elements by styling HUD panels, headers, footers, and sidebars with high-quality blur (\`backdrop-filter: blur(12px)\`) and semi-transparent backgrounds (\`rgba(16, 21, 31, 0.45)\`). Keep text highly legible while letting the background show through.
10. **Firefox lz4 Tab Recovery & Asset Processing:** For browser-tab recovery, decompress \`recovery.jsonlz4\` by stripping the first 8 bytes, decoding raw LZ4 blocks, and fetching static Flickr image URLs. Process source photos by scaling to 1200px maximum width/height via PIL, converting via \`cwebp -q 85\` locally, and committing as clean WebP assets.
11. **Vue 3 Mounting Watch Order & Race Conditions:** If a ref is mutated synchronously during \`setup()\` execution (or inside another immediate watch), registering a downstream watcher on that ref *after* the mutation has occurred will prevent the downstream watcher from triggering on mount, because the mutation occurred before its registration. To solve this, merge the watchers into a single immediate watcher, or register the downstream watcher first.
12. **Decoupled Slideshow Playback for Async Assets:** Always initialize reactive arrays (e.g., \`shuffledWallpapers\`) and metadata counts (\`totalPages\`) directly from static definitions during setup, rather than waiting for an asynchronous task (e.g., \`loadComicPdf()\`) to complete. Gating the main slideshow by async file downloads or CDNs causes fragile loading-state deadlocks. Decouple non-async rendering from async setups by only gating the specific elements that require the async asset (e.g., gating page 1 cover rendering, but leaving pages 2+ free to play immediately).
13. **Immediate Watchers for Conditional Mounting:** If a media component (e.g., \`<WolvesSoundtrack>\`) is conditionally mounted (e.g., inside \`v-else\` of an immersive toggle), any initial \`playing\` prop state set to \`true\` synchronously during the toggle will be missed by non-immediate \`watch(props.playing)\` watchers. Always use \`{ immediate: true }\` on props that drive audio/video playback or hardware integrations to ensure immediate activation upon mount.
14. **Build-Time Automated Wallpaper Discovery:** Instead of maintaining a hardcoded static wallpapers array in the Vue SFC (which makes manual addition/removal of assets error-prone), use a build-time script (\`scripts/generate-wallpapers.js\`) to scan the asset folders (\`public/img/wallpapers/wolves/{wolves,showcase,people}\`) and compile them into a type-safe \`src/components/wolves/wallpapers-list.ts\` module. This script must automatically group Day & Night pairs (e.g., combining \`-day\` and \`-night\` files), match curated human titles from a mapped dictionary, and generate fallback titles from basenames for newly added files. Wire the script to run as part of the \`build\` and \`dev\` pipelines in \`package.json\` to ensure immediate and automatic updates on disk change.
15. **Dynamic CNCF/Flickr Ingestion & Shuffling:** The Flickr harvesting pipeline (\`scripts/update-flickr-photos.js\`) uses \`flickr.photos.search\` on CNCF user ID (\`143247548@N03\`) with \`text=Maintainer\` to collect the bulk of photos (~400 photos) from past and present summits. It combines this with a chronological sample of general community photos (~100 photos), filters out duplicates, and shuffles the combined pool completely before caching it to \`public/flickr-photos.json\` to prevent event repetition.
16. **Weekly Automated Content Updates:** To keep the site dynamic with fresh community events, the GitHub Actions workflow \`update-content.yml\` runs weekly on Sundays at 10:00 UTC. It executes the Flickr harvester, caches the JSON feed, and automatically dispatches a deployment of \`deploy.yml\` via the GitHub CLI on success, keeping the static production assets updated with fresh community data.
17. **No Adjacent Showcase Constraint:** To prevent product clustering, the slideshow computed array (\`mixedPhotos\`) on Tracks 2-6 enforces a strict interleaving constraint (1:2 ratio) that starts with a showcase photo at Slide 0 and mathematically prevents any two showcase photos from being adjacent (back-to-back) in the slide stream, skipping showcase pushes if the community/people queue runs dry.
18. **Transition Animation Keyframes:** Double-buffer crossfade transitions require the \`@keyframes fadeInBuffer\` and \`fadeOutBuffer\` declarations to be defined directly inside the scoped styles of \`WolvesComicReader.vue\`. Since scoped styles inject unique compilation attributes to selectors, external or parent-scoped keyframes will not resolve on the slideshow elements.
19. **Timeline-Driven Beat-Matched Slideshow (Track 0):** Guarded by \`isExperimental = true\`. Parses the 423-second first song into a 6-section timeline (Intro, Verse 1, Verse 2/Chorus, Bridge, Build-Up, and Climax) to schedule all 167 wallpapers exactly once without duplicates, using a pure deterministic sine-based PRNG shuffle. Slide transitions dynamically adjust their duration (e.g., 30% of slide length) to keep up with the fast-paced climax (down to 1.18s per slide).
20. **Exclusive CNCF Flickr stream for Live Gallery Mode (Tracks 1-6):** To prevent curated duplicate images from repeating across the playlist session, restrict Tracks 1-6 to pull exclusively from remote CNCF Flickr photos, falling back to local slides only if remote results are empty.
21. **6-Second Seasonal Equinox Transition Fader:** During track changes, a global 6-second Equinox state machine in \`WolvesApp.vue\` displays a full-screen night-sky background overlay. This minimizes visual jank by gracefully fading out the active slideshow content and providing a clean boundary ("a new season") between different songs.
22. **Continuous Timeline Boundary Matching:** When calculating the active slide for a continuous timeline (where Slide A ends exactly when Slide B begins), avoid boundary checks like \`find(s => time >= s.startTime && time < s.endTime)\`. Floating point micro-gaps can cause this to return \`null\` and create a 1-frame stutter to a fallback cover. Instead, use \`findIndex(s => time < s.endTime)\` to safely snap to the active slide.
23. **GPU Hardware Acceleration for Crossfading:** Fading massive full-screen background images via main-thread opacity properties creates severe framerate drops (e.g., 5fps jank). Always apply \`will-change: opacity\`, \`transform: translateZ(0)\`, and a \`linear\` timing function to force the browser to use GPU compositor hardware acceleration for \`.wallpaper-buffer-layer\`, \`.night-layer\`, and \`.flickr-photo-layer\`.
24. **High-Frequency Audio Progress Sync:** Standard 1000ms \`setInterval\` polling for media player progress creates up to 999ms of latency, which ruins the timing of tight HUD-synced animations (like typewriter or glitch effects). Increase broadcast intervals to 100ms (10Hz) to enable smooth UI synchronization without thrashing the main thread.
25. **Legacy Markdown Speaker/SFX Standardization:** Legacy lore files lacking proper markdown formatting (missing bold **SPEAKER** tags or lacking double-newlines) will collapse into Monolithic "SYSTEM" dumps. Run a fast normalization regex across the body before split (`/\\n(?=(?:\\*\\*[^*]+\\*\\*|[A-Z0-9-]+)(?:\\s+\\[[^\\]]+\\])?:|<[^>]+>)/gi`) to insert \`\\n\\n\` padding, guaranteeing proper speaker mapping.
26. **Immersive HUD Layout Aspect-Ratio Avoidance:** Do not let a fixed-aspect-ratio child component (like a 16:10 \`.comic-viewport\`) dictate the size of its parent grid row and force sibling rows off-screen on extreme viewports. Cascade \`min-height: 0\` and \`min-width: 0\` down the DOM hierarchy of all flex/grid parents enclosing it to ensure flex containers compress correctly. Absolute UI widgets (e.g. \`.hud-announcement-area\`) should use absolute centering (\`left: 50%; top: 50%; transform: translate(-50%, -50%)\`) within padded footers to prevent flex-box squeezing/truncation of peers like the soundtrack dock.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "A 50/50 desktop split is fine for the Wolves page." | The Wolves page desktop layout has a strict mandate to use a \`2fr 1fr\` grid template to allocate 66% width to the slides and 33% width to the lore column. |
| "It's fine to bind \`import.meta.env\` directly in the template." | This causes fragile VFC parser compiler failures on specific bundlers/minifiers. Expose it via a script-level constant. |
| "We can let the user go back to the cover page." | The cover is an essential part of the presentation that must remain accessible for reading the first quote and viewing the coloring book, so all standard navigation back to page 1 must be preserved. |
| "A randomized array in-place is good enough for shuffling." | Mutation of a global constant array breaks Vue reactivity and causes severe repeats or missed slides. Local reactive loop-back shuffle is required. |
| "Solid backgrounds are safer for text readability." | Completely solid backgrounds hide the seasonal fading artworks that are critical to the theater experience. Use rgba(16, 21, 31, 0.45) with blur(12px) to maximize both artwork visibility and text contrast. |
| "Maintaining a static array is simpler and doesn't require a script." | A static list is prone to rot, mismatched paths, and requires editing code to add or remove images. An automated build-time generator is completely robust, matches the folder structure on disk automatically, and lets non-developers edit the slideshow by just managing files in Nautilus. |
| "An ease-in-out curve looks better for crossfading wallpapers." | Applying complex easing curves to massive full-screen images on the main thread causes layout thrashing and 5fps stuttering. Use linear timing and hardware acceleration (\`translateZ(0)\`). |
| "A 1-second progress poll is fast enough for the YouTube player." | A 1000ms poll interval causes up to 999ms of latency between the audio and the UI state, causing text animations to appear out of sync or delayed. Use 100ms. |

## Red Flags
- Snapping monthly wallpapers without double-buffered crossfading.
- Hardcoded pixel sizes or missing responsive viewport calculations in immersive mode.
- Emojis used in code comments or templates (the user hates emojis; never use them).
- Mutation of global constant arrays for slideshow item rotations.
- Completely opaque HUD backgrounds that block the background seasonal art.
- \`ease-in-out\` transitions on massive background image opacity (causes 5fps stuttering).
- Using strict \`time >= start && time < end\` boundary checks for continuous timelines (causes 1-frame micro-gap stutters).
- 1000ms poll loops for audio progress when syncing fast UI text effects.
- Truncating tracks or UI elements due to flexbox \`min-height: auto\` resistance on 16:10 image displays pushing footers off-screen.

## Verification
- [ ] No emojis in changed files or comments.
- [ ] Build completes cleanly with \`npm run build\`.
- [ ] Typecheck succeeds with \`npm run typecheck\`.
- [ ] All unit tests pass with \`npm run test:run\`.
- [ ] Double-buffered state successfully transitions backgrounds over 1.5s.
- [ ] Slideshow plays sequentially through every item once per loop without duplicate repeats.
- [ ] Backdrop filters and opacity balances remain performant with no layout lag on mobile viewports.
- [ ] Hardware acceleration (\`translateZ(0)\` and \`will-change: opacity\`) is applied to fullscreen crossfading layers.
- [ ] Timeline boundaries use \`findIndex(s => time < s.endTime)\` to prevent floating-point stutter.
- [ ] Flex grids scale proportionally on 16:9 1080p, 1440p, and mobile views without overflowing the 100vh viewport due to missing \`min-height: 0\`.

### Additional Architectural Rules
27. **Transparent Letterboxing:** When using `object-fit: contain` for wallpapers and Flickr photos, set the container `background-color: transparent` instead of a solid black or dark hex color. This allows the underlying seasonal wallpapers to remain visible through the letterbox gaps instead of being blocked by black bars.
28. **Chapter-Specific Lore Filtering:** Lore rotation filtering MUST partition by `chapterId`. Unifying or dumping all lore entries into a single list causes resets on page transitions that prevent the reader from ever reaching the end of the list (e.g. omitting the final Wayland Yutani quote). Always preserve `id` and `chapterId` when mapping CMS artifacts.
29. **Accessible Custom Sliders:** Any UI element styled as a progress bar with `role="slider"` must have corresponding keyboard handlers (e.g. `@keydown` for ArrowRight/ArrowLeft to increment/decrement value) and provide `aria-valuemin`/`aria-valuemax` bounds to be compliant and operable for assistive-technology users.
30. **1-to-1 Page-Lore Lock Synchronization:** The active lore transmission or quote must be driven directly by the active page of the comic reader (pages 1 to 20), mapping to exact story intercept IDs (e.g., Page 1 to 'arthur-c-clarke-4', Page 9 to Sarah's conversation 'lorem-pursuit-1', and Page 20 to the final Yutani quote 'blue-universal-acquires-wayland-yutani'). All automatic rotation timers and background shifts must be completely suppressed when page-driven to ensure a book-like chronological experience where pages do not randomly shuffle or skip ahead of the reader. Previous/next navigation buttons in the transcript card must emit page updates back to the orchestrator to sync the reader.
