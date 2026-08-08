import { describe, expect, it } from 'vitest'
import { parseLoreSpeakerParagraphs, rebuildLoreSpeakerParagraph } from '../components/wolves/lore'
import { loreChatPages, loreProsePages, pickBlockPage, pickPageIndexForElapsed } from '../components/wolves/lore/lore-pages'
import { loadAllLoreRecords } from '../data/wolves-lore-records'
import { wolvesNarrativeTimeline } from '../data/wolves-narrative-timeline'
import { getWolvesThesisState } from '../data/wolves-thesis-sequence'
import { TRACK_ZERO_SECTIONS } from '../data/wolves-track-zero-beats'

const FINAL_ID = 'blue-universal-acquires-wayland-yutani'
const BEAT = TRACK_ZERO_SECTIONS.finaleStart

function finalSlot() {
  const slot = wolvesNarrativeTimeline.find(entry => entry.artifactId === FINAL_ID)
  expect(slot, 'closing bulletin is missing from the timeline').toBeDefined()
  return slot!
}

function pageAt(time: number) {
  const slot = finalSlot()
  const record = loadAllLoreRecords().find(entry => entry.id === FINAL_ID)!
  const pages = loreProsePages(record.body)
  const index = pickPageIndexForElapsed(pages, time - slot.startTime, slot.endTime - slot.startTime)
  return pages[index]!
}

/**
 * Page the closing bulletin the way its own view does: parse speaker
 * paragraphs, then hand them to `pickBlockPage`. This is the audience's view,
 * as opposed to `pageAt`, which is the scheduler's. The two must agree.
 */
function renderedPageAt(time: number) {
  const slot = finalSlot()
  const record = loadAllLoreRecords().find(entry => entry.id === FINAL_ID)!
  const page = pickBlockPage(
    parseLoreSpeakerParagraphs(record.body),
    block => block.source,
    time - slot.startTime,
    slot.endTime - slot.startTime,
    rebuildLoreSpeakerParagraph,
  )
  return page.blocks.map(block => block.source).join('\n\n')
}

// The finale is the one moment in the show where music and text must agree:
// the audience reads that the doctor is dead on the same beat the score says
// Become Legend. Both sides are derived from TRACK_ZERO_SECTIONS.finaleStart,
// and these tests fail if either drifts off it.
describe('finale reveal', () => {
  it('turns up the death reveal exactly on the finale beat', () => {
    expect(pageAt(BEAT)).toContain('Dr. Andy Anderson')
  })

  it('lands the whole reveal as one page, not split across a page turn', () => {
    expect(pageAt(BEAT)).toBe(
      'following the tragic death of Dr. Andy Anderson and his team in a laboratory accident earlier this year.',
    )
  })

  it('still holds the setup a moment before the beat', () => {
    expect(pageAt(BEAT - 0.25)).not.toContain('Dr. Andy Anderson')
  })

  it('fires Become Legend on the same beat', () => {
    expect(getWolvesThesisState(BEAT).text).toBe('Become Legend')
    expect(getWolvesThesisState(BEAT - 0.25).text).not.toBe('Become Legend')
  })

  it('never ends a page on a dangling function word', () => {
    const trailing = /\s(?:a|an|the|and|or|of|to|in|on|at|by|for|from|with|is|was|will|that|his|her|their|its)$/i

    for (const record of loadAllLoreRecords()) {
      const pages = record.kind === 'chatlog' ? loreChatPages(record.body) : loreProsePages(record.body)
      pages.slice(0, -1).forEach((page, index) => {
        expect(trailing.test(page.trimEnd()), `${record.id} page ${index} ends mid phrase: "${page.slice(-40)}"`).toBe(false)
      })
    }
  })

  it('keeps the doctor title and name on one page', () => {
    const record = loadAllLoreRecords().find(entry => entry.id === FINAL_ID)!
    for (const page of loreProsePages(record.body)) {
      expect(page.trimEnd(), 'a page ends on a title, orphaning the name').not.toMatch(/\bDr\.$/)
    }
    expect(loreProsePages(record.body).some(page => page.includes('Dr. Andy Anderson'))).toBe(true)
  })

  it('gives the closing bulletin room for every authored page', () => {
    const slot = finalSlot()
    const record = loadAllLoreRecords().find(entry => entry.id === FINAL_ID)!
    const pages = loreProsePages(record.body)
    const last = pageAt(slot.endTime - 0.1)

    expect(last).toContain('truly a great loss for humanity')
    expect(last).toBe(pages[pages.length - 1])
  })

  // The scheduler derives the bulletin's start time from what it thinks the
  // pages cost, but the audience only ever sees what the view pages. When the
  // two models disagree the show still "works" and every count-based test
  // still passes -- the reveal simply arrives on the wrong beat. It once ran
  // 8.3 seconds ahead of Become Legend, and split "Dr. Andy Anderson" from
  // "and his team" across a page turn, because the view measured escaped HTML
  // with the "**MICHAEL**:" prefix stripped while the scheduler measured the
  // authored block. Both sides now measure the authored block.
  describe('the audience sees what the scheduler timed', () => {
    it('shows the reveal on the beat when paged the way the view pages it', () => {
      expect(renderedPageAt(BEAT)).toContain('Dr. Andy Anderson')
      expect(renderedPageAt(BEAT - 0.25)).not.toContain('Dr. Andy Anderson')
    })

    it('agrees with the scheduler on every page of the bulletin', () => {
      const slot = finalSlot()
      for (let time = slot.startTime; time < slot.endTime; time += 0.25) {
        expect(renderedPageAt(time), `bulletin disagrees at ${time.toFixed(2)}s`).toBe(pageAt(time))
      }
    })

    it('pages every speaker transcript the way the scheduler costs it', () => {
      for (const record of loadAllLoreRecords()) {
        if (record.kind !== 'news' && record.kind !== 'source') {
          continue
        }
        const rendered = pickBlockPage(
          parseLoreSpeakerParagraphs(record.body),
          block => block.source,
          0,
          undefined,
          rebuildLoreSpeakerParagraph,
        )
        expect(rendered.pageCount, `${record.id} pages differently than it is costed`)
          .toBe(loreProsePages(record.body).length)
      }
    })

    it('keeps the speaker on every page of a turn that spans pages', () => {
      const record = loadAllLoreRecords().find(entry => entry.id === FINAL_ID)!
      const blocks = parseLoreSpeakerParagraphs(record.body)
      const slot = finalSlot()
      const duration = slot.endTime - slot.startTime

      for (let elapsed = 0; elapsed < duration; elapsed += 0.5) {
        const page = pickBlockPage(blocks, b => b.source, elapsed, duration, rebuildLoreSpeakerParagraph)
        for (const block of page.blocks) {
          expect(block.speaker, `a page at +${elapsed.toFixed(1)}s has no speaker`).not.toBe('')
          expect(block.text, 'a rendered page still carries its authored speaker prefix')
            .not
            .toMatch(/^\*\*/)
        }
      }
    })
  })
})
