import type { IntroVideoSpec } from '@/data/wolves-intro-sequence'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'
import { buildDirectorsCutVideoSequence } from '@/data/wolves-directors-cut-intro'
import { buildIntroVideoSequence } from '@/data/wolves-intro-sequence'
import {
  INTRO_SEQUENCE_DURATION,
  resolveOverallRatioTarget,
  useCinematicStore,
  WOLVES_DIRECTORS_CUT_EXPERIENCE,
  WOLVES_EXPERIENCE,
} from '@/stores/cinematic'

/** Authored segment durations, read back off the manifest — never re-typed here. */
const AUTHORED_DURATIONS = WOLVES_EXPERIENCE.segments.map(segment => segment.durationSeconds ?? 0)
const CINEMATIC_DURATION = AUTHORED_DURATIONS.reduce((sum, value) => sum + value, 0)
const OVERALL_DURATION = INTRO_SEQUENCE_DURATION + CINEMATIC_DURATION
const LAST_INDEX = CINEMATIC_SEGMENTS.length - 1

/**
 * Authored runtime of one intro segment, taken from the segment itself: a text card plays its
 * whole duration, a video segment plays from its rating-card offset to its authored cutoff.
 * Mirrors the store's own intro timeline contract so an expectation never re-types a number.
 */
function introSegmentDuration(segment: IntroVideoSpec): number {
  if (segment.kind === 'text') {
    return segment.duration
  }
  const nativeStart = segment.startOffset ?? 0
  return Math.max(0, (segment.maxDuration ?? nativeStart) - nativeStart)
}

/** Overall-timeline ratio landing in the middle of intro segment `index` of `sequence`. */
function introRatio(sequence: readonly IntroVideoSpec[], index: number, introDuration: number): number {
  const before = sequence
    .slice(0, index)
    .reduce((sum, segment) => sum + introSegmentDuration(segment), 0)
  return (before + introSegmentDuration(sequence[index]) / 2) / (introDuration + CINEMATIC_DURATION)
}

describe('cinematic store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    // The intro list AND the active segments are module-level state; leave the
    // standard show active so a Director's Cut test cannot leak into the next
    // one (loadExperience resets `activeSegments`; setIntroSequence resets the
    // intro list — a test that only did one would leave the other stale).
    const store = useCinematicStore()
    store.loadExperience(WOLVES_EXPERIENCE)
    store.setIntroSequence(buildIntroVideoSequence())
  })

  it('carries one authored duration per curated segment, in segment order', () => {
    // Regression guard: the authored duration array is built in
    // CINEMATIC_SEGMENTS order, one entry per segment of this seven-part show.
    // A mismatch in length or order silently shifts durations and freezes the
    // transport clock at the end of the affected segments.
    expect(WOLVES_EXPERIENCE.segments).toHaveLength(CINEMATIC_SEGMENTS.length)
    expect(WOLVES_EXPERIENCE.segments.map(segment => segment.id))
      .toEqual(CINEMATIC_SEGMENTS.map(segment => segment.id))
    expect(WOLVES_EXPERIENCE.segments.map(segment => segment.youtubeId))
      .toEqual(CINEMATIC_SEGMENTS.map(segment => segment.youtubeId))
    expect(AUTHORED_DURATIONS).toHaveLength(CINEMATIC_SEGMENTS.length)
    for (const duration of AUTHORED_DURATIONS) {
      expect(duration).toBeGreaterThan(0)
    }
    // Every segment carries a measured duration and none is a placeholder that
    // would clamp the transport clock short of the real runtime.
    expect(new Set(AUTHORED_DURATIONS).size).toBe(AUTHORED_DURATIONS.length)
  })

  it('reaches the end of every segment without the authored clock clamping early', () => {
    const store = useCinematicStore()
    store.enterCinematic()
    let expectedElapsed = 0
    for (const [index, duration] of AUTHORED_DURATIONS.entries()) {
      store.updateTime(duration, duration)
      expectedElapsed += duration
      expect(store.sequenceElapsed).toBeCloseTo(expectedElapsed)
      expect(store.totalElapsed).toBeCloseTo(expectedElapsed)
      if (index < LAST_INDEX) {
        store.advanceSegment()
      }
    }
    expect(store.sequenceElapsed).toBeCloseTo(store.sequenceDuration)
    expect(store.overallProgress).toBeCloseTo(1)
  })

  it('starts in the lobby on segment zero', () => {
    const store = useCinematicStore()
    expect(store.phase).toBe('lobby')
    expect(store.segmentIndex).toBe(0)
    expect(store.segment).toMatchObject(CINEMATIC_SEGMENTS[0])
  })

  it('tracks per-segment and total elapsed time across handoffs', () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.updateTime(120, 300)
    expect(store.segmentProgress).toBeCloseTo(0.4)
    expect(store.totalElapsed).toBe(120)

    store.advanceSegment()
    expect(store.segmentIndex).toBe(1)
    expect(store.segmentElapsed).toBe(0)
    expect(store.completedElapsed).toBe(AUTHORED_DURATIONS[0])

    store.updateTime(10, 200)
    expect(store.totalElapsed).toBe(AUTHORED_DURATIONS[0] + 10)
  })

  it('never advances past the final segment', () => {
    const store = useCinematicStore()
    for (let i = 0; i < 20; i++) {
      store.advanceSegment()
    }
    expect(store.segmentIndex).toBe(CINEMATIC_SEGMENTS.length - 1)
    expect(store.isLastSegment).toBe(true)
  })

  it('jumps to arbitrary segments with clamping and accrues only watched time', () => {
    const store = useCinematicStore()
    store.updateTime(30, 300)
    store.jumpToSegment(4)
    expect(store.segmentIndex).toBe(4)
    expect(store.completedElapsed).toBe(30)
    expect(store.segmentElapsed).toBe(0)
    expect(store.segmentDuration).toBe(AUTHORED_DURATIONS[4])

    store.jumpToSegment(-5)
    expect(store.segmentIndex).toBe(0)
    expect(store.segmentDuration).toBe(AUTHORED_DURATIONS[0])
    store.jumpToSegment(999)
    expect(store.segmentIndex).toBe(CINEMATIC_SEGMENTS.length - 1)
    expect(store.segmentDuration).toBe(AUTHORED_DURATIONS[LAST_INDEX])
  })

  it('keeps the final segment navigable when playback reaches its end', () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.jumpToSegment(CINEMATIC_SEGMENTS.length - 1)
    store.setPlaying(true)
    store.beginCrossfade(CINEMATIC_SEGMENTS.length - 1)
    store.finish()
    expect(store.phase).toBe('cinematic')
    expect(store.segmentIndex).toBe(CINEMATIC_SEGMENTS.length - 1)
    expect(store.playing).toBe(false)
    expect(store.crossfading).toBe(false)
    expect(store.widgetCanPrevious).toBe(true)
  })

  it('computes canonical overall elapsed/progress from intro status and keeps the intro-to-cinematic handoff continuous', () => {
    const store = useCinematicStore()
    const [titleCard, trailer] = buildIntroVideoSequence()
    if (titleCard?.kind !== 'text' || trailer?.kind !== 'video') {
      throw new Error('Expected the authored title card followed by the trailer')
    }
    const trailerStart = trailer.startOffset ?? 0
    const trailerDuration = (trailer.maxDuration ?? 0) - trailerStart

    store.enterIntro()
    store.syncIntroStatus({
      segmentIndex: 1,
      segmentElapsed: 60,
      segmentDuration: trailerDuration,
      nativeTime: trailerStart + 60,
    })

    const introElapsed = titleCard.duration + 60
    expect(store.sequenceElapsed).toBeCloseTo(introElapsed)
    expect(store.sequenceDuration).toBeCloseTo(INTRO_SEQUENCE_DURATION)
    expect(store.overallElapsed).toBeCloseTo(introElapsed)
    expect(store.overallDuration).toBeCloseTo(OVERALL_DURATION)
    expect(store.overallProgress).toBeCloseTo(introElapsed / OVERALL_DURATION)

    store.enterCinematic()
    store.updateTime(0, AUTHORED_DURATIONS[0], 0)

    expect(store.sequenceElapsed).toBe(0)
    expect(store.sequenceDuration).toBe(CINEMATIC_DURATION)
    expect(store.overallElapsed).toBeCloseTo(INTRO_SEQUENCE_DURATION)
    expect(store.overallProgress).toBeCloseTo(INTRO_SEQUENCE_DURATION / OVERALL_DURATION)
  })

  it('maps an overall ratio to the correct intro or cinematic segment and native time', () => {
    expect(resolveOverallRatioTarget(0)).toEqual(expect.objectContaining({
      phase: 'intro',
      segmentIndex: 0,
      segmentId: 'wolves-title-card',
      segmentElapsed: 0,
      nativeTime: 0,
    }))

    // Inside the trailer the native clock includes the authored startOffset.
    const [titleCard, trailer] = buildIntroVideoSequence()
    if (titleCard?.kind !== 'text' || trailer?.kind !== 'video') {
      throw new Error('Expected the authored title card followed by the trailer')
    }
    const fiveSecondsIntoTrailer = resolveOverallRatioTarget(
      (titleCard.duration + 5) / OVERALL_DURATION,
    )
    expect(fiveSecondsIntoTrailer).toEqual(expect.objectContaining({
      phase: 'intro',
      segmentIndex: 1,
      segmentId: 'wolves-intro',
    }))
    expect(fiveSecondsIntoTrailer.segmentElapsed).toBeCloseTo(5)
    expect(fiveSecondsIntoTrailer.nativeTime).toBeCloseTo((trailer.startOffset ?? 0) + 5)

    const startOfCinematic = resolveOverallRatioTarget(INTRO_SEQUENCE_DURATION / OVERALL_DURATION)
    expect(startOfCinematic.phase).toBe('cinematic')
    expect(startOfCinematic.segmentIndex).toBe(0)
    expect(startOfCinematic.segmentElapsed).toBeCloseTo(0)
    expect(startOfCinematic.nativeTime).toBeCloseTo(0)

    const fiveSecondsIntoCinematic = resolveOverallRatioTarget(
      (INTRO_SEQUENCE_DURATION + 5) / OVERALL_DURATION,
    )
    expect(fiveSecondsIntoCinematic).toEqual(expect.objectContaining({
      phase: 'cinematic',
      segmentIndex: 0,
    }))
    expect(fiveSecondsIntoCinematic.segmentElapsed).toBeCloseTo(5)
    expect(fiveSecondsIntoCinematic.nativeTime).toBeCloseTo(5)

    expect(resolveOverallRatioTarget(1)).toEqual(expect.objectContaining({
      phase: 'cinematic',
      segmentIndex: LAST_INDEX,
      segmentElapsed: AUTHORED_DURATIONS[LAST_INDEX],
      nativeTime: AUTHORED_DURATIONS[LAST_INDEX],
    }))
  })

  it('derives the intro timeline from the active intro sequence, not the standard one', () => {
    // `/wolves/` can run two different authored intros. The store used to build
    // its intro timeline once, from the standard sequence, so every Director's
    // Cut duration, index clamp, and TOTAL readout described the wrong list.
    const standard = buildIntroVideoSequence()
    const directorsCut = buildDirectorsCutVideoSequence()
    // Both cuts are two segments, so a length comparison cannot tell them apart and a
    // swapped or clamped list would look correct. What discriminates them is *which*
    // segments the store's timeline resolves — their ids and their per-segment durations.
    expect(directorsCut).toHaveLength(standard.length)
    expect(directorsCut.map(segment => segment.id)).not.toEqual(standard.map(segment => segment.id))

    const store = useCinematicStore()

    store.setIntroSequence(standard)
    store.enterIntro()
    const standardDuration = store.sequenceDuration
    const standardIds = standard.map((_, index) =>
      resolveOverallRatioTarget(introRatio(standard, index, standardDuration)).segmentId,
    )
    expect(standardIds).toEqual(['wolves-title-card', 'wolves-intro'])

    store.setIntroSequence(directorsCut)
    store.enterIntro()
    const directorsCutDuration = store.sequenceDuration

    // Different lists, different runtimes — derived, never re-typed here.
    expect(directorsCutDuration).toBeGreaterThan(standardDuration)
    expect(store.overallDuration).toBeCloseTo(directorsCutDuration + CINEMATIC_DURATION)
    // The exported binding follows the active sequence for its importers.
    expect(INTRO_SEQUENCE_DURATION).toBeCloseTo(directorsCutDuration)

    // Every intro position now resolves to a Director's Cut segment. This is the assertion
    // the old segment-count check used to carry: resolving 'wolves-title-card' or
    // 'wolves-intro' here means the timeline is still built from the standard list.
    const directorsCutIds = directorsCut.map((_, index) =>
      resolveOverallRatioTarget(introRatio(directorsCut, index, directorsCutDuration)).segmentId,
    )
    expect(directorsCutIds).toEqual(directorsCut.map(segment => segment.id))
    expect(directorsCutIds).not.toEqual(standardIds)

    // Per-segment resolution follows the active list's own authored durations rather than
    // being clamped into the standard one's.
    const openingCut = resolveOverallRatioTarget(0)
    expect(openingCut.segmentId).toBe(directorsCut[0].id)
    expect(openingCut.segmentDuration).toBeCloseTo(introSegmentDuration(directorsCut[0]))
    expect(openingCut.segmentDuration).not.toBeCloseTo(introSegmentDuration(standard[0]))

    const lastIndex = directorsCut.length - 1
    store.syncIntroStatus({
      segmentIndex: lastIndex,
      segmentElapsed: 0,
      segmentDuration: 0,
      nativeTime: 0,
    })
    expect(store.segmentIndex).toBe(lastIndex)
    expect(store.segmentDuration).toBeCloseTo(introSegmentDuration(directorsCut[lastIndex]))
    expect(store.sequenceElapsed).toBeCloseTo(directorsCutDuration - store.segmentDuration)
    expect(store.overallElapsed).toBeCloseTo(store.sequenceElapsed)

    // And switching back restores the standard sequence's math and its own segments.
    store.setIntroSequence(standard)
    store.enterIntro()
    expect(store.sequenceDuration).toBeCloseTo(standardDuration)
    expect(INTRO_SEQUENCE_DURATION).toBeCloseTo(standardDuration)
    expect(store.overallDuration).toBeCloseTo(standardDuration + CINEMATIC_DURATION)
    expect(standard.map((_, index) =>
      resolveOverallRatioTarget(introRatio(standard, index, standardDuration)).segmentId,
    )).toEqual(standardIds)
  })

  /**
   * The Director's Cut is a FORK of the Wolves show, not a re-edit of it: it keeps
   * 7 Days to the Wolves, which the show is named for, and everything after it is
   * material authored for this cut. The standard show keeps all seven of its
   * tracks, unchanged.
   *
   * This is pinned as a test because it is a decision an agent cannot infer from
   * the code — reusing a legacy track here would look like a reasonable way to
   * lengthen the cut, and would silently undo the fork.
   */
  it('keeps the Director\'s Cut a fork: no legacy track but 7 Days to the Wolves', () => {
    const directorsCutIds = WOLVES_DIRECTORS_CUT_EXPERIENCE.segments.map(segment => segment.id)
    const standardIds = CINEMATIC_SEGMENTS.map(segment => segment.id)
    const reusedLegacy = directorsCutIds.filter(id => standardIds.includes(id))

    expect(reusedLegacy).toEqual(['seven-days-to-the-wolves'])
    expect(directorsCutIds).toContain('europa-intro')

    // And the fork does not reach back into the standard show, which still plays
    // every one of its authored parts.
    expect(standardIds).toHaveLength(7)
    expect(standardIds).toContain('ghosts-in-the-mist')
  })
})
