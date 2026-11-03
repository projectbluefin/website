---
name: design-gate
description: Use when a request could alter layout, markup, component behavior, styling, typography, navigation, responsive behavior, or animation.
metadata:
  context7-sources:
    - /websites/vuejs
---

# Design gate

## Overview

Prevent content work from changing the frozen production design.

## When to Use

Use before touching a Vue template, component, SCSS, Tailwind class, layout
value, breakpoint, navigation rule, control, or animation.

## When NOT to Use

Do not use for content-only changes that stay in documented data surfaces.

## Core Process

1. Identify the exact file and visual surface.
2. Stop unless the user explicitly approved design work.
3. Record the approved scope.
4. Verify desktop and mobile behavior in a browser.
5. Run the relevant validation.

Do not shrink type, alter spacing, change markup, or change timing to make
supplied content fit.

For a visual size or collision request, assert the affected elements'
`getBoundingClientRect()` values in the browser. CSS dimensions alone are not
proof of the rendered result because containing blocks and responsive rules can
constrain them.

For transparent decorative artwork, record three geometries separately: the
element rectangle, the alpha-visible artwork rectangle, and the alpha-visible
intersection with the viewport. A global `overflow-x: hidden` can conceal real
clipping while the element still extends beyond the viewport. When a report
names the "site" rather than a route, inspect every production entry point that
owns the referenced artwork instead of stopping at the first matching symbol.

When artwork has substantial transparent padding, reserve a layout column by
its alpha-visible aspect ratio, then scale and offset the unchanged source
image inside that box. This keeps its visible size independent of viewport
height and avoids placing decoration over the content it illustrates. The
server page uses this in `.field-artwork` in `src/ServerApp.vue`. Re-scan the
served image's alpha channel with canvas `drawImage` / `getImageData` after an
asset replacement; the bounds are not transferable between assets.

Server-only system themes belong in the scoped `.server-page` media rules in
`src/ServerApp.vue` and media-qualified image preloads in `server/index.html`.
Do not set shared `:root` tokens or add a persisted override for a single-route
request. Fence `.col-demos` with its original dark tokens: inherited light
colors would otherwise change the demo's active tabs and feature panels.
Navbar overrides stay under `.server-page :deep(.docusaurus-navbar)`, not in
`TopNavbar.vue`.
Parent overrides must outrank nested scoped rules; a day `.quote-label`
selector can lose to the later `.quote-box .quote-label` rule.

For isolated overlay copy, use a classed element instead of a bare semantic tag
when the site has global element styling. A global `footer` rule can introduce
panel paint, stacking, or padding that defeats component-scoped styles.

For an asset-backed heading, keep a semantic `h1` and the image's accessible
name. Preserve a local padding reset: global heading styles otherwise add
space above and beside the image. Wait for `useFadeInUp` to reach opacity 1
before judging the wordmark's color or spacing. The server's light/dark SVGs
are copied unchanged from `projectbluefin/artwork`; their pinned source and
license are recorded in `public/licenses/ublue-family-artwork-NOTICE.txt`.

For desktop-only decorative labels adjacent to the fixed media widget, position
them relative to the widget and hide them at the desktop breakpoint. Measure
both label bounds and the widget before approving the layout.

When exploring new top-level product identities (such as Bluefin vs.
Bluefin Server), build throwaway comparative mockups in an isolated workspace
such as `/var/tmp/website-agent/` rather than modifying production routes before
a direction is selected. When validating candidate layouts, test both desktop and
mobile viewports against real brand assets: confirm wordmark SVGs keep their
intrinsic aspect ratio, transparent artwork (`alamosaurus.webp`, `bluefin.webp`)
does not produce horizontal viewport overflow (`scrollWidth > innerWidth`), and
shared navigation surfaces reflect reciprocal links between the product identities.

## Common Rationalizations

- "The CSS width is larger, so the rendered element must be larger." A grid,
  flex item, transform, or containing block can still constrain it; measure
  the rendered bounds.
- "A local build proves the visual change." Builds do not expose overlaps,
  clipping, or viewport-bound failures; check the affected route in a browser.

## Red Flags

- "Small" spacing or typography changes without approval.
- Component edits made to solve a content request.
- A visual change verified only by a build.

## Verification

- [ ] Explicit approval predates the edit.
- [ ] Diff stays inside the approved surface.
- [ ] Desktop and mobile browser checks pass.
- [ ] Transparent artwork: scan alpha greater than zero, project those bounds
  through the rendered image rectangle, and measure viewport intersection.
  Check 1024×768, 1440×900, 1920×1080, 1440×1400, and 390px mobile.
- [ ] No unrelated design file changed.
- [ ] System themes: emulate light → dark → light without reloading, verify
  matching wallpaper/preload/theme-color metadata, and compare demo styles
  and the homepage baseline. Wait for existing color transitions to settle
  before comparing computed colors.

## References

- `../../reference/wolves-runtime.md`
- `../validation/SKILL.md`
- Vue scoped selectors and CSS `v-bind()`: https://vuejs.org/api/sfc-css-features
