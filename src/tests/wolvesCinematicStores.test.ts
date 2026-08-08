import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'
import { resolveOverallRatioTarget, useCinematicStore } from '@/stores/cinematic'

describe('cinematic store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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
    expect(store.completedElapsed).toBe(300)

    store.updateTime(10, 200)
    expect(store.totalElapsed).toBe(310)
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
    expect(store.segmentDuration).toBe(193)

    store.jumpToSegment(-5)
    expect(store.segmentIndex).toBe(0)
    expect(store.segmentDuration).toBe(424)
    store.jumpToSegment(999)
    expect(store.segmentIndex).toBe(CINEMATIC_SEGMENTS.length - 1)
    expect(store.segmentDuration).toBe(234)
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
    store.enterIntro()
    store.syncIntroStatus({
      segmentIndex: 0,
      segmentElapsed: 60,
      segmentDuration: 119.5,
      nativeTime: 62,
    })

    expect(store.sequenceElapsed).toBeCloseTo(60)
    expect(store.sequenceDuration).toBeCloseTo(119.5)
    expect(store.overallElapsed).toBeCloseTo(60)
    expect(store.overallDuration).toBeCloseTo(1952.5)
    expect(store.overallProgress).toBeCloseTo(60 / 1952.5)

    store.enterCinematic()
    store.updateTime(0, 424, 0)

    expect(store.sequenceElapsed).toBe(0)
    expect(store.sequenceDuration).toBe(1833)
    expect(store.overallElapsed).toBeCloseTo(119.5)
    expect(store.overallProgress).toBeCloseTo(119.5 / 1952.5)
  })

  it('maps an overall ratio to the correct intro or cinematic segment and native time', () => {
    expect(resolveOverallRatioTarget(0)).toEqual(expect.objectContaining({
      phase: 'intro',
      segmentIndex: 0,
      segmentElapsed: 0,
      nativeTime: 2,
    }))

    const startOfCinematic = resolveOverallRatioTarget(119.5 / 1952.5)
    expect(startOfCinematic.phase).toBe('cinematic')
    expect(startOfCinematic.segmentIndex).toBe(0)
    expect(startOfCinematic.segmentElapsed).toBeCloseTo(0)
    expect(startOfCinematic.nativeTime).toBeCloseTo(0)

    const fiveSecondsIntoCinematic = resolveOverallRatioTarget((119.5 + 5) / 1952.5)
    expect(fiveSecondsIntoCinematic).toEqual(expect.objectContaining({
      phase: 'cinematic',
      segmentIndex: 0,
    }))
    expect(fiveSecondsIntoCinematic.segmentElapsed).toBeCloseTo(5)
    expect(fiveSecondsIntoCinematic.nativeTime).toBeCloseTo(5)

    expect(resolveOverallRatioTarget(1)).toEqual(expect.objectContaining({
      phase: 'cinematic',
      segmentIndex: 5,
      segmentElapsed: 234,
      nativeTime: 234,
    }))
  })
})
