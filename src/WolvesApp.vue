<script setup lang="ts">
import type { IntroStatusPayload } from '@/data/wolves-intro-sequence'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import CinematicLobby from '@/components/wolves/cinematic/CinematicLobby.vue'
import CinematicStage from '@/components/wolves/cinematic/CinematicStage.vue'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import Nameplate from '@/components/wolves/cinematic/Nameplate.vue'
import WolvesCreatorShortsInterstitial from '@/components/wolves/WolvesCreatorShortsInterstitial.vue'
import WolvesIntroOverlay from '@/components/wolves/WolvesIntroOverlay.vue'
import { buildIntroVideoSequence, isTextSegment } from '@/data/wolves-intro-sequence'
import { resolveOverallRatioTarget, useCinematicStore } from '@/stores/cinematic'

const store = useCinematicStore()

const stage = ref<InstanceType<typeof CinematicStage> | null>(null)
const introHandoff = ref(false)
const introTransparent = ref(false)
const showIntroOverlay = computed(() => store.phase === 'intro' || introHandoff.value)
let handoffToken = 0
let unmounted = false

async function startCinematicStage() {
  await nextTick()
  await stage.value?.start?.()
  if (unmounted) {
    return
  }
  if (import.meta.env.DEV) {
    // Dev-only hook so browser-based boundary verification can drive the real player.
    ;(window as any).__wolvesCinematic = { seekTo: (s: number) => stage.value?.seekTo(s) }
  }
}

async function enterCinematic() {
  store.enterCinematic()
  await startCinematicStage()
}

const introVideos = buildIntroVideoSequence()
const intro = ref<InstanceType<typeof WolvesIntroOverlay> | null>(null)
const introShowVoiceOverToggle = ref(false)
const introVoiceOverEnabled = ref(false)
const introShowCaptionToggle = ref(false)
const introCaptionsEnabled = ref(false)
// Ordinary wolves-prologue status has no cue-level nameplateTitle: hide the top-left
// nameplate entirely rather than showing a default plate. The authored 50s cue still
// publishes its title via nameplateTitle, which shows the existing PROLOGUE plate.
const introNameplateVisible = ref(true)
const introSegmentIndexById = new Map(introVideos.map((segment, index) => [segment.id, index]))

// Factual display metadata for the authored intro segments (see wolves-intro-sequence.ts).
const INTRO_DISPLAY: Record<string, { chapter: string, title: string, mediaTitle: string, artist: string, artwork: string }> = {
  'wolves-prologue': {
    chapter: 'PROLOGUE',
    title: 'Gayane Ballet Suite (Adagio)',
    mediaTitle: 'Gayane Ballet Suite (Adagio)',
    artist: 'Aram Khachaturian',
    artwork: 'https://i.ytimg.com/vi/EB3IokHelRk/hqdefault.jpg',
  },
  'wolves-intro': {
    chapter: 'Meet your Fireteam',
    title: 'Fighting for something greater than ourselves.',
    mediaTitle: 'Destiny 2: Into the Light Cinematic',
    artist: 'Bungie',
    artwork: 'https://i.ytimg.com/vi/BV3BZKbpBns/hqdefault.jpg',
  },
}
const introMediaTitle = ref(INTRO_DISPLAY['wolves-prologue'].mediaTitle)

async function enterIntro() {
  const token = ++handoffToken
  introHandoff.value = false
  introTransparent.value = false
  store.enterIntro()
  introMediaTitle.value = INTRO_DISPLAY['wolves-prologue'].mediaTitle
  introShowCaptionToggle.value = false
  introCaptionsEnabled.value = false
  await nextTick()
  if (unmounted || token !== handoffToken || store.phase !== 'intro') {
    return
  }
  try {
    await stage.value?.prepare?.()
  }
  catch {
    // `start()` retries the shared loader at the handoff; prewarming must not block the intro.
  }
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
    introMediaTitle.value = payload.mediaTitle ?? meta.mediaTitle
    store.setDisplayOverride({
      ...meta,
      title: payload.nameplateTitle ?? meta.title,
      canPrevious: payload.canGoPrevious,
    })
  }
  introNameplateVisible.value = payload.segmentId !== 'wolves-prologue' || Boolean(payload.nameplateTitle)
  introShowVoiceOverToggle.value = payload.showVoiceOverToggle ?? false
  introVoiceOverEnabled.value = payload.voiceOverEnabled ?? false
  introShowCaptionToggle.value = payload.showCaptionToggle ?? false
  introCaptionsEnabled.value = payload.captionsEnabled ?? false
  store.syncIntroStatus(normalizeIntroStatus(payload))
  store.setPlaying(!payload.paused)
}

function clearIntroUi() {
  store.setDisplayOverride(null)
  introShowVoiceOverToggle.value = false
  introVoiceOverEnabled.value = false
  introShowCaptionToggle.value = false
  introCaptionsEnabled.value = false
  introNameplateVisible.value = true
}

async function handleIntroComplete() {
  const token = ++handoffToken
  introHandoff.value = true
  introTransparent.value = false
  clearIntroUi()
  store.enterCinematic()
  await startCinematicStage()
  if (unmounted || token !== handoffToken) {
    return
  }
  const releaseIntroOwnership = async () => {
    introTransparent.value = true
    await nextTick()
    if (!unmounted && token === handoffToken) {
      introHandoff.value = false
    }
  }
  const viewTransitionDocument = document as Document & {
    startViewTransition?: (callback: () => Promise<void>) => { updateCallbackDone: Promise<void> }
  }
  if (typeof viewTransitionDocument.startViewTransition === 'function') {
    const transition = viewTransitionDocument.startViewTransition(releaseIntroOwnership)
    await transition.updateCallbackDone.catch(() => {})
    return
  }
  await releaseIntroOwnership()
}

/** Creator Shorts finishes -> resume the preloaded next cinematic segment. */
async function handleCreatorShortsComplete() {
  store.completeCreatorShorts()
  await startCinematicStage()
}

async function restoreIntroForNavigation(): Promise<number | null> {
  const token = ++handoffToken
  if (store.phase === 'intro') {
    return token
  }

  stage.value?.destroy?.()
  introHandoff.value = false
  introTransparent.value = false
  await nextTick()
  if (unmounted || token !== handoffToken) {
    return null
  }
  const meta = INTRO_DISPLAY['wolves-prologue']
  store.setDisplayOverride({
    ...meta,
    canPrevious: false,
  })
  store.enterIntro()
  await nextTick()
  if (unmounted || token !== handoffToken) {
    return null
  }
  try {
    await stage.value?.prepare?.()
  }
  catch {
    return null
  }
  return token
}

async function handleIntroSkip(delta: number) {
  const token = await restoreIntroForNavigation()
  if (token === null || unmounted || token !== handoffToken) {
    return
  }

  if (delta > 0) {
    intro.value?.next()
    return
  }
  intro.value?.previous()
}

async function seekIntroTarget(ratio: number) {
  const token = await restoreIntroForNavigation()
  if (token === null) {
    return
  }
  if (unmounted || token !== handoffToken) {
    return
  }
  const target = resolveOverallRatioTarget(ratio)
  if (target.phase !== 'intro' || !intro.value) {
    return
  }

  for (let index = store.segmentIndex; index < target.segmentIndex; index++) {
    intro.value.next()
    await nextTick()
    if (unmounted || token !== handoffToken) {
      return
    }
  }

  for (let index = store.segmentIndex; index > target.segmentIndex; index--) {
    intro.value.previous()
    await nextTick()
    if (unmounted || token !== handoffToken) {
      return
    }
  }

  await waitForIntroTarget(target.segmentIndex, target.segmentDuration)
  if (unmounted || token !== handoffToken) {
    return
  }
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

onBeforeUnmount(() => {
  unmounted = true
  handoffToken += 1
})
</script>

<template>
  <div class="wolves-cinematic">
    <CinematicLobby v-if="store.phase === 'lobby'" @enter="enterIntro" />

    <!--
      The authored intro: locked 94s Gayane prologue, then the guardian trailer. Transport
      lives in the same hero widget as the cinematic; the top plate is the universal
      title placard.
    -->
    <div v-else-if="store.phase === 'intro' || store.phase === 'cinematic'" class="wc-runtime">
      <CinematicStage ref="stage" />

      <template v-if="showIntroOverlay">
        <WolvesIntroOverlay
          ref="intro"
          hold-for-handoff
          :transparent-handoff="introTransparent"
          :videos="introVideos"
          @status="handleIntroStatus"
          @complete="handleIntroComplete"
        />
        <div v-if="introNameplateVisible" class="wc-intro-nameplate">
          <Nameplate :detail="store.display.chapter" :label="store.display.title" />
        </div>
        <MediaWidget
          :title="introMediaTitle"
          :show-voice-over-toggle="introShowVoiceOverToggle"
          :voice-over-enabled="introVoiceOverEnabled"
          voice-over-label="Ikora voice over"
          :show-caption-toggle="introShowCaptionToggle"
          :captions-enabled="introCaptionsEnabled"
          caption-label="CC"
          @toggle-play="intro?.toggle()"
          @toggle-voice-over="(enabled: boolean) => intro?.setVoiceOverEnabled(enabled)"
          @toggle-captions="(enabled: boolean) => intro?.setCaptionsEnabled(enabled)"
          @skip="handleIntroSkip"
          @seek="handleOverallSeek"
        />
      </template>

      <MediaWidget
        v-else
        @toggle-play="stage?.togglePlay()"
        @skip="(delta: number) => stage?.skip(delta)"
        @seek="handleOverallSeek"
      />
    </div>

    <div v-else-if="store.phase === 'creator-shorts'" class="wc-runtime">
      <WolvesCreatorShortsInterstitial @complete="handleCreatorShortsComplete" />
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
