---
name: wolves-teaser
description: Use when changing the `/wolves/` teaser hero, Trailer 1 player, browser-rendered trailer plates, poster, bridge, end card, or trailer fidelity tests.
metadata:
  context7-sources:
    - /websites/tailwindcss
---

# Wolves teaser

## Overview

Keep `/wolves/` faithful to the owner-authored Trailer 1 cut while preserving
its role as a teaser website. The page owns a chromeless YouTube iframe, the
browser-rendered plate treatment, the day-to-night wallpaper bridge, the end
card, and links into `/wolves/experience/`.

The trailer design is not derivable from one manifest. Its copy and timing,
visual treatment, composition, and rendered result live in separate
`destiny-vids` sources. Read all of them before changing the recreation.

## When to Use

Use this skill when changing:

- `src/WolvesTeaserApp.vue`
- `src/components/wolves/WolvesTrailerLine.vue`
- `src/data/wolves-trailer-plates.ts`
- `src/tests/wolvesTrailerPlates.test.ts`
- the teaser poster, hero placement, player geometry, plate styling, bridge,
  end card, or trailer-specific assets

## When NOT to Use

- General Wolves show or `/wolves/experience/` runtime work: use
  [`../wolves-runtime-engineering/SKILL.md`](../wolves-runtime-engineering/SKILL.md).
- Back-catalogue records and approved Wolves assets: use
  [`../wolves-content/SKILL.md`](../wolves-content/SKILL.md).
- Guardian cards or share pages: use
  [`../guardian-character-cards/SKILL.md`](../guardian-character-cards/SKILL.md).
- Any design change without direct owner approval: load
  [`../design-gate/SKILL.md`](../design-gate/SKILL.md) and stop at its gate.

## Core Process

1. Read the authoritative `destiny-vids` sources listed below.
2. Re-port copy and timing; never reword or nudge the owner's record locally.
3. Reproduce card design from the card templates, not from the timing manifest.
4. Preserve the three-picture composition and iframe/frame geometry.
5. Pin timing, treatments, segments, and lossless tokenisation in
   `wolvesTrailerPlates.test.ts`.
6. Drive the dev-only `window.__wolvesTeaser` harness to the reference beats.
7. Compare desktop and mobile bounds against the rendered cut.
8. Run lint, typecheck, focused tests, `test:gate`, and build.

## Sources of Truth

All paths in this table are relative to `~/src/destiny-vids`.

| Thing | File |
|---|---|
| Plate schedule and owner copy | `stories/trailer-1-plates.json` |
| Title and end-card design | `cards/maintitle.html` |
| Book-box design | `cards/bookline.html` |
| Day-card design | `cards/daycard.html` |
| Composition and timeline | `scripts/build_trailer1.py` |
| Rendered plates, RGBA 1920×1080 | `renders/plates-trailer-1/*.png` |
| Final comparison picture | `renders/trailer-1.mp4` |

The manifest carries windows and copy. It does **not** carry the design. A
manifest-only implementation can be numerically correct and still look nothing
like the film.

## The Cut Is Three Pictures

The real trailer is three concatenated segments, not one video with overlays:

| Window | Picture |
|---|---|
| 0 → 88.2 | Nightwish video, letterboxed 2.39:1 into 16:9 |
| 88.2 → 102.2 | March Bluefin wallpaper, day fading to night |
| 102.2 → 110.02 | March Bluefin night wallpaper, as the end-card poster |

`BRIDGE_MONTH = 3`; the local assets are:

- `public/img/wallpapers/bluefin-03-day.webp`
- `public/img/wallpapers/bluefin-03-night.webp`

The last 21.8 seconds must cover the embed completely. Both day cards and the
whole end card sit on the wallpaper at full-frame 16:9, with no letterbox.

The bridge's five authored legs are:

| Leg | Seconds |
|---|---:|
| black → day | 1.4 |
| day hold | 1.0 |
| day → night | 4.4 |
| night hold | 1.4 |
| night → black | 5.8 |

They total 14.0 seconds and open and close on black.

## Coordinate Mapping and Sizing

Cards are authored at 1920×1080. The 1920×804 picture occupies y=138..942 in
the letterboxed frame.

- Wallpaper segments are full-frame; percentages map directly.
- Main title is centred at y=540, so it remains 50%.
- Day cards use `top: 58%` directly because they are on the full-frame
  wallpaper, not the letterboxed picture.
- Book anchor `[1030,443]` maps to `left: 53.6%; top: 41%` in the 16:9 frame.
- The second book anchor is `[1000,470]`.

All plate type sizes key off **player width**. Every card clamp resolves to its
maximum at 1920px. Put `container-type: inline-size` on the player and express
plate sizes in `cqw`, where 1cqw is 1% of frame width.

| Element | Card value | px at 1920 | cqw |
|---|---|---:|---:|
| title | `clamp(3.2rem,5.8vw,4.9rem)` | 78.4 | 4.0833 |
| eyebrow | `clamp(1.8rem,3vw,2.6rem)` | 41.6 | 2.1667 |
| subtitle | `clamp(1.5rem,2.4vw,2.1rem)` | 33.6 | 1.75 |
| credits | `1.5rem` | 24 | 1.25 |
| day-card line | `clamp(2.8rem,5vw,5.2rem)` | 83.2 | 4.3333 |
| book line | `3.8rem` | 60.8 | 3.1667 |
| poster CTA | `clamp(2.8rem,5vw,5.2rem)` | 83.2 | 4.3333 |
| poster title | `clamp(1.7rem,2.5vw,2.45rem)` | 39.2 | 2.0417 |
| poster subtitle | `clamp(1.1rem,1.7vw,1.5rem)` | 24 | 1.25 |
| poster tag | `1.1rem` | 17.6 | 0.9167 |

The card root is 16px. `wolves-cinematic.scss` sets the site's root near 10px,
so never copy `rem` values across directly; convert through the px column.

## Authored Treatments

1. **Every B/b and F/f is blue** at `#4285f4`, the Bluefin wordmark blue.
   It is not `--wc-gold` (`#60a5fa`), which is a UI token. Do not apply this
   rule to the Linux Foundation event title or the CTA's b/f.
2. **The O in WOLVES is the Kubernetes helm**, as is the O in *Extinction*.
   Use `public/brands/kubernetes-icon-white.svg`. The existing
   `public/brands/kubernetes.svg` is the blue logo the owner rejected.
3. **A spaced ` | ` is drawn as a sear**, not set as a font glyph. The sear is
   blue heat: flare `rgb(196 226 255)`, mid `rgb(147 197 253)`, halo
   `rgb(37 99 235)`.
4. **Glyph halo, never a scrim.** The owner removed the black box. Contrast
   belongs to the letterforms; a translucent full-card background is a
   regression.
5. **Hairline:** 34% wide on the title, 42% on the poster, 1px,
   `rgb(96 165 250 / 28%)`.
6. **Typeface:** use `--wc-font-display`. Do not use `--wc-font-weyland` or
   `--wc-font-weyland-mono` for the authored plates.

The render host lacked Inter, so the rendered PNGs use DejaVu Sans. The website
has Inter and the card explicitly names the site's display token. Use the
authored token unless the owner asks to reproduce the render host's fallback.

## Plate Schedule

| ID | Window | Notes |
|---|---|---|
| `maintitle-a` | 11.0–15.4 | title only; credits hidden |
| `maintitle-b` | 15.4–22.6 | credits and sear appear; title must not move |
| `book-a` | 26.9–33.64 | four-line box at `[1030,443]` |
| `book-b` | 31.0–34.9 | empty box at `[1000,470]`; overlaps `book-a` |
| `daycard-extinction` | 88.8–93.8 | fade in 0.4; fade out 0.5 |
| `daycard-survival` | 94.4–100.6 | fade in 0.5; fade out 0.6 |
| `endcard-event` | 102.2–110.02 | title, subtitle, hairline |
| `endcard-cta` | 105.2–110.02 | CTA and tags over the event card |

The book box is opaque `rgb(4 10 20)`, with a 4px `#60a5fa` left border,
3px radius, `1.35rem 2rem` card-root padding, line-height 1.7, and max-width
82%. It is not rotated and hard-cuts; it must hide the printed page beneath it.

## Iframe Geometry

The player is the delivered 16:9 frame. Inside it, `.wt-player-frame` is the
clipped 1920:804 picture aperture. Centre a **16:9 iframe** inside that aperture:
its height is 134.328% of the aperture, so YouTube's own top and bottom
letterbox bars fall outside the clipped area. That hides the title/share/logo
chrome without masking or cropping the film itself.

Set `pointer-events: none` on the iframe. Playback belongs to the site's media
widget; allowing pointer hover over the cross-origin iframe asks YouTube to
paint chrome again, and the page cannot style it away. YouTube also paints a
centre play/pause glyph briefly after API playback starts. Keep the opaque
poster over the iframe for the first 8 seconds (and whenever paused); reveal it
before the first authored plate at 11 seconds.

`new YT.Player(div, …)` replaces the host div with the iframe. Target the
resulting iframe through the wrapper's `:deep(iframe)` rule.

YouTube rejects numeric loopback origins. Test at
`http://projectbluefin.io.localhost:5173/wolves/`, not `localhost`.

## Reuse the Wolves Media Widget

`MediaWidget.vue` is store-backed by default and is also the teaser transport.
Its optional `artwork`, `elapsed`, `duration`, and `playing` props activate
external single-track mode without mutating the cinematic store. Keep
`showSkipControls` true by default for the show and set it false for the teaser.
The teaser owns play, pause, replay, and ratio seek through the IFrame API.

Do not copy the widget markup or stylesheet into the teaser. A visual copy
immediately drifts from the show and creates two transport accessibility
surfaces to maintain.

## Inline Mark Trap

Tailwind Preflight sets replaced elements, including `img`, to `display: block`.
Current documentation confirms the reset and recommends adding an `inline`
class when inline behaviour is required (`source: /websites/tailwindcss`).

A helm standing in for a letter must therefore explicitly use
`display: inline`. Otherwise it takes its own line, ignores text centring, and
renders the title as "SEVEN DAYS TO THE W", helm, "LVES".

Also state `width: 100%` on lockup rows. A flex item containing a replaced
element can collapse below the available width and wrap unexpectedly.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The timing manifest is authoritative, so it is enough." | It has no plate design and no three-picture composition. Read the cards and builder. |
| "The iframe should match the 1920:804 aperture." | Chrome then paints over the picture. Use a clipped aperture around a centred 16:9 iframe. |
| "The existing Kubernetes SVG is already available." | It is the blue logo; the authored treatment requires the white symbolic icon. |
| "A dark scrim makes the words safer." | The owner explicitly removed it. Use the authored glyph halo. |
| "The helm is just an image; default image CSS is fine." | Preflight makes it block-level and breaks the word. |
| "The title looks centred." | Measure line count and bounds; visual inspection missed the three-line helm break. |

## Red Flags

- The embed remains visible after 88.2 seconds.
- Day cards appear over the music video instead of the March wallpaper.
- Plate type uses Michroma.
- A plate has a full-card translucent background.
- The title or *Extinction* wraps only when the helm is present.
- YouTube chrome occupies the frame's black bars or overlays the picture.
- A second teaser-only transport copies `MediaWidget` markup or styles.
- The iframe accepts pointer events.
- The event title's B/F is recoloured, or the CTA's b/f is blue.
- Plate timings are adjusted locally rather than re-ported from destiny-vids.

## Verification

- [ ] Compare the browser against `renders/trailer-1.mp4` at 16, 29, 91, and
      107 seconds through `window.__wolvesTeaser.seekTo()`.
- [ ] Main title occupies exactly one computed line-height.
- [ ] Book box centre is 53.6% / 41% for `book-a`.
- [ ] Both day cards report the same vertical centre; only one has a helm, so a
      mismatch means the inline mark is wrapping.
- [ ] Player is fully above the fold on desktop and mobile.
- [ ] No horizontal scroll exists at 1920×1080 or 390×844.
- [ ] A 16:9 iframe is centred at 134.328% height inside the clipped 1920:804
      aperture and has `pointer-events: none`.
- [ ] Playback, pause, replay, and seek work through the external media-widget
      mode; the 8-second start/seek cover and paused poster leave no YouTube
      chrome visible.
- [ ] `src/tests/wolvesTrailerPlates.test.ts`, lint, typecheck, `test:gate`, and
      build pass.
