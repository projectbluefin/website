<script setup lang="ts">
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import type { IntroOverlayTextCue, IntroStatusPayload, IntroVideoSpec } from '@/data/wolves-intro-sequence'
import { computed, nextTick, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import qrMakeMeAComic from '@/assets/svg/qr-makemeacomic.svg'
import { getYoutubePlayerConstructor, getYoutubePlayerState, loadYoutubeIframeApi } from '@/composables/useYoutubeIframeApi'
import { getActiveComicHeroShot } from '@/data/wolves-comic-hero-shots'
import { dinosaurSpecies } from '@/data/wolves-dinosaur-species'
import { wolvesGuardianDinosaurBonds } from '@/data/wolves-guardian-dinosaur-bonds'
import {
  activeOverlayCue,
  activeOverlayCues,
  advanceIntroSequence,
  buildOverlayTextParts,
  createIntroSequenceState,
  isTextSegment,
  isTextSegmentComplete,
  isVideoSegment,
  previousIntroSequence,
  PROLOGUE_SCENE_CROSSFADE_SECONDS,
  PROLOGUE_TEXT_FADE_SECONDS,
  skipIntroSequence,
} from '@/data/wolves-intro-sequence'

const props = defineProps<{
  videos: readonly IntroVideoSpec[]
}>()

const emit = defineEmits<{
  (e: 'complete'): void
  (e: 'status', payload: IntroStatusPayload): void
}>()

const baseUrl = import.meta.env.BASE_URL
const comicHeroQrUrl = 'https://makemeacomic.com'
const comicHeroQrDomain = 'makemeacomic.com'
const comicHeroQrDialogue = 'Immortalize a Maintainer'

const sequenceState = ref(createIntroSequenceState())
const currentTime = ref(0)
const isPaused = ref(false)
const destinyVoiceOverEnabled = ref(false)
/** The active segment's known duration, driving the hero widget's progress readout. */
const activeSegmentDuration = ref(0)
const mountHost = ref<HTMLDivElement | null>(null)
const audioMountHost = ref<HTMLDivElement | null>(null)

/**
 * Real (or authored) duration of every segment in the sequence, used to drive the permanent
 * progress bar across the whole intro rather than just the currently-playing segment. Text
 * segments' durations are known upfront; a video segment's entry stays 0 until its player
 * reports a real duration (or its `maxDuration` cutoff) in `onReady`.
 */
const segmentDurations = ref<number[]>(props.videos.map(video => (isTextSegment(video) ? video.duration : 0)))

const currentSegment = computed<IntroVideoSpec | undefined>(() => props.videos[sequenceState.value.index])
const canGoToPrevious = computed(() => sequenceState.value.index > 0)

const activeCue = computed<IntroOverlayTextCue | undefined>(() => activeOverlayCue(currentSegment.value?.overlays, currentTime.value))
const burnedInCaptionCues = computed<readonly IntroOverlayTextCue[] | undefined>(() => {
  if (!currentSegment.value || !isVideoSegment(currentSegment.value)) {
    return undefined
  }
  return currentSegment.value.burnedInCaptions
})
const canToggleDestinyVoiceOver = computed(() =>
  currentSegment.value?.id === 'wolves-intro'
  && isVideoSegment(currentSegment.value)
  && Boolean(currentSegment.value.alternateYoutubeVideoId),
)
const activeComicTitleCardCue = computed<IntroOverlayTextCue | undefined>(() => {
  const cues = burnedInCaptionCues.value ?? currentSegment.value?.overlays
  if (!cues) {
    return undefined
  }
  return cues.find((cue: IntroOverlayTextCue) => cue.comicHeroTitleCard && currentTime.value >= cue.start && currentTime.value < cue.end)
})
const activeComicHeroShot = computed(() => activeComicTitleCardCue.value
  ? getActiveComicHeroShot(currentTime.value, activeComicTitleCardCue.value)
  : undefined)
const overlayCueForDisplay = computed<IntroOverlayTextCue | undefined>(() => activeComicTitleCardCue.value?.comicHeroTitleCard ? activeComicTitleCardCue.value : activeCue.value)
const overlayText = computed(() => overlayCueForDisplay.value?.text)
const activeBurnedInCaptions = computed<readonly IntroOverlayTextCue[]>(() =>
  activeOverlayCues(burnedInCaptionCues.value, currentTime.value)
    .filter(cue => !cue.comicHeroTitleCard),
)
/**
 * All cues active right now, not just the first match — the Guardian trailer intentionally
 * overlaps Christoph Blecker's and Natali Vlatko's windows since they share the same shot, so
 * both callouts need to render side-by-side via their `position` anchor.
 */
const activeCues = computed<readonly IntroOverlayTextCue[]>(() => activeOverlayCues(currentSegment.value?.overlays, currentTime.value))
const activeGuardianCues = computed<readonly IntroOverlayTextCue[]>(() => activeComicTitleCardCue.value ? [] : activeCues.value)

/**
 * Splits a Guardian cue's authored "Class — Name — Title" string into its own dossier-style
 * fields for the nerd-plate callout. A cue with more than three ` — `-separated segments (e.g.
 * Christoph Blecker's "Strand Warlock — Christoph Blecker — First Among Equals — The North
 * Star") joins everything after the name back into a single title line rather than dropping it.
 */
function parseGuardianCue(text: string): { guardianClass: string, name: string, title: string } | undefined {
  const parts = text.split(' — ')
  if (parts.length < 3) {
    return undefined
  }
  const [guardianClass, name, ...titleParts] = parts
  return { guardianClass, name, title: titleParts.join(' — ') }
}

/**
 * Splits a title line into plain/"bling" segments around one exact substring (`cue.blingTitle`),
 * so the template can wrap just that piece in a shimmering gold span instead of the whole title.
 * Falls back to a single plain segment if `blingTitle` is unset or isn't found verbatim.
 */
function titleSegments(title: string, blingTitle: string | undefined): { text: string, bling: boolean }[] {
  if (!blingTitle) {
    return [{ text: title, bling: false }]
  }
  const index = title.indexOf(blingTitle)
  if (index === -1) {
    return [{ text: title, bling: false }]
  }
  const before = title.slice(0, index)
  const after = title.slice(index + blingTitle.length)
  return [
    ...(before ? [{ text: before, bling: false }] : []),
    { text: blingTitle, bling: true },
    ...(after ? [{ text: after, bling: false }] : []),
  ]
}

type TitleToken = { kind: 'text', text: string, bling: boolean } | { kind: 'sep' }

/**
 * Flattens a multi-segment title (authored with ` — ` joins, see `parseGuardianCue`) into a
 * render-ready token stream: text segments plus explicit `sep` tokens where the author's em-dash
 * joins used to sit. The template renders `sep` tokens as a blue vertical bar
 * (`wolves-guardian-plate-title-sep`) instead of the literal em-dash characters, per explicit
 * user request, so multi-title guardians read as distinct badges divided by a UI rule rather
 * than punctuation. `blingTitle` matching still runs per segment via `titleSegments`.
 */
function titleTokens(title: string, blingTitle: string | undefined): TitleToken[] {
  const parts = title.split(' — ')
  const tokens: TitleToken[] = []
  parts.forEach((part, index) => {
    if (index > 0) {
      tokens.push({ kind: 'sep' })
    }
    for (const segment of titleSegments(part, blingTitle)) {
      tokens.push({ kind: 'text', text: segment.text, bling: segment.bling })
    }
  })
  return tokens
}

function guardianDinosaurProfile(guardianName: string): { artworkSource: string, label: string, scientificName: string } | undefined {
  const bond = wolvesGuardianDinosaurBonds.find(entry => entry.guardianName === guardianName)
  const species = bond && dinosaurSpecies.find(entry => entry.id === bond.dinosaurSpeciesId)
  if (!species) {
    return undefined
  }
  return {
    artworkSource: `${baseUrl}${species.artwork.slice(2)}`,
    label: species.scientificName.split(' ')[0]?.toUpperCase() ?? species.scientificName.toUpperCase(),
    scientificName: species.scientificName,
  }
}

/**
 * The Prologue/Epilogue's somber, BPM-paced fade only applies to text-card segments; the
 * trailer's Guardian overlays stay snappy since they're synced to fast-moving footage.
 */
const isSomberTextSegment = computed(() => currentSegment.value?.kind === 'text')
/**
 * The somber fade is capped to a fraction of the active cue's own on-screen window so a short
 * cue (e.g. the Epilogue's 3s closing line) still fully fades in with time to read, rather than
 * always using the full BPM-derived duration regardless of how briefly the cue is shown.
 */
const somberFadeDuration = computed(() => {
  if (!activeCue.value) {
    return PROLOGUE_TEXT_FADE_SECONDS
  }
  const cueWindow = activeCue.value.end - activeCue.value.start
  return Math.min(PROLOGUE_TEXT_FADE_SECONDS, cueWindow * 0.85)
})

/**
 * A `backgroundCrossfade` cue can list one or more day/night stages; multi-stage cues split
 * their duration evenly and cycle through each stage in turn as `currentTime` advances. This
 * picks the active stage plus its own start/duration so each stage gets an independent,
 * freshly-keyed crossfade animation.
 */
const activeCrossfadeStage = computed(() => {
  const cue = activeCue.value
  const stages = cue?.backgroundCrossfade
  if (!cue || !stages || stages.length === 0) {
    return undefined
  }
  const cueDuration = cue.end - cue.start
  const stageDuration = cueDuration / stages.length
  const elapsed = currentTime.value - cue.start
  const index = Math.min(stages.length - 1, Math.max(0, Math.floor(elapsed / stageDuration)))
  const stageStart = cue.start + index * stageDuration
  return { crossfade: stages[index], index, start: stageStart, duration: stageDuration }
})

/**
 * A stable identity for whatever is currently occupying the background layer (a static image,
 * a crossfade stage, or nothing/black) so the outer `<Transition>` in the template can tell
 * when the *scene itself* changes (a new stage, or moving into/out of a wallpaper-lit cue)
 * versus when it's merely re-rendering the same scene. Changing this key is what triggers the
 * cross-dissolve between one scene and the next.
 */
const activeSceneKey = computed(() => {
  if (activeCue.value?.backgroundImage) {
    return `image:${activeCue.value.backgroundImage}`
  }
  if (activeCrossfadeStage.value) {
    return `stage:${activeCrossfadeStage.value.start}`
  }
  return 'blank'
})

/** Splits text into single-character parts so every literal B/F can be highlighted without v-html. */
/**
 * Punctuation is stripped from displayed intro text only (authored data keeps
 * it): periods and commas read as clutter at theater scale, per owner request.
 */
function stripIntroPunctuation(text: string): string {
  return text.replace(/[.,]/g, '')
}

function formatIntroCueText(text: string, preservePunctuation?: boolean): string {
  return preservePunctuation ? text : stripIntroPunctuation(text)
}

function activeVideoId(segment: Extract<IntroVideoSpec, { kind: 'video' }>): string {
  return destinyVoiceOverEnabled.value && segment.alternateYoutubeVideoId
    ? segment.alternateYoutubeVideoId
    : segment.youtubeVideoId
}

function activeVideoCutoffDuration(segment: Extract<IntroVideoSpec, { kind: 'video' }>): number | undefined {
  return destinyVoiceOverEnabled.value
    ? (segment.alternateMaxDuration ?? segment.maxDuration)
    : segment.maxDuration
}

function clampVideoSourceTime(segment: Extract<IntroVideoSpec, { kind: 'video' }>, time: number): number {
  const cutoff = activeVideoCutoffDuration(segment)
  return cutoff == null ? time : Math.min(time, cutoff)
}

const overlayTextParts = computed(() => {
  const cue = overlayCueForDisplay.value
  const text = formatIntroCueText(overlayText.value ?? '', cue?.preservePunctuation)
  const explicitHighlights = cue?.highlightSubstrings
    ?? (cue?.highlightSubstring ? [cue.highlightSubstring] : undefined)
  return buildOverlayTextParts(
    text,
    explicitHighlights?.map(highlight => formatIntroCueText(highlight, cue?.preservePunctuation)),
  )
})

let player: YoutubePlayer | null = null
let audioPlayer: YoutubePlayer | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let textTimer: ReturnType<typeof setInterval> | null = null
let loadToken = 0
let pendingPausedSourceSwitchTime: number | null = null

/** Seek within the active segment by 0..1 ratio, driven by the hero widget's progress bar. */
function seekToSeconds(targetSeconds: number) {
  const clamped = Math.min(Math.max(targetSeconds, 0), activeSegmentDuration.value)
  currentTime.value = clamped
  if (currentSegment.value?.kind === 'video') {
    player?.seekTo?.(clamped, true)
  }
  else {
    // Text segments follow the background audio's clock, so the audio must move too.
    audioPlayer?.seekTo?.(clamped, true)
  }
}

function seekToNativeSeconds(targetSeconds: number) {
  const clamped = Math.max(targetSeconds, 0)
  currentTime.value = clamped
  if (currentSegment.value?.kind === 'video') {
    player?.seekTo?.(clamped, true)
  }
  else {
    audioPlayer?.seekTo?.(clamped, true)
  }
}

function seekToRatio(ratio: number) {
  if (activeSegmentDuration.value <= 0) {
    return
  }
  seekToSeconds(Math.min(Math.max(ratio, 0), 1) * activeSegmentDuration.value)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function stopTextTimer() {
  if (textTimer) {
    clearInterval(textTimer)
    textTimer = null
  }
}

function destroyPlayer() {
  stopPolling()
  pendingPausedSourceSwitchTime = null
  player?.destroy?.()
  player = null
}

function destroyAudioPlayer() {
  audioPlayer?.destroy?.()
  audioPlayer = null
}

function advance() {
  sequenceState.value = advanceIntroSequence(sequenceState.value, props.videos.length)
}

async function loadAudioTrack(youtubeVideoId: string | undefined) {
  destroyAudioPlayer()
  if (!youtubeVideoId) {
    return
  }

  try {
    await loadYoutubeIframeApi()
  }
  catch {
    return
  }

  await nextTick()

  const PlayerCtor = getYoutubePlayerConstructor()
  if (!PlayerCtor || !audioMountHost.value) {
    return
  }

  audioMountHost.value.replaceChildren()
  const mountNode = document.createElement('div')
  audioMountHost.value.appendChild(mountNode)

  audioPlayer = new PlayerCtor(mountNode, {
    width: '1',
    height: '1',
    videoId: youtubeVideoId,
    playerVars: {
      autoplay: 1,
      controls: 0,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
    },
    events: {},
  })
}

function startTextSegment(segment: Extract<IntroVideoSpec, { kind: 'text' }>) {
  stopTextTimer()
  currentTime.value = 0
  activeSegmentDuration.value = segment.duration
  void loadAudioTrack(segment.audioYoutubeVideoId)

  textTimer = setInterval(() => {
    if (isPaused.value) {
      return
    }
    // Ad resilience: when a background audio embed exists, cues key off the
    // audio's real getCurrentTime(). Pre-roll ads hold it at 0 and mid-roll ads
    // freeze it, so the cold open waits for the music instead of desyncing.
    // Without an audio embed there is nothing to sync to, so wall-clock ticks.
    if (audioPlayer && typeof audioPlayer.getCurrentTime === 'function') {
      currentTime.value = audioPlayer.getCurrentTime() ?? 0
    }
    else {
      currentTime.value += 0.2
    }
    // Authored musical fade: ramp the audio down across the excerpt's final
    // seconds so it ends on the phrase's own decay instead of a hard cut. The
    // window is recomputed every tick, so seeking back out of it restores full
    // volume instead of leaving the music stuck quiet (the "glitched fade").
    if (segment.audioFadeOutSeconds && audioPlayer?.setVolume) {
      const remaining = segment.duration - currentTime.value
      if (remaining <= segment.audioFadeOutSeconds) {
        const ratio = Math.max(0, remaining / segment.audioFadeOutSeconds)
        audioPlayer.setVolume(Math.round(ratio * 100))
      }
      else {
        audioPlayer.setVolume(100)
      }
    }
    if (isTextSegmentComplete(segment, currentTime.value)) {
      advance()
    }
  }, 100)
}

async function loadVideoSegment(segment: Extract<IntroVideoSpec, { kind: 'video' }> | undefined) {
  const token = ++loadToken
  currentTime.value = 0
  destroyPlayer()

  if (!segment) {
    // Nothing left to play (e.g. an empty sequence) — never block the live experience.
    sequenceState.value = skipIntroSequence(sequenceState.value)
    return
  }

  try {
    await loadYoutubeIframeApi()
  }
  catch {
    if (token === loadToken) {
      advance()
    }
    return
  }

  // Component may have advanced/unmounted while the API script was loading.
  if (token !== loadToken || sequenceState.value.done) {
    return
  }

  await nextTick()

  // Re-check after the second await — Skip (or a fresh advance) may have landed while
  // waiting for the DOM flush above.
  if (token !== loadToken || sequenceState.value.done) {
    return
  }

  const PlayerCtor = getYoutubePlayerConstructor()
  if (!PlayerCtor || !mountHost.value) {
    advance()
    return
  }

  mountHost.value.replaceChildren()
  const mountNode = document.createElement('div')
  mountHost.value.appendChild(mountNode)

  const playerVars = {
    autoplay: 1,
    controls: 0,
    playsinline: 1,
    rel: 0,
    modestbranding: 1,
    // Keep YouTube's own captions off so the burned-in subtitles remain the only overlay.
    cc_load_policy: 0,
    ...(segment.startOffset ? { start: Math.round(segment.startOffset) } : {}),
  }

  player = new PlayerCtor(mountNode, {
    width: '100%',
    height: '100%',
    videoId: activeVideoId(segment),
    playerVars,
    events: {
      onReady: () => {
        activeSegmentDuration.value = activeVideoCutoffDuration(segment) ?? player?.getDuration?.() ?? 0
        segmentDurations.value[sequenceState.value.index] = activeSegmentDuration.value
        stopPolling()
        pollTimer = setInterval(() => {
          currentTime.value = player?.getCurrentTime?.() ?? 0
          if (activeVideoCutoffDuration(segment) != null && currentTime.value >= activeSegmentDuration.value && !isPaused.value) {
            advance()
          }
        }, 200)
      },
      onStateChange: (event: { data: number }) => {
        if (event.data === getYoutubePlayerState().PLAYING) {
          isPaused.value = false
          if (pendingPausedSourceSwitchTime != null) {
            const pausedTime = pendingPausedSourceSwitchTime
            pendingPausedSourceSwitchTime = null
            currentTime.value = pausedTime
            player?.seekTo?.(pausedTime, true)
            player?.pauseVideo?.()
            return
          }
        }
        if (event.data === getYoutubePlayerState().PAUSED || event.data === getYoutubePlayerState().CUED) {
          isPaused.value = true
        }
        if (event.data === getYoutubePlayerState().ENDED) {
          advance()
        }
      },
      onError: () => {
        // A missing/restricted video must never block the live experience.
        advance()
      },
    },
  })
}

function loadCurrentSegment(segment: IntroVideoSpec | undefined) {
  loadToken += 1
  isPaused.value = false
  if (segment?.id !== 'wolves-intro') {
    destinyVoiceOverEnabled.value = false
  }
  destroyPlayer()
  stopTextTimer()
  destroyAudioPlayer()

  if (!segment) {
    sequenceState.value = skipIntroSequence(sequenceState.value)
    return
  }

  if (isTextSegment(segment)) {
    startTextSegment(segment)
    return
  }

  if (isVideoSegment(segment)) {
    void loadVideoSegment(segment)
  }
}

watch(() => sequenceState.value.done, (done) => {
  if (done) {
    destroyPlayer()
    stopTextTimer()
    destroyAudioPlayer()
    emit('complete')
  }
})

watch(currentSegment, (segment) => {
  loadCurrentSegment(segment)
}, { immediate: true })

function handleNext() {
  sequenceState.value = advanceIntroSequence(sequenceState.value, props.videos.length)
}

function handlePrevious() {
  sequenceState.value = previousIntroSequence(sequenceState.value)
}

function setVoiceOverEnabled(enabled: boolean) {
  const segment = currentSegment.value
  if (!segment || !isVideoSegment(segment) || !canToggleDestinyVoiceOver.value) {
    return
  }
  if (destinyVoiceOverEnabled.value === enabled) {
    return
  }

  destinyVoiceOverEnabled.value = enabled

  if (!player?.loadVideoById) {
    return
  }

  const shouldPause = isPaused.value
  const preservedTime = clampVideoSourceTime(segment, player.getCurrentTime?.() ?? currentTime.value)
  currentTime.value = preservedTime
  activeSegmentDuration.value = activeVideoCutoffDuration(segment) ?? player.getDuration?.() ?? activeSegmentDuration.value
  segmentDurations.value[sequenceState.value.index] = activeSegmentDuration.value
  pendingPausedSourceSwitchTime = shouldPause ? preservedTime : null

  player.loadVideoById({
    videoId: activeVideoId(segment),
    startSeconds: preservedTime,
  })
}

function handleTogglePlayback() {
  const isVideoPlayback = Boolean(currentSegment.value && isVideoSegment(currentSegment.value))
  const activePlayer = isVideoPlayback ? player : audioPlayer
  const nextPaused = !isPaused.value
  if (isPaused.value) {
    activePlayer?.playVideo?.()
  }
  else {
    activePlayer?.pauseVideo?.()
  }
  if (!isVideoPlayback) {
    isPaused.value = nextPaused
  }
}

onBeforeUnmount(() => {
  destroyPlayer()
  stopTextTimer()
  destroyAudioPlayer()
  if (import.meta.env.DEV) {
    delete (window as any).__wolvesIntro
  }
})

// Publishes playback state so the app-level Destiny hero widget (the single
// transport surface) can render intro progress without owning any player.
watchEffect(() => {
  emit('status', {
    currentTime: currentTime.value,
    duration: activeSegmentDuration.value,
    paused: isPaused.value,
    segmentId: currentSegment.value?.id ?? '',
    canGoPrevious: canGoToPrevious.value,
    nameplateTitle: activeCue.value?.nameplateTitle,
    showVoiceOverToggle: canToggleDestinyVoiceOver.value,
    voiceOverEnabled: canToggleDestinyVoiceOver.value ? destinyVoiceOverEnabled.value : false,
  })
})

watchEffect(() => {
  if (!import.meta.env.DEV) {
    return
  }
  ;(window as any).__wolvesIntro = {
    seekTo: (seconds: number) => seekToSeconds(seconds),
    seekToNativeTime: (seconds: number) => seekToNativeSeconds(seconds),
    getCurrentTime: () => currentTime.value,
    getDuration: () => activeSegmentDuration.value,
    getPlayerDuration: () => player?.getDuration?.() ?? 0,
    getVideoId: () => (currentSegment.value && isVideoSegment(currentSegment.value) ? activeVideoId(currentSegment.value) : ''),
    isPaused: () => isPaused.value,
    setVoiceOverEnabled,
  }
})

defineExpose({
  next: handleNext,
  previous: handlePrevious,
  setVoiceOverEnabled,
  toggle: handleTogglePlayback,
  seekToRatio,
})
</script>

<template>
  <div v-if="currentSegment && !sequenceState.done" class="wolves-intro-overlay">
    <div v-if="currentSegment.kind === 'video'" ref="mountHost" class="wolves-intro-overlay-player" />
    <div
      v-if="currentSegment.kind === 'video'"
      class="wolves-intro-overlay-top-left-mask"
      aria-hidden="true"
    />
    <div
      v-if="currentSegment.kind === 'video'"
      class="wolves-intro-overlay-pause-veil"
      :class="{ 'wolves-intro-overlay-pause-veil-active': isPaused }"
      aria-hidden="true"
    />

    <template v-else>
      <div class="wolves-intro-overlay-blackscreen">
        <Transition name="wolves-scene-crossfade">
          <div
            :key="activeSceneKey"
            class="wolves-intro-overlay-scene"
            :style="{ transitionDuration: `${PROLOGUE_SCENE_CROSSFADE_SECONDS}s` }"
          >
            <img
              v-if="activeCue?.backgroundImage"
              class="wolves-intro-overlay-background"
              :class="{ 'wolves-intro-overlay-background-kenburns': activeCue.backgroundMotion === 'kenburns' }"
              :style="activeCue.backgroundMotion === 'kenburns' ? { animationDuration: `${activeCue.end - activeCue.start}s` } : undefined"
              :src="`${baseUrl}${activeCue.backgroundImage}`"
              alt=""
            >
            <template v-else-if="activeCrossfadeStage">
              <img
                class="wolves-intro-overlay-background wolves-intro-overlay-background-day"
                :style="{ animationDuration: `${activeCrossfadeStage.duration}s` }"
                :src="`${baseUrl}${activeCrossfadeStage.crossfade.day}`"
                alt=""
              >
              <img
                class="wolves-intro-overlay-background wolves-intro-overlay-background-night"
                :style="{ animationDuration: `${activeCrossfadeStage.duration}s` }"
                :src="`${baseUrl}${activeCrossfadeStage.crossfade.night}`"
                alt=""
              >
              <div
                v-if="activeCue?.calamity"
                class="wolves-intro-overlay-calamity-vignette"
                :style="{ animationDuration: `${activeCrossfadeStage.duration}s` }"
              />
            </template>
          </div>
        </Transition>
      </div>
      <div ref="audioMountHost" class="wolves-intro-overlay-audio-mount" />
    </template>

    <template v-if="!isSomberTextSegment">
      <div v-if="activeComicTitleCardCue" class="wolves-intro-overlay-title-card">
        <div class="wolves-intro-overlay-title-card-layout">
          <div class="wolves-intro-overlay-title-card-main">
            <p class="wolves-intro-overlay-title-card-line">
              {{ activeComicTitleCardCue.text }}
            </p>
            <img
              v-if="activeComicHeroShot"
              :src="`${baseUrl}${activeComicHeroShot.src}`"
              :alt="activeComicHeroShot.label"
              :data-comic-hero-shot="activeComicHeroShot.id"
              class="wolves-intro-overlay-title-card-art"
            >
            <p
              class="wolves-intro-overlay-title-card-line wolves-intro-overlay-title-card-line-small"
              data-comic-hero-paid-artists
            >
              Made by Paid Artists
            </p>
          </div>

          <a
            :href="comicHeroQrUrl"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open makemeacomic.com"
            class="wolves-intro-overlay-title-card-qr"
            data-comic-hero-qr-link
          >
            <div class="wolves-intro-overlay-title-card-qr-frame" data-comic-hero-qr-card>
              <img
                :src="qrMakeMeAComic"
                alt="QR code linking to makemeacomic.com"
                class="wolves-intro-overlay-title-card-qr-image"
                data-comic-hero-qr-image
              >
            </div>
            <span
              class="wolves-intro-overlay-title-card-qr-dialogue"
              data-comic-hero-qr-dialogue
            >
              {{ comicHeroQrDialogue }}
            </span>
            <span class="wolves-intro-overlay-title-card-qr-domain" data-comic-hero-qr-domain>
              {{ comicHeroQrDomain }}
            </span>
          </a>
        </div>
      </div>
      <div v-if="activeBurnedInCaptions.length" class="wolves-intro-overlay-burned-captions">
        <div v-for="cue in activeBurnedInCaptions" :key="`${cue.start}-${cue.end}-${cue.text}`" class="wolves-intro-overlay-burned-caption">
          {{ formatIntroCueText(cue.text, cue.preservePunctuation) }}
        </div>
      </div>

      <div
        v-for="cue in activeGuardianCues"
        :key="cue.text"
        class="wolves-guardian-plate font-mono"
        :class="{
          'wolves-guardian-plate-left': cue.position === 'left',
          'wolves-guardian-plate-right': cue.position === 'right',
          'wolves-guardian-plate-raised': cue.raised,
          'wolves-guardian-plate-leader': cue.leader,
        }"
      >
        <template v-if="parseGuardianCue(cue.text)">
          <div class="wolves-guardian-plate-burst" aria-hidden="true" />
          <div class="wolves-guardian-plate-header">
            <div class="wolves-guardian-plate-horizon wolves-guardian-plate-horizon-left" aria-hidden="true" />
            <svg class="wolves-guardian-plate-crest" viewBox="0 0 100 100" aria-hidden="true">
              <polygon points="50,5 85,20 95,55 50,95 5,55 15,20" class="wolves-guardian-plate-crest-outer" />
              <polygon points="50,12 78,25 87,52 50,85 13,52 22,25" class="wolves-guardian-plate-crest-inner" />
              <path d="M35,45 L50,60 L65,45" class="wolves-guardian-plate-crest-chevron" />
            </svg>
            <div class="wolves-guardian-plate-horizon wolves-guardian-plate-horizon-right" aria-hidden="true" />
          </div>
          <p class="wolves-guardian-plate-label">
            MAINTAINER // GUARDIAN
          </p>
          <p class="wolves-guardian-plate-class">
            {{ parseGuardianCue(cue.text)!.guardianClass }}
          </p>
          <div
            class="wolves-guardian-plate-body"
            :class="{ 'wolves-guardian-plate-body-paired': guardianDinosaurProfile(parseGuardianCue(cue.text)!.name) }"
          >
            <div class="wolves-guardian-plate-identity">
              <p class="wolves-guardian-plate-name">
                {{ parseGuardianCue(cue.text)!.name }}
              </p>
              <p class="wolves-guardian-plate-title">
                <template v-for="(token, index) in titleTokens(parseGuardianCue(cue.text)!.title, cue.blingTitle)" :key="index">
                  <span v-if="token.kind === 'sep'" class="wolves-guardian-plate-title-sep" aria-hidden="true">|</span>
                  <span v-else-if="token.bling" class="wolves-guardian-plate-bling">{{ token.text }}</span>
                  <template v-else>
                    {{ token.text }}
                  </template>
                </template>
              </p>
            </div>
            <div
              v-if="guardianDinosaurProfile(parseGuardianCue(cue.text)!.name)"
              class="wolves-guardian-plate-dinosaur"
            >
              <img
                :src="guardianDinosaurProfile(parseGuardianCue(cue.text)!.name)!.artworkSource"
                :alt="guardianDinosaurProfile(parseGuardianCue(cue.text)!.name)!.scientificName"
                class="wolves-guardian-plate-dinosaur-art"
              >
              <div class="wolves-guardian-plate-dinosaur-copy">
                <p class="wolves-guardian-plate-dinosaur-label">
                  {{ guardianDinosaurProfile(parseGuardianCue(cue.text)!.name)!.label }}
                </p>
                <p class="wolves-guardian-plate-dinosaur-species">
                  {{ guardianDinosaurProfile(parseGuardianCue(cue.text)!.name)!.scientificName }}
                </p>
              </div>
            </div>
          </div>
        </template>
        <p v-else class="wolves-guardian-plate-name">
          {{ cue.text }}
        </p>
      </div>
    </template>

    <p
      v-else-if="overlayText"
      :key="overlayText"
      class="wolves-intro-overlay-text font-mono"
      :class="{
        'wolves-intro-overlay-text-somber': isSomberTextSegment,
        'wolves-intro-overlay-text-dominant': overlayCueForDisplay?.emphasis === 'dominant',
        'wolves-intro-overlay-text-terminal': overlayCueForDisplay?.presentation === 'terminal',
        'wolves-intro-overlay-text-slim': overlayCueForDisplay?.slim,
        'wolves-intro-overlay-text-top': overlayCueForDisplay?.backgroundCrossfade && overlayCueForDisplay.emphasis !== 'dominant' && !overlayCueForDisplay.calamity && overlayCueForDisplay.textPosition !== 'bottom' && overlayCueForDisplay.textPosition !== 'bottom-right',
        'wolves-intro-overlay-text-bottom-right': overlayCueForDisplay?.textPosition === 'bottom-right',
      }"
      :style="isSomberTextSegment ? { animationDuration: `${somberFadeDuration}s` } : undefined"
    >
      <template v-if="overlayCueForDisplay?.slim && overlayText.includes('\n')">
        <span class="wolves-intro-overlay-text-slim-line1">{{ overlayText.split('\n')[0] }}</span>
        <span class="wolves-intro-overlay-text-slim-line2">{{ formatIntroCueText(overlayText.split('\n')[1], overlayCueForDisplay?.preservePunctuation) }}</span>
      </template>
      <template v-else>
        <span
          v-for="(part, index) in overlayTextParts"
          :key="index"
          :class="{ 'wolves-intro-letter-highlight': part.highlight }"
        >{{ part.char }}</span>
      </template>
    </p>

    <!-- Transport now lives in the app-level Destiny hero widget; the overlay
         exposes next/previous/toggle/seekToRatio and emits status instead. -->
  </div>
</template>

<style scoped>
.wolves-intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  overflow: hidden;
}

.wolves-intro-overlay-player {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.wolves-intro-overlay-top-left-mask {
  position: absolute;
  top: max(1rem, env(safe-area-inset-top));
  left: max(1rem, env(safe-area-inset-left));
  width: min(32rem, 48vw);
  height: clamp(5.6rem, 11vh, 8.4rem);
  border-radius: 0 0 1.6rem;
  background: linear-gradient(135deg, rgb(0 0 0 / 96%) 0%, rgb(0 0 0 / 82%) 72%, transparent 100%);
  pointer-events: none;
  z-index: 2;
}

.wolves-intro-overlay-pause-veil {
  position: absolute;
  inset: 0;
  opacity: 0;
  background: radial-gradient(circle at center, rgb(0 0 0 / 10%) 0%, rgb(0 0 0 / 22%) 35%, rgb(0 0 0 / 78%) 100%);
  pointer-events: none;
  transition: opacity 0.18s ease-out;
  z-index: 3;
}

.wolves-intro-overlay-pause-veil-active {
  opacity: 1;
}

.wolves-intro-overlay-blackscreen {
  position: absolute;
  inset: 0;
  background: #000;
}

/* The wrapper `<Transition>`-ed per scene/stage: gives the whole scene (day+night images and
   any vignette together) a single fade identity, so switching scenes cross-dissolves the old
   scene out while the new one fades in simultaneously, rather than a hard cut between them. */
.wolves-intro-overlay-scene {
  position: absolute;
  inset: 0;
}

.wolves-scene-crossfade-enter-active,
.wolves-scene-crossfade-leave-active {
  transition-property: opacity;
  transition-timing-function: ease-in-out;
}

.wolves-scene-crossfade-enter-from,
.wolves-scene-crossfade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .wolves-scene-crossfade-enter-active,
  .wolves-scene-crossfade-leave-active {
    transition: none;
  }
}

.wolves-intro-overlay-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Dims still images (e.g. the KubeCon Ken Burns beat) behind the overlaid text; the
     day/night crossfade beats override this via their own animated opacity below. */
  opacity: 0.55;
}

.wolves-intro-overlay-background-day {
  opacity: 1;
  animation-name: wolves-intro-collapse-day-fade;
  animation-timing-function: ease-in;
  animation-fill-mode: both;
}

.wolves-intro-overlay-background-night {
  opacity: 0;
  mix-blend-mode: screen;
  animation-name: wolves-intro-collapse-night-fade;
  animation-timing-function: ease-in;
  animation-fill-mode: both;
}

/* The day frame dims out first, confirming the cue starts on the bright day image... */
@keyframes wolves-intro-collapse-day-fade {
  0% {
    opacity: 1;
    filter: brightness(1);
  }
  55% {
    opacity: 0.75;
    filter: brightness(0.85);
  }
  80% {
    opacity: 0.2;
    filter: brightness(0.4);
  }
  100% {
    opacity: 0;
    filter: brightness(0.2);
  }
}

/* ...while the night frame rises in underneath it, so the cue ends fully on the dark image. */
@keyframes wolves-intro-collapse-night-fade {
  0%,
  30% {
    opacity: 0;
  }
  55% {
    opacity: 0.25;
  }
  80% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* A slow-building darkness pulse layered over the crossfade, dramatizing the calamity rather
   than a plain linear dissolve between the two frames. */
.wolves-intro-overlay-calamity-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 0%, rgb(0 0 0 / 85%) 100%);
  opacity: 0;
  animation-name: wolves-intro-calamity-vignette;
  animation-timing-function: ease-in;
  animation-fill-mode: both;
}

@keyframes wolves-intro-calamity-vignette {
  0%,
  45% {
    opacity: 0;
  }
  70% {
    opacity: 0.55;
  }
  100% {
    opacity: 0.85;
  }
}

.wolves-intro-overlay-background-kenburns {
  /* Anchor the zoom/pan on the crowd's faces (roughly the upper-middle third of this wide
     group photo), keeping the jungle foliage on the left and the escalators/floor padding on
     the right and bottom out of frame throughout the motion. */
  transform-origin: 50% 32%;
  animation-name: wolves-intro-kenburns;
  animation-timing-function: ease-in-out;
  animation-fill-mode: both;
}

@keyframes wolves-intro-kenburns {
  0% {
    transform: scale(1.15) translate(3%, 2%);
  }
  50% {
    transform: scale(1.4) translate(-4%, -3%);
  }
  100% {
    transform: scale(1.65) translate(2%, 4%);
  }
}

.wolves-intro-overlay-audio-mount {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.wolves-intro-overlay-burned-captions {
  position: absolute;
  inset: 13rem 0 auto; /* top band: clear of the bottom guardian plates and the hero widget */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0 6vw;
  pointer-events: none;
  z-index: 7;
}
.wolves-intro-overlay-burned-caption {
  max-width: 72rem;
  padding: 1rem 2.2rem;
  background: rgb(8 9 12 / 78%);
  /* Standard dialogue rides the plate blue; gold stays reserved for power moments. */
  border: 1px solid rgb(147 197 253 / 30%);
  border-left: 2px solid #93c5fd;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 0.9rem), calc(100% - 0.9rem) 100%, 0 100%);
  font-family: var(--wc-font-weyland-mono, 'Share Tech Mono', monospace);
  font-size: clamp(1.9rem, 2.2vw, 2.6rem);
  line-height: 1.45;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: #e9e9e5;
  text-align: center;
}

.wolves-intro-overlay-title-card {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(11rem, 17vh, 14rem) clamp(1.6rem, 4vw, 4rem) clamp(2rem, 7vh, 5rem);
  background: #000;
  color: #fff;
  text-align: center;
  z-index: 6;
}

.wolves-intro-overlay-title-card-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: clamp(1.2rem, 2.5vw, 2.4rem);
  width: min(100%, 100rem);
}

.wolves-intro-overlay-title-card-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.wolves-intro-overlay-title-card-art {
  width: min(68vw, 30rem);
  max-height: 34vh;
  object-fit: contain;
  filter: drop-shadow(0 0 24px rgb(0 0 0 / 70%));
}

.wolves-intro-overlay-title-card-line {
  margin: 0;
  max-width: min(90vw, 960px);
  font-family: 'Eurostile', 'Uni Sans', 'Arial Narrow', 'Segoe UI', sans-serif;
  font-size: clamp(2.6rem, 4vw, 4.2rem);
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #fff4c8;
  text-shadow:
    -3px -3px 0 #000,
    3px -3px 0 #000,
    -3px 3px 0 #000,
    3px 3px 0 #000,
    0 0 24px rgb(0 0 0 / 90%);
  -webkit-text-stroke: 2.8px #000;
}

.wolves-intro-overlay-title-card-line:not(.wolves-intro-overlay-title-card-line-small) {
  width: 100%;
}

.wolves-intro-overlay-title-card-line-small {
  display: inline-block;
  padding: 0.25em 0.6em;
  border: 1px solid rgb(255 244 200 / 45%);
  border-radius: 999px;
  background: rgb(0 0 0 / 45%);
  font-size: clamp(1.2rem, 1.8vw, 1.8rem);
  letter-spacing: 0.15em;
  font-weight: 900;
  line-height: 1.1;
  text-shadow: none;
  white-space: nowrap;
  -webkit-text-stroke: 0;
}

.wolves-intro-overlay-title-card-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  justify-self: end;
  width: min(100%, 24rem);
  padding: 1.2rem;
  border: 1px solid rgb(147 197 253 / 32%);
  border-radius: 2rem;
  background: linear-gradient(180deg, rgb(9 11 16 / 92%) 0%, rgb(5 7 10 / 96%) 100%);
  box-shadow:
    0 0 32px rgb(0 0 0 / 55%),
    inset 0 0 0 1px rgb(255 255 255 / 5%);
  color: #fff;
  text-decoration: none;
  transform: translateY(-3rem);
}

.wolves-intro-overlay-title-card-qr-dialogue {
  width: 100%;
  min-height: 3.8rem;
  padding: 0.8rem 1rem;
  border: 1px solid rgb(147 197 253 / 40%);
  border-radius: 0.85rem;
  background: rgb(5 18 31 / 88%);
  box-shadow: inset 0 0 18px rgb(59 130 246 / 14%);
  font-family: var(--wc-font-weyland-mono, 'Share Tech Mono', monospace);
  font-size: clamp(1.05rem, 1.15vw, 1.3rem);
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1.35;
  text-transform: uppercase;
  color: #93c5fd;
}

.wolves-intro-overlay-title-card-qr-frame {
  width: min(100%, 21rem);
  aspect-ratio: 1;
  padding: 0.65rem;
  overflow: hidden;
  border-radius: 1.35rem;
  background: #fff;
}

.wolves-intro-overlay-title-card-qr-image {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 0.75rem;
  image-rendering: pixelated;
}

.wolves-intro-overlay-title-card-qr-domain {
  font-family: var(--wc-font-weyland, 'Michroma', 'Arial Narrow', sans-serif);
  font-size: clamp(1rem, 1.2vw, 1.25rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

@media (max-width: 700px) {
  .wolves-intro-overlay-title-card {
    justify-content: flex-start;
    padding-top: clamp(11rem, 19vh, 13rem);
  }

  .wolves-intro-overlay-title-card-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    align-items: center;
    justify-items: center;
    gap: 0.8rem;
    width: 100%;
  }

  .wolves-intro-overlay-title-card-main {
    display: contents;
  }

  .wolves-intro-overlay-title-card-line:not(.wolves-intro-overlay-title-card-line-small) {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .wolves-intro-overlay-title-card-art {
    grid-column: 1;
    grid-row: 2;
    width: min(42vw, 16rem);
    max-height: 24vh;
  }

  .wolves-intro-overlay-title-card-line-small {
    grid-column: 1;
    grid-row: 3;
    z-index: 1;
    color: #fff4c8;
    width: 100%;
    padding: 0.4em 0.5em;
    font-size: 1rem;
    letter-spacing: 0.08em;
    text-shadow: none;
    white-space: normal;
    -webkit-text-stroke: 0;
  }

  .wolves-intro-overlay-title-card-qr {
    grid-column: 2;
    grid-row: 2 / 4;
    width: min(48vw, 18.5rem);
    padding: 1rem;
    transform: none;
  }

  .wolves-intro-overlay-title-card-qr-frame {
    width: min(100%, 16.5rem);
    padding: 0.5rem;
  }

  .wolves-intro-overlay-title-card-qr-dialogue {
    font-size: clamp(0.9rem, 2.8vw, 1.15rem);
  }
}

.wolves-intro-overlay-text {
  position: absolute;
  left: 5%;
  bottom: 12%;
  right: 5%;
  margin: 0;
  color: #e9e9e5;
  /* Weyland-era display type (Michroma = Microgramma/Eurostile Extended stand-in). */
  font-family: var(--wc-font-weyland, 'Michroma', 'Arial Narrow', sans-serif);
  /* Michroma renders much wider than the old stack; this keeps the same optical
     size while letting authored lines fit without double-wrapping. */
  font-size: clamp(2.4rem, 4.6vw, 4.4rem);
  line-height: 1.2;
  font-weight: 400; /* Michroma ships one weight; synthetic bold ruins it */
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-shadow: 0 2px 18px rgb(0 0 0 / 85%);
  /* Some prologue cues author an explicit line break in their `text` (a JS/TS template
     literal newline) to control where a long line wraps -- preserve it instead of collapsing
     to a single line, per explicit user request (2026-07-15). */
  white-space: pre-line;
}

.wolves-intro-overlay-text-terminal {
  top: 12%;
  bottom: auto;
  left: 7%;
  right: 7%;
  width: min(86%, 96rem);
  padding: clamp(1.6rem, 3vw, 2.8rem);
  border: 1px solid rgb(127 212 212 / 30%);
  border-left: 2px solid #7fd4d4;
  background: rgb(3 10 14 / 88%);
  box-shadow: inset 0 0 28px rgb(59 130 246 / 8%);
  font-family: var(--wc-font-weyland-mono, 'Share Tech Mono', monospace);
  font-size: clamp(1.5rem, 2vw, 2.2rem);
  line-height: 1.55;
  font-weight: 400;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: none;
  color: #7fd4d4;
  text-shadow: none;
  animation: none;
  opacity: 1;
}

/* The Bluefin wallpaper scenes (backgroundCrossfade cues) are sky-led landscapes with the
   most legible open space along the top of the frame, unlike the KubeCon crowd shot or plain
   black cards -- so their caption moves up out of the busier lower portion of the artwork. */
.wolves-intro-overlay-text-top {
  top: 10%;
  bottom: auto;
}

.wolves-intro-overlay-text-bottom-right {
  left: auto;
  width: min(94%, 136rem);
  /* Scaled with the Michroma base so authored lines fit without double-wrapping. */
  font-size: clamp(2.4rem, 4.2vw, 4.2rem);
  line-height: 1.25;
  text-align: right;
}

/* A slow, subtle, somber fade-in for the Prologue/Epilogue's black-screen text cards, paced to
   the Gayane Ballet Suite (Adagio)'s own tempo (see PROLOGUE_TEXT_FADE_SECONDS). Kept to a bare
   opacity change (no letter-spacing/translate motion) so it reads as gentle rather than showy,
   and respects prefers-reduced-motion below. The trailer's Guardian overlay cards do not use
   this class and simply appear immediately. */
.wolves-intro-overlay-text-somber {
  opacity: 0;
  animation-name: wolves-intro-text-somber-fade;
  animation-timing-function: ease-in-out;
  animation-fill-mode: both;
}

.wolves-intro-overlay-text-terminal.wolves-intro-overlay-text-somber {
  animation: none;
  opacity: 1;
}

@keyframes wolves-intro-text-somber-fade {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wolves-intro-overlay-text-somber {
    animation: none;
    opacity: 1;
  }

  .wolves-intro-overlay-pause-veil {
    transition: none;
  }

  .wolves-intro-overlay-background-day {
    animation: none;
    opacity: 0;
    filter: brightness(0.2);
  }

  .wolves-intro-overlay-background-night {
    animation: none;
    opacity: 1;
  }

  .wolves-intro-overlay-calamity-vignette {
    animation: none;
    opacity: 0.85;
  }
}

.wolves-intro-letter-highlight {
  color: var(--color-blue);
  font-weight: 900;
}

/* The Arthur C. Clarke quote is the emotional hinge of the Prologue (the line that explains
   why the Wolves' extinction stakes matter) and should visually dominate rather than read as
   just another caption: centered, much larger, bolder, and spanning most of the screen. */
.wolves-intro-overlay-text-dominant {
  left: 8%;
  right: 8%;
  bottom: auto;
  top: 50%;
  transform: translateY(-50%);
  text-align: center;
  font-weight: 700;
  font-size: clamp(4rem, 8vw, 8rem);
  line-height: 1.2;
  letter-spacing: 0.015em;
  text-shadow: 0 4px 24px rgb(0 0 0 / 90%);
}

.wolves-intro-overlay-text-slim {
  font-weight: 500;
  letter-spacing: 0.03em;
  text-align: center;
}

.wolves-intro-overlay-text-slim-line1 {
  display: block;
  font-size: clamp(3.2rem, 5.8vw, 5.6rem);
  font-weight: 900;
  letter-spacing: 0.12em;
  margin-bottom: 0.6rem;
  color: #fff;
  text-align: center;
}

.wolves-intro-overlay-text-slim-line2 {
  display: block;
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 400;
  letter-spacing: 0.04em;
  color: #cbd5e1;
  text-transform: uppercase;
  text-align: center;
}

/* Guardian trailer callout, redesigned as a Destiny 2 "Guardian Rank Up" style HUD burst:
   a chamfered plate with a radial ignition flash, a crest badge flanked by horizon accent
   lines, and a slow letter-spacing text drift -- built from research into Bungie's diegetic
   HUD notification style (geometry, glow/bloom, and animation choreography). Replaces the
   earlier plain "nerd plate" card. */
.wolves-guardian-plate {
  position: absolute;
  bottom: 10%;
  left: 5%;
  max-width: 44rem;
  padding: 1.75rem 2rem 1.5rem;
  overflow: visible;
  border: 1px solid rgb(147 197 253 / 45%);
  border-radius: 0.75rem;
  clip-path: polygon(16px 0%, 100% 0%, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0% 100%, 0% 16px);
  background: rgb(8 12 20 / 82%);
  color: #e2e8f0;
  text-align: center;
  text-shadow: 0 2px 10px rgb(0 0 0 / 80%);
  animation: wolves-guardian-plate-impact 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Anchors this callout to the left/right side of the frame instead of the default lower-left
   placement, reserved for cues whose window overlaps another Guardian's (they share the shot,
   so both plates need to sit side-by-side rather than stacking on top of each other). */
.wolves-guardian-plate-left {
  left: 5%;
  right: auto;
}

.wolves-guardian-plate-right {
  left: auto;
  right: 5%;
}

/* Raises the callout from the default lower-third anchor to sit closer to a Guardian's
   actual on-screen position when it towers above the frame's lower third (see the `raised`
   field doc comment in wolves-intro-sequence.ts). */
.wolves-guardian-plate-raised {
  bottom: auto;
  top: 28%;
}

/* Gilds the plate gold instead of the default silver/blue treatment to signify leadership.
   Reserved for Christoph Blecker's "First Among Equals" cue — see the `leader` field doc
   comment in wolves-intro-sequence.ts. Overrides border, horizon lines, crest, burst flash,
   and the title line so the gold reads consistently across the whole plate. */
.wolves-guardian-plate-leader {
  border-color: rgb(250 204 21 / 55%);
  box-shadow: 0 0 24px rgb(250 204 21 / 20%);
}

.wolves-guardian-plate-leader .wolves-guardian-plate-burst {
  background: radial-gradient(circle, #fff 0%, #facc15 45%, transparent 70%);
}

.wolves-guardian-plate-leader .wolves-guardian-plate-horizon {
  background: linear-gradient(to right, transparent, #facc15 60%, #fff 100%);
  box-shadow: 0 0 8px rgb(250 204 21 / 55%);
}

.wolves-guardian-plate-leader .wolves-guardian-plate-horizon-right {
  background: linear-gradient(to left, transparent, #facc15 60%, #fff 100%);
}

.wolves-guardian-plate-leader .wolves-guardian-plate-crest {
  filter: drop-shadow(0 0 8px rgb(250 204 21 / 70%));
}

.wolves-guardian-plate-leader .wolves-guardian-plate-crest-outer,
.wolves-guardian-plate-leader .wolves-guardian-plate-crest-chevron {
  stroke: #facc15;
}

.wolves-guardian-plate-leader .wolves-guardian-plate-label {
  color: #facc15;
}

.wolves-guardian-plate-leader .wolves-guardian-plate-title {
  color: #fde68a;
  font-weight: 600;
}

/* Radial ignition flash behind the crest at the moment the plate appears. */
.wolves-guardian-plate-burst {
  position: absolute;
  top: 1.25rem;
  left: 50%;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, #93c5fd 45%, transparent 70%);
  mix-blend-mode: color-dodge;
  filter: blur(8px);
  transform: translate(-50%, -50%) scale(0.1);
  animation: wolves-guardian-plate-ignite 0.5s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
}

.wolves-guardian-plate-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.wolves-guardian-plate-horizon {
  flex: 1 1 auto;
  height: 2px;
  min-width: 2rem;
  background: linear-gradient(to right, transparent, #93c5fd 60%, #fff 100%);
  box-shadow: 0 0 8px rgb(147 197 253 / 55%);
  transform: scaleX(0);
}

.wolves-guardian-plate-horizon-left {
  transform-origin: right center;
  animation: wolves-guardian-plate-line-sweep 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
}

.wolves-guardian-plate-horizon-right {
  transform-origin: left center;
  background: linear-gradient(to left, transparent, #93c5fd 60%, #fff 100%);
  animation: wolves-guardian-plate-line-sweep 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
}

.wolves-guardian-plate-crest {
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  filter: drop-shadow(0 0 6px rgb(147 197 253 / 65%));
  opacity: 0;
  animation: wolves-guardian-plate-crest-drop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.15) 0.05s forwards;
}

.wolves-guardian-plate-crest-outer {
  fill: none;
  stroke: #93c5fd;
  stroke-width: 2;
}

.wolves-guardian-plate-crest-inner {
  fill: rgb(8 12 20 / 95%);
  stroke: #f5f5f5;
  stroke-width: 1;
}

.wolves-guardian-plate-crest-chevron {
  fill: none;
  stroke: #93c5fd;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.wolves-guardian-plate-label {
  margin: 0;
  font-size: clamp(1.4rem, 1.1rem + 0.6vw, 1.8rem);
  letter-spacing: 0.35em;
  color: #93c5fd;
}

.wolves-guardian-plate-class {
  margin: 0.35rem 0 0;
  font-size: clamp(1.6rem, 1.2rem + 0.9vw, 2.1rem);
  letter-spacing: 0.05em;
  color: #bfdbfe;
  text-transform: uppercase;
}

.wolves-guardian-plate-name {
  margin: 0.2rem 0 0;
  font-size: clamp(2.6rem, 1.9rem + 1.6vw, 3.6rem);
  font-weight: 700;
  color: #f5f5f5;
  background: linear-gradient(to bottom, #fff 0%, #e2e8f0 60%, #a0aec0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 10px rgb(255 255 255 / 25%));
  animation: wolves-guardian-plate-text-drift 1.4s cubic-bezier(0.1, 0.9, 0.2, 1) 0.15s backwards;
}

.wolves-guardian-plate-body {
  margin-top: 0.45rem;
}

.wolves-guardian-plate-body-paired {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(13rem, 16rem);
  gap: 1rem;
  align-items: center;
}

.wolves-guardian-plate-identity {
  min-width: 0;
}

.wolves-guardian-plate-title {
  margin: 0.35rem 0 0;
  font-size: clamp(1.5rem, 1.2rem + 0.7vw, 1.9rem);
  color: #94a3b8;
}

/* Blue vertical rule dividing a multi-segment title (e.g. Christoph Blecker's four titles, or
   Natali Vlatko's two), replacing the authored ` — ` em-dash join with a UI separator instead of
   punctuation, per explicit user request. Uses the same blue accent as the rest of the plate
   chrome (crest, horizon lines, class label) so it reads as structure, not text. */
.wolves-guardian-plate-title-sep {
  display: inline-block;
  margin: 0 0.4em;
  color: #93c5fd;
  font-weight: 400;
  opacity: 0.85;
}

/* Distinctive gold "bling" treatment for a single called-out title segment (e.g. Christoph
   Blecker's "Platinum Member"), separate from the plain title text around it. A shimmer sweeps
   across the gold gradient text on a loop, with a soft pulsing glow, so it reads as a
   deliberately flashy inline award rather than a plain title word. */
.wolves-guardian-plate-bling {
  position: relative;
  font-weight: 700;
  letter-spacing: 0.03em;
  background: linear-gradient(100deg, #92700f 20%, #fff6d0 40%, #fde68a 50%, #fff6d0 60%, #92700f 80%);
  background-size: 250% 100%;
  background-position: 0% 0%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 6px rgb(250 204 21 / 55%));
  animation:
    wolves-guardian-plate-bling-shimmer 2.6s linear infinite,
    wolves-guardian-plate-bling-pulse 1.8s ease-in-out infinite;
}

.wolves-guardian-plate-dinosaur {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.8rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgb(147 197 253 / 28%);
  border-radius: 0.85rem;
  background:
    radial-gradient(circle at top left, rgb(147 197 253 / 16%), transparent 55%),
    linear-gradient(135deg, rgb(15 23 42 / 92%), rgb(2 6 23 / 82%));
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 4%);
  animation: wolves-guardian-plate-text-drift 1.4s cubic-bezier(0.1, 0.9, 0.2, 1) 0.25s backwards;
}

.wolves-guardian-plate-dinosaur-art {
  flex: 0 0 auto;
  width: clamp(6.8rem, 5rem + 4vw, 10rem);
  height: clamp(6.8rem, 5rem + 4vw, 10rem);
  object-fit: contain;
  filter: drop-shadow(0 0 12px rgb(255 255 255 / 18%));
}

.wolves-guardian-plate-dinosaur-copy {
  min-width: 0;
  text-align: left;
}

.wolves-guardian-plate-dinosaur-label,
.wolves-guardian-plate-dinosaur-species {
  margin: 0;
}

.wolves-guardian-plate-dinosaur-label {
  font-size: clamp(1.6rem, 1.2rem + 0.9vw, 2.2rem);
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #bfdbfe;
}

.wolves-guardian-plate-dinosaur-species {
  margin-top: 0.3rem;
  font-size: clamp(1.25rem, 1rem + 0.45vw, 1.55rem);
  color: #cbd5e1;
}

@media (max-width: 640px) {
  .wolves-guardian-plate-body-paired {
    grid-template-columns: 1fr;
  }

  .wolves-guardian-plate-dinosaur {
    justify-content: center;
  }

  .wolves-guardian-plate-dinosaur-copy {
    text-align: center;
  }
}

@keyframes wolves-guardian-plate-ignite {
  0% {
    transform: translate(-50%, -50%) scale(0.1);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(3);
    opacity: 0;
  }
}

@keyframes wolves-guardian-plate-line-sweep {
  0% {
    transform: scaleX(0);
  }
  100% {
    transform: scaleX(1);
  }
}

@keyframes wolves-guardian-plate-crest-drop {
  0% {
    opacity: 0;
    transform: scale(2.2) rotate(12deg);
  }
  60% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes wolves-guardian-plate-text-drift {
  0% {
    opacity: 0;
    letter-spacing: -0.05em;
    filter: blur(4px);
  }
  25% {
    opacity: 1;
    filter: blur(0);
  }
  100% {
    opacity: 1;
    letter-spacing: normal;
    filter: blur(0);
  }
}

@keyframes wolves-guardian-plate-bling-shimmer {
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: -250% 0%;
  }
}

@keyframes wolves-guardian-plate-bling-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 4px rgb(250 204 21 / 45%));
  }
  50% {
    filter: drop-shadow(0 0 10px rgb(250 204 21 / 85%));
  }
}

@keyframes wolves-guardian-plate-impact {
  0% {
    filter: contrast(1) saturate(1);
  }
  12% {
    filter: contrast(1.2) saturate(1.4) drop-shadow(2px 0 0 rgb(255 0 100 / 50%))
      drop-shadow(-2px 0 0 rgb(0 255 255 / 50%));
  }
  35% {
    filter: contrast(1) saturate(1);
  }
}

/* Permanent progress bar for the whole intro sequence (Prologue + Guardian trailer +
   Epilogue), so the runtime of the full experience is always visible, not just whichever
   segment happens to be playing. */
/* TEMPORARY REVIEW TOOLING -- remove this whole rule block once the Prologue content pass is
   signed off. Not part of the production intro experience. */
</style>
