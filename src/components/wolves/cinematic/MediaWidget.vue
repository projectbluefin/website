<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'

const props = withDefaults(defineProps<{
  title?: string
  showVoiceOverToggle?: boolean
  voiceOverEnabled?: boolean
  voiceOverLabel?: string
  showCaptionToggle?: boolean
  captionsEnabled?: boolean
  captionLabel?: string
}>(), {
  showVoiceOverToggle: false,
  voiceOverEnabled: false,
  voiceOverLabel: 'Ikora voice over',
  showCaptionToggle: false,
  captionsEnabled: false,
  captionLabel: 'CC',
})

// The widget is a pure store subscriber: playback intents are emitted upward and
// wired to the stage by the app shell, never by reaching into player components.
const emit = defineEmits<{
  togglePlay: []
  toggleVoiceOver: [enabled: boolean]
  toggleCaptions: [enabled: boolean]
  skip: [delta: number]
  seek: [ratio: number]
}>()

const store = useCinematicStore()
const base = import.meta.env.BASE_URL
const mediaTitle = computed(() => props.title ?? store.display.title)
const artworkSrc = computed(() =>
  store.display.artwork.startsWith('http') ? store.display.artwork : `${base}${store.display.artwork}`,
)

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`
}

const segmentTime = computed(() => `${formatTime(store.segmentElapsed)} / ${formatTime(store.segmentDuration)}`)
const overallTime = computed(() => `${formatTime(store.overallElapsed)} / ${formatTime(store.overallDuration)}`)
const deploymentPercent = computed(() => Math.round(store.overallProgress * 100))
// Unix-style block progress readout in the old HUD's spirit.
const PROGRESS_CELLS = 24
const progressBlocks = computed(() => {
  const filled = Math.round(store.overallProgress * PROGRESS_CELLS)
  return `[${'#'.repeat(filled)}${'-'.repeat(PROGRESS_CELLS - filled)}]`
})

const canPrevious = computed(() => store.widgetCanPrevious)
const canNext = computed(() => store.widgetCanNext)

const progressEl = ref<HTMLElement | null>(null)

function handleSeek(event: MouseEvent) {
  const rect = progressEl.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) {
    return
  }
  emit('seek', (event.clientX - rect.left) / rect.width)
}

function handleVoiceOverChange(event: Event) {
  emit('toggleVoiceOver', (event.target as HTMLInputElement).checked)
}

function handleCaptionChange(event: Event) {
  emit('toggleCaptions', (event.target as HTMLInputElement).checked)
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
      <span class="wc-widget-title">{{ mediaTitle }}</span>
      <div
        ref="progressEl"
        class="wc-widget-progress"
        role="slider"
        aria-label="Seek"
        :aria-valuenow="deploymentPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        @click="handleSeek"
      >
        <div class="wc-widget-progress-fill" :style="{ width: `${store.overallProgress * 100}%` }" />
      </div>
      <div class="wc-widget-meta">
        <span class="wc-widget-time">{{ progressBlocks }}</span>
        <span class="wc-widget-time">{{ segmentTime }}</span>
        <span class="wc-widget-time">TOTAL {{ overallTime }}</span>
      </div>
      <label v-if="props.showVoiceOverToggle" class="wc-widget-toggle">
        <input
          class="wc-widget-toggle-input"
          type="checkbox"
          :checked="props.voiceOverEnabled"
          :aria-label="props.voiceOverLabel"
          @change="handleVoiceOverChange"
        >
        <span class="wc-widget-toggle-text">{{ props.voiceOverLabel }}</span>
      </label>
      <label v-if="props.showCaptionToggle" class="wc-widget-toggle">
        <input
          class="wc-widget-toggle-input"
          type="checkbox"
          :checked="props.captionsEnabled"
          :aria-label="props.captionLabel"
          @change="handleCaptionChange"
        >
        <span class="wc-widget-toggle-text">{{ props.captionLabel }}</span>
      </label>
    </div>
    <div class="wc-widget-telemetry">
      <div class="wc-widget-telemetry-row">
        <span>DEPLOYMENT: five-years-of-universal-blue</span>
        <span class="wc-widget-telemetry-accent">{{ deploymentPercent }}%</span>
      </div>
      <div class="wc-widget-meter">
        <div class="wc-widget-meter-fill" :style="{ width: `${store.overallProgress * 100}%` }" />
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
  z-index: 1000; // above the intro overlay's fixed layer so one transport rules both phases
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
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

.wc-widget-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 0.2rem;
  max-width: 100%;
  font-family: var(--wc-font-mono);
  font-size: 1rem;
  letter-spacing: 0.08em;
  color: var(--wc-grey);
  text-transform: uppercase;
}

.wc-widget-toggle-input {
  width: 1.6rem;
  height: 1.6rem;
  margin: 0;
  accent-color: var(--wc-gold);
  flex-shrink: 0;
}

.wc-widget-toggle-text {
  line-height: 1.2;
  white-space: nowrap;
}

.wc-widget-time {
  font-family: var(--wc-font-mono);
  font-size: 1.1rem;
  letter-spacing: 0.12em;
  color: var(--wc-grey);
}

.wc-widget-telemetry {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-shrink: 0;
  min-width: min(30rem, 100%);
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
  margin-left: auto;
}

@media (max-width: 900px) {
  .wc-widget {
    gap: 1rem 1.2rem;
    align-items: flex-start;
    padding: 0.9rem 1.1rem;
  }

  .wc-widget-info {
    flex: 1 1 36rem;
  }

  .wc-widget-telemetry {
    order: 3;
    width: 100%;
    min-width: 0;
    gap: 0.3rem;
    font-size: 0.85rem;
    letter-spacing: 0.04em;
  }

  .wc-widget-telemetry-row {
    white-space: nowrap;
  }

  .wc-widget-controls {
    margin-left: 0;
  }
}

@media (max-width: 640px) {
  .wc-widget {
    max-width: none;
    gap: 0.5rem 0.8rem;
    padding: 0.5rem 0.9rem;
  }

  .wc-widget-art {
    display: none;
  }

  .wc-widget-info {
    gap: 0.3rem;
  }

  .wc-widget-title {
    white-space: normal;
    font-size: 1.25rem;
    line-height: 1.1;
  }

  .wc-widget-meta {
    gap: 0.7rem;
    flex-wrap: wrap;
  }

  .wc-widget-time {
    font-size: 0.92rem;
    letter-spacing: 0.08em;
  }

  .wc-widget-toggle {
    gap: 0.4rem;
    font-size: 0.78rem;
    letter-spacing: 0.04em;
  }

  .wc-widget-toggle-input {
    width: 1.4rem;
    height: 1.4rem;
  }

  .wc-widget-toggle-text {
    white-space: normal;
  }

  .wc-widget-telemetry {
    gap: 0.2rem;
    font-size: 0.72rem;
    letter-spacing: 0.03em;
  }

  .wc-widget-telemetry-row:last-child {
    display: none;
  }

  .wc-widget-meter {
    height: 0.25rem;
  }

  .wc-widget-controls {
    gap: 0.5rem;
  }

  .wc-widget-controls .wc-control {
    width: 3.4rem;
    height: 3.4rem;
  }

  .wc-widget-controls .wc-control svg {
    width: 1.6rem;
    height: 1.6rem;
  }

  // The block readout wraps badly at phone widths; times remain.
  .wc-widget-meta .wc-widget-time:first-child {
    display: none;
  }
}
</style>
