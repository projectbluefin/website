import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { CINEMATIC_SEGMENTS } from '@/config/wolves-cinematic'
import { useCinematicStore } from '@/stores/cinematic'

describe('cinematic store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts in the lobby on segment zero', () => {
    const store = useCinematicStore()
    expect(store.phase).toBe('lobby')
    expect(store.segmentIndex).toBe(0)
    expect(store.segment).toBe(CINEMATIC_SEGMENTS[0])
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

    store.jumpToSegment(-5)
    expect(store.segmentIndex).toBe(0)
    store.jumpToSegment(999)
    expect(store.segmentIndex).toBe(CINEMATIC_SEGMENTS.length - 1)
  })

  it('clears crossfade and playing on finish', () => {
    const store = useCinematicStore()
    store.setPlaying(true)
    store.beginCrossfade()
    store.finish()
    expect(store.phase).toBe('finished')
    expect(store.playing).toBe(false)
    expect(store.crossfading).toBe(false)
  })

  it('enters Creator Shorts once when Part I advances to Part II', () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.updateTime(425, 425)

    expect(store.creatorShortsDueFor(1)).toBe(true)

    store.enterCreatorShorts()

    expect(store.phase).toBe('creator-shorts')
    expect(store.segmentIndex).toBe(1)
    expect(store.shortsConsumed).toBe(true)
    expect(store.completedElapsed).toBe(425)
    expect(store.playing).toBe(false)
  })

  it('resumes Part II without reopening Creator Shorts', () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.updateTime(425, 425)
    store.enterCreatorShorts()
    store.completeCreatorShorts()

    expect(store.phase).toBe('cinematic')
    expect(store.segmentIndex).toBe(1)
    expect(store.creatorShortsDueFor(1)).toBe(false)

    store.jumpToSegment(0)
    expect(store.creatorShortsDueFor(1)).toBe(false)
  })
})
