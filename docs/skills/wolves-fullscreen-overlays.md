---
name: wolves-fullscreen-overlays
description: Use when building or debugging a fullscreen overlay (intro video, cinematic, modal takeover) inside the Wolves immersive experience, or when embedding third-party video via the YouTube IFrame Player API anywhere on the Wolves page. Covers the containing-block gotcha that silently confines "fullscreen" overlays and the testability traps specific to the YouTube IFrame API.
---

# Wolves Fullscreen Overlays & YouTube IFrame Embeds

Engineering patterns for building overlays that must cover the entire Wolves
immersive experience (top bar, slideshow, lore column), and for embedding
third-party video legitimately via YouTube's IFrame Player API. Learned while
building the intro-video overlay system; both traps below produced visible
bugs before being understood.

## When to Use

- Adding any overlay, modal, or cinematic that must render above the entire
  `/wolves` immersive layout, not just above its own parent component.
- Embedding a YouTube video anywhere on the Wolves page via the IFrame Player
  API (the only legitimate way to show third-party video — never download or
  re-encode someone else's footage locally).
- Writing or debugging tests for a component that loads the YouTube IFrame API
  script or that teleports content to `document.body`.

## When NOT to Use

- Content-only edits to lore, playlist metadata, or slideshow images — see
  `docs/skills/wolves-content-maintenance.md` instead.
- Any component that doesn't need to escape its own layout box (most of the
  page's components render fine in their natural DOM position).

## Core Process

1. **`position: fixed` alone does not guarantee full-viewport coverage.**
   Several ancestors in `WolvesApp.vue`'s immersive layout use
   `transform: translateZ(0)` (for GPU-accelerated crossfade/parallax layers).
   A CSS `transform` on *any* ancestor creates a new containing block for
   `position: fixed` descendants, silently rescoping "fullscreen" to that
   ancestor's box instead of the real viewport. A component nested deep in
   the layout (e.g. inside the footer soundtrack dock) that renders a
   `position: fixed; inset: 0` overlay will appear confined to its own
   widget, not the whole page — with no console error or visual glitch
   marking the cause.
2. **Fix: `<Teleport to="body">` around the overlay's root element in the
   template**, not just fixed positioning. This makes the overlay a true
   top-level DOM sibling, immune to every ancestor's transform/filter/
   perspective, guaranteeing it renders above literally everything else
   pushed onto the page.
3. **Testing teleported content**: `@vue/test-utils`'s `wrapper.find()` /
   `wrapper.get()` only search the component's own render tree, which no
   longer includes teleported content. Query `document.body` directly instead
   (e.g. `document.body.querySelector('.my-overlay')`), and dispatch real DOM
   events (`element.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
   rather than Test Utils' wrapper-scoped `.trigger()`.
4. **YouTube IFrame API script-loading is not a true singleton in
   `<script setup>`.** A top-level `let` in `<script setup>` looks like module
   scope but is actually per-component-instance state — fresh on every
   `mount()` in tests. If you need genuinely shared, cached state (e.g. "has
   the IFrame API script already been requested"), extract it into a real
   `.ts` module (see `src/composables/useYoutubeIframeApi.ts`). Because a real
   module-level cache persists across the whole test run, export a test-only
   reset function (e.g. `resetYoutubeIframeApiCacheForTests()`) and call it in
   both `beforeEach` and `afterEach`.
5. **happy-dom rejects real `<script src>` loads by default.** Appending a
   script tag with a real URL throws `NotSupportedError: JavaScript file
   loading is disabled` synchronously, which happy-dom converts into an
   immediate `error` event — meaning any `catch`/`onerror` path in your loader
   fires before your test ever gets to mock the API. Set
   `(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true`
   in `beforeEach` for any test exercising this path.
6. **Guard async loaders after every `await`, not just the first.** An async
   function with two sequential `await`s (e.g. `await loadYoutubeIframeApi()`
   then later `await nextTick()`) must re-check for a cancelled/skipped state
   after *each* await, not only the first. A fast user action (like clicking
   Skip) can land in the gap between two awaits — this becomes more likely,
   not less, once the API is already cached from an earlier action in the
   same test run, since the first await then resolves near-instantly.
7. **The debug scrub bar's real player poll loop can silently overwrite the
   value you just set.** `WolvesIntroOverlay.vue` polls the live `YT.Player`'s
   `getCurrentTime()` every ~200ms to drive `currentTime`. When frame-verifying
   a cue boundary by programmatically setting the debug scrub `<input>`'s
   value and dispatching an `input` event, reading any derived state (which
   guardian plate is showing, the displayed time readout) more than ~300ms
   later lets that poll loop drift `currentTime` forward past your intended
   target, producing a false read that looks like the boundary is off by a
   noticeable amount when it isn't. Read the state immediately after
   dispatching the scrub event, and cross-check against the on-screen time
   readout (e.g. `.wolves-intro-overlay-debug-time`) rather than assuming your
   requested value took effect.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's `position: fixed`, so it's already fullscreen." | Only if no ancestor has `transform`, `filter`, `perspective`, or `will-change: transform`. This layout has several. Verify by checking whether the overlay visually covers the whole page, not just by reading its own CSS. |
| "`wrapper.find()` didn't find it, so the overlay isn't rendering." | If the component uses `<Teleport to="body">`, the render tree the wrapper walks doesn't include it. Check `document.body` before concluding it's broken. |
| "I already loaded the YouTube API once this test file, no need to reset." | The module-level cache is a true singleton across the whole file. Skipping the reset leaks state into later tests and produces flaky, order-dependent failures. |
| "One `await` guard at the top of the function is enough." | Only protects against cancellation before the first await. A second await reopens the race window. |
| "The plate name changed right after I scrubbed, so the boundary must be off." | Check how long you waited before reading. If it's more than ~300ms, the poll loop may have already advanced `currentTime` past your target — re-test with an immediate read and cross-check the time readout. |

## Red Flags

- A "fullscreen" overlay that visually appears confined to a widget, card, or
  section instead of the whole page.
- Tests for a teleported component using `wrapper.find()`/`wrapper.get()`
  and getting empty results with no clear reason.
- `NotSupportedError: JavaScript file loading is disabled` in test output when
  a component loads any real external script URL.
- A test that passes in isolation but fails when run after another test that
  also loads the YouTube IFrame API (order-dependent failure — missing cache
  reset).
- Async loading logic with `await X(); ...; await Y();` where only the check
  right after the first await exists.
- Any local video file under `public/videos/` sourced from third-party
  footage — this repository only permits YouTube IFrame embeds for
  third-party video, never downloaded/re-encoded copies.
- A cue-boundary verification that reads state hundreds of milliseconds after
  setting the debug scrub value, rather than immediately — the reading may
  reflect a poll-drifted time, not the value you actually set.

## Verification

- [ ] The overlay is wrapped in `<Teleport to="body">` and manually confirmed
      (in a real browser, not just a green test suite) to cover the entire
      viewport — top bar, slideshow, and lore column all included.
- [ ] Tests for teleported content query `document.body`, not the component
      wrapper.
- [ ] Any new YouTube IFrame API consumer either reuses
      `src/composables/useYoutubeIframeApi.ts` or, if it introduces its own
      cache, exports and calls a test-reset function in `beforeEach`/`afterEach`.
- [ ] `(window as any).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true`
      is set in `beforeEach` for any test exercising real script-tag loading.
- [ ] Every `await` in an async loading/guard function is followed by a
      freshness re-check before creating side effects (players, timers, DOM
      nodes).
- [ ] No third-party video is downloaded or re-encoded locally; only
      `youtubeVideoId` + IFrame Player embeds are used.
- [ ] Any cue-boundary frame verification reads state immediately after
      dispatching the scrub event and cross-checks the on-screen time
      readout, not just the requested scrub value.
