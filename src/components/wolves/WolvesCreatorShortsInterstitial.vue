<!--
  Creator Shorts interstitial: a fullscreen, one-time bridge inside the immersive theater between
  Track 0 ("7 Days to the Wolves") and Track 1 ("Ghosts In The Mist"). Plays Cassidy Williams's and
  Lindsay Nikole's real Shorts side by side, ping-ponging which side is active, and emits
  `complete` when both creators' lists are exhausted so the parent can resume the soundtrack.
  Teleported to <body> per docs/skills/wolves-fullscreen-overlays.md — several immersive-layout
  ancestors use `transform`, which would otherwise confine a `position: fixed` overlay to its own
  widget instead of the real viewport.

  Ping-pong mechanics: each side (left = Cassidy, right = Lindsay) gets its own persistent
  YT.Player, created once and never destroyed/recreated mid-sequence. Cassidy's player starts
  active (autoplay); Lindsay's starts cued (loaded, silent, paused) on her first video so the very
  first swap is instant. When the active side's video ends (or errors), the *other* side -- already
  cued -- takes over immediately (`playVideo`), while the side that just finished quietly preloads
  its own next video in the background (`cueVideoById`) for its next turn. If one creator's list
  runs out first, the other continues solo (`loadVideoById`, autoplay) until it also finishes.
-->
<script setup lang="ts">
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { getYoutubePlayerConstructor, getYoutubePlayerState, loadYoutubeIframeApi } from '@/composables/useYoutubeIframeApi'
import { wolvesCreatorShortsCassidyWilliams, wolvesCreatorShortsLindsayNikole } from '@/data/wolves-creator-shorts'

type Side = 'left' | 'right'

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const lists = {
  left: wolvesCreatorShortsCassidyWilliams,
  right: wolvesCreatorShortsLindsayNikole,
} as const

/** Index of the video currently loaded (playing or silently cued) into each side's player. */
const displayedIndex = reactive<Record<Side, number>>({ left: 0, right: 0 })
const exhausted = reactive<Record<Side, boolean>>({ left: false, right: false })
const activeSide = ref<Side>('left')
const isPaused = ref(false)

const leftMountHost = ref<HTMLDivElement | null>(null)
const rightMountHost = ref<HTMLDivElement | null>(null)

const players: Record<Side, YoutubePlayer | undefined> = { left: undefined, right: undefined }

const leftShort = computed(() => lists.left[Math.min(displayedIndex.left, lists.left.length - 1)])
const rightShort = computed(() => lists.right[Math.min(displayedIndex.right, lists.right.length - 1)])

const now = new Date()
/**
 * The current month's night wallpaper, same source used by the rest of the immersive
 * presentation (`WolvesApp.vue`'s wallpaper crossfade, the soundtrack widget's control panel),
 * applied here as the interstitial's full-screen backdrop and reused on the small controls bar
 * for visual continuity, per explicit user request to match "the rest of the presentation."
 */
const wallpaperUrl = computed(() => {
  const monthStr = String(now.getMonth() + 1).padStart(2, '0')
  return `url('${import.meta.env.BASE_URL}img/wallpapers/bluefin-${monthStr}-night.webp')`
})

function otherSideOf(side: Side): Side {
  return side === 'left' ? 'right' : 'left'
}

/**
 * A preloaded (inactive, silently cued) video failed before it ever got a turn to play -- skip
 * just that one broken entry for its own side, without touching which side is active.
 */
function skipBrokenPreload(side: Side) {
  displayedIndex[side] += 1
  if (displayedIndex[side] >= lists[side].length) {
    exhausted[side] = true
    return
  }
  players[side]?.cueVideoById?.(lists[side][displayedIndex[side]].videoId)
}

function advanceTurn(finishedSide: Side) {
  displayedIndex[finishedSide] += 1
  if (displayedIndex[finishedSide] >= lists[finishedSide].length) {
    exhausted[finishedSide] = true
  }

  const otherSide = otherSideOf(finishedSide)

  if (!exhausted[otherSide]) {
    // The other side is already cued and ready -- flash-cut to it right away.
    activeSide.value = otherSide
    isPaused.value = false
    players[otherSide]?.playVideo?.()

    if (!exhausted[finishedSide]) {
      // Quietly preload this side's next video for its next turn.
      players[finishedSide]?.cueVideoById?.(lists[finishedSide][displayedIndex[finishedSide]].videoId)
    }
    return
  }

  if (!exhausted[finishedSide]) {
    // The other side has run out: this side continues solo.
    activeSide.value = finishedSide
    isPaused.value = false
    players[finishedSide]?.loadVideoById?.(lists[finishedSide][displayedIndex[finishedSide]].videoId)
    return
  }

  // Both sides are out of videos.
  destroyPlayers()
  emit('complete')
}

function destroyPlayers() {
  players.left?.destroy?.()
  players.right?.destroy?.()
  players.left = undefined
  players.right = undefined
}

function createPlayer(host: HTMLDivElement, side: Side, autoplay: boolean): YoutubePlayer | undefined {
  const PlayerCtor = getYoutubePlayerConstructor()
  if (!PlayerCtor) {
    return undefined
  }

  const mountNode = document.createElement('div')
  host.replaceChildren(mountNode)

  return new PlayerCtor(mountNode, {
    width: '100%',
    height: '100%',
    videoId: lists[side][0].videoId,
    playerVars: {
      autoplay: autoplay ? 1 : 0,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
    },
    events: {
      onStateChange: (event: { data: number }) => {
        // The inactive (silently cued) side is never actually playing, so a real ENDED event
        // can only legitimately come from the currently active side.
        if (event.data === getYoutubePlayerState().ENDED && side === activeSide.value) {
          advanceTurn(side)
        }
      },
      onError: () => {
        // A missing/restricted short must never block the ping-pong or the return to the live
        // soundtrack. An error on the active side ends its turn like normal; an error on the
        // still-inactive, preloaded side just skips that one broken entry without swapping.
        if (side === activeSide.value) {
          advanceTurn(side)
        }
        else {
          skipBrokenPreload(side)
        }
      },
    },
  })
}

async function init() {
  try {
    await loadYoutubeIframeApi()
  }
  catch {
    // The IFrame API failed to load entirely -- never block the return to the live soundtrack.
    emit('complete')
    return
  }

  if (!leftMountHost.value || !rightMountHost.value) {
    return
  }

  players.left = createPlayer(leftMountHost.value, 'left', true)
  players.right = createPlayer(rightMountHost.value, 'right', false)
}

init()

function togglePause() {
  const player = players[activeSide.value]
  if (isPaused.value) {
    player?.playVideo?.()
  }
  else {
    player?.pauseVideo?.()
  }
  isPaused.value = !isPaused.value
}

function skip() {
  advanceTurn(activeSide.value)
}

onBeforeUnmount(() => {
  destroyPlayers()
})
</script>

<template>
  <Teleport to="body">
    <div class="wolves-creator-shorts-interstitial" :style="{ backgroundImage: wallpaperUrl }">
      <div class="wolves-creator-shorts-backdrop-scrim" aria-hidden="true" />
      <div class="wolves-creator-shorts-stage">
        <div class="wolves-creator-shorts-slot" :class="{ 'is-active': activeSide === 'left' }">
          <div ref="leftMountHost" class="wolves-creator-shorts-player" />
          <p class="wolves-creator-shorts-caption font-mono">
            <span class="wolves-creator-shorts-title">{{ leftShort.title }}</span>
            <a :href="leftShort.channelUrl" target="_blank" rel="noopener noreferrer" class="wolves-creator-shorts-creator">{{ leftShort.creatorName }}</a>
          </p>
        </div>
        <div class="wolves-creator-shorts-slot" :class="{ 'is-active': activeSide === 'right' }">
          <div ref="rightMountHost" class="wolves-creator-shorts-player" />
          <p class="wolves-creator-shorts-caption font-mono">
            <span class="wolves-creator-shorts-title">{{ rightShort.title }}</span>
            <a :href="rightShort.channelUrl" target="_blank" rel="noopener noreferrer" class="wolves-creator-shorts-creator">{{ rightShort.creatorName }}</a>
          </p>
        </div>
      </div>

      <div class="wolves-creator-shorts-controls" :style="{ backgroundImage: wallpaperUrl }">
        <div class="wolves-creator-shorts-controls-overlay">
          <button
            type="button"
            class="soundtrack-icon-btn play-pause"
            :aria-label="isPaused ? 'Resume video' : 'Pause video'"
            @click="togglePause"
          >
            <svg v-if="!isPaused" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            <svg v-else class="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </button>
          <button
            type="button"
            class="soundtrack-icon-btn next"
            aria-label="Skip video"
            @click="skip"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 6h2v12h-2zm-1 6-9 6V6z" /></svg>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.wolves-creator-shorts-interstitial {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background-color: #000;
  background-size: cover;
  background-position: center;
  overflow: hidden;
  padding: 16px;
}

/* Darkens the full-screen Bluefin wallpaper backdrop so the two video slots and captions stay
   legible on top of it, matching the scrim already used behind the controls bar. */
.wolves-creator-shorts-backdrop-scrim {
  position: absolute;
  inset: 0;
  background: rgba(6, 10, 18, 0.72);
  z-index: 0;
}

.wolves-creator-shorts-stage {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: row;
  gap: 16px;
  align-items: flex-start;
  justify-content: center;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.wolves-creator-shorts-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: min(44vw, 340px);
  opacity: 0.55;
  transition: opacity 0.2s ease;

  &.is-active {
    opacity: 1;
  }
}

.wolves-creator-shorts-player {
  width: 100%;
  aspect-ratio: 9 / 16;
  background: #000;
}

.wolves-creator-shorts-caption {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
  color: #bdbdbd;
  font-size: 0.85rem;
}

.wolves-creator-shorts-title {
  color: #ffffff;
}

.wolves-creator-shorts-creator {
  color: var(--color-blue);
  text-decoration: underline;
}

.wolves-creator-shorts-controls {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 640px;
  border-radius: 16px;
  background-size: cover;
  background-position: center;
  overflow: hidden;
  flex-shrink: 0;
}

.wolves-creator-shorts-controls-overlay {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px;
  background: rgba(6, 10, 18, 0.72);
  backdrop-filter: blur(4px);
}

/* Reuses the soundtrack widget's icon-button look for visual consistency. */
.soundtrack-icon-btn {
  border-radius: 999px;
  border: 1px solid rgba(66, 133, 244, 0.45);
  background-color: #10151f;
  color: #66b3ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  cursor: pointer;
  width: 40px;
  height: 40px;

  &:hover {
    background-color: rgba(66, 133, 244, 0.15);
    border-color: #7dd3fc;
    color: #ffffff;
    transform: translateY(-1px);
  }

  &.play-pause {
    width: 48px;
    height: 48px;
    background: rgba(66, 133, 244, 0.1);
    border-color: rgba(102, 179, 255, 0.55);
    color: #e0f2fe;
  }
}
</style>
