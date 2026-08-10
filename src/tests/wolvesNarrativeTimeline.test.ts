import { describe, expect, it } from 'vitest'
import { estimatePageSeconds } from '../components/wolves/lore/lore-pages'
import { DIRECTORS_CUT_FINALE_ANCHORS } from '../data/wolves-directors-cut-finale'
import {
  DIRECTORS_CUT_BULLETIN_ARTIFACT_ID,
  DIRECTORS_CUT_QUOTE_IDS,
  DIRECTORS_CUT_QUOTE_MAX_HOLD_RATIO,
  getDirectorsCutNarrativeSlotForTime,
  wolvesDirectorsCutNarrativeTimeline,
} from '../data/wolves-directors-cut-timeline'
import { loadAllLoreRecords } from '../data/wolves-lore-records'
import { CHAT_COMPLETION_PAUSE_SECONDS, estimateLoreReadDuration, loreRecordPages } from '../data/wolves-lore-timing'
import {
  getNarrativeSlotForTime,
  lockedNarrativeSlots,
  wolvesNarrativeTimeline,
} from '../data/wolves-narrative-timeline'
import { TRACK_ZERO_BEAT_TIMES, TRACK_ZERO_SECTIONS } from '../data/wolves-track-zero-beats'

const loreRecordsById = new Map(loadAllLoreRecords().map(record => [record.id, record] as const))

/** What a scheduled record costs to read, measured the way the renderer pages it. */
function readCost(artifactId: string): number {
  const record = loreRecordsById.get(artifactId)!
  return estimateLoreReadDuration({
    kind: record.kind === 'quote' ? 'quote' : 'prose',
    body: record.body,
    attribution: record.metadata.attribution,
  })
}

describe('wolves narrative timeline', () => {
  it('contains every visible release artifact exactly once', () => {
    const ids = wolvesNarrativeTimeline.map(slot => slot.artifactId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('lorem-pursuit-1')
    expect(ids).toContain('blue-universal-acquires-wayland-yutani')
    expect(ids).not.toContain('lorem-prologue-2')
    expect(ids).not.toContain('lorem-prologue-1')
    expect(ids).not.toContain('john-seager')
    expect(ids).not.toContain('do-not-reply')
  })

  it('keeps The Artifact source record available while hiding it from the video', () => {
    const artifact = loadAllLoreRecords().find(record => record.id === 'lorem-prologue-1')

    expect(artifact).toMatchObject({
      id: 'lorem-prologue-1',
      metadata: { title: 'The Artifact' },
    })
    expect(wolvesNarrativeTimeline.map(slot => slot.artifactId)).not.toContain(artifact?.id)
  })

  it('keeps unlocked lore in authored timeline order', () => {
    const ids = wolvesNarrativeTimeline.map(slot => slot.artifactId)
    expect(ids.indexOf('lorem-pursuit-1')).toBeGreaterThan(ids.indexOf('arthur-c-clarke-1'))
    expect(ids).not.toContain('john-seager')
    expect(ids[ids.length - 1]).toBe('blue-universal-acquires-wayland-yutani')
  })

  it('preserves the approved first, middle, and final anchors', () => {
    expect(getNarrativeSlotForTime(0)).toMatchObject({
      artifactId: 'arthur-c-clarke-2',
      startTime: 0,
    })
    // The Golden Era transmission is anchored to the chanting bridge rather
    // than a round number: it starts early enough that Sarah's closing line
    // lands exactly on TRACK_ZERO_SECTIONS.bridgeStart.
    const pursuit = getNarrativeSlotForTime(TRACK_ZERO_SECTIONS.bridgeStart)
    expect(pursuit.artifactId).toBe('lorem-pursuit-1')
    expect(pursuit.startTime).toBeLessThan(TRACK_ZERO_SECTIONS.bridgeStart)
    expect(pursuit.endTime).toBeGreaterThan(TRACK_ZERO_SECTIONS.bridgeStart)
    // The closing bulletin is anchored to the finale beat rather than a round
    // number: it starts early enough that its death-reveal page lands exactly
    // on TRACK_ZERO_SECTIONS.finaleStart. See wolvesFinaleReveal.test.ts.
    expect(getNarrativeSlotForTime(TRACK_ZERO_SECTIONS.finaleStart)).toMatchObject({
      artifactId: 'blue-universal-acquires-wayland-yutani',
      endTime: 425,
    })
    expect(getNarrativeSlotForTime(TRACK_ZERO_SECTIONS.finaleStart).startTime)
      .toBeLessThan(TRACK_ZERO_SECTIONS.finaleStart)
  })

  it('keeps every registered narrative lock at its declared time', () => {
    for (const lock of lockedNarrativeSlots) {
      const slot = wolvesNarrativeTimeline.find(slot => slot.artifactId === lock.artifactId)

      expect(slot?.startTime).toBe(lock.startTime)
      if (lock.endTime !== undefined) {
        expect(slot?.endTime).toBe(lock.endTime)
      }
    }
  })

  it('reserves a five-second completion pause for every unlocked conversation', () => {
    const records = new Map(loadAllLoreRecords().map(record => [record.id, record] as const))
    const lockedIds = new Set(lockedNarrativeSlots.map(slot => slot.artifactId))

    for (const slot of wolvesNarrativeTimeline) {
      const record = records.get(slot.artifactId)
      if (!record || record.kind !== 'chatlog' || lockedIds.has(record.id)) {
        continue
      }

      expect(slot.endTime - slot.startTime).toBeGreaterThanOrEqual(CHAT_COMPLETION_PAUSE_SECONDS - 1e-8)
    }
  })

  it('allocates unlocked lore between the locked anchors', () => {
    const finalStart = wolvesNarrativeTimeline[wolvesNarrativeTimeline.length - 1].startTime
    const pursuitEnd = wolvesNarrativeTimeline.find(slot => slot.artifactId === 'lorem-pursuit-1')!.endTime
    const middle = wolvesNarrativeTimeline.filter(slot => slot.startTime >= pursuitEnd && slot.endTime <= finalStart)
    expect(middle.length).toBeGreaterThan(0)
    expect(middle.every(slot => slot.endTime > slot.startTime)).toBe(true)
  })

  it('keeps the recomputed middle contiguous', () => {
    const finalStart = wolvesNarrativeTimeline[wolvesNarrativeTimeline.length - 1].startTime
    const pursuitEnd = wolvesNarrativeTimeline.find(slot => slot.artifactId === 'lorem-pursuit-1')!.endTime
    const middle = wolvesNarrativeTimeline.filter(slot => slot.startTime >= pursuitEnd && slot.endTime <= finalStart)
    for (let index = 1; index < middle.length; index++) {
      expect(middle[index].startTime).toBeCloseTo(middle[index - 1].endTime, 8)
    }
  })

  it('uses the available unlocked range for readable post-Golden-Era lore', () => {
    const retimedSlots = wolvesNarrativeTimeline.filter(slot => slot.startTime >= 220 && slot.endTime <= 398)

    for (const slot of retimedSlots) {
      expect(slot.endTime - slot.startTime).toBeGreaterThan(0)
    }
  })

  it('gives every Arthur C. Clarke quote its full readable page', () => {
    const records = new Map(loadAllLoreRecords().map(record => [record.id, record] as const))

    // Only the quotes the show actually displays; see the hidden set in
    // wolves-narrative-timeline.ts for the ones curated out.
    for (const artifactId of ['arthur-c-clarke-2', 'arthur-c-clarke-3']) {
      const slot = wolvesNarrativeTimeline.find(slot => slot.artifactId === artifactId)
      const pages = loreRecordPages({ kind: 'quote', body: records.get(artifactId)?.body ?? '' })

      expect(slot).toBeDefined()
      // A quote holds one complete page for its own reading cost; the old
      // fifteen-second constant is replaced by the shared page model.
      expect(slot!.endTime - slot!.startTime).toBeGreaterThanOrEqual(estimatePageSeconds(pages[0]!) - 1e-8)
    }
  })

  it('keeps the recomputed unlocked pool contiguous and authored', () => {
    const finalStart = wolvesNarrativeTimeline[wolvesNarrativeTimeline.length - 1].startTime
    const pursuitEnd = wolvesNarrativeTimeline.find(slot => slot.artifactId === 'lorem-pursuit-1')!.endTime
    const middle = wolvesNarrativeTimeline.filter(slot => slot.startTime >= pursuitEnd && slot.endTime <= finalStart)
    for (let index = 1; index < middle.length; index++) {
      expect(middle[index].startTime).toBeCloseTo(middle[index - 1].endTime, 8)
    }
    expect(new Set(middle.map(slot => slot.artifactId)).size).toBe(middle.length)
  })

  it('uses the next slot at exact boundaries and holds the final entry afterward', () => {
    const pursuit = wolvesNarrativeTimeline.find(slot => slot.artifactId === 'lorem-pursuit-1')!
    expect(getNarrativeSlotForTime(pursuit.startTime)?.artifactId).toBe('lorem-pursuit-1')
    expect(getNarrativeSlotForTime(pursuit.endTime)?.artifactId)
      .toBe(wolvesNarrativeTimeline.find(slot => slot.startTime === pursuit.endTime)?.artifactId)
    expect(getNarrativeSlotForTime(425)?.artifactId).toBe('blue-universal-acquires-wayland-yutani')
    expect(getNarrativeSlotForTime(1_000)?.artifactId).toBe('blue-universal-acquires-wayland-yutani')
  })

  it('keeps every visible non-anchor entry on screen for a positive duration', () => {
    for (const slot of wolvesNarrativeTimeline.filter(slot => slot.startTime > 0 && slot.endTime < 398)) {
      expect(slot.endTime - slot.startTime).toBeGreaterThan(0)
    }
  })
})

describe('wolves director\'s cut narrative timeline', () => {
  it('contains exactly the nine approved quotes in their authored order, then the bulletin', () => {
    const ids = wolvesDirectorsCutNarrativeTimeline.map(slot => slot.artifactId)

    expect(DIRECTORS_CUT_QUOTE_IDS).toEqual([
      'quote-sagan-extinction-forever',
      'quote-sagan-pale-blue-dot',
      'quote-clarke-dinosaurs-adapt',
      'quote-clarke-unstable-combination',
      'quote-asimov-knowledge-wisdom',
      'quote-gould-stewards-of-nothing',
      'quote-gould-fight-to-save',
      'quote-goodall-every-individual-matters',
      'quote-goodall-nature-resilient',
    ])
    expect(ids).toEqual([...DIRECTORS_CUT_QUOTE_IDS, DIRECTORS_CUT_BULLETIN_ARTIFACT_ID])
  })

  it('never repeats an artifact', () => {
    const ids = wolvesDirectorsCutNarrativeTimeline.map(slot => slot.artifactId)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every Director-only quote id out of the standard show', () => {
    const standardIds = new Set(wolvesNarrativeTimeline.map(slot => slot.artifactId))

    for (const id of DIRECTORS_CUT_QUOTE_IDS) {
      expect(standardIds.has(id), id).toBe(false)
    }
  })

  it('shows only quotes and the bulletin, never a chatlog or invented dialogue', () => {
    const records = new Map(loadAllLoreRecords().map(record => [record.id, record] as const))

    for (const slot of wolvesDirectorsCutNarrativeTimeline) {
      const record = records.get(slot.artifactId)
      expect(record, slot.artifactId).toBeDefined()
      expect(record?.kind, slot.artifactId).not.toBe('chatlog')
      expect(['quote', 'news']).toContain(record?.kind)
    }
  })

  it('holds every record for at least its full estimateLoreReadDuration() cost', () => {
    for (const slot of wolvesDirectorsCutNarrativeTimeline) {
      expect(slot.endTime - slot.startTime, slot.artifactId).toBeGreaterThanOrEqual(readCost(slot.artifactId) - 1e-8)
    }
  })

  // The first cut of this timeline spent the whole song on nine one-line
  // quotes, which gave each of them a 34-48 second near-static hold: six
  // seconds of reading and half a minute of staring at it. A hold that long
  // is not emphasis, it is a stall, and it is what made the picture edit
  // underneath look like the only thing moving.
  it('never holds a quote past two and a half times its own reading cost', () => {
    for (const slot of wolvesDirectorsCutNarrativeTimeline) {
      const ratio = (slot.endTime - slot.startTime) / readCost(slot.artifactId)
      expect(ratio, `${slot.artifactId} holds ${ratio.toFixed(2)}x its reading cost`)
        .toBeLessThanOrEqual(DIRECTORS_CUT_QUOTE_MAX_HOLD_RATIO + 1e-8)
    }
  })

  // Nothing in this cut may cut anywhere but on the music. Every boundary is
  // either the song's own origin, an authored section mark, or an exact entry
  // of the measured beat grid.
  it('lands every quote boundary on a named musical mark or a measured beat', () => {
    const namedMarks = new Set<number>([0, ...Object.values(TRACK_ZERO_SECTIONS)])
    const onGrid = (time: number) => TRACK_ZERO_BEAT_TIMES.some(beat => Math.abs(beat - time) < 5e-4)

    for (const slot of wolvesDirectorsCutNarrativeTimeline) {
      expect(namedMarks.has(slot.startTime) || onGrid(slot.startTime), `${slot.artifactId} starts off the grid at ${slot.startTime}`).toBe(true)
      expect(namedMarks.has(slot.endTime) || onGrid(slot.endTime), `${slot.artifactId} ends off the grid at ${slot.endTime}`).toBe(true)
    }
  })

  it('opens each authored quote window on its own named musical mark', () => {
    const openings = new Set(wolvesDirectorsCutNarrativeTimeline.map(slot => slot.startTime))

    for (const mark of [0, TRACK_ZERO_SECTIONS.verseStart, TRACK_ZERO_SECTIONS.chorusStart, TRACK_ZERO_SECTIONS.bridgeStart, TRACK_ZERO_SECTIONS.buildStart]) {
      expect(openings.has(mark), `no quote opens the window at ${mark}`).toBe(true)
    }
  })

  // Nine sourced quotes, none compressed, split, or invented. The panel only
  // survives because every one of them fits a measured window; where the music
  // has more room than the words need, the frame is deliberately given back to
  // the picture edit instead of stretching a quote across it.
  it('leaves the surplus as image-only musical intervals rather than stretching a quote', () => {
    const quotes = wolvesDirectorsCutNarrativeTimeline.filter(slot => slot.artifactId !== DIRECTORS_CUT_BULLETIN_ARTIFACT_ID)
    const gaps = quotes.slice(1).map((slot, index) => slot.startTime - quotes[index]!.endTime)

    expect(quotes).toHaveLength(DIRECTORS_CUT_QUOTE_IDS.length)
    expect(gaps.every(gap => gap > 0), 'the quote panel is still wall-to-wall').toBe(true)
    for (const time of [DIRECTORS_CUT_QUOTE_IDS.length > 0 ? quotes[0]!.endTime + 0.5 : 0]) {
      expect(getDirectorsCutNarrativeSlotForTime(time), `${time}s should be image-only`).toBeNull()
    }
  })

  it('places the missing-scientist bulletin on the finale\'s own bulletin window, at its full reading cost', () => {
    const bulletinSlot = wolvesDirectorsCutNarrativeTimeline[wolvesDirectorsCutNarrativeTimeline.length - 1]!

    expect(bulletinSlot.artifactId).toBe(DIRECTORS_CUT_BULLETIN_ARTIFACT_ID)
    expect(bulletinSlot.startTime).toBe(DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart)
    expect(bulletinSlot.endTime).toBe(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd)
    expect(bulletinSlot.endTime - bulletinSlot.startTime)
      .toBeGreaterThanOrEqual(readCost(DIRECTORS_CUT_BULLETIN_ARTIFACT_ID) - 1e-8)
  })

  // The bulletin used to run to the Become Legend cue, which put a seven-page
  // news transcript on stage across the asteroid impact and straight into the
  // first Sagan clause. It now begins earlier and is gone before the corner
  // opens, so the impact has the frame to itself.
  it('starts the bulletin earlier and clears it before the companion impact reveal', () => {
    const bulletinSlot = wolvesDirectorsCutNarrativeTimeline[wolvesDirectorsCutNarrativeTimeline.length - 1]!

    expect(bulletinSlot.startTime).toBeLessThan(TRACK_ZERO_SECTIONS.pivotalStart)
    expect(bulletinSlot.startTime).toBeGreaterThan(TRACK_ZERO_SECTIONS.buildStart)
    expect(bulletinSlot.endTime).toBeLessThanOrEqual(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart)
    expect(bulletinSlot.endTime).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    expect(bulletinSlot.endTime).toBeLessThan(DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart)
  })

  it('never overlaps two records, and never runs past the finale\'s own bulletin window', () => {
    for (const [index, slot] of wolvesDirectorsCutNarrativeTimeline.entries()) {
      expect(slot.endTime, slot.artifactId).toBeGreaterThan(slot.startTime)
      if (index > 0) {
        expect(slot.startTime, slot.artifactId)
          .toBeGreaterThanOrEqual(wolvesDirectorsCutNarrativeTimeline[index - 1]!.endTime)
      }
    }
    expect(wolvesDirectorsCutNarrativeTimeline[0]?.startTime).toBe(0)
    expect(wolvesDirectorsCutNarrativeTimeline[wolvesDirectorsCutNarrativeTimeline.length - 1]?.endTime)
      .toBe(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd)
  })

  it('resolves the record on stage for a given clock reading, and nothing at all outside one', () => {
    expect(getDirectorsCutNarrativeSlotForTime(0)?.artifactId).toBe(DIRECTORS_CUT_QUOTE_IDS[0])
    expect(getDirectorsCutNarrativeSlotForTime(DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart)?.artifactId)
      .toBe(DIRECTORS_CUT_BULLETIN_ARTIFACT_ID)
    // The finale owns every second after the bulletin clears; the lore column
    // must not be still holding a stale record underneath it.
    expect(getDirectorsCutNarrativeSlotForTime(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd)).toBeNull()
    expect(getDirectorsCutNarrativeSlotForTime(1_000)).toBeNull()
  })
})
