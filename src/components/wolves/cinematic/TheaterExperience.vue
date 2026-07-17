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
const isTrackZero = computed(() => store.segment.trackZeroExperience === true)
const thesis = computed(() => (isTrackZero.value ? getWolvesThesisState(time.value) : getWolvesThesisState(0)))

// Background wallpaper layers, carried over from the original immersive
// theater: monthly Bluefin day/night pairs crossfade over 1.5s as soundtrack
// progress advances, with a sine-modulated night blend. Progress spans the
// whole seven-part show, matching the original (trackIndex + trackProgress)/7.
const totalProgress = computed(() => {
  const trackProgress = store.segmentDuration > 0 ? store.segmentElapsed / store.segmentDuration : 0
  return Math.min(1, Math.max(0, (store.segmentIndex + trackProgress) / 7))
})

const wallpaperNightOpacity = computed(() => {
  if (thesis.value.dayPulse) {
    return 0
  }
  const wallpaperIndexFloat = totalProgress.value * 12 + 6
  return Math.sin((wallpaperIndexFloat - Math.floor(wallpaperIndexFloat)) * Math.PI)
})

const currentPairIndex = computed(() => {
  const wallpaperIndexFloat = totalProgress.value * 12 + 6
  const pairIndex = Math.floor(wallpaperIndexFloat) % 12
  // December is intentionally out of rotation; November holds through its slot.
  return pairIndex === 11 ? 10 : pairIndex
})

const activeMonth = ref(6)
const previousMonth = ref<number | null>(null)
const isTransitioning = ref(false)
let wallpaperTimeout: ReturnType<typeof setTimeout> | null = null

watch(currentPairIndex, (newVal, oldVal) => {
  if (oldVal !== undefined && newVal !== oldVal) {
    previousMonth.value = oldVal
    activeMonth.value = newVal
    isTransitioning.value = true
    if (wallpaperTimeout) {
      clearTimeout(wallpaperTimeout)
    }
    wallpaperTimeout = setTimeout(() => {
      previousMonth.value = null
      isTransitioning.value = false
    }, 1500)
  }
  else {
    activeMonth.value = newVal
  }
}, { immediate: true })

function getDayWallpaperUrl(monthIndex: number) {
  const pairStr = String(monthIndex + 1).padStart(2, '0')
  return `url('${import.meta.env.BASE_URL}img/wallpapers/bluefin-${pairStr}-day.webp')`
}

function getNightWallpaperUrl(monthIndex: number) {
  const pairStr = String(monthIndex + 1).padStart(2, '0')
  return `url('${import.meta.env.BASE_URL}img/wallpapers/bluefin-${pairStr}-night.webp')`
}

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
  if (wallpaperTimeout) {
    clearTimeout(wallpaperTimeout)
  }
})
</script>

<template>
  <div class="wc-trackzero">
    <!-- Fading monthly day/night wallpaper layers behind the theater grid. -->
    <div class="wc-wallpaper-container">
      <div v-if="previousMonth !== null" class="wc-wallpaper-buffer fading-out">
        <div class="wc-wallpaper-layer" :style="{ backgroundImage: getDayWallpaperUrl(previousMonth) }" />
        <div class="wc-wallpaper-layer" :style="{ backgroundImage: getNightWallpaperUrl(previousMonth), opacity: wallpaperNightOpacity }" />
      </div>
      <div class="wc-wallpaper-buffer" :class="{ 'is-transitioning': isTransitioning }">
        <div class="wc-wallpaper-layer" :style="{ backgroundImage: getDayWallpaperUrl(activeMonth) }" />
        <div class="wc-wallpaper-layer" :style="{ backgroundImage: getNightWallpaperUrl(activeMonth), opacity: wallpaperNightOpacity }" />
      </div>
    </div>

    <div class="wc-trackzero-grid" :class="{ 'wc-trackzero-grid--gallery': !isTrackZero }">
      <div class="wc-trackzero-viewer">
        <!-- One persistent reader across every part preserves the single
             Fisher-Yates gallery shuffle (no photo reuse between songs). -->
        <WolvesComicReader :track-index="store.segmentIndex" :playlist-current-time="time" />

        <Transition name="wc-thesis">
          <div v-if="thesis.active && (thesis.text || corruptionText)" class="wc-thesis" :class="`wc-thesis--${thesis.mode}`">
            <span v-if="corruptionText" class="wc-thesis-corruption">{{ corruptionText }}</span>
            <template v-else>
              <span class="wc-thesis-text">{{ thesis.text }}</span>
              <span v-if="thesis.subtitle" class="wc-thesis-subtitle">{{ thesis.subtitle }}</span>
            </template>
          </div>
        </Transition>
      </div>

      <aside v-if="isTrackZero" class="wc-trackzero-lore">
        <WolvesLoreColumn
          :artifact-id="narrativeSlot.artifactId"
          :duration="slotDuration"
          :warning="thesis.warning"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wc-trackzero {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: var(--wc-bg);
}

.wc-wallpaper-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.wc-wallpaper-buffer {
  position: absolute;
  inset: 0;
  opacity: 1;
  pointer-events: none;
  will-change: opacity;
  transform: translateZ(0);

  &.fading-out {
    animation: wc-wallpaper-fade-out 1.5s linear forwards;
    z-index: 1;
  }

  &.is-transitioning {
    z-index: 2;
    animation: wc-wallpaper-fade-in 1.5s linear forwards;
  }
}

.wc-wallpaper-layer {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}

@keyframes wc-wallpaper-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes wc-wallpaper-fade-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

.wc-trackzero-grid {
  position: absolute;
  inset: 9rem 0 10.5rem; // clears the top plate and the hero widget budgets
  display: grid;
  grid-template-columns: 2fr 1fr; // authored desktop content split
  align-items: stretch;
  gap: 2.4rem;
  padding: 0 2.4rem;
  min-height: 0;

  // Later parts: the centered CNCF community gallery takes the full stage.
  &--gallery {
    --wc-org-ad-gutter: clamp(12rem, 16vw, 18rem);
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    padding-inline: var(--wc-org-ad-gutter);

    .wc-trackzero-viewer {
      width: min(100%, 120rem);
    }
  }
}

.wc-trackzero-viewer {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;

  // Original immersive sizing: the comic reader portal fills the full column.
  :deep(#comic-reader) {
    height: 100% !important;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin: 0;
    max-width: 100%;
    padding: 0;
  }

  :deep(.page-flip-comic-layout) {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
  }

  :deep(.comic-viewport) {
    flex: 1;
    min-height: 0 !important;
    max-height: calc(100vh - 22rem);
    width: 100%;
    max-width: 100%;
  }
}

.wc-trackzero-lore {
  min-width: 0;
  min-height: 0;
  height: 100%;
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
  .wc-trackzero-grid {
    grid-template-columns: 1fr;
  }

  .wc-trackzero-grid--gallery {
    padding-inline: 2.4rem; // desktop ad gutters are hidden below 1024px
  }

  .wc-trackzero-lore {
    display: none; // mobile keeps the viewer fullscreen, matching mobile-first intent
  }
}
</style>
