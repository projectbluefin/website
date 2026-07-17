<script setup lang="ts">
import { computed } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'

// The widget is a pure store subscriber: play/pause intent is emitted upward and
// wired to the stage by the app shell, never by reaching into player components.
const emit = defineEmits<{ togglePlay: [] }>()

const store = useCinematicStore()
const base = import.meta.env.BASE_URL

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`
}

const segmentTime = computed(() => `${formatTime(store.segmentElapsed)} / ${formatTime(store.segmentDuration)}`)
const spotifyLine = computed(() => {
  const spotify = store.spotify
  if (spotify.status === 'playing' || spotify.status === 'paused') {
    return `${spotify.trackTitle} — ${spotify.trackArtist}`
  }
  if (spotify.status === 'error') {
    return spotify.error
  }
  return ''
})
</script>

<template>
  <footer class="wc-widget wc-plate wc-plate--sheen">
    <img
      class="wc-widget-art"
      :src="`${base}${store.segment.artwork}`"
      alt=""
    >
    <div class="wc-widget-info">
      <span class="wc-label">{{ store.segment.chapter }} · {{ store.segmentIndex + 1 }}/{{ store.segmentCount }}</span>
      <span class="wc-widget-title">{{ store.segment.title }}</span>
      <div class="wc-widget-progress">
        <div class="wc-widget-progress-fill" :style="{ width: `${store.segmentProgress * 100}%` }" />
      </div>
      <div class="wc-widget-meta">
        <span class="wc-widget-time">{{ segmentTime }}</span>
        <span class="wc-widget-time">TOTAL {{ formatTime(store.totalElapsed) }}</span>
        <span v-if="spotifyLine" class="wc-widget-spotify">{{ spotifyLine }}</span>
      </div>
    </div>
    <div class="wc-widget-controls">
      <button
        class="wc-control"
        type="button"
        :aria-label="store.playing ? 'Pause' : 'Play'"
        @click="emit('togglePlay')"
      >
        <svg v-if="store.playing" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
      </button>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.wc-widget {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 1.6rem;
  margin: 0 auto;
  max-width: 88rem;
  padding: 1.2rem 1.6rem;
}

.wc-widget-art {
  width: 5.6rem;
  height: 5.6rem;
  object-fit: cover;
  clip-path: polygon(0.5rem 0, 100% 0, 100% calc(100% - 0.5rem), calc(100% - 0.5rem) 100%, 0 100%, 0 0.5rem);
}

.wc-widget-info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
  min-width: 0;
}

.wc-widget-title {
  font-size: 1.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
}

.wc-widget-progress {
  height: 0.3rem;
  background: rgb(233 233 229 / 14%);
}

.wc-widget-progress-fill {
  height: 100%;
  background: var(--wc-gold);
  transition: width 0.25s linear;
}

.wc-widget-meta {
  display: flex;
  gap: 1.6rem;
  align-items: baseline;
}

.wc-widget-time {
  font-family: var(--wc-font-mono);
  font-size: 1.1rem;
  letter-spacing: 0.12em;
  color: var(--wc-grey);
}

.wc-widget-spotify {
  font-family: var(--wc-font-mono);
  font-size: 1.1rem;
  letter-spacing: 0.08em;
  color: var(--wc-gold);
  white-space: nowrap;
  overflow: hidden;
}

@media (max-width: 640px) {
  .wc-widget {
    max-width: none;
    gap: 1rem;
  }

  .wc-widget-art {
    display: none;
  }
}
</style>
