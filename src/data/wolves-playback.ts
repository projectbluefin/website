export type PlaybackProvider = 'youtube' | 'spotify'

export interface WolvesPlaybackProgress {
  currentTime: number
  duration: number
  playlistIndex: number
}

export interface SpotifyTrackMapping {
  youtubeVideoId: string
  spotifyUri: `spotify:track:${string}`
  title: string
  artist: string
}

export function validateSpotifyCatalog(
  tracks: ReadonlyArray<{ youtubeVideoId: string }>,
  catalog: ReadonlyArray<SpotifyTrackMapping>,
): void {
  const mappedUris = new Set<string>()

  for (const mapping of catalog) {
    if (!/^spotify:track:[^:]+$/.test(mapping.spotifyUri)) {
      throw new Error(`Spotify catalog mapping for YouTube video "${mapping.youtubeVideoId}" must use a spotify:track: URI`)
    }

    if (mappedUris.has(mapping.spotifyUri)) {
      throw new Error(`Spotify catalog has duplicate Spotify URI "${mapping.spotifyUri}"`)
    }

    mappedUris.add(mapping.spotifyUri)
  }

  for (const [index, track] of tracks.entries()) {
    const mapping = catalog[index]

    if (!mapping) {
      throw new Error(`Spotify catalog is missing mapping for YouTube video "${track.youtubeVideoId}" at playlist index ${index}`)
    }

    if (mapping.youtubeVideoId !== track.youtubeVideoId) {
      throw new Error(`Spotify catalog order mismatch at playlist index ${index}: expected YouTube video "${track.youtubeVideoId}", received "${mapping.youtubeVideoId}"`)
    }
  }

  const extraMapping = catalog[tracks.length]
  if (extraMapping) {
    throw new Error(`Spotify catalog has an unexpected mapping for YouTube video "${extraMapping.youtubeVideoId}" at playlist index ${tracks.length}`)
  }
}
