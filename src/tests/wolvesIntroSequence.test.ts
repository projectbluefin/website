import { describe, expect, it } from 'vitest'
import {
  activeOverlayCue,
  activeOverlayText,
  advanceIntroSequence,
  buildIntroVideoSequence,
  buildOverlayTextParts,
  createIntroSequenceState,
  isTextSegment,
  isTextSegmentComplete,
  isVideoCutoffReached,
  isVideoSegment,
  parseDestinyCaptionFile,
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

  it('parses the authored Destiny caption file into timed burn-in cues', () => {
    const cues = parseDestinyCaptionFile('0.00|First line\n2.50|Second line')

    expect(cues).toHaveLength(2)
    expect(cues[0]).toEqual(expect.objectContaining({ text: 'First line', start: 0, end: 2.5 }))
    expect(cues[1]).toEqual(expect.objectContaining({ text: 'Second line', start: 2.5, end: 5 }))
  })

  it('highlights a specific substring when the cue requests one', () => {
    const parts = buildOverlayTextParts('Now, what\'s left of a proud order fights for survival', 'fights')

    expect(parts).toEqual([
      { char: 'N', highlight: false },
      { char: 'o', highlight: false },
      { char: 'w', highlight: false },
      { char: ',', highlight: false },
      { char: ' ', highlight: false },
      { char: 'w', highlight: false },
      { char: 'h', highlight: false },
      { char: 'a', highlight: false },
      { char: 't', highlight: false },
      { char: '\'', highlight: false },
      { char: 's', highlight: false },
      { char: ' ', highlight: false },
      { char: 'l', highlight: false },
      { char: 'e', highlight: false },
      { char: 'f', highlight: false },
      { char: 't', highlight: false },
      { char: ' ', highlight: false },
      { char: 'o', highlight: false },
      { char: 'f', highlight: false },
      { char: ' ', highlight: false },
      { char: 'a', highlight: false },
      { char: ' ', highlight: false },
      { char: 'p', highlight: false },
      { char: 'r', highlight: false },
      { char: 'o', highlight: false },
      { char: 'u', highlight: false },
      { char: 'd', highlight: false },
      { char: ' ', highlight: false },
      { char: 'o', highlight: false },
      { char: 'r', highlight: false },
      { char: 'd', highlight: false },
      { char: 'e', highlight: false },
      { char: 'r', highlight: false },
      { char: ' ', highlight: false },
      { char: 'f', highlight: true },
      { char: 'i', highlight: true },
      { char: 'g', highlight: true },
      { char: 'h', highlight: true },
      { char: 't', highlight: true },
      { char: 's', highlight: true },
      { char: ' ', highlight: false },
      { char: 'f', highlight: false },
      { char: 'o', highlight: false },
      { char: 'r', highlight: false },
      { char: ' ', highlight: false },
      { char: 's', highlight: false },
      { char: 'u', highlight: false },
      { char: 'r', highlight: false },
      { char: 'v', highlight: false },
      { char: 'i', highlight: false },
      { char: 'v', highlight: false },
      { char: 'a', highlight: false },
      { char: 'l', highlight: false },
    ])
  })

  it('builds the intro sequence without the epilogue transition', () => {
    const sequence = buildIntroVideoSequence()
    expect(sequence).toHaveLength(2)
    expect(sequence.map(segment => segment.id)).toEqual(['wolves-prologue', 'wolves-intro'])
    expect(JSON.stringify(sequence)).not.toContain('But who will answer the call')
    expect(JSON.stringify(sequence)).not.toContain('Welcome to indie cloud native')
  })

  it('gives the revised prologue copy readable holds within its 94-second runtime', () => {
    const [prologue] = buildIntroVideoSequence()
    if (!isTextSegment(prologue)) {
      throw new Error('Expected the first intro segment to be text-only')
    }

    expect(prologue.duration).toBe(94)
    // Loudness analysis: the final swell crests at 92-94s and decays after; the
    // cutoff rides that decay with an authored audio fade.
    expect(prologue.audioFadeOutSeconds).toBe(2.5)
    expect(prologue.overlays?.map(cue => cue.text)).toEqual([
      'A Gardener and a Winnower walked among the stars.',
      `One to spread life, and one to cull the dross
to shape the Garden of Earth.`,
      'One day changed the Garden forever.',
      'New Children arose and filled the pattern.',
      'For eons, Maintainer-Guardians cultivated the Garden...',
      `Until an AI-fueled Society deemed Guardians unnecessary.
And then, a threat.`,
      'Others came to claim a bountiful and unprotected Garden.',
      `In the space of a few days,
humanity had lost its future`,
      `For the heart of any race is destroyed
And its will to survive is utterly Broken`,
      'When its children are taken from it',
      `Now, what's left of a proud order fights for survival,
surrounded by predators.`,
      'B L U E F I N — seven days to the wolves',
    ])
    expect(prologue.overlays).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'A Gardener and a Winnower walked among the stars.', start: 0, end: 5 }),
      expect.objectContaining({
        text: `One to spread life, and one to cull the dross
to shape the Garden of Earth.`,
        start: 5,
        end: 13.75,
        textPosition: 'bottom-right',
      }),
      expect.objectContaining({ text: 'One day changed the Garden forever.', start: 13.75, end: 25 }),
      expect.objectContaining({
        text: 'New Children arose and filled the pattern.',
        start: 25,
        end: 27.5,
        emphasis: 'dominant',
        textPosition: 'bottom',
        backgroundCrossfade: [{ day: 'wolves-intro/bluefin-collapse-day.webp', night: 'wolves-intro/bluefin-collapse-night.webp' }],
      }),
      expect.objectContaining({
        text: 'Until an AI-fueled Society deemed Guardians unnecessary.\nAnd then, a threat.',
        start: 36.25,
        end: 45,
      }),
      expect.objectContaining({
        text: `In the space of a few days,
humanity had lost its future`,
        start: 50,
        end: 59.375,
        textPosition: 'bottom',
      }),
      expect.objectContaining({
        text: `For the heart of any race is destroyed
And its will to survive is utterly Broken`,
        start: 59.375,
        end: 65,
        textPosition: 'bottom',
      }),
      expect.objectContaining({
        text: 'When its children are taken from it',
        start: 65,
        end: 72.5,
        textPosition: 'bottom',
      }),
      expect.objectContaining({
        text: 'Now, what\'s left of a proud order fights for survival,\nsurrounded by predators.',
        start: 72.5,
        end: 78.5,
        textPosition: 'bottom',
      }),
      expect.objectContaining({ text: 'B L U E F I N — seven days to the wolves', start: 78.5, end: 94 }),
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
        text: 'One day changed the Garden forever.',
        backgroundImage: 'wolves-intro/bluefin-collapse-night.webp',
      }),
      expect.objectContaining({
        text: 'Others came to claim a bountiful and unprotected Garden.',
        start: 45,
        end: 50,
        backgroundCrossfade: [{
          day: 'wolves-intro/bluefin-collapse-night.webp',
          night: 'wolves-intro/bluefin-collapse-day.webp',
        }],
      }),
      expect.objectContaining({
        text: `In the space of a few days,
humanity had lost its future`,
        start: 50,
        end: 59.375,
        backgroundImage: 'wolves-intro/bluefin-collapse-day.webp',
        textPosition: 'bottom',
      }),
      expect.objectContaining({
        text: `For the heart of any race is destroyed
And its will to survive is utterly Broken`,
        start: 59.375,
        end: 65,
        backgroundImage: 'wolves-intro/bluefin-collapse-day.webp',
        textPosition: 'bottom',
      }),
      expect.objectContaining({
        text: 'When its children are taken from it',
        start: 65,
        end: 72.5,
        backgroundImage: 'wolves-intro/bluefin-collapse-day.webp',
        textPosition: 'bottom',
      }),
      expect.objectContaining({
        text: 'Now, what\'s left of a proud order fights for survival,\nsurrounded by predators.',
        start: 72.5,
        end: 78.5,
        backgroundImage: 'wolves-intro/bluefin-collapse-day.webp',
        textPosition: 'bottom',
      }),
    ]))
  })
})
