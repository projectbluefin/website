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
  /** False when Spotify supplies the soundtrack: both YouTube players stay muted. */
  audioEnabled: boolean
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
  const started = ref(false)

  const sides: Record<PlayerSide, SideState> = {
    a: { player: null, segmentIndex: -1 },
    b: { player: null, segmentIndex: -1 },
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let swapping = false
  let rampFrame = 0

  const other = (side: PlayerSide): PlayerSide => (side === 'a' ? 'b' : 'a')
  const activePlayer = () => sides[activeSide.value].player

  function applyVolume(player: YoutubePlayer | null, volume: number) {
    if (options.audioEnabled) {
      player?.setVolume?.(Math.round(volume))
    }
  }

  function cueNext(side: PlayerSide, segmentIndex: number) {
    const state = sides[side]
    if (!state.player || segmentIndex >= CINEMATIC_SEGMENTS.length) {
      state.segmentIndex = -1
      return
    }
    state.segmentIndex = segmentIndex
    state.player.cueVideoById?.(CINEMATIC_SEGMENTS[segmentIndex].youtubeId)
    applyVolume(state.player, 0)
  }

  /** rAF volume ramp between the two players over the segment's crossfade window. */
  function rampVolumes(outgoing: YoutubePlayer | null, incoming: YoutubePlayer | null, durationMs: number, onDone: () => void) {
    cancelAnimationFrame(rampFrame)
    if (!options.audioEnabled || durationMs <= 0) {
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

  function beginSwap() {
    if (swapping) {
      return
    }
    const fromSide = activeSide.value
    const toSide = other(fromSide)
    const outgoing = sides[fromSide].player
    const incoming = sides[toSide].player

    if (!incoming || sides[toSide].segmentIndex < 0) {
      // Nothing buffered: last segment just ended.
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

  function pollActiveTime() {
    const player = activePlayer()
    if (!player) {
      return
    }
    const time = player.getCurrentTime?.() ?? 0
    const duration = player.getDuration?.() ?? 0
    if (!swapping) {
      store.updateTime(time, duration)
    }
    // Swap slightly before the end to hide YouTube's trailing black frame.
    if (!swapping && duration > 0 && time >= duration - PRE_END_THRESHOLD_S) {
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
              beginSwap()
            }
          },
        },
      })
    })
  }

  /** Must be called from a user gesture (the lobby entry click) to satisfy autoplay policy. */
  async function start(): Promise<void> {
    if (started.value || !options.hostA.value || !options.hostB.value) {
      return
    }
    started.value = true

    await loadYoutubeIframeApi()
    const [playerA, playerB] = await Promise.all([
      createPlayer('a', options.hostA.value),
      createPlayer('b', options.hostB.value),
    ])
    sides.a.player = playerA
    sides.b.player = playerB

    if (!options.audioEnabled) {
      // Spotify owns the soundtrack; YouTube must never emit audio.
      playerA.mute?.()
      playerB.mute?.()
    }

    sides.a.segmentIndex = 0
    playerA.loadVideoById?.(CINEMATIC_SEGMENTS[0].youtubeId)
    applyVolume(playerA, 100)
    cueNext('b', 1)
    startPolling()
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

  function destroy() {
    stopPolling()
    cancelAnimationFrame(rampFrame)
    sides.a.player?.destroy?.()
    sides.b.player?.destroy?.()
    sides.a.player = null
    sides.b.player = null
  }

  return { activeSide, started, start, togglePlay, seekTo, destroy }
}
