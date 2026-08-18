import { describe, expect, it } from 'vitest'
import {
  activeTrailerPlates,
  TRAILER_CREDIT_JOIN_SECONDS,
  TRAILER_DURATION_SECONDS,
  TRAILER_PLATES,
  TRAILER_VIDEO_ID,
} from '@/data/wolves-trailer-plates'

// These windows are the owner's cut (destiny-vids stories/trailer-1-plates.json,
// "Trailer 1.0", 2026-08-17). If the cut is recut, re-port the manifest — do
// not nudge these numbers to make the test pass.
describe('wolves trailer plates', () => {
  it('plays the Perfume Of The Timeless source for exactly 1:50', () => {
    expect(TRAILER_VIDEO_ID).toBe('O0lyFqLr3Cc')
    expect(TRAILER_DURATION_SECONDS).toBe(110)
  })

  it('shows nothing before the main title and after the cut ends', () => {
    expect(activeTrailerPlates(0)).toEqual([])
    expect(activeTrailerPlates(10.9)).toEqual([])
    expect(activeTrailerPlates(TRAILER_DURATION_SECONDS)).toEqual([])
    expect(activeTrailerPlates(Number.NaN)).toEqual([])
  })

  it('holds the main title across both authored beats', () => {
    expect(activeTrailerPlates(11).map(p => p.id)).toEqual(['maintitle'])
    expect(activeTrailerPlates(TRAILER_CREDIT_JOIN_SECONDS).map(p => p.id)).toEqual(['maintitle'])
    expect(activeTrailerPlates(22.6).map(p => p.id)).toEqual([])
  })

  it('shows the four-line book box over the book shot', () => {
    const [book] = activeTrailerPlates(27)
    expect(book?.id).toBe('book-a')
    expect(book?.lines).toEqual([
      'Two Generations of Contributors',
      'One at their beginning',
      'One at their end',
      'These are their Real Stories',
    ])
    expect(activeTrailerPlates(33.64).map(p => p.id)).toEqual([])
  })

  it('runs the marquee messages in the wolves fade', () => {
    expect(activeTrailerPlates(89).map(p => p.id)).toEqual(['daycard-extinction'])
    expect(activeTrailerPlates(95).map(p => p.id)).toEqual(['daycard-survival'])
  })

  it('lands on the KubeCon end card and holds it to the end', () => {
    expect(activeTrailerPlates(102.2).map(p => p.id)).toEqual(['endcard-event'])
    expect(activeTrailerPlates(109.9).map(p => p.id)).toEqual(['endcard-event'])
  })

  it('never overlaps plates', () => {
    const windows = [...TRAILER_PLATES].sort((a, b) => a.start - b.start)
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].start, `${windows[i - 1].id} -> ${windows[i].id}`).toBeGreaterThanOrEqual(windows[i - 1].end)
    }
    for (let t = 0; t < TRAILER_DURATION_SECONDS; t += 0.5) {
      expect(activeTrailerPlates(t).length, `t=${t}`).toBeLessThanOrEqual(1)
    }
  })
})
