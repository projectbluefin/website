<script setup lang="ts">
import type { CaptionCue } from '@/utils/caption-cues'
import { computed, ref, watch } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'
import { activeCaptionCue, parseCaptionCues } from '@/utils/caption-cues'

const store = useCinematicStore()
const cues = ref<CaptionCue[]>([])

// Reload the caption track whenever the segment changes; segments without an
// authored track simply render nothing.
watch(
  () => store.segmentIndex,
  async () => {
    cues.value = []
    const url = store.segment.captionsUrl
    if (!url) {
      return
    }
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${url}`)
      if (response.ok) {
        cues.value = parseCaptionCues(await response.text())
      }
    }
    catch {
      // A missing caption file must never interrupt the cinematic.
    }
  },
  { immediate: true },
)

const currentCue = computed(() => activeCaptionCue(cues.value, store.segmentElapsed))
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
