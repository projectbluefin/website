import type { IntroOverlayTextCue } from '@/data/wolves-intro-sequence'
import { describe, expect, it } from 'vitest'
import { estimatePageSeconds } from '@/components/wolves/lore/lore-pages'
import { DIRECTORS_CUT_DESTINY_CONCEPTS } from '@/data/wolves-directors-cut-artwork'
import { DIRECTORS_CUT_COLLAPSE_DAY_IMAGE, DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE } from '@/data/wolves-directors-cut-finale'
import {
  buildDirectorsCutPrologueSegment,
  buildDirectorsCutVideoSequence,
  DEFAULT_PROLOGUE_MOOD_ID,
  DIRECTORS_CUT_DESTINY_SEGMENT_ID,
  DIRECTORS_CUT_FINAL_CRESCENDO_SECOND,
  DIRECTORS_CUT_MAX_CUE_WORDS,
  DIRECTORS_CUT_MAX_TEXTLESS_SECONDS,
  DIRECTORS_CUT_PROLOGUE_SEGMENT_ID,
  DIRECTORS_CUT_SCENE_CROSSFADE_SECONDS,
  DIRECTORS_CUT_TEXT_FADE_SECONDS,
  DIRECTORS_CUT_TEXT_HOLD_RATIO,
  IKORA_LAST_CONTENT_SECOND,
  IKORA_RATING_CARD_SECONDS,
  IKORA_SOURCE_OFFSET_SECONDS,
  IKORA_SOURCE_VIDEO_ID,
  PROLOGUE_MOODS,
  resolvePrologueMood,
  TRIBULATION_LAST_AUDIBLE_SECOND,
  TRIBULATION_PROLOGUE_MARKS,
  TRIBULATION_SOURCE_VIDEO_ID,
  TRIBULATION_TRACK_SECONDS,
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
  'A Gardener and a Winnower\nwalked among the stars.',
  'One day changed\nthe Garden forever.',
  'New Children arose\nand filled the pattern.',
  'For eons,\nMaintainer-Guardians\ncultivated the Garden...',
  'Until an AI-fueled Society\ndeemed Guardians\nunnecessary.\nAnd then, a threat.',
  'Others came to claim\na bountiful\nand unprotected Garden.',
  'Now, what\'s left\nof a proud order\nfights for survival,\nsurrounded by predators.',
  'PROJECT BLUEFIN\nseven days to the wolves',
])

/**
 * The same thoughts with their projection line breaks collapsed.
 *
 * The wording is what may not change; where a line ends is a projection
 * decision, because Michroma across 90vw turns a run-on sentence into a wall of
 * text from the back row. Comparing on this normalized form is what lets the
 * two be checked independently — an edited *word* still fails.
 */
const APPROVED_PROLOGUE_WORDING = new Set(
  [...APPROVED_PROLOGUE_TEXT].map(text => text.replace(/\s+/g, ' ')),
)

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
  it('is one scored Tribulation segment followed by one Destiny segment, with no title card', () => {
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

  it('runs the full measured playable Tribulation source rather than an excerpt', () => {
    const segment = prologue()

    expect(segment.audioYoutubeVideoId).toBe(TRIBULATION_SOURCE_VIDEO_ID)
    expect(segment.duration).toBe(TRIBULATION_TRACK_SECONDS)
    expect(segment.duration).toBe(TRIBULATION_PROLOGUE_MARKS[TRIBULATION_PROLOGUE_MARKS.length - 1])
    // The measured fade only covers the source's already-silent tail, so nothing musical is cut.
    expect(segment.audioFadeOutSeconds).toBeGreaterThan(0)
    expect(segment.duration - segment.audioFadeOutSeconds!).toBeGreaterThan(TRIBULATION_LAST_AUDIBLE_SECOND)
  })

  it('cues every prologue beat on a measured Tribulation section boundary', () => {
    const marks = new Set<number>(TRIBULATION_PROLOGUE_MARKS)

    for (const cue of cues()) {
      expect(marks.has(cue.start)).toBe(true)
      expect(marks.has(cue.end)).toBe(true)
    }
  })

  it('tiles the marks after the dark open without gaps or overlaps, ending on the last mark', () => {
    let cursor: number = TRIBULATION_PROLOGUE_MARKS[1]
    expect(cues()[0].start).toBe(cursor)
    for (const cue of cues()) {
      expect(cue.start).toBe(cursor)
      expect(cue.end).toBeGreaterThan(cue.start)
      cursor = cue.end
    }
    expect(cursor).toBe(TRIBULATION_TRACK_SECONDS)
    // The dark open is deliberate: the source is silent until ~3.09s.
    expect(TRIBULATION_PROLOGUE_MARKS[0]).toBe(0)
    expect(TRIBULATION_PROLOGUE_MARKS[1]).toBeGreaterThan(0)
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
    let lastTextEnd: number = TRIBULATION_PROLOGUE_MARKS[1]
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
      // Checked twice, on purpose. The exact form pins the projection line
      // breaks; the normalized form pins the *words*, so re-breaking a line
      // stays a projection decision while editing a word is still new lore.
      expect(APPROVED_PROLOGUE_WORDING.has(cue.text.replace(/\s+/g, ' ')), cue.text).toBe(true)
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

  it('plays every approved painting once each, in registry order, before any reprise', () => {
    const openings = firstConceptAppearances()

    expect(openings.map(cue => cue.backgroundImage)).toEqual(
      DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.localPath),
    )
    // The exact running order is asserted once, in the artwork registry's own
    // test, rather than restated here where it would rot on the next recut.
    // What this test owns is the *relationship*: the montage plays the registry,
    // in registry order, once each.
    expect(openings).toHaveLength(DIRECTORS_CUT_DESTINY_CONCEPTS.length)
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
    // Every record is stored at exactly 16:9 now, so the montage fills the frame
    // and nothing letterboxes. Sources arrived at nine different ratios, from
    // 1.40:1 to 2.35:1, and because the runtime frames paintings whole rather
    // than cropping them, the off-ratio ones painted inside black bars - 47% of
    // a 1080p screen on the invasion plate, 56% on the atrium. They are cropped
    // to 16:9 on the way into the registry instead.
    //
    // The caption still offsets itself by the measured bar. That code is not
    // dead: it is what makes a future off-ratio record safe rather than a
    // silent regression, and it is asserted in the browser probe.
    for (const record of DIRECTORS_CUT_DESTINY_CONCEPTS) {
      expect(record.sourceWidth / record.sourceHeight, record.id).toBeCloseTo(16 / 9, 2)
    }
  })

  it('shapes the montage as a descent through Earth, then the cold arrival', () => {
    const appearances = firstConceptAppearances()

    // Registry order is running order, and the running order is an argument:
    // eight Earth records, the Mars ruin, then Europa. The old assertion here
    // pinned a five-Europa opening and a strict C9>C6>C5>C7>C10 acceleration,
    // both of which described a montage that no longer exists - six of those
    // records were cut for showing the threat.
    const ids = appearances.map(cue => cue.backgroundImage)

    expect(ids.length).toBeGreaterThanOrEqual(9)
    expect(ids.filter(path => /europa/i.test(path ?? '')).length).toBeGreaterThan(0)

    // Every Europa frame sits after every Earth frame. This is the owner's
    // "save europa for the end" as a property of the cut rather than a comment.
    const lastEarth = ids.reduce((last, path, index) => (/europa/i.test(path ?? '') ? last : index), -1)
    const firstEuropa = ids.findIndex(path => /europa/i.test(path ?? ''))

    expect(firstEuropa).toBeGreaterThan(lastEarth)
  })

  it('carries deliberate imagery from the montage through the crescendo and the title', () => {
    const all = cues()
    const firstConcept = all.findIndex(cue => cue.backgroundImage?.startsWith(CONCEPT_PREFIX))

    // The montage now opens the show. This assertion used to require
    // `> 0` - that a painting could not be the very first shot - which was the
    // old cut's 108s of narration on black expressed as a test. The owner's
    // review retired it: "too much black in the beginning, I want to see
    // scenes." The prologue must now put an image up on its first shot.
    expect(firstConcept).toBe(0)
    for (const cue of all.slice(firstConcept)) {
      // A crossfade is imagery too: the crescendo carries the Collapse as a
      // day-to-night pair rather than a still, so "has a background" cannot be
      // spelled as "has a `backgroundImage`" any more.
      const hasImagery = Boolean(cue.backgroundImage) || Boolean(cue.backgroundCrossfade?.length)
      expect(hasImagery, `${cue.start}-${cue.end}`).toBe(true)
    }
    // The old cut went imageless at the last painting and stayed black for 55.5s.
    // The tail is the Collapse now, not a painting, so the montage runs to the
    // crescendo and the Collapse carries the rest.
    // Imagery runs to the very end now: the Europa arrival and the title plate
    // are both paintings, so the last concept frame is the track's own end.
    expect(Math.max(...conceptCues().map(cue => cue.end)))
      .toBe(TRIBULATION_TRACK_SECONDS)
  })

  it('lands the handoff on the measured final crescendo, at a size that can hold its lines', () => {
    const crescendo = cues().find(cue => cue.text.startsWith('Now, what\'s left'))

    expect(TRIBULATION_PROLOGUE_MARKS).toContain(DIRECTORS_CUT_FINAL_CRESCENDO_SECOND)
    expect(crescendo?.start).toBe(DIRECTORS_CUT_FINAL_CRESCENDO_SECOND)

    // The crescendo is the one dominant cue in the prologue, and it is the only
    // one. `dominant` was retired from here once, on the grounds that it renders
    // at 81px where the overlay's Michroma caps leave ~1075px of usable box and
    // every line of this narration is wider than that — so the browser re-wrapped
    // the authored lining mid-phrase.
    //
    // That was a fact about the *shared* dominant rule's `8rem` cap, not about
    // this beat. The prologue now carries its own dominant rule sized in `vw`
    // (`.wolves-intro-overlay-text-director.wolves-intro-overlay-text-dominant`),
    // so it scales with the box instead of against it: ~51px at 1280 and ~77px at
    // 1920, versus the 4.4rem cap that pins every other caption to ~45px at any
    // screen size. The browser harness holds the invariant that actually matters —
    // every cue renders exactly the lines it authored — at 1280x720 and 1920x1080.
    expect(crescendo?.emphasis).toBe('dominant')

    // Two dominant beats, not one: the Collapse and the survival line. The
    // prologue used to have a single centre-frame cue, which left the calamity
    // itself - the fulcrum of the whole piece - set in the same lower third as
    // its connective tissue. Two is a deliberate ceiling, not a drift: a third
    // would stop the treatment meaning anything.
    const dominant = cues().filter(cue => cue.emphasis === 'dominant')

    expect(dominant).toHaveLength(2)
    expect(dominant.map(cue => cue.text.split('\n')[0])).toEqual(['One day changed', 'Now, what\'s left'])
    for (const cue of textCues()) {
      expect(wordCount(cue.text), cue.text).toBeLessThanOrEqual(DIRECTORS_CUT_MAX_CUE_WORDS)
    }
  })

  it('closes on the authored title, over the Collapse at night, running to the track end', () => {
    const all = cues()
    const closing = all[all.length - 1]

    expect(closing.text).toBe('PROJECT BLUEFIN\nseven days to the wolves')
    expect(closing.slim).toBe(true)
    // The title lands on Europa, which is the single exception to holding
    // Europa back to the end: "save europa for the end except for the bluefin
    // title slide" (owner, 2026-08-10).
    expect(closing.backgroundImage).toMatch(/europa/i)
    expect(closing.end).toBe(TRIBULATION_TRACK_SECONDS)
  })

  it('spends the Collapse once, on the final crescendo, as a day-to-night fade', () => {
    const all = cues()
    const collapse = all.filter(cue =>
      cue.backgroundImage === DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE
      || cue.backgroundCrossfade?.some(pair => pair.day === DIRECTORS_CUT_COLLAPSE_DAY_IMAGE))

    // It used to occupy marks 3-6 - 33.03s to 98.71s - which put the show's
    // ending on stage a minute into it and left the finale nothing to arrive
    // at. The bound that matters is that it is never spent early: it is the
    // hinge of the piece, and on this shorter track it falls in the last half,
    // after the Earth montage and before the cold arrival, rather than landing
    // on the crescendo itself.
    expect(collapse.every(cue => cue.start > TRIBULATION_TRACK_SECONDS / 2)).toBe(true)

    // Exactly one day-to-night fade, and the stills that follow only ever hold
    // the night plate it faded to.
    const fades = all.filter(cue => cue.backgroundCrossfade?.some(pair => pair.day === DIRECTORS_CUT_COLLAPSE_DAY_IMAGE))

    expect(fades).toHaveLength(1)

    const fade = fades[0]

    expect(collapse.every(cue => cue.start >= fade.start)).toBe(true)
    expect(fade?.backgroundCrossfade?.[0]?.night).toBe(DIRECTORS_CUT_COLLAPSE_NIGHT_IMAGE)
  })

  it('never dresses the prologue in an unrelated Bluefin wallpaper', () => {
    // Act I rode `img/wallpapers/bluefin-06-day/night.webp` — a monthly desktop
    // wallpaper with no place in this story. Every image the prologue shows is
    // either approved Destiny concept art or the Collapse.
    for (const cue of cues()) {
      const images = [
        cue.backgroundImage,
        ...(cue.backgroundCrossfade ?? []).flatMap(pair => [pair.day, pair.night]),
      ].filter(Boolean) as string[]
      for (const image of images) {
        expect(
          image.startsWith(CONCEPT_PREFIX) || image.startsWith('wolves-intro/bluefin-collapse-'),
          `${cue.start}-${cue.end} shows ${image}`,
        ).toBe(true)
      }
    }
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

  it('keeps the cut fixed and swaps only the score', () => {
    // A mood is an audio substitution under an authored grid, never a re-cut.
    // Whichever score is playing, the segment runs the same window and the same
    // cues, so the montage, the Collapse and the title always land where they
    // were cut to land.
    const base = buildDirectorsCutPrologueSegment()

    for (const mood of PROLOGUE_MOODS) {
      const segment = buildDirectorsCutPrologueSegment(mood.id)

      expect(segment.duration, mood.id).toBe(base.duration)
      expect(segment.overlays, mood.id).toEqual(base.overlays)
      expect(segment.audioYoutubeVideoId, mood.id).toBe(mood.youtubeVideoId)
    }
  })

  it('plays the mood the cut was built for when nobody touches anything', () => {
    // The presentation runs unattended to a room with no input device, so the
    // picker has to be an affordance and never a dependency. An untouched build
    // is the default mood, and the default is the track the marks were measured
    // from - not merely whichever entry happens to be first in the list.
    const untouched = buildDirectorsCutPrologueSegment()
    const fallback = buildDirectorsCutPrologueSegment('no-such-mood')
    const expected = resolvePrologueMood(DEFAULT_PROLOGUE_MOOD_ID)

    expect(expected.id).toBe('tribulation')
    expect(expected.offsetSeconds).toBe(0)
    expect(untouched.audioYoutubeVideoId).toBe(expected.youtubeVideoId)
    expect(fallback.audioYoutubeVideoId).toBe(expected.youtubeVideoId)
  })

  it('gives every mood enough track to cover the window it is borrowed for', () => {
    // A mood entered at an offset whose remaining track is shorter than the
    // show would fall silent before the title card. The fade needs to land on
    // music, not on a track that already ended.
    for (const mood of PROLOGUE_MOODS) {
      expect(mood.offsetSeconds, mood.id).toBeGreaterThanOrEqual(0)
      expect(mood.trackSeconds - mood.offsetSeconds, mood.id)
        .toBeGreaterThanOrEqual(TRIBULATION_TRACK_SECONDS)
    }

    // Distinct ids and sources, or the picker offers the same thing twice.
    expect(new Set(PROLOGUE_MOODS.map(mood => mood.id)).size).toBe(PROLOGUE_MOODS.length)
    expect(new Set(PROLOGUE_MOODS.map(mood => mood.youtubeVideoId)).size).toBe(PROLOGUE_MOODS.length)
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
    expect(serialized).not.toContain(TRIBULATION_SOURCE_VIDEO_ID)
    // Nothing in the standard cut takes the Director's own framing or reading holds.
    expect(serialized).not.toContain('backgroundFraming')
    expect(serialized).not.toContain('textHoldSeconds')
  })
})
