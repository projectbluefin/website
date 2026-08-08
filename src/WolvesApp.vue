<script setup lang="ts">
import type { ExperienceManifest } from '@/config/experience-manifest'
import type { IntroStatusPayload } from '@/data/wolves-intro-sequence'
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import CinematicLobby from '@/components/wolves/cinematic/CinematicLobby.vue'
import CinematicStage from '@/components/wolves/cinematic/CinematicStage.vue'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import Nameplate from '@/components/wolves/cinematic/Nameplate.vue'
import WolvesIntroOverlay from '@/components/wolves/WolvesIntroOverlay.vue'
import { buildDirectorsCutVideoSequence, buildIntroVideoSequence, guardianIntroStartTime, isTextSegment } from '@/data/wolves-intro-sequence'
import { INTRO_SEQUENCE_DURATION, useCinematicStore, WOLVES_EXPERIENCE } from '@/stores/cinematic'

const store = useCinematicStore()

const stage = ref<InstanceType<typeof CinematicStage> | null>(null)
const introHandoff = ref(false)
const introTransparent = ref(false)
const showIntroOverlay = computed(() => store.phase === 'intro' || introHandoff.value)
let handoffToken = 0
let unmounted = false

if (import.meta.env.DEV) {
  // Published from app start (unlike `__wolvesCinematic`, which only exists
  // once the stage has started) so browser harnesses can compute a seek ratio
  // while still inside the intro instead of hard-coding durations.
  //
  // `skipIntro` exists because the media widget's progress bar cannot be used
  // to leave the intro: `handleSegmentSeek` routes a click to
  // `intro.seekToRatio()`, which seeks *within* the intro sequence. Harnesses
  // that clicked the bar at an "overall" ratio were silently stuck in the
  // intro forever.
  ;(window as any).__wolvesDurations = {
    intro: () => INTRO_SEQUENCE_DURATION,
    overall: () => store.overallDuration,
    skipIntro: () => enterCinematic(),
  }
}

async function startCinematicStage() {
  await nextTick()
  await stage.value?.start?.()
  if (unmounted) {
    return
  }
  if (import.meta.env.DEV) {
    // Dev-only hook so browser-based boundary verification can drive the real
    // player. Durations are published here so standalone Playwright harnesses
    // read the live timeline instead of hard-coding constants that silently
    // drift out of date and leave the harness stuck in the intro.
    ;(window as any).__wolvesCinematic = {
      seekTo: (s: number) => stage.value?.seekTo(s),
      introDuration: () => INTRO_SEQUENCE_DURATION,
      overallDuration: () => store.overallDuration,
    }
  }
}

async function enterCinematic() {
  store.enterCinematic()
  await startCinematicStage()
}

/**
 * Launch a back-catalogue experience through the exact same cinematic runtime.
 * Album manifests carry no authored intro, so they enter the cinematic phase
 * directly; everything else (stage, transitions, transport, seek) is shared.
 */
async function launchExperience(manifest: ExperienceManifest) {
  stage.value?.destroy?.()
  clearIntroUi()
  // Preserve the authored intro and Track 0 presentation for the canonical
  // Wolves catalogue card instead of playing its generated fallback manifest.
  if (manifest.id === WOLVES_EXPERIENCE.sourcePlaylistId) {
    store.loadExperience(WOLVES_EXPERIENCE)
    await enterIntro()
    return
  }
  store.loadExperience(manifest)
  await enterCinematic()
}

const isDirectorsCut = ref(false)
const introVideos = computed(() =>
  isDirectorsCut.value ? buildDirectorsCutVideoSequence() : buildIntroVideoSequence()
)
const INTRO_HANDOFF_FADE_MS = 400
const intro = ref<InstanceType<typeof WolvesIntroOverlay> | null>(null)
const introShowVoiceOverToggle = ref(false)
const introVoiceOverEnabled = ref(false)
const introNameplateVisible = ref(true)
const introNameplateGlitch = ref(false)
const introSegmentIndexById = computed(() => new Map(introVideos.value.map((segment, index) => [segment.id, index])))

// Factual display metadata for the authored intro segments (see wolves-intro-sequence.ts).
const INTRO_DISPLAY: Record<string, { chapter: string, title: string, mediaTitle: string, artist: string, artwork: string }> = {
  'wolves-prologue': {
    chapter: 'PROLOGUE',
    title: 'Gayane Ballet Suite (Adagio)',
    mediaTitle: 'PROLOGUE — Gayane Ballet Suite',
    artist: 'Aram Khachaturian',
    artwork: 'https://i.ytimg.com/vi/EB3IokHelRk/hqdefault.jpg',
  },
  'wolves-intro': {
    chapter: 'Meet your Fireteam',
    title: 'a project to bring their stories to life',
    mediaTitle: 'The Wolves are Coming',
    artist: 'Bungie',
    artwork: 'https://i.ytimg.com/vi/BV3BZKbpBns/hqdefault.jpg',
  },
}
const introMediaTitle = ref(INTRO_DISPLAY['wolves-intro'].mediaTitle)

/**
 * Native start time forwarded to the intro overlay when a gallery thumbnail deep-links
 * into a Guardian's section; null for a normal front-door entry.
 */
const introStartAt = ref<number | null>(null)

async function enterIntro(startAtNativeTime: number | null = null, directorsCut = false) {
  isDirectorsCut.value = directorsCut
  const token = ++handoffToken
  introHandoff.value = false
  introStartAt.value = startAtNativeTime
  introTransparent.value = false
  store.enterIntro()
  introMediaTitle.value = INTRO_DISPLAY[directorsCut ? 'wolves-prologue' : 'wolves-intro'].mediaTitle
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

/**
 * Gallery thumbnail deep link: start the intro at the Guardian's own nameplate cue.
 * Guardians without a section in the intro fall back to the normal opening.
 */
async function watchGuardian(name: string) {
  await enterIntro(guardianIntroStartTime(name))
}

function normalizeIntroStatus(payload: IntroStatusPayload) {
  const segmentIndex = introSegmentIndexById.value.get(payload.segmentId) ?? 0
  const segment = introVideos.value[segmentIndex]
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
      chapter: payload.nameplateDetail ?? meta.chapter,
      title: payload.nameplateTitle ?? meta.title,
      canPrevious: payload.canGoPrevious,
    })
  }
  introNameplateVisible.value = true
  introNameplateGlitch.value = payload.nameplateGlitch ?? false
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
  introNameplateGlitch.value = false
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
  // Dissolve handoff: the overlay's black background and remaining chrome fade
  // out over the already-playing Track 0 stage, then the overlay unmounts.
  // Duration must match the transition in .wolves-intro-overlay--transparent-handoff.
  introTransparent.value = true
  await new Promise(resolve => window.setTimeout(resolve, INTRO_HANDOFF_FADE_MS))
  if (!unmounted && token === handoffToken) {
    introHandoff.value = false
  }
}

async function restoreIntroForNavigation(): Promise<number | null> {
  const token = ++handoffToken
  if (store.phase === 'intro') {
    return token
  }

  stage.value?.destroy?.()
  introHandoff.value = false
  introTransparent.value = false
  // Back-navigation into the intro is a fresh front-door entry, not a deep link.
  introStartAt.value = null
  await nextTick()
  if (unmounted || token !== handoffToken) {
    return null
  }
  const meta = INTRO_DISPLAY['wolves-intro']
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

async function handleSegmentSeek(ratio: number) {
  if (showIntroOverlay.value) {
    intro.value?.seekToRatio(ratio)
    return
  }
  if (store.phase === 'cinematic') {
    stage.value?.seekToRatio(ratio)
  }
}

onBeforeUnmount(() => {
  unmounted = true
  handoffToken += 1
})
</script>

<template>
  <div class="wolves-cinematic">
    <CinematicLobby
      v-if="store.phase === 'lobby'"
      @enter="enterIntro(null, false)"
      @enter-directors-cut="enterIntro(null, true)"
      @launch-experience="launchExperience"
      @watch-guardian="watchGuardian"
    />

    <!-- The Destiny intro shares the cinematic transport and universal top title placard. -->
    <div v-else-if="store.phase === 'intro' || store.phase === 'cinematic'" class="wc-runtime">
      <CinematicStage ref="stage" />

      <template v-if="showIntroOverlay">
        <WolvesIntroOverlay
          ref="intro"
          hold-for-handoff
          :transparent-handoff="introTransparent"
          :videos="introVideos"
          :start-at-native-time="introStartAt ?? undefined"
          @status="handleIntroStatus"
          @complete="handleIntroComplete"
        />
        <div v-if="introNameplateVisible" class="wc-intro-nameplate">
          <Nameplate :detail="store.display.chapter" :label="store.display.title" :glitch="introNameplateGlitch" />
        </div>
        <MediaWidget
          :title="introMediaTitle"
          auto-hide
          :show-voice-over-toggle="introShowVoiceOverToggle"
          :voice-over-enabled="introVoiceOverEnabled"
          voice-over-label="Ikora voice over"
          @toggle-play="intro?.toggle()"
          @toggle-voice-over="(enabled: boolean) => intro?.setVoiceOverEnabled(enabled)"
          @skip="handleIntroSkip"
          @seek="handleSegmentSeek"
        />
      </template>

      <MediaWidget
        v-else
        auto-hide
        @toggle-play="stage?.togglePlay()"
        @skip="(delta: number) => stage?.skip(delta)"
        @seek="handleSegmentSeek"
      />
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
  width: calc(100vw - 6rem);
  pointer-events: none;
}

@media (max-width: 640px) {
  // Keep the mobile intro focused on the transport and the footage. The
  // desktop plates, captions, and title cards do not fit the narrow viewport.
  .wc-intro-nameplate {
    display: none;
  }
}
</style>
