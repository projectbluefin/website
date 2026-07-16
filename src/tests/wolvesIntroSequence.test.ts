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
  previousIntroSequence,
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

  it('previous moves back one segment at a time and clamps at the first', () => {
    const midSequence = advanceIntroSequence(createIntroSequenceState(), 3)
    expect(previousIntroSequence(midSequence)).toEqual({ index: 0, done: false })
    expect(previousIntroSequence(createIntroSequenceState())).toEqual({ index: 0, done: false })
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

  it('builds the intro sequence without the epilogue transition', () => {
    const sequence = buildIntroVideoSequence()
    expect(sequence).toHaveLength(2)
    expect(sequence.map(segment => segment.id)).toEqual(['wolves-prologue', 'wolves-intro'])
    expect(JSON.stringify(sequence)).not.toContain('But who will answer the call')
    expect(JSON.stringify(sequence)).not.toContain('Welcome to indie cloud native')
  })

  it('gives the revised prologue copy readable holds within its 60-second runtime', () => {
    const [prologue] = buildIntroVideoSequence()
    if (!isTextSegment(prologue)) {
      throw new Error('Expected the first intro segment to be text-only')
    }

    expect(prologue.duration).toBe(60)
    expect(prologue.overlays).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'A Gardener and Winnower walked amongst the stars', start: 0, end: 4 }),
      expect.objectContaining({
        text: `One to spread life, and one to cull the dross
to shape the Garden of Earth`,
        start: 4,
        end: 11,
        textPosition: 'bottom-right',
      }),
      expect.objectContaining({ text: 'One day changed the Garden forever', start: 11, end: 20 }),
      expect.objectContaining({
        text: 'Until the Birth of Artificial Intelligence\nSociety decided that Guardians were not only unnecessary,\n\nBut a threat.',
        start: 29,
        end: 36,
      }),
      expect.objectContaining({
        text: `In the space of a few days,
humanity had lost its future`,
        start: 40,
        end: 47.5,
        textPosition: 'bottom',
      }),
      expect.objectContaining({
        text: `For the heart of any race is destroyed

And its will to survive is utterly Broken
When its children are taken from it`,
        start: 47.5,
        end: 52,
        textPosition: 'bottom',
      }),
      expect.objectContaining({
        text: 'Now what\'s left of a proud order fights for survial, surrounded by predators',
        start: 52,
        end: 56,
        textPosition: 'bottom',
      }),
      expect.objectContaining({ text: 'B L U E F I N — seven days to the wolves', start: 56, end: 60 }),
    ]))
    expect(prologue.overlays?.every(cue => !cue.text.includes('<br>'))).toBe(true)
    expect(prologue.overlays?.every(cue => !cue.text.includes('(hold this'))).toBe(true)
    expect(prologue.overlays?.every((cue, index, cues) =>
      index === 0 ? cue.start === 0 : cue.start === cues[index - 1].end,
    )).toBe(true)
  })

  it('fades the Collapse to night with the armies line before the combined closing words', () => {
    const [prologue] = buildIntroVideoSequence()
    if (!isTextSegment(prologue)) {
      throw new Error('Expected the first intro segment to be text-only')
    }

    const serializedCues = JSON.stringify(prologue.overlays)
    expect(serializedCues).not.toContain('bluefin-12')
    expect(prologue.overlays).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: 'One day changed the Garden forever',
        backgroundImage: 'wolves-intro/bluefin-collapse-night.webp',
      }),
      expect.objectContaining({
        text: 'The armies of the galaxy came claim a bountiful, unprotected Garden',
        start: 36,
        end: 40,
        backgroundCrossfade: [{
          day: 'wolves-intro/bluefin-collapse-night.webp',
          night: 'wolves-intro/bluefin-collapse-day.webp',
        }],
      }),
      expect.objectContaining({
        text: `In the space of a few days,
humanity had lost its future`,
        start: 40,
        end: 47.5,
        backgroundImage: 'wolves-intro/bluefin-collapse-day.webp',
        textPosition: 'bottom',
      }),
      expect.objectContaining({
        text: `For the heart of any race is destroyed

And its will to survive is utterly Broken
When its children are taken from it`,
        start: 47.5,
        end: 52,
        backgroundImage: 'wolves-intro/bluefin-collapse-day.webp',
        textPosition: 'bottom',
      }),
      expect.objectContaining({
        text: 'Now what\'s left of a proud order fights for survial, surrounded by predators',
        start: 52,
        end: 56,
        backgroundImage: 'wolves-intro/bluefin-collapse-day.webp',
        textPosition: 'bottom',
      }),
    ]))
  })
})
