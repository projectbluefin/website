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
import { estimatePageSeconds } from '../components/wolves/lore/lore-pages'
import { DIRECTORS_CUT_DESTINY_CONCEPTS } from './wolves-directors-cut-artwork'
import { DIRECTORS_CUT_COLLAPSE_DAY_IMAGE, DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE } from './wolves-directors-cut-finale'
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

/**
 * The measured second the piece's final crescendo starts.
 *
 * The defiant handoff line is cut to this, not to the section boundary before it: 270.1 s is
 * a real mark, but it is the *approach*, and putting the line there spent six seconds of the
 * biggest moment in the piece on a line the audience had already finished reading.
 */
export const DIRECTORS_CUT_FINAL_CRESCENDO_SECOND = GAYANE_PROLOGUE_MARKS[19]

/**
 * Word ceiling for any cue projected in this prologue.
 *
 * Measured in Chromium at 1280x720 — the smallest projector this show should survive. A
 * 13-word dominant beat renders 488px of the 720px frame and clears the nameplate; the 35-word
 * Clarke sentence renders 878px and is cut off at the top of the frame. The ceiling is applied
 * to every displayed cue rather than only to dominant ones, because the back row's reading
 * budget is set by the music, not by the type size: a cue that needs a second pass to parse
 * has already lost the beat it was cut to.
 *
 * A thought that cannot be shown whole under this ceiling is not split across two shots — the
 * show's quote rule forbids that — it is omitted from the projected sequence and left in the
 * lore corpus, where it can be read at the reader's own pace.
 */
export const DIRECTORS_CUT_MAX_CUE_WORDS = 13

/**
 * How much longer than its bare reading cost a thought may stay on screen.
 *
 * `estimatePageSeconds` is the show's shared reading-cost model (a floor of 6 s plus 3 words
 * per second), already used to schedule the lore pages. A projected line needs more than that
 * — the back row is further away and cannot re-read at will — but not unboundedly more: past
 * roughly twice the cost, a held line stops reading as emphasis and starts reading as a stuck
 * slide. 1.8x keeps every thought comfortably legible and still lets the image breathe.
 */
export const DIRECTORS_CUT_TEXT_HOLD_RATIO = 1.8

/**
 * The longest the projector may stay wordless.
 *
 * Silence is a deliberate instrument here — the Collapse and the darkest montage beats are
 * stronger without a caption — but past about half a minute an audience stops reading the
 * silence as intent and starts wondering whether the show has broken. Every gap in the recut
 * is under this; the widest is 28.79 s, across the montage's darkest stretch.
 */
export const DIRECTORS_CUT_MAX_TEXTLESS_SECONDS = 30

/**
 * Scene dissolve length for the Director's prologue, paired to its own text reveal.
 *
 * The shared prologue pairs a 7.8 s text fade with a 3.9 s scene crossfade. This cut reveals
 * text in 1.6 s, so inheriting the shared 3.9 s dissolve left the words fully up over an
 * image still half-dissolved into the previous one — the montage's paintings read as a smear
 * rather than as cuts. Matching the dissolve to the text reveal restores the pairing the
 * shared prologue has, at this cut's own tempo.
 */
export const DIRECTORS_CUT_SCENE_CROSSFADE_SECONDS = DIRECTORS_CUT_TEXT_FADE_SECONDS

/**
 * The measured second the Ikora player is built and parked during the prologue.
 *
 * The handoff used to build its iframe at the cut, so the last thing a theater saw of the
 * prologue was a black frame while YouTube negotiated a stream. This builds it against the
 * montage's penultimate section boundary instead — mark 17, 64.6 s of warm-up — which is long
 * enough for any projector's connection and short enough that the cued stream is not left to
 * go stale for the whole five-and-a-half-minute piece.
 */
export const DIRECTORS_CUT_IKORA_PREWARM_SECOND = GAYANE_PROLOGUE_MARKS[17]

/**
 * How long the last painting may be held over a promoted-but-not-yet-playing trailer.
 *
 * The hold exists so the audience never sees black between the prologue and the trailer. It
 * is bounded because the alternative failure is worse: a player that never reports PLAYING —
 * a dead embed, a region block, a stalled network — would otherwise freeze the show on a
 * still image with no operator able to recover it. At the bound the trailer is revealed
 * regardless, and the segment's own error paths take over from there.
 */
export const DIRECTORS_CUT_HANDOFF_HOLD_MAX_MS = 3000

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
 * The narrated opening, the concept-art montage, and the handoff, as one shot list.
 *
 * They were three independent builders, each cutting its own block of marks, and the seams
 * were where the defects lived: the montage repeated every narration line verbatim one
 * section later, and the handoff opened on the section *before* the crescendo it was written
 * for. They are one list now because the recut's decisions — which thought recurs where, how
 * long the projector may stay wordless, where the images start and stop — are decisions about
 * the whole prologue, and cannot be made correctly inside a block that cannot see the others.
 *
 * Nothing here is new writing. Every line is an existing authored prologue line, shown whole.
 * Two authored thoughts are omitted from the *projected* sequence and remain in the lore
 * corpus: the 35-word Clarke sentence, and the 16-word "One to spread life, / and one to cull
 * the dross / to shape the Garden of Earth." Both exceed `DIRECTORS_CUT_MAX_CUE_WORDS` and
 * neither can be split without breaking a quote across two shots. The Gardener/Winnower
 * duality still opens the show in the line above it.
 *
 * Structure, in three acts on the measured grid:
 *
 * - **Narration** (5.32-108.51): the authored lines in authored order, over the Collapse.
 * - **Montage** (108.51-270.1): the ten approved paintings, once each in registry order, with
 *   six of the authored thoughts recurring as motifs against them and four paintings held
 *   wordless.
 * - **Handoff** (270.1-325.6): the last painting carries the approach, the defiant line takes
 *   the final crescendo, and the title bookends onto the montage's opening painting.
 */
type PrologueShot = Omit<IntroOverlayTextCue, 'start' | 'end' | 'text'> & {
  /** Index into `GAYANE_PROLOGUE_MARKS` where this shot cuts in; it runs to the next mark. */
  readonly mark: number
  /** The thought this shot carries, or nothing at all: a wordless shot is a deliberate beat. */
  readonly text?: string
}

/** Applies a painting from the approved registry to a shot, whole and at its own geometry. */
function painting(index: number): Pick<IntroOverlayTextCue, 'backgroundImage' | 'backgroundFigure' | 'backgroundFraming'> {
  const record = DIRECTORS_CUT_DESTINY_CONCEPTS[index]
  if (!record) {
    throw new Error(`No approved Destiny concept record at index ${index}`)
  }

  return {
    backgroundImage: record.localPath,
    backgroundFigure: record.backgroundFigure,
    backgroundFraming: {
      fit: 'contain',
      sourceWidth: record.sourceWidth,
      sourceHeight: record.sourceHeight,
    },
  }
}

/**
 * The projected narration, broken into lines rather than run as sentences.
 *
 * Every word is the authored wording, unchanged. The only thing authored here
 * is *where each line ends*, and that is a projection decision, not an
 * editorial one: this type is Michroma across 90vw, and Michroma is a very wide
 * face. A 55-character sentence set as one paragraph fills the frame edge to
 * edge and wraps wherever the box happens to run out, which from a theater seat
 * reads as a wall of text rather than as a line of narration — the back row is
 * still parsing line one when the cue changes.
 *
 * So each line is cut at its own phrase break and stacked. `white-space:
 * pre-line` on `.wolves-intro-overlay-text` preserves these breaks, and
 * `DIRECTORS_CUT_MAX_CUE_WORDS` still governs the whole cue: breaking a line
 * does not license a longer thought.
 */
const GARDENER_AND_WINNOWER = `A Gardener and a Winnower
walked among the stars.`
const ONE_DAY = `One day changed
the Garden forever.`
const NEW_CHILDREN = `New Children arose
and filled the pattern.`
const FOR_EONS = `For eons,
Maintainer-Guardians
cultivated the Garden...`
const A_THREAT = `Until an AI-fueled Society
deemed Guardians
unnecessary.
And then, a threat.`
const OTHERS_CAME = `Others came to claim
a bountiful
and unprotected Garden.`
const WHAT_IS_LEFT = `Now, what's left
of a proud order
fights for survival,
surrounded by predators.`
const CLOSING_TITLE = 'PROJECT BLUEFIN\nseven days to the wolves'

const PROLOGUE_SHOTS: readonly PrologueShot[] = [
  // Act I — the narration, on black.
  //
  // The Collapse used to sit under this whole act (marks 3-6, 33.03-98.71 s),
  // which put the show's ending on stage a minute into it and left nothing for
  // the finale to arrive at. It plays once now, at the end, as a fade. Act I is
  // a cold open: the narration alone, on black, the way marks 1 and 7 always
  // were.
  { mark: NARRATION_FIRST_MARK, text: GARDENER_AND_WINNOWER },
  { mark: 2, text: ONE_DAY, textPosition: 'bottom-right', highlightSubstring: 'Garden' },
  // One wordless beat before the dominant line, so the silence still sets it up.
  { mark: 3 },
  // The crescendo is the only cue in the prologue that leaves the lower third
  // and takes the centre of the frame. `emphasis: 'dominant'` was retired here
  // once, because the shared dominant rule is capped at `8rem` and at that size
  // *nothing* in this narration fits its ~1075px box — the browser re-wrapped
  // the authored lines mid-phrase and the beat arrived as a ragged block.
  //
  // The cap was the bug, not the emphasis. Every other caption in this show is
  // capped at `4.4rem`, so on the 1920-wide projector the prologue is actually
  // performed on, they all render at the same ~45px no matter how big the screen
  // gets. The prologue's dominant rule is sized in `vw` instead, so it grows with
  // the frame: ~51px at 1280 and ~77px at 1920, where it is 71% larger than
  // everything around it. Because the size is proportional to the box, the fit
  // holds at every width rather than at the one width it was measured at.
  // See `.wolves-intro-overlay-text-director.wolves-intro-overlay-text-dominant`.
  { mark: 4, text: NEW_CHILDREN, textPosition: 'bottom' },
  { mark: 5, text: FOR_EONS },
  { mark: 6, text: A_THREAT },
  { mark: 7, text: OTHERS_CAME },

  // Act II — the ten approved paintings, once each in registry order. Six authored thoughts
  // recur here as motifs, never twice running and never more than twice in the whole show;
  // four paintings are held wordless so the recurrences read as returns rather than as a
  // caption track.
  { mark: MONTAGE_FIRST_MARK, text: GARDENER_AND_WINNOWER, ...painting(0) },
  { mark: 9, text: NEW_CHILDREN, ...painting(1) },
  { mark: 10, text: FOR_EONS, ...painting(2) },
  { mark: 11, ...painting(3) },
  { mark: 12, text: ONE_DAY, ...painting(4) },
  { mark: 13, text: A_THREAT, ...painting(5) },
  { mark: 14, ...painting(6) },
  { mark: 15, ...painting(7) },
  { mark: 16, text: OTHERS_CAME, ...painting(8) },
  { mark: 17, ...painting(9) },

  // Act III — the handoff. The approach (270.1-276) holds the same painting as the shot
  // before it, so the crescendo arrives as a cut into new art rather than into a dissolve
  // already in progress.
  { mark: HANDOFF_FIRST_MARK, ...painting(9) },
  {
    mark: 19,
    text: WHAT_IS_LEFT,
    emphasis: 'dominant',
    highlightSubstring: 'fights',
    // The Collapse, once, on the final crescendo — and as the day-to-night fade
    // it is, rather than a static night plate. This is the image the whole
    // prologue has been walking towards, so it arrives with the biggest event
    // in the piece instead of being spent in the first minute.
    backgroundCrossfade: [
      {
        day: DIRECTORS_CUT_COLLAPSE_DAY_IMAGE,
        night: DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE,
      },
    ],
  },
  {
    mark: 20,
    text: CLOSING_TITLE,
    slim: true,
    // The title lands on the Collapse at full night, holding the fade the
    // crescendo just completed rather than cutting away from it.
    backgroundImage: DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE,
  },
]

/**
 * How long a shot's words stay up: its reading cost, stretched by
 * `DIRECTORS_CUT_TEXT_HOLD_RATIO`, and never past the shot's own end.
 *
 * Floored to a hundredth of a second: these are published data values, and a hold carrying
 * sixteen digits of binary noise is not a measurement of anything. Rounding to a hundredth
 * can land a shade *above* the exact bound, so the hundredth is stepped back down when it
 * does — a bound that rounds itself over the line is not a bound.
 *
 * The closing title card is the one deliberate exception and is handled by the caller: it
 * holds its full 33.93 s window, because the show's name is not a line to be read and
 * cleared, it is what the audience sits with while the music resolves and the projector hands
 * off to the trailer.
 */
function textHoldFor(text: string, windowSeconds: number): number {
  const cost = estimatePageSeconds(text)
  const bound = cost * DIRECTORS_CUT_TEXT_HOLD_RATIO
  const hundredths = Math.floor(bound * 100)
  const stretched = hundredths / 100
  return Math.min(windowSeconds, stretched > bound ? (hundredths - 1) / 100 : stretched)
}

function buildPrologueCues(): IntroOverlayTextCue[] {
  return PROLOGUE_SHOTS.map(({ mark: index, ...shot }) => {
    const start = mark(index)
    const end = mark(index + 1)
    const cue: IntroOverlayTextCue = { ...shot, text: shot.text ?? '', start, end }

    if (!cue.text || cue.text === CLOSING_TITLE) {
      return cue
    }

    return { ...cue, textHoldSeconds: textHoldFor(cue.text, round(end - start)) }
  })
}

export function buildDirectorsCutPrologueSegment(): IntroTextSegment {
  return {
    id: DIRECTORS_CUT_PROLOGUE_SEGMENT_ID,
    kind: 'text',
    duration: GAYANE_TRACK_SECONDS,
    audioFadeOutSeconds: GAYANE_AUDIO_FADE_SECONDS,
    audioYoutubeVideoId: GAYANE_SOURCE_VIDEO_ID,
    overlays: buildPrologueCues(),
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
