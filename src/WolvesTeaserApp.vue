<script setup lang="ts">
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import type { ExperienceManifest } from '@/config/experience-manifest'
import type { TrailerPlate } from '@/data/wolves-trailer-plates'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import WolvesBackCatalogue from '@/components/wolves/WolvesBackCatalogue.vue'
import WolvesHelmLine from '@/components/wolves/WolvesHelmLine.vue'
import WolvesTrailerLine from '@/components/wolves/WolvesTrailerLine.vue'
import { getChromeFreeYoutubePlayerVars, getYoutubePlayerConstructor, loadYoutubeIframeApi } from '@/composables/useYoutubeIframeApi'
import {
  activeTrailerPlates,
  TRAILER_BRIDGE_MONTH,
  TRAILER_CREDIT_JOIN_SECONDS,
  TRAILER_CREDIT_LINE,
  TRAILER_DURATION_SECONDS,
  TRAILER_ENDCARD_HOLD_SECONDS,
  TRAILER_MUSIC_END_SECONDS,
  TRAILER_TITLE_LABEL,
  TRAILER_TITLE_LINE,
  TRAILER_VIDEO_ID,
  trailerBridgeState,
  trailerHeadingOpacity,
  trailerOpeningBlackOpacity,
  trailerPlateOpacity,
  trailerSegmentAt,
} from '@/data/wolves-trailer-plates'

const base = import.meta.env.BASE_URL
const heroBackground = `${base}img/wallpapers/wolves/people/Always There.webp`
const dayWallpaper = `${base}img/wallpapers/bluefin-${TRAILER_BRIDGE_MONTH}-day.webp`
const nightWallpaper = `${base}img/wallpapers/bluefin-${TRAILER_BRIDGE_MONTH}-night.webp`

const stageHost = ref<HTMLElement | null>(null)
const playerHost = ref<HTMLElement | null>(null)
const fullscreenActive = ref(false)
let player: YoutubePlayer | null = null
let playerReady = false
let clockTimer: ReturnType<typeof setInterval> | null = null
let silentHoldStartedAtMs: number | null = null

type TrailerPhase = 'idle' | 'playing' | 'paused' | 'ended'
const trailerPhase = ref<TrailerPhase>('idle')
const now = ref(0)

const visualTime = computed(() => now.value >= TRAILER_MUSIC_END_SECONDS
  ? TRAILER_ENDCARD_HOLD_SECONDS
  : now.value)
const openingBlackOpacity = computed(() => trailerOpeningBlackOpacity(visualTime.value))
const visiblePlates = computed(() => activeTrailerPlates(visualTime.value))
const plateById = computed(() => new Map(visiblePlates.value.map(plate => [plate.id, plate])))

function plate(id: string): TrailerPlate | undefined {
  return plateById.value.get(id)
}

/** A plate's authored fade, so nothing hard-cuts that should not. */
function opacityOf(id: string): number {
  const found = plate(id)
  return found ? trailerPlateOpacity(found, visualTime.value) : 0
}

const creditVisible = computed(() => visualTime.value >= TRAILER_CREDIT_JOIN_SECONDS)

// The page heading steps aside before the cut's own main title arrives, so the
// film's name is only ever on screen once. See trailerHeadingOpacity().
const headingOpacity = computed(() =>
  trailerHeadingOpacity(visualTime.value, { playing: trailerPhase.value === 'playing' }))

// The cut leaves the music video at 88.2 s and never returns to it: the day
// cards and the end card play over the March Bluefin wallpaper at full frame.
const segment = computed(() => trailerSegmentAt(visualTime.value))
const bridge = computed(() => trailerBridgeState(visualTime.value))

// Both book plates are boxes on the same page; each carries its own anchor,
// which the delivered cut walks with the camera.
const bookPlates = computed(() => visiblePlates.value.filter(p => p.kind === 'bookline'))
const dayCards = computed(() => visiblePlates.value.filter(p => p.kind === 'daycard'))

/** Seat a plate by its anchor in the 1920x1080 authoring frame. */
function anchorStyle(anchored: TrailerPlate) {
  const [x, y] = anchored.anchor ?? [960, 540]
  return { left: `${(x / 1920) * 100}%`, top: `${(y / 1080) * 100}%` }
}

function syncFullscreen() {
  fullscreenActive.value = document.fullscreenElement === stageHost.value
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
    else {
      await stageHost.value?.requestFullscreen?.()
    }
  }
  catch {
    // Fullscreen can be denied by browser policy; playback remains usable.
  }
}

function stopClock() {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

function startSilentHold(from = now.value) {
  player?.pauseVideo?.()
  now.value = Math.min(Math.max(from, TRAILER_MUSIC_END_SECONDS), TRAILER_DURATION_SECONDS)
  silentHoldStartedAtMs = Date.now() - (now.value - TRAILER_MUSIC_END_SECONDS) * 1000
}

function tick() {
  if (silentHoldStartedAtMs !== null) {
    now.value = Math.min(
      TRAILER_MUSIC_END_SECONDS + (Date.now() - silentHoldStartedAtMs) / 1000,
      TRAILER_DURATION_SECONDS,
    )
    if (now.value >= TRAILER_DURATION_SECONDS) {
      silentHoldStartedAtMs = null
      trailerPhase.value = 'ended'
      stopClock()
    }
    return
  }
  if (!playerReady) {
    return
  }
  const t = player?.getCurrentTime?.()
  if (typeof t !== 'number') {
    return
  }
  if (t >= TRAILER_MUSIC_END_SECONDS) {
    startSilentHold(TRAILER_MUSIC_END_SECONDS)
    return
  }
  now.value = t
}

function startClock() {
  stopClock()
  clockTimer = setInterval(tick, 100)
}

function playTrailer() {
  trailerPhase.value = 'playing'
  if (now.value >= TRAILER_MUSIC_END_SECONDS) {
    startSilentHold(now.value)
  }
  else if (playerReady) {
    player?.playVideo?.()
  }
  startClock()
}

function toggleTrailer() {
  if (trailerPhase.value === 'playing') {
    if (silentHoldStartedAtMs !== null) {
      tick()
      silentHoldStartedAtMs = null
    }
    else if (playerReady) {
      player?.pauseVideo?.()
    }
    trailerPhase.value = 'paused'
    stopClock()
    return
  }
  if (trailerPhase.value === 'ended') {
    replayTrailer()
    return
  }
  playTrailer()
}

function seekTrailer(ratio: number) {
  const target = Math.min(Math.max(ratio, 0), 1) * TRAILER_DURATION_SECONDS
  now.value = target
  if (trailerPhase.value === 'idle' || trailerPhase.value === 'ended') {
    trailerPhase.value = 'paused'
  }
  if (target >= TRAILER_MUSIC_END_SECONDS) {
    player?.seekTo?.(TRAILER_MUSIC_END_SECONDS, true)
    player?.pauseVideo?.()
    silentHoldStartedAtMs = trailerPhase.value === 'playing'
      ? Date.now() - (target - TRAILER_MUSIC_END_SECONDS) * 1000
      : null
  }
  else {
    silentHoldStartedAtMs = null
    if (playerReady) {
      player?.seekTo?.(target, true)
    }
  }
}

function replayTrailer() {
  now.value = 0
  silentHoldStartedAtMs = null
  trailerPhase.value = 'playing'
  if (playerReady) {
    player?.seekTo?.(0, true)
    player?.playVideo?.()
  }
  startClock()
}

function openExperience(manifest: ExperienceManifest) {
  // Albums play through the full cinematic runtime, which lives at the
  // experience route; the teaser hands off with a deep link.
  window.location.assign(`${base}wolves/experience/?album=${encodeURIComponent(manifest.id)}`)
}

onMounted(() => document.addEventListener('fullscreenchange', syncFullscreen))

onMounted(async () => {
  try {
    await loadYoutubeIframeApi()
    const Player = getYoutubePlayerConstructor()
    if (!Player || !playerHost.value) {
      return
    }
    player = new Player(playerHost.value, {
      videoId: TRAILER_VIDEO_ID,
      playerVars: getChromeFreeYoutubePlayerVars({ autoplay: 0 }),
      events: {
        onReady: ({ target }: { target: YoutubePlayer }) => {
          if (player !== target) {
            return
          }
          playerReady = true
          if (now.value > 0) {
            target.seekTo?.(Math.min(now.value, TRAILER_MUSIC_END_SECONDS), true)
          }
          if (trailerPhase.value === 'playing' && now.value >= TRAILER_MUSIC_END_SECONDS) {
            startSilentHold(now.value)
          }
          else if (trailerPhase.value === 'playing') {
            target.playVideo?.()
          }
        },
      },
    })
    if (import.meta.env.DEV) {
      // Same contract as the main app's __wolvesCinematic: a harness hook so
      // browser verification can jump the trailer clock instead of watching
      // 110 seconds of footage on every run.
      ;(window as any).__wolvesTeaser = {
        seekTo: (s: number) => seekTrailer(s / TRAILER_DURATION_SECONDS),
        now: () => now.value,
        segment: () => segment.value,
      }
    }
  }
  catch {
    // The page still works as a teaser without the embed; the plates and
    // albums render regardless.
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  stopClock()
  player?.destroy?.()
  player = null
  playerReady = false
  silentHoldStartedAtMs = null
})
</script>

<template>
  <div class="wt-page" :style="{ '--wt-hero-background': `url('${heroBackground}')` }">
    <!-- Keep the film title above the trailer without restoring the old
         full-height hero that pushed the video below the fold. It yields
         before the cut's own title card so the title lands once. -->
    <section ref="stageHost" class="wt-stage" aria-label="Official teaser trailer">
      <h1 class="wt-heading" :style="{ opacity: headingOpacity }">
        Seven Days to the Wolves
      </h1>
      <div class="wt-player wc-plate" data-wolves-trailer>
        <!-- The delivered frame is 16:9 with the 2.39:1 picture letterboxed
             inside it, so the embed is given a 16:9 box and YouTube pillars
             the source itself. Every card coordinate then maps 1:1. -->
        <div class="wt-player-frame">
          <div ref="playerHost" class="wt-player-host" />
        </div>

        <!-- The raw Nightwish upload is not the authored opening. The delivered
             cut holds black until the explosion blooms at 12.2 seconds. -->
        <div
          v-if="openingBlackOpacity > 0"
          class="wt-opening-black"
          :style="{ opacity: openingBlackOpacity }"
          aria-hidden="true"
        />

        <!-- Segments two and three: the March wallpaper, day falling into
             night, covering the picture for the last 21.8 s. -->
        <div
          v-if="segment !== 'picture'"
          class="wt-backdrop"
          aria-hidden="true"
        >
          <div
            class="wt-backdrop-images"
            :style="{ opacity: segment === 'bridge' ? bridge.opacity : 1 }"
          >
            <img class="wt-backdrop-img" :src="dayWallpaper" alt="">
            <img
              class="wt-backdrop-img"
              :src="nightWallpaper"
              alt=""
              :style="{ opacity: segment === 'bridge' ? bridge.nightMix : 1 }"
            >
          </div>
        </div>

        <div v-if="trailerPhase === 'idle'" class="wt-poster">
          <span class="wc-label wt-poster-kicker">TRAILER 1</span>
          <div class="wt-convenience-controls">
            <button class="wt-convenience-play wc-cta--primary" type="button" @click="toggleTrailer">
              <span aria-hidden="true">▶</span>
              Play
            </button>
            <button class="wt-convenience-fullscreen" type="button" @click="toggleFullscreen">
              <span aria-hidden="true">⛶</span>
              {{ fullscreenActive ? 'Exit Fullscreen' : 'Fullscreen' }}
            </button>
          </div>
        </div>

        <div class="wt-overlays" aria-hidden="true">
          <!-- THE MAIN TITLE. One lockup across both authored beats: the
               credit row always occupies its space, so the title cannot jump
               when the credits arrive. -->
          <div
            v-if="plate('maintitle')"
            class="wt-lockup"
            :style="{ opacity: opacityOf('maintitle') }"
          >
            <span class="wt-eyebrow">
              <WolvesTrailerLine :text="TRAILER_TITLE_LABEL" />
            </span>
            <span class="wt-title">
              <WolvesTrailerLine :text="TRAILER_TITLE_LINE" mark-word="wolves" />
            </span>
            <div class="wt-rule" />
            <div class="wt-credits" :class="{ 'is-shown': creditVisible }">
              <WolvesTrailerLine :text="TRAILER_CREDIT_LINE" />
            </div>
          </div>

          <!-- THE BOOK BOX. Opaque, never dissolved, and seated by its anchor
               so it covers the book's printed words. -->
          <div
            v-for="book in bookPlates"
            :key="book.id"
            class="wt-book"
            :style="anchorStyle(book)"
          >
            <p v-for="line in book.lines ?? []" :key="line" class="wt-book-line">
              {{ line }}
            </p>
          </div>

          <!-- THE DAY CARDS, on the wallpaper, low in the frame so the type
               sits in the shadowed meadow rather than the bright horizon. -->
          <div
            v-for="card in dayCards"
            :key="card.id"
            class="wt-daycard"
            :style="{ opacity: trailerPlateOpacity(card, visualTime) }"
          >
            <p class="wt-daycard-line">
              <WolvesTrailerLine :text="card.title ?? ''" mark-word="Extinction" />
            </p>
          </div>

          <!-- THE END CARD. One poster: the event rows arrive first and the
               call to action joins them, seated where the full poster puts
               it rather than jumping upward. -->
          <div v-if="segment === 'endcard'" class="wt-lockup wt-lockup--poster">
            <template v-if="plate('endcard-event')">
              <span class="wt-poster-event" :style="{ opacity: opacityOf('endcard-event') }">
                <!-- KubeCon and CloudNativeCon are Linux Foundation marks and
                     are deliberately not recoloured; only the divider is drawn. -->
                <WolvesTrailerLine :text="plate('endcard-event')!.title!" :blue="false" />
              </span>
              <span class="wt-poster-venue" :style="{ opacity: opacityOf('endcard-event') }">
                {{ plate('endcard-event')!.subtitle }}
              </span>
              <div class="wt-rule wt-rule--poster" :style="{ opacity: opacityOf('endcard-event') }" />
            </template>
            <template v-if="plate('endcard-cta')">
              <!-- The URL's dots sear, not the URL: the owner kept the b and
                   the f white on this one. -->
              <span class="wt-poster-cta" :style="{ opacity: opacityOf('endcard-cta') }">
                <WolvesTrailerLine :text="plate('endcard-cta')!.title!" accent-dots />
              </span>
              <span class="wt-poster-tags" :style="{ opacity: opacityOf('endcard-cta') }">
                <span
                  v-for="tag in plate('endcard-cta')!.tags ?? []"
                  :key="tag"
                  class="wt-poster-tag"
                >{{ tag }}</span>
              </span>
            </template>
          </div>
        </div>
      </div>

      <p class="wt-standfirst">
        <span class="wc-label">
          <WolvesHelmLine text="SEVEN PILLARS · ONE COMMUNITY · ONE DESTINY" />
        </span>
        <span class="wc-label wt-standfirst-date">2 NOVEMBER 2026</span>
      </p>

      <MediaWidget
        title="November 2026"
        :artwork="heroBackground"
        :elapsed="now"
        :duration="TRAILER_DURATION_SECONDS"
        :playing="trailerPhase === 'playing'"
        :show-skip-controls="false"
        :auto-hide="trailerPhase === 'playing'"
        @toggle-play="toggleTrailer"
        @seek="seekTrailer"
      />
    </section>

    <WolvesBackCatalogue @launch="openExperience" />
  </div>
</template>

<style scoped lang="scss">
.wt-page {
  display: flex;
  flex-direction: column;
  gap: clamp(3rem, 6vh, 6rem);
  width: min(120rem, calc(100% - 4rem));
  margin: 0 auto;
  padding-bottom: 6rem;
}

/* The stage holds the compact title and video inside the first viewport. */
.wt-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6rem;
  margin: 0 calc(50% - 50vw);
  padding: 1.6rem 0 0;
}

.wt-stage:fullscreen {
  justify-content: center;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 1.6rem;
  overflow: hidden;
  background: var(--wc-bg);
}

.wt-stage:fullscreen .wt-player {
  width: min(calc(100vw - 3.2rem), calc((100vh - 12rem) * 16 / 9));
}

.wt-stage:fullscreen .wt-standfirst {
  display: none;
}

.wt-heading {
  width: 100%;
  margin: 0;
  padding: 0;
  white-space: nowrap;
  color: var(--wc-white);
  font-size: clamp(2rem, 4vw, 6.4rem);
  font-weight: 800;
  letter-spacing: 0.22em;
  line-height: 1.02;
  text-align: center;
  text-transform: uppercase;

  // The yield is a dissolve, not a cut: the heading is already gone by the
  // time the cut's title card opens. Opacity only — the box stays, so the
  // frame does not jump up the page when the words leave.
  transition: opacity 320ms ease;
}

.wt-player {
  position: relative;

  // The delivered frame. The picture inside it is 2.39:1 and letterboxes
  // itself, exactly as the render does.
  aspect-ratio: 16 / 9;

  // Height-capped so title, frame, and standfirst all clear the fold.
  width: min(100vw, calc((100svh - 16rem) * 16 / 9));
  overflow: hidden;
  background: #000;

  // Every plate below is sized as a fraction of the frame's WIDTH, because
  // that is how the cards are authored: their clamps all resolve to their
  // maximum at 1920px. 1cqw is therefore 1/1920 of the design frame.
  container-type: inline-size;
}

/* The wrapper is the 2.39:1 PICTURE aperture. The iframe inside it is 16:9:
   YouTube puts its title/share/logo chrome into that iframe's letterbox bars,
   which fall outside this clipped aperture. Pointer events stay on our widget,
   so hover can never ask YouTube to paint the chrome again. */
.wt-player-frame {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  overflow: hidden;
  transform: translateY(-50%);
  aspect-ratio: 1920 / 804;

  // YT.Player replaces the host div with the iframe in place. A 16:9 iframe is
  // 134.328% as tall as this 1920:804 aperture; centring clips both bars.
  :deep(iframe) {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 134.328%;
    transform: translateY(-50%);
    pointer-events: none;
  }
}

.wt-opening-black,
.wt-backdrop {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: #000;
}

.wt-backdrop-images,
.wt-backdrop-img {
  position: absolute;
  inset: 0;
}

.wt-backdrop-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wt-standfirst {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 2.4rem;
  align-items: baseline;
  justify-content: center;
  margin: 0;
  text-align: center;
}

.wt-standfirst .wc-label {
  font-size: clamp(1rem, 1.05vw, 1.25rem);
  letter-spacing: 0.34em;
  color: var(--wc-grey);
}

.wt-standfirst-date {
  color: var(--wc-gold);
}

.wt-poster {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  // Playback belongs to the media widget; this layer is only the poster art.
  justify-content: flex-start;
  padding-top: clamp(1.6rem, 7%, 5rem);
  gap: 1.6rem;
  background:
    linear-gradient(rgb(8 9 12 / 72%), rgb(8 9 12 / 88%)),
    var(--wt-hero-background) center 30% / cover no-repeat;
}

.wt-poster-kicker {
  font-size: clamp(0.9rem, 1vw, 1.2rem);
  letter-spacing: 0.4em;
}

.wt-convenience-controls {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  gap: 1.2rem;
  transform: translate(-50%, -50%);
}

.wt-convenience-controls button {
  display: inline-flex;
  gap: 0.8rem;
  align-items: center;
  justify-content: center;
  min-width: 15rem;
  padding: 1.2rem 2rem;
  border: 1px solid var(--wc-gold);
  font-family: var(--wc-font-mono);
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
}

.wt-convenience-fullscreen {
  background: rgb(8 9 12 / 82%);
  color: var(--wc-gold);
}

.wt-convenience-fullscreen:hover,
.wt-convenience-fullscreen:focus-visible {
  background: var(--wc-gold);
  color: var(--wc-bg);
}

.wt-overlays {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

/* ---------------------------------------------------------------------------
   THE LOCKUP.

   Copied back from the card that copied it from this site: destiny-vids'
   cards/maintitle.html took .wolves-intro-overlay-text-slim and the
   wolves-cinematic tokens, and swapped the two lines' treatments at the
   owner's request ("Seven Days to the Wolves is the title of the whole movie
   so it should be featured, the project bluefin should be on top, subtle but
   present").

   THERE IS NO SCRIM. The owner had it removed — "remove the black translucent
   box around the words" — because a panel behind titles over moving picture
   reads as a box, since it is one. The legibility problem is real and is
   solved on the GLYPHS instead: a tight dark core that gives every letterform
   its own edge, then wider soft falloffs that lift local contrast without ever
   resolving into a shape.
--------------------------------------------------------------------------- */
.wt-lockup {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 90%;
  margin: 0 auto;
  font-family: var(--wc-font-display);
  font-weight: 500;
  letter-spacing: 0.03em;
  text-align: center;
  text-shadow:
    0 0 4px rgb(0 0 0 / 95%),
    0 2px 10px rgb(0 0 0 / 90%),
    0 0 28px rgb(0 0 0 / 75%),
    0 0 60px rgb(0 0 0 / 55%);
}

.wt-eyebrow {
  width: 100%;
  font-size: 2.1667cqw;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: #cbd5e1;
  text-transform: uppercase;
  margin-bottom: 1.1667cqw;
}

/* The title is one authored line and must stay one: an inline image is a break
   opportunity, so without this the helm throws "LVES" onto its own line. The
   width is stated rather than left to fit-content, which collapses a flex item
   containing a replaced element to less than the room available. */
.wt-title {
  width: 100%;
  white-space: nowrap;
  font-size: 4.0833cqw;
  font-weight: 900;
  letter-spacing: 0.12em;
  line-height: 1.1;
  color: #fff;
  text-transform: uppercase;
}

.wt-rule {
  width: 34%;
  height: 1px;
  margin-top: 1.8333cqw;
  background: rgb(96 165 250 / 28%);
}

/* The credit slot always occupies its space, so the staged pair cannot shift
   the title when the credits arrive. Visibility, never display. */
.wt-credits {
  width: 100%;
  margin-top: 1.5cqw;
  font-family: var(--wc-font-mono);
  font-size: 1.25cqw;
  letter-spacing: 0.24em;
  color: #cbd5e1;
  visibility: hidden;
}

.wt-credits.is-shown {
  visibility: visible;
}

/* ---------------------------------------------------------------------------
   THE BOOK BOX.

   A card, not a fake piece of printed book type: quiet charcoal, one Bluefin
   edge, and the existing type. Opaque and hard-cut — the book's printed lyric
   stayed legible through a translucent panel, which is a second set of words
   behind ours (destiny-vids #276, #277).
--------------------------------------------------------------------------- */
.wt-book {
  position: absolute;
  transform: translate(-50%, -50%);
  width: max-content;
  max-width: 82cqw;
  padding: 1.125cqw 1.6667cqw;
  background: rgb(4 10 20);
  border-left: 0.2083cqw solid #60a5fa;
  border-radius: 3px;
  box-shadow:
    0 0 4px rgb(0 0 0 / 92%),
    0 0 24px rgb(0 0 0 / 72%);
}

.wt-book-line {
  margin: 0;
  font-family: var(--wc-font-display);
  font-size: 3.1667cqw;
  font-weight: 600;
  line-height: 1.7;
  letter-spacing: 0.05em;
  color: #f4f6f8;
  text-align: center;
  text-shadow:
    0 0 4px rgb(0 0 0 / 95%),
    0 2px 10px rgb(0 0 0 / 90%),
    0 0 28px rgb(0 0 0 / 75%),
    0 0 60px rgb(0 0 0 / 55%);
}

/* ---------------------------------------------------------------------------
   THE DAY CARDS.

   `top: 58%` is measured, not nudged: it lands the type in the shadowed flower
   meadow rather than across March's bright dawn horizon, and no lower, because
   66% put the line across the foreground wolf's head.
--------------------------------------------------------------------------- */
.wt-daycard {
  position: absolute;
  left: 10%;
  top: 58%;
  width: 80%;
  color: #f4f6f8;
  text-align: center;
  font-family: var(--wc-font-display);
  text-shadow:
    0 0 4px rgb(0 0 0 / 95%),
    0 2px 10px rgb(0 0 0 / 90%),
    0 0 28px rgb(0 0 0 / 75%);
}

.wt-daycard-line {
  margin: 0.4583cqw 0;
  color: #fff;
  font-size: 4.3333cqw;
  font-weight: 900;
  letter-spacing: 0.045em;
  line-height: 1.05;
}

/* ---------------------------------------------------------------------------
   THE END CARD POSTER.

   The background does the darkening: the transparent card sits over the March
   night wallpaper. There is no local panel under this text.
--------------------------------------------------------------------------- */
.wt-lockup--poster {
  width: 92%;
}

.wt-poster-event {
  width: 100%;
  white-space: nowrap;
  font-size: 2.0417cqw;
  font-weight: 900;
  letter-spacing: 0.07em;
  line-height: 1.1;
  color: #fff;
  text-transform: uppercase;
}

.wt-poster-venue {
  width: 100%;
  margin-top: 0.6667cqw;
  font-size: 1.25cqw;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: #cbd5e1;
}

.wt-rule--poster {
  width: 42%;
  margin-top: 1.375cqw;
}

.wt-poster-cta {
  width: 100%;
  white-space: nowrap;
  margin-top: 1.875cqw;
  color: #fff;
  font-size: 4.3333cqw;
  font-weight: 900;
  letter-spacing: 0.045em;
  line-height: 1.05;
}

.wt-poster-tags {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75em;
  margin-top: 1.5cqw;
}

.wt-poster-tag {
  color: #cbd5e1;
  font-family: var(--wc-font-mono);
  font-size: 0.9167cqw;
  letter-spacing: 0.12em;
}

/* The CTA's dots take the Bluefin blue at a dot's scale: a near-white core,
   then a tight blue falloff. The event divider gets the wide halo because it
   is a full cap-height landmark; a dot with that reach would be a blob. */
.wt-poster-cta :deep(.wt-accent) {
  text-shadow:
    0 0 2px rgb(196 226 255 / 95%),
    0 0 7px rgb(147 197 253 / 85%),
    0 0 16px rgb(37 99 235 / 45%);
}

.wt-page :deep(.wc-back-catalogue) {
  margin-top: 0;
}

@media (max-width: 640px) {
  .wt-page {
    width: min(100% - 2.4rem, 78rem);
  }

  .wt-heading {
    font-size: 2rem;
    letter-spacing: 0.12em;
  }

  .wt-convenience-controls {
    flex-direction: column;
    gap: 0.8rem;
  }

  .wt-convenience-controls button {
    min-width: 13rem;
    padding: 0.9rem 1.2rem;
    font-size: 1.1rem;
  }

  // The frame is short on a phone; the poster copy stands down while the
  // centered convenience controls remain visible.
  .wt-poster {
    gap: 0.8rem;
  }

  // 0.34em of tracking runs the standfirst off a 390px viewport.
  .wt-standfirst {
    gap: 0.4rem 1.2rem;
  }

  .wt-standfirst .wc-label {
    font-size: 0.95rem;
    letter-spacing: 0.2em;
  }

  .wt-poster-kicker {
    display: none;
  }
}
</style>
