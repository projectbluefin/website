# Wolves Change Guardrails

Follow `AGENTS.md` for the repository-wide workflow. Read `docs/wolves-maintenance.md`, the canonical production reference for the Wolves page, before any Wolves change: agents edit content, agents never edit design. These rules prevent regressions in the Wolves fullscreen experience.

## Content boundaries

- Treat Wolves top-bar communications, lower thesis story, and lore-column narrative as separate content layers.
- `WolvesThesisState.hudLabel` is for top-bar communications. `WolvesThesisState.text` is for the lower thesis overlay. Never route, replace, or reuse text across those layers.
- Treat the thesis timeline as locked authored data. Before modifying `src/data/wolves-thesis-sequence.ts`, inspect its history and canonical Wolves documentation. Preserve exact text and timing boundaries with regression tests.
- Editable incoming-signal data may change the top-bar communications only. It must never erase, replace, reorder, or otherwise alter thesis-story text.

## Visual changes and verification

- Before changing Wolves layout, inspect the fullscreen regions in `src/WolvesApp.vue`: the top HUD has an 80px budget, the footer has a 140px budget, and the desktop content split is `2fr 1fr`.
- Do not add prominent controls or widgets to the footer unless local desktop and mobile screenshots prove they fit without displacing controls.
- Keep visual and layout experiments local until screenshots have been reviewed and approved before committing or pushing.
- For every Wolves change, verify the rendered page by moving the real soundtrack progress bar to each affected Track 0 timestamp. Assert the visible top-bar and lower-overlay DOM separately; a successful build or bundle-string check is not sufficient.
- Before deploying a dedicated lore view, use Chromium to seek each affected `LoreKind` on the real Track 0 player and assert its visible DOM, computed display/flex styles, bounds within `.immersive-col-right`, and scroll behavior. Include mobile states for each changed view. The browser assertion must run in CI, not only locally.
- Do not rely on Tailwind utility classes alone for structural immersive-lore layout. Dedicated lore views must use scoped styles or an existing verified shared card class for `display`, flex sizing, `min-height`, and overflow; add a computed-style browser assertion for any new or changed view.

## Authored lore recovery and timing

- Never ask the user to re-enter authored lore that appears missing from the worktree. Recover it in this order: working tree, Git history/reflog, VS Code history or backups, then ask the user only if recovery fails. Do not recreate, summarize, or alter recovered prose.
- `src/data/wolves-narrative-timeline.ts` is deliberate schedule data. When an authorized authored-body refresh requires timing changes, update only the unlocked boundaries and the independent oracle in `src/tests/wolvesNarrativeTimeline.test.ts`; preserve the 0:00 opening, 150–220 Golden Era, and 398–425 finale locks. Seek the real player at every changed boundary before deployment.

## Deployment completion

- A successful build or CI run does not mean a Wolves change is live. After pushing, inspect the exact pushed SHA's `Deploy to GitHub Pages` workflow result. Only report production completion after that deployment succeeds and the affected live Track 0 timestamp passes the required browser assertion.
