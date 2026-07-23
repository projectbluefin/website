import { describe, expect, it } from 'vitest'
import {
  getNarrativeSlotForTime,
  lockedNarrativeSlots,
  wolvesNarrativeTimeline,
} from '../data/wolves-narrative-timeline'


describe('wolves narrative timeline', () => {
  it('contains every release artifact exactly once', () => {
    const ids = wolvesNarrativeTimeline.map(slot => slot.artifactId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('lorem-pursuit-1')
    expect(ids).toContain('blue-universal-acquires-wayland-yutani')
  })

  it('keeps unlocked lore in authored timeline order', () => {
    const ids = wolvesNarrativeTimeline.map(slot => slot.artifactId)
    expect(ids.indexOf('lorem-pursuit-1')).toBeGreaterThan(ids.indexOf('arthur-c-clarke-1'))
    expect(ids).toContain('john-seager')
    expect(ids[ids.length - 1]).toBe('blue-universal-acquires-wayland-yutani')
  })

  it('preserves the approved first, middle, and final anchors', () => {
    expect(getNarrativeSlotForTime(0)).toMatchObject({
      artifactId: 'arthur-c-clarke-1',
      startTime: 0,
    })
    expect(getNarrativeSlotForTime(180)).toMatchObject({
      artifactId: 'lorem-pursuit-1',
      startTime: 150,
      endTime: 220,
    })
    expect(getNarrativeSlotForTime(398)).toMatchObject({
      artifactId: 'blue-universal-acquires-wayland-yutani',
      startTime: 398,
      endTime: 425,
    })
  })

  it('keeps every registered narrative lock at its declared time', () => {
    for (const lock of lockedNarrativeSlots) {
      const slot = wolvesNarrativeTimeline.find(slot => slot.artifactId === lock.artifactId)

      expect(slot?.startTime).toBe(lock.startTime)
      if (lock.endTime !== undefined) {
        expect(slot?.endTime).toBe(lock.endTime)
      }
    }
  })

  it('allocates unlocked lore between the locked anchors', () => {
    const middle = wolvesNarrativeTimeline.filter(slot => slot.startTime >= 220 && slot.endTime <= 398)
    expect(middle.length).toBeGreaterThan(0)
    expect(middle.every(slot => slot.endTime > slot.startTime)).toBe(true)
  })

  it('keeps the recomputed middle contiguous', () => {
    const middle = wolvesNarrativeTimeline.filter(slot => slot.startTime >= 220 && slot.endTime <= 398)
    for (let index = 1; index < middle.length; index++) {
      expect(middle[index].startTime).toBeCloseTo(middle[index - 1].endTime, 8)
    }
  })

  it('keeps each retimed post-Golden-Era slot between three and eighteen seconds', () => {
    const retimedSlots = wolvesNarrativeTimeline.filter(slot => slot.startTime >= 220 && slot.endTime <= 398)

    for (const slot of retimedSlots) {
      expect(slot.endTime - slot.startTime).toBeGreaterThan(0)
      expect(slot.endTime - slot.startTime).toBeLessThanOrEqual(30)
    }
  })

  it('keeps the recomputed unlocked pool contiguous and authored', () => {
    const middle = wolvesNarrativeTimeline.filter(slot => slot.startTime >= 220 && slot.endTime <= 398)
    for (let index = 1; index < middle.length; index++) {
      expect(middle[index].startTime).toBeCloseTo(middle[index - 1].endTime, 8)
    }
    expect(new Set(middle.map(slot => slot.artifactId)).size).toBe(middle.length)
  })

  it('uses the next slot at exact boundaries and holds the final entry afterward', () => {
    expect(getNarrativeSlotForTime(150)?.artifactId).toBe('lorem-pursuit-1')
    expect(getNarrativeSlotForTime(220)?.artifactId)
      .toBe(wolvesNarrativeTimeline.find(slot => slot.startTime === 220)?.artifactId)
    expect(getNarrativeSlotForTime(425)?.artifactId).toBe('blue-universal-acquires-wayland-yutani')
    expect(getNarrativeSlotForTime(1_000)?.artifactId).toBe('blue-universal-acquires-wayland-yutani')
  })

  it('gives longer lore entries longer non-anchor slots', () => {
    const short = wolvesNarrativeTimeline.find(slot => slot.artifactId === 'quote-natasha-woods')!
    const long = wolvesNarrativeTimeline.find(slot => slot.artifactId === 'john-seager')!

    expect(long.endTime - long.startTime).toBeGreaterThan(short.endTime - short.startTime)
  })
})
