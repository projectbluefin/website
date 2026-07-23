import { describe, expect, it } from 'vitest'
import { allocateLoreSlots, estimateLoreReadDuration } from '../data/wolves-lore-timing'

describe('wolves lore timing', () => {
  it('gives longer conversations more time than short quotes', () => {
    const short = estimateLoreReadDuration({ kind: 'quote', body: 'A short quote.', attribution: 'Author' })
    const long = estimateLoreReadDuration({ kind: 'chatlog', body: 'A'.repeat(500), attribution: 'ARCHIVE' })

    expect(short).toBeGreaterThanOrEqual(3)
    expect(long).toBeGreaterThan(short)
  })

  it('allocates every slot enough time without moving locked anchors', () => {
    const slots = allocateLoreSlots(
      [
        { id: 'short', kind: 'quote', body: 'Short.', attribution: 'A' },
        { id: 'long', kind: 'chatlog', body: 'B'.repeat(600), attribution: 'B' },
      ],
      220,
      398,
      new Map([['locked', 100]]),
    )

    expect(slots[0].startTime).toBe(220)
    expect(slots[slots.length - 1]?.endTime).toBe(398)
    for (const slot of slots) {
      expect(slot.duration).toBeGreaterThanOrEqual(slot.minimumDuration)
    }
  })
})
