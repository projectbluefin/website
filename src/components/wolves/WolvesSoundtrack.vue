<script setup lang="ts">
import type { WolvesChapter } from '@/data/wolves-story'
import { onUnmounted, ref, watch } from 'vue'

defineProps<{ chapter: WolvesChapter | undefined }>()
const emit = defineEmits<{ entered: [] }>()

const playlistUrl = 'https://www.youtube.com/playlist?list=PLA78oiE-RGAE'
const embedUrl = 'https://www.youtube.com/embed/videoseries?list=PLA78oiE-RGAE&autoplay=1&rel=0'

const hasStarted = ref(false)
const playerLoaded = ref(false)
const isCollapsed = ref(false)
// Only skip the gate if the user explicitly dismissed; "started" alone does not auto-start on reload.
const isDismissed = ref(sessionStorage.getItem('wolves_soundtrack_dismissed') === 'true')
const hasEntered = ref(isDismissed.value)

function start() {
  hasStarted.value = true
  hasEntered.value = true
  emit('entered')
}

function readSilently() {
  hasEntered.value = true
  isDismissed.value = true
  sessionStorage.setItem('wolves_soundtrack_dismissed', 'true')
  emit('entered')
}

function dismiss() {
  isDismissed.value = true
  sessionStorage.setItem('wolves_soundtrack_dismissed', 'true')
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

// Manage mobile document padding so content isn't hidden behind the fixed player bar.
// Only applied when the player bar is actually visible on screen.
watch(
  () => hasStarted.value && !isDismissed.value,
  (active) => {
    document.documentElement.classList.toggle('wolves-player-active', active)
  },
  { immediate: true },
)

onUnmounted(() => {
  document.documentElement.classList.remove('wolves-player-active')
})
</script>

<template>
  <!-- Above-fold entry choice: shown until the visitor makes a pick -->
  <div v-if="!hasEntered" class="wolves-soundtrack-entry">
    <p class="entry-label">
      This story has a soundtrack.
    </p>
    <div class="entry-actions">
      <button
        class="entry-btn primary"
        type="button"
        aria-label="Start soundtrack"
        @click="start"
      >
        🎵 Enter With Soundtrack
      </button>
      <button
        class="entry-btn secondary"
        type="button"
        aria-label="Read silently"
        @click="readSilently"
      >
        Read Silently
      </button>
    </div>
    <a
      :href="playlistUrl"
      class="playlist-link"
      target="_blank"
      rel="noopener noreferrer"
    >
      View full playlist ↗
    </a>
  </div>

  <!-- Persistent fixed player bar: shown after soundtrack started, until dismissed -->
  <div
    v-if="hasStarted && !isDismissed"
    class="wolves-soundtrack-bar"
    :class="{ 'is-collapsed': isCollapsed }"
  >
    <div v-if="isCollapsed" class="collapsed-pill">
      <span class="music-icon">🎵</span>
      <button
        class="pill-expand-btn"
        type="button"
        aria-label="Expand player"
        @click="toggleCollapse"
      >
        {{ playerLoaded ? 'Soundtrack' : 'Starting soundtrack…' }}
      </button>
      <button
        class="pill-close-btn"
        type="button"
        aria-label="Dismiss player"
        @click="dismiss"
      >
        &times;
      </button>
    </div>

    <div v-else class="bar-content">
      <div class="bar-status">
        {{ playerLoaded ? 'Soundtrack Playing' : 'Starting soundtrack…' }}
      </div>

      <!-- Hidden iframe loads audio; visible once playerLoaded -->
      <iframe
        :src="embedUrl"
        title="Wolves soundtrack player"
        allow="autoplay; encrypted-media"
        @load="playerLoaded = true"
      />

      <div class="bar-controls">
        <button
          type="button"
          aria-label="Collapse player"
          @click="toggleCollapse"
        >
          &minus;
        </button>
        <button
          type="button"
          aria-label="Dismiss player"
          @click="dismiss"
        >
          &times;
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
// Above-fold entry section
.wolves-soundtrack-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 28px 24px;
  border: 1px solid rgba(66, 133, 244, 0.25);
  border-radius: 12px;
  background-color: rgba(12, 17, 27, 0.7);
  backdrop-filter: blur(8px);
  text-align: center;
  margin-bottom: 8px;

  .entry-label {
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
  }

  .entry-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .entry-btn {
    padding: 12px 28px;
    min-height: 44px;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.85;
    }

    &.primary {
      background-color: var(--color-blue, #4285f4);
      color: #fff;
    }

    &.secondary {
      background-color: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  }

  .playlist-link {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.45);
    text-decoration: none;

    &:hover {
      color: rgba(255, 255, 255, 0.75);
    }
  }
}

// Persistent fixed player bar (post-entry)
.wolves-soundtrack-bar {
  position: fixed;
  z-index: 999;
  bottom: 24px;
  right: 24px;
  width: 260px;
  border-radius: 10px;
  background-color: rgba(16, 21, 31, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(66, 133, 244, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  padding-bottom: env(safe-area-inset-bottom);

  &.is-collapsed {
    width: auto;
    border-radius: 30px;
  }

  .collapsed-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;

    .music-icon {
      font-size: 1.2rem;
    }

    .pill-expand-btn {
      background: none;
      border: none;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      min-height: 44px;
      padding: 0 4px;
    }

    .pill-close-btn {
      background: none;
      border: none;
      color: #bdbdbd;
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
      min-height: 44px;
      min-width: 44px;

      &:hover {
        color: #fff;
      }
    }
  }

  .bar-content {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .bar-status {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-blue, #4285f4);
    }

    iframe {
      width: 100%;
      height: 28px;
      border: none;
      border-radius: 4px;
    }

    .bar-controls {
      display: flex;
      gap: 4px;
      justify-content: flex-end;

      button {
        background: none;
        border: none;
        color: #bdbdbd;
        cursor: pointer;
        font-size: 1.1rem;
        line-height: 1;
        min-height: 44px;
        min-width: 44px;
        transition: color 0.2s;

        &:hover {
          color: #fff;
        }
      }
    }
  }

  // Mobile: full-width bar at the bottom
  @media (max-width: 767px) {
    bottom: 0;
    left: 0;
    right: 0;
    width: 100% !important;
    border-radius: 0;
    border-top: 1px solid rgba(66, 133, 244, 0.3);
    border-left: none;
    border-right: none;
    border-bottom: none;

    &.is-collapsed {
      border-radius: 0;
      width: 100% !important;

      .collapsed-pill {
        justify-content: center;
        padding: 8px 12px;
      }
    }

    .bar-content {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
    }
  }
}
</style>
