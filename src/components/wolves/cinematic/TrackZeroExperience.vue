<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import WolvesComicReader from '@/components/wolves/WolvesComicReader.vue'
import WolvesLoreColumn from '@/components/wolves/WolvesLoreColumn.vue'
import { getNarrativeSlotForTime } from '@/data/wolves-narrative-timeline'
import { getWolvesThesisState } from '@/data/wolves-thesis-sequence'
import { useCinematicStore } from '@/stores/cinematic'

// The authored seven-days immersive layer, mounted over the video during the
// 7 Days segment. The video below stays the audio source; the locked comic
// reader and lore column are driven by the video's native timeline exactly as
// the old soundtrack player drove them (100ms progress resolution).
const store = useCinematicStore()

const time = computed(() => store.nativeTime)
const narrativeSlot = computed(() => getNarrativeSlotForTime(time.value))
const slotDuration = computed(() => Math.max(1, narrativeSlot.value.endTime - narrativeSlot.value.startTime))
const thesis = computed(() => getWolvesThesisState(time.value))

// Corruption glyph scramble for the growing-corruption thesis mode, using the
// same glyph alphabet as the original overlay.
const GLYPHS = '!<>-_\\//[]{}—=+*^?#________X01'
const corruptionText = ref('')
let glyphTimer: ReturnType<typeof setInterval> | null = null

watch(
  () => thesis.value.mode,
  (mode) => {
    if (glyphTimer) {
      clearInterval(glyphTimer)
      glyphTimer = null
    }
    if (mode === 'growing-corruption') {
      glyphTimer = setInterval(() => {
        corruptionText.value = Array.from(
          { length: 24 },
          () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        ).join('')
      }, 80)
    }
    else {
      corruptionText.value = ''
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (glyphTimer) {
    clearInterval(glyphTimer)
  }
})
</script>

<template>
  <div class="wc-trackzero">
    <div class="wc-trackzero-viewer">
      <WolvesComicReader :track-index="0" :playlist-current-time="time" />

      <Transition name="wc-thesis">
        <div v-if="thesis.active && (thesis.text || corruptionText)" class="wc-thesis" :class="`wc-thesis--${thesis.mode}`">
          <span v-if="corruptionText" class="wc-thesis-corruption">{{ corruptionText }}</span>
          <template v-else>
            <span class="wc-thesis-text">{{ thesis.text }}</span>
            <span v-if="thesis.subtitle" class="wc-thesis-subtitle">{{ thesis.subtitle }}</span>
            <span v-if="thesis.warning" class="wc-thesis-warning">{{ thesis.warning }}</span>
          </template>
        </div>
      </Transition>
    </div>

    <aside class="wc-trackzero-lore">
      <WolvesLoreColumn
        :artifact-id="narrativeSlot.artifactId"
        :duration="slotDuration"
        :warning="thesis.warning"
      />
    </aside>
  </div>
</template>

<style scoped lang="scss">
.wc-trackzero {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: 2fr 1fr; // authored desktop content split
  gap: 1.2rem;
  padding: 8rem 1.6rem 12rem; // clears the top plate and the media widget
  background: var(--wc-bg);
}

.wc-trackzero-viewer {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.wc-trackzero-lore {
  min-width: 0;
  min-height: 0;
  overflow: hidden auto;
}

.wc-thesis {
  position: absolute;
  inset-inline: 0;
  bottom: 8%;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  padding: 0 4%;
  text-align: center;
  pointer-events: none;
}

.wc-thesis-text {
  font-size: clamp(3.2rem, 5.4vw, 6rem);
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--wc-white);
  text-shadow: 0 0 24px rgb(8 9 12 / 90%);
}

.wc-thesis--legend .wc-thesis-text {
  color: var(--wc-gold);
}

.wc-thesis-subtitle {
  font-size: 1.8rem;
  letter-spacing: 0.2em;
  color: var(--wc-grey);
}

.wc-thesis-warning {
  font-family: var(--wc-font-mono);
  font-size: 1.3rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #c96a5a;
}

.wc-thesis-corruption {
  font-family: var(--wc-font-mono);
  font-size: clamp(2.4rem, 4vw, 4.4rem);
  letter-spacing: 0.3em;
  color: #7fd4d4;
}

.wc-thesis-enter-active,
.wc-thesis-leave-active {
  transition: opacity 0.4s ease;
}

.wc-thesis-enter-from,
.wc-thesis-leave-to {
  opacity: 0;
}

@media (max-width: 1023px) {
  .wc-trackzero {
    grid-template-columns: 1fr;
  }

  .wc-trackzero-lore {
    display: none; // mobile keeps the viewer fullscreen, matching mobile-first intent
  }
}
</style>
