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

// Static ordered video-loop sidecar for Track 0's desktop right column, below
// the scheduled lore panel. This is a plain native <iframe> embed (no IFrame
// Player API, no controls, no local media): muted, autoplaying, looping
// through the authored playlist, and inline on mobile browsers that support
// it. It must not mount on narrow viewports, so it is gated behind a
// reactive desktop media-query guard rather than CSS alone.
const TRACKZERO_SIDECAR_VIDEO_IDS = [
  'xu_yE8h3jT8',
  'PjryN2F6fF0',
  'jRXB67fcXZA',
  'tcj7O-hsCN0',
  '-lo2IXn9RK4',
  '_4SQ2mWxnEc',
  'bCA6l-VlpAY',
] as const

const trackZeroSidecarSrc = computed(() => {
  const [firstVideoId] = TRACKZERO_SIDECAR_VIDEO_IDS
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    loop: '1',
    controls: '0',
    playsinline: '1',
    playlist: TRACKZERO_SIDECAR_VIDEO_IDS.join(','),
  })
  return `https://www.youtube.com/embed/${firstVideoId}?${params.toString()}`
})

// The sidecar iframe only mounts at the authored desktop breakpoint (matches
// the `.wc-trackzero-lore` 1024px CSS breakpoint below). CSS `display: none`
// alone would still let the browser fetch and run the embed beneath 1024px,
// so this reactive guard keeps the iframe out of the DOM entirely on narrow
// viewports, mirroring the reduced-motion media-query pattern already used
// in `CinematicTransition.vue`.
const DESKTOP_SIDECAR_QUERY = '(min-width: 1024px)'
const isDesktopViewport = ref(false)
let desktopMedia: MediaQueryList | null = null

function syncDesktopViewport() {
  isDesktopViewport.value = desktopMedia?.matches ?? false
}

if (typeof window !== 'undefined' && 'matchMedia' in window) {
  desktopMedia = window.matchMedia(DESKTOP_SIDECAR_QUERY)
  syncDesktopViewport()
  desktopMedia.addEventListener?.('change', syncDesktopViewport)
  desktopMedia.addListener?.(syncDesktopViewport)
}

const showTrackZeroSidecar = computed(() => isTrackZero.value && isDesktopViewport.value)

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
  desktopMedia?.removeEventListener?.('change', syncDesktopViewport)
  desktopMedia?.removeListener?.(syncDesktopViewport)
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
          <div
            v-if="thesis.active && (thesis.text || corruptionText)"
            class="wc-thesis"
            :class="[
              `wc-thesis--${thesis.mode}`,
              { 'wc-thesis--welcome-back': thesis.mode === 'welcome' },
            ]"
          >
            <span v-if="corruptionText" class="wc-thesis-corruption">{{ corruptionText }}</span>
            <template v-else>
              <span class="wc-thesis-text">{{ thesis.text }}</span>
              <span v-if="thesis.subtitle" class="wc-thesis-subtitle">{{ thesis.subtitle }}</span>
            </template>
          </div>
        </Transition>
      </div>

      <aside v-if="isTrackZero" class="wc-trackzero-lore immersive-col-right">
        <div class="wc-trackzero-lore-row">
          <WolvesLoreColumn
            :artifact-id="narrativeSlot.artifactId"
            :duration="slotDuration"
            :warning="thesis.warning"
          />
        </div>

        <section
          v-if="showTrackZeroSidecar"
          class="wc-trackzero-video-row"
          data-trackzero-video-sidecar
        >
          <h3 class="wc-trackzero-video-title font-mono">
            [ SIGNAL RELAY - EARTH - COMPANIONS IDENTIFIED ]
          </h3>
          <div class="wc-trackzero-video-frame">
            <iframe
              :src="trackZeroSidecarSrc"
              title="Track 0 companion video loop"
              allow="autoplay; encrypted-media"
              frameborder="0"
            />
            <div
              class="wc-trackzero-video-chrome-mask"
              data-trackzero-video-chrome-mask
              aria-hidden="true"
            />
          </div>
        </section>
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
    // Hold the 3:2 portal ratio inside the flex column: the width cap keeps
    // the derived height within the stage, and auto margins center the box.
    flex: 0 1 auto;
    margin: auto;
    min-height: 0 !important;
    aspect-ratio: 3 / 2;
    width: min(100%, calc((100vh - 22rem) * 1.5));
    max-width: 100%;
    max-height: calc(100vh - 22rem);
  }
}

.wc-trackzero-lore {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1.6rem;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.wc-trackzero-lore-row {
  display: flex;
  min-height: 0;
  overflow: hidden auto;
}

.wc-trackzero-lore-row :deep(.wolves-lore-column) {
  flex: 1;
  min-height: 0;
}

.wc-trackzero-video-row {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  min-height: 0;
  padding: 1.2rem;
  border-radius: 12px;
  border: 1px solid #272727;
  background: #10151f;
  overflow: hidden;
}

.wc-trackzero-video-title {
  margin: 0;
  color: #38bdf8;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
}

.wc-trackzero-video-frame {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.wc-trackzero-video-frame iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  pointer-events: none;
}

.wc-trackzero-video-chrome-mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(to bottom, #000 0 3.5rem, transparent 5rem),
    linear-gradient(to top, #000 0 2.5rem, transparent 4rem);
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
  font-family: var(--wc-font-weyland-mono);
  font-size: clamp(3.2rem, 5.4vw, 6rem);
  font-weight: 400;
  line-height: 1.08;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #93c5fd;
  text-shadow:
    0 0 12px rgb(125 211 252 / 95%),
    0 0 32px rgb(59 130 246 / 78%),
    0 0 68px rgb(37 99 235 / 48%),
    0 0 24px rgb(8 9 12 / 90%);
}

.wc-thesis--universal-blue .wc-thesis-text,
.wc-thesis--evolve .wc-thesis-text {
  font-size: clamp(3.6rem, 5.8vw, 6.4rem);
  color: #bfdbfe;
}

.wc-thesis--welcome,
.wc-thesis--legend {
  background: radial-gradient(circle, rgb(26 95 160 / 42%), transparent 62%);
}

.wc-thesis--welcome .wc-thesis-text,
.wc-thesis--legend .wc-thesis-text {
  font-family: var(--wc-font-weyland);
  font-size: clamp(3.6rem, 6vw, 6.8rem);
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: 0.14em;
  color: #dbeafe;
  text-shadow:
    0 0 14px rgb(125 211 252 / 100%),
    0 0 38px rgb(59 130 246 / 92%),
    0 0 82px rgb(37 99 235 / 68%),
    0 0 24px rgb(8 9 12 / 90%);
}

.wc-thesis--welcome-back {
  gap: 1.2rem;

  &::before,
  &::after {
    width: clamp(5rem, 12vw, 14rem);
    height: 2px;
    content: '';
    background: linear-gradient(to right, transparent, #93c5fd 60%, #fff 100%);
    box-shadow: 0 0 8px rgb(147 197 253 / 55%);
  }

  &::after {
    background: linear-gradient(to left, transparent, #93c5fd 60%, #fff 100%);
  }
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
