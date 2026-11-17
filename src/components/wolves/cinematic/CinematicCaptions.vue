<script setup lang="ts">
import { computed } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'
import { activeCaptionCue, parseCaptionCues } from '@/utils/caption-cues'

const store = useCinematicStore()

// Caption tracks ship with the config as raw text; timestamps are keyed to the
// source video's native timeline, so cues stay aligned with authored trims.
const cues = computed(() => {
  const text = store.segment.captionsText
  return text
    ? parseCaptionCues(text)
    : []
})

const currentCue = computed(() => activeCaptionCue(cues.value, store.nativeTime))
</script>

<template>
  <Transition name="wc-caption">
    <div v-if="currentCue" class="wc-caption" aria-live="polite">
      <span class="wc-caption-backer wc-plate">{{ currentCue.text }}</span>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.wc-caption {
  position: absolute;
  inset-inline: 0;
  bottom: 16%;
  display: flex;
  justify-content: center;
  padding: 0 6vw;
  pointer-events: none;
}

.wc-caption-backer {
  max-width: 72rem;
  padding: 1rem 2.2rem;
  background: rgb(8 9 12 / 78%);
  border-left: 2px solid var(--wc-gold);
  font-size: 1.9rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1.45;
  color: var(--wc-white);
  text-align: center;
}

.wc-caption-enter-active,
.wc-caption-leave-active {
  transition: opacity 0.2s ease;
}

.wc-caption-enter-from,
.wc-caption-leave-to {
  opacity: 0;
}
</style>
