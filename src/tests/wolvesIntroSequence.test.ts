import { describe, expect, it } from 'vitest'
import {
  activeOverlayText,
  advanceIntroSequence,
  buildIntroVideoSequence,
  createIntroSequenceState,
  skipIntroSequence,
} from '../data/wolves-intro-sequence'

describe('wolves intro overlay sequence', () => {
  it('starts at the first video, not done', () => {
    const state = createIntroSequenceState()
    expect(state).toEqual({ index: 0, done: false })
  })

  it('advances to the next video on ended/error', () => {
    const state = advanceIntroSequence(createIntroSequenceState(), 2)
    expect(state).toEqual({ index: 1, done: false })
  })

  it('marks the sequence done once the last video advances', () => {
    const afterFirst = advanceIntroSequence(createIntroSequenceState(), 2)
    const afterSecond = advanceIntroSequence(afterFirst, 2)
    expect(afterSecond).toEqual({ index: 1, done: true })
  })

  it('is a no-op once already done', () => {
    const done = { index: 1, done: true }
    expect(advanceIntroSequence(done, 2)).toBe(done)
  })

  it('never blocks on a single-video sequence', () => {
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
  })

  it('builds the intro sequence referencing a real YouTube video id', () => {
    const sequence = buildIntroVideoSequence()
    expect(sequence).toHaveLength(1)
    expect(sequence[0].youtubeVideoId).toBe('BKm0TPqeOjY')
    expect(sequence.every(video => video.overlays?.length)).toBe(true)
  })
})
