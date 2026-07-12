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
6. **Content-Aware Dynamic Pacing:** Never use a fixed interval (e.g., static 15s) for rotating sequential texts or dialogue transcripts of variable lengths. Calculate delay dynamically based on character counts (baseline 8s + 45ms per character) and clamp between 10s and 45s to ensure the user has sufficient time to both watch the typewriter run and comfortably read the finished blocks.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "A 50/50 desktop split is fine for the Wolves page." | The Wolves page desktop layout has a strict mandate to use a `2fr 1fr` grid template to allocate 66% width to the slides and 33% width to the lore column. |
| "It's fine to bind `import.meta.env` directly in the template." | This causes fragile VFC parser compiler failures on specific bundlers/minifiers. Expose it via a script-level constant. |
| "We can let the user go back to the cover page." | The cover is a high-impact intro that gets the user into the experience. Letting them step back into it is visual clutter that interrupts the wallpaper-fading show. |

## Red Flags
- Snapping monthly wallpapers without double-buffered crossfading.
- Hardcoded pixel sizes or missing responsive viewport calculations in immersive mode.
- Emojis used in code comments or templates (the user hates emojis; never use them).

## Verification
- [ ] No emojis in changed files or comments.
- [ ] Build completes cleanly with `npm run build`.
- [ ] Typecheck succeeds with `npm run typecheck`.
- [ ] All unit tests pass with `npm run test:run`.
- [ ] Double-buffered state successfully transitions backgrounds over 1.5s.
