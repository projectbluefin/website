/**
 * Single source of truth for the Wolves cinematic experience.
 *
 * The authored intro (species prelude, locked 94s Gayane prologue, cinematic-universe slate, then guardian trailer) is NOT part of
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
  transitionLore?: readonly CinematicTransitionLine[]
  /**
   * Optional caption track. Format: one cue per line, `seconds|text`, timestamps
   * keyed to the source video's native timeline (matching
   * src/data/wolves-destiny-captions.txt).
   */
  captionsText?: string
}

export type TransitionSfxEffect = 'static' | 'bulkhead-knock' | 'bulkhead-response' | 'explosion'

export type CinematicTransitionLine
  = | {
    kind: 'speaker'
    speaker: string
    text?: string
  }
  | {
    kind: 'cue'
    text: string
  }
  | {
    kind: 'static'
    text: string
    effect: 'static'
  }
  | {
    kind: 'sfx'
    text: string
    effect: Exclude<TransitionSfxEffect, 'static'>
  }

const TRANSITION_ONE: readonly CinematicTransitionLine[] = [
  {
    kind: 'speaker',
    speaker: 'krook',
    text: 'Ok let\'s do this one by the books, intel in your feeds. Remember, prioritize all Maintainer-Guardian workflows, they\'re depending on us.',
  },
  {
    kind: 'speaker',
    speaker: 'sabot-6',
    text: 'Practioner-Guardian efficiency is — what? Seven percent? That\'s —',
  },
  {
    kind: 'speaker',
    speaker: 'jeefy',
    text: 'Detroit Lions numbers kids —',
  },
  {
    kind: 'speaker',
    speaker: 'mrbobbytables',
    text: 'I told you it wasn\'t going to work, with 7 reference architectures, seven percent. I know you didn\'t read the docs don\'t bother slopping your way out of this one',
  },
  {
    kind: 'speaker',
    speaker: 'nate',
    text: 'About that —',
  },
]

const TRANSITION_TWO: readonly CinematicTransitionLine[] = [
  {
    kind: 'speaker',
    speaker: 'krook',
    text: 'ok tighten it up folks, ihor bring her in low —',
  },
  {
    kind: 'speaker',
    speaker: 'ihord',
    text: 'locked in the pipe, five by five — good hunting —',
  },
]

const TRANSITION_THREE: readonly CinematicTransitionLine[] = [
  {
    kind: 'speaker',
    speaker: 'krook',
    text: 'Well done team, next group of Guardians needs help, line em up, resources are low and we don\'t want any',
  },
  {
    kind: 'static',
    text: '-- static --',
    effect: 'static',
  },
  {
    kind: 'speaker',
    speaker: 'K',
    text: 'Hello boys, about time you showed up, link up.',
  },
  {
    kind: 'speaker',
    speaker: 'sabot-6',
    text: 'Oh yay adult supervision',
  },
  {
    kind: 'speaker',
    speaker: 'krook',
    text: 'damnit jorge we talked about this',
  },
  {
    kind: 'speaker',
    speaker: 'K',
    text: 'Keep up kids you\'re down three minutes, you\'re not going to keep up with basic maturity guidelines, and you know what they say, trust but verify.',
  },
  {
    kind: 'speaker',
    speaker: 'Carl George (Royal Guard)',
    text: 'I love it when you tell them that, how ya been eltee do you miss me I\'ve been promoted! Love coming into town to farm with the basics.',
  },
  {
    kind: 'speaker',
    speaker: 'Emily Fox (Royal Guard)',
    text: 'Especially the angry one look how mad he gets. He left the entire security booster kit unread, metrics don\'t lie, you owe me twenty bucks',
  },
]

const TRANSITION_FOUR: readonly CinematicTransitionLine[] = [
  {
    kind: 'speaker',
    speaker: 'Karena',
    text: 'Insertion approved, good hunting',
  },
  {
    kind: 'speaker',
    speaker: 'Krook',
    text: 'Inbound in twelve',
  },
  {
    kind: 'speaker',
    speaker: 'jeefy',
    text: 'See ya down there.',
  },
  {
    kind: 'cue',
    text: '* knock the pod door *',
  },
  {
    kind: 'sfx',
    text: '[Use one dramatic metal bulkhead knock here.]',
    effect: 'bulkhead-knock',
  },
  {
    kind: 'speaker',
    speaker: 'sabot-6',
  },
  {
    kind: 'sfx',
    text: '* knock * * knock *',
    effect: 'bulkhead-response',
  },
  {
    kind: 'cue',
    text: '[Use two dramatic metal bulkhead knocks here.]',
  },
]

const TRANSITION_FIVE: readonly CinematicTransitionLine[] = [
  {
    kind: 'speaker',
    speaker: 'angie',
    text: 'AAIF-7 on the net, someone need guidance?',
  },
  {
    kind: 'speaker',
    speaker: 'stacyp',
    text: 'SSF-7 here, howdy folks, deploying SIVA Nanites. For you New Lights that\'s our OpenSSF standard deployment kit for Guardians. Security - Inventory - Verification - Attestation) Nanites, but people say Asskicking for the A.',
  },
  {
    kind: 'speaker',
    speaker: 'krook',
    text: 'Oh yeah and I called for reinforcements',
  },
  {
    kind: 'speaker',
    speaker: 'natali',
    text: 'They put Asskicking in the brand name? Great marketing. Oh and look. Hey look everyone, their docs are spectacular. What did I tell you about good taste. This story just writes itself.',
  },
  {
    kind: 'speaker',
    speaker: 'AN4-ChK-12',
    text: 'Blue Universal recommendation, sell ad space on your fists.',
  },
  {
    kind: 'speaker',
    speaker: 'kat',
    text: 'maybe we should keep it around and then just punch it when it eventually hallucinates.',
  },
  {
    kind: 'speaker',
    speaker: 'AN4-ChK-12',
    text: 'Cloud Native! Inference! Kubernetes! Cloud Native! Inference! Kubernetes! Cloud Native! Inference! Kubernetes! Cloud Native! Inference! Kubernetes!',
  },
  {
    kind: 'sfx',
    text: '*** explosion sound',
    effect: 'explosion',
  },
]

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
    transitionLore: TRANSITION_ONE,
  },
  {
    id: 'tonight-we-must-be-warriors',
    youtubeId: '9skBT5TUqzo',
    chapter: 'PART III',
    title: 'Tonight We Must Be Warriors',
    artist: 'Avatar',
    artwork: 'wolves-artwork/9skBT5TUqzo.jpg',
    crossfadeMs: 1000,
    transitionLore: TRANSITION_TWO,
  },
  {
    id: 'not-your-monster',
    youtubeId: 'Z--vLaXdlgk',
    chapter: 'PART IV',
    title: 'Not Your Monster',
    artist: 'The Dark Element',
    artwork: 'wolves-artwork/Z--vLaXdlgk.jpg',
    crossfadeMs: 2000,
    transitionLore: TRANSITION_THREE,
  },
  {
    id: 'end-of-you',
    youtubeId: '5OFLFVC11Cg',
    chapter: 'PART V',
    title: 'End of You',
    artist: 'Poppy',
    artwork: 'wolves-artwork/5OFLFVC11Cg.jpg',
    crossfadeMs: 800,
    transitionLore: TRANSITION_FOUR,
  },
  {
    id: 'soulbound',
    youtubeId: 'san94Q93IcY',
    chapter: 'PART VI',
    title: 'Soulbound',
    artist: 'Unleash The Archers',
    artwork: 'wolves-artwork/san94Q93IcY.jpg',
    crossfadeMs: 1200,
    transitionLore: TRANSITION_FIVE,
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
