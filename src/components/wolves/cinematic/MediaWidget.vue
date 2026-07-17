<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'

// The widget is a pure store subscriber: playback intents are emitted upward and
// wired to the stage by the app shell, never by reaching into player components.
const emit = defineEmits<{
  togglePlay: []
  skip: [delta: number]
  seek: [ratio: number]
}>()

const store = useCinematicStore()
const base = import.meta.env.BASE_URL
const artworkSrc = computed(() =>
  store.segment.artwork.startsWith('http') ? store.segment.artwork : `${base}${store.segment.artwork}`,
)

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

// Unix-style block progress readout in the old HUD's spirit.
const PROGRESS_CELLS = 24
const progressBlocks = computed(() => {
  const filled = Math.round(store.segmentProgress * PROGRESS_CELLS)
  return `[${'#'.repeat(filled)}${'-'.repeat(PROGRESS_CELLS - filled)}]`
})

const canPrevious = computed(() => store.segmentIndex > 0 && !store.crossfading)
const canNext = computed(() => !store.isLastSegment && !store.crossfading)

const progressEl = ref<HTMLElement | null>(null)

function handleSeek(event: MouseEvent) {
  const rect = progressEl.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) {
    return
  }
  emit('seek', (event.clientX - rect.left) / rect.width)
}
</script>

<template>
  <footer class="wc-widget wc-plate wc-plate--sheen">
    <img
      class="wc-widget-art"
      :src="artworkSrc"
      alt=""
    >
    <div class="wc-widget-info">
      <span class="wc-label">{{ store.segment.chapter }} · {{ store.segmentIndex + 1 }}/{{ store.segmentCount }}</span>
      <span class="wc-widget-title">{{ store.segment.title }}</span>
      <div
        ref="progressEl"
        class="wc-widget-progress"
        role="slider"
        aria-label="Seek"
        :aria-valuenow="Math.round(store.segmentProgress * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        @click="handleSeek"
      >
        <div class="wc-widget-progress-fill" :style="{ width: `${store.segmentProgress * 100}%` }" />
      </div>
      <div class="wc-widget-meta">
        <span class="wc-widget-time">{{ progressBlocks }}</span>
        <span class="wc-widget-time">{{ segmentTime }}</span>
        <span class="wc-widget-time">TOTAL {{ formatTime(store.totalElapsed) }}</span>
        <span v-if="spotifyLine" class="wc-widget-spotify">{{ spotifyLine }}</span>
      </div>
    </div>
    <div class="wc-widget-telemetry">
      <div class="wc-widget-telemetry-row">
        <span>DEPLOYMENT: wolves-decryption-engine-7</span>
        <span class="wc-widget-telemetry-accent">7%</span>
      </div>
      <div class="wc-widget-meter">
        <div class="wc-widget-meter-fill" />
      </div>
      <span class="wc-widget-telemetry-row">CLUSTER: k3s-exo-1.production // HOST: ghost.local</span>
    </div>
    <div class="wc-widget-controls">
      <button
        class="wc-control"
        type="button"
        aria-label="Previous"
        :disabled="!canPrevious"
        @click="emit('skip', -1)"
      >
        <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
      </button>
      <button
        class="wc-control"
        type="button"
        :aria-label="store.playing ? 'Pause' : 'Play'"
        @click="emit('togglePlay')"
      >
        <svg v-if="store.playing" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
      </button>
      <button
        class="wc-control"
        type="button"
        aria-label="Next"
        :disabled="!canNext"
        @click="emit('skip', 1)"
      >
        <svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" /></svg>
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
  max-width: 116rem;
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
  position: relative;
  height: 0.8rem;
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    inset-inline: 0;
    height: 0.3rem;
    transform: translateY(-50%);
    background: rgb(233 233 229 / 14%);
  }
}

.wc-widget-progress-fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 0.3rem;
  transform: translateY(-50%);
  background: var(--wc-gold);
  transition: width 0.15s linear;
  box-shadow: 0 0 6px rgb(200 180 137 / 55%);
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

.wc-widget-telemetry {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-shrink: 0;
  font-family: var(--wc-font-mono);
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  color: var(--wc-grey);
}

.wc-widget-telemetry-row {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  white-space: nowrap;
}

.wc-widget-telemetry-accent {
  color: #7fd4d4;
}

.wc-widget-meter {
  height: 0.3rem;
  background: rgb(233 233 229 / 14%);
}

.wc-widget-meter-fill {
  width: 7%;
  height: 100%;
  background: #7fd4d4;
  animation: wc-meter-pulse 2.4s ease-in-out infinite;
}

@keyframes wc-meter-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

.wc-widget-controls {
  display: flex;
  gap: 0.8rem;
}

@media (max-width: 900px) {
  .wc-widget-telemetry {
    display: none;
  }
}

@media (max-width: 640px) {
  .wc-widget {
    max-width: none;
    gap: 1rem;
  }

  .wc-widget-art {
    display: none;
  }

  .wc-widget-title {
    white-space: normal;
    font-size: 1.5rem;
    line-height: 1.2;
  }

  // The block readout wraps badly at phone widths; times remain.
  .wc-widget-meta .wc-widget-time:first-child {
    display: none;
  }
}
</style>
