<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'
import TrackCredit from './TrackCredit.vue'

const props = withDefaults(defineProps<{
  title?: string
  showVoiceOverToggle?: boolean
  voiceOverEnabled?: boolean
  voiceOverLabel?: string
  /** Selectable scores for the current segment. Empty means no picker. */
  moods?: readonly { id: string, label: string }[]
  activeMoodId?: string
  autoHide?: boolean
  /** Optional external single-track playback. Omit these to use the store. */
  artwork?: string
  elapsed?: number
  duration?: number
  playing?: boolean
  showSkipControls?: boolean
}>(), {
  showVoiceOverToggle: false,
  voiceOverEnabled: false,
  voiceOverLabel: 'Ikora voice over',
  moods: () => [],
  activeMoodId: undefined,
  autoHide: false,
  artwork: undefined,
  elapsed: undefined,
  duration: undefined,
  playing: undefined,
  showSkipControls: true,
})

// The widget is a pure store subscriber: playback intents are emitted upward and
// wired to the stage by the app shell, never by reaching into player components.
const emit = defineEmits<{
  togglePlay: []
  toggleVoiceOver: [enabled: boolean]
  selectMood: [id: string]
  skip: [delta: number]
  seek: [ratio: number]
}>()

function handleMoodChange(event: Event) {
  emit('selectMood', (event.target as HTMLSelectElement).value)
}

const store = useCinematicStore()
const base = import.meta.env.BASE_URL
const mediaTitle = computed(() => props.title ?? store.display.title)
const externalPlayback = computed(() => props.elapsed !== undefined && props.duration !== undefined)
const showCatalogueCredit = computed(() =>
  !externalPlayback.value && !props.title && !store.isWolvesPresentation,
)
const artworkSrc = computed(() => {
  const artwork = props.artwork ?? store.display.artwork
  return artwork.startsWith('http') || artwork.startsWith('/') ? artwork : `${base}${artwork}`
})

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`
}

const segmentElapsed = computed(() => externalPlayback.value ? props.elapsed! : store.segmentElapsed)
const segmentDuration = computed(() => externalPlayback.value ? props.duration! : store.segmentDuration)
const segmentProgress = computed(() => segmentDuration.value > 0
  ? Math.min(Math.max(segmentElapsed.value / segmentDuration.value, 0), 1)
  : 0)
const overallElapsed = computed(() => externalPlayback.value ? segmentElapsed.value : store.overallElapsed)
const overallDuration = computed(() => externalPlayback.value ? segmentDuration.value : store.overallDuration)
const playing = computed(() => props.playing ?? store.playing)
const segmentTime = computed(() => `${formatTime(segmentElapsed.value)} / ${formatTime(segmentDuration.value)}`)
const overallTime = computed(() => `${formatTime(overallElapsed.value)} / ${formatTime(overallDuration.value)}`)
const segmentPercent = computed(() => Math.round(segmentProgress.value * 100))
const PROGRESS_CELLS = 40
// Split so the cell array only rebuilds when a cell actually changes. The clock
// polls ten times a second, but at 40 cells across a segment of several minutes
// roughly one cell changes every ten seconds; keying the array off the filled
// count instead of the raw progress lets Vue's computed cache absorb the rest.
const filledProgressCells = computed(() => Math.round(segmentProgress.value * PROGRESS_CELLS))
const progressCells = computed(() => {
  const filled = filledProgressCells.value
  return Array.from({ length: PROGRESS_CELLS }, (_, index) => ({
    filled: index < filled,
    dino: index < filled && (index + 1) % 10 === 0,
  }))
})

const canPrevious = computed(() => props.showSkipControls && store.widgetCanPrevious)
const canNext = computed(() => props.showSkipControls && store.widgetCanNext)
const NOVA_GLITCH_RANGES = [
  [0.7, 0.78],
  [0.79, 0.87],
  [0.88, 0.96],
] as const
const NOVA_GLITCH_DURATION_SECONDS = 0.45
const novaGlitchWindows = ref<readonly [number, number][]>([])

// Placed at the midpoint of each authored range. This used to be
// `start + (end - start) * Math.random()`, which meant no two runs of the show
// were the same and a glitch seen in rehearsal could not be reproduced or ruled
// out as a defect. Nothing in a single unattended performance benefits from the
// variation, and the ranges are already authored to differ from one another.
function scheduleNovaGlitches() {
  const duration = store.segments[0]?.durationSeconds ?? 424
  novaGlitchWindows.value = NOVA_GLITCH_RANGES.map(([start, end]) => {
    const time = duration * ((start + end) / 2)
    return [time, time + NOVA_GLITCH_DURATION_SECONDS]
  })
}

watch(() => store.phase, (phase) => {
  if (phase === 'cinematic' && store.segmentIndex === 0) {
    scheduleNovaGlitches()
  }
  else {
    novaGlitchWindows.value = []
  }
}, { immediate: true })

const showNovaGlitch = computed(() =>
  store.phase === 'cinematic'
  && store.segmentIndex === 0
  && novaGlitchWindows.value.some(([start, end]) => store.nativeTime >= start && store.nativeTime < end),
)

const progressEl = ref<HTMLElement | null>(null)
const isVisible = ref(true)
let autoHideTimer: ReturnType<typeof setTimeout> | null = null

function resetAutoHide() {
  if (!props.autoHide) {
    return
  }
  isVisible.value = true
  if (autoHideTimer) {
    clearTimeout(autoHideTimer)
  }
  autoHideTimer = setTimeout(() => {
    isVisible.value = false
  }, 3000)
}

watch(() => props.autoHide, (enabled) => {
  if (enabled) {
    resetAutoHide()
    return
  }
  if (autoHideTimer) {
    clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
  isVisible.value = true
})

onMounted(() => {
  window.addEventListener('pointermove', resetAutoHide, { passive: true })
  window.addEventListener('touchstart', resetAutoHide, { passive: true })
  if (props.autoHide) {
    resetAutoHide()
  }
})

onBeforeUnmount(() => {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer)
  }
  window.removeEventListener('pointermove', resetAutoHide)
  window.removeEventListener('touchstart', resetAutoHide)
})

let seekPointerId: number | null = null

function seekToClientX(clientX: number) {
  const rect = progressEl.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) {
    return
  }
  emit('seek', Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1))
}

function beginSeek(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }
  seekPointerId = event.pointerId
  progressEl.value?.setPointerCapture(event.pointerId)
  seekToClientX(event.clientX)
}

function continueSeek(event: PointerEvent) {
  if (event.pointerId === seekPointerId) {
    seekToClientX(event.clientX)
  }
}

function endSeek(event: PointerEvent) {
  if (event.pointerId !== seekPointerId) {
    return
  }
  seekToClientX(event.clientX)
  if (progressEl.value?.hasPointerCapture(event.pointerId)) {
    progressEl.value.releasePointerCapture(event.pointerId)
  }
  seekPointerId = null
}

function handleSeekKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 0.1 : 0.02
  let ratio = segmentProgress.value
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
  <footer
    class="wc-widget wc-plate wc-plate--sheen"
    :class="{ 'wc-widget--hidden': props.autoHide && !isVisible }"
    @focusin="resetAutoHide"
  >
    <span
      class="wc-widget-slogan wc-widget-slogan--left"
      :class="{ 'wc-widget-slogan--glitch': showNovaGlitch }"
      aria-hidden="true"
    >
      <template v-if="showNovaGlitch">#NOVA4EVER</template>
      <template v-else>#<span class="wc-widget-slogan-bluefin">F</span>IGHT<span class="wc-widget-slogan-bluefin">F</span>ORMAINTAINERS</template>
    </span>
    <span
      class="wc-widget-slogan wc-widget-slogan--right"
      :class="{ 'wc-widget-slogan--glitch': showNovaGlitch }"
      aria-hidden="true"
    >
      <template v-if="showNovaGlitch">#NOVA4EVER</template>
      <template v-else>#<span class="wc-widget-slogan-bluefin">F</span>IGHT<span class="wc-widget-slogan-bluefin">F</span>ORMAINTAINERS</template>
    </span>
    <img
      class="wc-widget-art"
      :src="artworkSrc"
      alt=""
    >
    <div class="wc-widget-info">
      <span class="wc-widget-title">
        <TrackCredit
          v-if="showCatalogueCredit"
          :title="store.segment.title"
          :artist="store.segment.artist"
        />
        <template v-else>{{ mediaTitle }}</template>
      </span>
      <div
        ref="progressEl"
        class="wc-widget-progress"
        role="slider"
        aria-label="Seek through playback"
        :aria-valuenow="segmentPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        tabindex="0"
        @pointerdown="beginSeek"
        @pointermove="continueSeek"
        @pointerup="endSeek"
        @pointercancel="endSeek"
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
      <label v-if="props.moods.length > 1" class="wc-widget-toggle">
        <span class="wc-widget-toggle-text">Mood</span>
        <select
          class="wc-widget-mood"
          aria-label="Prologue score"
          :value="props.activeMoodId"
          @change="handleMoodChange"
        >
          <option v-for="mood in props.moods" :key="mood.id" :value="mood.id">{{ mood.label }}</option>
        </select>
      </label>
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
        v-if="props.showSkipControls"
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
        :aria-label="playing ? 'Pause' : 'Play'"
        @click="emit('togglePlay')"
      >
        <svg v-if="playing" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
      </button>
      <button
        v-if="props.showSkipControls"
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
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.wc-widget--hidden {
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, calc(100% + 1rem));
}

.wc-widget-slogan {
  position: absolute;
  top: 50%;
  color: var(--wc-white);
  font-family: var(--wc-font-weyland-mono);
  font-size: clamp(1.4rem, 1.8vw, 2.8rem);
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1;
  pointer-events: none;
  text-shadow: 0 2px 10px rgb(0 0 0 / 85%);
  transform: translateY(-50%);
  white-space: nowrap;
}

.wc-widget-slogan--left {
  right: calc(100% + clamp(1.2rem, 3vw, 4rem));
}

.wc-widget-slogan--right {
  left: calc(100% + clamp(1.2rem, 3vw, 4rem));
}

.wc-widget-slogan-bluefin {
  color: #38bdf8;
}

.wc-widget-slogan--glitch {
  animation: wc-widget-slogan-glitch 0.18s steps(2, jump-none) infinite;
}

@keyframes wc-widget-slogan-glitch {
  0% {
    transform: translate(-2px, -50%) skewX(-4deg);
    text-shadow:
      2px 0 0 rgb(255 0 64 / 75%),
      -2px 0 0 rgb(0 220 255 / 75%);
  }

  50% {
    transform: translate(2px, -50%) skewX(3deg);
    text-shadow:
      -3px 0 0 rgb(255 0 64 / 75%),
      3px 0 0 rgb(0 220 255 / 75%);
  }

  100% {
    transform: translate(-1px, -50%);
  }
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
  touch-action: none;
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

/* The mood picker borrows the toggle's type and colour so the meta row keeps one
   voice. It is a real `<select>` rather than a custom menu on purpose: it has to
   be operable in a hurry, by a presenter who is not looking at it, on whatever
   machine the venue provides. */
.wc-widget-mood {
  padding: 0.1rem 0.3rem;
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 2px;
  background: rgb(0 0 0 / 45%);
  color: var(--wc-fg, #e9e9e5);
  font-family: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
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

@media (max-width: 1100px) {
  .wc-widget-slogan {
    display: none;
  }
}
</style>
