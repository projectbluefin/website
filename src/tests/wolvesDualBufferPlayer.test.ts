import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useDualBufferPlayer } from '@/composables/useDualBufferPlayer'
import { resetYoutubeIframeApiCacheForTests } from '@/composables/useYoutubeIframeApi'
import { CINEMATIC_SEGMENTS, PRE_END_THRESHOLD_S, TIME_POLL_MS } from '@/config/wolves-cinematic'
import { useCinematicStore } from '@/stores/cinematic'

interface FakeEvents {
  onReady?: (event: unknown) => void
  onStateChange?: (event: { data: number }) => void
  onError?: (event: unknown) => void
}

class FakePlayer {
  static instances: FakePlayer[] = []
  events: FakeEvents
  currentTime = 0
  duration = 0
  volume = 100
  playing = false
  loadedId = ''
  cuedId = ''
  destroyed = false

  constructor(_element: Element, options: { events?: FakeEvents }) {
    this.events = options.events ?? {}
    FakePlayer.instances.push(this)
    // The real API fires onReady asynchronously after construction.
    queueMicrotask(() => this.events.onReady?.({}))
  }

  playVideo() {
    this.playing = true
    this.events.onStateChange?.({ data: 1 })
  }

  pauseVideo() {
    this.playing = false
    this.events.onStateChange?.({ data: 2 })
  }

  loadVideoById(video: string | { videoId: string, startSeconds?: number }) {
    this.loadedId = typeof video === 'string' ? video : video.videoId
    this.currentTime = typeof video === 'string' ? 0 : video.startSeconds ?? 0
    this.playVideo()
  }

  cueVideoById(video: string | { videoId: string, startSeconds?: number }) {
    this.cuedId = typeof video === 'string' ? video : video.videoId
  }

  getCurrentTime() {
    return this.currentTime
  }

  getDuration() {
    return this.duration
  }

  getVolume() {
    return this.volume
  }

  setVolume(volume: number) {
    this.volume = volume
  }

  mute() {
    this.volume = 0
  }

  destroy() {
    this.destroyed = true
  }
}

function installFakeYoutubeApi() {
  ;(window as any).YT = {
    Player: FakePlayer,
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  }
}

async function startPlayer(audioEnabled = true) {
  const hostA = ref<HTMLElement | null>(document.createElement('div'))
  const hostB = ref<HTMLElement | null>(document.createElement('div'))
  const player = useDualBufferPlayer({ hostA, hostB, audioEnabled })
  await player.start()
  // onReady fires on a microtask; flush it.
  await Promise.resolve()
  return player
}

describe('useDualBufferPlayer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    FakePlayer.instances = []
    installFakeYoutubeApi()
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    resetYoutubeIframeApiCacheForTests()
    delete (window as any).YT
  })

  it('plays segment 0 on side A and pre-buffers segment 1 on side B', async () => {
    const player = await startPlayer()
    const [playerA, playerB] = FakePlayer.instances

    expect(player.activeSide.value).toBe('a')
    expect(playerA.loadedId).toBe(CINEMATIC_SEGMENTS[0].youtubeId)
    expect(playerB.cuedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
    expect(playerB.volume).toBe(0)
  })

  it('publishes time into the store while playing', async () => {
    await startPlayer()
    const store = useCinematicStore()
    const [playerA] = FakePlayer.instances

    playerA.currentTime = 42
    playerA.duration = 300
    vi.advanceTimersByTime(TIME_POLL_MS)

    expect(store.segmentElapsed).toBe(42)
    expect(store.segmentDuration).toBe(300)
  })

  it('swaps to the buffered side at the pre-end threshold and cues the next segment', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    const [playerA, playerB] = FakePlayer.instances

    playerA.duration = 200
    playerA.currentTime = 200 - PRE_END_THRESHOLD_S
    vi.advanceTimersByTime(TIME_POLL_MS)

    expect(player.activeSide.value).toBe('b')
    expect(playerB.playing).toBe(true)
    expect(store.crossfading).toBe(true)

    // Run out the crossfade volume ramp (segment 0 uses the 800ms default).
    vi.advanceTimersByTime(1000)

    expect(store.segmentIndex).toBe(1)
    expect(store.crossfading).toBe(false)
    expect(playerA.playing).toBe(false)
    expect(playerA.cuedId).toBe(CINEMATIC_SEGMENTS[2].youtubeId)
    expect(playerB.volume).toBe(100)
    expect(playerA.volume).toBe(0)
  })

  it('skips forward and backward on manual command', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    const [playerA, playerB] = FakePlayer.instances

    store.updateTime(10, 300)
    player.skip(1)
    expect(player.activeSide.value).toBe('b')
    expect(playerB.loadedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
    // Trimmed segments load at their authored start.
    expect(playerB.currentTime).toBe(2)

    vi.advanceTimersByTime(2000)
    expect(store.segmentIndex).toBe(1)
    expect(playerA.cuedId).toBe(CINEMATIC_SEGMENTS[2].youtubeId)

    player.skip(-1)
    vi.advanceTimersByTime(2000)
    expect(player.activeSide.value).toBe('a')
    expect(playerA.loadedId).toBe(CINEMATIC_SEGMENTS[0].youtubeId)
    expect(store.segmentIndex).toBe(0)
  })

  it('ignores skips past the ends and while crossfading', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()

    player.skip(-1)
    expect(store.segmentIndex).toBe(0)
    expect(player.activeSide.value).toBe('a')

    player.skip(1)
    // Mid-crossfade, further skips are ignored.
    player.skip(1)
    vi.advanceTimersByTime(2000)
    expect(store.segmentIndex).toBe(1)
  })

  it('falls back to swapping on the ENDED event', async () => {
    const player = await startPlayer()
    const [playerA] = FakePlayer.instances

    playerA.events.onStateChange?.({ data: 0 })
    expect(player.activeSide.value).toBe('b')
  })

  it('honors authored trims: swaps at endSeconds and reports window-relative time', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    const [playerA, playerB] = FakePlayer.instances

    // Advance past segment 0 so segment 1 (INTRO, startSeconds 2, endSeconds 114) is active.
    playerA.duration = 100
    playerA.currentTime = 100
    vi.advanceTimersByTime(TIME_POLL_MS)
    vi.advanceTimersByTime(2000)
    expect(store.segmentIndex).toBe(1)
    expect(player.activeSide.value).toBe('b')

    playerB.duration = 120
    playerB.currentTime = 50
    vi.advanceTimersByTime(TIME_POLL_MS)
    expect(store.nativeTime).toBe(50)
    expect(store.segmentElapsed).toBe(48)
    expect(store.segmentDuration).toBe(112)

    // The authored cutoff at 114s triggers the swap before the video's natural 120s end.
    playerB.currentTime = 114 - PRE_END_THRESHOLD_S
    vi.advanceTimersByTime(TIME_POLL_MS)
    expect(player.activeSide.value).toBe('a')
  })

  it('finishes the cinematic when the last segment ends', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()

    // Walk every boundary to the end of the seven-segment show.
    for (let i = 0; i < CINEMATIC_SEGMENTS.length - 1; i++) {
      const active = player.activeSide.value === 'a' ? FakePlayer.instances[0] : FakePlayer.instances[1]
      // Past both the natural duration and any authored endSeconds cutoff.
      active.duration = 1000
      active.currentTime = 1000
      vi.advanceTimersByTime(TIME_POLL_MS)
      vi.advanceTimersByTime(3000)
    }
    expect(store.segmentIndex).toBe(CINEMATIC_SEGMENTS.length - 1)

    const active = player.activeSide.value === 'a' ? FakePlayer.instances[0] : FakePlayer.instances[1]
    active.duration = 1000
    active.currentTime = 1000
    vi.advanceTimersByTime(TIME_POLL_MS)

    expect(store.phase).toBe('finished')
  })

  it('keeps both players muted when Spotify owns the audio', async () => {
    await startPlayer(false)
    const [playerA, playerB] = FakePlayer.instances

    playerA.volume = 55
    playerB.volume = 55
    playerA.duration = 100
    playerA.currentTime = 100
    vi.advanceTimersByTime(TIME_POLL_MS)
    vi.advanceTimersByTime(3000)

    // audioEnabled=false means setVolume is never called by the composable.
    expect(playerA.volume).toBe(55)
    expect(playerB.volume).toBe(55)
  })

  it('destroys both players on teardown', async () => {
    const player = await startPlayer()
    player.destroy()
    expect(FakePlayer.instances.every(instance => instance.destroyed)).toBe(true)
  })
})
