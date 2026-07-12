<script setup lang="ts">
import type { SoundtrackSource, SoundtrackTrack, WolvesSoundtrackManifest } from '@/data/wolves-soundtrack'
import type { WolvesChapter } from '@/data/wolves-story'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { loadWolvesSoundtrack } from '@/data/wolves-soundtrack'

const props = defineProps<{
  chapter?: WolvesChapter
  playing?: boolean
  loreCopied?: boolean
  page?: number
  totalPages?: number
}>()

const emit = defineEmits<{
  (e: 'update:playing', playing: boolean): void
  (e: 'trackChange', index: number): void
  (e: 'prevLore'): void
  (e: 'nextLore'): void
  (e: 'shareLore'): void
  (e: 'progress', data: { currentTime: number, duration: number, playlistIndex: number }): void
  (e: 'update:page', page: number): void
}>()

type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'

interface YouTubePlayer {
  playVideo?: () => void
  pauseVideo?: () => void
  playVideoAt?: (index: number) => void
  getPlaylistIndex?: () => number
  getCurrentTime?: () => number
  getDuration?: () => number
  destroy?: () => void
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
      const currentTime = player.getCurrentTime()
      const duration = player.getDuration()
      const playlistIndex = typeof player.getPlaylistIndex === 'function' ? player.getPlaylistIndex() : currentTrackIndex.value
      if (typeof currentTime === 'number' && typeof duration === 'number' && duration > 0) {
        emit('progress', { currentTime, duration, playlistIndex })
      }
    }
  }, 1000)
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
const artworkUrl = computed(() => `${import.meta.env.BASE_URL}${currentTrack.value.artwork}`)
const currentLyricsUrl = computed(() => officialLyricsUrls[currentTrack.value.youtubeVideoId])

const actionLabel = computed(() => {
  switch (status.value) {
    case 'loading':
      return 'Loading Soundtrack'
    case 'playing':
      return 'Pause'
    case 'ready':
    case 'paused':
      return 'Resume'
    case 'error':
      return 'Retry Soundtrack'
    default:
      return 'Start Soundtrack'
  }
})

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
      return 'Persistent soundtrack playback is active for this session.'
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

watch(currentTrackIndex, (newIndex) => {
  emit('trackChange', newIndex)
})

// props.chapter changes do not drive soundtrack playback to prevent track restarts during reading
watch(() => props.chapter, () => {})

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
  player?.destroy?.()
  player = null
  playerMount = null
})

function setPage(n: number) {
  if (props.totalPages && n >= 1 && n <= props.totalPages) {
    emit('update:page', n)
  }
}
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
          <span class="soundtrack-label font-mono">RELEASE SOUNDTRACK TO HUNT BY</span>
          <h2 class="soundtrack-title">
            {{ currentTrack.title }}
          </h2>
          <p class="soundtrack-artist font-mono">
            {{ currentTrack.artist }}
          </p>
          <p class="soundtrack-status font-mono">
            {{ statusCopy }}
          </p>

          <div class="soundtrack-links">
            <a
              :href="currentSource.playlistUrl"
              aria-label="Open soundtrack playlist on YouTube"
              target="_blank"
              rel="noopener noreferrer"
              class="soundtrack-link"
            >
              YouTube playlist
            </a>
            <div class="soundtrack-music-group">
              <a
                :href="currentSource.musicUrl"
                aria-label="Open soundtrack in YouTube Music"
                target="_blank"
                rel="noopener noreferrer"
                class="soundtrack-link"
              >
                YouTube Music
              </a>
              <span class="soundtrack-premium-note font-mono">
                Ad-free playback requires YouTube Premium
              </span>
            </div>
          </div>
        </div>

        <div class="soundtrack-controls-group">
          <button
            type="button"
            class="quote-nav-btn prev"
            aria-label="Previous transcript"
            @click="emit('prevLore')"
          >
            &larr;
          </button>
          <button
            type="button"
            class="soundtrack-action"
            :aria-label="actionAriaLabel"
            :disabled="status === 'loading'"
            @click="handlePrimaryAction"
          >
            {{ actionLabel }}
          </button>
          <button
            type="button"
            class="quote-nav-btn next"
            aria-label="Next transcript"
            @click="emit('nextLore')"
          >
            &rarr;
          </button>
          <button
            type="button"
            class="quote-nav-btn share-btn font-mono"
            :aria-label="loreCopied ? 'Transcript copied' : 'Share transcript'"
            @click="emit('shareLore')"
          >
            {{ loreCopied ? 'COPIED!' : 'SHARE' }}
          </button>
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

    <!-- Fused Comic Slideshow Controls -->
    <div v-if="page && totalPages" class="soundtrack-comic-controls">
      <button
        type="button"
        class="comic-ctrl-btn"
        aria-label="Previous page"
        :disabled="page === 1"
        @click="setPage(page - 1)"
      >
        &larr; Prev
      </button>

      <span class="comic-page-counter font-mono">
        {{ page }} / {{ totalPages }}
      </span>

      <div class="comic-jump-select-wrap">
        <select
          :value="page"
          @change="setPage(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="n in totalPages" :key="n" :value="n">
            Page {{ n === 1 ? '1 (Cover)' : n }}
          </option>
        </select>
      </div>

      <button
        type="button"
        class="comic-ctrl-btn"
        aria-label="Next page"
        :disabled="page === totalPages"
        @click="setPage(page + 1)"
      >
        Next &rarr;
      </button>
    </div>

    <div
      v-if="isStarted"
      class="soundtrack-mobile-bar"
      :class="{ 'is-playing': isPlaying }"
    >
      <img
        :src="artworkUrl"
        :alt="`${currentTrack.title} artwork`"
        class="soundtrack-mobile-artwork"
      >
      <div class="soundtrack-mobile-copy">
        <span class="soundtrack-mobile-title">{{ currentTrack.title }}</span>
        <span class="soundtrack-mobile-artist font-mono">{{ currentTrack.artist }}</span>
      </div>
      <button
        type="button"
        class="soundtrack-mobile-action"
        :aria-label="actionAriaLabel"
        :disabled="status === 'loading'"
        @click="handlePrimaryAction"
      >
        {{ actionLabel }}
      </button>
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

.soundtrack-panel-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  padding: 18px;

  @media (min-width: 900px) {
    grid-template-columns: auto 1fr auto;
    align-items: center;
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
  gap: 6px;
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

.soundtrack-status {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: #94a3b8;
  max-width: 56ch;
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

.soundtrack-music-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
}

.soundtrack-premium-note {
  font-size: 0.7rem;
  color: #94a3b8;
}

.soundtrack-action,
.soundtrack-mobile-action {
  border: 1px solid rgba(102, 179, 255, 0.55);
  border-radius: 999px;
  background: rgba(66, 133, 244, 0.08);
  color: #e0f2fe;
  cursor: pointer;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;

  &:hover:enabled {
    transform: translateY(-1px);
    background: rgba(66, 133, 244, 0.18);
    border-color: rgba(125, 211, 252, 0.8);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.72;
  }
}

.soundtrack-action {
  min-height: 44px;
  padding: 0 20px;
  justify-self: start;

  @media (min-width: 900px) {
    justify-self: end;
  }
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.soundtrack-mobile-artist {
  font-size: 0.72rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.soundtrack-mobile-action {
  min-width: 92px;
  min-height: 40px;
  padding: 0 14px;
  flex-shrink: 0;
}

.soundtrack-controls-group {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: start;

  @media (min-width: 900px) {
    justify-self: end;
  }

  @media (max-width: 767px) {
    grid-column: 1 / -1;
    width: 100%;
    justify-content: center;
    margin-top: 12px;
  }
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

@media (max-width: 767px) {
  .soundtrack-panel-main {
    grid-template-columns: auto 1fr;
  }

  .soundtrack-action {
    width: 100%;
  }
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
