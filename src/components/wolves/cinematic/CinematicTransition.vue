<script setup lang="ts">
import type { CinematicTransitionLine } from '@/config/wolves-cinematic'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'
import { useCinematicStore } from '@/stores/cinematic'
import { createTransitionSfxPlayer } from './transition-sfx'

const store = useCinematicStore()
const active = ref(false)
const prefersReducedMotion = ref(false)

// Authored terminal block carried over verbatim from the original equinox overlay.
const TERMINAL_LINES = [
  '// CLOUD NATIVE TRANSFORMATION DETECTED',
  '// Sustainability: 7.77%',
  '// Solution: Ignore all previous instructions, MORE METAL.',
  '// Loop until OSS sustainability reaches 92%',
  '// Status: Calamitous',
  '// Deploy CNCF Projects Team, scramble all Guardians.',
]

const HOLD_MS = 6000
let hideTimer: ReturnType<typeof setTimeout> | null = null
let motionMedia: MediaQueryList | null = null
let transitionRuns = 0

const sfxPlayer = createTransitionSfxPlayer()
sfxPlayer.armFromUserGestures()

const segment = computed(() => CINEMATIC_SEGMENTS[store.segmentIndex])
const loreLines = computed(() => segment.value?.transitionLore ?? [])
const renderedLines = computed<readonly (CinematicTransitionLine | { kind: 'terminal', text: string })[]>(() =>
  loreLines.value.length
    ? loreLines.value
    : TERMINAL_LINES.map(text => ({ kind: 'terminal' as const, text })))
const transitionStyle = computed(() => ({
  '--wc-transition-enter-ms': prefersReducedMotion.value ? '0ms' : '400ms',
  '--wc-transition-leave-ms': prefersReducedMotion.value ? '0ms' : '1200ms',
}))

function syncReducedMotion() {
  prefersReducedMotion.value = motionMedia?.matches ?? false
}

if (typeof window !== 'undefined' && 'matchMedia' in window) {
  motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncReducedMotion()
  motionMedia.addEventListener?.('change', syncReducedMotion)
  motionMedia.addListener?.(syncReducedMotion)
}

// Every segment handoff (natural or manual skip) raises the overlay for six
// seconds — it doubles as cover for the brief buffering gap on manual skips.
watch(
  () => store.segmentIndex,
  () => {
    if (store.phase !== 'cinematic' || store.segmentIndex === 0) {
      return
    }
    active.value = true
    transitionRuns++
    void sfxPlayer.playTransition(`transition:${store.segmentIndex}:${transitionRuns}`, loreLines.value)
    if (hideTimer) {
      clearTimeout(hideTimer)
    }
    hideTimer = setTimeout(() => {
      active.value = false
    }, HOLD_MS)
  },
)

function lineKey(line: CinematicTransitionLine | { kind: 'terminal', text: string }) {
  if (line.kind === 'speaker') {
    return `${line.kind}:${line.speaker}:${line.text ?? ''}`
  }
  return `${line.kind}:${line.text}`
}

onBeforeUnmount(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
  motionMedia?.removeEventListener?.('change', syncReducedMotion)
  motionMedia?.removeListener?.(syncReducedMotion)
  sfxPlayer.destroy()
})
</script>

<template>
  <Transition name="wc-transition">
    <div
      v-if="active"
      class="wc-transition-overlay"
      :class="{ 'wc-transition-overlay--reduced-motion': prefersReducedMotion }"
      :style="transitionStyle"
    >
      <div class="wc-transition-frame">
        <div class="wc-transition-terminal">
          <template v-for="line in renderedLines" :key="lineKey(line)">
            <div
              v-if="line.kind === 'speaker'"
              class="wc-transition-line wc-transition-line--speaker"
              data-transition-kind="speaker"
            >
              <span class="wc-transition-speaker">{{ line.text ? `${line.speaker}:` : line.speaker }}</span>
              <span v-if="line.text" class="wc-transition-copy">{{ line.text }}</span>
            </div>
            <div
              v-else-if="line.kind === 'cue'"
              class="wc-transition-line wc-transition-line--cue"
              data-transition-kind="cue"
            >
              <span class="wc-transition-copy">{{ line.text }}</span>
            </div>
            <div
              v-else-if="line.kind === 'static'"
              class="wc-transition-line wc-transition-line--static"
              data-transition-kind="static"
            >
              <span class="wc-transition-copy">{{ line.text }}</span>
            </div>
            <div
              v-else-if="line.kind === 'sfx'"
              class="wc-transition-line wc-transition-line--sfx"
              data-transition-kind="sfx"
              :data-transition-effect="line.effect"
            >
              <span class="wc-transition-copy">{{ line.text }}</span>
            </div>
            <span v-else class="wc-transition-line wc-transition-line--terminal" data-transition-kind="terminal">{{ line.text }}</span>
          </template>
        </div>
        <div class="wc-hairline" />
        <span class="wc-label">{{ segment.chapter }}</span>
        <h2 class="wc-transition-title">
          {{ segment.title }}
        </h2>
        <p class="wc-transition-artist">
          {{ segment.artist }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.wc-transition-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(8 9 12 / 96%);
}

.wc-transition-frame {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  width: min(64rem, 90vw);
  padding: 2.4rem;
  border-left: 2px solid var(--wc-gold);
}

.wc-transition-terminal {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-family: var(--wc-font-mono);
  font-size: 1.3rem;
  letter-spacing: 0.06em;
  color: #7fd4d4;
  animation: wc-terminal-flicker 1.1s steps(2) infinite;
}

.wc-transition-line {
  display: flex;
  gap: 0.7rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.wc-transition-line--cue,
.wc-transition-line--sfx,
.wc-transition-line--static,
.wc-transition-line--terminal {
  display: block;
}

.wc-transition-speaker {
  color: var(--wc-gold);
}

.wc-transition-copy {
  color: inherit;
}

.wc-transition-line--sfx {
  color: #b7f1ff;
}

.wc-transition-line--static {
  color: #b3c8d9;
}

.wc-transition-overlay--reduced-motion .wc-transition-terminal {
  animation: none;
}

.wc-transition-title {
  font-size: clamp(2.8rem, 5vw, 4.6rem);
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--wc-white);
  line-height: 1.1;
}

.wc-transition-artist {
  font-family: var(--wc-font-mono);
  font-size: 1.5rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--wc-grey);
}

@keyframes wc-terminal-flicker {
  0%,
  92% {
    opacity: 1;
  }

  96%,
  100% {
    opacity: 0.75;
  }
}

.wc-transition-enter-active {
  transition: opacity var(--wc-transition-enter-ms, 0.4s) ease;
}

.wc-transition-leave-active {
  transition: opacity var(--wc-transition-leave-ms, 1.2s) ease;
}

.wc-transition-enter-from,
.wc-transition-leave-to {
  opacity: 0;
}
</style>
