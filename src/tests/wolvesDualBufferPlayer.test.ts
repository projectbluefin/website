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

async function startPlayer() {
  const hostA = ref<HTMLElement | null>(document.createElement('div'))
  const hostB = ref<HTMLElement | null>(document.createElement('div'))
  const player = useDualBufferPlayer({ hostA, hostB })
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

  it('stops at Creator Shorts instead of playing Part II beneath it', async () => {
    await startPlayer()
    const store = useCinematicStore()
    store.enterCinematic()
    const [playerA, playerB] = FakePlayer.instances

    playerA.duration = 200
    playerA.currentTime = 200 - PRE_END_THRESHOLD_S
    vi.advanceTimersByTime(TIME_POLL_MS)

    expect(store.phase).toBe('creator-shorts')
    expect(store.segmentIndex).toBe(1)
    expect(playerA.playing).toBe(false)
    expect(playerB.playing).toBe(false)
  })

  it('starts directly from the store segment after Creator Shorts', async () => {
    const store = useCinematicStore()
    store.segmentIndex = 1

    await startPlayer()
    const [playerA, playerB] = FakePlayer.instances

    expect(playerA.loadedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
    expect(playerB.cuedId).toBe(CINEMATIC_SEGMENTS[2].youtubeId)
  })

  it('manual Next from Part I opens Creator Shorts once', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    store.enterCinematic()

    player.skip(1)

    expect(store.phase).toBe('creator-shorts')
    expect(store.segmentIndex).toBe(1)
    expect(FakePlayer.instances.every(instance => !instance.playing)).toBe(true)
  })

  it('skips forward and backward on manual command', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    const [playerA, playerB] = FakePlayer.instances

    store.updateTime(10, 300)
    player.skip(1)
    expect(player.activeSide.value).toBe('b')
    expect(playerB.loadedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)

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

  it('supports authored trims when a segment defines a startSeconds/endSeconds window', async () => {
    // No current segment is trimmed; pin a temporary authored window on segment 1
    // to keep the trim capability covered.
    const segment = CINEMATIC_SEGMENTS[1] as { startSeconds?: number, endSeconds?: number }
    segment.startSeconds = 2
    segment.endSeconds = 114
    try {
      const player = await startPlayer()
      const store = useCinematicStore()
      const [playerA, playerB] = FakePlayer.instances

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
    }
    finally {
      delete segment.startSeconds
      delete segment.endSeconds
    }
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

  it('destroys both players on teardown', async () => {
    const player = await startPlayer()
    player.destroy()
    expect(FakePlayer.instances.every(instance => instance.destroyed)).toBe(true)
  })
})
