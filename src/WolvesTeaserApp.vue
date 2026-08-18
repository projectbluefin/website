<script setup lang="ts">
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import type { ExperienceManifest } from '@/config/experience-manifest'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import WolvesBackCatalogue from '@/components/wolves/WolvesBackCatalogue.vue'
import { getChromeFreeYoutubePlayerVars, getYoutubePlayerConstructor, loadYoutubeIframeApi } from '@/composables/useYoutubeIframeApi'
import {
  activeTrailerPlates,
  TRAILER_CREDIT_JOIN_SECONDS,
  TRAILER_CREDIT_LINE,
  TRAILER_DURATION_SECONDS,
  TRAILER_TITLE_ACCENT,
  TRAILER_TITLE_LABEL,
  TRAILER_TITLE_LINE,
  TRAILER_VIDEO_ID,
} from '@/data/wolves-trailer-plates'

const heroBackground = `${import.meta.env.BASE_URL}img/wallpapers/wolves/people/Always There.webp`

const playerHost = ref<HTMLElement | null>(null)
let player: YoutubePlayer | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

type TrailerPhase = 'idle' | 'playing' | 'ended'
const trailerPhase = ref<TrailerPhase>('idle')
const now = ref(0)

const visiblePlates = computed(() => activeTrailerPlates(now.value))
const plateById = computed(() => new Map(visiblePlates.value.map(plate => [plate.id, plate])))
const creditVisible = computed(() => plateById.value.has('maintitle') && now.value >= TRAILER_CREDIT_JOIN_SECONDS)
// The eyebrow's accented word is the one coloured letter of the Bluefin mark.
const eyebrowLead = TRAILER_TITLE_LABEL.replace(TRAILER_TITLE_ACCENT, '')

function stopClock() {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

function tick() {
  const t = player?.getCurrentTime?.()
  if (typeof t !== 'number') {
    return
  }
  // Hold the end card on the exact 1:50.000 mark instead of letting the
  // video roll past the cut's authored end into the prologue's next beat.
  if (t >= TRAILER_DURATION_SECONDS) {
    now.value = TRAILER_DURATION_SECONDS
    player?.pauseVideo?.()
    trailerPhase.value = 'ended'
    stopClock()
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
  player?.playVideo?.()
  startClock()
}

function replayTrailer() {
  now.value = 0
  trailerPhase.value = 'playing'
  player?.seekTo?.(0, true)
  player?.playVideo?.()
  startClock()
}

function openExperience(manifest: ExperienceManifest) {
  // Albums play through the full cinematic runtime, which lives at the
  // experience route; the teaser hands off with a deep link.
  window.location.assign(`${import.meta.env.BASE_URL}wolves/experience/?album=${encodeURIComponent(manifest.id)}`)
}

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
    })
    if (import.meta.env.DEV) {
      // Same contract as the main app's __wolvesCinematic: a harness hook so
      // browser verification can jump the trailer clock instead of watching
      // 110 seconds of footage on every run.
      ;(window as any).__wolvesTeaser = {
        seekTo: (s: number) => {
          player?.seekTo?.(s, true)
          now.value = s
        },
        now: () => now.value,
      }
    }
  }
  catch {
    // The page still works as a teaser without the embed; the plates and
    // albums render regardless.
  }
})

onBeforeUnmount(() => {
  stopClock()
  player?.destroy?.()
  player = null
})
</script>

<template>
  <div class="wt-page" :style="{ '--wt-hero-background': `url('${heroBackground}')` }">
    <section class="wt-hero">
      <p class="wc-label wt-hero-brand">
        PROJECT BLUEFIN PRESENTS
      </p>
      <h1 class="wt-hero-title">
        SEVEN DAYS<br>TO THE WOLVES
      </h1>
      <div class="wc-hairline" />
      <p class="wt-hero-sub">
        SEVEN PARTS · ONE COMMUNITY · ONE DESTINY
      </p>
      <p class="wt-hero-date wc-label">
        2 NOVEMBER 2026
      </p>
    </section>

    <section class="wt-trailer" aria-label="Official teaser trailer">
      <p class="wc-label wt-section-heading">
        OFFICIAL TEASER
      </p>
      <div class="wt-player wc-plate" data-wolves-trailer>
        <div class="wt-player-frame">
          <div ref="playerHost" class="wt-player-host" />
        </div>

        <div v-if="trailerPhase === 'idle'" class="wt-poster">
          <span class="wc-label wt-poster-kicker">TRAILER 1</span>
          <span class="wt-poster-title">SEVEN DAYS TO THE WOLVES</span>
          <button class="wt-play wc-cta--primary" type="button" @click="playTrailer">
            <span class="wc-cta-icon" aria-hidden="true">▶</span>
            Watch the Teaser
          </button>
        </div>

        <div class="wt-overlays" aria-hidden="true">
          <Transition name="wt-fade">
            <div v-if="plateById.has('maintitle')" class="wt-plate wt-plate--title">
              <span class="wt-plate-eyebrow">
                {{ eyebrowLead }}<span class="wt-plate-accent">{{ TRAILER_TITLE_ACCENT }}</span>
              </span>
              <span class="wt-plate-title">{{ TRAILER_TITLE_LINE }}</span>
              <span v-if="creditVisible" class="wt-plate-credit">{{ TRAILER_CREDIT_LINE }}</span>
            </div>
          </Transition>

          <Transition name="wt-fade">
            <div v-if="plateById.has('book-a')" class="wt-plate wt-plate--book wc-plate">
              <p v-for="line in plateById.get('book-a')?.lines ?? []" :key="line">
                {{ line }}
              </p>
            </div>
          </Transition>

          <Transition name="wt-fade">
            <div v-if="plateById.has('daycard-extinction')" class="wt-plate wt-plate--daycard">
              Extinction is the Rule
            </div>
          </Transition>
          <Transition name="wt-fade">
            <div v-if="plateById.has('daycard-survival')" class="wt-plate wt-plate--daycard">
              Survival is the Exception
            </div>
          </Transition>

          <Transition name="wt-fade">
            <div v-if="plateById.has('endcard-event')" class="wt-plate wt-plate--endcard">
              <span class="wt-plate-endcard-title">{{ plateById.get('endcard-event')?.title }}</span>
              <span v-for="line in plateById.get('endcard-event')?.lines ?? []" :key="line" class="wt-plate-endcard-line">
                {{ line }}
              </span>
            </div>
          </Transition>
        </div>

        <button
          v-if="trailerPhase === 'ended'"
          class="wt-play wt-play--replay wc-cta--primary"
          type="button"
          @click="replayTrailer"
        >
          <span class="wc-cta-icon" aria-hidden="true">↺</span>
          Watch Again
        </button>
      </div>
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

.wt-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(1.6rem, 2.4vh, 2.6rem);
  margin: 0 calc(50% - 50vw);
  padding: clamp(6rem, 14vh, 12rem) 2rem;
  text-align: center;
  background:
    linear-gradient(rgb(8 9 12 / 78%), rgb(8 9 12 / 92%)),
    var(--wt-hero-background) center 30% / cover no-repeat;
}

.wt-hero-brand {
  font-size: clamp(1rem, 0.9vw, 1.35rem);
  letter-spacing: 0.44em;
}

.wt-hero-title {
  font-size: clamp(3.6rem, 6vw, 6.4rem);
  font-weight: 800;
  letter-spacing: 0.22em;
  margin-right: -0.22em;
  line-height: 1.02;
  color: var(--wc-white);
}

.wt-hero-sub {
  font-family: var(--wc-font-mono);
  font-size: clamp(1.2rem, 1.35vw, 1.6rem);
  letter-spacing: 0.34em;
  color: var(--wc-grey);
}

.wt-hero-date {
  font-size: clamp(1.05rem, 1.05vw, 1.25rem);
}

.wt-trailer {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}

.wt-section-heading {
  font-size: clamp(1.3rem, 1.3vw, 1.6rem);
  letter-spacing: 0.4em;
  text-align: center;
}

.wt-player {
  // The trailer's picture is the 3840x1608 Perfume Of The Timeless frame.
  position: relative;
  aspect-ratio: 1920 / 804;
  overflow: hidden;
  background: #000;
}

.wt-player-frame {
  position: absolute;
  inset: 0;

  // YT.Player replaces the host div with its iframe in place, so the sizing
  // rule must target the iframe itself, not a wrapper around it.
  :deep(iframe) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
}

.wt-poster {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  // The play button is absolutely centred on the frame; the title stack keeps
  // to the upper third so the two never share the same space.
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

.wt-poster-title {
  font-family: var(--wc-font-weyland);
  font-size: clamp(1.6rem, 3vw, 3.2rem);
  letter-spacing: 0.2em;
  color: var(--wc-white);
  text-align: center;
}

.wt-overlays {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.wt-plate {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.wt-plate--title {
  inset: 0;
  justify-content: center;
  gap: 1.2rem;
}

.wt-plate-eyebrow {
  font-family: var(--wc-font-mono);
  font-size: clamp(1rem, 1.6vw, 1.8rem);
  letter-spacing: 0.44em;
  color: var(--wc-white);
}

.wt-plate-accent {
  color: #4285f4;
}

.wt-plate-title {
  font-family: var(--wc-font-weyland);
  font-size: clamp(2.2rem, 4.6vw, 5rem);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--wc-white);
  text-shadow: 0 2px 24px rgb(0 0 0 / 80%);
}

.wt-plate-credit {
  font-family: var(--wc-font-mono);
  font-size: clamp(0.9rem, 1.2vw, 1.4rem);
  letter-spacing: 0.2em;
  color: var(--wc-grey);
}

.wt-plate--book {
  // The anchor (1030,443 of the 1920x804 frame) is measured in the destiny-vids
  // manifest; nudged up from 55% so the box fully covers the book's printed
  // words, which is the entire reason the card exists.
  top: 50%;
  left: 53.6%;
  transform: translate(-50%, -50%) rotate(-4deg);
  gap: 0.4rem;
  min-width: 34%;
  padding: 1.6rem 2.4rem;
  background: rgb(8 9 12 / 92%);

  p {
    margin: 0;
    font-family: var(--wc-font-weyland-mono);
    font-size: clamp(1.2rem, 2vw, 2.2rem);
    letter-spacing: 0.08em;
    color: var(--wc-white);
    white-space: nowrap;
  }
}

.wt-plate--daycard {
  inset: 0;
  justify-content: center;
  font-family: var(--wc-font-weyland);
  font-size: clamp(2.4rem, 5vw, 5.6rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--wc-white);
  background: rgb(8 9 12 / 55%);
  text-shadow: 0 2px 24px rgb(0 0 0 / 80%);
}

.wt-plate--endcard {
  inset: 0;
  justify-content: center;
  gap: 1rem;
  background: rgb(8 9 12 / 72%);
}

.wt-plate-endcard-title {
  font-family: var(--wc-font-weyland);
  font-size: clamp(1.8rem, 3.4vw, 3.6rem);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--wc-gold);
}

.wt-plate-endcard-line {
  font-family: var(--wc-font-mono);
  font-size: clamp(1rem, 1.4vw, 1.6rem);
  letter-spacing: 0.18em;
  color: var(--wc-white);
}

.wt-fade-enter-active,
.wt-fade-leave-active {
  transition: opacity 0.5s ease;
}

.wt-fade-enter-from,
.wt-fade-leave-to {
  opacity: 0;
}

.wt-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  padding: 1.4rem 4.8rem;
  border: 1px solid var(--wc-gold);
  font-size: clamp(1.5rem, 1.45vw, 1.8rem);
  font-weight: 700;
  letter-spacing: 0.3em;
  background: var(--wc-gold);
  color: var(--wc-bg);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover,
  &:focus-visible {
    background: var(--wc-bg);
    color: var(--wc-gold);
  }
}

.wt-play .wc-cta-icon {
  display: inline-grid;
  width: 1.55em;
  aspect-ratio: 1;
  place-items: center;
  background: var(--wc-bg);
  color: var(--wc-gold);
  font-size: 0.8em;
  line-height: 1;
}

.wt-play:hover .wc-cta-icon,
.wt-play:focus-visible .wc-cta-icon {
  background: var(--wc-gold);
  color: var(--wc-bg);
}

.wt-page :deep(.wc-back-catalogue) {
  margin-top: 0;
}

@media (max-width: 640px) {
  .wt-page {
    width: min(100% - 2.4rem, 78rem);
  }

  .wt-hero {
    padding: 4rem 1.4rem;
  }

  .wt-hero-brand {
    letter-spacing: 0.34em;
  }

  .wt-hero-title {
    font-size: clamp(3.2rem, 11vw, 4.8rem);
    letter-spacing: 0.18em;
    margin-right: -0.18em;
  }

  .wt-play {
    width: calc(100% - 3rem);
    max-width: 34rem;
    justify-content: center;
    padding-inline: 1.8rem;
  }

  .wt-plate--book p {
    white-space: normal;
  }

  // The 2.39:1 frame is only ~160px tall on a phone; the kicker/title/button
  // stack does not fit, so the poster collapses to the play button alone.
  .wt-poster {
    gap: 0.8rem;
  }

  .wt-poster-kicker,
  .wt-poster-title {
    display: none;
  }
}
</style>
