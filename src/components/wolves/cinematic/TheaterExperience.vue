<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import WolvesComicReader from '@/components/wolves/WolvesComicReader.vue'
import WolvesLoreColumn from '@/components/wolves/WolvesLoreColumn.vue'
import { getChromeFreeYoutubeEmbedParams } from '@/composables/useYoutubeIframeApi'
import { getDirectorsCutNarrativeSlotForTime } from '@/data/wolves-directors-cut-timeline'
import { getNarrativeSlotForTime } from '@/data/wolves-narrative-timeline'
import { getWolvesThesisState } from '@/data/wolves-thesis-sequence'
import { TRACKZERO_SIDECAR_VIDEO_IDS } from '@/data/wolves-track-zero-sidecar'
import { useCinematicStore, WOLVES_DIRECTORS_CUT_PROFILE_ID } from '@/stores/cinematic'

// The authored seven-days immersive layer, mounted over the video during the
// 7 Days segment. The video below stays the audio source; the locked comic
// reader and lore column are driven by the video's native timeline exactly as
// the old soundtrack player drove them (100ms progress resolution).
const store = useCinematicStore()

const time = computed(() => store.nativeTime)
// The lore column follows the player clock and nothing else. A record used to
// be able to pin this to its own slot until it finished rendering, which let a
// long transmission run past its window and start every record after it late.
//
// The Director's Cut schedules its own nine-quote science panel and closing bulletin on a
// different timeline (`wolves-directors-cut-timeline.ts`), compressed to its one-song runtime
// rather than the standard show's seven-part clock. Reading `getNarrativeSlotForTime()`
// unconditionally here resolved every Director's Cut clock reading against the standard show's
// schedule instead — the authored panel was fully built and tested but never reached live.
//
// That timeline also returns null, on purpose: the intervals between quotes and
// everything after the bulletin clears are authored image-only frames. Falling
// back to the last slot there would leave a stale quote on stage under the
// impact reveal, so a null slot renders an empty column instead.
const displayedNarrativeSlot = computed(() =>
  store.presentationProfile === WOLVES_DIRECTORS_CUT_PROFILE_ID
    ? getDirectorsCutNarrativeSlotForTime(time.value)
    : getNarrativeSlotForTime(time.value),
)
const displayedArtifactId = computed(() => displayedNarrativeSlot.value?.artifactId ?? '')
const slotDuration = computed(() => Math.max(1, (displayedNarrativeSlot.value?.endTime ?? 0) - (displayedNarrativeSlot.value?.startTime ?? 0)))
const slotElapsed = computed(() => Math.min(
  slotDuration.value,
  Math.max(0, time.value - (displayedNarrativeSlot.value?.startTime ?? 0)),
))
const isTrackZero = computed(() => store.segment.trackZeroExperience === true)
const isWolvesPresentation = computed(() => store.isWolvesPresentation)
const thesis = computed(() => (isTrackZero.value ? getWolvesThesisState(time.value) : getWolvesThesisState(0)))

// Static ordered video-loop sidecar for Track 0's desktop right column, below
// the scheduled lore panel. This is a plain native <iframe> embed (no IFrame
// Player API, no controls, no local media): muted, autoplaying, looping
// through the authored playlist, and inline on mobile browsers that support
// it. It must not mount on narrow viewports, so it is gated behind a
// reactive desktop media-query guard rather than CSS alone.
//
// The playlist itself lives in `wolves-track-zero-sidecar.ts` because the
// Director's Cut finale drives one of its entries through the IFrame API and
// the two surfaces must never disagree about which upload that is.

const trackZeroSidecarSrc = computed(() => {
  const [firstVideoId] = TRACKZERO_SIDECAR_VIDEO_IDS
  const params = getChromeFreeYoutubeEmbedParams({
    autoplay: '1',
    mute: '1',
    loop: '1',
    // Explicitly reset the documentary to its first frame instead of allowing
    // YouTube's embed state to resume at a previously watched position.
    start: '0',
    // Pin the playlist cursor as well as the timestamp; otherwise YouTube can
    // resume a previously watched item when the theater remounts.
    index: '0',
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

/**
 * Defer the Track 0 documentary sidecar so its heavy YouTube iframe doesn't
 * fight the cinematic handoff/dual-buffer players for network and GPU during
 * the first second of the immersive transition. The lore column is the main
 * focus; the sidecar is decorative accompaniment.
 */
const SIDECAR_MOUNT_DELAY_MS = 1000
const sidecarReady = ref(false)
let sidecarReadyTimer: ReturnType<typeof setTimeout> | null = null

function clearSidecarTimer() {
  if (sidecarReadyTimer) {
    clearTimeout(sidecarReadyTimer)
    sidecarReadyTimer = null
  }
}

watch([isTrackZero, isDesktopViewport], ([trackZero, desktop]) => {
  if (sidecarReady.value) {
    return
  }
  if (trackZero && desktop) {
    if (!sidecarReadyTimer) {
      sidecarReadyTimer = setTimeout(() => {
        sidecarReady.value = true
        sidecarReadyTimer = null
      }, SIDECAR_MOUNT_DELAY_MS)
    }
  }
  else {
    clearSidecarTimer()
  }
}, { immediate: true })

const showTrackZeroSidecar = computed(() => store.phase === 'cinematic'
  && isTrackZero.value
  && isDesktopViewport.value
  && sidecarReady.value
  && !store.directorFinaleActive)

// Background wallpaper layers: monthly Bluefin day/night pairs, one scene per
// song, dissolving from day to night across that song.
//
// The scene is a function of `segmentIndex` and the night blend is a function
// of progress *within* the segment, so the two cannot disagree: a song owns
// exactly one wallpaper and takes it from full day to full night, and the next
// song cuts to the next scene and starts its own dawn.
//
// This replaced `sin(frac(totalProgress * 12 + 6) * PI)` over a
// `(segmentIndex + trackProgress) / 7` clock. That was wrong twice over. The
// sine ran day -> night -> *back to day* inside every slot, so the background
// pulsed underneath slides that were not changing rather than progressing; and
// the twelve slots did not line up with the seven songs, so a scene change
// could land anywhere inside a song. The hardcoded `/ 7` was wrong a third
// time: the one-segment Director's Cut only ever reached 1/7 of the curve, so
// its single song got a fragment of one dissolve instead of a whole one.
//
// Deriving both from the segment is what makes the first song's dissolve run.
// Under the old clock the show opened at exactly `frac == 0`, and the opening
// dissolve was whatever fraction of a slot happened to remain.
const WALLPAPER_OPENING_PAIR_INDEX = 6
// December (index 11) is out of rotation, so the show cycles the eleven pairs
// below it. Wrapping keeps a scene per song for any segment count without
// repeating a scene until the pool is exhausted.
const WALLPAPER_PAIR_COUNT = 11

const segmentProgress = computed(() => {
  if (store.segmentDuration <= 0) {
    return 0
  }
  return Math.min(1, Math.max(0, store.segmentElapsed / store.segmentDuration))
})

const wallpaperNightOpacity = computed(() => {
  if (!isWolvesPresentation.value) {
    return 0
  }
  if (thesis.value.dayPulse) {
    return 0
  }
  return segmentProgress.value
})

const currentPairIndex = computed(() => {
  // Back-catalogue albums already crossfade large slideshow images. Running the
  // full-screen month wallpaper dissolve underneath at the same time compounds
  // decode/compositor work into a visible hitch, so their backdrop stays fixed.
  if (!isWolvesPresentation.value) {
    return WALLPAPER_OPENING_PAIR_INDEX
  }
  return (WALLPAPER_OPENING_PAIR_INDEX + store.segmentIndex) % WALLPAPER_PAIR_COUNT
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
  clearSidecarTimer()
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
        <!-- The outgoing scene belongs to the song that just ended, so it leaves
             at full night. Sharing the incoming buffer's opacity would snap it
             back to day for its whole 1.5s fade-out, because the new song's ramp
             starts at dawn. -->
        <div
          class="wc-wallpaper-layer wc-wallpaper-layer--night"
          :style="{ backgroundImage: getNightWallpaperUrl(previousMonth), opacity: 1 }"
        />
      </div>
      <div class="wc-wallpaper-buffer" :class="{ 'is-transitioning': isTransitioning }">
        <div class="wc-wallpaper-layer" :style="{ backgroundImage: getDayWallpaperUrl(activeMonth) }" />
        <div
          class="wc-wallpaper-layer wc-wallpaper-layer--night"
          data-wallpaper-night
          :style="{ backgroundImage: getNightWallpaperUrl(activeMonth), opacity: wallpaperNightOpacity }"
        />
      </div>
    </div>

    <!-- The finale unmounts the ordinary grid rather than covering it. `v-show`
         left the comic reader and the lore column mounted and running behind an
         opaque frame: they kept advancing their own clocks, kept the reader's
         image buffers warm, and — because the finale carries the same lore
         record — a second live instance of the bulletin ran off screen. Nothing
         under here is the finale's, so none of it should be alive during it.
         The standard show never sees this: `directorFinaleActive` is false
         unless the Director's Cut profile is running. -->
    <div
      v-if="!store.directorFinaleActive"
      class="wc-trackzero-grid"
      :class="{ 'wc-trackzero-grid--gallery': !isTrackZero }"
      data-trackzero-grid
    >
      <div class="wc-trackzero-viewer">
        <!-- One persistent reader across every part preserves the single
             Fisher-Yates gallery shuffle (no photo reuse between songs).
             `track-id` is required as well as `track-index`: the segment list is
             a curated subset of the playlist, so the index alone reads another
             song's tempo from Part V on. -->
        <WolvesComicReader
          :track-index="store.segmentIndex"
          :track-id="store.segment.youtubeId"
          :pending-track-index="store.pendingSegmentIndex ?? undefined"
          :playlist-current-time="time"
          :experience-id="store.experienceId"
          :wolves-experience="isWolvesPresentation"
          :presentation-profile="store.presentationProfile"
        />

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
            :artifact-id="displayedArtifactId"
            :duration="slotDuration"
            :elapsed="slotElapsed"
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
              allow="autoplay; encrypted-media; picture-in-picture"
              frameborder="0"
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
  contain: layout paint;
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
  backface-visibility: hidden;
  contain: layout paint;

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
  transform: translateZ(0);
  backface-visibility: hidden;
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
  inset: 11rem 0 10.5rem; // clears the full top plate and the hero widget budgets
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
  contain: layout paint;

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
  overflow: hidden;
}

.wc-trackzero-lore-row :deep(.wolves-lore-column) {
  flex: 1;
  min-height: 0;
}

.wc-trackzero-video-row {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
}

.wc-trackzero-video-title {
  align-self: flex-start;
  width: fit-content;
  max-width: 100%;
  margin: 0;
  padding: 0.35rem 0.65rem;
  border-left: 2px solid #38bdf8;
  border-radius: 0.25rem;
  background: rgb(8 9 12 / 78%);
  color: #38bdf8;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  line-height: 1.3;
}

.wc-trackzero-video-frame {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 1rem;
  overflow: hidden;
  background: transparent;
}

.wc-trackzero-video-frame iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  // The app-level MediaWidget owns playback. Prevent iframe hover/focus chrome
  // from ever appearing over the authored theater.
  pointer-events: none;
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
