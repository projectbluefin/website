import { describe, expect, it } from 'vitest'
import {
  estimatePageSeconds,
  PAGE_MINIMUM_SECONDS,
  PROSE_PAGE_CHARACTERS,
} from '../components/wolves/lore/lore-pages'
import { loadAllLoreRecords } from '../data/wolves-lore-records'
import {
  allocateLoreSlots,
  estimateLoreReadDuration,
  loreRecordPages,
} from '../data/wolves-lore-timing'
import { lockedNarrativeSlots, wolvesNarrativeTimeline } from '../data/wolves-narrative-timeline'

const recordsById = new Map(loadAllLoreRecords().map(record => [record.id, record] as const))

function timingInputFor(id: string) {
  const record = recordsById.get(id)
  const kind = record?.kind === 'chatlog'
    ? 'chatlog' as const
    : record?.kind === 'quote' ? 'quote' as const : 'prose' as const
  return { id, kind, body: record?.body ?? id }
}

describe('wolves lore timing', () => {
  it('gives longer conversations more time than short quotes', () => {
    const short = estimateLoreReadDuration({ kind: 'quote', body: 'A short quote.', attribution: 'Author' })
    const long = estimateLoreReadDuration({ kind: 'chatlog', body: 'A word. '.repeat(200), attribution: 'ARCHIVE' })

    expect(short).toBeGreaterThanOrEqual(PAGE_MINIMUM_SECONDS)
    expect(long).toBeGreaterThan(short)
  })

  it('costs every kind with the one shared page model', () => {
    const page = 'Nine words of authored copy on a single page.'

    expect(estimatePageSeconds(page)).toBeGreaterThanOrEqual(PAGE_MINIMUM_SECONDS)
    expect(estimatePageSeconds('Short.')).toBe(PAGE_MINIMUM_SECONDS)
    // A quote and a bulletin of the same length cost the same to read.
    expect(estimateLoreReadDuration({ kind: 'quote', body: page }))
      .toBe(estimateLoreReadDuration({ kind: 'prose', body: page }))
    // A conversation adds only its completion hold.
    expect(estimateLoreReadDuration({ kind: 'chatlog', body: page })
      - estimateLoreReadDuration({ kind: 'prose', body: page })).toBe(5)
  })

  it('keeps prose that fits one page on one page', () => {
    const body = 'A'.repeat(PROSE_PAGE_CHARACTERS - 1)

    expect(loreRecordPages({ kind: 'quote', body })).toHaveLength(1)
  })

  it('allocates every slot enough time without moving locked anchors', () => {
    const slots = allocateLoreSlots(
      [
        { id: 'short', kind: 'quote', body: 'Short.', attribution: 'A' },
        { id: 'long', kind: 'chatlog', body: 'B word. '.repeat(80), attribution: 'B' },
      ],
      220,
      398,
      new Map([['locked', 100]]),
    )

    expect(slots[0].startTime).toBe(220)
    expect(slots.at(-1)?.endTime).toBe(398)
    for (const slot of slots) {
      expect(slot.duration).toBeGreaterThanOrEqual(slot.minimumDuration)
    }
  })

  it('gives every record one complete, fully held page before extending any other', () => {
    const slots = allocateLoreSlots(
      [
        { id: 'quote', kind: 'quote', body: 'A short quote.', attribution: 'ARCHIVE' },
        { id: 'chat', kind: 'chatlog', body: 'B word. '.repeat(80), attribution: 'ARCHIVE' },
      ],
      0,
      30,
    )

    for (const slot of slots) {
      expect(slot.duration).toBeGreaterThanOrEqual(PAGE_MINIMUM_SECONDS)
      expect(slot.duration).toBeGreaterThanOrEqual(slot.minimumDuration)
    }
  })

  it('reflows remaining chats contiguously after a record is removed', () => {
    const records = [
      { id: 'first', kind: 'chatlog' as const, body: 'A'.repeat(90) },
      { id: 'third', kind: 'chatlog' as const, body: 'B'.repeat(90) },
    ]
    const slots = allocateLoreSlots(records, 0, 40)

    expect(slots[0]?.startTime).toBe(0)
    expect(slots[1]?.startTime).toBeCloseTo(slots[0]!.endTime, 8)
    expect(slots[1]?.endTime).toBe(40)
    expect(slots.every(slot => slot.endTime > slot.startTime)).toBe(true)
  })

  it('holds one complete page for every record in the authored timeline', () => {
    for (const slot of wolvesNarrativeTimeline) {
      const pages = loreRecordPages(timingInputFor(slot.artifactId))
      const minimum = estimatePageSeconds(pages[0] ?? '')

      expect(slot.endTime - slot.startTime).toBeGreaterThanOrEqual(minimum - 0.001)
    }
  })

  it('keeps the authored timeline contiguous with its locked anchors unmoved', () => {
    expect(wolvesNarrativeTimeline[0]?.startTime).toBe(0)
    for (const [index, slot] of wolvesNarrativeTimeline.entries()) {
      if (index === 0) {
        continue
      }
      expect(slot.startTime).toBeCloseTo(wolvesNarrativeTimeline[index - 1]!.endTime, 6)
    }

    for (const anchor of lockedNarrativeSlots) {
      expect(wolvesNarrativeTimeline).toContainEqual({
        artifactId: anchor.artifactId,
        startTime: anchor.startTime,
        endTime: anchor.endTime,
      })
    }
  })
})
