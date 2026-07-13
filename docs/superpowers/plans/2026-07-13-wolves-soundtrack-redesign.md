# Wolves Soundtrack Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `WolvesSoundtrack.vue` widget to use a compact, unified layout with SVG icons, progress bars, and truncated titles to prevent clipping on both desktop and mobile views.

**Architecture:** The rewrite is entirely localized to `src/components/wolves/WolvesSoundtrack.vue`. It involves extracting the existing interval-driven progress state into reactive template variables, formatting seconds to M:SS, and refactoring the HTML structure and SCSS to match the "Compact & Unified" spec. Seeking functionality is added via click events on the progress bar.

**Tech Stack:** Vue 3 Composition API, SCSS, Tailwind CSS classes.

## Global Constraints

- No emojis in code or commit messages.
- Must preserve the existing YouTube IFrame player logic and state machine.
- Maintain the dark/ocean theme colors and monospace font usages.

---

### Task 1: Logic Updates - Time Formatting & State

**Files:**
- Modify: `src/components/wolves/WolvesSoundtrack.vue`

**Interfaces:**
- Produces: `formattedCurrentTime`, `formattedDuration`, `progressPercent`, `seekToPosition(event: MouseEvent)`

- [ ] **Step 1: Add time formatting and state variables**

Add the following state variables near the top of the `<script setup>` block:

```typescript
const currentTime = ref(0)
const duration = ref(0)

const formattedCurrentTime = computed(() => formatTime(currentTime.value))
const formattedDuration = computed(() => formatTime(duration.value))
const progressPercent = computed(() => {
  if (duration.value === 0) return 0
  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})

function formatTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
```

- [ ] **Step 2: Update the progress timer to update reactive refs**

Locate `startProgressTimer()` and update it to set the new refs:

```typescript
function startProgressTimer() {
  if (progressTimer) {
    return
  }
  progressTimer = setInterval(() => {
    if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
      const current = player.getCurrentTime()
      const total = player.getDuration()
      const playlistIndex = typeof player.getPlaylistIndex === 'function' ? player.getPlaylistIndex() : currentTrackIndex.value
      
      if (typeof current === 'number' && typeof total === 'number' && total > 0) {
        currentTime.value = current
        duration.value = total
        emit('progress', { currentTime: current, duration: total, playlistIndex })
      }
    }
  }, 100)
}
```

- [ ] **Step 3: Add seek functionality**

Add the seek function in the `<script setup>` block:

```typescript
function seekToPosition(event: MouseEvent) {
  if (!player || typeof player.seekTo !== 'function' || duration.value === 0) return
  
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const percentage = clickX / rect.width
  
  const targetTime = duration.value * percentage
  player.seekTo(targetTime, true)
  currentTime.value = targetTime // Optimistic update
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/wolves/WolvesSoundtrack.vue
git commit -m "feat(wolves): add progress state and seek logic to soundtrack"
```

---

### Task 2: Desktop Layout HTML Refactor

**Files:**
- Modify: `src/components/wolves/WolvesSoundtrack.vue`

**Interfaces:**
- Consumes: `formattedCurrentTime`, `formattedDuration`, `progressPercent`, `seekToPosition`

- [ ] **Step 1: Update the Desktop Panel HTML**

Replace the `.soundtrack-panel-main` div in the `<template>` with the new structure.

```vue
      <div class="soundtrack-panel-main">
        <div class="soundtrack-artwork-shell" :class="{ 'is-playing': isPlaying }">
          <img
            :src="artworkUrl"
            :alt="`${currentTrack.title} artwork`"
            class="soundtrack-artwork"
          >
        </div>

        <div class="soundtrack-copy">
          <span class="soundtrack-label font-mono">RELEASE SOUNDTRACK</span>
          <h2 class="soundtrack-title truncate">
            {{ currentTrack.title }}
          </h2>
          <p class="soundtrack-artist font-mono truncate">
            {{ currentTrack.artist }}
          </p>

          <!-- Desktop Progress Bar -->
          <div class="soundtrack-progress-container">
            <span class="soundtrack-time font-mono">{{ formattedCurrentTime }}</span>
            <div 
              class="soundtrack-progress-bar group"
              @click="seekToPosition"
              role="slider"
              tabindex="0"
              :aria-valuenow="progressPercent"
            >
              <div class="soundtrack-progress-fill group-hover:bg-[#7dd3fc]" :style="{ width: `${progressPercent}%` }"></div>
            </div>
            <span class="soundtrack-time font-mono">{{ formattedDuration }}</span>
          </div>
        </div>

        <!-- Sleeker Controls -->
        <div class="soundtrack-controls-group">
          <button
            type="button"
            class="soundtrack-icon-btn prev"
            aria-label="Previous track"
            :disabled="!isStarted"
            @click="prevTrack"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path></svg>
          </button>
          
          <button
            type="button"
            class="soundtrack-icon-btn play-pause"
            :aria-label="actionAriaLabel"
            :disabled="status === 'loading'"
            @click="handlePrimaryAction"
          >
             <svg v-if="isPlaying" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
             <svg v-else class="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          
          <button
            type="button"
            class="soundtrack-icon-btn next"
            aria-label="Next track"
            :disabled="!isStarted"
            @click="nextTrack"
          >
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
          </button>
        </div>
      </div>

      <!-- Status and Links below main track info -->
      <div class="soundtrack-status-panel">
        <p class="soundtrack-status font-mono">
          {{ statusCopy }}
        </p>

        <div class="soundtrack-links">
          <a
            :href="currentSource.playlistUrl"
            aria-label="Open soundtrack playlist on YouTube"
            target="_blank"
            rel="noopener noreferrer"
            class="soundtrack-link"
          >
            YouTube playlist
          </a>
          <div class="soundtrack-music-group">
            <a
              :href="currentSource.musicUrl"
              aria-label="Open soundtrack in YouTube Music"
              target="_blank"
              rel="noopener noreferrer"
              class="soundtrack-link"
            >
              YouTube Music
            </a>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wolves/WolvesSoundtrack.vue
git commit -m "feat(wolves): implement compact desktop layout for soundtrack widget"
```

---

### Task 3: Mobile Layout HTML Refactor

**Files:**
- Modify: `src/components/wolves/WolvesSoundtrack.vue`

**Interfaces:**
- Consumes: `progressPercent`, `isPlaying`

- [ ] **Step 1: Update Mobile Bar HTML**

Replace the `.soundtrack-mobile-bar` div in the `<template>` with the new structure featuring the top-edge progress bar and icon button.

```vue
    <div
      v-if="isStarted"
      class="soundtrack-mobile-bar"
      :class="{ 'is-playing': isPlaying }"
    >
      <!-- Mobile Progress Indicator pinned to top -->
      <div class="soundtrack-mobile-progress-wrap">
         <div class="soundtrack-progress-fill" :style="{ width: `${progressPercent}%` }"></div>
      </div>

      <img
        :src="artworkUrl"
        :alt="`${currentTrack.title} artwork`"
        class="soundtrack-mobile-artwork"
      >
      <div class="soundtrack-mobile-copy">
        <span class="soundtrack-mobile-title">{{ currentTrack.title }}</span>
        <span class="soundtrack-mobile-artist font-mono">{{ currentTrack.artist }}</span>
      </div>
      
      <button
        type="button"
        class="soundtrack-icon-btn mobile-play-pause"
        :aria-label="actionAriaLabel"
        :disabled="status === 'loading'"
        @click="handlePrimaryAction"
      >
        <svg v-if="isPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        <svg v-else class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
    </div>
```

- [ ] **Step 2: Remove Quote Navigation Buttons**

Wait, the old desktop UI had the `quote-nav-btn` and `share-btn` mixed into the `.soundtrack-controls-group`. Those buttons control the lore transcript text in the parent view. Let's move them below the player panel but above the comic controls. Insert this right after `</section>` (the `.soundtrack-panel` section):

```vue
    <!-- Lore Navigation Controls -->
    <div class="lore-nav-controls">
      <button
        type="button"
        class="quote-nav-btn prev"
        aria-label="Previous transcript"
        @click="emit('prevLore')"
      >
        &larr;
      </button>
      <button
        type="button"
        class="quote-nav-btn next"
        aria-label="Next transcript"
        @click="emit('nextLore')"
      >
        &rarr;
      </button>
      <button
        type="button"
        class="quote-nav-btn share-btn font-mono"
        :aria-label="loreCopied ? 'Transcript copied' : 'Share transcript'"
        @click="emit('shareLore')"
      >
        {{ loreCopied ? 'COPIED!' : 'SHARE' }}
      </button>
    </div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wolves/WolvesSoundtrack.vue
git commit -m "feat(wolves): implement mobile top edge progress bar and separate lore controls"
```

---

### Task 4: SCSS Refactoring

**Files:**
- Modify: `src/components/wolves/WolvesSoundtrack.vue`

**Interfaces:**
- N/A

- [ ] **Step 1: Update existing CSS classes**

Replace the `.soundtrack-action` and `.soundtrack-skip-btn` CSS with the new icon button classes. Add classes for progress bars, status panel, and new layouts.

```css
/* Update the grid to be simpler */
.soundtrack-panel-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  padding: 18px;

  @media (min-width: 900px) {
    grid-template-columns: auto 1fr auto;
    align-items: center;
  }
}

/* New Icon Buttons */
.soundtrack-icon-btn {
  border-radius: 999px;
  border: 1px solid rgba(66, 133, 244, 0.45);
  background-color: #10151f;
  color: #66b3ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover:not(:disabled) {
    background-color: rgba(66, 133, 244, 0.15);
    border-color: #7dd3fc;
    color: #ffffff;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.prev, &.next {
    width: 40px;
    height: 40px;
  }

  &.play-pause {
    width: 48px;
    height: 48px;
    background: rgba(66, 133, 244, 0.1);
    border-color: rgba(102, 179, 255, 0.55);
    color: #e0f2fe;

    &:hover:not(:disabled) {
      background: rgba(66, 133, 244, 0.2);
      border-color: rgba(125, 211, 252, 0.8);
    }
  }

  &.mobile-play-pause {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    background: rgba(66, 133, 244, 0.1);
    border-color: rgba(102, 179, 255, 0.55);
    color: #e0f2fe;
  }
}

/* Progress Bar Desktop */
.soundtrack-progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.soundtrack-time {
  font-size: 10px;
  color: #94a3b8;
  width: 32px;
  text-align: center;
}

.soundtrack-progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
}

.soundtrack-progress-fill {
  height: 100%;
  background: #66b3ff;
  transition: width 0.1s linear, background-color 0.2s ease;
}

/* Status Panel */
.soundtrack-status-panel {
  padding: 12px 18px;
  border-top: 1px solid rgba(66, 133, 244, 0.2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.soundtrack-status {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: #94a3b8;
}

/* Mobile Top Edge Progress Bar */
.soundtrack-mobile-progress-wrap {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px 16px 0 0;
  overflow: hidden;
}

/* Utility to ensure text truncates correctly */
.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.soundtrack-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Lore Navigation container */
.lore-nav-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}
```

- [ ] **Step 2: Clean up obsolete classes**

Remove `.soundtrack-action`, `.soundtrack-skip-btn`, and adjust media queries as needed to ensure the new HTML structure is supported.

- [ ] **Step 3: Test and Commit**

Run `npm run dev` and navigate to the Wolves page to verify both desktop and mobile layouts. Check truncation on long tracks. Check seeking functionality.

```bash
git add src/components/wolves/WolvesSoundtrack.vue
git commit -m "style(wolves): update scss for new soundtrack widget layout"
```

---

### Task 5: Final Validation & ESLint formatting

**Files:**
- Modify: None

**Interfaces:**
- N/A

- [ ] **Step 1: Format Code**

Run: `npm run lint:fix`

- [ ] **Step 2: Run Typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 3: Run Unit Tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 4: Commit formatting changes**

```bash
git commit -am "chore: auto-format soundtrack redesign"
```
