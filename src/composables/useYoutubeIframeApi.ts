/**
 * Shared loader for the YouTube IFrame Player API script.
 *
 * Extracted so any component embedding a real YouTube video (a legitimate `youtubeVideoId`
 * reference, never a downloaded/re-encoded local copy) can reuse the same script-load dance
 * instead of duplicating it. `WolvesSoundtrack.vue` has its own, older copy of this same logic
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

/**
 * Test-only escape hatch: the API-load promise is cached at module scope (intentional in
 * production — the script should only ever be requested once per page), which would leak
 * stale state between otherwise-isolated test cases. Call this from `beforeEach`/`afterEach`
 * in tests that mock/unmock `window.YT`.
 */
export function resetYoutubeIframeApiCacheForTests(): void {
  apiPromise = null
}
