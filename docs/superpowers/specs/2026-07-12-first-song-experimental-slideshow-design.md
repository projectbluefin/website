# Specification: Experimental Timeline-Driven Slideshow for Track 0

Date: 2026-07-12
Status: Approved
Scope: Repository

This document specifies the technical design for introducing an experimental, timeline-driven slideshow for the first song ("7 Days to the Wolves" by Nightwish, Track 0) in the Wolves fullscreen theater display. The goal is to create a non-repeating, beat-locked visual progression that starts with showcase/product artwork and transitions smoothly into people and community-focused photography, matching the tempo changes of the music.

---

## 1. Core Requirements

### 1.1 Dual-Mode Operation & Reversibility
To ensure the experiment is fully and safely reversible, the new slideshow engine is guarded by a boolean flag:
- `isExperimental`: Set to `true` to enable this restructured slideshow. Set to `false` to immediately revert to the original "Alpha 1" static PDF/wallpaper page behavior.

### 1.2 Non-Repeating, Unique Image Sequence
- Each image/photo in our local collection (168 wallpapers) is displayed exactly once.
- The total length of the song (423s) is divided into five distinct pacing sections aligned with the song's musical sections:
  1. **Section 1: Intro & Verse 1 (0s to 127s):** Dramatic slow build. Displays 5 Day/Night and 7 normal showcase/product images. Normal slides show for ~7.47s, Day/Night slides show for ~14.94s.
  2. **Section 2: Chorus 1 & Verse 2 & Chorus 2 (127s to 229s):** Medium intensity. Displays 25 normal showcase/product images showing for ~4.08s each.
  3. **Section 3: Bridge (229s to 277s):** Atmospheric pause. Displays 7 leftover showcase/product images and 1 people image showing for ~6.0s each, completing the transition from showcase to people.
  4. **Section 4: Build-Up (277s to 345s):** Fast buildup. Displays 34 people images showing for ~2.0s each.
  5. **Section 5: Climax & Outro (345s to 423s):** "Full blast" climax. Displays the remaining 89 people images at a rapid-fire rate of ~0.876s each, aligning with the bass drum beat.

### 1.3 Special Day/Night Fader (Light to Dark)
- Day/night wallpapers (type `daynight`) are assigned double the active pacing duration of their phase (e.g., ~14.94 seconds during Section 1).
- Over the course of their display window, the image transitions smoothly from Day to Night.
- The opacity of the night overlay is calculated as:
  $$\text{opacity} = \frac{\text{currentTime} - \text{startTime}}{\text{duration}}$$
  This guarantees a unidirectional fade from light (Day) to dark (Night). It never fades in reverse.

---

## 2. Technical Architecture & Calculations

### 2.1 Precomputing the Timeline
We will construct an array of `SlideTimelineItem` objects:
```typescript
interface SlideTimelineItem {
  id: string
  isLocal: boolean
  path: string
  title: string
  type: 'single' | 'daynight'
  dayName?: string
  nightName?: string
  startTime: number
  duration: number
  endTime: number
}
```
The timeline is built chronologically by partition calculations across the sorted and deterministically shuffled collection pools (`shuffledDaynight`, `shuffledNormalShowcase`, `shuffledPeople`), assigning exact boundaries and durations for all 168 wallpapers:
- From `0` to `127` seconds, push 5 Day/Night and 7 normal showcase items.
- From `127` to `229` seconds, push 25 normal showcase items.
- From `229` to `277` seconds, push 7 leftover showcase items and 1 people item.
- From `277` to `345` seconds, push 34 people items.
- From `345` to `423` seconds, push the remaining 89 people items.
- This deterministic timeline is generated once when the first song begins, ensuring no runtime drift, repeats, or out-of-order slides.

### 2.2 Active Slide Selection
During playback, the active slide is resolved reactively:
- Find the slide in the precomputed array where `playlistCurrentTime` is between `startTime` (inclusive) and `endTime` (exclusive).
- If no slide is active (e.g., after the song ends), fallback to the last slide in the precomputed array.

---

## 3. Verification & Testing

- **Lint Compliance:** Ensure no emojis are used in the specification, implementation code, comments, or tests.
- **Type Safety:** All timeline and precomputation functions must be fully type-safe.
- **Vitest Suites:** Add tests in `src/tests/` to verify:
  - Correct initialization of the timeline.
  - Double duration for day/night slides.
  - Opacity transition calculation is linear and correct.
  - No duplicate images exist across the timeline.
