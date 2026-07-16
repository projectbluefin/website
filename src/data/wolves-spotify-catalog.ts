import type { SpotifyTrackMapping } from './wolves-playback'

/**
 * Add entries only after the owner has reviewed exact Spotify URIs against the
 * existing YouTube playlist. The production manifest remains YouTube-only until then.
 */
export const wolvesSpotifyCatalog: readonly SpotifyTrackMapping[] = []
