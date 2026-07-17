/**
 * Single source of truth for the Wolves cinematic experience.
 *
 * The seven segments below are derived from the authored Wolves soundtrack manifest
 * (public/wolves-playlist.json, tracks 1-7). Adding, removing, or reordering segments
 * is a data change here — no component or composable code needs to be touched.
 *
 * The Spotify track list mirrors the same authored soundtrack (title/artist pairs);
 * the application resolves these to Spotify URIs at runtime via the Search API, so no
 * pre-built user playlist is required.
 */

export interface CinematicSegment {
  /** YouTube video id for this segment. */
  youtubeId: string
  /** Organizational part label (non-creative numbering). */
  chapter: string
  /** Authored track title from the Wolves soundtrack manifest. */
  title: string
  /** Authored artist name from the Wolves soundtrack manifest. */
  artist: string
  /** Artwork path relative to BASE_URL (served from public/). */
  artwork: string
  /** Per-segment crossfade override in milliseconds. */
  crossfadeMs?: number
  /**
   * Optional caption track URL (relative to BASE_URL). Format: one cue per line,
   * `seconds|text`, matching src/data/wolves-destiny-captions.txt. No caption data
   * is currently authored for these segments; the render pipeline is fully wired
   * and activates as soon as a file is referenced here.
   */
  captionsUrl?: string
}

export interface SpotifyTrackRef {
  title: string
  artist: string
}

/** Default audio/visual crossfade window at segment boundaries. */
export const DEFAULT_CROSSFADE_MS = 800

/**
 * Swap this many seconds before the reported duration. YouTube videos almost always
 * carry a trailing black frame (and sometimes end-screen chrome); starting the handoff
 * slightly early hides both. Kept small so no meaningful content is cut.
 */
export const PRE_END_THRESHOLD_S = 0.3

/**
 * The IFrame API has no timeupdate event, so current time must be polled. 250ms is
 * frequent enough for caption sync and the pre-end swap without measurable cost.
 */
export const TIME_POLL_MS = 250

export const CINEMATIC_SEGMENTS: CinematicSegment[] = [
  {
    youtubeId: 'LASru9j0oIc',
    chapter: 'PART I',
    title: '7 Days to the Wolves',
    artist: 'Nightwish',
    artwork: 'wolves-artwork/LASru9j0oIc.jpg',
  },
  {
    youtubeId: 'amKIngGUvCk',
    chapter: 'PART II',
    title: 'Ghosts In The Mist',
    artist: 'Unleash The Archers',
    artwork: 'wolves-artwork/amKIngGUvCk.jpg',
    crossfadeMs: 1500,
  },
  {
    youtubeId: '9skBT5TUqzo',
    chapter: 'PART III',
    title: 'Tonight We Must Be Warriors',
    artist: 'Avatar',
    artwork: 'wolves-artwork/9skBT5TUqzo.jpg',
    crossfadeMs: 1000,
  },
  {
    youtubeId: 'Z--vLaXdlgk',
    chapter: 'PART IV',
    title: 'Not Your Monster',
    artist: 'The Dark Element',
    artwork: 'wolves-artwork/Z--vLaXdlgk.jpg',
    crossfadeMs: 2000,
  },
  {
    youtubeId: '5OFLFVC11Cg',
    chapter: 'PART V',
    title: 'End of You',
    artist: 'Poppy',
    artwork: 'wolves-artwork/5OFLFVC11Cg.jpg',
    crossfadeMs: 800,
  },
  {
    youtubeId: 'san94Q93IcY',
    chapter: 'PART VI',
    title: 'Soulbound',
    artist: 'Unleash The Archers',
    artwork: 'wolves-artwork/san94Q93IcY.jpg',
    crossfadeMs: 1200,
  },
  {
    youtubeId: 'rYkYLIYvI18',
    chapter: 'PART VII',
    title: 'Last Ride of the Day',
    artist: 'Nightwish',
    artwork: 'wolves-artwork/rYkYLIYvI18.jpg',
    crossfadeMs: 2500,
  },
]

/** Mirrors the authored soundtrack; resolved to URIs at runtime via Spotify Search. */
export const SPOTIFY_TRACK_LIST: SpotifyTrackRef[] = CINEMATIC_SEGMENTS.map(segment => ({
  title: segment.title,
  artist: segment.artist,
}))

export function segmentCrossfadeMs(index: number): number {
  return CINEMATIC_SEGMENTS[index]?.crossfadeMs ?? DEFAULT_CROSSFADE_MS
}
