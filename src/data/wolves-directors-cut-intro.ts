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

/**
 * "Excerpt from The Tribulation" - the prologue's scored source.
 *
 * It replaces Khachaturian's Gayane Adagio on owner instruction (2026-08-10),
 * and the replacement is a recut, not a retime: Gayane ran 325.6 s and this
 * runs 134.65 s. Every mark, cue and hold below was re-derived from this
 * recording. Nothing was scaled across from the old grid, because a ratio
 * applied to a different piece of music lands on nothing in this one.
 */
export const TRIBULATION_SOURCE_VIDEO_ID = 'uvtR84x0kgw' as const

/**
 * Full playable length, in seconds. Measured: `yt-dlp` -> `ffprobe` reports a
 * 134.653 s decoded stream.
 */
export const TRIBULATION_TRACK_SECONDS = 134.65

/** First audible sample (RMS > -60 dBFS). This source opens essentially on the downbeat. */
export const TRIBULATION_FIRST_AUDIBLE_SECOND = 0.05

/** Last audible sample. The tail after this is silence in the container. */
export const TRIBULATION_LAST_AUDIBLE_SECOND = 130.82

/**
 * Only the already-silent tail is faded, so the fade can never clip a note.
 */
const TRIBULATION_AUDIO_FADE_SECONDS = 2.5

/**
 * The prologue's cue grid: every measured musical boundary this cut is allowed
 * to cut on, in order, ending on the track's own end.
 *
 * Derived the same two independent ways the Gayane grid was, and kept only
 * where they agree:
 *
 * - **Laplacian structural segmentation** (librosa recurrence matrix +
 *   spectral clustering) run at k = 4..10 and voted; the vote count is
 *   recorded per mark below.
 * - **Checkerboard-kernel novelty** over an MFCC self-similarity matrix,
 *   peak-picked independently of the clustering, normalised to the strongest
 *   event in the piece (23.41 s = 1.000).
 *
 * A mark carried by both methods is annotated with both numbers. Four marks
 * are novelty-only and are annotated as such - they are kept because they fall
 * in stretches where the clustering found no boundary at all and a shot would
 * otherwise have to run more than twenty seconds on one image.
 *
 * There are no equal slices here and no second clock.
 */
export const TRIBULATION_PROLOGUE_MARKS = [
  /*  0 */ 0, //      curtain; the source is audible from 0.05 s
  /*  1 */ 2.53, //   novelty 0.952 + laplacian (3/7) at 1.14 - the piece establishes
  /*  2 */ 13.79, //  laplacian (3/7) + novelty 0.416 at 14.40
  /*  3 */ 23.41, //  novelty 1.000, the strongest event in the piece
  /*  4 */ 33.02, //  laplacian (7/7) + novelty 0.583 at 33.85
  /*  5 */ 43.26, //  laplacian (6/7) + novelty 0.315 at 42.61
  /*  6 */ 52.13, //  novelty 0.469 (novelty-only)
  /*  7 */ 58.31, //  novelty 0.604 (novelty-only)
  /*  8 */ 65.16, //  laplacian (4/7) + novelty 0.486 at 65.46
  /*  9 */ 72.31, //  laplacian (7/7) + novelty 0.547 at 73.10
  /* 10 */ 81.29, //  laplacian (3/7) + novelty 0.592 at 81.13
  /* 11 */ 90.53, //  laplacian (7/7) + novelty 0.416 at 89.88
  /* 12 */ 94.41, //  laplacian (3/7) + novelty 0.489 at 94.30
  /* 13 */ 103.51, // laplacian (3/7) + novelty 0.423 at 103.86
  /* 14 */ 109.04, // laplacian (7/7) + novelty 0.766 at 108.74 - the last movement opens
  /* 15 */ 117.17, // novelty 0.369 (novelty-only)
  /* 16 */ 126.78, // laplacian (7/7) + novelty 0.662 at 127.15 - the closing
  /* 17 */ TRIBULATION_TRACK_SECONDS,
] as const

const NARRATION_FIRST_MARK = 1
const ARRIVAL_FIRST_MARK = 14
const CLOSING_MARK = 16

/**
 * The measured second the piece's final crescendo starts.
 *
 * The defiant handoff line is cut to this, not to the section boundary before it: 270.1 s is
 * a real mark, but it is the *approach*, and putting the line there spent six seconds of the
 * biggest moment in the piece on a line the audience had already finished reading.
 */
export const DIRECTORS_CUT_FINAL_CRESCENDO_SECOND = TRIBULATION_PROLOGUE_MARKS[14]

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
export const DIRECTORS_CUT_IKORA_PREWARM_SECOND = TRIBULATION_PROLOGUE_MARKS[13]

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

/**
 * The score is swappable; the cut is not.
 *
 * The prologue's 134.65 s window and its mark grid are authored against the
 * default mood and stay fixed no matter which track is playing. A mood is an
 * audio substitution *under* that grid, never a re-cut: it supplies a start
 * offset into its own recording so the excerpt the show uses is the part worth
 * hearing, and the segment's existing fade ends it on a decay rather than a
 * hard cut.
 *
 * Only the default's cuts land on its own measured musical events - the grid
 * was derived from it. An alternate is phrased against a grid built for a
 * different piece, so some will fit better than others. That is the accepted
 * trade of having a picker at all, and it is why `DEFAULT_PROLOGUE_MOOD_ID`
 * exists as a separate exported thing rather than "the first entry": a run
 * nobody touches must play the mood the cut was actually built for.
 *
 * `trackSeconds` is the recording's full measured length and exists to bound
 * `offsetSeconds`: a mood whose offset plus the show's window runs past the end
 * of its own track would fall silent before the title card.
 */
export interface PrologueMood {
  readonly id: string
  /** Shown in the transport picker. Keep it short; the widget is one line. */
  readonly label: string
  readonly youtubeVideoId: string
  /** Seconds into the recording where the show's window begins. */
  readonly offsetSeconds: number
  /** Full measured length of the recording, via `yt-dlp` -> `ffprobe`. */
  readonly trackSeconds: number
}

export const PROLOGUE_MOODS: readonly PrologueMood[] = [
  {
    id: 'tribulation',
    label: 'Bleak',
    youtubeVideoId: 'uvtR84x0kgw',
    offsetSeconds: 0,
    trackSeconds: TRIBULATION_TRACK_SECONDS,
  },
  {
    // Nightwish, "Perfume Of The Timeless (Orchestral Version)", measured at
    // 493.59 s. It runs 3.7x the length of the show, so it is played from the
    // top and faded out at the window's end; the opening is where the piece is
    // quietest, which suits a prologue that now begins on empty space.
    // The offset is a starting point to audition, not a measured result.
    id: 'timeless',
    label: 'Orchestral',
    youtubeVideoId: '88rc8UAdhfQ',
    offsetSeconds: 0,
    trackSeconds: 493.59,
  },
  {
    // Khachaturian's Gayane Ballet Suite (Adagio) - the prologue's original
    // score, measured at 325.6 s when this cut still ran its full length. It is
    // here because it costs one entry and it is the mood the piece was first
    // written against; the show now uses its first 134.65 s, which is the
    // movement's opening statement rather than its crescendo.
    id: 'adagio',
    label: 'Adagio',
    youtubeVideoId: 'EB3IokHelRk',
    offsetSeconds: 0,
    trackSeconds: 325.6,
  },
] as const

export const DEFAULT_PROLOGUE_MOOD_ID = 'tribulation' as const

export function resolvePrologueMood(id: string | undefined): PrologueMood {
  return PROLOGUE_MOODS.find(mood => mood.id === id)
    ?? PROLOGUE_MOODS.find(mood => mood.id === DEFAULT_PROLOGUE_MOOD_ID)!
}

function mark(index: number): number {
  return TRIBULATION_PROLOGUE_MARKS[index]
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
  /** Index into `TRIBULATION_PROLOGUE_MARKS` where this shot cuts in; it runs to the next mark. */
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
  // Act I - the Golden Age, and its loss. No black open.
  //
  // The previous cut spent its first 108 s - a third of the piece - on
  // narration over an empty frame, and the owner's review named it first:
  // "too much black in the beginning, I want to see scenes". So the montage
  // starts on the downbeat and the narration plays over it. That is also the
  // only way the authored lines fit at all: this track is 134.65 s against
  // Gayane's 325.6 s, and a montage that waited for the narration to finish
  // would have about twenty seconds left to run in.
  //
  // It opens on the world as it was, under banners and a lit sky, and only then
  // begins the descent. A prologue that opens on ruin asks an audience to mourn
  // something it has never seen; this one shows it first.
  { mark: NARRATION_FIRST_MARK, text: GARDENER_AND_WINNOWER, ...painting(0) },
  { mark: 2, ...painting(1) },

  // The strongest event in the piece (23.41 s, novelty 1.000) takes the
  // creation line, over vegetation visibly filling the pattern. It sat on the
  // drowned city once, where it read as a mismatch rather than as irony and
  // spent the biggest moment in the track on a contradiction the audience had
  // been given no way to decode.
  { mark: 3, text: NEW_CHILDREN, textPosition: 'bottom', ...painting(2) },
  { mark: 4, text: FOR_EONS, ...painting(3) },

  // The densest thought in the prologue takes the longer of the two windows
  // available to it: 8.87 s here against 6.18 s at the next mark. Four lines at
  // theater distance need the room, and the shot after it is wordless.
  { mark: 5, text: A_THREAT, ...painting(4) },
  { mark: 6, ...painting(5) },
  { mark: 7, ...painting(6) },
  { mark: 8, ...painting(7) },

  // The invasion line, over the invasion, cutting straight into the calamity.
  // Nine wordless seconds used to separate the two, which left a one-pass
  // audience to infer the link on its own.
  { mark: 9, text: OTHERS_CAME, ...painting(8) },

  // Act II - the Collapse, as the day-to-night fade it is, once, carrying the
  // line that names it. It is the fulcrum of the piece, so it takes the centre
  // of the frame rather than the lower third.
  //
  // It carries no `calamity` vignette. That layer darkened to 0.85 opacity over
  // a frame the crossfade was already taking to night, and between the two the
  // painting was crushed to silhouette.
  {
    mark: 10,
    text: ONE_DAY,
    emphasis: 'dominant',
    highlightSubstring: 'Garden',
    backgroundCrossfade: [
      {
        day: DIRECTORS_CUT_COLLAPSE_DAY_IMAGE,
        night: DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE,
      },
    ],
  },
  // One short wordless beat on the night plate: the aftermath, not a pause.
  { mark: 11, backgroundImage: DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE },
  { mark: 12, ...painting(9) },
  { mark: 13, ...painting(10) },

  // Act III - the cold arrival. Europa is held to the end on owner
  // instruction, so these are the first ice frames in the whole prologue;
  // after ninety seconds of ruined Earth they read as somewhere else entirely.
  { mark: ARRIVAL_FIRST_MARK, text: WHAT_IS_LEFT, emphasis: 'dominant', highlightSubstring: 'fights', ...painting(11) },
  { mark: 15, ...painting(12) },

  // The title, on the last measured boundary, over Europa - the one Europa
  // exception the owner named for this slide. It holds its full window while
  // the music resolves and the projector hands off to the trailer.
  { mark: CLOSING_MARK, text: CLOSING_TITLE, slim: true, ...painting(12) },
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

export function buildDirectorsCutPrologueSegment(moodId?: string): IntroTextSegment {
  const mood = resolvePrologueMood(moodId)

  return {
    id: DIRECTORS_CUT_PROLOGUE_SEGMENT_ID,
    kind: 'text',
    // The window is the cut's, not the track's. Every mood plays this long and
    // is faded out here, however much of its own recording is left over.
    duration: TRIBULATION_TRACK_SECONDS,
    audioFadeOutSeconds: TRIBULATION_AUDIO_FADE_SECONDS,
    audioYoutubeVideoId: mood.youtubeVideoId,
    audioStartSeconds: mood.offsetSeconds || undefined,
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
