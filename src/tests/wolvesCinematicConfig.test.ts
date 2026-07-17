import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_SEGMENTS,
  DEFAULT_CROSSFADE_MS,
  PRE_END_THRESHOLD_S,
  segmentCrossfadeMs,
  SPOTIFY_TRACK_LIST,
} from '@/config/wolves-cinematic'

describe('wolves cinematic config', () => {
  it('defines exactly seven segments', () => {
    expect(CINEMATIC_SEGMENTS).toHaveLength(7)
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

  it('mirrors the segment list into the Spotify track list', () => {
    expect(SPOTIFY_TRACK_LIST).toHaveLength(CINEMATIC_SEGMENTS.length)
    SPOTIFY_TRACK_LIST.forEach((track, index) => {
      expect(track.title).toBe(CINEMATIC_SEGMENTS[index].title)
      expect(track.artist).toBe(CINEMATIC_SEGMENTS[index].artist)
    })
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
