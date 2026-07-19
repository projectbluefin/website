import { describe, expect, it } from 'vitest'
import {
  activeOverlayCue,
  activeOverlayText,
  advanceIntroSequence,
  buildDestinyCaptionCues,
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

  it('supports explicit cue end times so the outro can pause before the black-frame line', () => {
    const cues = parseDestinyCaptionFile('0.00|First line|1.25\n2.50|Second line')

    expect(cues).toHaveLength(2)
    expect(cues[0]).toEqual(expect.objectContaining({ text: 'First line', start: 0, end: 1.25 }))
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

  it('starts directly with the Destiny trailer', () => {
    const sequence = buildIntroVideoSequence()
    expect(sequence).toHaveLength(1)
    expect(sequence.map(segment => segment.id)).toEqual(['wolves-intro'])
    expect(JSON.stringify(sequence)).not.toContain('But who will answer the call')
    expect(JSON.stringify(sequence)).not.toContain('Bluefin Cinematic Universe')
  })

  it('defaults the Destiny segment to the unvoiced source and keeps the Ikora track optional', () => {
    const destiny = buildIntroVideoSequence().find(segment => segment.id === 'wolves-intro')

    expect(destiny).toEqual(expect.objectContaining({
      kind: 'video',
      youtubeVideoId: 'BV3BZKbpBns',
      alternateYoutubeVideoId: 'BKm0TPqeOjY',
      alternateYoutubeVideoLabel: 'Ikora voice over',
    }))
  })

  it('renames Robert Killen to Bob Killen without moving the authored guardian windows', () => {
    const destiny = buildIntroVideoSequence().find(segment => segment.id === 'wolves-intro')
    if (!destiny || !isVideoSegment(destiny)) {
      throw new Error('Expected the Destiny segment to exist')
    }

    expect(destiny.overlays).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Voidwalker Warlock — Bob Killen — Reconciler of the Plane', start: 5, end: 14.5 }),
      expect.objectContaining({ text: 'Stormcaller Warlock — Kaslin Fields — Rage of the Paradox', start: 38, end: 48 }),
    ]))
    expect(JSON.stringify(destiny.overlays)).not.toContain('Robert Killen')
  })

  it('keeps the Destiny guardian wide plates authored with their wide-plate positioning flags', () => {
    const destiny = buildIntroVideoSequence().find(segment => segment.id === 'wolves-intro')
    if (!destiny || !isVideoSegment(destiny)) {
      throw new Error('Expected the Destiny segment to exist')
    }

    expect(destiny.overlays).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Sentinel Titan — Kat Cosgrove — Defender Queen of the Lost', start: 14.5, end: 24.5 }),
      expect.objectContaining({ text: 'Gunslinger Hunter — Laura Santamaria — The Order of Seven', start: 70.5, end: 77 }),
      expect.objectContaining({ text: 'Broodweaver Warlock — Christoph Blecker — First Among Equals — The North Star', start: 83, end: 96, position: 'left', trustee: true, leader: true, goldName: true }),
      expect.objectContaining({ text: 'Behemoth Titan — Natali Vlatko — Shipwright of Kubernetes', start: 87.5, end: 96, position: 'right' }),
    ]))
    expect(destiny.overlays?.find(cue => cue.text.includes('Christoph Blecker'))).toHaveProperty('leader', true)
  })

  it('keeps the Nova easter egg as split-second glitch bursts outside the caption paths', () => {
    const destiny = buildIntroVideoSequence().find(segment => segment.id === 'wolves-intro')
    if (!destiny || !isVideoSegment(destiny)) {
      throw new Error('Expected the Destiny segment to exist')
    }

    // No held #nova4ever status: outside a burst the default title stands.
    expect(activeOverlayCue(destiny.overlays, 48)).toBeUndefined()

    const bursts = destiny.overlays?.filter(cue => cue.nameplateTitle === '#nova4ever') ?? []
    expect(bursts.length).toBeGreaterThanOrEqual(2)
    for (const burst of bursts) {
      expect(burst.statusOnly).toBe(true)
      expect(burst.glitch).toBe(true)
      // Split-second only, inside the 48-70.5 montage.
      expect(burst.end - burst.start).toBeLessThan(1)
      expect(burst.start).toBeGreaterThanOrEqual(48)
      expect(burst.end).toBeLessThanOrEqual(70.5)
      expect(activeOverlayCue(destiny.overlays, burst.start)).toBe(burst)
    }

    const cues = buildDestinyCaptionCues().filter(cue => !cue.comicHeroTitleCard)

    expect(cues).toEqual([])
  })

  it('reserves the final fifteen Destiny seconds for the Legends Sought top status', () => {
    const destiny = buildIntroVideoSequence().find(segment => segment.id === 'wolves-intro')
    if (!destiny || !isVideoSegment(destiny)) {
      throw new Error('Expected the Destiny segment to exist')
    }

    expect(activeOverlayCue(destiny.overlays, 106.5)).toEqual(expect.objectContaining({
      start: 106.5,
      end: 121.5,
      nameplateDetail: 'Legends Sought',
      nameplateTitle: 'Follow the path, we\'ve got your back',
      statusOnly: true,
    }))
  })

  it('does not surface any legacy Destiny caption lines', () => {
    const cues = buildDestinyCaptionCues().filter(cue => !cue.comicHeroTitleCard)
    const texts = cues.map(cue => cue.text)

    expect(texts).not.toContain('Does that make us soldiers?')
    expect(texts).not.toContain('We built the city none of us dared to dream of, with allies from unlikely places.')
    expect(texts).not.toContain('We\'ve never had more to lose.')
    expect(texts).not.toContain('I turn the question to you, on the eve of our darkest hour.')
    expect(texts).not.toContain('Define us in this moment for all time.')
  })

  it('wires the Comic Hero card and status-only Nova cue into the Destiny segment', () => {
    const destiny = buildIntroVideoSequence().find(segment => segment.id === 'wolves-intro')
    if (!destiny || !isVideoSegment(destiny)) {
      throw new Error('Expected the Destiny segment to exist')
    }

    expect(destiny.burnedInCaptions).toEqual([
      { text: 'COMIC HERO SHOTS OF OPEN SOURCE MAINTAINERS SHREDDING A BUNCH OF CLANKERS', start: 24, end: 38, comicHeroTitleCard: true },
    ])
  })
})
