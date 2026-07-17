/**
 * Single source of truth for the Wolves cinematic experience.
 *
 * The authored intro (94s prologue cold open + guardian trailer) is NOT part of
 * this list — it plays first through WolvesIntroOverlay, driven by
 * buildIntroVideoSequence() in src/data/wolves-intro-sequence.ts. The segments
 * below are the seven musical parts, derived from the authored Wolves soundtrack
 * manifest (public/wolves-playlist.json, tracks 1-7). Adding, removing, or
 * reordering segments is a data change here — no component code changes.
 */

export interface CinematicSegment {
  /** Stable identifier for this segment, used to key per-segment content records. */
  id: string
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
    id: 'seven-days-to-the-wolves',
    youtubeId: 'LASru9j0oIc',
    chapter: 'PART I',
    title: '7 Days to the Wolves',
    artist: 'Nightwish',
    artwork: 'wolves-artwork/LASru9j0oIc.jpg',
    trackZeroExperience: true,
  },
  {
    id: 'ghosts-in-the-mist',
    youtubeId: 'amKIngGUvCk',
    chapter: 'PART II',
    title: 'Ghosts In The Mist',
    artist: 'Unleash The Archers',
    artwork: 'wolves-artwork/amKIngGUvCk.jpg',
    crossfadeMs: 1500,
  },
  {
    id: 'tonight-we-must-be-warriors',
    youtubeId: '9skBT5TUqzo',
    chapter: 'PART III',
    title: 'Tonight We Must Be Warriors',
    artist: 'Avatar',
    artwork: 'wolves-artwork/9skBT5TUqzo.jpg',
    crossfadeMs: 1000,
  },
  {
    id: 'not-your-monster',
    youtubeId: 'Z--vLaXdlgk',
    chapter: 'PART IV',
    title: 'Not Your Monster',
    artist: 'The Dark Element',
    artwork: 'wolves-artwork/Z--vLaXdlgk.jpg',
    crossfadeMs: 2000,
  },
  {
    id: 'end-of-you',
    youtubeId: '5OFLFVC11Cg',
    chapter: 'PART V',
    title: 'End of You',
    artist: 'Poppy',
    artwork: 'wolves-artwork/5OFLFVC11Cg.jpg',
    crossfadeMs: 800,
  },
  {
    id: 'soulbound',
    youtubeId: 'san94Q93IcY',
    chapter: 'PART VI',
    title: 'Soulbound',
    artist: 'Unleash The Archers',
    artwork: 'wolves-artwork/san94Q93IcY.jpg',
    crossfadeMs: 1200,
  },
  {
    id: 'last-ride-of-the-day',
    youtubeId: 'rYkYLIYvI18',
    chapter: 'PART VII',
    title: 'Last Ride of the Day',
    artist: 'Nightwish',
    artwork: 'wolves-artwork/rYkYLIYvI18.jpg',
    crossfadeMs: 2500,
  },
]

export function segmentCrossfadeMs(index: number): number {
  return CINEMATIC_SEGMENTS[index]?.crossfadeMs ?? DEFAULT_CROSSFADE_MS
}
