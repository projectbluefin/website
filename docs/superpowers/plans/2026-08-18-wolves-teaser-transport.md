# Wolves Teaser Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crop YouTube chrome out of the teaser and drive playback through the existing Wolves media widget.

**Architecture:** `MediaWidget.vue` gains optional external playback props while preserving its store defaults. `WolvesTeaserApp.vue` supplies trailer state and owns all YouTube API calls. CSS makes a 16:9 iframe taller than and clipped by the 1920:804 picture viewport.

**Tech Stack:** Vue 3, TypeScript, SCSS, YouTube IFrame API, Vitest, Playwright.

## Global Constraints

- Keep the current trailer video id and authored plate schedule unchanged.
- Preserve existing full-show widget behavior.
- Use one transport; remove central teaser controls.
- Keep the complete video above the desktop fold.

---

### Task 1: External playback mode

**Files:**
- Modify: `src/components/wolves/cinematic/MediaWidget.vue`
- Test: `src/tests/wolvesMediaWidget.test.ts`

- [ ] Add optional external title, artwork, elapsed, duration, and playing props.
- [ ] Derive progress/time/play state from external props when supplied and from the cinematic store otherwise.
- [ ] Add `showSkipControls`, defaulting to true; hide previous/next for the teaser.
- [ ] Test external rendering and verify existing store-backed tests remain green.

### Task 2: Teaser transport and iframe crop

**Files:**
- Modify: `src/WolvesTeaserApp.vue`
- Modify: `docs/skills/wolves-teaser/SKILL.md`

- [ ] Add paused state plus toggle and ratio-seek handlers.
- [ ] Render `MediaWidget` with trailer state and remove central Watch/Replay controls.
- [ ] Make the iframe pointer-inert and 16:9 inside the clipped 1920:804 picture viewport.
- [ ] Record the reusable transport/crop pattern in the teaser skill.

### Task 3: Validate and ship

- [ ] Run focused tests, lint, typecheck, `test:gate`, and build.
- [ ] Measure iframe, title, video, and widget behavior at 1920×1080 and 390×844.
- [ ] Commit, push, verify exact-head CI, merge, remove the worktree/branch, and verify production.
