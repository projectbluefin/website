import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'
import { buildDirectorsCutVideoSequence, buildIntroVideoSequence } from '@/data/wolves-intro-sequence'
import {
  INTRO_SEQUENCE_DURATION,
  resolveOverallRatioTarget,
  useCinematicStore,
  WOLVES_EXPERIENCE,
} from '@/stores/cinematic'

/** Authored segment durations, read back off the manifest — never re-typed here. */
const AUTHORED_DURATIONS = WOLVES_EXPERIENCE.segments.map(segment => segment.durationSeconds ?? 0)
const CINEMATIC_DURATION = AUTHORED_DURATIONS.reduce((sum, value) => sum + value, 0)
const OVERALL_DURATION = INTRO_SEQUENCE_DURATION + CINEMATIC_DURATION
const LAST_INDEX = CINEMATIC_SEGMENTS.length - 1

describe('cinematic store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    // The intro timeline is module-level state; leave the standard sequence
    // active so a Director's Cut test cannot leak into the next one.
    useCinematicStore().setIntroSequence(buildIntroVideoSequence())
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
    // Both sequences end with the same Destiny trailer; they differ in their
    // opening segment (silent title card vs. Gayane prologue) and runtime.
    expect(directorsCut[0]?.id).not.toBe(standard[0]?.id)
    expect(directorsCut[directorsCut.length - 1]?.id)
      .toBe(standard[standard.length - 1]?.id)

    const store = useCinematicStore()

    store.setIntroSequence(standard)
    store.enterIntro()
    const standardDuration = store.sequenceDuration

    store.setIntroSequence(directorsCut)
    store.enterIntro()
    const directorsCutDuration = store.sequenceDuration

    // Different lists, different runtimes — derived, never re-typed here.
    expect(directorsCutDuration).toBeGreaterThan(standardDuration)
    expect(store.overallDuration).toBeCloseTo(directorsCutDuration + CINEMATIC_DURATION)
    // The exported binding follows the active sequence for its importers.
    expect(INTRO_SEQUENCE_DURATION).toBeCloseTo(directorsCutDuration)

    // Per-segment resolution reaches indices that do not exist in the standard
    // sequence instead of being clamped into it.
    const lastIndex = directorsCut.length - 1
    store.syncIntroStatus({
      segmentIndex: lastIndex,
      segmentElapsed: 0,
      segmentDuration: 0,
      nativeTime: 0,
    })
    expect(store.segmentIndex).toBe(lastIndex)
    expect(store.segmentDuration).toBeGreaterThan(0)
    expect(store.sequenceElapsed).toBeCloseTo(directorsCutDuration - store.segmentDuration)
    expect(store.overallElapsed).toBeCloseTo(store.sequenceElapsed)

    // And switching back restores the standard sequence's math.
    store.setIntroSequence(standard)
    store.enterIntro()
    expect(store.sequenceDuration).toBeCloseTo(standardDuration)
    expect(INTRO_SEQUENCE_DURATION).toBeCloseTo(standardDuration)
    expect(store.overallDuration).toBeCloseTo(standardDuration + CINEMATIC_DURATION)
  })
})
