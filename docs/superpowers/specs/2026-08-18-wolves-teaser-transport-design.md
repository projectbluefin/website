# Wolves Teaser Transport Design

## Goal

Hide YouTube's title/share/logo chrome and use the existing Wolves music-widget treatment as the teaser's only transport, while keeping **Seven Days to the Wolves** above the video.

## Approved behavior

- The page owns a 16:9 frame and a clipped 1920:804 picture viewport.
- A 16:9 YouTube iframe is centred inside that picture viewport. YouTube's own letterbox bars—and the chrome painted into them—fall outside the clipped viewport.
- The iframe receives no pointer events, so hover cannot restore YouTube controls.
- The opaque poster covers YouTube's transient centre glyph for the first 8 seconds after play/seek and whenever paused; it clears before the first authored plate at 11 seconds.
- `MediaWidget.vue` remains store-backed by default. Optional external playback props let the teaser provide title, artwork, elapsed time, duration, playing state, and progress without mutating the cinematic store.
- The teaser widget emits play/pause and seek to `WolvesTeaserApp.vue`.
- Previous/next controls are hidden for the single trailer.
- The central Watch/Replay buttons are removed. The poster remains until the widget starts playback.
- The widget is visible while idle or ended and auto-hides during playback.

## Boundaries

- Do not change the embedded video id or authored plate copy/timing.
- Do not change `MediaWidget` behavior for the full Wolves experience.
- Do not add a second widget implementation or duplicate its stylesheet.
- Preserve title/video bounds: the complete video remains above the 1920×1080 fold and no horizontal scroll appears at 390×844.

## Verification

- Existing `wolvesMediaWidget` tests remain green.
- New tests pin external title/artwork/time/progress/play state and hidden skip controls.
- Chromium proves the iframe is 16:9, clipped by the 1920:804 viewport, and pointer-inert.
- Chromium proves widget play/pause/seek controls the teaser clock.
- Desktop and mobile bounds remain valid.
