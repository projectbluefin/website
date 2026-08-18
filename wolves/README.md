# Wolves

## Boundary

**Agents edit content. Agents never edit design.**

`/wolves/` is the teaser page (hero, Trailer 1 recreation, back catalogue).
The shipped fullscreen experience lives at `/wolves/experience/` — moved there
2026-08-17 when the teaser took the front door. Content work on the experience
uses the sources listed in `docs/reference/wolves-runtime.md`. Do not change
layout, markup, styles, controls, animation, player synchronization, or runtime
behavior for a content request.

## Runtime

- Teaser entry: `wolves/index.html` → `src/wolves-teaser-main.ts` →
  `src/WolvesTeaserApp.vue`. Trailer plate schedule:
  `src/data/wolves-trailer-plates.ts` (ported verbatim from destiny-vids
  `stories/trailer-1-plates.json`; re-port on a recut, never reword here).
- Experience entry: `wolves/experience/index.html`
- Mount: `src/wolves-main.ts` and `src/WolvesApp.vue`
- State: `src/stores/cinematic.ts`
- Intro data: `src/data/wolves-intro-sequence.ts`
- Segment data: `src/config/wolves-cinematic.ts`
- Album deep link: `/wolves/experience/?album=<catalogue id>` skips the lobby
  and launches that album's cinematic runtime directly; unknown ids land on
  the lobby.

## Local verification

```bash
npm run dev -- --host 127.0.0.1
```

When YouTube rejects a numeric loopback origin, open
`http://projectbluefin.io.localhost:<port>/wolves/`. Run the relevant tests,
typecheck, build, and browser flow before reporting completion.

See `docs/reference/wolves-runtime.md` and
`docs/skills/wolves-content/SKILL.md` for the canonical procedure.
