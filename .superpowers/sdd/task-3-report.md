# Task 3 Report: finale people photo assets

Commit: `2646ac859bed189bb740557e48c0bce736033f87`

## Scope completed

- Added the ten approved finale photo assets under `public/img/wallpapers/wolves/people/`.
- Regenerated `src/components/wolves/wallpapers-list.ts` via the supported generator only.
- Preserved the owner-removed `wolves-epilogue` state by making no code or content edits outside the generated manifest and the ten assets.
- Did not stage or revert `public/dakota-versions.json` or `recordings/`.

## Generated-entry evidence

Generator command:

```bash
node scripts/generate-wallpapers.js
```

Result:

- `Successfully generated playlist with 187 wallpapers at /var/home/jorge/src/website/src/components/wolves/wallpapers-list.ts`
- Each approved asset appears exactly once in the generated manifest.

Manifest evidence from `src/components/wolves/wallpapers-list.ts`:

- line 207 — `wolves/people/20260709-osc26-distrobox-1.jpg`
- line 282 — `wolves/people/abigailcabunoc30360.web_.jpg`
- line 292 — `wolves/people/amberleighruth_reference.jpg`
- line 297 — `wolves/people/ashleymcnamara35365.jpg`
- line 312 — `wolves/people/dirkhohndel.faces21994.web_.jpg`
- line 322 — `wolves/people/faces.jessiefrazella25358.web_.jpg`
- line 917 — `wolves/people/liz.jpg`
- line 932 — `wolves/people/rikkiendsley28095-2.jpg`
- line 942 — `wolves/people/stormy.faces23764.web_.jpg`
- line 962 — `wolves/people/vmbrasseur.webp`

Count check output:

```text
20260709-osc26-distrobox-1.jpg: 1
abigailcabunoc30360.web_.jpg: 1
amberleighruth_reference.jpg: 1
ashleymcnamara35365.jpg: 1
dirkhohndel.faces21994.web_.jpg: 1
faces.jessiefrazella25358.web_.jpg: 1
liz.jpg: 1
rikkiendsley28095-2.jpg: 1
stormy.faces23764.web_.jpg: 1
vmbrasseur.webp: 1
```

## Commands and results

1. Regenerated manifest:
   - `node scripts/generate-wallpapers.js`
   - PASS

2. Required automated validation:
   - `npm run lint:fix && npm run typecheck && npm run test:run && npm run build`
   - PASS
   - Notes:
     - `npm run test:run` passed: 32 files, 260 tests.
     - `npm run build` passed.
     - `public/dakota-versions.json` was rewritten as a known side effect and intentionally left unstaged.
     - `src/tests/wolvesTrackZeroSlides.test.ts` was briefly reflowed by `lint:fix`; because that file was clean before this task and outside scope, I restored it before commit.

3. Real Track 0 browser verification against the live `/wolves` page on the local dev server:
   - Dev server: `npm run dev`
   - Served at `http://localhost:5174/wolves/`
   - Verification used the real Track 0 YouTube player plus the real `.soundtrack-progress-bar` click handler. Because the embedded player snapped slightly early on exact boundary clicks, I used a `+0.16s` progress-bar bias to observe the DOM just after each required boundary while keeping the actual landed time within the first `0.25s` after the checkpoint. The only exception was `422.99s`, where the player snapped to `422.863s`; the visible DOM still matched the expected finale hold state.

4. Existing browser flow:
   - `WOLVES_BASE_URL=http://localhost:5174 WOLVES_SCREENSHOT_DIR=.superpowers/sdd/task-3-screenshots/movie-flow node tests/wolves-movie-flow.mjs`
   - FAIL
   - Failure: timed out at `tests/wolves-movie-flow.mjs:232` waiting for a third `Next section` click after the Destiny segment.
   - The failure is consistent with the owner-requested `wolves-epilogue` removal: the script still expects an additional intro section that no longer exists.

## Real Track 0 browser checkpoints and DOM assertions

Computed fast-finale reserved-photo boundaries from the generated manifest and current Track 0 schedule:

- `372.720000` — `20260709-osc26-distrobox-1.jpg`
- `374.026667` — `dirkhohndel.faces21994.web_.jpg`
- `374.680000` — `rikkiendsley28095-2.jpg`
- `375.333333` — `faces.jessiefrazella25358.web_.jpg`
- `375.986667` — `stormy.faces23764.web_.jpg`
- `381.213333` — `abigailcabunoc30360.web_.jpg`
- `387.746667` — `amberleighruth_reference.jpg`
- `389.706667` — `vmbrasseur.webp`
- `398.853333` — `ashleymcnamara35365.jpg`
- `400.813333` — `liz.jpg`

Observed browser assertions:

| Checkpoint | Landed time | Active image | Top HUD DOM | Lower thesis-overlay DOM |
|---|---:|---|---|---|
| 345.00 | 345.109 | `kubecon-54927705495.webp` | `INCOMING SIGNAL:` | visible, class `is-welcome`, text `We've got your back.` |
| 359.00 | 359.110 | `kubecon-55164467034.webp` | `Hikari Protocol: Initialized` | visible, class `is-evolve`, text `Evolve or die ...` |
| 372.72 | 372.810 | `20260709-osc26-distrobox-1.jpg` | `Mechaphippy Deployment: [UNAUTHORIZED]` | hidden |
| 374.026667 | 374.127 | `dirkhohndel.faces21994.web_.jpg` | `Mechaphippy Deployment: [UNAUTHORIZED]` | hidden |
| 374.68 | 374.750 | `rikkiendsley28095-2.jpg` | `Mechaphippy Deployment: [UNAUTHORIZED]` | hidden |
| 375.333333 | 375.391 | `faces.jessiefrazella25358.web_.jpg` | `Mechaphippy Deployment: [UNAUTHORIZED]` | hidden |
| 375.986667 | 376.083 | `stormy.faces23764.web_.jpg` | `Mechaphippy Deployment: [UNAUTHORIZED]` | hidden |
| 381.213333 | 381.362 | `abigailcabunoc30360.web_.jpg` | `M2 Status: [ Unknown ]` | hidden |
| 387.746667 | 387.852 | `amberleighruth_reference.jpg` | `Field Medical Exoskeleton: [ Missing ]` | hidden |
| 389.706667 | 389.804 | `vmbrasseur.webp` | `TARGET ACQUIRED: GOSPO, KYLE. Earth` | hidden |
| 398.853333 | 398.897 | `ashleymcnamara35365.jpg` | `Kube Status: Earth` | visible, class `is-growing-corruption`, blank text, corruption glyph visible |
| 400.813333 | 400.829 | `liz.jpg` | `Kube Status: Earth` | visible, class `is-growing-corruption`, blank text, corruption glyph visible |
| 408.00 | 408.077 | `kubecon-55164466314.webp` | `Bazzite Mk6 Units: Prepare for Titanfall.` | visible, class `is-legend`, text `Become Legend` |
| 422.99 | 422.863 | `kubecon-55164466314.webp` | `Bazzite Mk6 Units: Prepare for Titanfall.` | visible, class `is-legend`, text `Become Legend` |

Interpretation:

- The ten approved assets each appeared at their intended fast-finale slots exactly once before `408s`.
- The top HUD and lower thesis overlay remained independent authored layers throughout the checked interval.
- The final hold from `408s` through the end remained on `kubecon-55164466314.webp` with the Titanfall HUD line and `Become Legend` overlay.

## Screenshots location and cleanup

Temporary review screenshots were captured at:

- `.superpowers/sdd/task-3-screenshots/real-track0/`
- `.superpowers/sdd/task-3-screenshots/movie-flow/`

Files captured before cleanup:

- `real-track0`: one screenshot per required checkpoint (`345_000.png` through `422_990.png`)
- `movie-flow`: `prologue.png`, `destiny.png`

Cleanup:

- These screenshots are review-only and were removed after this report was written.

## Commit contents

Committed files only:

- `public/img/wallpapers/wolves/people/20260709-osc26-distrobox-1.jpg`
- `public/img/wallpapers/wolves/people/abigailcabunoc30360.web_.jpg`
- `public/img/wallpapers/wolves/people/amberleighruth_reference.jpg`
- `public/img/wallpapers/wolves/people/ashleymcnamara35365.jpg`
- `public/img/wallpapers/wolves/people/dirkhohndel.faces21994.web_.jpg`
- `public/img/wallpapers/wolves/people/faces.jessiefrazella25358.web_.jpg`
- `public/img/wallpapers/wolves/people/liz.jpg`
- `public/img/wallpapers/wolves/people/rikkiendsley28095-2.jpg`
- `public/img/wallpapers/wolves/people/stormy.faces23764.web_.jpg`
- `public/img/wallpapers/wolves/people/vmbrasseur.webp`
- `src/components/wolves/wallpapers-list.ts`

`git status --short` after commit remained intentionally dirty only for:

- `M public/dakota-versions.json`
- `?? recordings/`

## Self-review

- I kept the change surgical: only the ten assets plus the generated manifest were committed.
- I did not edit Wolves code, design, captions, lore, timing data, or the intro sequence.
- I preserved the owner-removed `wolves-epilogue` state by leaving related implementation untouched.
- The main remaining issue is the outdated `tests/wolves-movie-flow.mjs` expectation for a now-removed intro section. I did not change it because this task explicitly forbids unrelated code changes.

## Follow-up fix

- Updated `tests/wolves-movie-flow.mjs` to keep the trailer advance click, drop the stale second `Next section` click, and assert the intro overlay is hidden plus the mock soundtrack player exists before calling `window.simulateWolvesProgress`.

### Exact command output

```text
Wolves movie flow browser test
  URL:      http://localhost:5174/wolves/
  Viewport: 1440x900

  PASS  Visible Pause intro control
        got: true
  PASS  Visible Next section control
        got: true
  PASS  Visible Pause intro control
        got: true
  PASS  Visible Next section control
        got: true
  PASS  Jono Bacon slide is active at 2:47.8
  PASS  Jono Bacon slide hands off at 2:51.879
        got: false
  PASS  Creator Shorts interstitial is visible at Track 0 -> 1
        got: true
  PASS  Visible Pause video control
        got: true
  PASS  Visible Skip video control
        got: true
  PASS  Left slot shows Cassidy Williams caption
  PASS  Right slot shows Lindsay Nikole caption
  PASS  Creator Shorts interstitial is removed after four-video chapter
        got: true
  PASS  Soundtrack resumes at Track 1 (Ghosts In The Mist)
        got: Ghosts In The Mist
  PASS  Visible Pause soundtrack control
        got: true
  PASS  Visible Next track control
        got: true
  PASS  Visible Track 1 Flickr caption
        got: true
  PASS  Track 1 starts with a Flickr caption
  PASS  Track 1 advances to another Flickr caption
  PASS  Track 1 does not repeat a gallery photo before exhausting the shuffle
        got: false
  PASS  Track 2 uses its canonical artist name
        got: Avatar
  PASS  Track 2 starts with a Flickr caption
  PASS  Track 2 continues the gallery shuffle without reusing Track 1 photos
        got: false
  PASS  November night background holds December’s former rotation slot

Results: 23 passed, 0 failed
```

### Commit

- SHA: `4654341`

## Owner caption decision

- The supplied images contain no embedded title, caption, artist, or description metadata.
- The owner explicitly selected `keep_filenames` on 2026-07-16, retaining the generator’s existing filename-derived captions for all ten new assets.
- No curated title or description content will be invented.

## Final-review P2 follow-up: convert committed Wolves finale JPEGs to WebP (2026-07-16)

Commit: `9b229076d34d9114a2c3d272b99c568e52830324`

### Scope completed

- Converted exactly nine committed `public/img/wallpapers/wolves/people/*.jpg` finale assets to lossy `.webp` siblings in place.
- Preserved the already-WebP `public/img/wallpapers/wolves/people/vmbrasseur.webp` unchanged.
- Removed the corresponding nine `.jpg` files.
- Regenerated `src/components/wolves/wallpapers-list.ts` with the supported generator.
- Updated the reserved Track 0 finale ID set and the affected TDD assertion from `.jpg` to `.webp`.

### Root cause

The final-review P2 was valid: the newly committed reserved Track 0 people assets were added as JPEGs, but `docs/wolves-maintenance.md` allows wallpaper assets only as compressed WebP. The generated manifest and reserved Track 0 ID set still pointed at those JPEG filenames, so the fix had to replace the assets and update the IDs together.

### RED -> GREEN evidence

1. RED change first:
   - Updated `src/tests/wolvesTrackZeroSlides.test.ts` to expect `wolves/people/liz.webp` before changing production ID data.
   - Command:

   ```bash
   npm run test:run -- src/tests/wolvesTrackZeroSlides.test.ts src/tests/wolvesComicReader.test.ts
   ```

   - Expected RED result:

   ```text
   FAIL  src/tests/wolvesTrackZeroSlides.test.ts > wolves Track 0 slide locks > reserves the new people photos for the fast finale without reordering regular slides
   AssertionError: expected [ …(10) ] to include 'wolves/people/liz.webp'
   ```

2. GREEN after production/data updates:
   - Converted the nine files, updated `src/data/wolves-track-zero-slides.ts`, removed the JPEGs, and regenerated `src/components/wolves/wallpapers-list.ts`.
   - Re-ran:

   ```bash
   npm run test:run -- src/tests/wolvesTrackZeroSlides.test.ts src/tests/wolvesComicReader.test.ts
   ```

   - Result: `2 passed, 26 tests passed`.

### Conversions

Lossy conversion command pattern:

```bash
cwebp -quiet -q 82 -m 6 <source.jpg> -o <dest.webp>
```

| Source JPEG | Size | Output WebP | Size |
|---|---:|---|---:|
| `20260709-osc26-distrobox-1.jpg` | 200225 | `20260709-osc26-distrobox-1.webp` | 99598 |
| `abigailcabunoc30360.web_.jpg` | 1235076 | `abigailcabunoc30360.web_.webp` | 299244 |
| `amberleighruth_reference.jpg` | 42854 | `amberleighruth_reference.webp` | 35244 |
| `ashleymcnamara35365.jpg` | 1029962 | `ashleymcnamara35365.webp` | 268878 |
| `dirkhohndel.faces21994.web_.jpg` | 1444308 | `dirkhohndel.faces21994.web_.webp` | 352788 |
| `faces.jessiefrazella25358.web_.jpg` | 1333357 | `faces.jessiefrazella25358.web_.webp` | 279580 |
| `liz.jpg` | 1792477 | `liz.webp` | 645636 |
| `rikkiendsley28095-2.jpg` | 1154507 | `rikkiendsley28095-2.webp` | 239246 |
| `stormy.faces23764.web_.jpg` | 1433315 | `stormy.faces23764.web_.webp` | 380326 |

### Readability / extension verification

Command:

```bash
file public/img/wallpapers/wolves/people/*.webp
```

Verified results for the nine new files all reported `RIFF (little-endian) data, Web/P image, VP8 encoding...`; `vmbrasseur.webp` remained `Web/P image` as expected.

### Regeneration / ID updates

- Regenerated manifest:

  ```bash
  node scripts/generate-wallpapers.js
  ```

- Updated reserved Track 0 IDs in `src/data/wolves-track-zero-slides.ts`:
  - `20260709-osc26-distrobox-1.webp`
  - `abigailcabunoc30360.web_.webp`
  - `amberleighruth_reference.webp`
  - `ashleymcnamara35365.webp`
  - `dirkhohndel.faces21994.web_.webp`
  - `faces.jessiefrazella25358.web_.webp`
  - `liz.webp`
  - `rikkiendsley28095-2.webp`
  - `stormy.faces23764.web_.webp`
  - `vmbrasseur.webp` (unchanged)

### Validation commands

```bash
npm run test:run -- src/tests/wolvesTrackZeroSlides.test.ts src/tests/wolvesComicReader.test.ts
npm run typecheck
npm run build
WOLVES_BASE_URL=http://127.0.0.1:5174 node tests/wolves-movie-flow.mjs
```

Results:

- Targeted Vitest run: PASS (`2` files, `26` tests)
- `npm run typecheck`: PASS
- `npm run build`: PASS
- Local browser flow (`tests/wolves-movie-flow.mjs`): PASS (`23 passed, 0 failed`)

### Commit contents

Committed only:

- the nine new `.webp` files
- the nine deleted `.jpg` files
- regenerated `src/components/wolves/wallpapers-list.ts`
- updated `src/data/wolves-track-zero-slides.ts`
- updated `src/tests/wolvesTrackZeroSlides.test.ts`

### Commit SHA

- `9b229076d34d9114a2c3d272b99c568e52830324`
