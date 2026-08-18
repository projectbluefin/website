<script setup lang="ts">
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import type { ExperienceManifest } from '@/config/experience-manifest'
import type { TrailerPlate } from '@/data/wolves-trailer-plates'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import WolvesBackCatalogue from '@/components/wolves/WolvesBackCatalogue.vue'
import WolvesTrailerLine from '@/components/wolves/WolvesTrailerLine.vue'
import { getChromeFreeYoutubePlayerVars, getYoutubePlayerConstructor, loadYoutubeIframeApi } from '@/composables/useYoutubeIframeApi'
import {
  activeTrailerPlates,
  TRAILER_BRIDGE_MONTH,
  TRAILER_CREDIT_JOIN_SECONDS,
  TRAILER_CREDIT_LINE,
  TRAILER_DURATION_SECONDS,
  TRAILER_TITLE_LABEL,
  TRAILER_TITLE_LINE,
  TRAILER_VIDEO_ID,
  trailerBridgeState,
  trailerPlateOpacity,
  trailerSegmentAt,
} from '@/data/wolves-trailer-plates'

const base = import.meta.env.BASE_URL
const heroBackground = `${base}img/wallpapers/wolves/people/Always There.webp`
const dayWallpaper = `${base}img/wallpapers/bluefin-${TRAILER_BRIDGE_MONTH}-day.webp`
const nightWallpaper = `${base}img/wallpapers/bluefin-${TRAILER_BRIDGE_MONTH}-night.webp`

const playerHost = ref<HTMLElement | null>(null)
let player: YoutubePlayer | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

type TrailerPhase = 'idle' | 'playing' | 'ended'
const trailerPhase = ref<TrailerPhase>('idle')
const now = ref(0)

const visiblePlates = computed(() => activeTrailerPlates(now.value))
const plateById = computed(() => new Map(visiblePlates.value.map(plate => [plate.id, plate])))

function plate(id: string): TrailerPlate | undefined {
  return plateById.value.get(id)
}

/** A plate's authored fade, so nothing hard-cuts that should not. */
function opacityOf(id: string): number {
  const found = plate(id)
  return found ? trailerPlateOpacity(found, now.value) : 0
}

const creditVisible = computed(() => now.value >= TRAILER_CREDIT_JOIN_SECONDS)

// The cut leaves the music video at 88.2 s and never returns to it: the day
// cards and the end card play over the March Bluefin wallpaper at full frame.
const segment = computed(() => trailerSegmentAt(now.value))
const bridge = computed(() => trailerBridgeState(now.value))

// Both book plates are boxes on the same page; each carries its own anchor,
// which the delivered cut walks with the camera.
const bookPlates = computed(() => visiblePlates.value.filter(p => p.kind === 'bookline'))
const dayCards = computed(() => visiblePlates.value.filter(p => p.kind === 'daycard'))

/** Seat a plate by its anchor in the 1920x1080 authoring frame. */
function anchorStyle(anchored: TrailerPlate) {
  const [x, y] = anchored.anchor ?? [960, 540]
  return { left: `${(x / 1920) * 100}%`, top: `${(y / 1080) * 100}%` }
}

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
  // Hold the end card on the exact 1:50.020 mark instead of letting the
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
  window.location.assign(`${base}wolves/experience/?album=${encodeURIComponent(manifest.id)}`)
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
  stopClock()
  player?.destroy?.()
  player = null
})
</script>

<template>
  <div class="wt-page" :style="{ '--wt-hero-background': `url('${heroBackground}')` }">
    <!-- Keep the film title above the trailer without restoring the old
         full-height hero that pushed the video below the fold. -->
    <section class="wt-stage" aria-label="Official teaser trailer">
      <h1 class="wt-heading">
        Seven Days to the Wolves
      </h1>
      <div class="wt-player wc-plate" data-wolves-trailer>
        <!-- The delivered frame is 16:9 with the 2.39:1 picture letterboxed
             inside it, so the embed is given a 16:9 box and YouTube pillars
             the source itself. Every card coordinate then maps 1:1. -->
        <div class="wt-player-frame">
          <div ref="playerHost" class="wt-player-host" />
        </div>

        <!-- Segments two and three: the March wallpaper, day falling into
             night, covering the picture for the last 21.8 s. -->
        <div
          v-if="segment !== 'picture'"
          class="wt-backdrop"
          :style="{ opacity: segment === 'bridge' ? bridge.opacity : 1 }"
          aria-hidden="true"
        >
          <img class="wt-backdrop-img" :src="dayWallpaper" alt="">
          <img
            class="wt-backdrop-img"
            :src="nightWallpaper"
            alt=""
            :style="{ opacity: segment === 'bridge' ? bridge.nightMix : 1 }"
          >
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
            :style="{ opacity: trailerPlateOpacity(card, now) }"
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

      <p class="wt-standfirst">
        <span class="wc-label">SEVEN PARTS · ONE COMMUNITY · ONE DESTINY</span>
        <span class="wc-label wt-standfirst-date">2 NOVEMBER 2026</span>
      </p>
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

/* The iframe is the PICTURE, not the frame: 2.39:1, centred, so the black
   bars above and below it are ours and are actually black. Given a 16:9 box
   YouTube letterboxes the source itself and then fills those bars with its own
   title bar and logo, which the delivered cut does not have. */
.wt-player-frame {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  aspect-ratio: 1920 / 804;

  // YT.Player replaces the host div with its iframe in place, so the sizing
  // rule must target the iframe itself, not a wrapper around it.
  :deep(iframe) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
}

.wt-backdrop {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: #000;
}

.wt-backdrop-img {
  position: absolute;
  inset: 0;
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

.wt-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 4;
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

  .wt-heading {
    font-size: 2rem;
    letter-spacing: 0.12em;
  }

  .wt-play {
    width: calc(100% - 3rem);
    max-width: 34rem;
    justify-content: center;
    padding-inline: 1.8rem;
  }

  // The frame is short on a phone; the kicker/title stack does not fit, so the
  // poster collapses to the play button alone.
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

  .wt-poster-kicker,
  .wt-poster-title {
    display: none;
  }
}
</style>
