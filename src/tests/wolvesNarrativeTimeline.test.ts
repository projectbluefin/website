import { describe, expect, it } from 'vitest'
import {
  getNarrativeSlotForTime,
  lockedNarrativeSlots,
  wolvesNarrativeTimeline,
} from '../data/wolves-narrative-timeline'
import { wolvesRelease } from '../data/wolves-story'

const legacyTrimmedBodyTimeline = [
  ['arthur-c-clarke-4', 0, 5.680359435173299],
  ['arthur-c-clarke-1', 5.680359435173299, 14.441591784338897],
  ['arthur-c-clarke-2', 14.441591784338897, 25.41720154043646],
  ['arthur-c-clarke-3', 25.41720154043646, 29.043645699614892],
  ['ishtar-gardener-and-winnower', 29.043645699614892, 36.55327342747112],
  ['ishtar-flower-game', 36.55327342747112, 49.229781771501926],
  ['ishtar-first-knife', 49.229781771501926, 62.51604621309371],
  ['ishtar-the-wager', 62.51604621309371, 77.37483953786906],
  ['reckoning-of-the-three', 77.37483953786906, 85.26957637997432],
  ['ishtar-patternfall', 85.26957637997432, 101.18741976893453],
  ['committee-report-personal-transmission', 101.18741976893453, 109.59563543003851],
  ['ishtar-cambrian-explosion', 109.59563543003851, 124.93581514762516],
  ['john-bazzite-interview', 124.93581514762516, 136.8100128369705],
  ['ishtar-final-shape', 136.8100128369705, 150],
  ['lorem-pursuit-1', 150, 220],
  ['lorem-awakening-1', 220, 226.50144449030128],
  ['do-not-reply', 226.50144449030128, 231.1295914156005],
  ['quote-unmarked-grave', 231.1295914156005, 233.18654560462235],
  ['quote-third-disciple', 233.18654560462235, 236.27197688815517],
  ['maintenance-window', 236.27197688815517, 241.81840693355343],
  ['quote-berkus', 241.81840693355343, 247.10771770532398],
  ['lorem-prologue-1', 247.10771770532398, 256.58439950474616],
  ['lorem-prologue-2', 256.58439950474616, 281.1209244737928],
  ['forbidden-factory', 281.1209244737928, 287.25505571605447],
  ['jordan-adrian', 287.25505571605447, 308.30210482872474],
  ['quote-childhoods-end-future', 308.30210482872474, 309.55096987205945],
  ['quote-natasha-woods', 309.55096987205945, 311.68138671068925],
  ['childhoods-end-wager', 311.68138671068925, 322.6640528270739],
  ['glorious-eggroll', 322.6640528270739, 351.49814279818406],
  ['project-neptune', 351.49814279818406, 357.70573669005364],
  ['john-seager', 357.70573669005364, 398],
  ['blue-universal-acquires-wayland-yutani', 398, 425],
] as const

describe('wolves narrative timeline', () => {
  it('contains every release artifact exactly once', () => {
    expect(wolvesNarrativeTimeline).toHaveLength(wolvesRelease.artifacts.length)
    expect(new Set(wolvesNarrativeTimeline.map(slot => slot.artifactId))).toHaveLength(wolvesNarrativeTimeline.length)
    expect(new Set(wolvesNarrativeTimeline.map(slot => slot.artifactId)))
      .toEqual(new Set(wolvesRelease.artifacts.map(artifact => artifact.id)))
  })

  it('keeps the authored release chapter and artifact order fixed', () => {
    expect(wolvesRelease.artifacts.map(({ id, chapterId }) => ({ id, chapterId }))).toEqual([
      { id: 'arthur-c-clarke-4', chapterId: 'prologue' },
      { id: 'lorem-prologue-1', chapterId: 'prologue' },
      { id: 'arthur-c-clarke-1', chapterId: 'prologue' },
      { id: 'lorem-prologue-2', chapterId: 'prologue' },
      { id: 'arthur-c-clarke-2', chapterId: 'prologue' },
      { id: 'forbidden-factory', chapterId: 'prologue' },
      { id: 'jordan-adrian', chapterId: 'prologue' },
      { id: 'arthur-c-clarke-3', chapterId: 'prologue' },
      { id: 'maintenance-window', chapterId: 'prologue' },
      { id: 'quote-childhoods-end-future', chapterId: 'pursuit' },
      { id: 'lorem-pursuit-1', chapterId: 'pursuit' },
      { id: 'quote-natasha-woods', chapterId: 'pursuit' },
      { id: 'do-not-reply', chapterId: 'pursuit' },
      { id: 'quote-berkus', chapterId: 'pursuit' },
      { id: 'childhoods-end-wager', chapterId: 'pursuit' },
      { id: 'quote-unmarked-grave', chapterId: 'pursuit' },
      { id: 'quote-third-disciple', chapterId: 'pursuit' },
      { id: 'lorem-awakening-1', chapterId: 'awakening' },
      { id: 'ishtar-gardener-and-winnower', chapterId: 'awakening' },
      { id: 'glorious-eggroll', chapterId: 'awakening' },
      { id: 'ishtar-flower-game', chapterId: 'awakening' },
      { id: 'project-neptune', chapterId: 'awakening' },
      { id: 'ishtar-first-knife', chapterId: 'awakening' },
      { id: 'john-seager', chapterId: 'awakening' },
      { id: 'ishtar-the-wager', chapterId: 'awakening' },
      { id: 'reckoning-of-the-three', chapterId: 'awakening' },
      { id: 'ishtar-patternfall', chapterId: 'awakening' },
      { id: 'committee-report-personal-transmission', chapterId: 'awakening' },
      { id: 'ishtar-cambrian-explosion', chapterId: 'awakening' },
      { id: 'john-bazzite-interview', chapterId: 'awakening' },
      { id: 'ishtar-final-shape', chapterId: 'awakening' },
      { id: 'blue-universal-acquires-wayland-yutani', chapterId: 'awakening' },
    ])
  })

  it('preserves the approved first, middle, and final anchors', () => {
    expect(getNarrativeSlotForTime(0)).toMatchObject({
      artifactId: 'arthur-c-clarke-4',
      startTime: 0,
    })
    expect(getNarrativeSlotForTime(180)).toMatchObject({
      artifactId: 'lorem-pursuit-1',
      startTime: 150,
      endTime: 220,
    })
    expect(getNarrativeSlotForTime(398)).toMatchObject({
      artifactId: 'blue-universal-acquires-wayland-yutani',
      startTime: 398,
      endTime: 425,
    })
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

  it('keeps every Track 0 slot at its pre-migration trimmed-body boundaries', () => {
    expect(wolvesNarrativeTimeline.map(slot => [slot.artifactId, slot.startTime, slot.endTime]))
      .toEqual(legacyTrimmedBodyTimeline)
  })

  it('orders the non-anchor lore pool by metadata date', () => {
    const lockedArtifactIds = new Set(lockedNarrativeSlots.map(slot => slot.artifactId))
    const manifestIndexes = new Map(wolvesRelease.artifacts.map((artifact, index) => [artifact.id, index]))
    const pool = wolvesNarrativeTimeline
      .map(slot => wolvesRelease.artifacts.find(artifact => artifact.id === slot.artifactId)!)
      .filter(artifact => !lockedArtifactIds.has(artifact.id))

    for (let index = 1; index < pool.length; index++) {
      const previous = pool[index - 1]
      const current = pool[index]

      expect(previous.publishedAt <= current.publishedAt).toBe(true)
      if (previous.publishedAt === current.publishedAt) {
        expect(manifestIndexes.get(previous.id)).toBeLessThan(manifestIndexes.get(current.id)!)
      }
    }
  })

  it('uses the next slot at exact boundaries and holds the final entry afterward', () => {
    expect(getNarrativeSlotForTime(150)?.artifactId).toBe('lorem-pursuit-1')
    expect(getNarrativeSlotForTime(220)?.artifactId)
      .toBe(wolvesNarrativeTimeline.find(slot => slot.startTime === 220)?.artifactId)
    expect(getNarrativeSlotForTime(425)?.artifactId).toBe('blue-universal-acquires-wayland-yutani')
    expect(getNarrativeSlotForTime(1_000)?.artifactId).toBe('blue-universal-acquires-wayland-yutani')
  })

  it('gives longer lore entries longer non-anchor slots', () => {
    const short = wolvesNarrativeTimeline.find(slot => slot.artifactId === 'quote-natasha-woods')!
    const long = wolvesNarrativeTimeline.find(slot => slot.artifactId === 'john-seager')!

    expect(long.endTime - long.startTime).toBeGreaterThan(short.endTime - short.startTime)
  })
})
