import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  COLD_SKIP_PLAYBACK_TIMEOUT_MS,
  OPENING_FRAME_CONFIRMATION_POLLS,
  PREPARE_TIMEOUT_MS,
  START_PLAYBACK_TIMEOUT_MS,
  useDualBufferPlayer,
} from '@/composables/useDualBufferPlayer'
import { invalidateYoutubeIframeApiLoad, resetYoutubeIframeApiCacheForTests } from '@/composables/useYoutubeIframeApi'
import { CINEMATIC_SEGMENTS, PRE_END_THRESHOLD_S, TIME_POLL_MS } from '@/config/wolves-cinematic'
import { useCinematicStore } from '@/stores/cinematic'

interface FakeEvents {
  onReady?: (event: unknown) => void
  onStateChange?: (event: { data: number }) => void
  onError?: (event: unknown) => void
  onAutoplayBlocked?: (event: unknown) => void
}

interface FakePlayerOptions {
  events?: FakeEvents
  playerVars?: {
    origin?: string
    autohide?: number
  }
}

/**
 * A media player's defining behaviour is that time passes while it plays. This double
 * used to hold `currentTime` at 0 forever, which is why a prewarmed buffer that ran
 * away for an entire segment — truncating the back half of the show — sat green in CI
 * for as long as it did. Model the clock, or the suite cannot see clock defects.
 */
class FakePlayer {
  static instances: FakePlayer[] = []
  static emitPlayingOnPlay = true
  static emitReadyOnConstruct = true
  /**
   * A pause whose PAUSED never lands. The real API delivers state changes as
   * cross-origin messages, so a park's pause event can be dropped or arrive after the
   * lifecycle that issued it. Any suppression a side applies while a park is in flight
   * must therefore be released by something other than that PAUSED, or the side goes
   * permanently deaf to the presenter's real transport events.
   */
  static emitPausedOnPause = true
  /**
   * Video ids the API refuses. A real player answers a cue for restricted or
   * unavailable media with `onError` and then holds nothing — the request is
   * recorded by the runtime, the media never arrives. Without this the double IS
   * the runtime's own bookkeeping, so a buffer can never hold anything other than
   * what it was asked to hold, and no test can see a buffer go to air dead.
   */
  static failingVideoIds = new Set<string>()
  events: FakeEvents
  currentTime = 0
  duration = 0
  volume = 100
  playing = false
  loadedId = ''
  cuedId = ''
  /** The media actually attached to this player, as `getVideoData` reports it. */
  videoId = ''
  muted = false
  destroyed = false
  /** Ordered log of API calls, so ordering guarantees can be asserted. */
  calls: string[] = []
  /** How many times playback was requested — the only evidence a prewarm happened. */
  playCount = 0
  /**
   * Model a buffer that has been told to play but has no media yet: YouTube reports
   * BUFFERING, never PLAYING, and the clock does not move. A double that always answers
   * a play request with PLAYING cannot see a fade started against silence.
   */
  suppressPlayingEvent = false
  options: FakePlayerOptions

  constructor(_element: Element, options: FakePlayerOptions) {
    this.options = options
    this.events = options.events ?? {}
    FakePlayer.instances.push(this)
    // The real API fires onReady asynchronously after construction.
    if (FakePlayer.emitReadyOnConstruct) {
      queueMicrotask(() => this.events.onReady?.({}))
    }
  }

  playVideo() {
    this.playCount += 1
    // YouTube replays from the start when a finished video is played again.
    if (this.duration > 0 && this.currentTime >= this.duration) {
      this.currentTime = 0
    }
    if (this.suppressPlayingEvent) {
      this.events.onStateChange?.({ data: 3 })
      return
    }
    this.playing = true
    if (FakePlayer.emitPlayingOnPlay) {
      this.events.onStateChange?.({ data: 1 })
    }
  }

  /** The fetch lands: BUFFERING becomes PLAYING and the clock goes live. */
  finishBuffering() {
    this.suppressPlayingEvent = false
    this.playing = true
    this.events.onStateChange?.({ data: 1 })
  }

  seekTo(seconds: number) {
    this.currentTime = seconds
  }

  /** Advance this player's clock as playback would, firing ENDED at the boundary. */
  tickClock(seconds: number) {
    if (!this.playing || this.destroyed) {
      return
    }
    this.currentTime += seconds
    if (this.duration > 0 && this.currentTime >= this.duration) {
      this.currentTime = this.duration
      this.playing = false
      this.events.onStateChange?.({ data: 0 })
    }
  }

  pauseVideo() {
    this.playing = false
    if (FakePlayer.emitPausedOnPause) {
      this.events.onStateChange?.({ data: 2 })
    }
  }

  loadVideoById(video: string | { videoId: string, startSeconds?: number }) {
    const id = typeof video === 'string' ? video : video.videoId
    this.loadedId = id
    this.currentTime = typeof video === 'string' ? 0 : video.startSeconds ?? 0
    if (FakePlayer.failingVideoIds.has(id)) {
      // Restricted media: the request is accepted, the media never attaches.
      this.videoId = ''
      this.events.onError?.({ data: 150 })
      return
    }
    this.videoId = id
    this.playVideo()
  }

  cueVideoById(video: string | { videoId: string, startSeconds?: number }) {
    const id = typeof video === 'string' ? video : video.videoId
    this.calls.push('cueVideoById')
    this.cuedId = id
    if (FakePlayer.failingVideoIds.has(id)) {
      this.videoId = ''
      this.events.onError?.({ data: 150 })
      return
    }
    this.videoId = id
  }

  getVideoData() {
    return { video_id: this.videoId }
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

  /**
   * `mute()` is a latch independent of volume, and the real API keeps it across a
   * video change — which is the whole reason a prewarm uses it. A double that folds
   * it into `volume` cannot tell an audible show from a silent one, so a promotion
   * path that forgets to unmute would ship green.
   */
  mute() {
    this.calls.push('mute')
    this.muted = true
  }

  unMute() {
    this.muted = false
  }

  /** What the room actually hears. */
  get audibleVolume() {
    return this.muted ? 0 : this.volume
  }

  destroy() {
    this.destroyed = true
    this.playing = false
  }
}

function installFakeYoutubeApi() {
  ;(window as any).YT = {
    Player: FakePlayer,
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  }
}

/**
 * A script tag matching the shared loader's. The `src` is set after the element is
 * connected so happy-dom (which has script loading disabled) does not throw on append.
 */
function appendStalledApiScript() {
  const script = document.createElement('script')
  // happy-dom refuses to fetch, and throws on append, for an executable external
  // script; a non-executable type keeps the element inert while still matching the
  // loader's `script[src=...]` selector.
  script.type = 'text/plain'
  script.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(script)
  return script
}

function buildPlayer() {
  const hostA = ref<HTMLElement | null>(document.createElement('div'))
  const hostB = ref<HTMLElement | null>(document.createElement('div'))
  return useDualBufferPlayer({ hostA, hostB })
}

/** Drain the microtask queue so an awaited internal promise chain can settle. */
async function flushMicrotasks() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
  }
}

async function startPlayer() {
  const store = useCinematicStore()
  if (store.phase === 'lobby') {
    store.enterCinematic()
  }
  const hostA = ref<HTMLElement | null>(document.createElement('div'))
  const hostB = ref<HTMLElement | null>(document.createElement('div'))
  const player = useDualBufferPlayer({ hostA, hostB })
  await player.start()
  // onReady fires on a microtask; flush it.
  await Promise.resolve()
  return player
}

/**
 * Advance the fake timers and every playing player's clock together, in poll-sized
 * slices, so the composable sees the same interleaving of clock and timer it sees in a
 * browser. Tests that only advance timers cannot observe playback drift.
 */
function advancePlayback(ms: number, step = TIME_POLL_MS) {
  let remaining = ms
  while (remaining > 0) {
    const slice = Math.min(step, remaining)
    for (const instance of FakePlayer.instances) {
      instance.tickClock(slice / 1000)
    }
    vi.advanceTimersByTime(slice)
    remaining -= slice
  }
}

describe('useDualBufferPlayer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    FakePlayer.instances = []
    FakePlayer.emitPlayingOnPlay = true
    FakePlayer.emitReadyOnConstruct = true
    FakePlayer.emitPausedOnPause = true
    FakePlayer.failingVideoIds = new Set()
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

  it('cues the first two segments before starting side A', async () => {
    const player = await startPlayer()
    const [playerA, playerB] = FakePlayer.instances

    expect(player.activeSide.value).toBe('a')
    expect(playerA.cuedId).toBe(CINEMATIC_SEGMENTS[0].youtubeId)
    expect(playerB.cuedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
    expect(playerA.playing).toBe(true)
    // Side B is prewarmed then parked: it has fetched media but its clock is held at
    // the opening frame, so the handoff can start Part II at its first bar.
    expect(playerB.playing).toBe(false)
    expect(playerB.currentTime).toBe(0)
    expect(playerB.volume).toBe(0)
  })

  it('parks a prewarmed buffer on its opening frame instead of letting it run away', async () => {
    await startPlayer()
    const [, playerB] = FakePlayer.instances
    playerB.duration = 347

    advancePlayback(120_000)

    // Before the fix this read 120: the next segment had been playing the whole time,
    // so the handoff joined it two minutes in. Parts IV-VI opened mid-song and the
    // cinematic ran roughly seven minutes short.
    expect(playerB.currentTime).toBe(0)
    expect(playerB.playing).toBe(false)
  })

  it('opens the next segment on its first frame after a longer outgoing segment', async () => {
    const store = useCinematicStore()
    const player = await startPlayer()
    const [playerA, playerB] = FakePlayer.instances
    playerA.duration = 424
    playerB.duration = 347

    advancePlayback(424_000)

    expect(player.activeSide.value).toBe('b')
    expect(store.segmentIndex).toBe(1)
    expect(playerB.currentTime).toBeLessThan(3)
  })

  it('begins the crossfade a full crossfade window before the segment ends', async () => {
    const store = useCinematicStore()
    await startPlayer()
    const [playerA] = FakePlayer.instances
    playerA.duration = 424

    // One second of content left. With Part II's authored 1500ms fade plus the
    // trailing lead the swap must already be running, so the outgoing track decays
    // into the incoming rather than stopping dead partway through the fade and
    // leaving a hole in the music.
    advancePlayback(423_000)

    expect(store.crossfading).toBe(true)
    expect(playerA.playing).toBe(true)
  })

  it('leads and ramps the boundary with the INCOMING segment authored crossfade', async () => {
    const store = useCinematicStore()
    await startPlayer()
    const [playerA] = FakePlayer.instances
    playerA.duration = 424

    // The I→II boundary is Part II's 1500ms, not Part I's 800ms default: the fade
    // belongs to the segment arriving, matching where transitionLore is authored.
    // Lead is therefore 0.3 + 1.5 = 1.8s.
    playerA.currentTime = 424 - 1.9
    vi.advanceTimersByTime(TIME_POLL_MS)
    expect(store.crossfading).toBe(false)

    playerA.currentTime = 424 - 1.7
    vi.advanceTimersByTime(TIME_POLL_MS)
    // With the outgoing segment's 800ms the lead would only be 1.1s and nothing
    // would have started yet.
    expect(store.crossfading).toBe(true)
    expect(store.pendingSegmentIndex).toBe(1)

    vi.advanceTimersByTime(900)
    // An 800ms ramp would already have completed here.
    expect(store.segmentIndex).toBe(0)
    vi.advanceTimersByTime(800)
    expect(store.segmentIndex).toBe(1)
  })

  it('applies Part VI authored 2500ms crossfade instead of leaving it dead config', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    const last = CINEMATIC_SEGMENTS.length - 1

    // Part VI authors the longest fade in the show. Read from the outgoing segment it
    // could never be applied to any ramp, because nothing follows Part VI.
    player.skip(last)
    expect(store.pendingSegmentIndex).toBe(last)

    vi.advanceTimersByTime(2000)
    expect(store.segmentIndex).toBe(0)
    vi.advanceTimersByTime(700)
    expect(store.segmentIndex).toBe(last)
  })

  it('keeps publishing the outgoing segment clock for the whole crossfade', async () => {
    const store = useCinematicStore()
    await startPlayer()
    const [playerA, playerB] = FakePlayer.instances
    playerA.duration = 424
    playerB.duration = 347

    playerA.currentTime = 424 - 1.7
    vi.advanceTimersByTime(TIME_POLL_MS)
    expect(store.crossfading).toBe(true)
    const elapsedAtSwapStart = store.segmentElapsed

    // `activeSide` has already flipped to the incoming buffer, but segmentIndex still
    // names Part I. Publishing the incoming clock here would report Part II's position
    // against Part I; publishing nothing (the old behaviour) stuck the transport bar
    // for the whole fade and then snapped it to zero.
    playerB.currentTime = 5
    playerA.currentTime = 424 - 1.2
    vi.advanceTimersByTime(TIME_POLL_MS)

    expect(store.segmentIndex).toBe(0)
    expect(store.segmentElapsed).toBeGreaterThan(elapsedAtSwapStart)
    expect(store.segmentElapsed).toBeCloseTo(424 - 1.2, 5)
    expect(store.nativeTime).toBeCloseTo(424 - 1.2, 5)

    vi.advanceTimersByTime(2000)
    expect(store.segmentIndex).toBe(1)
    expect(store.crossfading).toBe(false)
  })

  it('identifies the current origin to YouTube for both buffers', async () => {
    await startPlayer()

    expect(FakePlayer.instances).toHaveLength(2)
    expect(FakePlayer.instances.every(player => player.options.playerVars?.origin === window.location.origin)).toBe(true)
  })

  it('waits for the preloaded first side to play before completing startup', async () => {
    FakePlayer.emitPlayingOnPlay = false
    const hostA = ref<HTMLElement | null>(document.createElement('div'))
    const hostB = ref<HTMLElement | null>(document.createElement('div'))
    const player = useDualBufferPlayer({ hostA, hostB })
    await player.prepare()

    const start = player.start()
    let settled = false
    void start.then(() => {
      settled = true
    })
    await flushMicrotasks()
    expect(settled).toBe(false)

    // Side A's prewarm never reported PLAYING, so startup cancelled it and asked for
    // playback itself rather than waiting the prewarm out. The first PLAYING that
    // arrives is therefore the show's own, and startup completes on it.
    FakePlayer.instances[0].events.onStateChange?.({ data: 1 })
    await start
    expect(settled).toBe(true)
  })

  it('does not finish Track 0 when a late prewarm state reports the source end before its opening frame', async () => {
    FakePlayer.emitPlayingOnPlay = false
    const store = useCinematicStore()
    store.enterCinematic()
    const player = buildPlayer()
    await player.prepare()
    const [playerA] = FakePlayer.instances

    playerA.duration = 424
    const startup = player.start()
    await flushMicrotasks()

    // A real IFrame can deliver its original prewarm PLAYING after startup has
    // already requested Track 0. Its first clock reply is then the old media's
    // terminal frame, before the opening seek reaches the player.
    playerA.currentTime = playerA.duration
    playerA.events.onStateChange?.({ data: 0 })

    expect(store.finished).toBe(false)
    expect(store.crossfading).toBe(false)
    expect(store.nativeTime).toBe(0)

    player.destroy()
    await startup
  })

  it('prewarms and parks the active side so Track 0 never enters the show cold', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    const player = buildPlayer()
    await player.prepare()
    const [playerA, playerB] = FakePlayer.instances

    // Track 0 is the first thing the audience hears and used to be the ONE buffer
    // that was never prewarmed: the Destiny trailer's audio stopped and the room sat
    // in silence on a black overlay while YouTube fetched the opening song.
    expect(playerA.cuedId).toBe(CINEMATIC_SEGMENTS[0].youtubeId)
    expect(playerA.playCount).toBeGreaterThan(0)
    expect(playerA.playing).toBe(false)
    expect(playerA.currentTime).toBe(0)
    expect(playerA.volume).toBe(0)
    expect(playerB.playCount).toBeGreaterThan(0)

    await player.start()

    expect(playerA.playing).toBe(true)
    expect(playerA.volume).toBe(100)
    expect(playerA.currentTime).toBe(0)
    // Promoted by seek from its park, not re-fetched: a cold loadVideoById here is
    // exactly the buffering gap this whole double buffer exists to avoid.
    expect(playerA.loadedId).toBe('')
  })

  it('retries a blocked startup muted so the real player can reach PLAYING', async () => {
    const player = await startPlayer()
    const [playerA] = FakePlayer.instances
    const playsBeforeRetry = playerA.playCount

    playerA.events.onAutoplayBlocked?.({})

    expect(playerA.muted).toBe(true)
    expect(playerA.playCount).toBe(playsBeforeRetry + 1)
    player.destroy()
  })

  it('lands the active side\'s park before startup raises the volume', async () => {
    FakePlayer.emitPlayingOnPlay = false
    const store = useCinematicStore()
    store.enterCinematic()
    const player = buildPlayer()
    await player.prepare()
    const [playerA] = FakePlayer.instances

    const start = player.start()
    await Promise.resolve()
    // The prewarm reports PLAYING only after start() was called. Its park sets volume
    // 0 and pauses; if that landed after startup the whole show would run silent.
    playerA.events.onStateChange?.({ data: 1 })
    await flushMicrotasks()

    expect(playerA.playing).toBe(true)
    expect(playerA.volume).toBe(100)

    vi.advanceTimersByTime(START_PLAYBACK_TIMEOUT_MS)
    await start
  })

  it('never reports the show paused when the ACTIVE side parks its prewarm', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    // The intro player owns the transport while the cinematic buffers prepare behind
    // it, and publishes that it is playing (WolvesApp does this from the intro
    // player's own state).
    store.setPlaying(true)

    const player = buildPlayer()
    await player.prepare()
    const [playerA] = FakePlayer.instances

    // The active side really was prewarmed and parked — the park's pause and seek
    // both ran, so this is not passing because nothing happened.
    expect(playerA.playCount).toBeGreaterThan(0)
    expect(playerA.playing).toBe(false)
    expect(playerA.currentTime).toBe(0)

    // Parking pauses the buffer, and that PAUSED describes the BUFFER, not the show.
    // Publishing it made the widget render "Play" while the intro was audibly playing
    // and inverted the presenter's play/pause control, because `togglePlay()` branches
    // on `store.playing`.
    expect(store.playing).toBe(true)

    player.destroy()
  })

  it('still reports a genuine pause of the on-air player', async () => {
    const store = useCinematicStore()
    const player = await startPlayer()
    const [playerA] = FakePlayer.instances
    expect(store.playing).toBe(true)

    // The presenter's control. Suppressing PAUSED wholesale would "fix" the park
    // problem by breaking the only pause the audience can see.
    player.togglePlay()
    expect(playerA.playing).toBe(false)
    expect(store.playing).toBe(false)

    player.togglePlay()
    expect(playerA.playing).toBe(true)
    expect(store.playing).toBe(true)

    player.destroy()
  })

  it('re-arms the transport when a parked buffer is promoted to air', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    const player = buildPlayer()
    await player.prepare()
    const [playerA] = FakePlayer.instances

    expect(playerA.playing).toBe(false)
    expect(store.playing).toBe(false)

    const startup = player.start()
    await flushMicrotasks()

    // Promotion is the show starting. A park's suppression that outlives its own
    // PAUSED would swallow this PLAYING and leave the widget reading "Play" for the
    // whole cinematic.
    expect(playerA.playing).toBe(true)
    expect(store.playing).toBe(true)

    await startup
    player.destroy()
  })

  it('re-arms the transport when startup hard-loads instead of promoting the park', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    const player = buildPlayer()
    await player.prepare()
    const [playerA] = FakePlayer.instances

    // Side A is parked on Part I, and its park has been acknowledged. The presenter
    // then selects a different part, so startup cannot promote the park and hard-loads
    // the target instead — a path that never clears the park's suppression itself.
    expect(playerA.cuedId).toBe(CINEMATIC_SEGMENTS[0].youtubeId)
    store.segmentIndex = 2

    const startup = player.start()
    await flushMicrotasks()

    expect(playerA.loadedId).toBe(CINEMATIC_SEGMENTS[2].youtubeId)
    expect(playerA.playing).toBe(true)
    expect(store.playing).toBe(true)

    await startup
    player.destroy()
  })

  it('does not go deaf to real transport events when a park PAUSED never arrives', async () => {
    FakePlayer.emitPausedOnPause = false
    const store = useCinematicStore()
    store.enterCinematic()
    const player = buildPlayer()
    await player.prepare()
    const [playerA] = FakePlayer.instances
    expect(playerA.playCount).toBeGreaterThan(0)

    // The park's pause event is lost. Promotion has to release the suppression by
    // itself; nothing else will.
    FakePlayer.emitPausedOnPause = true
    const startup = player.start()
    await flushMicrotasks()

    expect(playerA.playing).toBe(true)
    expect(store.playing).toBe(true)

    player.togglePlay()
    expect(store.playing).toBe(false)

    await startup
    player.destroy()
  })

  it('keeps the transport live on a promoted side whose park PAUSED was lost', async () => {
    FakePlayer.emitPausedOnPause = false
    const store = useCinematicStore()
    store.enterCinematic()
    const player = buildPlayer()
    await player.prepare()
    // Both parks are unacknowledged. From here the pauses land normally again.
    FakePlayer.emitPausedOnPause = true

    const startup = player.start()
    await flushMicrotasks()
    expect(store.playing).toBe(true)
    await startup

    const [playerA, playerB] = FakePlayer.instances
    playerA.duration = 424
    playerB.duration = 347

    advancePlayback(424_000)
    expect(player.activeSide.value).toBe('b')
    expect(store.segmentIndex).toBe(1)
    expect(store.playing).toBe(true)

    // Side B never acknowledged its park. It is on air now, so the presenter's pause
    // has to reach the store from it.
    player.togglePlay()
    expect(playerB.playing).toBe(false)
    expect(store.playing).toBe(false)

    player.destroy()
  })

  it('gives up waiting for PLAYING instead of hanging the show on a black frame', async () => {
    FakePlayer.emitPlayingOnPlay = false
    const store = useCinematicStore()
    store.enterCinematic()
    const player = buildPlayer()
    await player.prepare()
    const [playerA] = FakePlayer.instances

    const start = player.start()
    let settled = false
    void start.then(() => {
      settled = true
    })

    // The prewarm never reports PLAYING, and neither does the playback startup asked
    // for; the bounded wait is still running here.
    await vi.advanceTimersByTimeAsync(START_PLAYBACK_TIMEOUT_MS / 2)
    expect(settled).toBe(false)

    // Nothing reports PLAYING at all. The show runs unattended, so startup must not
    // block forever: it pushes play again, opens the poll loop, and proceeds.
    await vi.advanceTimersByTimeAsync(START_PLAYBACK_TIMEOUT_MS)
    await start

    expect(settled).toBe(true)
    playerA.currentTime = 7
    playerA.duration = 300

    // A stale clock in the body of the segment is not an opening-frame
    // confirmation. The runtime must reseek it instead of accepting five
    // duplicate polls as proof that playback is moving.
    vi.advanceTimersByTime(TIME_POLL_MS)
    expect(playerA.currentTime).toBe(0)
    vi.advanceTimersByTime(TIME_POLL_MS * OPENING_FRAME_CONFIRMATION_POLLS)
    expect(store.segmentElapsed).toBe(0)

    // Only advancing opening-frame clocks release the boundary guard.
    for (let i = 0; i < OPENING_FRAME_CONFIRMATION_POLLS; i += 1) {
      playerA.tickClock(0.1)
      vi.advanceTimersByTime(TIME_POLL_MS)
    }
    expect(store.segmentElapsed).toBeCloseTo(0.5)

    player.destroy()
  })

  it('settles pending startup and destroys the prepared buffers on teardown', async () => {
    FakePlayer.emitPlayingOnPlay = false
    const hostA = ref<HTMLElement | null>(document.createElement('div'))
    const hostB = ref<HTMLElement | null>(document.createElement('div'))
    const player = useDualBufferPlayer({ hostA, hostB })
    await player.prepare()

    const start = player.start()
    player.destroy()
    await start

    expect(FakePlayer.instances.every(instance => instance.destroyed)).toBe(true)
  })

  it('stops active playback and polling when the stage is torn down for intro navigation', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    const [playerA] = FakePlayer.instances
    playerA.currentTime = 12
    playerA.duration = 100
    vi.advanceTimersByTime(TIME_POLL_MS)
    expect(store.segmentElapsed).toBe(12)

    player.destroy()
    playerA.currentTime = 48
    vi.advanceTimersByTime(TIME_POLL_MS)

    expect(playerA.playing).toBe(false)
    expect(store.segmentElapsed).toBe(12)
  })

  it('destroys locally constructed players when unmounted before they become ready', async () => {
    FakePlayer.emitReadyOnConstruct = false
    const hostA = ref<HTMLElement | null>(document.createElement('div'))
    const hostB = ref<HTMLElement | null>(document.createElement('div'))
    const player = useDualBufferPlayer({ hostA, hostB })

    const prepare = player.prepare()
    await Promise.resolve()
    await Promise.resolve()
    expect(FakePlayer.instances).toHaveLength(2)

    player.destroy()

    await expect(prepare).rejects.toThrow('destroyed')
    expect(FakePlayer.instances.every(instance => instance.destroyed)).toBe(true)
  })

  it('allows a fresh muted prewarm after cancelling an unready prepare', async () => {
    FakePlayer.emitReadyOnConstruct = false
    const hostA = ref<HTMLElement | null>(document.createElement('div'))
    const hostB = ref<HTMLElement | null>(document.createElement('div'))
    const player = useDualBufferPlayer({ hostA, hostB })

    const cancelledPrepare = player.prepare()
    await Promise.resolve()
    await Promise.resolve()
    player.destroy()
    await expect(cancelledPrepare).rejects.toThrow('destroyed')

    FakePlayer.emitReadyOnConstruct = true
    await player.prepare()

    expect(FakePlayer.instances).toHaveLength(4)
    expect(FakePlayer.instances.slice(2).every(instance => instance.cuedId.length > 0)).toBe(true)
  })

  it('resets to side A before the fresh intro-to-cinematic prewarm starts Part I', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    FakePlayer.instances[0].events.onStateChange?.({ data: 0 })
    vi.advanceTimersByTime(2000)
    expect(player.activeSide.value).toBe('b')

    player.destroy()
    store.enterIntro()
    await player.prepare()
    store.enterCinematic()
    await player.start()

    expect(player.activeSide.value).toBe('a')
    expect(FakePlayer.instances[2].playing).toBe(true)
    expect(FakePlayer.instances[2].cuedId).toBe(CINEMATIC_SEGMENTS[0].youtubeId)
  })

  it('rejects preparation and releases both sides when a player errors before ready', async () => {
    FakePlayer.emitReadyOnConstruct = false
    const hostA = ref<HTMLElement | null>(document.createElement('div'))
    const hostB = ref<HTMLElement | null>(document.createElement('div'))
    const player = useDualBufferPlayer({ hostA, hostB })

    const prepare = player.prepare()
    await Promise.resolve()
    await Promise.resolve()
    FakePlayer.instances[0].events.onError?.({})

    await expect(prepare).rejects.toThrow('failed before readiness')
    expect(FakePlayer.instances.every(instance => instance.destroyed)).toBe(true)
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

  it('crossfades directly from Part I to Part II', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    store.enterCinematic()
    const [playerA, playerB] = FakePlayer.instances

    playerA.duration = 200
    playerA.currentTime = 200 - PRE_END_THRESHOLD_S
    vi.advanceTimersByTime(TIME_POLL_MS)

    expect(store.phase).toBe('cinematic')
    expect(player.activeSide.value).toBe('b')
    expect(playerB.playing).toBe(true)
  })

  it('starts directly from a selected cinematic segment', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.segmentIndex = 1

    await startPlayer()
    const [playerA, playerB] = FakePlayer.instances

    expect(playerA.cuedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
    expect(playerB.cuedId).toBe(CINEMATIC_SEGMENTS[2].youtubeId)
  })

  it('manual Next from Part I goes directly to Part II', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    store.enterCinematic()

    player.skip(1)

    expect(store.phase).toBe('cinematic')
    expect(player.activeSide.value).toBe('b')
    vi.advanceTimersByTime(2000)
    expect(store.segmentIndex).toBe(1)
  })

  it('skips forward and backward on manual command', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    const [playerA, playerB] = FakePlayer.instances

    store.updateTime(10, 300)
    player.skip(1)
    expect(player.activeSide.value).toBe('b')
    // Part II is already prewarmed on side B, so it is promoted, not reloaded: a
    // redundant loadVideoById restarts YouTube's decoder and pops.
    expect(playerB.cuedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
    expect(playerB.loadedId).toBe('')
    expect(playerB.playing).toBe(true)

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
    // to keep the trim capability covered. The runtime reads the store's active
    // experience segments, so the window is pinned there.
    const segment = useCinematicStore().segments[1] as { startSeconds?: number, endSeconds?: number }
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

    expect(store.phase).toBe('cinematic')
    expect(store.playing).toBe(false)

    player.skip(-1)
    vi.advanceTimersByTime(3000)
    expect(store.segmentIndex).toBe(CINEMATIC_SEGMENTS.length - 2)
  })

  it('gives the clock back after the show has finished and the presenter seeks away', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    for (let i = 0; i < CINEMATIC_SEGMENTS.length - 1; i++) {
      const active = player.activeSide.value === 'a' ? FakePlayer.instances[0] : FakePlayer.instances[1]
      active.duration = 1000
      active.currentTime = 1000
      vi.advanceTimersByTime(TIME_POLL_MS)
      vi.advanceTimersByTime(3000)
    }
    const active = player.activeSide.value === 'a' ? FakePlayer.instances[0] : FakePlayer.instances[1]
    active.duration = 1000
    active.currentTime = 1000
    vi.advanceTimersByTime(TIME_POLL_MS)
    expect(store.finished).toBe(true)
    expect(store.playing).toBe(false)

    // A real embed answers `getCurrentTime()` from a value it pushes across the
    // message channel, so the first polls after a seek still report the
    // pre-seek time. Model that: the seek lands on the player, but its clock
    // reports the end for another two polls. Without a guard those polls run
    // the end of the segment again — pause, `finish()`, `stopPolling()` — and
    // the backward seek the presenter just made is silently undone, with no
    // way to restart the clock live.
    const staleTime = active.currentTime
    const realSeek = active.seekTo.bind(active)
    active.seekTo = () => {}
    player.seekTo(120)
    vi.advanceTimersByTime(TIME_POLL_MS * 2)
    expect(active.currentTime).toBe(staleTime)

    active.seekTo = realSeek
    active.seekTo(120)
    vi.advanceTimersByTime(TIME_POLL_MS * 2)

    expect(store.finished).toBe(false)
    expect(store.nativeTime).toBe(120)
    expect(store.segmentIndex).toBe(CINEMATIC_SEGMENTS.length - 1)
  })

  it('abandons a stalled preparation instead of hanging the show on the intro overlay', async () => {
    // onReady never fires. `prepare()` awaits the shared API load and both readiness
    // callbacks, and neither await is bounded by the API itself.
    FakePlayer.emitReadyOnConstruct = false
    const store = useCinematicStore()
    store.enterCinematic()
    const player = buildPlayer()

    let settled = false
    const start = player.start().then(() => {
      settled = true
    })
    await flushMicrotasks()
    expect(FakePlayer.instances).toHaveLength(2)
    expect(settled).toBe(false)

    // Unbounded, this is a permanent hang: `start()` never returns, so
    // handleIntroComplete() never reaches introTransparent = true and the audience
    // watches an opaque intro overlay for the rest of the night.
    await vi.advanceTimersByTimeAsync(PREPARE_TIMEOUT_MS)
    await start
    expect(settled).toBe(true)
    expect(player.prepared.value).toBe(false)
    // Partial players are released, not left half-built behind the overlay.
    expect(FakePlayer.instances.every(instance => instance.destroyed)).toBe(true)

    // And a retry can actually recover, rather than re-awaiting the abandoned attempt.
    FakePlayer.emitReadyOnConstruct = true
    await player.start()
    expect(player.prepared.value).toBe(true)
    expect(FakePlayer.instances).toHaveLength(4)
    expect(FakePlayer.instances[2].playing).toBe(true)

    player.destroy()
  })

  it('discards a stalled API load so a retry requests the script again', async () => {
    // The loader caches its promise for the page's lifetime on purpose, but a cached
    // promise that never settles is a hang every later caller inherits — including the
    // stage rebuilding itself after a startup timeout.
    delete (window as any).YT
    appendStalledApiScript()

    invalidateYoutubeIframeApiLoad()
    expect(document.querySelectorAll('script[src*="iframe_api"]')).toHaveLength(0)

    // A load that already succeeded is left alone: the script must not be re-requested.
    installFakeYoutubeApi()
    const loaded = appendStalledApiScript()
    invalidateYoutubeIframeApiLoad()
    expect(document.querySelectorAll('script[src*="iframe_api"]')).toHaveLength(1)
    loaded.remove()
  })

  it('does not gate startup on a prewarm that has not settled', async () => {
    FakePlayer.emitPlayingOnPlay = false
    const store = useCinematicStore()
    store.enterCinematic()
    const player = buildPlayer()
    await player.prepare()
    const [playerA] = FakePlayer.instances
    const prewarmPlays = playerA.playCount

    const start = player.start()
    await flushMicrotasks()

    // Not one timer has advanced. Waiting for the park to settle burned the whole
    // prewarm timeout before playback was even REQUESTED, on top of the intro's 2s
    // audio fade-out: seconds of dead air in a theater. The prewarm is an
    // optimisation, never a gate.
    expect(playerA.playCount).toBeGreaterThan(prewarmPlays)
    expect(playerA.loadedId).toBe(CINEMATIC_SEGMENTS[0].youtubeId)
    expect(playerA.volume).toBe(100)

    // The abandoned prewarm's park must still never land on the running show.
    playerA.events.onStateChange?.({ data: 1 })
    await start
    expect(playerA.playing).toBe(true)
    expect(playerA.volume).toBe(100)
    expect(store.playing).toBe(true)

    player.destroy()
  })

  it('keeps the outgoing segment on air until a cold skip target reports playing', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    const [playerA, playerB] = FakePlayer.instances

    // Side B holds Part II, so a two-segment jump is cold: the target has no media.
    playerB.suppressPlayingEvent = true
    player.skip(2)

    // Fading out a player that is working, toward one that has not loaded, is silence
    // — and a black frame on the visible back-catalogue experiences.
    expect(player.activeSide.value).toBe('a')
    expect(playerA.playing).toBe(true)
    expect(playerA.volume).toBe(100)
    expect(playerB.loadedId).toBe(CINEMATIC_SEGMENTS[2].youtubeId)

    vi.advanceTimersByTime(COLD_SKIP_PLAYBACK_TIMEOUT_MS - 500)
    expect(player.activeSide.value).toBe('a')
    expect(playerA.volume).toBe(100)
    expect(store.segmentIndex).toBe(0)

    playerB.finishBuffering()
    expect(player.activeSide.value).toBe('b')
    vi.advanceTimersByTime(3000)
    expect(store.segmentIndex).toBe(2)
    expect(store.crossfading).toBe(false)

    player.destroy()
  })

  it('completes a cold skip whose target never plays instead of stranding the presenter', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    const [, playerB] = FakePlayer.instances

    playerB.suppressPlayingEvent = true
    player.skip(2)
    expect(player.activeSide.value).toBe('a')

    // Bounded: the wait protects the handoff, it does not own the show. On expiry the
    // swap commits anyway rather than latching `crossfading` forever.
    vi.advanceTimersByTime(COLD_SKIP_PLAYBACK_TIMEOUT_MS)
    expect(player.activeSide.value).toBe('b')
    vi.advanceTimersByTime(3000)
    expect(store.segmentIndex).toBe(2)
    expect(store.crossfading).toBe(false)

    player.destroy()
  })

  it('promotes an already parked skip target immediately, keeping the warm path fast', async () => {
    const player = await startPlayer()
    const store = useCinematicStore()
    const [, playerB] = FakePlayer.instances

    // Part II is parked on side B. No readiness wait belongs on this path.
    player.skip(1)
    expect(player.activeSide.value).toBe('b')
    expect(playerB.playing).toBe(true)
    expect(playerB.loadedId).toBe('')
    vi.advanceTimersByTime(2000)
    expect(store.segmentIndex).toBe(1)

    player.destroy()
  })

  it('leaves no bounded-wait timer running after teardown', async () => {
    const player = await startPlayer()
    const [, playerB] = FakePlayer.instances

    playerB.suppressPlayingEvent = true
    player.skip(2)
    player.destroy()

    const activeSideAfterDestroy = player.activeSide.value
    vi.advanceTimersByTime(COLD_SKIP_PLAYBACK_TIMEOUT_MS * 2)

    // A timer that outlives its lifecycle fires into a torn-down player.
    expect(player.activeSide.value).toBe(activeSideAfterDestroy)
    expect(FakePlayer.instances.every(instance => instance.destroyed)).toBe(true)
  })

  it('destroys both players on teardown', async () => {
    const player = await startPlayer()
    player.destroy()
    expect(FakePlayer.instances.every(instance => instance.destroyed)).toBe(true)
  })

  /**
   * Reported from a theater build as "Ghosts In The Mist is broken, the Avatar song
   * comes up instead": the words and the slides said Part II while the room heard
   * something else.
   *
   * The runtime promoted the prewarmed buffer on the strength of its own bookkeeping.
   * `sides[side].segmentIndex` is set the moment `cueVideoById()` is *called*, and was
   * never reconciled against the player, so a buffer whose media never attached still
   * looked like a ready Part II. The store advanced regardless, which is what put Part
   * II's title, chapter, and slides over the wrong audio.
   */
  describe('a boundary never promotes a buffer that is not holding its segment', () => {
    it('recovers Part II by reloading it when the prewarmed cue was refused', async () => {
      const store = useCinematicStore()
      // Ghosts In The Mist is refused when it is cued, exactly as a restricted or
      // transiently unavailable video is. Every other segment is fine.
      FakePlayer.failingVideoIds = new Set([CINEMATIC_SEGMENTS[1].youtubeId])

      const player = await startPlayer()
      const [playerA, playerB] = FakePlayer.instances
      playerA.duration = 424

      // The cue for Part II errored, so side B holds nothing at all — while its
      // bookkeeping still says "Part II, ready to go".
      expect(playerB.cuedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
      expect(playerB.getVideoData().video_id).toBe('')

      // The condition clears before the boundary, as a transient refusal does.
      FakePlayer.failingVideoIds = new Set()

      playerA.currentTime = 424 - 1.7
      vi.advanceTimersByTime(TIME_POLL_MS)
      expect(store.crossfading).toBe(true)

      // The boundary does not hand the show to a dead buffer: it reloads the authored
      // target, and Part II reaches the audience.
      expect(playerB.loadedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
      expect(playerB.getVideoData().video_id).toBe(CINEMATIC_SEGMENTS[1].youtubeId)

      vi.advanceTimersByTime(2000)
      expect(store.segmentIndex).toBe(1)
      expect(player.activeSide.value).toBe('b')
    })

    it('never runs Part II\'s identity over another segment\'s audio', async () => {
      const store = useCinematicStore()
      // Permanently unplayable: the cue is refused and so is the recovery load.
      FakePlayer.failingVideoIds = new Set([CINEMATIC_SEGMENTS[1].youtubeId])

      const player = await startPlayer()
      const [playerA, playerB] = FakePlayer.instances
      playerA.duration = 424

      playerA.currentTime = 424 - 1.7
      vi.advanceTimersByTime(TIME_POLL_MS)
      vi.advanceTimersByTime(COLD_SKIP_PLAYBACK_TIMEOUT_MS + 3000)

      // The show cannot invent media it does not have, so silence under Part II's
      // titles is the honest outcome. What must never happen is Part II's titles and
      // slides over a DIFFERENT song — that is the reported defect.
      const activePlayer = player.activeSide.value === 'a' ? playerA : playerB
      const onAir = activePlayer.getVideoData().video_id
      if (store.segmentIndex === 1 && onAir !== '') {
        expect(onAir).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
      }
      // And the buffer that is audible is never left playing a neighbouring segment.
      expect(onAir).not.toBe(CINEMATIC_SEGMENTS[2].youtubeId)
    })

    it('does not promote a buffer holding the previous segment as the next one', async () => {
      const store = useCinematicStore()
      await startPlayer()
      const [playerA, playerB] = FakePlayer.instances
      playerA.duration = 424

      // Bookkeeping says Part II, the media is still Part I — the exact drift the
      // browser probe caught against real YouTube players.
      playerB.videoId = CINEMATIC_SEGMENTS[0].youtubeId

      playerA.currentTime = 424 - 1.7
      vi.advanceTimersByTime(TIME_POLL_MS)

      // Identity, not position, decides. The stale buffer is reloaded with Part II.
      expect(playerB.loadedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
      expect(store.segmentIndex).toBe(0)
    })

    it('records an error on the INACTIVE buffer instead of discarding it', async () => {
      const store = useCinematicStore()
      const player = await startPlayer()
      const [playerA, playerB] = FakePlayer.instances
      playerA.duration = 424

      // An error about the next segment arrives while Part I is still playing. It
      // used to be dropped on the floor by a `side === activeSide` guard, so the
      // boundary had no way to know Part II was already dead.
      playerB.events.onError?.({ data: 150 })

      // The show does not lurch: Part I keeps playing.
      expect(store.segmentIndex).toBe(0)
      expect(player.activeSide.value).toBe('a')

      playerA.currentTime = 424 - 1.7
      vi.advanceTimersByTime(TIME_POLL_MS)

      // At the boundary the failure is acted on — the target is loaded fresh rather
      // than promoted blind.
      expect(playerB.loadedId).toBe(CINEMATIC_SEGMENTS[1].youtubeId)
    })

    it('keeps the prewarm of the next segment silent', async () => {
      const store = useCinematicStore()
      await startPlayer()
      const [playerA, playerB] = FakePlayer.instances
      playerA.duration = 424
      playerB.duration = 347

      // Part II prewarms underneath Part I and must not be audible.
      expect(playerB.audibleVolume).toBe(0)

      playerA.currentTime = 424 - 1.7
      vi.advanceTimersByTime(TIME_POLL_MS)
      vi.advanceTimersByTime(2000)
      expect(store.segmentIndex).toBe(1)

      // Side A is now prewarming Part III underneath Part II. A prewarm that is
      // audible is the second half of the reported symptom: the next song heard
      // over the current chapter's titles and slides.
      expect(playerA.cuedId).toBe(CINEMATIC_SEGMENTS[2].youtubeId)
      expect(playerA.audibleVolume).toBe(0)
    })

    it('opens the show audible even though both buffers prewarm muted', async () => {
      await startPlayer()
      const [playerA] = FakePlayer.instances

      // Both sides are muted while they prewarm. If the promotion path forgets to
      // lift that latch the entire show plays to a silent room, which no volume
      // assertion alone would catch.
      expect(playerA.muted).toBe(false)
      expect(playerA.audibleVolume).toBe(100)
    })

    /**
     * The cinematic buffers are built and prewarmed DURING the Destiny intro, minutes
     * before the show starts. Nothing in that window may become audible: the room is
     * watching the intro and hearing its audio.
     */
    it('stays silent through the intro, before the show has started', async () => {
      const player = buildPlayer()
      await player.prepare()
      await flushMicrotasks()

      const [playerA, playerB] = FakePlayer.instances

      // Both cinematic buffers prewarm here. Prewarming plays real media, so the
      // only thing keeping the room quiet is that both are muted.
      expect(playerA.audibleVolume).toBe(0)
      expect(playerB.audibleVolume).toBe(0)

      // A YouTube error during the intro must not start the show underneath it.
      playerA.events.onError?.({ data: 150 })
      await flushMicrotasks()
      // Let any crossfade this triggered actually run: the symptom is a segment
      // ramping UP over the intro, which a check taken before the ramp cannot see.
      vi.advanceTimersByTime(5000)

      expect(playerA.audibleVolume).toBe(0)
      expect(playerB.audibleVolume).toBe(0)
      // Nothing may be hard-loaded to air before the show has started.
      expect(playerB.loadedId).toBe('')
      player.destroy()
    })

    it('silences a buffer from the moment it is created, not from its first cue', async () => {
      const player = buildPlayer()
      await player.prepare()
      await flushMicrotasks()

      // A YouTube player is constructed at full volume and unmuted. Both buffers are
      // built during the intro, so the gap between construction and the first cue is
      // a window in which the cinematic can be heard under the intro — a real browser
      // observed a buffer sitting at volume 100, unmuted, in exactly that gap.
      // Silencing must therefore happen at readiness, BEFORE the first cue.
      for (const instance of FakePlayer.instances) {
        expect(instance.muted).toBe(true)
        expect(instance.audibleVolume).toBe(0)
        expect(instance.calls.indexOf('mute')).toBeGreaterThanOrEqual(0)
        expect(instance.calls.indexOf('mute')).toBeLessThan(instance.calls.indexOf('cueVideoById'))
      }
      player.destroy()
    })

    it('does not advance the cinematic before start() has been called', async () => {
      const store = useCinematicStore()
      const player = buildPlayer()
      await player.prepare()
      await flushMicrotasks()

      const [playerA, playerB] = FakePlayer.instances
      playerA.events.onError?.({ data: 150 })
      playerB.events.onError?.({ data: 150 })
      await flushMicrotasks()

      // The intro owns the screen and the clock until `start()` runs.
      expect(store.segmentIndex).toBe(0)
      expect(store.crossfading).toBe(false)
      player.destroy()
    })

    it('lifts the prewarm mute on the segment it promotes at a boundary', async () => {
      const store = useCinematicStore()
      await startPlayer()
      const [playerA, playerB] = FakePlayer.instances
      playerA.duration = 424
      playerB.duration = 347

      playerA.currentTime = 424 - 1.7
      vi.advanceTimersByTime(TIME_POLL_MS)
      vi.advanceTimersByTime(2000)

      expect(store.segmentIndex).toBe(1)
      expect(playerB.muted).toBe(false)
      expect(playerB.audibleVolume).toBeGreaterThan(0)
    })
  })
})
