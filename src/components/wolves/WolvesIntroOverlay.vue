<script setup lang="ts">
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import type { IntroVideoSpec } from '@/data/wolves-intro-sequence'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getYoutubePlayerConstructor, getYoutubePlayerState, loadYoutubeIframeApi } from '@/composables/useYoutubeIframeApi'
import { activeOverlayText, advanceIntroSequence, createIntroSequenceState, skipIntroSequence } from '@/data/wolves-intro-sequence'

const props = defineProps<{
  videos: readonly IntroVideoSpec[]
}>()

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const sequenceState = ref(createIntroSequenceState())
const currentTime = ref(0)
const mountHost = ref<HTMLDivElement | null>(null)

const currentVideo = computed<IntroVideoSpec | undefined>(() => props.videos[sequenceState.value.index])
const overlayText = computed(() => activeOverlayText(currentVideo.value?.overlays, currentTime.value))

let player: YoutubePlayer | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let loadToken = 0

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function destroyPlayer() {
  stopPolling()
  player?.destroy?.()
  player = null
}

function advance() {
  sequenceState.value = advanceIntroSequence(sequenceState.value, props.videos.length)
}

async function loadCurrentVideo(video: IntroVideoSpec | undefined) {
  const token = ++loadToken
  currentTime.value = 0
  destroyPlayer()

  if (!video) {
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
    videoId: video.youtubeVideoId,
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

watch(() => sequenceState.value.done, (done) => {
  if (done) {
    destroyPlayer()
    emit('complete')
  }
})

watch(currentVideo, (video) => {
  void loadCurrentVideo(video)
}, { immediate: true })

function handleSkip() {
  sequenceState.value = skipIntroSequence(sequenceState.value)
}

onBeforeUnmount(() => {
  destroyPlayer()
})
</script>

<template>
  <div v-if="currentVideo && !sequenceState.done" class="wolves-intro-overlay">
    <div ref="mountHost" class="wolves-intro-overlay-player" />

    <p v-if="overlayText" class="wolves-intro-overlay-text font-mono">
      {{ overlayText }}
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
