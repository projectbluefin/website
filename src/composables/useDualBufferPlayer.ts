import type { Ref } from 'vue'
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import { ref } from 'vue'
import {
  getChromeFreeYoutubePlayerVars,
  getYoutubePlayerConstructor,
  getYoutubePlayerState,
  loadYoutubeIframeApi,
} from '@/composables/useYoutubeIframeApi'
import {
  PRE_END_THRESHOLD_S,
  TIME_POLL_MS,
  VOLUME_STEP_MS,
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
  /**
   * This side was told to play only to force YouTube to fetch media, and must be
   * parked back on its opening frame as soon as it reports PLAYING.
   */
  prewarming: boolean
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
    a: { player: null, segmentIndex: -1, prewarming: false },
    b: { player: null, segmentIndex: -1, prewarming: false },
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let swapping = false
  let rampFrame = 0
  let lifecycleToken = 0
  let preparePromise: Promise<void> | null = null
  let resolveStart: (() => void) | null = null
  const pendingReadyRejectors = new Set<(reason: Error) => void>()

  const other = (side: PlayerSide): PlayerSide => (side === 'a' ? 'b' : 'a')
  const activePlayer = () => sides[activeSide.value].player

  function releasePlayers() {
    sides.a.player?.destroy?.()
    sides.b.player?.destroy?.()
    sides.a.player = null
    sides.b.player = null
    sides.a.segmentIndex = -1
    sides.b.segmentIndex = -1
    sides.a.prewarming = false
    sides.b.prewarming = false
  }

  /** Native timeline position a segment must be sitting on before it goes to air. */
  function openingFrame(segmentIndex: number): number {
    return store.segments[segmentIndex]?.startSeconds ?? 0
  }

  function rejectPendingReadiness(reason: Error) {
    for (const rejectBeforeReady of [...pendingReadyRejectors]) {
      rejectBeforeReady(reason)
    }
  }

  function applyVolume(player: YoutubePlayer | null, volume: number) {
    player?.setVolume?.(Math.round(volume))
  }

  function cueNext(side: PlayerSide, segmentIndex: number) {
    const state = sides[side]
    if (!state.player || segmentIndex >= store.segments.length) {
      state.segmentIndex = -1
      state.prewarming = false
      return
    }
    state.segmentIndex = segmentIndex
    const segment = store.segments[segmentIndex]
    state.player.cueVideoById?.({ videoId: segment.youtubeId, startSeconds: segment.startSeconds })
    applyVolume(state.player, 0)

    // Prewarm the inactive buffer so the next segment has real media buffered
    // before the handoff. `playVideo` is the only reliable way to make YouTube
    // fetch media, so it is started and then parked again the instant it reports
    // PLAYING (see `parkPrewarmedSide`). Leaving it running was a show-breaking
    // defect: its clock advanced for the whole outgoing segment, so the handoff
    // joined the next track wherever that clock had reached — the back half of
    // the cinematic opened mid-song and ran minutes short.
    if (side !== activeSide.value) {
      state.prewarming = true
      state.player.playVideo?.()
    }
  }

  /** Park a buffer that has finished prewarming back on its authored opening frame. */
  function parkPrewarmedSide(side: PlayerSide) {
    const state = sides[side]
    state.prewarming = false
    state.player?.pauseVideo?.()
    state.player?.seekTo?.(openingFrame(state.segmentIndex), true)
    applyVolume(state.player, 0)
  }

  /**
   * Promote a buffer to air. The seek is the guarantee: whatever the buffer did
   * while it was prewarming, a segment always begins on its authored opening frame.
   */
  function startIncoming(side: PlayerSide) {
    const state = sides[side]
    state.prewarming = false
    state.player?.seekTo?.(openingFrame(state.segmentIndex), true)
    state.player?.playVideo?.()
  }

  /**
   * rAF volume ramp between the two players over the segment's crossfade window.
   *
   * Equal-power (sin/cos), not linear: two uncorrelated tracks summed on a linear
   * ramp lose about 3 dB at the midpoint, which the room hears as the music sagging
   * exactly where the fade should be seamless.
   *
   * Volume is pushed at `VOLUME_STEP_MS`, not every frame. Each `setVolume` is a
   * cross-origin postMessage into the iframe; at 60fps across two players a long
   * fade posts hundreds of them during the same moments the transition overlay is
   * animating. The audible resolution of a 0-100 volume ramp does not need 60Hz.
   */
  function rampVolumes(outgoing: YoutubePlayer | null, incoming: YoutubePlayer | null, durationMs: number, onDone: () => void) {
    cancelAnimationFrame(rampFrame)
    if (durationMs <= 0) {
      applyVolume(outgoing, 0)
      applyVolume(incoming, 100)
      onDone()
      return
    }

    const startedAt = performance.now()
    let lastPushedAt = -Infinity
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs)
      if (progress >= 1 || now - lastPushedAt >= VOLUME_STEP_MS) {
        lastPushedAt = now
        applyVolume(incoming, Math.sin((progress * Math.PI) / 2) * 100)
        applyVolume(outgoing, Math.cos((progress * Math.PI) / 2) * 100)
      }
      if (progress < 1) {
        rampFrame = requestAnimationFrame(tick)
      }
      else {
        onDone()
      }
    }
    rampFrame = requestAnimationFrame(tick)
  }

  function beginSwap() {
    if (swapping) {
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
    const crossfadeMs = store.crossfadeMsAt(store.segmentIndex)
    store.beginCrossfade(store.segmentIndex + 1)

    applyVolume(incoming, 0)
    startIncoming(toSide)
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
    const target = Math.min(Math.max(store.segmentIndex + delta, 0), store.segments.length - 1)
    if (swapping || target === store.segmentIndex) {
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
    store.beginCrossfade(target)

    const segment = store.segments[target]
    const targetIsPreloaded = sides[toSide].segmentIndex === target
    sides[toSide].segmentIndex = target
    applyVolume(incoming, 0)
    // Forward skips normally target the already-prewarmed buffer, which is parked
    // on its opening frame; promoting it avoids the decoder restart (and audible
    // pop) that a redundant load would cause. Only hard-load when the target is
    // not preloaded (backward or multi-segment jumps).
    if (targetIsPreloaded) {
      startIncoming(toSide)
    }
    else {
      sides[toSide].prewarming = false
      incoming.loadVideoById?.({ videoId: segment.youtubeId, startSeconds: segment.startSeconds })
    }
    activeSide.value = toSide

    rampVolumes(outgoing, incoming, store.crossfadeMsAt(store.segmentIndex), () => {
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
    const segment = store.segments[store.segmentIndex]
    const time = player.getCurrentTime?.() ?? 0
    const duration = player.getDuration?.() ?? 0
    // Authored trims: elapsed/duration are reported relative to the segment's own
    // window, while `time` stays on the video's native timeline for caption sync.
    const startAt = segment?.startSeconds ?? 0
    const endAt = segment?.endSeconds ?? duration
    if (!swapping) {
      store.updateTime(Math.max(0, time - startAt), Math.max(0, endAt - startAt), time)
    }
    // A crossfade has to BEGIN one crossfade-length before the end, not finish there.
    // Leading by PRE_END_THRESHOLD_S alone meant the outgoing track reached its real
    // end 0.3s into a fade lasting up to 2.5s: the room heard the song stop dead and
    // the next one rise out of silence, with a hole in the music between them. Leading
    // by the full window lets the outgoing decay across its own final seconds while the
    // incoming comes up underneath it, which is what "one song becomes the next" means.
    // The last segment has nothing to fade into, so it keeps the short trailing lead
    // that only hides YouTube's black frame.
    const swapLeadSeconds = store.isLastSegment
      ? PRE_END_THRESHOLD_S
      : PRE_END_THRESHOLD_S + store.crossfadeMsAt(store.segmentIndex) / 1000
    if (!swapping && endAt > 0 && time >= endAt - swapLeadSeconds) {
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
    if (sides[side].prewarming && playerState === states.PLAYING) {
      // It has media; that is all the prewarm was for. Put it back on its mark.
      parkPrewarmedSide(side)
      return
    }
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
      let settled = false
      const rejectBeforeReady = (reason: Error): boolean => {
        if (settled) {
          return false
        }
        settled = true
        pendingReadyRejectors.delete(rejectBeforeReady)
        reject(reason)
        return true
      }
      const resolveReady = (player: YoutubePlayer) => {
        if (settled) {
          return
        }
        settled = true
        pendingReadyRejectors.delete(rejectBeforeReady)
        resolve(player)
      }
      const PlayerCtor = getYoutubePlayerConstructor()
      if (!PlayerCtor) {
        rejectBeforeReady(new Error('YouTube player constructor unavailable'))
        return
      }
      const player: YoutubePlayer = new PlayerCtor(host, {
        width: '100%',
        height: '100%',
        playerVars: getChromeFreeYoutubePlayerVars(),
        events: {
          onReady: () => resolveReady(player),
          onStateChange: (event: { data: number }) => handleStateChange(side, event.data),
          onError: () => {
            if (rejectBeforeReady(new Error('YouTube player failed before readiness'))) {
              return
            }
            // Skip an unplayable segment instead of stalling the whole cinematic.
            if (side === activeSide.value) {
              resolveStart?.()
              resolveStart = null
              beginSwap()
            }
          },
        },
      })
      sides[side].player = player
      pendingReadyRejectors.add(rejectBeforeReady)
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

      try {
        await Promise.all([
          createPlayer('a', hostA),
          createPlayer('b', hostB),
        ])
        if (token !== lifecycleToken) {
          releasePlayers()
          return
        }

        const startIndex = store.phase === 'cinematic' ? store.segmentIndex : 0
        cueNext('a', startIndex)
        cueNext('b', startIndex + 1)
        prepared.value = true
      }
      catch (error) {
        rejectPendingReadiness(new Error('YouTube player preparation cancelled'))
        releasePlayers()
        throw error
      }
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
    const segment = store.segments[store.segmentIndex]
    const playVideo = player?.playVideo
    if (!player || !playVideo) {
      started.value = false
      return
    }
    await new Promise<void>((resolve) => {
      resolveStart = resolve
      // Re-load the active side explicitly at startup. A cue followed immediately
      // by play can race YouTube's async cue processing and begin on the already
      // prewarmed next segment; the explicit load makes album entry deterministic.
      if (player.loadVideoById && segment) {
        player.loadVideoById({ videoId: segment.youtubeId, startSeconds: segment.startSeconds })
      }
      else {
        playVideo.call(player)
      }
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
    const startAt = store.segments[store.segmentIndex]?.startSeconds ?? 0
    const clamped = Math.min(Math.max(ratio, 0), 1)
    activePlayer()?.seekTo?.(startAt + clamped * store.segmentDuration, true)
  }

  function destroy() {
    lifecycleToken += 1
    preparePromise = null
    stopPolling()
    cancelAnimationFrame(rampFrame)
    resolveStart?.()
    resolveStart = null
    rejectPendingReadiness(new Error('YouTube player destroyed before readiness'))
    releasePlayers()
    activeSide.value = 'a'
    prepared.value = false
    started.value = false
    swapping = false
  }

  return { activeSide, prepared, started, prepare, start, togglePlay, seekTo, seekToRatio, skip, destroy }
}
