<script setup lang="ts">
import type { WolvesTeamChatSequence } from '@/data/wolves-team-chats'
import { computed } from 'vue'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'
import { WOLVES_TEAM_CHATS } from '@/data/wolves-team-chats'
import { useCinematicStore } from '@/stores/cinematic'
import WolvesTeamChat from './WolvesTeamChat.vue'

const store = useCinematicStore()

// Authored terminal block carried over verbatim from the original equinox overlay.
const TERMINAL_LINES = [
  '// CLOUD NATIVE TRANSFORMATION DETECTED',
  '// Sustainability: 7.77%',
  '// Solution: Ignore all previous instructions, MORE METAL.',
  '// Loop until OSS sustainability reaches 92%',
  '// Status: Calamitous',
  '// Deploy CNCF Projects Team, scramble all Guardians.',
]

const TRANSITION_HOLD_SECONDS = 10
const TRANSITION_DECAY_SECONDS = 4

const segment = computed(() => CINEMATIC_SEGMENTS[store.segmentIndex])
const loreLines = computed(() => segment.value?.transitionLore ?? [])

// Full opacity through the hold window, then a linear fade over the decay
// window, derived solely from the real player clock so pause, seek, and
// YouTube ads freeze/restore state correctly (no wall-clock timers).
const shellOpacity = computed(() => {
  if (store.segmentIndex === 0) {
    return 0
  }
  const elapsed = store.segmentElapsed
  if (elapsed <= TRANSITION_HOLD_SECONDS) {
    return 1
  }
  return Math.max(
    0,
    1 - (elapsed - TRANSITION_HOLD_SECONDS) / TRANSITION_DECAY_SECONDS,
  )
})

const chatSequence = computed(() => {
  if (import.meta.env.DEV) {
    // Dev/CI-only: the Wolves browser flow test injects a placeholder chat
    // sequence through this window global so the separate team-chat region can be
    // asserted. Gated on import.meta.env.DEV so it is tree-shaken from production
    // builds and can never ship fixture dialogue; production WOLVES_TEAM_CHATS
    // stays empty and is never edited with dialogue here.
    const fixture = (window as unknown as {
      __wolvesTeamChatFixtures?: Record<string, WolvesTeamChatSequence>
    }).__wolvesTeamChatFixtures?.[segment.value.id]
    if (fixture) {
      return fixture
    }
  }
  return WOLVES_TEAM_CHATS[segment.value.id] ?? {
    messages: [],
    finalMessageEndsAtSeconds: 0,
  }
})
</script>

<template>
  <div class="wc-transition-layer">
    <div
      v-if="shellOpacity > 0"
      class="wc-transition-shell"
      :data-opacity="shellOpacity"
      :style="{ opacity: shellOpacity }"
    >
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

    <WolvesTeamChat
      :elapsed-seconds="store.segmentElapsed"
      :sequence="chatSequence"
    />
  </div>
</template>

<style scoped lang="scss">
.wc-transition-layer {
  display: contents;
}

.wc-transition-shell {
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
</style>
