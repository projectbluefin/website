/**
 * Director's Cut intro: the full-length scored Gayane prologue and the Ikora-voiced
 * Destiny handoff.
 *
 * This is a separate surface from `wolves-intro-sequence.ts` on purpose. The standard intro
 * is the conference talk (a presenter's welcome slide, then the trailer). The Director's Cut
 * is a one-song cinematic: it opens cold on the music with no title card at all, narrates the
 * prologue over the first movement, spends the long instrumental middle on the approved
 * Destiny concept-art montage, and lands on the Ikora-voiced trailer.
 *
 * **Every number in this file was measured against the real sources**, not chosen. The
 * measurement evidence lives in the Task 4 report; the short version is in the comments on
 * each constant. Do not "tidy" one of them into a rounder value.
 */

import type { IntroOverlayTextCue, IntroTextSegment, IntroVideoSegment, IntroVideoSpec } from './wolves-intro-sequence'
import { DIRECTORS_CUT_DESTINY_CONCEPTS } from './wolves-directors-cut-artwork'
import { buildIntroVideoSequence, isVideoSegment } from './wolves-intro-sequence'

export const DIRECTORS_CUT_PROLOGUE_SEGMENT_ID = 'wolves-prologue' as const
export const DIRECTORS_CUT_DESTINY_SEGMENT_ID = 'wolves-directors-destiny' as const
/** Short reveal followed by a real reading hold; the shared 7.8s fade hid most short cues. */
export const DIRECTORS_CUT_TEXT_FADE_SECONDS = 1.6

/** Aram Khachaturian — Gayane Ballet Suite (Adagio), the prologue's scored source. */
export const GAYANE_SOURCE_VIDEO_ID = 'EB3IokHelRk' as const

/**
 * Full playable length of the Gayane source, in seconds.
 *
 * Measured off the real upload (`yt-dlp` -> `ffprobe`): the decoded stream is 325.602 s and
 * YouTube reports 326 s. The prologue runs the whole thing rather than the old 94 s excerpt,
 * so the Director's Cut is genuinely one song end to end.
 */
export const GAYANE_TRACK_SECONDS = 325.6

/** First audible sample (librosa RMS > -60 dBFS). The source opens on ~3 s of true silence. */
export const GAYANE_FIRST_AUDIBLE_SECOND = 3.09

/** Last audible sample. The final chord's decay dies here; the rest of the container is silent. */
export const GAYANE_LAST_AUDIBLE_SECOND = 321.34

/**
 * Only the already-silent tail is faded, so the fade can never clip a note: the ramp starts
 * at 323.1 s and the music has been gone since 321.34 s. It exists purely to absorb a small
 * difference between the measured stream length and whatever YouTube hands the player.
 */
const GAYANE_AUDIO_FADE_SECONDS = 2.5

/**
 * The prologue's cue grid: every measured musical boundary the Director's Cut is allowed to
 * cut on, in order, ending on the track's own end.
 *
 * Derived two independent ways and kept only where they agree:
 *
 * - **Laplacian structural segmentation** (librosa recurrence matrix + spectral clustering,
 *   the librosa gallery method) run at k = 4..10 and voted; boundaries carried by at least
 *   five of the seven clusterings are marked "strong" below.
 * - **Checkerboard-kernel novelty** over an MFCC self-similarity matrix, peak-picked
 *   independently of the clustering. Peak strength is normalised to the strongest event in
 *   the piece (240.5 s = 1.000).
 *
 * There are no equal slices here and no second clock: each mark is a real event in the
 * recording, and every cue below starts and ends on one of them.
 */
export const GAYANE_PROLOGUE_MARKS = [
  /*  0 */ 0, //      curtain; the source is silent until 3.09 s
  /*  1 */ 5.32, //   strong (7/7) — strings established, narration starts
  /*  2 */ 20.02, //  strong (7/7)
  /*  3 */ 33.03, //  strong (6/7)
  /*  4 */ 53.75, //  strong (7/7) + novelty 0.827, the first movement's biggest event
  /*  5 */ 65.71, //  strong (6/7)
  /*  6 */ 83.38, //  strong (5/7) + novelty 0.516
  /*  7 */ 98.71, //  strong (5/7) + novelty 0.346
  /*  8 */ 108.51, // strong (7/7) — the Clarke quote's window opens
  /*  9 */ 133.58, // strong (7/7) — montage begins
  /* 10 */ 156.5, //  novelty 0.503
  /* 11 */ 171.32, // strong (7/7)
  /* 12 */ 192.5, //  novelty 0.253
  /* 13 */ 211.16, // strong (7/7)
  /* 14 */ 227, //    novelty 0.472
  /* 15 */ 240.5, //  novelty 1.000, the strongest event in the piece
  /* 16 */ 251.05, // strong (7/7)
  /* 17 */ 261, //    novelty 0.430
  /* 18 */ 270.1, //  strong (7/7)
  /* 19 */ 276, //    novelty 0.332 (strong 275.32) — the final crescendo starts
  /* 20 */ 291.67, // strong (7/7) — the crescendo releases into the closing decay
  /* 21 */ GAYANE_TRACK_SECONDS,
] as const

const NARRATION_FIRST_MARK = 1
const MONTAGE_FIRST_MARK = 8
const HANDOFF_FIRST_MARK = 18

const COLLAPSE_BACKGROUND = 'wolves-intro/bluefin-collapse-night.webp'

/**
 * Word ceiling for a cue allowed to carry `emphasis: 'dominant'`.
 *
 * Dominant is an ~81px display treatment, so its cost is measured in frame height, not just
 * reading time. Measured in Chromium at 1280x720 — the smallest projector this show should
 * survive — a 13-word dominant beat renders 488px of the 720px frame and clears the nameplate,
 * while the 35-word Clarke quote renders 878px and is cut off at the top of the frame. Keep
 * dominant for the singular high-impact lines it was invented for.
 */
export const DOMINANT_EMPHASIS_MAX_WORDS = 13

/** Bungie's official "Destiny 2: Into the Light Cinematic" upload — the Ikora-voiced source. */
export const IKORA_SOURCE_VIDEO_ID = 'BKm0TPqeOjY' as const

/**
 * Seconds the Ikora source runs *behind* the unvoiced source used by the standard intro.
 *
 * Frame-measured, not assumed: both sources were sampled at 10 fps into normalised luma
 * signatures and cross-correlated. The similarity peaks sharply at 2.10 s (0.635, against
 * 0.609 at 2.00 s and 0.565 at 2.20 s), and paired frames confirm it visually — Ikora 12.40 s
 * and unvoiced 14.50 s are the same frame, as are 13.70/15.80 and 87.40/89.50.
 */
export const IKORA_SOURCE_OFFSET_SECONDS = 2.1

/**
 * The Ikora source opens on Bungie's own ESRB "TEEN" card, held at a constant luma from 0.00 s
 * and gone by 2.00 s. Starting there skips it, exactly as the standard intro does with its own
 * source's card. Cue windows below are keyed to the video's absolute timeline, so they need no
 * shift for this.
 */
export const IKORA_RATING_CARD_SECONDS = 2

/**
 * The Ikora source's last content frame.
 *
 * This is the number the standard intro's 118.8 s cutoff must **not** be reused for. The two
 * uploads do not share an outro: the unvoiced re-upload dissolves its last shot to black over
 * ~115.7-119.1 s and then holds black, while Bungie's official upload hard-cuts (113.50 s is
 * the last bright frame, 113.55 s is fully black) and fades up a "SEASON OF THE WISH" promo
 * card from ~114.5 s. Transposing 118.8 s through the 2.10 s offset would land on 116.7 s —
 * inside that promo card, on a theater screen. Verified frame by frame at 0.05 s resolution.
 */
export const IKORA_LAST_CONTENT_SECOND = 113.5

function mark(index: number): number {
  return GAYANE_PROLOGUE_MARKS[index]
}

function round(seconds: number): number {
  return Math.round(seconds * 100) / 100
}

/**
 * The narrated opening: the existing authored prologue lines, in their authored order, each
 * given a window bounded by two measured section marks.
 *
 * Nothing here is new writing. The long Clarke sentence is deliberately omitted from this
 * projected sequence: keeping a quote whole turned it into a 35-word wall, while splitting it
 * would violate the show's quote rule. The sourced quote remains available in the lore corpus.
 */
function buildNarrationCues(): IntroOverlayTextCue[] {
  const texts: IntroOverlayTextCue[] = [
    { text: 'A Gardener and a Winnower walked among the stars.', start: 0, end: 0 },
    {
      text: `One to spread life,
and one to cull the dross
to shape the Garden of Earth.`,
      start: 0,
      end: 0,
      backgroundCrossfade: [
        {
          day: 'img/wallpapers/bluefin-06-day.webp',
          night: 'img/wallpapers/bluefin-06-night.webp',
        },
      ],
      textPosition: 'bottom-right',
      highlightSubstrings: ['life', 'dross', 'Garden'],
    },
    {
      text: 'One day changed the Garden forever.',
      start: 0,
      end: 0,
      backgroundImage: COLLAPSE_BACKGROUND,
    },
    {
      text: 'New Children arose and filled the pattern.',
      start: 0,
      end: 0,
      emphasis: 'dominant',
      textPosition: 'bottom',
      backgroundImage: COLLAPSE_BACKGROUND,
    },
    {
      text: 'For eons, Maintainer-Guardians cultivated the Garden...',
      start: 0,
      end: 0,
      backgroundImage: COLLAPSE_BACKGROUND,
    },
    {
      text: `Until an AI-fueled Society deemed Guardians unnecessary.
And then, a threat.`,
      start: 0,
      end: 0,
      backgroundImage: COLLAPSE_BACKGROUND,
    },
    { text: 'Others came to claim a bountiful and unprotected Garden.', start: 0, end: 0 },
  ]

  return texts.map((cue, index) => ({
    ...cue,
    start: mark(NARRATION_FIRST_MARK + index),
    end: mark(NARRATION_FIRST_MARK + index + 1),
  }))
}

/**
 * The approved Destiny concept-art montage, in registry order (E1, C1, C2, C3, C4, C9, C6,
 * C5, C7, C10), one cue per painting.
 *
 * Complete authored thoughts recur across the instrumental movement, so the full song keeps
 * advancing the prologue instead of becoming a 142-second silent slideshow. The recurrence is
 * deliberate: it gives the score motifs without inventing connective lore. Every painting is
 * static; the former 1.15 -> 1.65 Ken Burns crop made source art soft and unreadable.
 *
 * The registry's figure metadata carries the artist and the Bungie credit into assistive
 * technology.
 */
function buildMontageCues(): IntroOverlayTextCue[] {
  const refrains = [
    'A Gardener and a Winnower walked among the stars.',
    `One to spread life,
and one to cull the dross
to shape the Garden of Earth.`,
    'One day changed the Garden forever.',
    'New Children arose and filled the pattern.',
    'For eons, Maintainer-Guardians cultivated the Garden...',
    'An AI-fueled Society deemed Guardians unnecessary.',
    'And then, a threat.',
    'Others came to claim a bountiful and unprotected Garden.',
    `Now, what's left of a proud order fights for survival,
surrounded by predators.`,
    'One day changed the Garden forever.',
  ] as const

  return DIRECTORS_CUT_DESTINY_CONCEPTS.map((record, index) => ({
    text: refrains[index]!,
    start: mark(MONTAGE_FIRST_MARK + index),
    end: mark(MONTAGE_FIRST_MARK + index + 1),
    backgroundImage: record.localPath,
    backgroundFigure: record.backgroundFigure,
  }))
}

/**
 * The authored handoff into Destiny: the defiant line rides the piece's loudest passage
 * (276-291.67 s, the final crescendo), and the show's title holds through the closing decay
 * into the source's own silence. Both are existing authored prologue lines, unchanged.
 */
function buildHandoffCues(): IntroOverlayTextCue[] {
  const texts: IntroOverlayTextCue[] = [
    {
      text: `Now, what's left of a proud order fights for survival,
surrounded by predators.`,
      start: 0,
      end: 0,
      emphasis: 'dominant',
      textPosition: 'bottom',
      highlightSubstring: 'fights',
    },
    { text: 'PROJECT BLUEFIN\nseven days to the wolves', start: 0, end: 0, slim: true },
  ]

  return [
    { ...texts[0]!, start: mark(HANDOFF_FIRST_MARK), end: mark(HANDOFF_FIRST_MARK + 2) },
    { ...texts[1]!, start: mark(HANDOFF_FIRST_MARK + 2), end: mark(HANDOFF_FIRST_MARK + 3) },
  ]
}

export function buildDirectorsCutPrologueSegment(): IntroTextSegment {
  return {
    id: DIRECTORS_CUT_PROLOGUE_SEGMENT_ID,
    kind: 'text',
    duration: GAYANE_TRACK_SECONDS,
    audioFadeOutSeconds: GAYANE_AUDIO_FADE_SECONDS,
    audioYoutubeVideoId: GAYANE_SOURCE_VIDEO_ID,
    overlays: [
      ...buildNarrationCues(),
      ...buildMontageCues(),
      ...buildHandoffCues(),
    ],
  }
}

/** Re-times a cue authored against the unvoiced source onto the Ikora source's own timeline. */
function toIkoraTimeline(cue: IntroOverlayTextCue): IntroOverlayTextCue {
  return {
    ...cue,
    start: round(cue.start - IKORA_SOURCE_OFFSET_SECONDS),
    end: round(Math.min(cue.end - IKORA_SOURCE_OFFSET_SECONDS, IKORA_LAST_CONTENT_SECOND)),
  }
}

/**
 * The Director's Cut plays the Ikora-voiced source as its primary, not as an optional toggle:
 * there is nobody in the room to press the toggle, and the official upload is also the better
 * projection source — it is full-frame 16:9, while the unvoiced re-upload carries baked-in
 * 2.39:1 letterbox bars (measured: active picture rows 92-627 of 720).
 *
 * The guardian windows are derived from the standard intro's frame-verified cues rather than
 * retyped, so a future correction there cannot silently desync this cut, and every window is
 * shifted onto the Ikora timeline and clamped to its measured cutoff.
 */
export function buildDirectorsCutDestinySegment(): IntroVideoSegment {
  const standard = buildIntroVideoSequence().find(segment => segment.id === 'wolves-intro')
  if (!standard || !isVideoSegment(standard)) {
    throw new Error('Expected the authored Destiny segment in the standard intro sequence')
  }

  return {
    id: DIRECTORS_CUT_DESTINY_SEGMENT_ID,
    kind: 'video',
    youtubeVideoId: IKORA_SOURCE_VIDEO_ID,
    startOffset: IKORA_RATING_CARD_SECONDS,
    maxDuration: IKORA_LAST_CONTENT_SECOND,
    burnedInCaptions: standard.burnedInCaptions?.map(toIkoraTimeline),
    overlays: standard.overlays?.map(toIkoraTimeline),
  }
}

/**
 * Director's Cut intro: one full-length scored Gayane segment, then the Ikora-voiced Destiny
 * segment. No opening title card before it and none between the two — the Director's Cut is
 * not the presenter's slide deck.
 */
export function buildDirectorsCutVideoSequence(): readonly IntroVideoSpec[] {
  return [
    buildDirectorsCutPrologueSegment(),
    buildDirectorsCutDestinySegment(),
  ] as const
}
