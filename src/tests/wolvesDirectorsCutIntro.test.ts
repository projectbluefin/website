import type { IntroOverlayTextCue } from '@/data/wolves-intro-sequence'
import { describe, expect, it } from 'vitest'
import { estimatePageSeconds } from '@/components/wolves/lore/lore-pages'
import { DIRECTORS_CUT_DESTINY_CONCEPTS } from '@/data/wolves-directors-cut-artwork'
import {
  buildDirectorsCutVideoSequence,
  DIRECTORS_CUT_DESTINY_SEGMENT_ID,
  DIRECTORS_CUT_FINAL_CRESCENDO_SECOND,
  DIRECTORS_CUT_MAX_CUE_WORDS,
  DIRECTORS_CUT_MAX_TEXTLESS_SECONDS,
  DIRECTORS_CUT_PROLOGUE_SEGMENT_ID,
  DIRECTORS_CUT_SCENE_CROSSFADE_SECONDS,
  DIRECTORS_CUT_TEXT_FADE_SECONDS,
  DIRECTORS_CUT_TEXT_HOLD_RATIO,
  GAYANE_PROLOGUE_MARKS,
  GAYANE_SOURCE_VIDEO_ID,
  GAYANE_TRACK_SECONDS,
  IKORA_LAST_CONTENT_SECOND,
  IKORA_RATING_CARD_SECONDS,
  IKORA_SOURCE_OFFSET_SECONDS,
  IKORA_SOURCE_VIDEO_ID,
} from '@/data/wolves-directors-cut-intro'
import { buildIntroVideoSequence, isTextSegment, isVideoSegment } from '@/data/wolves-intro-sequence'

const CONCEPT_PREFIX = 'wolves-intro/destiny-concepts/'

/**
 * Every thought the projected prologue is allowed to display, verbatim.
 *
 * The 16-word Gardener/Winnower stanza and the 35-word Clarke sentence are both
 * absent on purpose: neither fits the projector word ceiling whole, and neither may
 * be split. Both remain in the authored corpus.
 */
const APPROVED_PROLOGUE_TEXT = new Set([
  'A Gardener and a Winnower walked among the stars.',
  'One day changed the Garden forever.',
  'New Children arose and filled the pattern.',
  'For eons, Maintainer-Guardians cultivated the Garden...',
  'Until an AI-fueled Society deemed Guardians unnecessary.\nAnd then, a threat.',
  'Others came to claim a bountiful and unprotected Garden.',
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

function cues(): readonly IntroOverlayTextCue[] {
  return prologue().overlays!
}

function textCues(): readonly IntroOverlayTextCue[] {
  return cues().filter(cue => cue.text.trim().length > 0)
}

function conceptCues(): readonly IntroOverlayTextCue[] {
  return cues().filter(cue => cue.backgroundImage?.startsWith(CONCEPT_PREFIX))
}

/** The first time each painting takes the stage: the montage proper, in registry order. */
function firstConceptAppearances(): readonly IntroOverlayTextCue[] {
  const seen = new Set<string>()
  return conceptCues().filter((cue) => {
    if (seen.has(cue.backgroundImage!)) {
      return false
    }
    seen.add(cue.backgroundImage!)
    return true
  })
}

/** How long a cue's words actually stay on the screen, which is not its window. */
function textHold(cue: IntroOverlayTextCue): number {
  return cue.textHoldSeconds ?? cue.end - cue.start
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
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

    for (const cue of cues()) {
      expect(marks.has(cue.start)).toBe(true)
      expect(marks.has(cue.end)).toBe(true)
    }
  })

  it('tiles the marks after the dark open without gaps or overlaps, ending on the last mark', () => {
    let cursor: number = GAYANE_PROLOGUE_MARKS[1]
    expect(cues()[0].start).toBe(cursor)
    for (const cue of cues()) {
      expect(cue.start).toBe(cursor)
      expect(cue.end).toBeGreaterThan(cue.start)
      cursor = cue.end
    }
    expect(cursor).toBe(GAYANE_TRACK_SECONDS)
    // The dark open is deliberate: the source is silent until ~3.09s.
    expect(GAYANE_PROLOGUE_MARKS[0]).toBe(0)
    expect(GAYANE_PROLOGUE_MARKS[1]).toBeGreaterThan(0)
  })

  it('holds every displayed thought for its reading cost and not much longer', () => {
    const all = cues()
    const closing = all[all.length - 1]

    for (const cue of all.filter(candidate => candidate.text.trim().length > 0)) {
      const cost = estimatePageSeconds(cue.text)
      const hold = textHold(cue)
      expect(hold, cue.text).toBeGreaterThanOrEqual(cost)
      if (cue === closing) {
        // The film's own title card is the last shot, not a narrative beat: it holds
        // to the cut, which is why it is the one documented exception.
        expect(hold).toBe(cue.end - cue.start)
        continue
      }
      expect(hold, cue.text).toBeLessThanOrEqual(cost * DIRECTORS_CUT_TEXT_HOLD_RATIO)
    }
  })

  it('never leaves the projector wordless for longer than a single held shot', () => {
    let lastTextEnd: number = GAYANE_PROLOGUE_MARKS[1]
    let longest = 0
    for (const cue of cues()) {
      if (cue.text.trim().length === 0) {
        continue
      }
      longest = Math.max(longest, cue.start - lastTextEnd)
      lastTextEnd = cue.start + textHold(cue)
    }

    expect(longest).toBeLessThanOrEqual(DIRECTORS_CUT_MAX_TEXTLESS_SECONDS)
  })

  it('writes no new lore: every displayed beat is approved prologue wording', () => {
    for (const cue of textCues()) {
      expect(APPROVED_PROLOGUE_TEXT.has(cue.text), cue.text).toBe(true)
    }
  })

  it('keeps every displayed cue inside the projector word ceiling', () => {
    expect(DIRECTORS_CUT_MAX_CUE_WORDS).toBe(13)
    for (const cue of textCues()) {
      expect(wordCount(cue.text), cue.text).toBeLessThanOrEqual(DIRECTORS_CUT_MAX_CUE_WORDS)
    }
  })

  it('omits the thoughts that cannot be shown whole inside that ceiling', () => {
    const serialized = JSON.stringify(cues())

    expect(serialized).not.toContain('humanity had lost its future')
    expect(serialized).not.toContain('cull the dross')
    expect(serialized).not.toContain('When its children are taken from it')
  })

  it('recurs each thought as a motif rather than repeating it into wallpaper', () => {
    const spoken = textCues().map(cue => cue.text)
    const counts = new Map<string, number>()
    for (const text of spoken) {
      counts.set(text, (counts.get(text) ?? 0) + 1)
    }

    for (const [text, count] of counts) {
      expect(count, text).toBeLessThanOrEqual(2)
    }
    // A thought never follows itself: that reads as a stuck slide, not a refrain.
    for (const [index, text] of spoken.entries()) {
      if (index === 0) {
        continue
      }
      expect(text, `repeat at ${index}`).not.toBe(spoken[index - 1])
    }
  })

  it('plays the ten approved paintings once each, in registry order, before any reprise', () => {
    const openings = firstConceptAppearances()

    expect(openings.map(cue => cue.backgroundImage)).toEqual(
      DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.localPath),
    )
    expect(DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.referenceId)).toEqual(
      ['E1', 'C1', 'C2', 'C3', 'C4', 'C9', 'C6', 'C5', 'C7', 'C10'],
    )
    const approved = new Map(DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => [record.localPath, record]))
    for (const cue of conceptCues()) {
      const record = approved.get(cue.backgroundImage!)
      expect(record, cue.backgroundImage).toBeTruthy()
      expect(cue.backgroundFigure).toEqual(record!.backgroundFigure)
    }
    // The retired Ken Burns crop is gone from the data surface, not merely unused.
    expect(JSON.stringify(cues())).not.toContain('kenburns')
    expect(JSON.stringify(buildIntroVideoSequence())).not.toContain('backgroundMotion')
  })

  it('frames every painting whole at its own measured source geometry', () => {
    const approved = new Map(DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => [record.localPath, record]))

    for (const cue of conceptCues()) {
      const record = approved.get(cue.backgroundImage!)!
      expect(cue.backgroundFraming, record.id).toEqual({
        fit: 'contain',
        sourceWidth: record.sourceWidth,
        sourceHeight: record.sourceHeight,
      })
    }
    // Panoramic and portrait-ish paintings are exactly what a global `cover` crop destroys.
    expect(DIRECTORS_CUT_DESTINY_CONCEPTS.some(record => record.sourceWidth / record.sourceHeight > 2.2)).toBe(true)
    expect(DIRECTORS_CUT_DESTINY_CONCEPTS.some(record => record.sourceWidth / record.sourceHeight < 1.5)).toBe(true)
  })

  it('shapes the montage as a hybrid crescendo on the measured sections', () => {
    const holds = firstConceptAppearances().map(cue => cue.end - cue.start)
    const europa = holds.slice(0, 5)
    const [c9, c6, c5, c7, c10] = holds.slice(5)

    // E1-C4 remain the slower movement overall; C9 starts a strict acceleration.
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    expect(average(europa)).toBeGreaterThan(average([c9, c6, c5, c7, c10]))

    // C9 begins the acceleration, C6/C5/C7 tighten, C10 is the shortest hold of the ten.
    expect(c9).toBeGreaterThan(c6)
    expect(c6).toBeGreaterThan(c5)
    expect(c5).toBeGreaterThan(c7)
    expect(c7).toBeGreaterThan(c10)
    expect(c10).toBe(Math.min(...holds))
  })

  it('carries deliberate imagery from the montage through the crescendo and the title', () => {
    const all = cues()
    const firstConcept = all.findIndex(cue => cue.backgroundImage?.startsWith(CONCEPT_PREFIX))

    expect(firstConcept).toBeGreaterThan(0)
    for (const cue of all.slice(firstConcept)) {
      expect(cue.backgroundImage, `${cue.start}-${cue.end}`).toBeTruthy()
    }
    // The old cut went imageless at the last painting and stayed black for 55.5s.
    expect(Math.max(...conceptCues().map(cue => cue.end))).toBe(GAYANE_TRACK_SECONDS)
  })

  it('lands the dominant handoff on the measured final crescendo', () => {
    const dominant = cues().filter(cue => cue.emphasis === 'dominant')
    const crescendo = dominant.find(cue => cue.text.startsWith('Now, what\'s left'))

    expect(DIRECTORS_CUT_FINAL_CRESCENDO_SECOND).toBe(276)
    expect(GAYANE_PROLOGUE_MARKS).toContain(DIRECTORS_CUT_FINAL_CRESCENDO_SECOND)
    expect(crescendo?.start).toBe(DIRECTORS_CUT_FINAL_CRESCENDO_SECOND)
    for (const cue of dominant) {
      expect(wordCount(cue.text), cue.text).toBeLessThanOrEqual(DIRECTORS_CUT_MAX_CUE_WORDS)
    }
  })

  it('closes on the authored title, over a painting, running to the track end', () => {
    const all = cues()
    const closing = all[all.length - 1]

    expect(closing.text).toBe('PROJECT BLUEFIN\nseven days to the wolves')
    expect(closing.slim).toBe(true)
    expect(closing.backgroundImage?.startsWith(CONCEPT_PREFIX)).toBe(true)
    expect(closing.end).toBe(GAYANE_TRACK_SECONDS)
  })

  it('pairs the Director scene dissolve with its own short text reveal', () => {
    expect(DIRECTORS_CUT_TEXT_FADE_SECONDS).toBe(1.6)
    expect(DIRECTORS_CUT_SCENE_CROSSFADE_SECONDS).toBe(DIRECTORS_CUT_TEXT_FADE_SECONDS)
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
    // Nothing in the standard cut takes the Director's own framing or reading holds.
    expect(serialized).not.toContain('backgroundFraming')
    expect(serialized).not.toContain('textHoldSeconds')
  })
})
