import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_SEGMENTS,
  DEFAULT_CROSSFADE_MS,
  PRE_END_THRESHOLD_S,
  segmentCrossfadeMs,
  SPOTIFY_TRACK_LIST,
} from '@/config/wolves-cinematic'

describe('wolves cinematic config', () => {
  it('defines the prologue, intro, and seven musical parts in order', () => {
    expect(CINEMATIC_SEGMENTS).toHaveLength(9)
    expect(CINEMATIC_SEGMENTS[0].chapter).toBe('PROLOGUE')
    expect(CINEMATIC_SEGMENTS[1].chapter).toBe('INTRO')
    expect(CINEMATIC_SEGMENTS[2].title).toBe('7 Days to the Wolves')
    expect(CINEMATIC_SEGMENTS.filter(segment => !segment.excludeFromSoundtrack)).toHaveLength(7)
  })

  it('preserves the authored trims and captions on the intro segment', () => {
    const intro = CINEMATIC_SEGMENTS[1]
    expect(intro.youtubeId).toBe('BKm0TPqeOjY')
    expect(intro.startSeconds).toBe(2)
    expect(intro.endSeconds).toBe(114)
    expect(intro.captionsText).toContain('What is a guardian?')
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

  it('mirrors only the musical segments into the Spotify track list', () => {
    const musical = CINEMATIC_SEGMENTS.filter(segment => !segment.excludeFromSoundtrack)
    expect(SPOTIFY_TRACK_LIST).toHaveLength(musical.length)
    SPOTIFY_TRACK_LIST.forEach((track, index) => {
      expect(track.title).toBe(musical[index].title)
      expect(track.artist).toBe(musical[index].artist)
    })
    expect(SPOTIFY_TRACK_LIST[0].title).toBe('7 Days to the Wolves')
  })

  it('resolves per-segment crossfades with a default fallback', () => {
    expect(segmentCrossfadeMs(0)).toBe(DEFAULT_CROSSFADE_MS)
    expect(segmentCrossfadeMs(3)).toBe(1500)
    expect(segmentCrossfadeMs(999)).toBe(DEFAULT_CROSSFADE_MS)
  })

  it('keeps the pre-end threshold small enough to not cut content', () => {
    expect(PRE_END_THRESHOLD_S).toBeGreaterThan(0)
    expect(PRE_END_THRESHOLD_S).toBeLessThan(1)
  })
})
