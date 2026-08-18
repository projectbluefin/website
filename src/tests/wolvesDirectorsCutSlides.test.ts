import { describe, expect, it } from 'vitest'
import { wallpapers } from '../components/wolves/wallpapers-list'
import {
  buildDirectorsCutTrackZeroSlides,
  createDirectorsCutSlideRandom,
  DIRECTORS_CUT_FINALE_START,
  DIRECTORS_CUT_RESERVED_FINALE_INTERVAL,
  DIRECTORS_CUT_TRACK_ZERO_SECTIONS,
  directorsCutSectionSlideCount,
} from '../data/wolves-directors-cut-slides'
import { getWolvesGalleryEventKey } from '../data/wolves-gallery-cycle'
import { TRACK_ZERO_SLIDE_MINIMUM_HOLD_SECONDS } from '../data/wolves-slide-preload'
import {
  TRACK_ZERO_BEAT_TIMES,
  TRACK_ZERO_SECTIONS,
  TRACK_ZERO_SHORTEST_BEAT_SECONDS,
  TRACK_ZERO_TEMPO_PICKUPS,
  trackZeroBeatCuts,
} from '../data/wolves-track-zero-beats'
import { TRACK_ZERO_PRESENTATION_SECTIONS } from '../data/wolves-track-zero-manifest'
import {
  bluefinGroupSlides,
  jonoBaconSlideId,
  jonoBaconTrackZeroWindow,
  lauraSlideId,
  lauraTrackZeroWindow,
  marinaMooreSlideId,
  marinaMooreTrackZeroWindow,
  postHeroOpeningSequenceIds,
  rezaContributorSlideId,
  rezaContributorTrackZeroWindow,
  topheeSlideId,
  topheeTrackZeroWindow,
  trackZeroFastFinalePhotoIds,
} from '../data/wolves-track-zero-slides'

interface TestSlide {
  id: string
  title: string
  isLocal: boolean
  path?: string
  type: 'single' | 'daynight'
  dayName?: string
  nightName?: string
  fit?: 'cover' | 'contain'
  description?: string
  theaterTitleOnly?: boolean
  kind?: 'cncf'
  rawPhoto?: { id: string, server: string, secret: string, title: string }
}

function isOnMeasuredGrid(time: number): boolean {
  return TRACK_ZERO_BEAT_TIMES.some(beat => Math.abs(beat - time) < 0.0005)
}

function localSlide(wallpaper: (typeof wallpapers)[number]): TestSlide {
  return {
    id: wallpaper.name || wallpaper.dayName || wallpaper.nightName || '',
    title: wallpaper.title,
    isLocal: true,
    path: wallpaper.name,
    type: wallpaper.type,
    dayName: wallpaper.dayName,
    nightName: wallpaper.nightName,
    fit: wallpaper.fit,
    description: wallpaper.description,
    theaterTitleOnly: wallpaper.theaterTitleOnly,
  }
}

const localSlides = wallpapers.filter(wallpaper => !wallpaper.name?.endsWith('.gif')).map(localSlide)
const isPeople = (slide: TestSlide) => slide.id.includes('/people/')
const peopleSlides = localSlides.filter(isPeople)
const showcaseSlides = localSlides.filter(slide => !isPeople(slide) && slide.type !== 'daynight')
const dayNightSlides = localSlides.filter(slide => !isPeople(slide) && slide.type === 'daynight')

/**
 * A stand-in for the live CNCF feed, shaped exactly like the remote slides the
 * reader builds from `public/flickr-photos.json`: `KC+CNC_<region>_<date>_...`
 * export titles so the gallery-cycle event grouping sees real event keys.
 */
const cncfSlides: TestSlide[] = Array.from({ length: 400 }, (_, index) => {
  const rawPhoto = {
    id: `9${String(index).padStart(9, '0')}`,
    server: '65535',
    secret: `s${index}`,
    title: `KC+CNC_${['NA', 'EU', 'CN', 'JP'][index % 4]}_2${40 + (index % 6)}319_KCS_Session${index % 17}_MN_${index}`,
  }
  return {
    id: rawPhoto.id,
    title: rawPhoto.title,
    isLocal: false,
    path: `https://live.staticflickr.com/${rawPhoto.server}/${rawPhoto.id}_${rawPhoto.secret}_b.jpg`,
    type: 'single' as const,
    kind: 'cncf' as const,
    rawPhoto,
  }
})

function buildSchedule(overrides: Partial<Parameters<typeof buildDirectorsCutTrackZeroSlides<TestSlide>>[0]> = {}) {
  return buildDirectorsCutTrackZeroSlides<TestSlide>({
    dayNightSlides,
    showcaseSlides,
    peopleSlides,
    cncfSlides,
    ...overrides,
  })
}

const schedule = buildSchedule()

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

/** Every hold the built schedule gives one authored Director's Cut section. */
function sectionHolds(
  built: readonly { startTime: number, endTime: number, duration: number }[],
  section: { startTime: number, endTime: number },
): number[] {
  return built
    .filter(slide => slide.startTime >= section.startTime && slide.endTime <= section.endTime)
    .map(slide => slide.duration)
}

/**
 * The holds the *standard* cut's pacing table produces over the same window,
 * built through the same measured-beat helper the reader uses. This is the
 * baseline the Director's Cut has to beat; without it, "frantic" is a doc
 * comment rather than a measurement.
 */
function standardHolds(startTime: number, endTime: number, beatGroups: readonly number[]): number[] {
  const count = directorsCutSectionSlideCount(startTime, endTime, beatGroups)
  const cuts = trackZeroBeatCuts(startTime, endTime, count, beatGroups)
  return cuts.map((cut, index) => cut - (index === 0 ? startTime : cuts[index - 1]!))
}

describe('director\'s cut finale boundary', () => {
  it('reserves the measured 5:55 finale pickup, not an invented round timestamp', () => {
    expect(DIRECTORS_CUT_FINALE_START).toBe(TRACK_ZERO_SECTIONS.bkEnd)
    expect(DIRECTORS_CUT_FINALE_START).toBe(TRACK_ZERO_TEMPO_PICKUPS.finale)
    expect(DIRECTORS_CUT_FINALE_START).toBe(TRACK_ZERO_PRESENTATION_SECTIONS.finaleBarrage.startTime)
    expect(isOnMeasuredGrid(DIRECTORS_CUT_FINALE_START)).toBe(true)
    // A hand-picked round timestamp would divide cleanly; a measured beat does not.
    expect(Number.isInteger(DIRECTORS_CUT_FINALE_START)).toBe(false)
    expect(DIRECTORS_CUT_FINALE_START * 10 % 1).not.toBe(0)
  })

  it('leaves the whole outro to the finale and starts after the last quote window', () => {
    expect(DIRECTORS_CUT_FINALE_START).toBeGreaterThan(TRACK_ZERO_SECTIONS.pivotalStart)
    expect(DIRECTORS_CUT_FINALE_START).toBeLessThan(TRACK_ZERO_SECTIONS.finaleStart)
    expect(DIRECTORS_CUT_RESERVED_FINALE_INTERVAL.startTime).toBe(DIRECTORS_CUT_FINALE_START)
    // Open-ended on purpose: the terminal fade's end is a Task 8 anchor, not a
    // slide boundary, so nothing ordinary may resume after the finale opens.
    expect(DIRECTORS_CUT_RESERVED_FINALE_INTERVAL.endTime).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('director\'s cut track zero slide schedule', () => {
  it('cuts only on measured beats', () => {
    expect(schedule.length).toBeGreaterThan(100)
    for (const slide of schedule) {
      expect(isOnMeasuredGrid(slide.endTime), `off-grid cut at ${slide.endTime}`).toBe(true)
    }
  })

  it('runs contiguously from zero and stops exactly on the reserved finale anchor', () => {
    expect(schedule[0].startTime).toBe(0)
    for (let index = 1; index < schedule.length; index++) {
      expect(schedule[index].startTime).toBe(schedule[index - 1].endTime)
    }
    expect(schedule[schedule.length - 1].endTime).toBe(DIRECTORS_CUT_FINALE_START)
    for (const slide of schedule) {
      expect(slide.duration).toBeGreaterThan(0)
      expect(slide.duration).toBeCloseTo(slide.endTime - slide.startTime, 9)
    }
  })

  it('never leaks a slide into the reserved finale interval', () => {
    for (const slide of schedule) {
      expect(slide.startTime).toBeLessThan(DIRECTORS_CUT_RESERVED_FINALE_INTERVAL.startTime)
      expect(slide.endTime).toBeLessThanOrEqual(DIRECTORS_CUT_RESERVED_FINALE_INTERVAL.startTime)
    }
  })

  it('honours an earlier reserved interval instead of running to the authored anchor', () => {
    const earlier = buildSchedule({
      reservedIntervals: [
        { startTime: TRACK_ZERO_SECTIONS.buildStart, endTime: Number.POSITIVE_INFINITY },
        DIRECTORS_CUT_RESERVED_FINALE_INTERVAL,
      ],
    })

    expect(earlier[earlier.length - 1].endTime).toBe(TRACK_ZERO_SECTIONS.buildStart)
    expect(earlier.every(slide => slide.endTime <= TRACK_ZERO_SECTIONS.buildStart)).toBe(true)
  })

  it('snaps an off-grid reservation back to a measured beat instead of cutting off it', () => {
    // 300.0s is not a measured beat. Handing it straight to trackZeroBeatCuts
    // would clamp the last cut to exactly 300 and put an off-grid cut on stage.
    const offGrid = buildSchedule({
      reservedIntervals: [{ startTime: 300, endTime: Number.POSITIVE_INFINITY }],
    })
    const finalCut = offGrid[offGrid.length - 1].endTime

    expect(isOnMeasuredGrid(300)).toBe(false)
    expect(isOnMeasuredGrid(finalCut)).toBe(true)
    expect(finalCut).toBeLessThanOrEqual(300)
    expect(offGrid.every(slide => isOnMeasuredGrid(slide.endTime))).toBe(true)
  })

  it('treats a reservation as a hand-off and never resumes after it', () => {
    // A bounded interval is documented as a hand-off, not a gap: nothing
    // ordinary may come back after whatever owns the interval takes the frame.
    const handedOff = buildSchedule({
      reservedIntervals: [{ startTime: TRACK_ZERO_SECTIONS.bridgeStart, endTime: TRACK_ZERO_SECTIONS.buildStart }],
    })

    expect(handedOff[handedOff.length - 1].endTime).toBe(TRACK_ZERO_SECTIONS.bridgeStart)
    expect(handedOff.some(slide => slide.startTime >= TRACK_ZERO_SECTIONS.buildStart)).toBe(false)
  })

  it('never reuses an image', () => {
    const ids = schedule.map(slide => slide.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('drops every ordinary authored Track 0 lock', () => {
    const lockedSlides = [
      { id: jonoBaconSlideId, window: jonoBaconTrackZeroWindow },
      { id: marinaMooreSlideId, window: marinaMooreTrackZeroWindow },
      ...bluefinGroupSlides.map(slide => ({ id: slide.id, window: slide.window })),
      { id: lauraSlideId, window: lauraTrackZeroWindow },
      { id: topheeSlideId, window: topheeTrackZeroWindow },
      { id: rezaContributorSlideId, window: rezaContributorTrackZeroWindow },
    ]
    const scheduled = new Map(schedule.map(slide => [slide.id, slide] as const))
    const eligible = lockedSlides.filter(lock => peopleSlides.some(slide => slide.id === lock.id))
    const played = lockedSlides.filter(lock => scheduled.has(lock.id))

    // Every locked portrait is available to the Director's draw — so a portrait
    // that does not play was passed over by the cycle, not missing from the pool.
    expect(eligible.map(lock => lock.id)).toEqual(lockedSlides.map(lock => lock.id))
    for (const lock of played) {
      const slide = scheduled.get(lock.id)!
      expect([slide.startTime, slide.endTime], `${lock.id} kept its authored window`)
        .not
        .toEqual([lock.window.startTime, lock.window.endTime])
    }

    // The freezes are windows, not ids: nothing may hold across them.
    for (const window of [
      { startTime: TRACK_ZERO_SECTIONS.pivotalStart, endTime: TRACK_ZERO_SECTIONS.pivotalEnd },
      { startTime: TRACK_ZERO_SECTIONS.pivotalEnd, endTime: TRACK_ZERO_SECTIONS.bkEnd },
    ]) {
      const held = schedule.some(slide =>
        slide.startTime <= window.startTime && slide.endTime >= window.endTime)
      expect(held, `freeze ${window.startTime}-${window.endTime} survived`).toBe(false)
    }

    // The post-hero opening run is a locked back-to-back order in the standard
    // show; the Director cut must not preserve that adjacency.
    const orderedIds = schedule.map(slide => slide.id)
    const lockedRun = postHeroOpeningSequenceIds.join('\u0000')
    expect(orderedIds.join('\u0000')).not.toContain(lockedRun)
  })

  it('releases the standard fast-finale photo reservation into the body of the cut', () => {
    const reserved = schedule.filter(slide => trackZeroFastFinalePhotoIds.has(slide.id))
    expect(reserved.length).toBeGreaterThan(0)
    expect(reserved.every(slide => slide.endTime <= DIRECTORS_CUT_FINALE_START)).toBe(true)
  })

  it('paces every section on readable cinematic phrases and tightens within it', () => {
    DIRECTORS_CUT_TRACK_ZERO_SECTIONS.forEach((section) => {
      expect(Math.min(...section.beatGroups)).toBeGreaterThanOrEqual(4)
      const sectionSlides = schedule.filter(slide =>
        slide.startTime >= section.startTime && slide.endTime <= section.endTime)
      expect(sectionSlides.length, `empty section ${section.id}`).toBeGreaterThan(0)
      expect(sectionSlides[0].duration).toBeGreaterThanOrEqual(sectionSlides[sectionSlides.length - 1].duration)
    })

    // Tightening across the whole cut: the opening hold is the longest in the
    // show and the climax holds are the shortest.
    const first = DIRECTORS_CUT_TRACK_ZERO_SECTIONS[0]
    const last = DIRECTORS_CUT_TRACK_ZERO_SECTIONS[DIRECTORS_CUT_TRACK_ZERO_SECTIONS.length - 1]
    expect(first.beatGroups[0]).toBeGreaterThan(last.beatGroups[0])
    expect(last.endTime).toBe(DIRECTORS_CUT_FINALE_START)
  })

  // The Director's Cut only earns its name if the pictures are visibly moving
  // faster than the standard show's. The first cut's phrase groups were
  // *longer* than the standard's in three of six sections, which made "frantic"
  // a claim in a doc comment rather than a property of the edit.
  //
  // Compared at schedule level, not tier by tier: three standard sections
  // already tighten to a four-beat phrase, and four beats is the readable floor
  // for a projected image, so the Director's Cut cannot beat them by going
  // shorter there. It beats them by spending far less of each section on its
  // long tier.
  it('runs visibly faster than the standard cut in every shared section', () => {
    for (const section of DIRECTORS_CUT_TRACK_ZERO_SECTIONS) {
      const standard = TRACK_ZERO_PRESENTATION_SECTIONS[section.id as keyof typeof TRACK_ZERO_PRESENTATION_SECTIONS]
      if (!standard || !('beatGroups' in standard)) {
        continue
      }

      const director = sectionHolds(schedule, section)
      const reference = standardHolds(section.startTime, section.endTime, standard.beatGroups)

      expect(mean(director), `${section.id} mean hold`).toBeLessThan(mean(reference))
      expect(Math.max(...director), `${section.id} longest hold`).toBeLessThan(Math.max(...reference))
      expect(director.length, `${section.id} slide count`).toBeGreaterThan(reference.length)
    }
  })

  // The standard show freezes two images across the pivotal and bketelsen
  // anchors — 5.526s and 4.737s of held frame. The Director's Cut has no
  // freezes at all: it is still cutting when the finale takes the frame.
  it('replaces the standard cut\'s two climax freezes with a running montage', () => {
    const climax = DIRECTORS_CUT_TRACK_ZERO_SECTIONS[DIRECTORS_CUT_TRACK_ZERO_SECTIONS.length - 1]
    expect(climax.id).toBe('soloClimax')

    const holds = sectionHolds(schedule, climax)
    const standardFreezes = [
      TRACK_ZERO_SECTIONS.pivotalEnd - TRACK_ZERO_SECTIONS.pivotalStart,
      TRACK_ZERO_SECTIONS.bkEnd - TRACK_ZERO_SECTIONS.pivotalEnd,
    ]

    expect(holds.length).toBeGreaterThan(standardFreezes.length)
    expect(Math.max(...holds)).toBeLessThan(Math.min(...standardFreezes))
  })

  it('tightens monotonically from the opening hold to the climax', () => {
    const sectionMeans = DIRECTORS_CUT_TRACK_ZERO_SECTIONS.map(section => mean(sectionHolds(schedule, section)))

    for (const [index, sectionMean] of sectionMeans.entries()) {
      if (index === 0) {
        continue
      }
      expect(sectionMean, `${DIRECTORS_CUT_TRACK_ZERO_SECTIONS[index].id} is not tighter than the section before it`)
        .toBeLessThanOrEqual(sectionMeans[index - 1]!)
    }
  })

  it('keeps every hold long enough for the decode-aware preload lead to cover it', () => {
    // Sub-second cuts read as a random slideshow and leave too little time for
    // a projector image to decode, settle and be understood. The floor is not a
    // taste call: it is what the reader's own preload window divided by its
    // lookahead depth can actually keep ahead of.
    const shortest = Math.min(...schedule.map(slide => slide.duration))
    expect(shortest).toBeGreaterThanOrEqual(TRACK_ZERO_SLIDE_MINIMUM_HOLD_SECONDS)
    // Four measured beats at the track's fastest passage. Derived from the grid
    // rather than typed in, so a re-measured beat table moves it.
    expect(shortest).toBeGreaterThanOrEqual(4 * TRACK_ZERO_SHORTEST_BEAT_SECONDS)
  })

  it('preserves source and credit metadata verbatim', () => {
    const sources = new Map([...peopleSlides, ...showcaseSlides, ...dayNightSlides, ...cncfSlides]
      .map(slide => [slide.id, slide] as const))
    // The credit line is derived from `kind`/`isLocal` by getGalleryCaptionLabel,
    // so a dropped field silently retitles a photographer's frame on screen.
    const thin = buildSchedule({
      dayNightSlides: dayNightSlides.slice(0, 1),
      showcaseSlides: showcaseSlides.slice(0, 2),
      peopleSlides: peopleSlides.slice(0, 3),
    })

    for (const slide of [...schedule, ...thin]) {
      const source = sources.get(slide.id)
      expect(source, `unknown slide ${slide.id}`).toBeDefined()
      const { startTime, duration, endTime, ...rest } = slide
      expect(rest).toEqual(source)
      expect(startTime).toBeTypeOf('number')
      expect(duration).toBeTypeOf('number')
      expect(endTime).toBeTypeOf('number')
    }
    expect(thin.some(slide => slide.kind === 'cncf' && slide.rawPhoto !== undefined)).toBe(true)
    expect(schedule.every(slide => slide.isLocal)).toBe(true)
  })

  it('backfills a short local pool from unused CNCF photos', () => {
    const thin = buildSchedule({
      dayNightSlides: dayNightSlides.slice(0, 1),
      showcaseSlides: showcaseSlides.slice(0, 2),
      peopleSlides: peopleSlides.slice(0, 3),
    })

    expect(thin.length).toBe(schedule.length)
    expect(thin.filter(slide => slide.kind === 'cncf').length).toBeGreaterThan(schedule.length - 10)
    expect(new Set(thin.map(slide => slide.id)).size).toBe(thin.length)
    expect(thin[thin.length - 1].endTime).toBe(DIRECTORS_CUT_FINALE_START)
  })

  it('never draws a CNCF feed photo that duplicates a local curated copy', () => {
    const duplicated = { ...cncfSlides[0], id: '55168684055', rawPhoto: { ...cncfSlides[0].rawPhoto!, id: '55168684055' } }
    const curatedByName = { ...cncfSlides[1], id: '55164385253' }
    const withDuplicates = buildSchedule({
      peopleSlides: peopleSlides.slice(0, 3),
      cncfSlides: [duplicated, curatedByName, ...cncfSlides],
      duplicateCncfPhotoIds: new Set(['55164385253']),
    })

    // 'wolves/people/kubecon-55168684055.webp' is Marina's curated copy of the
    // same frame, so the raw feed photo must never also play.
    expect(withDuplicates.some(slide => slide.id === '55168684055')).toBe(false)
    expect(withDuplicates.some(slide => slide.id === '55164385253')).toBe(false)
  })

  it('separates adjacent gallery events wherever the cycle helper can', () => {
    const adjacentRepeats = schedule.filter((slide, index) =>
      index > 0 && getWolvesGalleryEventKey(slide) === getWolvesGalleryEventKey(schedule[index - 1]))

    expect(adjacentRepeats).toEqual([])
  })

  it('is deterministic for the same input', () => {
    expect(buildSchedule().map(slide => [slide.id, slide.startTime, slide.endTime]))
      .toEqual(schedule.map(slide => [slide.id, slide.startTime, slide.endTime]))
  })

  it('does not re-deal the show when the CNCF feed resolves', () => {
    // The reader rebuilds this schedule the moment `flickr-photos.json` lands.
    // The local pools are cycled off the same seeded generator, so a feed that
    // arrived first would shift every draw after it.
    const beforeFeed = buildSchedule({ cncfSlides: [] })

    expect(beforeFeed.map(slide => [slide.id, slide.startTime, slide.endTime]))
      .toEqual(schedule.map(slide => [slide.id, slide.startTime, slide.endTime]))
  })

  it('produces a different order for a different seed without breaking the grid', () => {
    const reseeded = buildSchedule({ random: createDirectorsCutSlideRandom(9001) })

    expect(reseeded.map(slide => slide.id)).not.toEqual(schedule.map(slide => slide.id))
    expect(reseeded.map(slide => slide.endTime)).toEqual(schedule.map(slide => slide.endTime))
    expect(new Set(reseeded.map(slide => slide.id)).size).toBe(reseeded.length)
  })

  it('degrades to the pool it is given instead of repeating an image', () => {
    const tiny = buildDirectorsCutTrackZeroSlides<TestSlide>({
      peopleSlides: peopleSlides.slice(0, 4),
    })

    expect(tiny.length).toBe(4)
    expect(new Set(tiny.map(slide => slide.id)).size).toBe(4)
    expect(tiny[tiny.length - 1].endTime).toBeLessThanOrEqual(DIRECTORS_CUT_FINALE_START)
  })

  it('returns nothing when every pool is empty', () => {
    expect(buildDirectorsCutTrackZeroSlides<TestSlide>({})).toEqual([])
  })
})
