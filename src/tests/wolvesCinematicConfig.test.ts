import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_SEGMENTS,
  DEFAULT_CROSSFADE_MS,
  PRE_END_THRESHOLD_S,
  segmentCrossfadeMs,
} from '@/config/wolves-cinematic'

describe('wolves cinematic config', () => {
  it('defines the seven musical parts with 7 Days first', () => {
    expect(CINEMATIC_SEGMENTS).toHaveLength(7)
    expect(CINEMATIC_SEGMENTS[0].title).toBe('7 Days to the Wolves')
    expect(CINEMATIC_SEGMENTS[0].chapter).toBe('PART I')
  })

  it('mounts the seven-days immersive experience only on the 7 Days segment', () => {
    const flagged = CINEMATIC_SEGMENTS.filter(segment => segment.trackZeroExperience)
    expect(flagged).toHaveLength(1)
    expect(flagged[0].youtubeId).toBe('LASru9j0oIc')
  })

  it('has unique, well-formed YouTube ids and complete metadata', () => {
    const ids = new Set<string>()
    for (const segment of CINEMATIC_SEGMENTS) {
      expect(segment.youtubeId).toMatch(/^[\w-]{11}$/)
      expect(segment.chapter.length).toBeGreaterThan(0)
      expect(segment.title.length).toBeGreaterThan(0)
      expect(segment.artist.length).toBeGreaterThan(0)
      expect(segment.artwork.length).toBeGreaterThan(0)
      ids.add(segment.youtubeId)
    }
    expect(ids.size).toBe(CINEMATIC_SEGMENTS.length)
  })

  it('has a unique stable id for every segment', () => {
    expect(new Set(CINEMATIC_SEGMENTS.map(segment => segment.id)).size)
      .toBe(CINEMATIC_SEGMENTS.length)
  })

  it('resolves per-segment crossfades with a default fallback', () => {
    expect(segmentCrossfadeMs(0)).toBe(DEFAULT_CROSSFADE_MS)
    expect(segmentCrossfadeMs(1)).toBe(1500)
    expect(segmentCrossfadeMs(999)).toBe(DEFAULT_CROSSFADE_MS)
  })

  it('keeps the pre-end threshold small enough to not cut content', () => {
    expect(PRE_END_THRESHOLD_S).toBeGreaterThan(0)
    expect(PRE_END_THRESHOLD_S).toBeLessThan(1)
  })
})
