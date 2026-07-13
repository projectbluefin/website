import { describe, expect, it } from 'vitest'
import {
  getNarrativeSlotForTime,
  lockedNarrativeSlots,
  wolvesNarrativeTimeline,
} from '../data/wolves-narrative-timeline'

describe('wolves narrative timeline', () => {
  it('contains every release artifact exactly once in release order', () => {
    expect(wolvesNarrativeTimeline).toHaveLength(31)
    expect(new Set(wolvesNarrativeTimeline.map(slot => slot.artifactId))).toHaveLength(wolvesNarrativeTimeline.length)
    expect(wolvesNarrativeTimeline.map(slot => slot.artifactId)).toEqual([
      'arthur-c-clarke-4',
      'lorem-prologue-1',
      'arthur-c-clarke-1',
      'lorem-prologue-2',
      'arthur-c-clarke-2',
      'forbidden-factory',
      'arthur-c-clarke-3',
      'maintenance-window',
      'quote-childhoods-end-future',
      'lorem-pursuit-1',
      'quote-natasha-woods',
      'do-not-reply',
      'quote-berkus',
      'childhoods-end-wager',
      'quote-unmarked-grave',
      'quote-third-disciple',
      'lorem-awakening-1',
      'ishtar-gardener-and-winnower',
      'glorious-eggroll',
      'ishtar-flower-game',
      'project-neptune',
      'ishtar-first-knife',
      'john-seager',
      'ishtar-the-wager',
      'reckoning-of-the-three',
      'ishtar-patternfall',
      'committee-report-personal-transmission',
      'ishtar-cambrian-explosion',
      'john-bazzite-interview',
      'ishtar-final-shape',
      'blue-universal-acquires-wayland-yutani',
    ])
  })

  it('preserves the approved first, middle, and final anchors', () => {
    expect(getNarrativeSlotForTime(0)).toMatchObject({
      artifactId: 'arthur-c-clarke-4',
      startTime: 0,
    })
    expect(getNarrativeSlotForTime(180)).toMatchObject({
      artifactId: 'lorem-pursuit-1',
      startTime: 180,
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

  it('uses the next slot at exact boundaries and holds the final entry afterward', () => {
    expect(getNarrativeSlotForTime(20)?.artifactId).toBe('lorem-prologue-1')
    expect(getNarrativeSlotForTime(220)?.artifactId).toBe('quote-natasha-woods')
    expect(getNarrativeSlotForTime(425)?.artifactId).toBe('blue-universal-acquires-wayland-yutani')
    expect(getNarrativeSlotForTime(1_000)?.artifactId).toBe('blue-universal-acquires-wayland-yutani')
  })

  it('gives longer lore entries longer non-anchor slots', () => {
    const short = wolvesNarrativeTimeline.find(slot => slot.artifactId === 'quote-natasha-woods')!
    const long = wolvesNarrativeTimeline.find(slot => slot.artifactId === 'john-seager')!

    expect(long.endTime - long.startTime).toBeGreaterThan(short.endTime - short.startTime)
  })
})
