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

  it('builds the intro sequence without the epilogue transition', () => {
    const sequence = buildIntroVideoSequence()
    expect(sequence).toHaveLength(3)
    expect(sequence.map(segment => segment.id)).toEqual([
      'wolves-prologue',
      'bluefin-cinematic-universe',
      'wolves-intro',
    ])
    expect(JSON.stringify(sequence)).not.toContain('But who will answer the call')
    expect(JSON.stringify(sequence)).not.toContain('Welcome to indie cloud native')
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
      expect.objectContaining({ text: 'Void Warlock — Bob Killen — Reconciler of the Plane', start: 5, end: 16.5 }),
      expect.objectContaining({ text: 'Arc Warlock — Kaslin Fields — Rage of the Paradox', start: 38, end: 48 }),
    ]))
    expect(JSON.stringify(destiny.overlays)).not.toContain('Robert Killen')
  })

  it('carries all 22 dialogue cues retimed to the voiced BKm0TPqeOjY transcript', () => {
    const cues = buildDestinyCaptionCues().filter(cue => !cue.comicHeroTitleCard)

    expect(cues.map(cue => ({ start: cue.start, text: cue.text }))).toEqual([
      { start: 4.36, text: 'What is a guardian?' },
      { start: 7.35, text: 'Are we gods?' },
      { start: 9.40, text: 'We are connected to the weft and weave of the universe.' },
      { start: 13.68, text: 'No one knows how long we live.' },
      { start: 17.04, text: 'We stand alongside those without our gifts.' },
      { start: 20.72, text: 'We know, intimately, their life spans, their mortality, despite their resilience.' },
      { start: 29.48, text: 'Mortals live more intensely than any guardian I\'ve known. Love harder, perhaps.' },
      { start: 35.88, text: 'They know tomorrow is never guaranteed. That everything they could become dies with them.' },
      { start: 43.40, text: 'So, are we protectors?' },
      { start: 46.96, text: 'Our gifts were meant to defend against impossible threats.' },
      { start: 51.60, text: 'Those who need us have never needed us more.' },
      { start: 55.24, text: 'But we could do nothing, and they would still die.' },
      { start: 59.84, text: 'What is a guardian in that moment?' },
      { start: 66.24, text: 'Now, across Last City territory, the forces of the Witness search.' },
      { start: 72.68, text: 'Our borders are under siege.' },
      { start: 75.52, text: 'Does that make us soldiers?' },
      { start: 79.76, text: 'Pushing back buys us only time, but the alternative is unthinkable.' },
      { start: 86.88, text: 'We built the city none of us dared to dream of, with allies from unlikely places.' },
      { start: 93.52, text: 'We\'ve never had more to lose.' },
      { start: 96.88, text: 'I turn the question to you, on the eve of our darkest hour.' },
      { start: 103.56, text: 'What is a guardian?' },
      { start: 107.40, text: 'Define us in this moment for all time.' },
    ])
  })

  it('restores the missing "soldiers" question and the full closing dialogue after the drifted tail', () => {
    const cues = buildDestinyCaptionCues().filter(cue => !cue.comicHeroTitleCard)
    const texts = cues.map(cue => cue.text)
    const soldiers = cues.find(cue => cue.text === 'Does that make us soldiers?')
    const dreamOf = cues.find(cue => cue.text === 'We built the city none of us dared to dream of, with allies from unlikely places.')
    const neverHadMore = cues.find(cue => cue.text === 'We\'ve never had more to lose.')
    const eveOfDarkestHour = cues.find(cue => cue.text === 'I turn the question to you, on the eve of our darkest hour.')
    const finalLine = cues.find(cue => cue.text === 'Define us in this moment for all time.')

    expect(soldiers?.start).toBe(75.52)
    expect(dreamOf?.start).toBe(86.88)
    expect(neverHadMore?.start).toBe(93.52)
    expect(eveOfDarkestHour?.start).toBe(96.88)
    expect(finalLine).toBeDefined()
    expect(finalLine?.start).toBe(107.40)
    expect(finalLine?.end).toBe(112.60)

    // The fabricated black-frame line and its truncated/drifted 119.0s timing must be gone.
    expect(texts).not.toContain('We built a city none of us dared')
    expect(cues.some(cue => cue.start === 119.0)).toBe(false)
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
      `One to spread life,
and one to cull the dross
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
      'PROJECT BLUEFIN\nseven days to the wolves',
    ])
    expect(prologue.overlays).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'A Gardener and a Winnower walked among the stars.', start: 0, end: 5 }),
      expect.objectContaining({
        text: `One to spread life,
and one to cull the dross
to shape the Garden of Earth.`,
        start: 5,
        end: 13.75,
        textPosition: 'bottom-right',
        highlightSubstrings: ['life', 'dross', 'Garden'],
      }),
      expect.objectContaining({ text: 'One day changed the Garden forever.', start: 13.75, end: 21.5 }),
      expect.objectContaining({
        text: 'New Children arose and filled the pattern.',
        start: 21.5,
        end: 29.5,
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
        nameplateTitle: 'From the Age of Dinosaurs to the Pinnacle of Humanity',
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
      expect.objectContaining({ text: 'PROJECT BLUEFIN\nseven days to the wolves', start: 78.5, end: 94 }),
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

  it('adds the authored cinematic-universe slate before the Destiny trailer', () => {
    const sequence = buildIntroVideoSequence()
    const slate = sequence.find(segment => segment.id === 'bluefin-cinematic-universe')
    const trailer = sequence[sequence.length - 1]

    if (!slate || !trailer || !isTextSegment(slate) || !isVideoSegment(trailer)) {
      throw new Error('Expected slate text segment followed by the Destiny trailer')
    }

    expect(slate.overlays?.map(cue => cue.text)).toEqual([
      'Project Bluefin presents — Three projects, inspired by the first:',
      `Holotype [ exploding clusters ]
[ Mecha[REDACTED] ]
[ REDACTED ]`,
      'and this one. The Bluefin Cinematic Universe. Buckle up, nerds —',
      'Welcome to Indie Cloud Native —',
      'For Nova`',
    ])
    expect(slate.overlays?.[slate.overlays.length - 1]).toEqual(expect.objectContaining({
      text: 'For Nova`',
      preservePunctuation: true,
      highlightSubstrings: ['`'],
    }))
    expect(slate.overlays?.every(cue => cue.preservePunctuation)).toBe(true)
    expect(trailer.id).toBe('wolves-intro')
  })
})
