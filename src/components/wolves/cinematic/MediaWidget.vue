<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'

const props = withDefaults(defineProps<{
  title?: string
  showVoiceOverToggle?: boolean
  voiceOverEnabled?: boolean
  voiceOverLabel?: string
}>(), {
  showVoiceOverToggle: false,
  voiceOverEnabled: false,
  voiceOverLabel: 'Ikora voice over',
})

// The widget is a pure store subscriber: playback intents are emitted upward and
// wired to the stage by the app shell, never by reaching into player components.
const emit = defineEmits<{
  togglePlay: []
  toggleVoiceOver: [enabled: boolean]
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
const segmentPercent = computed(() => Math.round(store.segmentProgress * 100))
const PROGRESS_CELLS = 40
const progressCells = computed(() => {
  const filled = Math.round(store.segmentProgress * PROGRESS_CELLS)
  return Array.from({ length: PROGRESS_CELLS }, (_, index) => ({
    filled: index < filled,
    dino: index < filled && (index + 1) % 10 === 0,
  }))
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

function handleSeekKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 0.1 : 0.02
  let ratio = store.segmentProgress
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    ratio += step
  }
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    ratio -= step
  }
  else if (event.key === 'Home') {
    ratio = 0
  }
  else if (event.key === 'End') {
    ratio = 1
  }
  else {
    return
  }
  event.preventDefault()
  emit('seek', Math.min(Math.max(ratio, 0), 1))
}

function handleVoiceOverChange(event: Event) {
  emit('toggleVoiceOver', (event.target as HTMLInputElement).checked)
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
        aria-label="Seek through playback"
        :aria-valuenow="segmentPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        tabindex="0"
        @click="handleSeek"
        @keydown="handleSeekKeydown"
      >
        <span class="wc-widget-progress-ascii" aria-hidden="true">
          <span class="wc-widget-progress-bracket">[</span><span
            v-for="(cell, index) in progressCells"
            :key="index"
            :class="{ 'is-filled': cell.filled, 'is-dino': cell.dino }"
          >{{ cell.dino ? '🦖' : cell.filled ? '#' : '-' }}</span><span class="wc-widget-progress-bracket">]</span>
        </span>
      </div>
      <div class="wc-widget-meta">
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
        class="wc-control wc-control--primary"
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
  left: 50%;
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 1000; // above the intro overlay's fixed layer so one transport rules both phases
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'info controls';
  align-items: center;
  gap: 8px;
  width: min(calc(100vw - 32px), 576px);
  margin: 0;
  padding: 12px 16px;
  transform: translateX(-50%);
  touch-action: manipulation;
}

.wc-widget-art,
.wc-widget-telemetry {
  display: none;
}

.wc-widget-art {
  grid-area: art;
  width: 3.2rem;
  height: 3.2rem;
  object-fit: cover;
  clip-path: polygon(0.5rem 0, 100% 0, 100% calc(100% - 0.5rem), calc(100% - 0.5rem) 100%, 0 100%, 0 0.5rem);
}

.wc-widget-info {
  grid-area: info;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.wc-widget-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wc-widget-progress {
  display: flex;
  align-items: center;
  height: 32px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.wc-widget-progress-ascii {
  display: block;
  width: 100%;
  overflow: hidden;
  font-family: var(--wc-font-mono);
  font-size: 13px;
  letter-spacing: 0.02em;
  line-height: 1;
  color: var(--wc-grey);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.wc-widget-progress-ascii .is-filled {
  color: var(--wc-gold);
}

.wc-widget-progress-ascii .is-dino {
  display: inline-block;
  color: var(--wc-gold);
  filter: hue-rotate(150deg) saturate(1.5);
  transform: scale(1.05);
}

.wc-widget-progress-bracket {
  color: var(--wc-grey);
}

.wc-widget-meta {
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
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
  flex-shrink: 0;
  appearance: none;
  cursor: pointer;
  border: 1px solid var(--wc-gold);
  background: rgb(8 9 12 / 88%);
}

.wc-widget-toggle-input:checked {
  background:
    linear-gradient(var(--wc-gold), var(--wc-gold)) center / 0.8rem 0.8rem no-repeat,
    rgb(8 9 12 / 88%);
}

.wc-widget-toggle-input:focus-visible {
  outline: 2px solid var(--wc-gold);
  outline-offset: 2px;
}

.wc-widget-toggle-text {
  line-height: 1.2;
  white-space: nowrap;
}

.wc-widget-time {
  font-family: var(--wc-font-mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--wc-grey);
}

.wc-widget-telemetry {
  grid-area: telemetry;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  font-family: var(--wc-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--wc-grey);
}

.wc-widget-telemetry-row {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  white-space: nowrap;
}

.wc-widget-telemetry {
  display: none;
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
  grid-area: controls;
  display: flex;
  gap: 8px;
}

.wc-widget-controls .wc-control {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.wc-widget-controls .wc-control svg {
  width: 20px;
  height: 20px;
}

.wc-widget-controls .wc-control--primary {
  color: var(--wc-bg);
  background: var(--wc-gold);
  border-color: var(--wc-gold);
}

.wc-widget-controls .wc-control--primary:hover,
.wc-widget-controls .wc-control--primary:focus-visible {
  color: var(--wc-bg);
  background: var(--wc-white);
  border-color: var(--wc-white);
}

.wc-widget-progress:focus-visible {
  outline: 2px solid var(--wc-gold);
  outline-offset: 3px;
}

@media (max-width: 640px) {
  .wc-widget {
    width: calc(100vw - 24px);
    gap: 8px;
    padding: 10px 12px 4rem;
  }

  .wc-widget-info {
    gap: 0.2rem;
  }

  .wc-widget-title {
    white-space: normal;
    font-size: 15px;
    line-height: 1.1;
  }

  .wc-widget-meta {
    display: none;
  }

  .wc-widget-time {
    font-size: 12px;
    letter-spacing: 0.06em;
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

  .wc-widget-controls {
    gap: 8px;
  }

  .wc-widget-progress {
    position: absolute;
    right: 1.2rem;
    bottom: 0.2rem;
    left: 1.2rem;
  }
}
</style>
