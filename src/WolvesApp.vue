<script setup lang="ts">
import { nextTick, ref } from 'vue'
import CinematicLobby from '@/components/wolves/cinematic/CinematicLobby.vue'
import CinematicStage from '@/components/wolves/cinematic/CinematicStage.vue'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import Nameplate from '@/components/wolves/cinematic/Nameplate.vue'
import WolvesCreatorShortsInterstitial from '@/components/wolves/WolvesCreatorShortsInterstitial.vue'
import WolvesIntroOverlay from '@/components/wolves/WolvesIntroOverlay.vue'
import { buildIntroVideoSequence } from '@/data/wolves-intro-sequence'
import { useCinematicStore } from '@/stores/cinematic'

const store = useCinematicStore()

const stage = ref<InstanceType<typeof CinematicStage> | null>(null)

async function enterCinematic() {
  store.enterCinematic()
  await nextTick() // stage mounts with the new phase before players are created
  await stage.value?.start()
  if (import.meta.env.DEV) {
    // Dev-only hook so browser-based boundary verification can drive the real player
    // by player time (seek) and by segment handoff (skip). Never exposed in
    // production builds — import.meta.env.DEV is false there, so this is tree-shaken.
    ;(window as any).__wolvesCinematic = {
      seekTo: (seconds: number) => stage.value?.seekTo(seconds),
      skip: (delta: number) => stage.value?.skip(delta),
    }
  }
}

const introVideos = buildIntroVideoSequence()
const intro = ref<InstanceType<typeof WolvesIntroOverlay> | null>(null)
const introHasActiveCue = ref(true)

// Factual display metadata for the two intro segments (see wolves-intro-sequence.ts).
const INTRO_DISPLAY: Record<string, { chapter: string, title: string, artist: string, artwork: string }> = {
  'wolves-prologue': {
    chapter: 'PROLOGUE',
    title: 'Gayane Ballet Suite (Adagio)',
    artist: 'Aram Khachaturian',
    artwork: 'https://i.ytimg.com/vi/EB3IokHelRk/hqdefault.jpg',
  },
  'wolves-intro': {
    chapter: 'INTRO',
    title: 'Destiny 2: Into the Light Cinematic',
    artist: 'Bungie',
    artwork: 'https://i.ytimg.com/vi/BKm0TPqeOjY/hqdefault.jpg',
  },
}

function handleIntroStatus(payload: {
  currentTime: number
  duration: number
  paused: boolean
  segmentId: string
  canGoPrevious: boolean
  hasActiveCue: boolean
}) {
  const meta = INTRO_DISPLAY[payload.segmentId]
  if (meta) {
    store.setDisplayOverride({ ...meta, canPrevious: payload.canGoPrevious })
  }
  store.updateTime(payload.currentTime, payload.duration)
  store.setPlaying(!payload.paused)
  introHasActiveCue.value = payload.hasActiveCue
}

async function handleIntroComplete() {
  store.setDisplayOverride(null)
  store.resetClock()
  await enterCinematic()
}

/** Creator Shorts finishes -> resume Part II from the store's current segment. */
async function handleCreatorShortsComplete() {
  store.completeCreatorShorts()
  await nextTick()
  await stage.value?.start()
}

function restart() {
  window.location.reload()
}
</script>

<template>
  <div class="wolves-cinematic">
    <CinematicLobby v-if="store.phase === 'lobby'" @enter="store.enterIntro()" />

    <!--
      The authored intro: the 94s prologue cold open and the guardian trailer,
      rendered by WolvesIntroOverlay exactly as authored in
      src/data/wolves-intro-sequence.ts. Transport lives in the same hero widget
      as the cinematic; the top plate is the universal title placard.
    -->
    <div v-else-if="store.phase === 'intro'" class="wc-runtime">
      <WolvesIntroOverlay
        ref="intro"
        :videos="introVideos"
        @status="handleIntroStatus"
        @complete="handleIntroComplete"
      />
      <div v-if="store.display.chapter !== 'PROLOGUE' || introHasActiveCue" class="wc-intro-nameplate">
        <Nameplate :detail="store.display.chapter" :label="store.display.title" />
      </div>
      <MediaWidget
        @toggle-play="intro?.toggle()"
        @skip="(delta: number) => (delta > 0 ? intro?.next() : intro?.previous())"
        @seek="(ratio: number) => intro?.seekToRatio(ratio)"
      />
    </div>

    <div v-else-if="store.phase === 'creator-shorts'" class="wc-runtime">
      <WolvesCreatorShortsInterstitial @complete="handleCreatorShortsComplete" />
    </div>

    <div v-else-if="store.phase === 'cinematic'" class="wc-runtime">
      <CinematicStage ref="stage" />
      <MediaWidget
        @toggle-play="stage?.togglePlay()"
        @skip="(delta: number) => stage?.skip(delta)"
        @seek="(ratio: number) => stage?.seekToRatio(ratio)"
      />
    </div>

    <div v-else class="wc-finished">
      <Nameplate detail="END OF LINE" label="TRANSMISSION COMPLETE" />
      <button class="wc-control wc-finished-replay" type="button" aria-label="Replay" @click="restart">
        <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wc-runtime {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
}

.wc-finished {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  min-height: 100vh;
  min-height: 100dvh;
}

.wc-finished-replay {
  width: 5.6rem;
  height: 5.6rem;
}

.wc-intro-nameplate {
  // Above the intro overlay's fixed z-index 999 layer.
  position: fixed;
  top: 3rem;
  left: 3rem;
  z-index: 1000;
  max-width: min(72rem, calc(100vw - 6rem));
  pointer-events: none;
}
</style>
