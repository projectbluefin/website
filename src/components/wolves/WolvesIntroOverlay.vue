<script setup lang="ts">
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import type { IntroOverlayTextCue, IntroVideoSpec } from '@/data/wolves-intro-sequence'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getYoutubePlayerConstructor, getYoutubePlayerState, loadYoutubeIframeApi } from '@/composables/useYoutubeIframeApi'
import {
  activeOverlayCue,
  advanceIntroSequence,
  createIntroSequenceState,
  isTextSegment,
  isTextSegmentComplete,
  isVideoCutoffReached,
  isVideoSegment,
  skipIntroSequence,
} from '@/data/wolves-intro-sequence'

const props = defineProps<{
  videos: readonly IntroVideoSpec[]
}>()

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const baseUrl = import.meta.env.BASE_URL

const sequenceState = ref(createIntroSequenceState())
const currentTime = ref(0)
const mountHost = ref<HTMLDivElement | null>(null)
const audioMountHost = ref<HTMLDivElement | null>(null)

const currentSegment = computed<IntroVideoSpec | undefined>(() => props.videos[sequenceState.value.index])
const activeCue = computed<IntroOverlayTextCue | undefined>(() => activeOverlayCue(currentSegment.value?.overlays, currentTime.value))
const overlayText = computed(() => activeCue.value?.text)

/** Splits text into single-character parts so every literal B/F can be highlighted without v-html. */
const overlayTextParts = computed(() => {
  const text = overlayText.value ?? ''
  return Array.from(text).map(char => ({
    char,
    highlight: char.toUpperCase() === 'B' || char.toUpperCase() === 'F',
  }))
})

let player: YoutubePlayer | null = null
let audioPlayer: YoutubePlayer | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let textTimer: ReturnType<typeof setInterval> | null = null
let loadToken = 0

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
  void loadAudioTrack(segment.audioYoutubeVideoId)

  textTimer = setInterval(() => {
    currentTime.value += 0.2
    if (isTextSegmentComplete(segment, currentTime.value)) {
      advance()
    }
  }, 200)
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

  player = new PlayerCtor(mountNode, {
    width: '100%',
    height: '100%',
    videoId: segment.youtubeVideoId,
    playerVars: {
      autoplay: 1,
      controls: 0,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
    },
    events: {
      onReady: () => {
        stopPolling()
        pollTimer = setInterval(() => {
          currentTime.value = player?.getCurrentTime?.() ?? 0
          if (isVideoCutoffReached(segment, currentTime.value)) {
            advance()
          }
        }, 200)
      },
      onStateChange: (event: { data: number }) => {
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

function handleSkip() {
  sequenceState.value = skipIntroSequence(sequenceState.value)
}

onBeforeUnmount(() => {
  destroyPlayer()
  stopTextTimer()
  destroyAudioPlayer()
})
</script>

<template>
  <div v-if="currentSegment && !sequenceState.done" class="wolves-intro-overlay">
    <div v-if="currentSegment.kind === 'video'" ref="mountHost" class="wolves-intro-overlay-player" />

    <template v-else>
      <div class="wolves-intro-overlay-blackscreen">
        <img
          v-if="activeCue?.backgroundImage"
          :key="activeCue.backgroundImage"
          class="wolves-intro-overlay-background"
          :class="{ 'wolves-intro-overlay-background-kenburns': activeCue.backgroundMotion === 'kenburns' }"
          :style="activeCue.backgroundMotion === 'kenburns' ? { animationDuration: `${activeCue.end - activeCue.start}s` } : undefined"
          :src="`${baseUrl}${activeCue.backgroundImage}`"
          alt=""
        >
        <template v-else-if="activeCue?.backgroundCrossfade">
          <img
            :key="`${activeCue.backgroundCrossfade.day}-day`"
            class="wolves-intro-overlay-background wolves-intro-overlay-background-day"
            :src="`${baseUrl}${activeCue.backgroundCrossfade.day}`"
            alt=""
          >
          <img
            :key="`${activeCue.backgroundCrossfade.night}-night`"
            class="wolves-intro-overlay-background wolves-intro-overlay-background-night"
            :src="`${baseUrl}${activeCue.backgroundCrossfade.night}`"
            alt=""
          >
        </template>
      </div>
      <div ref="audioMountHost" class="wolves-intro-overlay-audio-mount" />
    </template>

    <p v-if="overlayText" class="wolves-intro-overlay-text font-mono">
      <span
        v-for="(part, index) in overlayTextParts"
        :key="index"
        :class="{ 'wolves-intro-letter-highlight': part.highlight }"
      >{{ part.char }}</span>
    </p>

    <button
      type="button"
      class="wolves-intro-overlay-skip"
      aria-label="Skip intro"
      @click="handleSkip"
    >
      Skip
    </button>
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

.wolves-intro-overlay-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.55;
}

.wolves-intro-overlay-background-night {
  opacity: 0.35;
  mix-blend-mode: screen;
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

.wolves-intro-overlay-text {
  position: absolute;
  left: 5%;
  bottom: 12%;
  right: 5%;
  margin: 0;
  color: #f5f5f5;
  font-size: clamp(1rem, 2.4vw, 1.75rem);
  text-shadow: 0 2px 12px rgb(0 0 0 / 80%);
}

.wolves-intro-letter-highlight {
  color: var(--color-blue);
}

.wolves-intro-overlay-skip {
  position: absolute;
  top: 5%;
  right: 5%;
  padding: 0.5rem 1rem;
  border: 1px solid rgb(255 255 255 / 40%);
  border-radius: 999px;
  background: rgb(0 0 0 / 40%);
  color: #f5f5f5;
  font-size: 0.9rem;
  cursor: pointer;
}

.wolves-intro-overlay-skip:hover {
  background: rgb(0 0 0 / 65%);
}
</style>
