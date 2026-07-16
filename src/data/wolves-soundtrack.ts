export type {
  PlaybackProvider,
  SpotifyTrackMapping,
  WolvesPlaybackProgress,
} from './wolves-playback'

export interface SoundtrackTrack {
  id: string
  title: string
  artist: string
  artwork: string
  youtubeVideoId: string
  bpm?: number
  phraseBeats?: number
  fadeDuration?: number
  slideInterval?: number
}

export interface SoundtrackSource {
  provider: 'youtube'
  playlistId: string
  playlistUrl: string
  musicUrl: string
  spotifyUri: string | null
}

export interface WolvesSoundtrackManifest {
  source: SoundtrackSource
  tracks: SoundtrackTrack[]
}

export async function loadWolvesSoundtrack(): Promise<WolvesSoundtrackManifest> {
  const response = await fetch(`${import.meta.env.BASE_URL}wolves-playlist.json`)
  if (!response.ok) {
    throw new Error(`Soundtrack metadata request failed: ${response.status}`)
  }

  return response.json() as Promise<WolvesSoundtrackManifest>
}
