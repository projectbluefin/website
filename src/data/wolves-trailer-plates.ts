/**
 * Trailer 1 — the teaser's recreation of the owner's cut.
 *
 * PROVENANCE: this is a web recreation of the owner's cut "Trailer 1.0"
 * (delivered 2026-08-17), whose authoritative record is the destiny-vids repo
 * at `stories/trailer-1-plates.json`, with the plate DESIGN authored in
 * `cards/maintitle.html`, `cards/bookline.html` and `cards/daycard.html` and
 * the composition in `scripts/build_trailer1.py`. Every string below is
 * owner-authored copy reproduced VERBATIM — do not reword, re-case, or "fix"
 * any of it here; change the source manifest and re-port instead.
 *
 * THE CUT IS THREE SEGMENTS, NOT ONE VIDEO WITH OVERLAYS. This is the thing
 * the first recreation got wrong: it played the music video for the full
 * 1:50 and drew every plate on top of it. The delivered trailer leaves the
 * music video at 88.2 s and never returns to it.
 *
 *   0      -> 88.2    the music video, letterboxed 2.39:1 into a 16:9 frame
 *   88.2   -> 102.2   the March Bluefin wallpaper, day falling into night
 *   102.2  -> 110.02  the March Bluefin night wallpaper, as a poster end card
 *
 * So both day cards and the whole end card sit on the wallpaper at FULL
 * frame, with no letterbox — which is also why they carry no scrim: the
 * owner had it removed ("remove the black translucent box around the words")
 * and the contrast is carried by a halo on the glyphs instead.
 */

/**
 * The picture the teaser embeds. NOT the destiny-vids ingest, and deliberately
 * left as it was found — the video is the owner's call, not this file's.
 */
export const TRAILER_VIDEO_ID = 'O0lyFqLr3Cc'

/** The trailer is exactly 1:50.020; the player pauses (not ends) at this mark. */
export const TRAILER_DURATION_SECONDS = 110.02

/**
 * Segment boundaries, from `scripts/build_trailer1.py`:
 * picture 88.200 + bridge 14.000 + end card 7.820 = 110.020.
 */
export const TRAILER_PICTURE_END_SECONDS = 88.2
export const TRAILER_BRIDGE_END_SECONDS = 102.2

/** `BRIDGE_MONTH = 3` — the owner named `03-bluefin-day`. */
export const TRAILER_BRIDGE_MONTH = '03'

/**
 * The bridge's five legs, from `build_trailer1.py`. They sum to 14.000, and
 * the leg names are the build's own: the wallpaper rises out of black, holds
 * as day, turns to night, holds, then falls back to black before the end card.
 */
export const TRAILER_BRIDGE_LEGS = {
  up: 1.4,
  dayHold: 1.0,
  turn: 4.4,
  nightHold: 1.4,
  down: 5.8,
} as const

/** End card fades, relative to the end card's own start at 102.2. */
export const TRAILER_ENDCARD_EVENT_IN = 1.2
export const TRAILER_ENDCARD_EVENT_FADE = 1.1
export const TRAILER_ENDCARD_CTA_IN = 3.1
export const TRAILER_ENDCARD_CTA_FADE = 0.6
export const TRAILER_ENDCARD_FADE = 1.2

/**
 * The title plate stays up across both authored beats; the credit line joins
 * at the second beat (maintitle-b). The title must not move when it does, so
 * the credit row always occupies its space.
 */
export const TRAILER_CREDIT_JOIN_SECONDS = 15.4

/** Authored casing preserved: the card uppercases in CSS, as the film does. */
export const TRAILER_TITLE_LABEL = 'PROJECT BLUEFIN'
export const TRAILER_TITLE_LINE = 'seven days to the wolves'
export const TRAILER_CREDIT_LINE = 'Music by Nightwish | Action by Bungie'

/**
 * EVERY B AND EVERY F IS BLUE. Owner, 2026-08-15: "Ensure every b is blue, and
 * every f is blue in all the dialogue except the chat bubbles and nameplates."
 *
 * #4285f4 is NOT picked and is NOT `--wc-gold` (#60a5fa, a UI token). It is the
 * published fill of the fin ligature in Project Bluefin's own wordmark, so the
 * coloured letters here carry the same value the real mark's one coloured
 * element does.
 */
export const TRAILER_ACCENT_COLOR = '#4285f4'
export const TRAILER_BLUE_LETTERS = 'BbFf'

export interface TrailerPlate {
  id: string
  kind: 'maintitle' | 'bookline' | 'daycard' | 'endcard-event' | 'endcard-cta'
  /** Window in seconds of trailer time, [start, end). */
  start: number
  end: number
  title?: string
  subtitle?: string
  lines?: string[]
  tags?: string[]
  /**
   * Box centre in the 1920x1080 authoring frame, for plates the build walks
   * across the picture rather than centring.
   */
  anchor?: readonly [number, number]
  fadeIn?: number
  fadeOut?: number
}

export const TRAILER_PLATES: readonly TrailerPlate[] = [
  {
    id: 'maintitle',
    kind: 'maintitle',
    // maintitle-a 11.0+4.4 and maintitle-b 15.4+7.2 are one continuous title
    // presence in the cut; the credit line appears mid-way (see
    // TRAILER_CREDIT_JOIN_SECONDS).
    start: 11.0,
    end: 22.6,
    title: TRAILER_TITLE_LINE,
    lines: [TRAILER_CREDIT_LINE],
    // TITLE_FADE = 1.400, and TITLE_OUT = 22.600 is this plate's own end.
    fadeIn: 1.4,
    fadeOut: 1.4,
  },
  {
    id: 'book-a',
    kind: 'bookline',
    start: 26.9,
    end: 33.64,
    anchor: [1030, 443],
    lines: [
      'Two Generations of Contributors',
      'One at their beginning',
      'One at their end',
      'These are their Real Stories',
    ],
  },
  {
    // The box alone, carrying no copy: it keeps the book's printed words
    // covered as the shot moves on. Empty `lines` is the authored state.
    id: 'book-b',
    kind: 'bookline',
    start: 31.0,
    end: 34.9,
    anchor: [1000, 470],
    lines: [],
  },
  {
    id: 'daycard-extinction',
    kind: 'daycard',
    start: 88.8,
    end: 93.8,
    title: 'Extinction is the Rule',
    fadeIn: 0.4,
    fadeOut: 0.5,
  },
  {
    id: 'daycard-survival',
    kind: 'daycard',
    start: 94.4,
    end: 100.6,
    title: 'Survival is the Exception',
    fadeIn: 0.5,
    fadeOut: 0.6,
  },
  {
    // Start is the build's ENDCARD_EVENT_IN (1.200 into the end card), which
    // is when the rows actually begin to arrive; the manifest's nominal `at`
    // is when the transparent PNG joins the graph.
    id: 'endcard-event',
    kind: 'endcard-event',
    start: TRAILER_BRIDGE_END_SECONDS + TRAILER_ENDCARD_EVENT_IN,
    end: TRAILER_DURATION_SECONDS,
    title: 'KubeCon | CloudNativeCon North America',
    subtitle: 'Salt Lake City, Utah',
    fadeIn: TRAILER_ENDCARD_EVENT_FADE,
    fadeOut: TRAILER_ENDCARD_FADE,
  },
  {
    // The CTA is a second card over the first: the event rows stay where they
    // are and the domain arrives at the music's returning swell.
    id: 'endcard-cta',
    kind: 'endcard-cta',
    start: TRAILER_BRIDGE_END_SECONDS + TRAILER_ENDCARD_CTA_IN,
    end: TRAILER_DURATION_SECONDS,
    title: 'wolves.projectbluefin.io',
    tags: ['#KubeCon', '#CloudNativeCon', '#7wolves'],
    fadeIn: TRAILER_ENDCARD_CTA_FADE,
    fadeOut: TRAILER_ENDCARD_FADE,
  },
] as const

/** The plates visible at a given trailer timestamp. */
export function activeTrailerPlates(timeSeconds: number): TrailerPlate[] {
  if (!Number.isFinite(timeSeconds)) {
    return []
  }
  return TRAILER_PLATES.filter(plate => timeSeconds >= plate.start && timeSeconds < plate.end)
}

export type TrailerSegment = 'picture' | 'bridge' | 'endcard'

/** Which of the cut's three pictures is on screen at a given timestamp. */
export function trailerSegmentAt(timeSeconds: number): TrailerSegment {
  if (!Number.isFinite(timeSeconds) || timeSeconds < TRAILER_PICTURE_END_SECONDS) {
    return 'picture'
  }
  return timeSeconds < TRAILER_BRIDGE_END_SECONDS ? 'bridge' : 'endcard'
}

function ramp(value: number, from: number, to: number): number {
  if (to <= from) {
    return value >= to ? 1 : 0
  }
  return Math.max(0, Math.min(1, (value - from) / (to - from)))
}

export interface TrailerBridgeState {
  /** The wallpaper's own opacity over black, so the bridge opens and closes dark. */
  opacity: number
  /**
   * 0 is the day wallpaper, 1 the night one. Owner: "start the wallpaper at day
   * and then as it fades into dark bring in the text."
   */
  nightMix: number
}

/** Where the bridge's day-to-night walk has got to at a given timestamp. */
export function trailerBridgeState(timeSeconds: number): TrailerBridgeState {
  const { up, dayHold, turn, nightHold } = TRAILER_BRIDGE_LEGS
  const t = timeSeconds - TRAILER_PICTURE_END_SECONDS
  const turnStart = up + dayHold
  const turnEnd = turnStart + turn
  const fallStart = turnEnd + nightHold
  const span = TRAILER_BRIDGE_END_SECONDS - TRAILER_PICTURE_END_SECONDS
  return {
    opacity: Math.min(ramp(t, 0, up), 1 - ramp(t, fallStart, span)),
    nightMix: ramp(t, turnStart, turnEnd),
  }
}

/** A plate's opacity, honouring its authored fade in/out. */
export function trailerPlateOpacity(plate: TrailerPlate, timeSeconds: number): number {
  if (timeSeconds < plate.start || timeSeconds >= plate.end) {
    return 0
  }
  const rising = plate.fadeIn ? Math.min(1, (timeSeconds - plate.start) / plate.fadeIn) : 1
  const falling = plate.fadeOut ? Math.min(1, (plate.end - timeSeconds) / plate.fadeOut) : 1
  return Math.max(0, Math.min(rising, falling))
}

/**
 * Split an authored string on its spaced pipes so the divider can be DRAWN as
 * a rule instead of set as a glyph. The copy is not edited: the same
 * characters are on screen, in the same order, and one of them is a rule.
 *
 * Only the spaced form ` | ` is a divider; a pipe inside a word is not.
 */
export function splitOnSear(text: string): string[] {
  return text.split(' | ')
}

export type TrailerToken
  = | { kind: 'text', value: string }
  /** One blue letterform. Changes no text — only the fill of a glyph. */
    | { kind: 'accent', value: string }
  /** The vertical glow standing in for a ` | `. */
    | { kind: 'sear' }
  /**
   * The Kubernetes helm standing in for one letter; `value` is that letter,
   *  which stays the image's alt text so the word is still read as written.
   */
    | { kind: 'mark', value: string }

interface TokenizeOptions {
  /** Apply the every-B-and-F rule. Off for other people's trademarks. */
  blue?: boolean
  /** Replace the single `o` of this word with the helm. */
  markWord?: string
  /** Accent every `.` instead of every B/F — the end card CTA's treatment. */
  accentDots?: boolean
}

function pushAccented(out: TrailerToken[], text: string, options: TokenizeOptions) {
  const accentable = options.accentDots
    ? '.'
    : (options.blue === false ? '' : TRAILER_BLUE_LETTERS)
  let run = ''
  for (const ch of text) {
    if (accentable.includes(ch)) {
      if (run) {
        out.push({ kind: 'text', value: run })
        run = ''
      }
      out.push({ kind: 'accent', value: ch })
    }
    else {
      run += ch
    }
  }
  if (run) {
    out.push({ kind: 'text', value: run })
  }
}

/**
 * Turn one authored line into the tokens the card draws.
 *
 * Nothing here edits copy. A sear replaces how a pipe is DRAWN, an accent
 * changes the fill of a letterform, and the mark swaps a glyph for an image
 * that carries the letter as its alt text.
 */
export function tokenizeTrailerLine(text: string, options: TokenizeOptions = {}): TrailerToken[] {
  const out: TrailerToken[] = []
  splitOnSear(text).forEach((part, index) => {
    if (index > 0) {
      out.push({ kind: 'sear' })
    }
    const word = options.markWord
    const at = word ? part.toLowerCase().lastIndexOf(word.toLowerCase()) : -1
    if (word && at !== -1) {
      const within = part.slice(at, at + word.length).toLowerCase().indexOf('o')
      if (within !== -1) {
        const letterAt = at + within
        pushAccented(out, part.slice(0, letterAt), options)
        out.push({ kind: 'mark', value: part[letterAt] })
        pushAccented(out, part.slice(letterAt + 1), options)
        return
      }
    }
    pushAccented(out, part, options)
  })
  return out
}
