import { SPOTIFY_TRACK_LIST } from '@/config/wolves-cinematic'
import { useAuthStore } from '@/stores/auth'
import { useCinematicStore } from '@/stores/cinematic'

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js'
const API_BASE = 'https://api.spotify.com/v1'

interface SpotifySdkPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, callback: (payload: any) => void) => void
}

interface SpotifySdkWindow extends Window {
  Spotify?: {
    Player: new (options: {
      name: string
      getOAuthToken: (callback: (token: string) => void) => void
      volume?: number
    }) => SpotifySdkPlayer
  }
  onSpotifyWebPlaybackSDKReady?: () => void
}

let sdkPromise: Promise<void> | null = null

function loadSdk(): Promise<void> {
  const sdkWindow = window as SpotifySdkWindow
  if (sdkWindow.Spotify?.Player) {
    return Promise.resolve()
  }
  if (sdkPromise) {
    return sdkPromise
  }
  sdkPromise = new Promise((resolve, reject) => {
    sdkWindow.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = SDK_SRC
    script.async = true
    script.addEventListener('error', () => {
      sdkPromise = null
      script.remove()
      reject(new Error('Spotify Web Playback SDK failed to load'))
    })
    document.head.appendChild(script)
  })
  return sdkPromise
}

async function apiFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
}

/**
 * Resolves the config's title/artist pairs to Spotify track URIs via the Search API.
 * The application owns playlist assembly — no user-managed playlist exists. Tracks
 * that cannot be resolved are skipped rather than failing the whole show.
 */
export async function resolveTrackUris(token: string): Promise<string[]> {
  const uris: string[] = []
  for (const track of SPOTIFY_TRACK_LIST) {
    const query = encodeURIComponent(`track:${track.title} artist:${track.artist}`)
    const response = await apiFetch(`/search?q=${query}&type=track&limit=1`, token)
    if (!response.ok) {
      continue
    }
    const data = await response.json()
    const uri = data?.tracks?.items?.[0]?.uri
    if (typeof uri === 'string') {
      uris.push(uri)
    }
  }
  return uris
}

/**
 * Creates the in-browser Spotify device, resolves the assembled track list, and
 * starts playback on it. Publishes all state into the cinematic store; nothing
 * here talks to the video players.
 */
export function useSpotifyPlayback() {
  const auth = useAuthStore()
  const cinematic = useCinematicStore()
  let player: SpotifySdkPlayer | null = null

  async function start(): Promise<void> {
    if (auth.provider !== 'spotify' || !auth.accessToken) {
      return
    }
    cinematic.setSpotifyState({ status: 'initializing', error: '' })

    try {
      await loadSdk()
      const PlayerCtor = (window as SpotifySdkWindow).Spotify?.Player
      if (!PlayerCtor) {
        throw new Error('Spotify SDK unavailable')
      }

      player = new PlayerCtor({
        name: 'Bluefin Wolves Cinematic',
        getOAuthToken: callback => callback(auth.accessToken),
        volume: 0.8,
      })

      const deviceId = await new Promise<string>((resolve, reject) => {
        player!.addListener('ready', ({ device_id }) => resolve(device_id))
        player!.addListener('initialization_error', ({ message }) => reject(new Error(message)))
        player!.addListener('authentication_error', ({ message }) => reject(new Error(message)))
        // account_error means no Premium; the SDK requires it.
        player!.addListener('account_error', () => reject(new Error('Spotify Premium is required for in-browser playback')))
        player!.connect().then((connected) => {
          if (!connected) {
            reject(new Error('Spotify device connection failed'))
          }
        })
      })

      player.addListener('player_state_changed', (state) => {
        if (!state) {
          return
        }
        const current = state.track_window?.current_track
        cinematic.setSpotifyState({
          status: state.paused ? 'paused' : 'playing',
          trackTitle: current?.name ?? '',
          trackArtist: current?.artists?.map((artist: { name: string }) => artist.name).join(', ') ?? '',
        })
      })

      const uris = await resolveTrackUris(auth.accessToken)
      if (uris.length === 0) {
        throw new Error('No soundtrack tracks could be resolved on Spotify')
      }

      const play = await apiFetch(`/me/player/play?device_id=${deviceId}`, auth.accessToken, {
        method: 'PUT',
        body: JSON.stringify({ uris }),
      })
      if (!play.ok && play.status !== 204) {
        throw new Error(`Spotify playback start failed: ${play.status}`)
      }
      cinematic.setSpotifyState({ status: 'ready' })
    }
    catch (error) {
      cinematic.setSpotifyState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Spotify playback failed',
      })
    }
  }

  function stop() {
    player?.disconnect()
    player = null
    cinematic.setSpotifyState({ status: 'inactive' })
  }

  return { start, stop }
}
