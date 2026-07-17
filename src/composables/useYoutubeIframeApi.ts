/**
 * Shared loader for the YouTube IFrame Player API script.
 *
 * Extracted so any component embedding a real YouTube video (a legitimate `youtubeVideoId`
 * reference, never a downloaded/re-encoded local copy) can reuse the same script-load dance
 * instead of duplicating it across the intro, cinematic, and interstitial players
 * for the playlist player; this composable is used by newer embeds (e.g. the intro overlay)
 * to avoid a second divergent implementation.
 */

export interface YoutubePlayer {
  playVideo?: () => void
  pauseVideo?: () => void
  getCurrentTime?: () => number
  getDuration?: () => number
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void
  destroy?: () => void
  /** Reads the player's current volume level (0–100). */
  getVolume?: () => number
  /** Sets the player's volume level (0–100). */
  setVolume?: (volume: number) => void
  /** Mutes the player's audio output entirely. */
  mute?: () => void
  /** Restores the player's audio output after `mute`. */
  unMute?: () => void
  /**
   * Detaches an internal player module. Used with 'captions' (html5 player) and
   * 'cc' (legacy) to force YouTube's own closed captions off — `cc_load_policy: 0`
   * only defers to the viewer's account preference, it cannot disable them.
   */
  unloadModule?: (module: string) => void
  /** Loads and immediately plays a new video in this same player instance. */
  loadVideoById?: (video: string | { videoId: string, startSeconds?: number }) => void
  /**
   * Loads a new video into this player without playing it — used to silently preload the
   * next video on an inactive side of a ping-pong player pair so switching is instant.
   */
  cueVideoById?: (video: string | { videoId: string, startSeconds?: number }) => void
}

export interface YoutubePlayerState {
  ENDED: number
  PLAYING: number
  PAUSED: number
  BUFFERING: number
  CUED: number
}

type YoutubePlayerConstructor = new (element: Element, options: Record<string, unknown>) => YoutubePlayer

interface YoutubeIframeWindow extends Window {
  YT?: {
    Player?: YoutubePlayerConstructor
    PlayerState?: YoutubePlayerState
  }
  onYouTubeIframeAPIReady?: (() => void) | null
}

const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api'

let apiPromise: Promise<void> | null = null

export function loadYoutubeIframeApi(): Promise<void> {
  const youtubeWindow = window as YoutubeIframeWindow

  if (youtubeWindow.YT?.Player) {
    return Promise.resolve()
  }

  if (apiPromise) {
    return apiPromise
  }

  apiPromise = new Promise((resolve, reject) => {
    let settled = false
    let script = document.querySelector(`script[src="${IFRAME_API_SRC}"]`) as HTMLScriptElement | null

    const finish = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true
      callback()
    }

    const handleError = () => {
      apiPromise = null
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
      script.src = IFRAME_API_SRC
      script.async = true
      script.addEventListener('error', handleError)
      document.head.appendChild(script)
      return
    }

    script.addEventListener('error', handleError)
  })

  return apiPromise
}

export function getYoutubePlayerConstructor(): YoutubePlayerConstructor | undefined {
  return (window as YoutubeIframeWindow).YT?.Player
}

export function getYoutubePlayerState(): YoutubePlayerState {
  return (window as YoutubeIframeWindow).YT?.PlayerState ?? {
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
  }
}

let activeFadeTimer: ReturnType<typeof setInterval> | null = null

/**
 * Stops any in-progress volume fade initiated by `fadePlayerVolume`.
 * Safe to call even when no fade is running.
 */
export function cancelPlayerVolumeFade(): void {
  if (activeFadeTimer) {
    clearInterval(activeFadeTimer)
    activeFadeTimer = null
  }
}

/**
 * Smoothly fades a YouTube player's volume to `targetVolume` over `durationMs`.
 *
 * - If the player does not expose `setVolume`, the fade is skipped and `onComplete` is called
 *   immediately so callers can fall back cleanly.
 * - Uses `getVolume` as the starting point when available; otherwise assumes 100.
 * - A new fade cancels any previous fade, preventing overlapping ramps.
 */
export function fadePlayerVolume(
  player: YoutubePlayer | null | undefined,
  targetVolume: number,
  durationMs: number,
  onComplete?: () => void,
): void {
  cancelPlayerVolumeFade()

  if (!player || typeof player.setVolume !== 'function') {
    onComplete?.()
    return
  }

  const startVolume = typeof player.getVolume === 'function'
    ? (player.getVolume() ?? 100)
    : 100

  if (startVolume === targetVolume) {
    onComplete?.()
    return
  }

  const steps = Math.max(1, Math.floor(durationMs / 50))
  const increment = (targetVolume - startVolume) / steps
  let step = 0

  activeFadeTimer = setInterval(() => {
    step++
    const volume = step >= steps
      ? targetVolume
      : Math.round(startVolume + increment * step)
    player.setVolume?.(volume)

    if (step >= steps) {
      cancelPlayerVolumeFade()
      onComplete?.()
    }
  }, durationMs / steps)
}

/**
 * Test-only escape hatch: the API-load promise is cached at module scope (intentional in
 * production — the script should only ever be requested once per page), which would leak
 * stale state between otherwise-isolated test cases. Call this from `beforeEach`/`afterEach`
 * in tests that mock/unmock `window.YT`.
 */
export function resetYoutubeIframeApiCacheForTests(): void {
  apiPromise = null
}
