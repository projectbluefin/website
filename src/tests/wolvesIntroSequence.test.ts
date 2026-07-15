import { describe, expect, it } from 'vitest'
import {
  activeOverlayCue,
  activeOverlayText,
  advanceIntroSequence,
  buildIntroVideoSequence,
  createIntroSequenceState,
  isTextSegment,
  isTextSegmentComplete,
  isVideoCutoffReached,
  isVideoSegment,
  skipIntroSequence,
} from '../data/wolves-intro-sequence'

describe('wolves intro overlay sequence', () => {
  it('starts at the first segment, not done', () => {
    const state = createIntroSequenceState()
    expect(state).toEqual({ index: 0, done: false })
  })

  it('advances to the next segment on ended/error/duration-elapsed', () => {
    const state = advanceIntroSequence(createIntroSequenceState(), 2)
    expect(state).toEqual({ index: 1, done: false })
  })

  it('marks the sequence done once the last segment advances', () => {
    const afterFirst = advanceIntroSequence(createIntroSequenceState(), 2)
    const afterSecond = advanceIntroSequence(afterFirst, 2)
    expect(afterSecond).toEqual({ index: 1, done: true })
  })

  it('is a no-op once already done', () => {
    const done = { index: 1, done: true }
    expect(advanceIntroSequence(done, 2)).toBe(done)
  })

  it('never blocks on a single-segment sequence', () => {
    const state = advanceIntroSequence(createIntroSequenceState(), 1)
    expect(state).toEqual({ index: 0, done: true })
  })

  it('skip jumps straight to done regardless of current index', () => {
    const midSequence = advanceIntroSequence(createIntroSequenceState(), 3)
    expect(skipIntroSequence(midSequence)).toEqual({ index: 1, done: true })
    expect(skipIntroSequence(createIntroSequenceState())).toEqual({ index: 0, done: true })
  })

  it('returns the overlay cue active at the given timestamp', () => {
    const overlays = [
      { text: 'first', start: 0, end: 5 },
      { text: 'second', start: 5, end: 10 },
    ]
    expect(activeOverlayText(overlays, 2)).toBe('first')
    expect(activeOverlayText(overlays, 5)).toBe('second')
    expect(activeOverlayText(overlays, 10)).toBeUndefined()
    expect(activeOverlayText(undefined, 2)).toBeUndefined()
    expect(activeOverlayCue(overlays, 2)).toEqual({ text: 'first', start: 0, end: 5 })
  })

  it('identifies video vs text segments', () => {
    const video = { id: 'v', kind: 'video' as const, youtubeVideoId: 'abc' }
    const text = { id: 't', kind: 'text' as const, duration: 10 }
    expect(isVideoSegment(video)).toBe(true)
    expect(isTextSegment(video)).toBe(false)
    expect(isVideoSegment(text)).toBe(false)
    expect(isTextSegment(text)).toBe(true)
  })

  it('reaches a video cutoff only once maxDuration elapses', () => {
    const withCutoff = { id: 'v', kind: 'video' as const, youtubeVideoId: 'abc', maxDuration: 10 }
    const withoutCutoff = { id: 'v2', kind: 'video' as const, youtubeVideoId: 'def' }
    expect(isVideoCutoffReached(withCutoff, 9.9)).toBe(false)
    expect(isVideoCutoffReached(withCutoff, 10)).toBe(true)
    expect(isVideoCutoffReached(withoutCutoff, 999)).toBe(false)
  })

  it('completes a text segment only once its authored duration elapses', () => {
    const segment = { id: 't', kind: 'text' as const, duration: 45 }
    expect(isTextSegmentComplete(segment, 44.9)).toBe(false)
    expect(isTextSegmentComplete(segment, 45)).toBe(true)
  })

  it('builds the intro sequence with the prologue, trailer, and epilogue in order', () => {
    const sequence = buildIntroVideoSequence()
    expect(sequence).toHaveLength(3)
    expect(sequence.map(segment => segment.id)).toEqual(['wolves-prologue', 'wolves-intro', 'wolves-epilogue'])

    const [prologue, trailer, epilogue] = sequence
    expect(prologue.kind).toBe('text')
    expect(trailer.kind).toBe('video')
    expect(isVideoSegment(trailer) && trailer.youtubeVideoId).toBe('BKm0TPqeOjY')
    expect(epilogue.kind).toBe('text')
    expect(sequence.every(segment => segment.overlays?.length)).toBe(true)
  })
})
