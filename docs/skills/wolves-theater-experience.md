---
name: wolves-theater-experience
description: Guidelines for managing the fullscreen cinematic immersive experience, double-buffered wallpaper transitions, and single-use cover logic on the Wolves sub-page.
metadata:
  context7-sources: []
---

# Wolves Theater Experience

Use this skill when modifying the immersive fullscreen dashboard, background wallpaper faders, or comic reader layout on the "Seven Days to the Wolves" sub-page (`src/WolvesApp.vue` and `src/components/wolves/WolvesComicReader.vue`).

## When to Use
- Adding or modifying immersive layout styles, HUD headers, and HUD footers.
- Adjusting page-scrolling or slideshow image progression rules.
- Modifying dynamic background transition timings or active monthly wallpaper scheduling.

## When NOT to Use
- General website-wide styling or navigation header updates that do not impact the Wolves experience page state.
- Modifying non-immersive content components outside of the `/wolves` route context.

## Core Process

1. **State Isolation (`isImmersive`):** Toggle layout nodes reactively. Standard page containers (Navbar, standard footer, newsletter block) must be completely hidden using `.immersive-experience-active` wrappers on the body/root nodes.
2. **Double-Buffered Wallpaper Transitions:** Avoid snapping wallpapers. Maintain both an `activeMonth` and a `previousMonth` state. Copy the old index to `previousMonth`, update the new one in `activeMonth`, and apply a smooth transition CSS rule (1.5s crossfade) using a transient transition class.
3. **Single-Use Cover Page Logic:** The comic book cover (Page 1) must be shown strictly on initial mount. The navigation controls, keyboard bindings, and dropdown jumpers must prevent the user from decrementing back to Page 1 or looping back to Page 1 on autoplay end. Wrap all loops and left limits to Page 2.
4. **VFC Base URL Variable Prefixing:** Never bind `import.meta.env` properties directly inside Vue SFC `<template>` elements. Always declare a script-level constant (e.g., `const baseUrl = import.meta.env.BASE_URL`) and reference that in the template to avoid build compiler parser errors.
5. **High-Density Typography:** Telemetry, headers, and footers in immersive mode must remain legible with large scale typography (1.5x larger font sizes) and appropriately budgeted heights (80px header, 120px footer) to prevent vertical layout overflowing.
6. **Content-Aware Dynamic Pacing:** Never use a fixed interval (e.g., static 15s) for rotating sequential texts or dialogue transcripts of variable lengths. Calculate delay dynamically based on character counts (baseline 8s + 45ms per character) and clamp between 10s and 45s.
7. **Soundtrack-Synced Dynamic Pacing:** Monitor play progress of the soundtrack (via `currentTime` on track 0). Speed up slide transition intervals from normal to fast (2s) at 3:21 (201s), and double again to hyper (1s) at 4:17 (257s) to create cinematic, high-impact musical sync.
8. **Playlist-Loop True Shuffling:** To prevent slide repeats or omissions, use a component-local reactive array (`shuffledWallpapers`) rather than direct global array mutation. Play through every slide exactly once per playlist loop, and trigger an automatic reshuffle only when looping back (crossing back to page 2).
9. **Balanced Glassmorphism (Readability + Artwork Exposure):** Ensure seasonal landscape fading wallpapers remain visible under active overlay UI elements by styling HUD panels, headers, footers, and sidebars with high-quality blur (`backdrop-filter: blur(12px)`) and semi-transparent backgrounds (`rgba(16, 21, 31, 0.45)`). Keep text highly legible while letting the background show through.
10. **Firefox lz4 Tab Recovery & Asset Processing:** For browser-tab recovery, decompress `recovery.jsonlz4` by stripping the first 8 bytes, decoding raw LZ4 blocks, and fetching static Flickr image URLs. Process source photos by scaling to 1200px maximum width/height via PIL, converting via `cwebp -q 85` locally, and committing as clean WebP assets.
11. **Vue 3 Mounting Watch Order & Race Conditions:** If a ref is mutated synchronously during `setup()` execution (or inside another immediate watch), registering a downstream watcher on that ref *after* the mutation has occurred will prevent the downstream watcher from triggering on mount, because the mutation occurred before its registration. To solve this, merge the watchers into a single immediate watcher, or register the downstream watcher first.
12. **Decoupled Slideshow Playback for Async Assets:** Always initialize reactive arrays (e.g., `shuffledWallpapers`) and metadata counts (`totalPages`) directly from static definitions during setup, rather than waiting for an asynchronous task (e.g., `loadComicPdf()`) to complete. Gating the main slideshow by async file downloads or CDNs causes fragile loading-state deadlocks. Decouple non-async rendering from async setups by only gating the specific elements that require the async asset (e.g., gating page 1 cover rendering, but leaving pages 2+ free to play immediately).
13. **Immediate Watchers for Conditional Mounting:** If a media component (e.g., `<WolvesSoundtrack>`) is conditionally mounted (e.g., inside `v-else` of an immersive toggle), any initial `playing` prop state set to `true` synchronously during the toggle will be missed by non-immediate `watch(props.playing)` watchers. Always use `{ immediate: true }` on props that drive audio/video playback or hardware integrations to ensure immediate activation upon mount.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "A 50/50 desktop split is fine for the Wolves page." | The Wolves page desktop layout has a strict mandate to use a `2fr 1fr` grid template to allocate 66% width to the slides and 33% width to the lore column. |
| "It's fine to bind `import.meta.env` directly in the template." | This causes fragile VFC parser compiler failures on specific bundlers/minifiers. Expose it via a script-level constant. |
| "We can let the user go back to the cover page." | The cover is a high-impact intro that gets the user into the experience. Letting them step back into it is visual clutter that interrupts the wallpaper-fading show. |
| "A randomized array in-place is good enough for shuffling." | Mutation of a global constant array breaks Vue reactivity and causes severe repeats or missed slides. Local reactive loop-back shuffle is required. |
| "Solid backgrounds are safer for text readability." | Completely solid backgrounds hide the seasonal fading artworks that are critical to the theater experience. Use rgba(16, 21, 31, 0.45) with blur(12px) to maximize both artwork visibility and text contrast. |

## Red Flags
- Snapping monthly wallpapers without double-buffered crossfading.
- Hardcoded pixel sizes or missing responsive viewport calculations in immersive mode.
- Emojis used in code comments or templates (the user hates emojis; never use them).
- Mutation of global constant arrays for slideshow item rotations.
- Completely opaque HUD backgrounds that block the background seasonal art.

## Verification
- [ ] No emojis in changed files or comments.
- [ ] Build completes cleanly with `npm run build`.
- [ ] Typecheck succeeds with `npm run typecheck`.
- [ ] All unit tests pass with `npm run test:run`.
- [ ] Double-buffered state successfully transitions backgrounds over 1.5s.
- [ ] Slideshow plays sequentially through every item once per loop without duplicate repeats.
- [ ] Backdrop filters and opacity balances remain performant with no layout lag on mobile viewports.
