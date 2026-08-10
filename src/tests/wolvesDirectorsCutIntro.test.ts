import { describe, expect, it } from 'vitest'
import { estimatePageSeconds } from '@/components/wolves/lore/lore-pages'
import { DIRECTORS_CUT_DESTINY_CONCEPTS } from '@/data/wolves-directors-cut-artwork'
import {
  buildDirectorsCutVideoSequence,
  DIRECTORS_CUT_CLARKE_QUOTE,
  DIRECTORS_CUT_DESTINY_SEGMENT_ID,
  DIRECTORS_CUT_PROLOGUE_SEGMENT_ID,
  DOMINANT_EMPHASIS_MAX_WORDS,
  GAYANE_PROLOGUE_MARKS,
  GAYANE_SOURCE_VIDEO_ID,
  GAYANE_TRACK_SECONDS,
  IKORA_LAST_CONTENT_SECOND,
  IKORA_RATING_CARD_SECONDS,
  IKORA_SOURCE_OFFSET_SECONDS,
  IKORA_SOURCE_VIDEO_ID,
} from '@/data/wolves-directors-cut-intro'
import { buildIntroVideoSequence, isTextSegment, isVideoSegment } from '@/data/wolves-intro-sequence'

const APPROVED_PROLOGUE_TEXT = new Set([
  'A Gardener and a Winnower walked among the stars.',
  'One to spread life,\nand one to cull the dross\nto shape the Garden of Earth.',
  'One day changed the Garden forever.',
  'New Children arose and filled the pattern.',
  'For eons, Maintainer-Guardians cultivated the Garden...',
  'Until an AI-fueled Society deemed Guardians unnecessary.\nAnd then, a threat.',
  'Others came to claim a bountiful and unprotected Garden.',
  DIRECTORS_CUT_CLARKE_QUOTE,
  'Now, what\'s left of a proud order fights for survival,\nsurrounded by predators.',
  'PROJECT BLUEFIN\nseven days to the wolves',
])

function prologue() {
  const segment = buildDirectorsCutVideoSequence()[0]
  if (!segment || !isTextSegment(segment)) {
    throw new Error('Expected the Director\'s Cut to open on the scored Gayane segment')
  }
  return segment
}

function destiny() {
  const segment = buildDirectorsCutVideoSequence()[1]
  if (!segment || !isVideoSegment(segment)) {
    throw new Error('Expected the Director\'s Cut to end on the Destiny segment')
  }
  return segment
}

function montageCues() {
  return prologue().overlays!.filter(cue => cue.backgroundImage?.startsWith('wolves-intro/destiny-concepts/'))
}

describe('director\'s cut intro sequence', () => {
  it('is one scored Gayane segment followed by one Destiny segment, with no title card', () => {
    const sequence = buildDirectorsCutVideoSequence()

    expect(sequence.map(segment => segment.id)).toEqual([
      DIRECTORS_CUT_PROLOGUE_SEGMENT_ID,
      DIRECTORS_CUT_DESTINY_SEGMENT_ID,
    ])
    // Both Jorge title-card appearances are gone: the Director's Cut opens cold on the music.
    expect(JSON.stringify(sequence)).not.toContain('wolves-title-card')
    expect(JSON.stringify(sequence)).not.toContain('Jorge Castro')
    expect(JSON.stringify(sequence)).not.toContain('Welcome Linux gamers')
  })

  it('runs the full measured playable Gayane source rather than an excerpt', () => {
    const segment = prologue()

    expect(segment.audioYoutubeVideoId).toBe(GAYANE_SOURCE_VIDEO_ID)
    expect(segment.duration).toBe(GAYANE_TRACK_SECONDS)
    expect(segment.duration).toBe(GAYANE_PROLOGUE_MARKS[GAYANE_PROLOGUE_MARKS.length - 1])
    // The measured fade only covers the source's already-silent tail, so nothing musical is cut.
    expect(segment.audioFadeOutSeconds).toBeGreaterThan(0)
    expect(segment.duration - segment.audioFadeOutSeconds!).toBeGreaterThan(321.34)
  })

  it('cues every prologue beat on a measured Gayane section boundary', () => {
    const marks = new Set<number>(GAYANE_PROLOGUE_MARKS)

    for (const cue of prologue().overlays!) {
      expect(marks.has(cue.start)).toBe(true)
      expect(marks.has(cue.end)).toBe(true)
    }
  })

  it('tiles the marks after the dark open without gaps or overlaps, ending on the last mark', () => {
    const cues = prologue().overlays!

    let cursor: number = GAYANE_PROLOGUE_MARKS[1]
    expect(cues[0].start).toBe(cursor)
    for (const cue of cues) {
      expect(cue.start).toBe(cursor)
      expect(cue.end).toBeGreaterThan(cue.start)
      cursor = cue.end
    }
    expect(cursor).toBe(GAYANE_TRACK_SECONDS)
    // The dark open is deliberate: the source is silent until ~3.09s.
    expect(GAYANE_PROLOGUE_MARKS[0]).toBe(0)
    expect(GAYANE_PROLOGUE_MARKS[1]).toBeGreaterThan(0)
  })

  it('gives every narrated beat at least its theater reading cost', () => {
    for (const cue of prologue().overlays!) {
      if (!cue.text) {
        continue
      }
      expect(cue.end - cue.start).toBeGreaterThanOrEqual(estimatePageSeconds(cue.text))
    }
  })

  it('writes no new lore: every narrated beat is approved prologue or sourced wording', () => {
    for (const cue of prologue().overlays!) {
      if (!cue.text) {
        continue
      }
      expect(APPROVED_PROLOGUE_TEXT.has(cue.text)).toBe(true)
    }
  })

  it('keeps the Clarke quote whole on one page instead of three split fragments', () => {
    const cues = prologue().overlays!
    const clarke = cues.filter(cue => cue.text.includes('humanity had lost its future'))

    expect(clarke).toHaveLength(1)
    expect(clarke[0].text).toBe(
      'In the space of a few days, humanity had lost its future, for the heart of any race is destroyed, and its will to survive is utterly broken, when its children are taken from it.',
    )
    expect(cues.some(cue => cue.text === 'When its children are taken from it')).toBe(false)
  })

  it('keeps the dominant display treatment on beats that fit a 720p projector frame', () => {
    const cues = prologue().overlays!

    for (const cue of cues) {
      if (cue.emphasis !== 'dominant') {
        continue
      }
      expect(cue.text.trim().split(/\s+/).length).toBeLessThanOrEqual(DOMINANT_EMPHASIS_MAX_WORDS)
    }

    // The Clarke quote is the beat dominant was invented for, but whole again it is a page,
    // not a line: at 81px it overflows the top of a 1280x720 frame.
    const clarke = cues.find(cue => cue.text === DIRECTORS_CUT_CLARKE_QUOTE)
    expect(clarke?.emphasis).toBeUndefined()
    expect(cues.some(cue => cue.emphasis === 'dominant')).toBe(true)
  })

  it('plays the ten approved paintings in registry order, image-only, with their provenance', () => {
    const cues = montageCues()

    expect(cues).toHaveLength(DIRECTORS_CUT_DESTINY_CONCEPTS.length)
    expect(cues.map(cue => cue.backgroundImage)).toEqual(
      DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.localPath),
    )
    for (const [index, cue] of cues.entries()) {
      const record = DIRECTORS_CUT_DESTINY_CONCEPTS[index]
      // No caption is painted over a painting: the montage is image-only.
      expect(cue.text).toBe('')
      expect(cue.backgroundFigure).toEqual(record.backgroundFigure)
    }
    expect(DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.referenceId)).toEqual(
      ['E1', 'C1', 'C2', 'C3', 'C4', 'C9', 'C6', 'C5', 'C7', 'C10'],
    )
  })

  it('shapes the montage as a hybrid crescendo on the measured sections', () => {
    const holds = montageCues().map(cue => cue.end - cue.start)
    const europa = holds.slice(0, 5)
    const [c9, c6, c5, c7, c10] = holds.slice(5)

    // E1-C4 are the long Europa movement, and the only cues carrying Ken Burns motion.
    expect(Math.min(...europa)).toBeGreaterThan(c9)
    for (const cue of montageCues().slice(0, 5)) {
      expect(cue.backgroundMotion).toBe('kenburns')
    }
    for (const cue of montageCues().slice(5)) {
      expect(cue.backgroundMotion).toBeUndefined()
    }

    // C9 begins the acceleration, C6/C5/C7 tighten, C10 is the shortest hold of the ten.
    expect(c9).toBeGreaterThan(c6)
    expect(c6).toBeGreaterThan(c5)
    expect(c5).toBeGreaterThan(c7)
    expect(c7).toBeGreaterThan(c10)
    expect(c10).toBe(Math.min(...holds))
  })

  it('runs the montage between the narrated opening and the authored handoff', () => {
    const cues = prologue().overlays!
    const isMontage = (cue: typeof cues[number]) =>
      Boolean(cue.backgroundImage?.startsWith('wolves-intro/destiny-concepts/'))
    const montage = cues.filter(isMontage)
    const firstMontageIndex = cues.findIndex(isMontage)
    const lastMontageIndex = cues.length - 1 - [...cues].reverse().findIndex(isMontage)

    expect(firstMontageIndex).toBeGreaterThan(0)
    expect(lastMontageIndex).toBe(firstMontageIndex + montage.length - 1)
    // Narrated opening before it, authored handoff after it.
    expect(cues.slice(0, firstMontageIndex).every(cue => Boolean(cue.text))).toBe(true)
    const handoff = cues.slice(lastMontageIndex + 1)
    expect(handoff.map(cue => cue.text)).toEqual([
      'Now, what\'s left of a proud order fights for survival,\nsurrounded by predators.',
      'PROJECT BLUEFIN\nseven days to the wolves',
    ])
    expect(handoff[handoff.length - 1].end).toBe(GAYANE_TRACK_SECONDS)
  })

  it('hands off into the frame-verified Ikora source with no voice-over toggle', () => {
    const segment = destiny()

    expect(segment.youtubeVideoId).toBe(IKORA_SOURCE_VIDEO_ID)
    expect(segment.alternateYoutubeVideoId).toBeUndefined()
    expect(segment.alternateMaxDuration).toBeUndefined()
    // Measured on the Ikora source itself: its own ESRB card ends at 2.00s and its last
    // content frame is 113.50s, before the Season of the Wish promo card fades up.
    expect(segment.startOffset).toBe(IKORA_RATING_CARD_SECONDS)
    expect(segment.maxDuration).toBe(IKORA_LAST_CONTENT_SECOND)
    expect(segment.maxDuration).toBeLessThan(114.5)
  })

  it('re-times every guardian window onto the measured Ikora timeline', () => {
    const standard = buildIntroVideoSequence().find(item => item.id === 'wolves-intro')
    if (!standard || !isVideoSegment(standard)) {
      throw new Error('Expected the standard Destiny segment')
    }
    const directors = destiny()

    expect(directors.overlays).toHaveLength(standard.overlays!.length)
    for (const [index, cue] of directors.overlays!.entries()) {
      const source = standard.overlays![index]
      expect(cue.text).toBe(source.text)
      expect(cue.start).toBeCloseTo(source.start - IKORA_SOURCE_OFFSET_SECONDS, 5)
      expect(cue.end).toBeCloseTo(
        Math.min(source.end - IKORA_SOURCE_OFFSET_SECONDS, IKORA_LAST_CONTENT_SECOND),
        5,
      )
      expect(cue.end).toBeLessThanOrEqual(IKORA_LAST_CONTENT_SECOND)
    }
    expect(directors.burnedInCaptions).toEqual([
      { text: '', start: 21.9, end: 35.9, comicHeroTitleCard: true },
    ])
  })

  it('leaves the standard intro and its optional Ikora toggle untouched', () => {
    const standard = buildIntroVideoSequence()

    expect(standard.map(segment => segment.id)).toEqual(['wolves-title-card', 'wolves-intro'])
    const destinySegment = standard[1]
    if (!isVideoSegment(destinySegment)) {
      throw new Error('Expected the standard Destiny segment')
    }
    expect(destinySegment.youtubeVideoId).toBe('BV3BZKbpBns')
    expect(destinySegment.alternateYoutubeVideoId).toBe('BKm0TPqeOjY')
    expect(destinySegment.alternateYoutubeVideoLabel).toBe('Ikora voice over')
    expect(destinySegment.maxDuration).toBe(118.8)

    const serialized = JSON.stringify(standard)
    for (const record of DIRECTORS_CUT_DESTINY_CONCEPTS) {
      expect(serialized).not.toContain(record.localPath)
    }
    expect(serialized).not.toContain(GAYANE_SOURCE_VIDEO_ID)
  })
})
