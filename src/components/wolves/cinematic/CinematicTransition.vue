<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'
import { useCinematicStore } from '@/stores/cinematic'

const store = useCinematicStore()
const active = ref(false)

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

const segment = computed(() => CINEMATIC_SEGMENTS[store.segmentIndex])
const loreLines = computed(() => segment.value?.transitionLore ?? [])

// Every segment handoff (natural or manual skip) raises the overlay for six
// seconds — it doubles as cover for the brief buffering gap on manual skips.
watch(
  () => store.segmentIndex,
  () => {
    if (store.phase !== 'cinematic') {
      return
    }
    active.value = true
    if (hideTimer) {
      clearTimeout(hideTimer)
    }
    hideTimer = setTimeout(() => {
      active.value = false
    }, HOLD_MS)
  },
)
</script>

<template>
  <Transition name="wc-transition">
    <div v-if="active" class="wc-transition-overlay">
      <div class="wc-transition-frame">
        <div class="wc-transition-terminal">
          <span v-for="line in (loreLines.length ? loreLines : TERMINAL_LINES)" :key="line">{{ line }}</span>
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
  transition: opacity 0.4s ease;
}

.wc-transition-leave-active {
  transition: opacity 1.2s ease;
}

.wc-transition-enter-from,
.wc-transition-leave-to {
  opacity: 0;
}
</style>
