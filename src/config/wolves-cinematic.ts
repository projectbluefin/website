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

import destinyCaptionsRaw from '@/data/wolves-destiny-captions.txt?raw'

export interface CinematicSegment {
  /** YouTube video id for this segment. */
  youtubeId: string
  /** Organizational part label (non-creative numbering). */
  chapter: string
  /** Authored track title from the Wolves soundtrack manifest. */
  title: string
  /** Authored artist name from the Wolves soundtrack manifest. */
  artist: string
  /** Artwork path relative to BASE_URL (served from public/), or an absolute URL. */
  artwork: string
  /** Per-segment crossfade override in milliseconds. */
  crossfadeMs?: number
  /** Start playback this many seconds into the source video (authored trim). */
  startSeconds?: number
  /** Treat this native timestamp as the end of the segment (authored trim). */
  endSeconds?: number
  /** True for non-musical segments that have no Spotify soundtrack counterpart. */
  excludeFromSoundtrack?: boolean
  /**
   * Mounts the authored seven-days immersive experience over this segment:
   * the Track 0 beat-synced slideshow, lore column, and thesis overlay, all
   * driven by the video's native timeline (the video becomes the audio source).
   */
  trackZeroExperience?: boolean
  /**
   * Authored lore lines shown in the transition overlay leading INTO this
   * segment. Agents never write these; empty means the default terminal block.
   */
  transitionLore?: string[]
  /**
   * Optional caption track. Format: one cue per line, `seconds|text`, timestamps
   * keyed to the source video's native timeline (matching
   * src/data/wolves-destiny-captions.txt).
   */
  captionsText?: string
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
 * The IFrame API has no timeupdate event, so current time must be polled. 100ms
 * matches the old immersive experience's progress resolution — the beat-synced
 * slideshow, ticker phrases, and thesis boundaries are all keyed to it.
 */
export const TIME_POLL_MS = 100

export const CINEMATIC_SEGMENTS: CinematicSegment[] = [
  {
    // Authored prologue audio track (wolves-prologue in src/data/wolves-intro-sequence.ts).
    youtubeId: 'EB3IokHelRk',
    chapter: 'PROLOGUE',
    title: 'Gayane Ballet Suite (Adagio)',
    artist: 'Aram Khachaturian',
    artwork: 'https://i.ytimg.com/vi/EB3IokHelRk/hqdefault.jpg',
    excludeFromSoundtrack: true,
  },
  {
    // Authored intro segment (wolves-intro in src/data/wolves-intro-sequence.ts):
    // start 2s in to skip the ESRB rating card, end at 114s before the promo card.
    youtubeId: 'BKm0TPqeOjY',
    chapter: 'INTRO',
    title: 'Destiny 2: Into the Light Cinematic',
    artist: 'Bungie',
    artwork: 'https://i.ytimg.com/vi/BKm0TPqeOjY/hqdefault.jpg',
    startSeconds: 2,
    endSeconds: 114,
    excludeFromSoundtrack: true,
    captionsText: destinyCaptionsRaw,
  },
  {
    youtubeId: 'LASru9j0oIc',
    chapter: 'PART I',
    title: '7 Days to the Wolves',
    artist: 'Nightwish',
    artwork: 'wolves-artwork/LASru9j0oIc.jpg',
    trackZeroExperience: true,
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

/** Mirrors the authored soundtrack (musical segments only); resolved via Spotify Search. */
export const SPOTIFY_TRACK_LIST: SpotifyTrackRef[] = CINEMATIC_SEGMENTS
  .filter(segment => !segment.excludeFromSoundtrack)
  .map(segment => ({
    title: segment.title,
    artist: segment.artist,
  }))

export function segmentCrossfadeMs(index: number): number {
  return CINEMATIC_SEGMENTS[index]?.crossfadeMs ?? DEFAULT_CROSSFADE_MS
}
