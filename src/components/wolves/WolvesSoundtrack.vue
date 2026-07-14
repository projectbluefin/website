<script setup lang="ts">
import type { SoundtrackSource, SoundtrackTrack, WolvesSoundtrackManifest } from '@/data/wolves-soundtrack'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { loadWolvesSoundtrack } from '@/data/wolves-soundtrack'

const props = defineProps<{
  playing?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:playing', playing: boolean): void
  (e: 'progress', data: { currentTime: number, duration: number, playlistIndex: number }): void
}>()

type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'

interface YouTubePlayer {
  playVideo?: () => void
  pauseVideo?: () => void
  playVideoAt?: (index: number) => void
  getPlaylistIndex?: () => number
  getCurrentTime?: () => number
  getDuration?: () => number
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void
  destroy?: () => void
  nextVideo?: () => void
  previousVideo?: () => void
}

interface YouTubeWindow extends Window {
  YT?: {
    Player?: new (element: Element, options: Record<string, unknown>) => YouTubePlayer
    PlayerState?: {
      ENDED: number
      PLAYING: number
      PAUSED: number
      BUFFERING: number
      CUED: number
    }
  }
  onYouTubeIframeAPIReady?: (() => void) | null
  __WOLVES_PLAYER__?: YouTubePlayer | null
  __WOLVES_PLAYER_MOUNT__?: HTMLDivElement | null
  __WOLVES_PROXY_EVENTS__?: Record<string, (...args: any[]) => void>
}

const iframeApiSrc = 'https://www.youtube.com/iframe_api'
const wolvesPlayerActiveClass = 'wolves-player-active'

const fallbackSource: SoundtrackSource = {
  provider: 'youtube',
  playlistId: 'PLA78oiE-RGAE',
  playlistUrl: 'https://www.youtube.com/playlist?list=PLA78oiE-RGAE',
  musicUrl: 'https://music.youtube.com/playlist?list=PLA78oiE-RGAE',
  spotifyUri: null,
}

const fallbackTrack: SoundtrackTrack = {
  id: 'LASru9j0oIc',
  title: '7 Days to the Wolves',
  artist: 'Nightwish',
  artwork: 'wolves-artwork/LASru9j0oIc.jpg',
  youtubeVideoId: 'LASru9j0oIc',
}

const officialLyricsUrls: Readonly<Record<string, string>> = {
  LASru9j0oIc: 'https://www.nightwish.com/songs/7-days-to-the-wolves',
  rYkYLIYvI18: 'https://www.nightwish.com/songs/last-ride-of-the-day',
}

const status = ref<PlayerStatus>('idle')
const manifest = ref<WolvesSoundtrackManifest | null>(null)
const currentTrackIndex = ref(0)
const playerHost = ref<HTMLElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)

const formattedCurrentTime = computed(() => formatTime(currentTime.value))
const formattedDuration = computed(() => formatTime(duration.value))
const progressPercent = computed(() => {
  if (duration.value === 0) {
    return 0
  }
  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})

function formatTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) {
    return '0:00'
  }
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

let player: YouTubePlayer | null = null
let playerMount: HTMLDivElement | null = null
let youtubeApiPromise: Promise<void> | null = null
let shouldAutoplayOnReady = false
let progressTimer: ReturnType<typeof setInterval> | null = null

function startProgressTimer() {
  if (progressTimer) {
    return
  }
  progressTimer = setInterval(() => {
    if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
      const current = player.getCurrentTime()
      const total = player.getDuration()
      const playlistIndex = typeof player.getPlaylistIndex === 'function' ? player.getPlaylistIndex() : currentTrackIndex.value

      if (typeof current === 'number' && typeof total === 'number' && total > 0) {
        currentTime.value = current
        duration.value = total
        emit('progress', { currentTime: current, duration: total, playlistIndex })
      }
    }
  }, 100)
}

function stopProgressTimer() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

const currentSource = computed(() => manifest.value?.source ?? fallbackSource)
const currentTrack = computed(() => manifest.value?.tracks[currentTrackIndex.value] ?? fallbackTrack)
const isStarted = computed(() => status.value !== 'idle')
const isPlaying = computed(() => status.value === 'playing')
const canSkipTracks = computed(() =>
  (status.value === 'ready' || status.value === 'playing' || status.value === 'paused')
  && player !== null
  && manifest.value !== null,
)
const canGoToPreviousTrack = computed(() => canSkipTracks.value && currentTrackIndex.value > 0)
const canGoToNextTrack = computed(() =>
  canSkipTracks.value && currentTrackIndex.value < (manifest.value?.tracks.length ?? 0) - 1,
)
const artworkUrl = computed(() => `${import.meta.env.BASE_URL}${currentTrack.value.artwork}`)
const currentLyricsUrl = computed(() => officialLyricsUrls[currentTrack.value.youtubeVideoId])

const actionAriaLabel = computed(() => {
  switch (status.value) {
    case 'playing':
      return 'Pause soundtrack'
    case 'ready':
    case 'paused':
      return 'Resume soundtrack'
    default:
      return 'Start soundtrack'
  }
})

const statusCopy = computed(() => {
  switch (status.value) {
    case 'loading':
      return 'Loading local playlist metadata and the YouTube player.'
    case 'playing':
      return 'Open Source is about supporting maintainers.'
    case 'ready':
    case 'paused':
      return 'Playback is ready. Resume when you want the soundtrack back.'
    case 'error':
      return 'Playback could not initialize here. The playlist and music links still work below.'
    default:
      return 'Starts only after you click. No autoplay, no hidden soundtrack boot.'
  }
})

function syncRootPlayerClass(started: boolean) {
  if (typeof document === 'undefined') {
    return
  }

  document.body.classList.toggle(wolvesPlayerActiveClass, started)
}

function syncTrackIndex(playerTarget: YouTubePlayer | null | undefined) {
  const nextIndex = playerTarget?.getPlaylistIndex?.()
  if (typeof nextIndex !== 'number' || !Number.isInteger(nextIndex)) {
    return
  }

  const availableTracks = manifest.value?.tracks.length ?? 0
  if (!availableTracks) {
    currentTrackIndex.value = 0
    return
  }

  const boundedIndex = Math.max(0, Math.min(nextIndex, availableTracks - 1))
  currentTrackIndex.value = boundedIndex
}

function getPlayerState() {
  return (window as YouTubeWindow).YT?.PlayerState ?? {
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
  }
}

async function ensureManifestLoaded() {
  if (manifest.value) {
    return manifest.value
  }

  const loadedManifest = await loadWolvesSoundtrack()
  manifest.value = loadedManifest
  currentTrackIndex.value = 0
  return loadedManifest
}

function ensureYouTubeIframeApi(): Promise<void> {
  const youtubeWindow = window as YouTubeWindow

  if (youtubeWindow.YT?.Player) {
    return Promise.resolve()
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise
  }

  youtubeApiPromise = new Promise((resolve, reject) => {
    let settled = false
    let script = document.querySelector(`script[src="${iframeApiSrc}"]`) as HTMLScriptElement | null

    const finish = (callback: () => void) => {
      if (settled) {
        return
      }

      settled = true
      callback()
    }

    const handleError = () => {
      youtubeApiPromise = null
      script?.remove()
      finish(() => reject(new Error('YouTube IFrame API failed to load')))
    }

    const previousReady = youtubeWindow.onYouTubeIframeAPIReady
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      finish(resolve)
    }

    if (!script) {
      script = document.createElement('script')
      script.src = iframeApiSrc
      script.async = true
      script.addEventListener('error', handleError)
      document.head.appendChild(script)
      return
    }

    script.addEventListener('error', handleError)
  })

  return youtubeApiPromise
}

function createPlayer() {
  if (player || !playerHost.value) {
    return
  }

  const youtubeWindow = window as YouTubeWindow
  const source = currentSource.value

  if (!youtubeWindow.YT?.Player) {
    throw new Error('YouTube player constructor unavailable')
  }

  if (!playerMount?.isConnected) {
    playerHost.value.replaceChildren()
    playerMount = document.createElement('div')
    playerMount.className = 'wolves-player-mount'
    playerHost.value.appendChild(playerMount)
  }

  player = new youtubeWindow.YT.Player(playerMount, {
    width: 200,
    height: 200,
    playerVars: {
      listType: 'playlist',
      list: source.playlistId,
      autoplay: 0,
      playsinline: 1,
      rel: 0,
    },
    events: {
      onReady: (event: { target: YouTubePlayer }) => {
        syncTrackIndex(event.target)
        status.value = 'ready'

        if (shouldAutoplayOnReady) {
          shouldAutoplayOnReady = false
          event.target.playVideo?.()
        }
      },
      onStateChange: (event: { data: number, target: YouTubePlayer }) => {
        syncTrackIndex(event.target)
        const playerState = getPlayerState()

        if (event.data === playerState.PLAYING) {
          status.value = 'playing'
          return
        }

        if (event.data === playerState.PAUSED || event.data === playerState.ENDED || event.data === playerState.CUED) {
          status.value = 'paused'
          return
        }

        if (status.value === 'loading') {
          status.value = 'ready'
        }
      },
      onPlaylistItem: (event: { target: YouTubePlayer }) => {
        syncTrackIndex(event.target)
      },
      onError: () => {
        status.value = 'error'
      },
    },
  })
}

function resetFailedPlayer() {
  player?.destroy?.()
  player = null
  playerMount = null
  playerHost.value?.replaceChildren()
}

async function startSoundtrack() {
  if (status.value === 'loading') {
    return
  }

  if (status.value === 'error') {
    resetFailedPlayer()
  }

  status.value = 'loading'
  shouldAutoplayOnReady = true

  try {
    await ensureManifestLoaded()
    await ensureYouTubeIframeApi()
    await nextTick()
    createPlayer()
  }
  catch {
    shouldAutoplayOnReady = false
    status.value = 'error'
  }
}

function resumePlayback() {
  player?.playVideo?.()
}

function pausePlayback() {
  player?.pauseVideo?.()
}

function handlePrimaryAction() {
  if (status.value === 'idle' || status.value === 'error') {
    void startSoundtrack()
    return
  }

  if (isPlaying.value) {
    pausePlayback()
    return
  }

  resumePlayback()
}

function handlePreviousTrack() {
  if (!canGoToPreviousTrack.value) {
    return
  }
  player?.previousVideo?.()
}

function handleNextTrack() {
  if (!canGoToNextTrack.value) {
    return
  }
  player?.nextVideo?.()
}

function handleMaintainerCta() {
  window.open('https://donate.gnome.org/', '_blank', 'noopener,noreferrer')
  window.open('https://www.cncf.io/join/', '_blank', 'noopener,noreferrer')
}

watch(isStarted, syncRootPlayerClass, { immediate: true })

watch(status, (newStatus) => {
  emit('update:playing', newStatus === 'playing')
  if (newStatus === 'playing') {
    startProgressTimer()
  }
  else {
    stopProgressTimer()
  }
})

function handleSeek(event: MouseEvent) {
  if (status.value === 'idle' || status.value === 'loading' || status.value === 'error') {
    return
  }
  if (!player || duration.value <= 0) {
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const percentage = Math.min(1, Math.max(0, clickX / rect.width))
  const targetTime = percentage * duration.value

  if (typeof player.seekTo === 'function') {
    player.seekTo(targetTime, true)
    currentTime.value = targetTime
    emit('progress', {
      currentTime: targetTime,
      duration: duration.value,
      playlistIndex: currentTrackIndex.value,
    })
  }
}

watch(() => props.playing, (newPlaying) => {
  if (newPlaying && status.value !== 'playing') {
    if (status.value === 'idle' || status.value === 'error') {
      void startSoundtrack()
    }
    else {
      resumePlayback()
    }
  }
  else if (!newPlaying && status.value === 'playing') {
    pausePlayback()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  stopProgressTimer()
  syncRootPlayerClass(false)
  // Deliberately skipping player?.destroy() so the iframe survives Vite HMR during development.
})
</script>

<template>
  <div class="sidebar-soundtrack-card wolves-soundtrack-card">
    <section class="soundtrack-panel" :class="{ 'is-started': isStarted, 'has-error': status === 'error' }">
      <div class="soundtrack-panel-main">
        <div class="soundtrack-artwork-shell" :class="{ 'is-playing': isPlaying }">
          <img
            :src="artworkUrl"
            :alt="`${currentTrack.title} artwork`"
            class="soundtrack-artwork"
          >
        </div>

        <div class="soundtrack-copy">
          <span class="soundtrack-label font-mono">MUSIC TO HUNT BY</span>
          <h2 class="soundtrack-title">
            {{ currentTrack.title }}
          </h2>
          <p class="soundtrack-artist font-mono">
            {{ currentTrack.artist }}
          </p>

          <!-- Desktop Progress Bar -->
          <div class="soundtrack-progress-container">
            <span class="soundtrack-time font-mono">{{ formattedCurrentTime }}</span>
            <div
              class="soundtrack-progress-bar group"
              @click="handleSeek"
            >
              <div class="soundtrack-progress-fill group-hover:bg-[#7dd3fc]" :style="{ width: `${progressPercent}%` }" />
            </div>
            <span class="soundtrack-time font-mono">{{ formattedDuration }}</span>
          </div>
        </div>

        <!-- Sleeker Controls -->
        <div class="soundtrack-controls-group">
          <button
            type="button"
            class="soundtrack-icon-btn prev"
            aria-label="Previous track"
            :disabled="!canGoToPreviousTrack"
            @click="handlePreviousTrack"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 6h2v12H6zm3 6 9 6V6z" /></svg>
          </button>
          <button
            type="button"
            class="soundtrack-icon-btn play-pause soundtrack-action"
            :aria-label="actionAriaLabel"
            :disabled="status === 'loading'"
            @click="handlePrimaryAction"
          >
            <svg v-if="isPlaying" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            <svg v-else class="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </button>
          <button
            type="button"
            class="soundtrack-icon-btn next"
            aria-label="Next track"
            :disabled="!canGoToNextTrack"
            @click="handleNextTrack"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 6h2v12h-2zm-1 6-9 6V6z" /></svg>
          </button>
        </div>
      </div>

      <!-- Status and Links below main track info -->
      <div class="soundtrack-status-panel">
        <p class="soundtrack-status soundtrack-cta">
          {{ statusCopy }}
        </p>
        <button
          v-if="status === 'playing'"
          type="button"
          class="soundtrack-maintainer-cta"
          @click="handleMaintainerCta"
        >
          Prove It
        </button>

        <div class="soundtrack-links">
          <a
            :href="currentSource.playlistUrl"
            aria-label="Open soundtrack playlist on YouTube"
            target="_blank"
            rel="noopener noreferrer"
            class="soundtrack-link soundtrack-source-action"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
            Playlist
          </a>
          <a
            :href="currentSource.musicUrl"
            aria-label="Open soundtrack in YouTube Music"
            target="_blank"
            rel="noopener noreferrer"
            class="soundtrack-link soundtrack-source-action"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 18V5l11-2v13a3 3 0 1 1-2-2.83V7.04l-7 1.27V16a3 3 0 1 1-2-2.83V18z" />
            </svg>
            Music
          </a>
          <span class="soundtrack-premium-note font-mono">
            Ad-free playback requires YouTube Premium
          </span>
        </div>
      </div>

      <div class="soundtrack-lyrics-panel">
        <span class="soundtrack-lyrics-label font-mono">OFFICIAL LYRICS</span>
        <template v-if="currentLyricsUrl">
          <p class="soundtrack-lyrics-copy">
            Read <strong>{{ currentTrack.title }}</strong> on the artist's official site.
          </p>
          <a
            :href="currentLyricsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="soundtrack-link soundtrack-lyrics-link"
            data-testid="official-lyrics-link"
          >
            Read official lyrics
          </a>
        </template>
        <p v-else class="soundtrack-lyrics-copy">
          Official lyrics unavailable for this track.
        </p>
      </div>

      <div
        class="wolves-player-host-shell"
        aria-hidden="true"
        style="overflow: hidden;"
      >
        <div
          ref="playerHost"
          data-testid="wolves-player-host"
          class="wolves-player-host"
        />
      </div>
    </section>

    <!-- Removed -->

    <!-- Controls moved to Lore Column -->

    <div
      v-if="isStarted"
      class="soundtrack-mobile-bar"
      :class="{ 'is-playing': isPlaying }"
    >
      <!-- Mobile Progress Indicator pinned to top -->
      <div class="soundtrack-mobile-progress-wrap" @click="handleSeek">
        <div class="soundtrack-progress-fill" :style="{ width: `${progressPercent}%` }" />
      </div>

      <img
        :src="artworkUrl"
        :alt="`${currentTrack.title} artwork`"
        class="soundtrack-mobile-artwork"
      >
      <div class="soundtrack-mobile-copy">
        <span class="soundtrack-mobile-title">{{ currentTrack.title }}</span>
        <span class="soundtrack-mobile-artist font-mono">{{ currentTrack.artist }}</span>
      </div>

      <div class="soundtrack-controls-group">
        <button
          type="button"
          class="soundtrack-icon-btn prev"
          aria-label="Previous track"
          :disabled="!canGoToPreviousTrack"
          @click="handlePreviousTrack"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 6h2v12H6zm3 6 9 6V6z" /></svg>
        </button>
        <button
          type="button"
          class="soundtrack-icon-btn mobile-play-pause"
          :aria-label="actionAriaLabel"
          :disabled="status === 'loading'"
          @click="handlePrimaryAction"
        >
          <svg v-if="isPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          <svg v-else class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <button
          type="button"
          class="soundtrack-icon-btn next"
          aria-label="Next track"
          :disabled="!canGoToNextTrack"
          @click="handleNextTrack"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 6h2v12h-2zm-1 6-9 6V6z" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wolves-soundtrack-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.soundtrack-panel {
  background: linear-gradient(180deg, rgba(16, 21, 31, 0.98), rgba(9, 13, 22, 0.98));
  border: 1px solid rgba(66, 133, 244, 0.22);
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  overflow: hidden;

  &.is-started {
    border-color: rgba(102, 179, 255, 0.4);
  }

  &.has-error {
    border-color: rgba(248, 113, 113, 0.45);
  }
}

/* Update the grid to be simpler */
.soundtrack-panel-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 18px;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: center;
    text-align: left;
  }
}

.soundtrack-artwork-shell {
  width: 76px;
  height: 76px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: #090d16;
  box-shadow: 0 0 0 rgba(56, 189, 248, 0);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;

  &.is-playing {
    transform: translateY(-1px);
    box-shadow: 0 0 24px rgba(56, 189, 248, 0.22);
  }
}

.soundtrack-artwork,
.soundtrack-mobile-artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.soundtrack-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;

  @media (min-width: 640px) {
    width: auto;
    flex: 1;
  }
}

.soundtrack-label,
.soundtrack-artist,
.soundtrack-status,
.soundtrack-premium-note,
.soundtrack-mobile-artist {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.soundtrack-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #66b3ff;
}

.soundtrack-title {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.2;
  color: #f8fafc;
}

.soundtrack-artist {
  margin: 0;
  font-size: 0.82rem;
  color: #cbd5e1;
}

/* Status Panel */
.soundtrack-status-panel {
  padding: 12px 18px;
  border-top: 1px solid rgba(66, 133, 244, 0.2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.soundtrack-status {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: #94a3b8;
}

.soundtrack-cta {
  color: #f8fafc;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.45;
}

.soundtrack-maintainer-cta {
  align-self: flex-start;
  padding: 0.7rem 1.1rem;
  border: 1px solid #fb923c;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #f97316, #ea580c);
  box-shadow: 0 0.5rem 1.5rem rgba(234, 88, 12, 0.3);
  color: #fff7ed;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover,
  &:focus-visible {
    box-shadow: 0 0.7rem 1.8rem rgba(234, 88, 12, 0.45);
    transform: translateY(-1px);
  }
}

.soundtrack-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: center;
}

.soundtrack-link {
  color: #7dd3fc;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    color: #bae6fd;
  }
}

.soundtrack-source-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid rgba(125, 211, 252, 0.5);
  border-radius: 999px;
  background: rgba(14, 116, 144, 0.16);
  color: #e0f2fe;
  font-size: 0.78rem;

  svg {
    width: 1rem;
    height: 1rem;
  }

  &:hover {
    border-color: #7dd3fc;
    background: rgba(14, 116, 144, 0.3);
  }
}

.soundtrack-premium-note {
  font-size: 0.7rem;
  color: #94a3b8;
}

.soundtrack-lyrics-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  border-top: 1px solid rgba(66, 133, 244, 0.22);
  background: rgba(5, 8, 16, 0.68);
}

.soundtrack-lyrics-label {
  color: #66b3ff;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.soundtrack-lyrics-copy {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.5;
}

.soundtrack-lyrics-link {
  align-self: flex-start;
}

.wolves-player-host-shell {
  position: absolute;
  width: 200px;
  height: 200px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.wolves-player-host {
  width: 200px;
  height: 200px;

  > * {
    width: 200px;
    height: 200px;
    border: 0;
  }
}

/* New Icon Buttons */
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

  &:hover:not(:disabled) {
    background-color: rgba(66, 133, 244, 0.15);
    border-color: #7dd3fc;
    color: #ffffff;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.prev,
  &.next {
    width: 40px;
    height: 40px;
  }

  &.play-pause {
    width: 48px;
    height: 48px;
    background: rgba(66, 133, 244, 0.1);
    border-color: rgba(102, 179, 255, 0.55);
    color: #e0f2fe;

    svg {
      width: 1.5rem;
      height: 1.5rem;
      flex-shrink: 0;
    }

    &:hover:not(:disabled) {
      background: rgba(66, 133, 244, 0.2);
      border-color: rgba(125, 211, 252, 0.8);
    }
  }

  &.mobile-play-pause {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    background: rgba(66, 133, 244, 0.1);
    border-color: rgba(102, 179, 255, 0.55);
    color: #e0f2fe;
  }
}

/* Progress Bar Desktop */
.soundtrack-progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.soundtrack-time {
  font-size: 10px;
  color: #94a3b8;
  width: 32px;
  text-align: center;
}

.soundtrack-progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
}

.soundtrack-progress-fill {
  height: 100%;
  background: #66b3ff;
  transition:
    width 0.1s linear,
    background-color 0.2s ease;
}

/* Mobile Top Edge Progress Bar */
.soundtrack-mobile-progress-wrap {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px 16px 0 0;
  overflow: hidden;
  cursor: pointer;
}

/* Lore Navigation container */
.lore-nav-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.soundtrack-mobile-bar {
  display: none;
  align-items: center;
  gap: 12px;
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  border: 1px solid rgba(102, 179, 255, 0.28);
  border-radius: 16px 16px 0 0;
  background: rgba(9, 13, 22, 0.96);
  box-shadow: 0 -10px 24px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);

  &.is-playing {
    border-color: rgba(125, 211, 252, 0.5);
  }

  @media (max-width: 767px) {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 0;
    display: flex;
    z-index: 30;
  }
}

.soundtrack-mobile-artwork {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  flex-shrink: 0;
}

.soundtrack-mobile-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.soundtrack-mobile-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: #f8fafc;
  overflow-wrap: anywhere;
}

.soundtrack-mobile-artist {
  font-size: 0.72rem;
  color: #94a3b8;
  overflow-wrap: anywhere;
}

.soundtrack-controls-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.quote-nav-btn {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(66, 133, 244, 0.45);
  background-color: #10151f;
  color: #66b3ff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(66, 133, 244, 0.15);
    border-color: #7dd3fc;
    color: #ffffff;
  }
}

.quote-nav-btn.share-btn {
  width: auto;
  min-width: 68px;
  padding: 0 12px;
  font-size: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-weight: bold;
}

.soundtrack-comic-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(16, 21, 31, 0.95);
  border: 1px solid rgba(66, 133, 244, 0.22);
  border-radius: 12px;
  padding: 8px 12px;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);

  .comic-ctrl-btn {
    background: rgba(66, 133, 244, 0.08);
    border: 1px solid rgba(102, 179, 255, 0.35);
    color: #e0f2fe;
    font-size: 1.1rem;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(66, 133, 244, 0.18);
      border-color: rgba(125, 211, 252, 0.8);
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  }

  .comic-page-counter {
    font-size: 1.1rem;
    color: #bdbdbd;
    font-weight: 500;
  }

  .comic-jump-select-wrap {
    select {
      background-color: #10151f;
      border: 1px solid #272727;
      color: #ffffff;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 1.1rem;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: var(--color-blue);
      }
    }
  }
}
</style>
