<script setup lang="ts">
import type { WolvesChapter } from '@/data/wolves-story'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  chapter: WolvesChapter | undefined
  playing: boolean
}>()

const emit = defineEmits<{
  (e: 'update:playing', playing: boolean): void
}>()

const playlistUrl = 'https://www.youtube.com/playlist?list=PLA78oiE-RGAE'

function togglePlay() {
  emit('update:playing', !props.playing)
}

interface LyricLine {
  time: number // in seconds
  text: string
}

// Real-world Nightwish Track Metadata, Timed Lyrics & Chapter Commentary
interface TrackMetadata {
  song: string
  artist: string
  album: string
  artwork: string
  playlistIndex: number
  commentary: string
  lyrics: LyricLine[]
}

const trackData: Record<string, TrackMetadata> = {
  prologue: {
    song: '7 Days to the Wolves',
    artist: 'Nightwish',
    album: 'Dark Passion Play',
    artwork: 'https://upload.wikimedia.org/wikipedia/en/c/ca/Nightwish_-_Dark_Passion_Play.jpg',
    playlistIndex: 0,
    commentary: 'PROLOGUE DOWNLINK: The hunt begins in the frozen territories. The wolves of corporate licensing track open-source nomads under the dark aurora.',
    lyrics: [
      { time: 0, text: '[Instrumental Intro // Decrypting Transmission]' },
      { time: 18, text: 'The core of the sun, the source of the light' },
      { time: 25, text: 'A night of a thousand lives, a time of a thousand dreams' },
      { time: 33, text: 'Seven days to the wolves, wet your beds, write your wills' },
      { time: 41, text: 'The wolves, my friend, they hunt in the dark' },
      { time: 48, text: 'A prayer for the lost, a song for the brave' },
      { time: 54, text: 'We are the ones who survived the long winter' },
      { time: 60, text: 'Write your will, wet your bed, seven days to the wolves' },
      { time: 72, text: '[Guitar Solo // Telemetry Normalizing]' }
    ]
  },
  pursuit: {
    song: 'The Poet and the Pendulum',
    artist: 'Nightwish',
    album: 'Dark Passion Play',
    artwork: 'https://upload.wikimedia.org/wikipedia/en/c/ca/Nightwish_-_Dark_Passion_Play.jpg',
    playlistIndex: 1,
    commentary: 'PURSUIT DOWNLINK: Deep space Europa escape. A self-sacrifice under the swinging blades of automated compliance, a beautiful story written in frozen nitrogen.',
    lyrics: [
      { time: 0, text: '[Orchestral Intro // Dark Passion Play]' },
      { time: 14, text: 'The white land of the north, a dream before time' },
      { time: 24, text: 'The poet is writing his final words in the snow' },
      { time: 33, text: 'Save me, the pendulum is swinging lower' },
      { time: 42, text: 'The world is a stage, and we are the players' },
      { time: 51, text: 'A beautiful story, written in fire and steel' },
      { time: 60, text: 'Find the scientist on Europa, the ice is deep' },
      { time: 68, text: 'Only the stars remain to guide our escape' }
    ]
  },
  awakening: {
    song: 'Bye Bye Beautiful',
    artist: 'Nightwish',
    album: 'Dark Passion Play',
    artwork: 'https://upload.wikimedia.org/wikipedia/en/c/ca/Nightwish_-_Dark_Passion_Play.jpg',
    playlistIndex: 2,
    commentary: 'AWAKENING DOWNLINK: Retribution and rebirth. The nomad fleet breaks the blockade, setting the stage for 2027\'s final transmission.',
    lyrics: [
      { time: 0, text: '[Synthesizer Intro // Retribution]' },
      { time: 11, text: 'It\'s the end of an era, a final farewell' },
      { time: 18, text: 'Did you ever hear what I had to say?' },
      { time: 24, text: 'Bye bye beautiful, we are moving on' },
      { time: 30, text: 'Open Source fights back under the iron sky' },
      { time: 36, text: 'The garden before time is blooming once more' },
      { time: 42, text: 'No player can predict where the shape will land' },
      { time: 48, text: 'Choose freedom, choose complexity, choose the future' }
    ]
  }
}

const activeTrack = computed(() => {
  const chapterId = props.chapter?.id || 'prologue'
  return trackData[chapterId] || trackData.prologue
})

const currentLyricIndex = ref(0)
const currentLyricText = computed(() => {
  const lines = activeTrack.value.lyrics
  return lines[currentLyricIndex.value]?.text || ''
})
const typedLyric = ref('')
let typewriterTimer: ReturnType<typeof setInterval> | null = null

function runLyricTypewriter() {
  if (typewriterTimer) {
    clearInterval(typewriterTimer)
  }
  typedLyric.value = ''
  const text = currentLyricText.value
  let idx = 0
  typewriterTimer = setInterval(() => {
    if (idx < text.length) {
      typedLyric.value += text[idx]
      idx++
    }
    else {
      clearInterval(typewriterTimer!)
      typewriterTimer = null
    }
  }, 40) // Snappy typewriter speed
}

// YouTube Player API State & Logic
let player: any = null
const isPlayerReady = ref(false)
let timePollTimer: ReturnType<typeof setInterval> | null = null
const lyricsContainer = ref<HTMLElement | null>(null)

function loadYtApi(): Promise<void> {
  return new Promise((resolve) => {
    // Mock YT player for Vitest / non-browser test environment
    if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
      (window as any).YT = {
        Player: class {
          constructor(_id: string, config: any) {
            setTimeout(() => {
              if (config.events && typeof config.events.onReady === 'function') {
                config.events.onReady()
              }
            }, 0)
          }

          setVolume() {}
          playVideo() {}
          pauseVideo() {}
          playVideoAt() {}
          getPlaylistIndex() { return 0 }
          getCurrentTime() { return 0 }
          destroy() {}
        }
      }
      resolve()
      return
    }

    if ((window as any).YT && (window as any).YT.Player) {
      resolve()
      return
    }
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (existing) {
      const prevCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (prevCallback) {
          prevCallback()
        }
        resolve()
      }
      return
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)

    const prevOnReady = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (prevOnReady) {
        prevOnReady()
      }
      resolve()
    }
  })
}

function updateLyricsForTime(time: number) {
  const lines = activeTrack.value.lyrics
  let matchedIndex = 0
  for (let i = 0; i < lines.length; i++) {
    if (time >= lines[i].time) {
      matchedIndex = i
    }
    else {
      break
    }
  }

  if (matchedIndex !== currentLyricIndex.value) {
    currentLyricIndex.value = matchedIndex
    runLyricTypewriter()
  }
}

function startTimePolling() {
  stopTimePolling()
  timePollTimer = setInterval(() => {
    if (player && typeof player.getCurrentTime === 'function') {
      const currentTime = player.getCurrentTime()
      updateLyricsForTime(currentTime)
    }
  }, 250)
}

function stopTimePolling() {
  if (timePollTimer) {
    clearInterval(timePollTimer)
    timePollTimer = null
  }
}

function initPlayer() {
  if (player) {
    return
  }

  player = new (window as any).YT.Player('wolves-yt-player', {
    height: '100%',
    width: '100%',
    videoId: '', // Will load playlist instead
    playerVars: {
      listType: 'playlist',
      list: 'PLA78oiE-RGAE',
      autoplay: props.playing ? 1 : 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3
    },
    events: {
      onReady: () => {
        isPlayerReady.value = true
        if (player && typeof player.setVolume === 'function') {
          player.setVolume(50)
        }
        syncPlayerState()
      },
      onStateChange: (event: any) => {
        if (event.data === 1) {
          startTimePolling()
          if (!props.playing) {
            emit('update:playing', true)
          }
        }
        else {
          stopTimePolling()
          if (props.playing && (event.data === 2 || event.data === 0)) {
            emit('update:playing', false)
          }
        }
      }
    }
  })
}

function syncPlayerState() {
  if (!player || !isPlayerReady.value) {
    return
  }

  const index = activeTrack.value.playlistIndex

  if (props.playing) {
    if (typeof player.getPlaylistIndex === 'function' && player.getPlaylistIndex() !== index) {
      if (typeof player.playVideoAt === 'function') {
        player.playVideoAt(index)
      }
    }
    else {
      if (typeof player.playVideo === 'function') {
        player.playVideo()
      }
    }
    startTimePolling()
  }
  else {
    if (typeof player.pauseVideo === 'function') {
      player.pauseVideo()
    }
    stopTimePolling()
  }
}

// Watchers
watch(() => props.playing, () => {
  syncPlayerState()
})

watch(activeTrack, () => {
  syncPlayerState()
})

watch(currentLyricIndex, async (newIdx) => {
  await nextTick()
  if (lyricsContainer.value) {
    const lines = lyricsContainer.value.querySelectorAll('.lyrics-line-item')
    const activeLine = lines[newIdx] as HTMLElement | null
    if (activeLine) {
      lyricsContainer.value.scrollTo({
        top: activeLine.offsetTop - lyricsContainer.value.clientHeight / 2 + activeLine.clientHeight / 2,
        behavior: 'smooth'
      })
    }
  }
})

onMounted(async () => {
  await loadYtApi()
  initPlayer()
  runLyricTypewriter()
})

onBeforeUnmount(() => {
  stopTimePolling()
  if (typewriterTimer) {
    clearInterval(typewriterTimer)
  }
  if (player && typeof player.destroy === 'function') {
    player.destroy()
    player = null
  }
})
</script>

<template>
  <div class="sidebar-soundtrack-card now-playing-bar" :class="{ 'has-lyrics': playing }">
    <div class="meta-panel-grid">
      <!-- Left Column: Audio and Chapter Commentary -->
      <div class="meta-panel-left">
        <div class="player-top-row">
          <div class="thumbnail-wrapper" :class="{ 'is-playing-pulse': playing }">
            <img
              :src="activeTrack.artwork"
              class="artwork-img"
              :alt="`${activeTrack.song} Album Artwork`"
            >
          </div>

          <div class="info-zone">
            <span class="label font-mono">RELEASE SOUNDTRACK TO HUNT BY</span>
            <a
              :href="playlistUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="playlist-title"
            >
              {{ activeTrack.song }}
            </a>
            <div class="active-track font-mono text-gray">
              Artist: <span class="track-name text-cyan">{{ activeTrack.artist }}</span>
            </div>
            <div class="active-album font-mono text-gray">
              Album: <span class="album-name">{{ activeTrack.album }}</span>
            </div>
          </div>

          <div class="video-wrapper">
            <button
              class="play-button"
              :class="{ 'is-playing': playing }"
              :aria-label="playing ? 'Pause soundtrack' : 'Play soundtrack'"
              type="button"
              @click="togglePlay"
            >
              <span class="play-icon">
                <svg v-if="playing" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        <!-- Telemetry Commentary Panel -->
        <div class="telemetry-commentary font-mono">
          <div class="telemetry-header">
            <span class="telemetry-label text-cyan">METADATA_DOWNLINK //</span> COMM_ESTABLISHED
          </div>
          <p class="telemetry-text">
            Chapter {{ props.chapter ? props.chapter.id.toUpperCase() : 'PROLOGUE' }}: {{ props.chapter ? props.chapter.title : 'The Signal' }} &mdash; {{ props.chapter ? props.chapter.description : 'The archive opens.' }}
          </p>
        </div>
      </div>

      <!-- Right Column: Rolling timed lyrics -->
      <div class="meta-panel-right">
        <div class="lyrics-downlink font-mono animate-fade">
          <div class="lyrics-header text-cyan">
            <span class="pulse-dot" /> LIVE_LYRICS_DOWNLINK //
          </div>
          <div v-if="playing" ref="lyricsContainer" class="lyrics-scroll-panel">
            <div
              v-for="(line, idx) in activeTrack.lyrics"
              :key="idx"
              class="lyrics-line-item"
              :class="{
                'is-active': idx === currentLyricIndex,
                'is-past': idx < currentLyricIndex,
                'is-future': idx > currentLyricIndex,
              }"
            >
              <span v-if="idx === currentLyricIndex" class="cursor-arrow">&gt; </span>
              {{ idx === currentLyricIndex ? typedLyric : line.text }}
              <span v-if="idx === currentLyricIndex" class="cursor" />
            </div>
          </div>
          <div v-else class="lyrics-standby text-gray">
            &gt; STANDBY // Click PLAY to establish real-time lyrics downlink...
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden container loads YouTube player API container -->
    <div class="hidden-player-container">
      <div id="wolves-yt-player" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.sidebar-soundtrack-card.now-playing-bar {
  background-color: #10151f;
  border: 1px solid #272727;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s ease;

  &:hover {
    border-color: rgba(66, 133, 244, 0.4);
  }
}

.meta-panel-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  width: 100%;

  @media (min-width: 768px) {
    grid-template-columns: 1.2fr 1fr;
    gap: 24px;
  }
}

.meta-panel-left {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.meta-panel-right {
  display: flex;
  flex-direction: column;
  justify-content: stretch;
}

.player-top-row {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.thumbnail-wrapper {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  background-color: #0c1016;
  border: 1px solid #272727;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888888;
  overflow: hidden;
  transition: transform 0.5s ease;

  &.is-playing-pulse {
    animation: thumb-pulse 3s infinite ease-in-out;
  }
}

.artwork-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info-zone {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  .label {
    font-size: 0.7rem;
    font-weight: bold;
    letter-spacing: 0.1em;
    color: var(--color-blue, #4285f4);
    text-transform: uppercase;
  }

  .playlist-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #ffffff;
    text-decoration: none;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      color: var(--color-blue-light, #66b3ff);
    }
  }

  .active-track,
  .active-album {
    font-size: 0.75rem;
    color: #888888;

    .track-name {
      font-weight: bold;
      color: #38bdf8; /* cyan */
    }

    .album-name {
      color: #9ca3af;
    }
  }
}

.telemetry-commentary {
  background-color: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.72rem;
  line-height: 1.4;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #94a3b8;
  height: 80px;
  overflow-y: auto;

  .telemetry-header {
    font-weight: 700;
    font-size: 0.68rem;
    color: #38bdf8; /* cyan */
  }

  .telemetry-text {
    margin: 0;
  }
}

.lyrics-downlink {
  background-color: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #e2e8f0;
  height: 170px;

  .lyrics-header {
    font-weight: 700;
    letter-spacing: 0.05em;
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #38bdf8; /* cyan */
  }

  .lyrics-scroll-panel {
    max-height: 130px;
    overflow-y: auto;
    padding-right: 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-behavior: smooth;

    scrollbar-width: thin;
    &::-webkit-scrollbar {
      width: 3px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: #1e293b;
      border-radius: 2px;
    }
  }

  .lyrics-line-item {
    font-size: 0.74rem;
    line-height: 1.4;
    transition: all 0.3s ease;
    word-break: break-word;

    &.is-active {
      color: #38bdf8; /* cyan */
      font-weight: 700;
      opacity: 1;
      transform: scale(1.01);
    }

    &.is-past {
      color: #64748b;
      opacity: 0.45;
    }

    &.is-future {
      color: #475569;
      opacity: 0.25;
    }
  }

  .lyrics-standby {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 110px;
    font-size: 0.72rem;
    text-align: center;
    color: #64748b;
  }

  .cursor {
    display: inline-block;
    width: 6px;
    height: 12px;
    background-color: #38bdf8;
    margin-left: 2px;
    vertical-align: middle;
    animation: blink 0.8s infinite;
  }
}

.pulse-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes blink {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
  }
}

@keyframes thumb-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(56, 189, 248, 0);
  }
  50% {
    transform: scale(1.03);
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
  }
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.text-gray {
  color: #888888;
}

.video-wrapper {
  flex-shrink: 0;
}

.play-button {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--color-blue, #4285f4);
  background-color: transparent;
  color: var(--color-blue-light, #66b3ff);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 0 10px rgba(66, 133, 244, 0.2);
  padding: 0;

  &:hover {
    background-color: var(--color-blue, #4285f4);
    color: #ffffff;
    box-shadow: 0 0 16px rgba(66, 133, 244, 0.4);
    transform: scale(1.05);
  }

  &.is-playing {
    border-color: #27c93f;
    color: #27c93f;
    box-shadow: 0 0 10px rgba(39, 201, 63, 0.2);

    &:hover {
      background-color: #27c93f;
      color: #0c1016;
      box-shadow: 0 0 16px rgba(39, 201, 63, 0.4);
    }
  }
}

.play-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.hidden-player-container {
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
  position: absolute;

  iframe {
    width: 1px;
    height: 1px;
    border: none;
  }
}
</style>
