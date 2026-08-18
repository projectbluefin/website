/**
 * The Director's Cut Track 0 slide schedule.
 *
 * The standard show's Track 0 schedule is a hand-authored edit: hero portraits
 * pinned to named windows, a locked post-hero run, an eight-second Reza hold,
 * two freezes across the thesis anchors, and a reserved photo for the closing
 * hold. Those locks are the standard cut's storytelling and they stay exactly
 * where they are — this module never touches them, and the standard schedule
 * still comes from `WolvesComicReader`'s own `timelineSlides`.
 *
 * The Director's Cut is a different edit of the same song: quote-led, with the
 * pictures running underneath at a frantic pace that tightens section by
 * section until the finale takes the frame. Every cut below still lands on a
 * measured beat from `TRACK_ZERO_BEAT_TIMES`; the only thing that changes is
 * how short the phrase groups are and that nothing is pinned.
 *
 * Nothing here is a wall clock. Section boundaries are the authored
 * `TRACK_ZERO_SECTIONS` marks and every cut is an entry of the measured grid.
 */

import type { WolvesGalleryPhoto } from './wolves-gallery-cycle'
import { buildWolvesGalleryCycle, separateAdjacentEvents } from './wolves-gallery-cycle'
import {
  TRACK_ZERO_BEAT_TIMES,
  TRACK_ZERO_SECTIONS,
  trackZeroBeatCuts,
  trackZeroNearestBeatIndex,
} from './wolves-track-zero-beats'

/**
 * Where the Director's Cut hands the frame to its finale: the measured beat at
 * 355.219s.
 *
 * This is not a new number and not a round one. It is
 * `TRACK_ZERO_SECTIONS.bkEnd` — measured beat 879, the same beat the standard
 * show already calls `TRACK_ZERO_TEMPO_PICKUPS.finale` (the 5:55 pickup) and
 * already uses as the start of its own `finaleBarrage` section. It is the last
 * section boundary the song offers before the outro, which makes it the only
 * anchor where the picture edit can stop without stopping mid-phrase.
 *
 * Choosing it hands the Director finale the whole closing section (355.219s to
 * the end of the segment) — room to pre-arm and run the companion video,
 * cross-fade the Collapse artwork, carry the full bulletin window through the
 * handoff, and clear it on the companion play anchor before the impact. It
 * also leaves room to land both quote clauses and the terminal fade.
 * `TRACK_ZERO_SECTIONS.finaleStart` was the alternative and is far too late:
 * it leaves under sixteen seconds for all of that.
 */
export const DIRECTORS_CUT_FINALE_START: number = TRACK_ZERO_SECTIONS.bkEnd

export interface DirectorsCutReservedInterval {
  startTime: number
  endTime: number
}

/**
 * The one interval the ordinary schedule may not enter. Open-ended on purpose:
 * once the finale opens it owns the frame through the terminal fade to black,
 * and that fade's end is a finale anchor, not a slide boundary. Nothing
 * ordinary ever resumes, so there is no closing edge to state.
 *
 * Running the schedule on through the finale in a corner panel was tried and
 * rejected: beside the Collapse fade and the closing quote, a second moving
 * picture in the corner is one thing too many to look at, and the deck reads as
 * something that failed to stop rather than something that ended. The pictures
 * finish here and the finale carries the rest of the song by itself.
 */
export const DIRECTORS_CUT_RESERVED_FINALE_INTERVAL: DirectorsCutReservedInterval = {
  startTime: DIRECTORS_CUT_FINALE_START,
  endTime: Number.POSITIVE_INFINITY,
}
type DirectorsCutPoolName = 'dayNight' | 'showcase' | 'people' | 'cncf'

export interface DirectorsCutTrackZeroSection {
  readonly id: string
  readonly startTime: number
  readonly endTime: number
  /**
   * Descending per-slide beat counts, read by `trackZeroBeatCuts`: the section
   * opens on the first tier and tightens to the last.
   */
  readonly beatGroups: readonly number[]
  /** Pools drawn in order; each falls through to the next once exhausted. */
  readonly pools: readonly DirectorsCutPoolName[]
}

/**
 * The groups shorten as the song moves, but never below a four-beat phrase.
 * The previous 3/2-beat climax produced 0.79-second random-pool cuts: technically
 * on beat, but visually indistinguishable from an unpolished slideshow.
 *
 * Four beats is the floor: roughly 1.5 seconds at the track's fastest passage.
 * That is still a rapid montage, but a projected image has time to decode,
 * settle and register before the next cut — and it is exactly what the reader's
 * preload depth can keep ahead of (see
 * `TRACK_ZERO_SLIDE_MINIMUM_HOLD_SECONDS`).
 *
 * Every tier here is shorter than the standard show's for the same section (see
 * `TRACK_ZERO_PRESENTATION_SECTIONS`) except where the standard has already
 * reached that floor. The first cut of this table was *slower* than the
 * standard show through the chorus, bridge and build — a Director's Cut whose
 * pictures moved less than the cut it was supposed to intensify. Three sections
 * therefore share the standard's four-beat short tier and win on the long tier
 * instead: the Director's Cut spends far less of each section on its opening
 * hold, which is what the audience reads as pace.
 *
 * The first tier is a target, not a ceiling: `trackZeroBeatCuts` adds each
 * section's leftover beats to its opening hold, so slide 0 of a section can run
 * a little longer than the tier says. That is the intended shape — the longest
 * hold of the section is its first.
 */
export const DIRECTORS_CUT_TRACK_ZERO_SECTIONS: readonly DirectorsCutTrackZeroSection[] = [
  {
    id: 'ambientIntro',
    startTime: 0,
    endTime: TRACK_ZERO_SECTIONS.verseStart,
    beatGroups: [12, 8],
    pools: ['dayNight', 'showcase', 'people', 'cncf'],
  },
  {
    id: 'drivingVerse',
    startTime: TRACK_ZERO_SECTIONS.verseStart,
    endTime: TRACK_ZERO_SECTIONS.chorusStart,
    beatGroups: [10, 6],
    pools: ['showcase', 'dayNight', 'people', 'cncf'],
  },
  {
    id: 'contributorChorus',
    startTime: TRACK_ZERO_SECTIONS.chorusStart,
    endTime: TRACK_ZERO_SECTIONS.bridgeStart,
    beatGroups: [6, 4],
    pools: ['people', 'cncf', 'showcase'],
  },
  {
    id: 'chantingBridge',
    startTime: TRACK_ZERO_SECTIONS.bridgeStart,
    endTime: TRACK_ZERO_SECTIONS.buildStart,
    beatGroups: [5, 4],
    pools: ['people', 'cncf', 'showcase'],
  },
  {
    id: 'heavyBuild',
    startTime: TRACK_ZERO_SECTIONS.buildStart,
    endTime: TRACK_ZERO_SECTIONS.pivotalStart,
    beatGroups: [5, 4],
    pools: ['people', 'cncf', 'showcase'],
  },
  {
    id: 'soloClimax',
    startTime: TRACK_ZERO_SECTIONS.pivotalStart,
    endTime: DIRECTORS_CUT_FINALE_START,
    beatGroups: [5, 4],
    pools: ['people', 'cncf', 'showcase'],
  },
] as const

/** Default seed for the Director's Cut draw order. */
export const DIRECTORS_CUT_SLIDE_SEED = 505

/**
 * The same `Math.sin` generator the reader's `deterministicShuffle` uses. The
 * schedule is rebuilt whenever the CNCF feed resolves, so an unseeded shuffle
 * would re-deal the whole show underneath a playing segment.
 */
export function createDirectorsCutSlideRandom(seed: number = DIRECTORS_CUT_SLIDE_SEED): () => number {
  let currentSeed = seed
  return () => {
    const value = Math.sin(currentSeed++) * 10000
    return value - Math.floor(value)
  }
}

export type DirectorsCutSlideSource = WolvesGalleryPhoto

export interface DirectorsCutSlideWindow {
  startTime: number
  duration: number
  endTime: number
}

export type DirectorsCutTimelineSlide<T extends DirectorsCutSlideSource> = T & DirectorsCutSlideWindow

export interface DirectorsCutSlidesInput<T extends DirectorsCutSlideSource> {
  /** Local day/night wallpapers. */
  dayNightSlides?: readonly T[]
  /** Local single-frame showcase wallpapers. */
  showcaseSlides?: readonly T[]
  /** Local Wolves people/contributor wallpapers. */
  peopleSlides?: readonly T[]
  /** The live CNCF Flickr feed, used to backfill any section the locals cannot fill. */
  cncfSlides?: readonly T[]
  /**
   * Intervals the ordinary schedule may not enter; defaults to the finale
   * reservation.
   *
   * A reservation is a hand-off, not a gap: the schedule stops at the earliest
   * `startTime` and never resumes, because whatever owns a reserved interval
   * owns the frame from there on. `endTime` describes the interval for its
   * owner and is deliberately not read here — a schedule that resumed after one
   * would have to re-enter mid-phrase.
   */
  reservedIntervals?: readonly DirectorsCutReservedInterval[]
  /**
   * Feed photo ids that are already on screen as a curated local copy under a
   * hand-written filename, so the digit match below cannot catch them.
   */
  duplicateCncfPhotoIds?: ReadonlySet<string>
  random?: () => number
}

/**
 * Feed ids that a local slide already carries. Curated Track 0 copies keep the
 * Flickr id in their filename (`wolves/people/kubecon-55168684055.webp`), so
 * the same frame would otherwise play twice under two different slide ids —
 * the reader's `trackZeroFlickrPhotoIds` exists for exactly this reason.
 */
function localFeedPhotoIds(slides: readonly DirectorsCutSlideSource[]): Set<string> {
  const ids = new Set<string>()
  for (const slide of slides) {
    for (const match of slide.id.matchAll(/\d{8,}/g)) {
      ids.add(match[0])
    }
  }
  return ids
}

/**
 * The last measured beat at or before `time`.
 *
 * `trackZeroBeatCuts` clamps its final cut to the window end it is handed, so a
 * window end that is not itself a measured beat puts an off-grid cut in the
 * show — the one thing this module exists to prevent. Every window end is
 * therefore snapped *backwards*: forwards would let the last slide run past the
 * boundary it is supposed to stop on.
 */
function measuredBeatAtOrBefore(time: number): number {
  const index = trackZeroNearestBeatIndex(time)
  const beat = TRACK_ZERO_BEAT_TIMES[index]!
  return beat <= time ? beat : (TRACK_ZERO_BEAT_TIMES[index - 1] ?? 0)
}

/**
 * Slides for one section, chosen so the section is filled at the pacing its
 * beat groups describe: roughly half the slides on the long tier and half on
 * the short one, clamped so the count can never exceed the beat budget (which
 * would drop `trackZeroBeatCuts` into its off-grid uniform fallback) or fall
 * below it (which would leave one oversized hold at the front).
 */
export function directorsCutSectionSlideCount(
  startTime: number,
  endTime: number,
  beatGroups: readonly number[],
): number {
  const totalBeats = trackZeroNearestBeatIndex(endTime) - trackZeroNearestBeatIndex(startTime)
  const longest = beatGroups[0]!
  const shortest = beatGroups[beatGroups.length - 1]!
  if (totalBeats < shortest) {
    return 0
  }
  const balanced = Math.round((2 * totalBeats) / (longest + shortest))
  const fewest = Math.ceil(totalBeats / longest)
  const most = Math.floor(totalBeats / shortest)
  return Math.max(1, Math.min(Math.max(balanced, fewest), most))
}

export function buildDirectorsCutTrackZeroSlides<T extends DirectorsCutSlideSource>(
  input: DirectorsCutSlidesInput<T>,
): DirectorsCutTimelineSlide<T>[] {
  const random = input.random ?? createDirectorsCutSlideRandom()
  const reservedIntervals = input.reservedIntervals ?? [DIRECTORS_CUT_RESERVED_FINALE_INTERVAL]
  const scheduleEnd = measuredBeatAtOrBefore(reservedIntervals.reduce(
    (earliest, interval) => Math.min(earliest, interval.startTime),
    DIRECTORS_CUT_FINALE_START,
  ))

  const localSlides = [
    ...(input.dayNightSlides ?? []),
    ...(input.showcaseSlides ?? []),
    ...(input.peopleSlides ?? []),
  ]
  const alreadyLocal = localFeedPhotoIds(localSlides)
  const drawn = new Set<string>()
  const eligible = (slide: T) => !drawn.has(slide.id)

  // Event-diverse order per pool. `buildWolvesGalleryCycle` spreads each shoot
  // across its pool and repairs the leftovers, so a breakout room cannot deal
  // eight near-identical frames in a row.
  const cycle = (slides: readonly T[] = []) => {
    const unique: T[] = []
    const seen = new Set<string>()
    for (const slide of slides) {
      if (!seen.has(slide.id)) {
        seen.add(slide.id)
        unique.push(slide)
      }
    }
    return unique.length > 0 ? buildWolvesGalleryCycle(unique, random) : []
  }

  // Order is load-bearing, not cosmetic. Every pool draws from one shared
  // seeded generator, so the CNCF pool is cycled LAST: the reader rebuilds this
  // schedule when the Flickr feed resolves, and cycling a suddenly-populated
  // feed before the local pools would re-deal the whole show underneath a
  // playing segment.
  const pools: Record<DirectorsCutPoolName, T[]> = {
    dayNight: [],
    showcase: [],
    people: [],
    cncf: [],
  }
  pools.dayNight = cycle(input.dayNightSlides)
  pools.showcase = cycle(input.showcaseSlides)
  pools.people = cycle(input.peopleSlides)
  pools.cncf = cycle((input.cncfSlides ?? []).filter(slide =>
    !alreadyLocal.has(slide.id) && !(input.duplicateCncfPhotoIds?.has(slide.id) ?? false)))
  const cursors: Record<DirectorsCutPoolName, number> = { dayNight: 0, showcase: 0, people: 0, cncf: 0 }

  function draw(count: number, order: readonly DirectorsCutPoolName[]): T[] {
    const picked: T[] = []
    for (const name of order) {
      const pool = pools[name]
      while (picked.length < count && cursors[name] < pool.length) {
        const slide = pool[cursors[name]++]!
        if (eligible(slide)) {
          drawn.add(slide.id)
          picked.push(slide)
        }
      }
      if (picked.length === count) {
        break
      }
    }
    return picked
  }

  // Pass 1: draw each section's slides, remembering how many belong to it.
  const sectionDraws: { section: DirectorsCutTrackZeroSection, endTime: number, count: number }[] = []
  const ordered: T[] = []
  for (const section of DIRECTORS_CUT_TRACK_ZERO_SECTIONS) {
    if (section.startTime >= scheduleEnd) {
      break
    }
    const endTime = Math.min(section.endTime, scheduleEnd)
    const wanted = directorsCutSectionSlideCount(section.startTime, endTime, section.beatGroups)
    const picked = draw(wanted, section.pools)
    if (picked.length === 0) {
      continue
    }
    ordered.push(...picked)
    sectionDraws.push({ section, endTime, count: picked.length })
  }

  // Pass 2: repair the seams between pools, which each pool's own cycle cannot
  // see. Fenced at the section boundaries drawn above: an unfenced swap fixes
  // the seam in the list while moving a photo into a section it was never drawn
  // for, which is how a day/night wallpaper ends up in the climax montage.
  const sectionStarts: number[] = []
  sectionDraws.reduce((start, { count }) => {
    sectionStarts.push(start)
    return start + count
  }, 0)
  const separated = separateAdjacentEvents(ordered, sectionStarts)

  // Pass 3: hand each section its measured cuts.
  const schedule: DirectorsCutTimelineSlide<T>[] = []
  let cursor = 0
  let startTime = 0
  for (const { section, endTime, count } of sectionDraws) {
    const slides = separated.slice(cursor, cursor + count)
    cursor += count
    const cuts = trackZeroBeatCuts(startTime, endTime, count, section.beatGroups)
    slides.forEach((slide, index) => {
      const cut = cuts[index]!
      schedule.push({ ...slide, startTime, duration: cut - startTime, endTime: cut })
      startTime = cut
    })
  }

  return schedule
}
