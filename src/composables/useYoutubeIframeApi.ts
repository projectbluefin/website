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
  /** Whether the mute latch is set. Volume alone does not answer this. */
  isMuted?: () => boolean
  /** Loads and immediately plays a new video in this same player instance. */
  loadVideoById?: (video: string | { videoId: string, startSeconds?: number, endSeconds?: number }) => void
  /**
   * Loads a new video into this player without playing it — used to silently preload the
   * next video on an inactive side of a ping-pong player pair so switching is instant.
   */
  cueVideoById?: (video: string | { videoId: string, startSeconds?: number, endSeconds?: number }) => void
  /**
   * Ground truth about the media this player is actually holding. `cueVideoById` and
   * `loadVideoById` are requests; this is the only way to observe whether one landed.
   * Undocumented but long-stable on the IFrame API, so every call site treats it as
   * optional and tolerates it throwing before the player has media.
   */
  getVideoData?: () => { video_id?: string, title?: string } | undefined
  /**
   * Tears a player module back out. The `captions` module is the only one this
   * show unloads; see `suppressYoutubeCaptions`.
   *
   * Not listed in the current IFrame API reference — it survives from the older
   * JS Player API — so every call site treats it as optional and tolerates it
   * being absent or throwing.
   */
  unloadModule?: (module: string) => void
  /** Module names the player currently exposes options for, e.g. `['captions']`. */
  getOptions?: () => string[] | undefined
}

/**
 * Module names YouTube has used for the closed-caption module.
 *
 * Both are tried because the name has differed across player versions: the
 * modern player exposes `captions` (as `getOptions()` reports), while older
 * builds — and the AS3-era player the method predates — used `cc`. Unloading a
 * module the player does not have is a no-op, so trying both costs nothing and
 * missing the one in use costs the show a caption bar across the projection.
 */
const YOUTUBE_CAPTION_MODULES = ['captions', 'cc'] as const

/**
 * Force YouTube's own captions off for a player.
 *
 * `cc_load_policy: 0` is only a *default*. A viewer whose YouTube account or
 * browser prefers captions gets them regardless, and this show burns in its own
 * authored subtitles — so YouTube's track lands on top of ours, in a different
 * typeface, on a theater screen, with nobody in the room able to dismiss it.
 *
 * Unloading the module is the part that actually holds. It must be re-applied
 * on `onApiChange`, not only on `onReady`: that event fires precisely when the
 * player loads or unloads a module, which is how the caption module arrives
 * after the stream's own caption track resolves — well after the player is
 * otherwise ready.
 */
export function suppressYoutubeCaptions(player: YoutubePlayer | null | undefined): void {
  if (!player?.unloadModule) {
    return
  }
  for (const module of YOUTUBE_CAPTION_MODULES) {
    try {
      player.unloadModule(module)
    }
    catch {
      // A module the player never loaded, or a player mid-teardown. Neither is
      // recoverable and neither should take the show down.
    }
  }
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

// Supported YouTube IFrame parameters. Deprecated branding/UI flags such as
// `showinfo`, `autohide`, and `modestbranding` are intentionally omitted: the
// current API ignores them and they do not remove YouTube branding overlays.
const CHROME_FREE_YOUTUBE_PLAYER_VARS = {
  controls: 0,
  cc_load_policy: 0,
  disablekb: 1,
  fs: 0,
  iv_load_policy: 3,
  playsinline: 1,
  rel: 0,
} as const

export function getChromeFreeYoutubePlayerVars(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined
  const widgetReferrer = typeof window !== 'undefined' ? window.location.href : undefined
  return {
    ...CHROME_FREE_YOUTUBE_PLAYER_VARS,
    ...(origin ? { origin } : {}),
    ...(widgetReferrer ? { widget_referrer: widgetReferrer } : {}),
    ...overrides,
  }
}

export function getChromeFreeYoutubeEmbedParams(overrides: Record<string, unknown> = {}): URLSearchParams {
  const params = new URLSearchParams()
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined
  for (const [key, value] of Object.entries({ ...CHROME_FREE_YOUTUBE_PLAYER_VARS, ...overrides, ...(origin ? { origin } : {}) })) {
    if (value == null) {
      continue
    }
    params.set(key, String(value))
  }
  return params
}

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

/**
 * Discard a cached API load that never resolved, so a retry can actually request the
 * script again. The promise is cached for the lifetime of the page on purpose, but a
 * stalled load caches a promise that will never settle: every later caller — including
 * the cinematic stage rebuilding itself after a startup timeout — would await the same
 * dead promise forever. Dropping the promise is not enough; the stalled `<script>` is
 * removed too, or `loadYoutubeIframeApi()` re-attaches to the same corpse. A load that
 * already succeeded is left alone.
 */
export function invalidateYoutubeIframeApiLoad(): void {
  apiPromise = null
  if (typeof document === 'undefined' || (window as YoutubeIframeWindow).YT?.Player) {
    return
  }
  document.querySelector(`script[src="${IFRAME_API_SRC}"]`)?.remove()
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
