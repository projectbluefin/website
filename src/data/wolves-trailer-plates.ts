/**
 * Trailer 1 — the teaser's plate (text overlay) schedule.
 *
 * PROVENANCE: this is a web recreation of the owner's cut "Trailer 1.0"
 * (delivered 2026-08-17), whose authoritative record is the destiny-vids repo
 * at `stories/trailer-1-plates.json`. Every string below is owner-authored
 * copy reproduced VERBATIM from that manifest — do not reword, re-case, or
 * "fix" any of it here; change the source manifest and re-port instead.
 *
 * The picture is Nightwish's "Perfume Of The Timeless" (YouTube O0lyFqLr3Cc)
 * played from 0:00 to exactly 1:50 — the same single source the prologue is
 * cut from — with these plates composited over it. The destiny-vids build
 * conforms the upload by one frame before cutting; that offset is meaningless
 * for a live web embed and is deliberately not modelled here.
 */

export const TRAILER_VIDEO_ID = 'O0lyFqLr3Cc'

/** The trailer is exactly 1:50.000; the player pauses (not ends) at this mark. */
export const TRAILER_DURATION_SECONDS = 110

/**
 * The trailer's title plate stays up across both authored beats; the credit
 *  line joins at the second beat (maintitle-b, 15.4s in the source manifest).
 */
export const TRAILER_CREDIT_JOIN_SECONDS = 15.4

/** Authored casing preserved: the card uppercases in CSS, as the film does. */
export const TRAILER_TITLE_LABEL = 'PROJECT BLUEFIN'
export const TRAILER_TITLE_ACCENT = 'BLUEFIN'
export const TRAILER_TITLE_LINE = 'seven days to the wolves'
export const TRAILER_CREDIT_LINE = 'Music by Nightwish | Action by Bungie'

export interface TrailerPlate {
  id: string
  kind: 'maintitle' | 'bookline' | 'daycard' | 'endcard'
  /** Window in seconds of trailer time, [start, end). */
  start: number
  end: number
  title?: string
  lines?: string[]
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
  },
  {
    id: 'book-a',
    kind: 'bookline',
    start: 26.9,
    end: 33.64,
    lines: [
      'Two Generations of Contributors',
      'One at their beginning',
      'One at their end',
      'These are their Real Stories',
    ],
  },
  {
    id: 'daycard-extinction',
    kind: 'daycard',
    start: 88.8,
    end: 93.8,
    title: 'Extinction is the Rule',
  },
  {
    id: 'daycard-survival',
    kind: 'daycard',
    start: 94.4,
    end: 100.6,
    title: 'Survival is the Exception',
  },
  {
    id: 'endcard-event',
    kind: 'endcard',
    start: 102.2,
    end: TRAILER_DURATION_SECONDS,
    title: 'KubeCon | CloudNativeCon North America',
    lines: [
      'wolves.projectbluefin.io',
      '#KubeCon #CloudNativeCon #7wolves',
    ],
  },
] as const

/** The plates visible at a given trailer timestamp. */
export function activeTrailerPlates(timeSeconds: number): TrailerPlate[] {
  if (!Number.isFinite(timeSeconds)) {
    return []
  }
  return TRAILER_PLATES.filter(plate => timeSeconds >= plate.start && timeSeconds < plate.end)
}
