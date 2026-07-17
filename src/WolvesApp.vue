<script setup lang="ts">
import type { IntroStatusPayload } from '@/data/wolves-intro-sequence'
import { nextTick, ref, watch } from 'vue'
import CinematicLobby from '@/components/wolves/cinematic/CinematicLobby.vue'
import CinematicStage from '@/components/wolves/cinematic/CinematicStage.vue'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import Nameplate from '@/components/wolves/cinematic/Nameplate.vue'
import WolvesIntroOverlay from '@/components/wolves/WolvesIntroOverlay.vue'
import { buildIntroVideoSequence, isTextSegment } from '@/data/wolves-intro-sequence'
import { resolveOverallRatioTarget, useCinematicStore } from '@/stores/cinematic'

const store = useCinematicStore()

const stage = ref<InstanceType<typeof CinematicStage> | null>(null)

async function enterCinematic() {
  store.enterCinematic()
  await nextTick() // stage mounts with the new phase before players are created
  await stage.value?.start?.()
  if (import.meta.env.DEV) {
    // Dev-only hook so browser-based boundary verification can drive the real player.
    ;(window as any).__wolvesCinematic = { seekTo: (s: number) => stage.value?.seekTo(s) }
  }
}

const introVideos = buildIntroVideoSequence()
const intro = ref<InstanceType<typeof WolvesIntroOverlay> | null>(null)
const introShowVoiceOverToggle = ref(false)
const introVoiceOverEnabled = ref(false)
// Ordinary wolves-prologue status has no cue-level nameplateTitle: hide the top-left
// nameplate entirely rather than showing a default plate. The authored 50s cue still
// publishes its title via nameplateTitle, which shows the existing PROLOGUE plate.
const introNameplateVisible = ref(true)
const introSegmentIndexById = new Map(introVideos.map((segment, index) => [segment.id, index]))

// Factual display metadata for the authored intro segments (see wolves-intro-sequence.ts).
const INTRO_DISPLAY: Record<string, { chapter: string, title: string, artist: string, artwork: string }> = {
  'wolves-prologue': {
    chapter: 'PROLOGUE',
    title: 'Gayane Ballet Suite (Adagio)',
    artist: 'Aram Khachaturian',
    artwork: 'https://i.ytimg.com/vi/EB3IokHelRk/hqdefault.jpg',
  },
  'wolves-intro': {
    chapter: 'UNIVERSAL BLUE BRIEFING',
    title: 'Destiny 2: Into the Light Cinematic',
    artist: 'Bungie',
    artwork: 'https://i.ytimg.com/vi/BV3BZKbpBns/hqdefault.jpg',
  },
}

function normalizeIntroStatus(payload: IntroStatusPayload) {
  const segmentIndex = introSegmentIndexById.get(payload.segmentId) ?? 0
  const segment = introVideos[segmentIndex]
  if (!segment) {
    return {
      segmentIndex: 0,
      segmentElapsed: payload.currentTime,
      segmentDuration: payload.duration,
      nativeTime: payload.currentTime,
    }
  }

  if (isTextSegment(segment)) {
    return {
      segmentIndex,
      segmentElapsed: Math.min(Math.max(payload.currentTime, 0), segment.duration),
      segmentDuration: segment.duration,
      nativeTime: Math.max(payload.currentTime, 0),
    }
  }

  const nativeStart = segment.startOffset ?? 0
  const segmentDuration = Math.max(0, payload.duration - nativeStart)
  return {
    segmentIndex,
    segmentElapsed: Math.min(Math.max(payload.currentTime - nativeStart, 0), segmentDuration),
    segmentDuration,
    nativeTime: Math.max(payload.currentTime, nativeStart),
  }
}

function handleIntroStatus(payload: IntroStatusPayload) {
  const meta = INTRO_DISPLAY[payload.segmentId]
  if (meta) {
    store.setDisplayOverride({
      ...meta,
      title: payload.nameplateTitle ?? meta.title,
      canPrevious: payload.canGoPrevious,
    })
  }
  introNameplateVisible.value = payload.segmentId !== 'wolves-prologue' || Boolean(payload.nameplateTitle)
  introShowVoiceOverToggle.value = payload.showVoiceOverToggle ?? false
  introVoiceOverEnabled.value = payload.voiceOverEnabled ?? false
  store.syncIntroStatus(normalizeIntroStatus(payload))
  store.setPlaying(!payload.paused)
}

function clearIntroUi() {
  store.setDisplayOverride(null)
  introShowVoiceOverToggle.value = false
  introVoiceOverEnabled.value = false
  introNameplateVisible.value = true
}

async function handleIntroComplete() {
  clearIntroUi()
  await enterCinematic()
}

async function seekIntroTarget(ratio: number) {
  if (store.phase !== 'intro') {
    const meta = INTRO_DISPLAY['wolves-prologue']
    store.setDisplayOverride({
      ...meta,
      canPrevious: false,
    })
    store.enterIntro()
    await nextTick()
  }

  const target = resolveOverallRatioTarget(ratio)
  if (target.phase !== 'intro' || !intro.value) {
    return
  }

  for (let index = store.segmentIndex; index < target.segmentIndex; index++) {
    intro.value.next()
    await nextTick()
  }

  for (let index = store.segmentIndex; index > target.segmentIndex; index--) {
    intro.value.previous()
    await nextTick()
  }

  await waitForIntroTarget(target.segmentIndex, target.segmentDuration)
  intro.value.seekToRatio(target.seekRatio)
}

function waitForCinematicTarget(segmentIndex: number) {
  return new Promise<void>((resolve, reject) => {
    if (store.phase === 'cinematic' && store.segmentIndex === segmentIndex && !store.crossfading) {
      resolve()
      return
    }

    let stop: () => void = () => {}
    const timeout = window.setTimeout(() => {
      stop()
      reject(new Error(`Timed out waiting for cinematic segment ${segmentIndex}`))
    }, 8000)

    stop = watch(
      () => [store.phase, store.segmentIndex, store.crossfading] as const,
      ([phase, currentIndex, crossfading]) => {
        if (phase === 'cinematic' && currentIndex === segmentIndex && !crossfading) {
          window.clearTimeout(timeout)
          stop()
          resolve()
        }
      },
    )
  })
}

function waitForIntroTarget(segmentIndex: number, segmentDuration: number) {
  return new Promise<void>((resolve, reject) => {
    if (store.phase === 'intro'
      && store.segmentIndex === segmentIndex
      && store.segmentDuration >= Math.max(0, segmentDuration - 0.01)) {
      resolve()
      return
    }

    let stop: () => void = () => {}
    const timeout = window.setTimeout(() => {
      stop()
      reject(new Error(`Timed out waiting for intro segment ${segmentIndex}`))
    }, 8000)

    stop = watch(
      () => [store.phase, store.segmentIndex, store.segmentDuration] as const,
      ([phase, currentIndex, duration]) => {
        if (phase === 'intro'
          && currentIndex === segmentIndex
          && duration >= Math.max(0, segmentDuration - 0.01)) {
          window.clearTimeout(timeout)
          stop()
          resolve()
        }
      },
    )
  })
}

async function seekCinematicTarget(ratio: number) {
  const target = resolveOverallRatioTarget(ratio)
  if (target.phase !== 'cinematic') {
    return
  }

  clearIntroUi()

  if (store.phase !== 'cinematic') {
    await enterCinematic()
  }

  if (!stage.value) {
    return
  }

  const delta = target.segmentIndex - store.segmentIndex
  if (delta !== 0) {
    stage.value.skip(delta)
    await waitForCinematicTarget(target.segmentIndex)
  }

  stage.value.seekToRatio(target.seekRatio)
}

async function handleOverallSeek(ratio: number) {
  const target = resolveOverallRatioTarget(ratio)
  if (target.phase === 'intro') {
    await seekIntroTarget(ratio)
    return
  }
  await seekCinematicTarget(ratio)
}

function restart() {
  window.location.reload()
}
</script>

<template>
  <div class="wolves-cinematic">
    <CinematicLobby v-if="store.phase === 'lobby'" @enter="store.enterIntro()" />

    <!--
      The authored intro: locked 94s Gayane prologue, then the guardian trailer. Transport
      lives in the same hero widget as the cinematic; the top plate is the universal
      title placard.
    -->
    <div v-else-if="store.phase === 'intro'" class="wc-runtime">
      <WolvesIntroOverlay
        ref="intro"
        :videos="introVideos"
        @status="handleIntroStatus"
        @complete="handleIntroComplete"
      />
      <div v-if="introNameplateVisible" class="wc-intro-nameplate">
        <Nameplate :detail="store.display.chapter" :label="store.display.title" />
      </div>
      <MediaWidget
        :show-voice-over-toggle="introShowVoiceOverToggle"
        :voice-over-enabled="introVoiceOverEnabled"
        voice-over-label="Ikora voice over"
        @toggle-play="intro?.toggle()"
        @toggle-voice-over="(enabled: boolean) => intro?.setVoiceOverEnabled(enabled)"
        @skip="(delta: number) => (delta > 0 ? intro?.next() : intro?.previous())"
        @seek="handleOverallSeek"
      />
    </div>

    <div v-else-if="store.phase === 'cinematic'" class="wc-runtime">
      <CinematicStage ref="stage" />
      <MediaWidget
        @toggle-play="stage?.togglePlay()"
        @skip="(delta: number) => stage?.skip(delta)"
        @seek="handleOverallSeek"
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
