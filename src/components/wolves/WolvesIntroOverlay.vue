<script setup lang="ts">
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import type { IntroOverlayTextCue, IntroVideoSpec } from '@/data/wolves-intro-sequence'
import { computed, nextTick, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import { getYoutubePlayerConstructor, getYoutubePlayerState, loadYoutubeIframeApi } from '@/composables/useYoutubeIframeApi'
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
  isVideoCutoffReached,
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
  (e: 'status', payload: {
    currentTime: number
    duration: number
    paused: boolean
    segmentId: string
    canGoPrevious: boolean
  }): void
}>()

const baseUrl = import.meta.env.BASE_URL

const sequenceState = ref(createIntroSequenceState())
const currentTime = ref(0)
const isPaused = ref(false)
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
const activeComicTitleCardCue = computed<IntroOverlayTextCue | undefined>(() => {
  const cues = burnedInCaptionCues.value ?? currentSegment.value?.overlays
  if (!cues) {
    return undefined
  }
  return cues.find((cue: IntroOverlayTextCue) => cue.comicHeroTitleCard && currentTime.value >= cue.start && currentTime.value < cue.end)
})
const overlayCueForDisplay = computed<IntroOverlayTextCue | undefined>(() => activeComicTitleCardCue.value?.comicHeroTitleCard ? activeComicTitleCardCue.value : activeCue.value)
const overlayText = computed(() => overlayCueForDisplay.value?.text)
const activeBurnedInCaptions = computed<readonly IntroOverlayTextCue[]>(() => activeOverlayCues(burnedInCaptionCues.value, currentTime.value))
/**
 * All cues active right now, not just the first match — the Guardian trailer intentionally
 * overlaps Christoph Blecker's and Natali Vlatko's windows since they share the same shot, so
 * both callouts need to render side-by-side via their `position` anchor.
 */
const activeCues = computed<readonly IntroOverlayTextCue[]>(() => activeOverlayCues(currentSegment.value?.overlays, currentTime.value))

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

/** Bonded-dinosaur artwork URL for a guardian's plate, or undefined if no bond is documented. */
function guardianDinosaurArtwork(guardianName: string): string | undefined {
  const bond = wolvesGuardianDinosaurBonds.find(entry => entry.guardianName === guardianName)
  const species = bond && dinosaurSpecies.find(entry => entry.id === bond.dinosaurSpeciesId)
  return species && `${import.meta.env.BASE_URL}${species.artwork.slice(2)}`
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

const overlayTextParts = computed(() => {
  const text = stripIntroPunctuation(overlayText.value ?? '')
  const highlight = overlayCueForDisplay.value?.highlightSubstring
  return buildOverlayTextParts(text, highlight ? stripIntroPunctuation(highlight) : highlight)
})

let player: YoutubePlayer | null = null
let audioPlayer: YoutubePlayer | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let textTimer: ReturnType<typeof setInterval> | null = null
let loadToken = 0

/** Seek within the active segment by 0..1 ratio, driven by the hero widget's progress bar. */
function seekToRatio(ratio: number) {
  if (activeSegmentDuration.value <= 0) {
    return
  }
  const target = Math.min(Math.max(ratio, 0), 1) * activeSegmentDuration.value
  currentTime.value = target
  if (currentSegment.value?.kind === 'video') {
    player?.seekTo?.(target, true)
  }
  else {
    // Text segments follow the background audio's clock, so the audio must move too.
    audioPlayer?.seekTo?.(target, true)
  }
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
    videoId: segment.youtubeVideoId,
    playerVars,
    events: {
      onReady: () => {
        // Force YouTube's own captions off even for viewers whose account
        // preference enables them; the burned-in styled captions are the only
        // caption layer on this trailer.
        player?.unloadModule?.('captions')
        player?.unloadModule?.('cc')
        activeSegmentDuration.value = segment.maxDuration ?? player?.getDuration?.() ?? 0
        segmentDurations.value[sequenceState.value.index] = activeSegmentDuration.value
        stopPolling()
        pollTimer = setInterval(() => {
          currentTime.value = player?.getCurrentTime?.() ?? 0
          if (isVideoCutoffReached(segment, currentTime.value)) {
            advance()
          }
        }, 200)
      },
      onStateChange: (event: { data: number }) => {
        if (event.data === getYoutubePlayerState().PLAYING) {
          // YouTube can re-attach the caption module on play/seek; keep it off.
          player?.unloadModule?.('captions')
          player?.unloadModule?.('cc')
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

function handleTogglePlayback() {
  const activePlayer = currentSegment.value && isVideoSegment(currentSegment.value) ? player : audioPlayer
  if (isPaused.value) {
    activePlayer?.playVideo?.()
  }
  else {
    activePlayer?.pauseVideo?.()
  }
  isPaused.value = !isPaused.value
}

onBeforeUnmount(() => {
  destroyPlayer()
  stopTextTimer()
  destroyAudioPlayer()
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
  })
})

defineExpose({
  next: handleNext,
  previous: handlePrevious,
  toggle: handleTogglePlayback,
  seekToRatio,
})
</script>

<template>
  <div v-if="currentSegment && !sequenceState.done" class="wolves-intro-overlay">
    <div v-if="currentSegment.kind === 'video'" ref="mountHost" class="wolves-intro-overlay-player" />

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
        <p class="wolves-intro-overlay-title-card-line">
          {{ activeComicTitleCardCue.text }}
        </p>
        <p class="wolves-intro-overlay-title-card-line wolves-intro-overlay-title-card-line-small">
          Made by Paid Artists
        </p>
      </div>
      <div v-else-if="activeBurnedInCaptions.length" class="wolves-intro-overlay-burned-captions">
        <div v-for="cue in activeBurnedInCaptions" :key="`${cue.start}-${cue.end}-${cue.text}`" class="wolves-intro-overlay-burned-caption">
          {{ stripIntroPunctuation(cue.text) }}
        </div>
      </div>

      <div
        v-for="cue in activeCues"
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
          <p class="wolves-guardian-plate-name">
            {{ parseGuardianCue(cue.text)!.name }}
            <img
              v-if="guardianDinosaurArtwork(parseGuardianCue(cue.text)!.name)"
              :src="guardianDinosaurArtwork(parseGuardianCue(cue.text)!.name)"
              alt=""
              aria-hidden="true"
              class="wolves-guardian-plate-dinosaur-icon"
            >
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
        'wolves-intro-overlay-text-slim': overlayCueForDisplay?.slim,
        'wolves-intro-overlay-text-top': overlayCueForDisplay?.backgroundCrossfade && overlayCueForDisplay.emphasis !== 'dominant' && !overlayCueForDisplay.calamity && overlayCueForDisplay.textPosition !== 'bottom' && overlayCueForDisplay.textPosition !== 'bottom-right',
        'wolves-intro-overlay-text-bottom-right': overlayCueForDisplay?.textPosition === 'bottom-right',
      }"
      :style="isSomberTextSegment ? { animationDuration: `${somberFadeDuration}s` } : undefined"
    >
      <span
        v-for="(part, index) in overlayTextParts"
        :key="index"
        :class="{ 'wolves-intro-letter-highlight': part.highlight }"
      >{{ part.char }}</span>
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
  z-index: 4;
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 32px;
  background: #000;
  color: #fff;
  text-align: center;
  z-index: 6;
}

.wolves-intro-overlay-title-card-line {
  margin: 0;
  max-width: min(90vw, 960px);
  font-family: 'Eurostile', 'Uni Sans', 'Arial Narrow', 'Segoe UI', sans-serif;
  font-size: clamp(2.6rem, 8vw, 6.2rem);
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

.wolves-intro-overlay-title-card-line-small {
  display: inline-block;
  padding: 0.25em 0.6em;
  border: 1px solid rgb(255 244 200 / 45%);
  border-radius: 999px;
  background: rgb(0 0 0 / 45%);
  font-size: clamp(1.6rem, 3.8vw, 3rem);
  letter-spacing: 0.24em;
  font-weight: 900;
  line-height: 1.1;
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

.wolves-guardian-plate-dinosaur-icon {
  display: inline-block;
  height: clamp(2.2rem, 1.6rem + 1.4vw, 3rem);
  width: auto;
  margin-left: 0.6rem;
  vertical-align: middle;
  filter: drop-shadow(0 0 6px rgb(255 255 255 / 35%));
  animation: wolves-guardian-plate-text-drift 1.4s cubic-bezier(0.1, 0.9, 0.2, 1) 0.25s backwards;
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
