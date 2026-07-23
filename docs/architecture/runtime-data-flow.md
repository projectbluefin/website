# Runtime data flow

**Agents edit content. Agents never edit design.**

## Main site

`index.html` loads `src/main.ts`. `src/main.ts` mounts `src/App.vue`, installs
locale handling, and loads the shared stylesheet. Vue components render locale
values and fixed content data.

## Wolves

`wolves/index.html` loads `src/wolves-main.ts`. `src/WolvesApp.vue` owns the
runtime shell. `src/stores/cinematic.ts` owns phase and playback state. The
cinematic stage and intro publish clock state into the store; transport and
synchronized surfaces read that state.

The active media player's clock drives synchronized content. Do not add a second
clock or a second transport for a content change.

## Generated data

Generated files are outputs, not editing surfaces. Change their source data or
generator, then regenerate:

- `src/components/wolves/wallpapers-list.ts`
- `public/experiences/catalogue.json`
- `public/wolves-playlist.json`
- generated album artwork under `public/experiences/`

The owning reference in `docs/reference/` names the generator and validation.

## Lore timing and accessibility

The narrative timeline selects records from the active player clock. Unlocked lore intervals are allocated by content cost; locked anchors retain their authored windows. Quote and conversation renderers use the same readability estimator as the scheduler. The visual typewriter is presentation-only, while the active article exposes complete authored text for assistive technology. Never add a second clock or compensate for an undersized slot only by changing renderer speed.
