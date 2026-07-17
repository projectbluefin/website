import type { Ref } from 'vue'
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import { ref } from 'vue'
import {
  getYoutubePlayerConstructor,
  getYoutubePlayerState,
  loadYoutubeIframeApi,
} from '@/composables/useYoutubeIframeApi'
import {
  CINEMATIC_SEGMENTS,
  PRE_END_THRESHOLD_S,
  segmentCrossfadeMs,
  TIME_POLL_MS,
} from '@/config/wolves-cinematic'
import { useCinematicStore } from '@/stores/cinematic'

export type PlayerSide = 'a' | 'b'

interface DualBufferOptions {
  hostA: Ref<HTMLElement | null>
  hostB: Ref<HTMLElement | null>
}

interface SideState {
  player: YoutubePlayer | null
  /** Segment index currently loaded (or cued) on this side. */
  segmentIndex: number
}

/**
 * Double-buffered YouTube playback. While one player is on screen playing segment N,
 * the other has segment N+1 cued, muted, and invisible. The handoff swaps opacity
 * (CSS, driven by `activeSide`) and ramps volumes; the freed player then cues N+2.
 *
 * A simpler single-player `loadVideoById` approach was rejected: it forces a visible
 * buffer/black gap at every boundary, which is the exact artifact this experience
 * must not have.
 */
export function useDualBufferPlayer(options: DualBufferOptions) {
  const store = useCinematicStore()
  const activeSide = ref<PlayerSide>('a')
  const prepared = ref(false)
  const started = ref(false)

  const sides: Record<PlayerSide, SideState> = {
    a: { player: null, segmentIndex: -1 },
    b: { player: null, segmentIndex: -1 },
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let swapping = false
  let rampFrame = 0
  let lifecycleToken = 0
  let preparePromise: Promise<void> | null = null
  let resolveStart: (() => void) | null = null

  const other = (side: PlayerSide): PlayerSide => (side === 'a' ? 'b' : 'a')
  const activePlayer = () => sides[activeSide.value].player

  function applyVolume(player: YoutubePlayer | null, volume: number) {
    player?.setVolume?.(Math.round(volume))
  }

  function cueNext(side: PlayerSide, segmentIndex: number) {
    const state = sides[side]
    if (!state.player || segmentIndex >= CINEMATIC_SEGMENTS.length) {
      state.segmentIndex = -1
      return
    }
    state.segmentIndex = segmentIndex
    const segment = CINEMATIC_SEGMENTS[segmentIndex]
    state.player.cueVideoById?.({ videoId: segment.youtubeId, startSeconds: segment.startSeconds })
    applyVolume(state.player, 0)
  }

  /** rAF volume ramp between the two players over the segment's crossfade window. */
  function rampVolumes(outgoing: YoutubePlayer | null, incoming: YoutubePlayer | null, durationMs: number, onDone: () => void) {
    cancelAnimationFrame(rampFrame)
    if (durationMs <= 0) {
      applyVolume(outgoing, 0)
      applyVolume(incoming, 100)
      onDone()
      return
    }

    const startedAt = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs)
      applyVolume(incoming, progress * 100)
      applyVolume(outgoing, (1 - progress) * 100)
      if (progress < 1) {
        rampFrame = requestAnimationFrame(tick)
      }
      else {
        onDone()
      }
    }
    rampFrame = requestAnimationFrame(tick)
  }

  /**
   * Intercepts the Part I -> Part II boundary (natural or manual) so the one-time
   * Creator Shorts interstitial plays instead of swapping straight into Part II
   * beneath it. Both players are paused and polling stops; `WolvesApp.vue` mounts
   * the interstitial for the `creator-shorts` phase and resumes playback afterward.
   */
  function enterCreatorShortsIfDue(targetIndex: number): boolean {
    if (!store.creatorShortsDueFor(targetIndex)) {
      return false
    }

    stopPolling()
    sides.a.player?.pauseVideo?.()
    sides.b.player?.pauseVideo?.()
    store.enterCreatorShorts()
    return true
  }

  function beginSwap() {
    if (swapping) {
      return
    }
    if (enterCreatorShortsIfDue(store.segmentIndex + 1)) {
      return
    }
    const fromSide = activeSide.value
    const toSide = other(fromSide)
    const outgoing = sides[fromSide].player
    const incoming = sides[toSide].player

    if (!incoming || sides[toSide].segmentIndex < 0) {
      // The last segment remains in the normal cinematic runtime so the transport
      // can still navigate backward instead of being replaced by a terminal plate.
      outgoing?.pauseVideo?.()
      store.finish()
      stopPolling()
      return
    }

    swapping = true
    const crossfadeMs = segmentCrossfadeMs(store.segmentIndex)
    store.beginCrossfade()

    applyVolume(incoming, 0)
    incoming.playVideo?.()
    activeSide.value = toSide // component CSS crossfades opacity on this change

    rampVolumes(outgoing, incoming, crossfadeMs, () => {
      outgoing?.pauseVideo?.()
      store.advanceSegment()
      cueNext(fromSide, store.segmentIndex + 1)
      swapping = false
    })
  }

  /**
   * Manual prev/next skip. Unlike the natural handoff, the inactive side has the
   * wrong video buffered for backward jumps or double-skips, so the target is
   * hard-loaded there; the transition overlay covers the brief buffering gap.
   */
  function skip(delta: number) {
    const target = Math.min(Math.max(store.segmentIndex + delta, 0), CINEMATIC_SEGMENTS.length - 1)
    if (swapping || target === store.segmentIndex) {
      return
    }
    if (enterCreatorShortsIfDue(target)) {
      return
    }
    const fromSide = activeSide.value
    const toSide = other(fromSide)
    const outgoing = sides[fromSide].player
    const incoming = sides[toSide].player
    if (!incoming) {
      return
    }

    swapping = true
    store.beginCrossfade()

    const segment = CINEMATIC_SEGMENTS[target]
    sides[toSide].segmentIndex = target
    applyVolume(incoming, 0)
    incoming.loadVideoById?.({ videoId: segment.youtubeId, startSeconds: segment.startSeconds })
    activeSide.value = toSide

    rampVolumes(outgoing, incoming, segmentCrossfadeMs(store.segmentIndex), () => {
      outgoing?.pauseVideo?.()
      store.jumpToSegment(target)
      cueNext(fromSide, target + 1)
      swapping = false
    })
  }

  function pollActiveTime() {
    const player = activePlayer()
    if (!player) {
      return
    }
    const segment = CINEMATIC_SEGMENTS[store.segmentIndex]
    const time = player.getCurrentTime?.() ?? 0
    const duration = player.getDuration?.() ?? 0
    // Authored trims: elapsed/duration are reported relative to the segment's own
    // window, while `time` stays on the video's native timeline for caption sync.
    const startAt = segment?.startSeconds ?? 0
    const endAt = segment?.endSeconds ?? duration
    if (!swapping) {
      store.updateTime(Math.max(0, time - startAt), Math.max(0, endAt - startAt), time)
    }
    // Swap slightly before the end to hide YouTube's trailing black frame (or, for
    // trimmed segments, right at the authored cutoff).
    if (!swapping && endAt > 0 && time >= endAt - PRE_END_THRESHOLD_S) {
      beginSwap()
    }
  }

  function startPolling() {
    if (!pollTimer) {
      pollTimer = setInterval(pollActiveTime, TIME_POLL_MS)
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function handleStateChange(side: PlayerSide, playerState: number) {
    const states = getYoutubePlayerState()
    if (side !== activeSide.value) {
      return
    }
    if (playerState === states.PLAYING) {
      store.setPlaying(true)
      startPolling()
      resolveStart?.()
      resolveStart = null
    }
    else if (playerState === states.PAUSED) {
      store.setPlaying(false)
    }
    else if (playerState === states.ENDED) {
      // Fallback if the pre-end poll tick was missed (tab throttling, etc).
      beginSwap()
    }
  }

  function createPlayer(side: PlayerSide, host: HTMLElement): Promise<YoutubePlayer> {
    return new Promise((resolve, reject) => {
      const PlayerCtor = getYoutubePlayerConstructor()
      if (!PlayerCtor) {
        reject(new Error('YouTube player constructor unavailable'))
        return
      }
      const player: YoutubePlayer = new PlayerCtor(host, {
        width: '100%',
        height: '100%',
        playerVars: {
          // Strip all YouTube chrome. modestbranding/showinfo are deprecated no-ops
          // upstream but harmless; kept for older embed behavior.
          controls: 0,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          modestbranding: 1,
        },
        events: {
          onReady: () => resolve(player),
          onStateChange: (event: { data: number }) => handleStateChange(side, event.data),
          onError: () => {
            // Skip an unplayable segment instead of stalling the whole cinematic.
            if (side === activeSide.value) {
              resolveStart?.()
              resolveStart = null
              beginSwap()
            }
          },
        },
      })
    })
  }

  /**
   * Constructs the existing double buffer and cues its first two segments without
   * starting playback. This lets the intro remain opaque until the cinematic is
   * ready to take over.
   */
  async function prepare(): Promise<void> {
    if (prepared.value) {
      return
    }
    if (preparePromise) {
      return preparePromise
    }

    const token = lifecycleToken
    const hostA = options.hostA.value
    const hostB = options.hostB.value
    if (!hostA || !hostB) {
      return
    }

    preparePromise = (async () => {
      await loadYoutubeIframeApi()
      if (token !== lifecycleToken) {
        return
      }

      const results = await Promise.allSettled([
        createPlayer('a', hostA),
        createPlayer('b', hostB),
      ])
      const playerA = results[0].status === 'fulfilled' ? results[0].value : null
      const playerB = results[1].status === 'fulfilled' ? results[1].value : null
      if (token !== lifecycleToken || !playerA || !playerB) {
        playerA?.destroy?.()
        playerB?.destroy?.()
        return
      }

      sides.a.player = playerA
      sides.b.player = playerB
      const startIndex = store.phase === 'cinematic' ? store.segmentIndex : 0
      cueNext('a', startIndex)
      cueNext('b', startIndex + 1)
      prepared.value = true
    })().finally(() => {
      if (token === lifecycleToken) {
        preparePromise = null
      }
    })

    return preparePromise
  }

  /** Must be called from a user gesture (the lobby entry click) to satisfy autoplay policy. */
  async function start(): Promise<void> {
    if (started.value) {
      return
    }

    await prepare()
    if (!prepared.value) {
      return
    }

    started.value = true
    const player = activePlayer()
    applyVolume(player, 100)
    const playVideo = player?.playVideo
    if (!playVideo) {
      started.value = false
      return
    }
    await new Promise<void>((resolve) => {
      resolveStart = resolve
      playVideo.call(player)
    })
  }

  function togglePlay() {
    const player = activePlayer()
    if (!player) {
      return
    }
    if (store.playing) {
      player.pauseVideo?.()
    }
    else {
      player.playVideo?.()
    }
  }

  function seekTo(seconds: number) {
    activePlayer()?.seekTo?.(seconds, true)
  }

  /** Seek within the current segment's authored window by 0..1 ratio (widget progress bar). */
  function seekToRatio(ratio: number) {
    if (store.segmentDuration <= 0) {
      return
    }
    const startAt = CINEMATIC_SEGMENTS[store.segmentIndex]?.startSeconds ?? 0
    const clamped = Math.min(Math.max(ratio, 0), 1)
    activePlayer()?.seekTo?.(startAt + clamped * store.segmentDuration, true)
  }

  function destroy() {
    lifecycleToken += 1
    stopPolling()
    cancelAnimationFrame(rampFrame)
    resolveStart?.()
    resolveStart = null
    sides.a.player?.destroy?.()
    sides.b.player?.destroy?.()
    sides.a.player = null
    sides.b.player = null
    prepared.value = false
    started.value = false
    swapping = false
  }

  return { activeSide, prepared, started, prepare, start, togglePlay, seekTo, seekToRatio, skip, destroy }
}
