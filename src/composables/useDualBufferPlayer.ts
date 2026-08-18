import type { Ref } from 'vue'
import type { YoutubePlayer } from '@/composables/useYoutubeIframeApi'
import { ref } from 'vue'
import {
  getChromeFreeYoutubePlayerVars,
  getYoutubePlayerConstructor,
  getYoutubePlayerState,
  invalidateYoutubeIframeApiLoad,
  loadYoutubeIframeApi,
  suppressYoutubeCaptions,
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
  /** This side has fetched media and is parked on its segment's opening frame. */
  parked: boolean
  /**
   * The YouTube API reported an error for the media on this side. A buffer that has
   * failed still carries a perfectly plausible `segmentIndex`, so without this flag a
   * dead buffer is indistinguishable from a ready one and gets promoted at the next
   * boundary — the show then displays that segment's title, chapter, and slides over
   * silence. Cleared by any fresh cue or load.
   */
  failed: boolean
  /** Last IFrame API error code for this side, retained for browser diagnostics. */
  errorCode: number | null
  /**
   * A park is in flight on this side. Parking pauses and seeks the player, and
   * those events describe the *buffer*, not the show. Once the active side was
   * prewarmed too, its own park reported PAUSED to the store and the transport
   * read "Play" over a playing intro.
   *
   * Cleared by the park's own `PAUSED`, and by promotion / re-cue / release so a
   * dropped event cannot leave a side permanently deaf. A counter was tried, to
   * catch a park `PAUSED` arriving *after* promotion; it is not needed. The API
   * delivers state changes FIFO over one postMessage channel, so the park's
   * pause always precedes the promotion's play — and a counter turned a dropped
   * event into a swallowed *real* pause, which is the worse failure.
   */
  parking: boolean
}

/**
 * How long `start()` will wait for preparation — the shared API script load plus both
 * `onReady` callbacks — before abandoning it. Both of those awaits are unbounded in the
 * API itself: a stalled script or an `onReady` that never fires used to hang `start()`
 * forever, which hangs `handleIntroComplete()`, which leaves the audience staring at an
 * opaque intro overlay with nobody in the booth. Ten seconds is far longer than a real
 * preparation (sub-second on a warm cache, a couple of seconds cold on theater wifi)
 * and still bounds the worst case at this plus `START_PLAYBACK_TIMEOUT_MS`.
 */
export const PREPARE_TIMEOUT_MS = 10_000

/**
 * How long a cold manual skip keeps the outgoing segment on air waiting for the newly
 * loaded target to report PLAYING. Sized to sit inside the transition overlay's hold so
 * the wait stays covered; on expiry the swap commits anyway rather than stranding the
 * presenter mid-skip.
 */
export const COLD_SKIP_PLAYBACK_TIMEOUT_MS = 3000

/**
 * How long startup will wait for the active player to report PLAYING. The show runs
 * unattended: an unbounded wait here is a black frame that nobody can recover from,
 * so the wait is bounded and falls back to pushing play and opening the poll loop.
 */
export const START_PLAYBACK_TIMEOUT_MS = 8000
/** Consecutive advancing opening-frame clocks required before startup trusts player time. */
export const OPENING_FRAME_CONFIRMATION_POLLS = 5
/** A cold start farther into the segment than this is not its opening frame. */
export const OPENING_FRAME_MAX_DRIFT_S = 1
/** Duplicate iframe clock messages do not prove that playback is moving. */
export const OPENING_FRAME_ADVANCE_EPSILON_S = 0.01

/**
 * Polls after a seek during which the end-of-segment boundary check is stood
 * down.
 *
 * `getCurrentTime()` is a value the embed pushes across the message channel, so
 * the first polls after a seek can still report the pre-seek time. Five polls
 * is half a second at `TIME_POLL_MS`, which is well inside the shortest
 * authored segment and long enough for the embed to acknowledge the seek.
 */
export const SEEK_GUARD_POLLS = 5

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
    a: { player: null, segmentIndex: -1, prewarming: false, parked: false, parking: false, failed: false, errorCode: null },
    b: { player: null, segmentIndex: -1, prewarming: false, parked: false, parking: false, failed: false, errorCode: null },
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null
  /** Remaining polls to ignore the end-of-segment boundary for; see `SEEK_GUARD_POLLS`. */
  let seekGuardPolls = 0
  /**
   * Startup must not publish a late prewarm clock reply. The opening seek and
   * the IFrame's time updates travel over separate channels, so an old terminal
   * timestamp can otherwise make Track 0 appear finished before its first frame
   * arrives.
   */
  let awaitingOpeningFrame = false
  let openingFrameConfirmationPolls = 0
  let openingFrameLastTime: number | null = null
  let swapping = false
  /**
   * The side that is still on air for store purposes while a swap runs. `activeSide`
   * flips to the incoming buffer the moment the fade starts, but `store.segmentIndex`
   * keeps naming the outgoing segment until the ramp completes.
   */
  let swapOutgoingSide: PlayerSide | null = null
  let rampFrame = 0
  let lifecycleToken = 0
  let preparePromise: Promise<void> | null = null
  let resolveStart: (() => void) | null = null
  let startTimeout: ReturnType<typeof setTimeout> | null = null
  /**
   * Every bounded-wait timer this composable has in flight. `destroy()` clears the set:
   * a timer that outlives its lifecycle fires into a torn-down player, and a timer that
   * is never cleared is exactly the hang these bounds exist to prevent.
   */
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>()
  /** The side a cold skip is loading, while the outgoing side stays on air. */
  let coldSkipSide: PlayerSide | null = null
  /** Commits the pending cold skip (flip + ramp); cleared once it has run. */
  let commitColdSkip: (() => void) | null = null
  let coldSkipTimeout: ReturnType<typeof setTimeout> | null = null
  const pendingReadyRejectors = new Set<(reason: Error) => void>()

  const other = (side: PlayerSide): PlayerSide => (side === 'a' ? 'b' : 'a')
  const activePlayer = () => sides[activeSide.value].player

  function releasePlayers() {
    sides.a.player?.destroy?.()
    sides.b.player?.destroy?.()
    for (const side of ['a', 'b'] as PlayerSide[]) {
      const state = sides[side]
      state.player = null
      state.segmentIndex = -1
      state.prewarming = false
      state.parked = false
      state.parking = false
      state.failed = false
      state.errorCode = null
    }
    awaitingOpeningFrame = false
    openingFrameConfirmationPolls = 0
    openingFrameLastTime = null
  }

  /** Every bounded wait's timer, so `destroy()` can never leave one running. */
  function clearPendingTimers() {
    for (const timer of pendingTimers) {
      clearTimeout(timer)
    }
    pendingTimers.clear()
  }

  /** Drop a cold skip's pending readiness wait; safe to call repeatedly. */
  function clearColdSkipWait() {
    if (coldSkipTimeout) {
      pendingTimers.delete(coldSkipTimeout)
      clearTimeout(coldSkipTimeout)
      coldSkipTimeout = null
    }
    coldSkipSide = null
    commitColdSkip = null
  }

  /**
   * Tear down a preparation that never finished. Everything the normal cancellation path
   * does — bump the lifecycle token so the in-flight `prepare()` cannot publish players
   * behind us, reject the pending `onReady` promises, destroy the half-built players —
   * plus dropping the cached API-load promise. Without that last step a retry re-awaits
   * the same never-resolving script load and cannot recover.
   */
  function abandonPreparation() {
    lifecycleToken += 1
    preparePromise = null
    prepared.value = false
    rejectPendingReadiness(new Error('YouTube player preparation timed out'))
    releasePlayers()
    invalidateYoutubeIframeApiLoad()
  }

  /**
   * Run `prepare()` under a deadline. Resolves true only when the double buffer really
   * is built. A rejection resolves false rather than propagating: `handleIntroComplete()`
   * awaits `start()` before it makes the intro overlay transparent, so a throw here is
   * the same permanent opaque-overlay hang as a stall.
   */
  function prepareWithinDeadline(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let deadline: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        deadline = null
        abandonPreparation()
        resolve(false)
      }, PREPARE_TIMEOUT_MS)
      pendingTimers.add(deadline)
      const settle = (ready: boolean) => {
        if (deadline) {
          pendingTimers.delete(deadline)
          clearTimeout(deadline)
          deadline = null
        }
        resolve(ready)
      }
      prepare().then(() => settle(prepared.value), () => settle(false))
    })
  }

  function clearStartTimeout() {
    if (startTimeout) {
      clearTimeout(startTimeout)
      startTimeout = null
    }
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
    state.parked = false
    state.parking = false
    state.failed = false
    state.errorCode = null
    if (!state.player || segmentIndex >= store.segments.length) {
      state.segmentIndex = -1
      state.prewarming = false
      return
    }
    state.segmentIndex = segmentIndex
    const segment = store.segments[segmentIndex]
    state.player.cueVideoById?.({ videoId: segment.youtubeId, startSeconds: segment.startSeconds })
    applyVolume(state.player, 0)

    // Prewarm the buffer so the segment has real media buffered before it goes to
    // air. `playVideo` is the only reliable way to make YouTube fetch media, so it
    // is started and then parked again the instant it reports PLAYING (see
    // `parkPrewarmedSide`). Leaving it running was a show-breaking defect: its clock
    // advanced for the whole outgoing segment, so the handoff joined the next track
    // wherever that clock had reached — the back half of the cinematic opened
    // mid-song and ran minutes short.
    //
    // BOTH sides prewarm, including the active one. Skipping the active side left
    // Track 0 — the first thing the audience hears — as the only buffer that ever
    // entered cold, so the Destiny trailer's audio stopped and the room sat in
    // silence on a black overlay while YouTube fetched the opening song. `start()`
    // waits for this park before it raises the volume.
    state.prewarming = true
    // Mute, do not merely zero the volume. A prewarm plays real media for real time,
    // and `cueVideoById` is processed asynchronously: a volume pushed before the new
    // video is attached can be reset when it lands, which makes the NEXT segment
    // audible underneath the current one — the next song playing over the current
    // chapter's titles and slides. `mute()` is a separate latch that survives the
    // video change, and every path that puts a side on air lifts it.
    state.player.mute?.()
    state.player.playVideo?.()
    applyVolume(state.player, 0)
  }

  /**
   * What this buffer is actually holding, or null when that cannot be determined.
   * `getVideoData` is undocumented and throws before a player has media, so a null
   * answer means "unknown", never "wrong".
   */
  function loadedVideoId(side: PlayerSide): string | null {
    try {
      return sides[side].player?.getVideoData?.()?.video_id ?? null
    }
    catch {
      return null
    }
  }

  /**
   * Whether a buffer can be put on air for `segmentIndex` right now.
   *
   * `sides[side].segmentIndex` is only ever a record of what this composable *asked*
   * for; it is set the instant `cueVideoById()` is called and is never reconciled
   * against the player. A cue that errored, was rejected for this origin, or simply
   * never landed leaves the intent in place, so promoting on intent alone puts a dead
   * or stale buffer on air while the store advances anyway — the audience gets the
   * next chapter's title and slides over the wrong audio, or over nothing at all.
   *
   * An unknown video id is treated as usable: the check exists to catch a buffer that
   * is provably wrong, not to add a new way for the show to refuse to advance.
   */
  function bufferCanPlay(side: PlayerSide, segmentIndex: number): boolean {
    const state = sides[side]
    if (!state.player || state.failed || state.segmentIndex !== segmentIndex) {
      return false
    }
    const expected = store.segments[segmentIndex]?.youtubeId
    if (!expected) {
      return false
    }
    const actual = loadedVideoId(side)
    return actual === null || actual === expected
  }

  /**
   * Record that the media on a side failed. This must happen for the INACTIVE side
   * too: that buffer is the next segment, and an error nobody wrote down is a segment
   * that goes to air silent while the show confidently relabels itself.
   */
  function markSideFailed(side: PlayerSide, errorCode: number | null = null) {
    const state = sides[side]
    state.failed = true
    state.errorCode = errorCode
    state.parked = false
    state.prewarming = false
    state.parking = false
  }

  /** Park a buffer that has finished prewarming back on its authored opening frame. */
  function parkPrewarmedSide(side: PlayerSide) {
    const state = sides[side]
    state.prewarming = false
    // Everything this function makes the player emit is buffer bookkeeping, not
    // playback. Suppress it until the pause lands.
    state.parking = true
    state.player?.pauseVideo?.()
    state.player?.seekTo?.(openingFrame(state.segmentIndex), true)
    applyVolume(state.player, 0)
    state.parked = true
  }

  /**
   * Promote a buffer to air. The seek is the guarantee: whatever the buffer did
   * while it was prewarming, a segment always begins on its authored opening frame.
   */
  function startIncoming(side: PlayerSide, audible = true) {
    const state = sides[side]
    state.prewarming = false
    state.parked = false
    // Promotion outranks any park still in flight: this side is going to air, so
    // its transport events are the show's again. This is also what releases a
    // side whose park `PAUSED` was dropped.
    state.parking = false
    // Lift the prewarm's mute latch. Without this the segment reaches the screen
    // and the crossfade ramps a volume nobody can hear.
    if (audible) {
      state.player?.unMute?.()
    }
    state.player?.seekTo?.(openingFrame(state.segmentIndex), true)
    state.player?.playVideo?.()
  }

  /**
   * The fade for a boundary belongs to the INCOMING segment, matching `transitionLore`,
   * which is authored per-incoming on the same config records. Both the ramp and the
   * lead that triggers it read through here so a fade can never be started earlier or
   * later than the fade it actually runs.
   */
  function boundaryCrossfadeMs(targetIndex: number): number {
    return store.crossfadeMsAt(targetIndex)
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
    // The cinematic buffers are built and prewarmed during the Destiny intro, minutes
    // before the audience is meant to hear anything from them. A boundary that runs in
    // that window puts a segment on air underneath the intro — a song playing over the
    // whole opening. Nothing may advance the show before `start()` has run.
    if (swapping || !started.value || awaitingOpeningFrame) {
      return
    }
    const fromSide = activeSide.value
    const toSide = other(fromSide)
    const outgoing = sides[fromSide].player
    const incoming = sides[toSide].player
    const targetIndex = store.segmentIndex + 1

    if (!incoming || targetIndex >= store.segments.length) {
      // The last segment remains in the normal cinematic runtime so the transport
      // can still navigate backward instead of being replaced by a terminal plate.
      outgoing?.pauseVideo?.()
      store.finish()
      stopPolling()
      return
    }

    swapping = true
    swapOutgoingSide = fromSide
    const crossfadeMs = boundaryCrossfadeMs(targetIndex)
    store.beginCrossfade(targetIndex)
    sides[toSide].segmentIndex = targetIndex
    applyVolume(incoming, 0)

    const commit = () => {
      // This side is going to air now, whether it was promoted warm or loaded cold.
      sides[toSide].player?.unMute?.()
      activeSide.value = toSide // component CSS crossfades opacity on this change
      rampVolumes(outgoing, incoming, crossfadeMs, () => {
        outgoing?.pauseVideo?.()
        store.advanceSegment()
        swapOutgoingSide = null
        cueNext(fromSide, store.segmentIndex + 1)
        swapping = false
      })
    }

    // The prewarmed buffer is only promoted when it is really holding this segment.
    // Promoting on bookkeeping alone is how a failed or stale buffer reached the
    // screen: the store advances regardless, so the audience got the next chapter's
    // title, chapter number, and slides over the wrong song or over silence.
    if (bufferCanPlay(toSide, targetIndex)) {
      startIncoming(toSide)
      commit()
      return
    }

    // Recover the boundary rather than surrender it. Hard-load the authored target and
    // keep the outgoing segment on air and audible until the incoming really reports
    // PLAYING — the same guarantee the cold-skip path gives the presenter, and bounded
    // for the same reason: a show that stalls here has nobody in the booth.
    loadColdInto(toSide, targetIndex, commit)
  }

  /**
   * Hard-load `segmentIndex` into `side` and run `commit` once it is genuinely playing.
   * Bounded: on expiry the swap commits anyway, because a stalled boundary in front of
   * a live audience is worse than a rough one.
   */
  function loadColdInto(side: PlayerSide, segmentIndex: number, commit: () => void) {
    const state = sides[side]
    const player = state.player
    const segment = store.segments[segmentIndex]
    if (!player || !segment) {
      commit()
      return
    }
    state.segmentIndex = segmentIndex
    state.prewarming = false
    state.parked = false
    state.parking = false
    state.failed = false
    clearColdSkipWait()
    coldSkipSide = side
    commitColdSkip = commit
    const deadline = setTimeout(() => {
      pendingTimers.delete(deadline)
      const commitOnTimeout = commitColdSkip
      clearColdSkipWait()
      player.playVideo?.()
      commitOnTimeout?.()
    }, COLD_SKIP_PLAYBACK_TIMEOUT_MS)
    pendingTimers.add(deadline)
    coldSkipTimeout = deadline
    player.loadVideoById?.({ videoId: segment.youtubeId, startSeconds: segment.startSeconds })
    // `loadVideoById` autoplays, and the real API restores the player's own volume
    // when the new media attaches. This side is not on air yet — the outgoing segment
    // is still playing — so re-assert silence and let `commit()` lift it.
    player.mute?.()
    applyVolume(player, 0)
  }

  /**
   * Manual prev/next skip. Unlike the natural handoff, the inactive side has the
   * wrong video buffered for backward jumps or double-skips, so the target is
   * hard-loaded there; the transition overlay covers the brief buffering gap.
   */
  function skip(delta: number) {
    const target = Math.min(Math.max(store.segmentIndex + delta, 0), store.segments.length - 1)
    // Same reason as `beginSwap`: nothing may put a segment on air while the intro
    // still owns the room.
    if (swapping || !started.value || target === store.segmentIndex) {
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
    swapOutgoingSide = fromSide
    store.beginCrossfade(target)

    const targetIsPreloaded = bufferCanPlay(toSide, target)
    sides[toSide].segmentIndex = target
    applyVolume(incoming, 0)

    const commit = () => {
      sides[toSide].player?.unMute?.()
      activeSide.value = toSide // component CSS crossfades opacity on this change
      rampVolumes(outgoing, incoming, boundaryCrossfadeMs(target), () => {
        outgoing?.pauseVideo?.()
        store.jumpToSegment(target)
        swapOutgoingSide = null
        cueNext(fromSide, target + 1)
        swapping = false
      })
    }

    // Forward skips normally target the already-prewarmed buffer, which is parked
    // on its opening frame; promoting it avoids the decoder restart (and audible
    // pop) that a redundant load would cause. This path is fast and stays fast:
    // the buffer has media, so it goes to air immediately. `bufferCanPlay` is what
    // keeps it honest — a buffer whose cue failed is loaded cold instead.
    if (targetIsPreloaded) {
      startIncoming(toSide)
      commit()
      return
    }

    // Cold path (backward or multi-segment jumps, or a buffer that failed): the
    // target has no usable media yet. Fading out a player that is working, toward
    // one that has not loaded, is silence — and for the visible back-catalogue
    // experiences, a black frame. Keep the outgoing side on air and audible until
    // the incoming actually reports PLAYING.
    loadColdInto(toSide, target, commit)
  }

  function pollActiveTime() {
    // While a swap runs, `activeSide` already names the INCOMING buffer but
    // `store.segmentIndex` still names the outgoing segment, so the outgoing side is
    // the only clock whose time matches the identity the store is publishing. Reading
    // the incoming buffer here would report the new track's position against the old
    // segment. Keeping the outgoing clock alive is what stops the transport bar from
    // sticking for the whole fade and then snapping to zero at `advanceSegment()`.
    const timeSide = swapping && swapOutgoingSide ? swapOutgoingSide : activeSide.value
    const player = sides[timeSide].player
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
    if (awaitingOpeningFrame) {
      if (endAt <= 0) {
        return
      }
      const outsideOpeningWindow = time < startAt - OPENING_FRAME_ADVANCE_EPSILON_S
        || time > startAt + OPENING_FRAME_MAX_DRIFT_S
      if (outsideOpeningWindow) {
        player.seekTo?.(startAt, true)
        player.playVideo?.()
        openingFrameConfirmationPolls = 0
        openingFrameLastTime = null
        return
      }
      // IFrame clock messages can repeat while media is buffering. Five copies
      // of one timestamp prove only that polling runs; require the clock itself
      // to advance before startup may trust it for segment boundaries.
      if (openingFrameLastTime !== null
        && time <= openingFrameLastTime + OPENING_FRAME_ADVANCE_EPSILON_S) {
        return
      }
      openingFrameLastTime = time
      openingFrameConfirmationPolls += 1
      if (openingFrameConfirmationPolls < OPENING_FRAME_CONFIRMATION_POLLS) {
        return
      }
      awaitingOpeningFrame = false
      openingFrameLastTime = null
    }
    store.updateTime(Math.max(0, time - startAt), Math.max(0, endAt - startAt), time)
    if (swapping) {
      return
    }
    // A crossfade has to BEGIN one crossfade-length before the end, not finish there.
    // Leading by PRE_END_THRESHOLD_S alone meant the outgoing track reached its real
    // end 0.3s into a fade lasting up to 2.5s: the room heard the song stop dead and
    // the next one rise out of silence, with a hole in the music between them. Leading
    // by the full window lets the outgoing decay across its own final seconds while the
    // incoming comes up underneath it, which is what "one song becomes the next" means.
    // The lead reads the same incoming-segment fade `beginSwap()` will ramp with.
    // The last segment has nothing to fade into, so it keeps the short trailing lead
    // that only hides YouTube's black frame.
    const swapLeadSeconds = store.isLastSegment
      ? PRE_END_THRESHOLD_S
      : PRE_END_THRESHOLD_S + boundaryCrossfadeMs(store.segmentIndex + 1) / 1000
    // A just-issued seek has not necessarily reached the iframe yet.
    // `getCurrentTime()` is a value the embed pushes across the message channel,
    // so the first polls after a seek can still report the PRE-seek time — and
    // if the show had just ended, that stale time is past the boundary. Acting
    // on it re-runs the end of the segment: the player is paused, `finish()`
    // re-latches, polling stops, and the backward seek the presenter just made
    // is undone with no way to recover. Ride out a bounded number of polls
    // instead of racing the embed.
    if (seekGuardPolls > 0) {
      seekGuardPolls -= 1
      return
    }
    if (endAt > 0 && time >= endAt - swapLeadSeconds) {
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
    // A park in flight is buffer bookkeeping. Its pause/seek must never reach the
    // store, or prewarming the *active* side reports the show as paused.
    if (sides[side].parking) {
      if (playerState === states.PAUSED) {
        sides[side].parking = false
      }
      return
    }
    // A cold skip held the outgoing side on air until this moment. The incoming
    // buffer now has media, so the fade can start against something that is really
    // playing instead of against silence.
    if (coldSkipSide === side && playerState === states.PLAYING) {
      const commit = commitColdSkip
      clearColdSkipWait()
      commit?.()
    }
    // The buffers are live IFrame players while the intro owns the room.
    // Delayed PLAYING/ENDED messages from that prewarm must not start the
    // cinematic poller or advance its state before `start()` takes ownership.
    if (!started.value) {
      return
    }
    if (side !== activeSide.value) {
      return
    }
    if (playerState === states.PLAYING) {
      if (awaitingOpeningFrame) {
        sides[side].player?.unMute?.()
        applyVolume(sides[side].player, 100)
      }
      store.setPlaying(true)
      startPolling()
      resolveStart?.()
      resolveStart = null
    }
    else if (playerState === states.PAUSED) {
      store.setPlaying(false)
    }
    else if (playerState === states.ENDED) {
      if (awaitingOpeningFrame) {
        // This END belongs to the prewarm request that was still in YouTube's
        // message queue when the show promoted the side. It is not a Track 0
        // boundary: put the active player back on its authored first frame and
        // wait for its real PLAYING lifecycle before allowing normal boundaries.
        startIncoming(side)
        return
      }
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
        // A fresh player is created at full volume and unmuted. Both buffers are
        // built during the intro, so a side is silenced from the moment it exists
        // rather than from its first cue — the gap between the two is a window in
        // which the cinematic can be heard under the intro. Every path to air lifts
        // this latch explicitly.
        player.mute?.()
        applyVolume(player, 0)
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
          // The cinematic tracks are music videos with their own caption
          // tracks. Suppressed here for the same reason as the intro: a viewer
          // preference for captions otherwise paints YouTube's own subtitles
          // over the projection. `onApiChange` is when the module actually
          // arrives; `onReady` covers a player that already had it.
          onApiChange: () => suppressYoutubeCaptions(player),
          onReady: () => {
            suppressYoutubeCaptions(player)
            resolveReady(player)
          },
          onStateChange: (event: { data: number }) => handleStateChange(side, event.data),
          onError: (event: { data?: number }) => {
            if (rejectBeforeReady(new Error('YouTube player failed before readiness'))) {
              return
            }
            // Write the failure down for EVERY side, not just the one on air. An
            // error on the inactive buffer is an error about the NEXT segment, and
            // it used to be discarded entirely: the boundary then promoted a dead
            // player, the store advanced anyway, and the show ran that segment's
            // title, chapter, and slides over silence.
            markSideFailed(side, event.data ?? null)
            // A cold load that failed is never going to report PLAYING, so release
            // the wait it is holding instead of letting the boundary sit on its
            // timeout with the outgoing segment stranded on air.
            if (coldSkipSide === side) {
              const commit = commitColdSkip
              clearColdSkipWait()
              commit?.()
              return
            }
            // Skip an unplayable segment instead of stalling the whole cinematic.
            if (side === activeSide.value) {
              resolveStart?.()
              resolveStart = null
              beginSwap()
            }
          },
          onAutoplayBlocked: () => {
            if (side !== activeSide.value || !started.value) {
              return
            }
            // The documented recovery is another scripted play. Keep it muted
            // for that retry; PLAYING restores the audience volume above.
            sides[side].player?.mute?.()
            applyVolume(sides[side].player, 100)
            sides[side].player?.playVideo?.()
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

    await prepareWithinDeadline()
    if (!prepared.value || started.value) {
      return
    }

    const side = activeSide.value
    const state = sides[side]
    // The prewarm is an OPTIMISATION, NEVER A GATE. Blocking startup on the active
    // side's park burns the whole prewarm timeout before playback is even requested,
    // while the intro overlay is already fading its audio out — dead air in front of
    // the audience, which is worse than entering cold. So: if the park has landed,
    // take the fast path and promote it; if it has not, cancel the prewarm and ask
    // for playback right now. Clearing `prewarming` here is also the guard that stops
    // a late park from pausing and muting the show after the volume goes up.
    const segment = store.segments[store.segmentIndex]
    // Identity, not position: a parked buffer is only promoted when it is really
    // holding the segment the show is about to open on.
    const promoteParked = bufferCanPlay(side, store.segmentIndex) && state.parked && Boolean(segment)
    const requiresOpeningFrameConfirmation = !state.parked
    state.prewarming = false

    const player = state.player
    const playVideo = player?.playVideo
    if (!player || !playVideo) {
      return
    }

    started.value = true
    awaitingOpeningFrame = requiresOpeningFrameConfirmation
    openingFrameConfirmationPolls = 0
    openingFrameLastTime = null
    // A player that did not finish parking must start muted. The intro's click
    // has long expired by this handoff, so YouTube can reject an unmuted play;
    // a muted start is policy-safe and is made audible on its PLAYING event.
    if (!requiresOpeningFrameConfirmation) {
      player.unMute?.()
    }
    applyVolume(player, 100)
    // Album entry stays deterministic. Previously that meant an explicit
    // `loadVideoById`, because a bare cue-then-play could race YouTube's async cue
    // processing and begin on the prewarmed next segment. A parked buffer gives the
    // same guarantee without the cold fetch: `startIncoming` seeks to the authored
    // opening frame before playing, so the show can only begin on Track 0's first
    // frame. Anything else (no park, or the store moved under us) still hard-loads.
    await new Promise<void>((resolve) => {
      const settle = () => {
        clearStartTimeout()
        resolveStart = null
        resolve()
      }
      resolveStart = settle
      // The show runs unattended: never wait forever on a black frame. If YouTube
      // stalls, push play once more, open the poll loop, and let the cinematic
      // proceed rather than hanging with nobody in the booth.
      startTimeout = setTimeout(() => {
        startTimeout = null
        player.playVideo?.()
        startPolling()
        settle()
      }, START_PLAYBACK_TIMEOUT_MS)

      if (promoteParked) {
        startIncoming(side, !requiresOpeningFrameConfirmation)
      }
      else if (player.loadVideoById && segment) {
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

  /**
   * What each buffer is *actually* holding, versus what this composable believes it
   * holds. `sides[side].segmentIndex` is bookkeeping intent recorded by `cueNext()`;
   * `getVideoData().video_id` is the only ground truth about the media a player will
   * emit when it is promoted. Nothing else in the runtime compares the two, which is
   * why a buffer drifting off its intended segment is silent.
   */
  function bufferSnapshot() {
    const describe = (side: PlayerSide) => {
      const state = sides[side]
      const intendedIndex = state.segmentIndex
      const intended = store.segments[intendedIndex]?.youtubeId ?? null
      let actual: string | null = null
      try {
        actual = state.player?.getVideoData?.()?.video_id ?? null
      }
      catch {
        actual = null
      }
      return {
        side,
        intendedIndex,
        intended,
        actual,
        matches: intended !== null && actual !== null ? intended === actual : null,
        parked: state.parked,
        prewarming: state.prewarming,
        parking: state.parking,
        failed: state.failed,
        errorCode: state.errorCode,
        active: activeSide.value === side,
        muted: (() => {
          try {
            return state.player?.isMuted?.() ?? null
          }
          catch {
            return null
          }
        })(),
        volume: (() => {
          try {
            return state.player?.getVolume?.() ?? null
          }
          catch {
            return null
          }
        })(),
        /** What the room would actually hear from this buffer right now. */
        audible: (() => {
          try {
            if (state.player?.isMuted?.()) {
              return 0
            }
            return state.player?.getVolume?.() ?? 0
          }
          catch {
            return 0
          }
        })(),
        time: (() => {
          try {
            return state.player?.getCurrentTime?.() ?? null
          }
          catch {
            return null
          }
        })(),
        duration: (() => {
          try {
            return state.player?.getDuration?.() ?? null
          }
          catch {
            return null
          }
        })(),
      }
    }
    return {
      storeSegmentIndex: store.segmentIndex,
      pendingSegmentIndex: store.pendingSegmentIndex,
      activeSide: activeSide.value,
      swapping,
      awaitingOpeningFrame,
      openingFrameConfirmationPolls,
      a: describe('a'),
      b: describe('b'),
    }
  }

  function seekTo(seconds: number) {
    activePlayer()?.seekTo?.(seconds, true)
    // The final segment stops the poll loop when it finishes. Without this the
    // store's clock would stay pinned at the end after a backward seek, so
    // anything derived from published time — the Director's Cut finale's chrome
    // suppression, the progress readout — would never come back.
    resumePollingAfterSeek()
  }

  /** Seek within the current segment's authored window by 0..1 ratio (widget progress bar). */
  function seekToRatio(ratio: number) {
    if (store.segmentDuration <= 0) {
      return
    }
    const startAt = store.segments[store.segmentIndex]?.startSeconds ?? 0
    const clamped = Math.min(Math.max(ratio, 0), 1)
    activePlayer()?.seekTo?.(startAt + clamped * store.segmentDuration, true)
    resumePollingAfterSeek()
  }

  /**
   * Restart the time poll after a seek, but only for a show that has already
   * started. Polling during the prewarm window would publish a buffer's time as
   * the show's, which is the same defect `beginSwap()` guards against.
   *
   * The guard counter is armed here rather than in `pollActiveTime` because it
   * has to cover the polls issued between the seek request and the embed
   * acknowledging it — see the comment on `seekGuardPolls` in `pollActiveTime`.
   */
  function resumePollingAfterSeek() {
    seekGuardPolls = SEEK_GUARD_POLLS
    if (started.value) {
      startPolling()
    }
  }

  function destroy() {
    lifecycleToken += 1
    preparePromise = null
    stopPolling()
    cancelAnimationFrame(rampFrame)
    clearStartTimeout()
    clearColdSkipWait()
    clearPendingTimers()
    resolveStart?.()
    resolveStart = null
    rejectPendingReadiness(new Error('YouTube player destroyed before readiness'))
    releasePlayers()
    activeSide.value = 'a'
    prepared.value = false
    started.value = false
    swapping = false
    swapOutgoingSide = null
  }

  return { activeSide, prepared, started, prepare, start, togglePlay, seekTo, seekToRatio, skip, destroy, bufferSnapshot }
}
