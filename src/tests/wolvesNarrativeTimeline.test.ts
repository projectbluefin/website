import { describe, expect, it } from 'vitest'
import {
  getNarrativeSlotForTime,
  lockedNarrativeSlots,
  wolvesNarrativeTimeline,
} from '../data/wolves-narrative-timeline'
import { wolvesRelease } from '../data/wolves-story'

const legacyTrimmedBodyTimeline = [
  ['arthur-c-clarke-1', 0, 14.441591784338897],
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
  ['lorem-awakening-1', 220, 224.399809],
  ['do-not-reply', 224.399809, 228.112018],
  ['quote-unmarked-grave', 228.112018, 231.112018],
  ['quote-third-disciple', 231.112018, 234.143025],
  ['maintenance-window', 234.143025, 238.206856],
  ['quote-berkus', 238.206856, 242.175375],
  ['lorem-prologue-1', 242.175375, 247.487362],
  ['lorem-prologue-2', 247.487362, 256.03479],
  ['forbidden-factory', 256.03479, 260.308503],
  ['jordan-adrian', 260.308503, 268.224845],
  ['quote-childhoods-end-future', 268.224845, 271.224845],
  ['quote-natasha-woods', 271.224845, 274.224845],
  ['childhoods-end-wager', 274.224845, 279.943353],
  ['glorious-eggroll', 279.943353, 289.203231],
  ['project-neptune', 289.203231, 293.502459],
  ['john-seager', 293.502459, 304.455899],
  ['insertion-approved', 304.455899, 310.306754],
  ['laura-sherman-robert', 310.306754, 320.150583],
  ['natali-kat-mario', 320.150583, 327.327826],
  ['fyra-fyre-redactions', 327.327826, 331.098499],
  ['jordan-andy-model', 331.098499, 343.923904],
  ['preethi-lakshmi', 343.923904, 354.947016],
  ['andy-krook-kubesteller', 354.947016, 363.339493],
  ['openssf-reinforcements', 363.339493, 373.315756],
  ['ambers-garage-cloud-native-series', 373.315756, 380.400979],
  ['katie-neomuna', 380.400979, 389.243991],
  ['rafael-bluefin', 389.243991, 398],
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
      { id: 'insertion-approved', chapterId: 'awakening' },
      { id: 'laura-sherman-robert', chapterId: 'awakening' },
      { id: 'natali-kat-mario', chapterId: 'awakening' },
      { id: 'fyra-fyre-redactions', chapterId: 'awakening' },
      { id: 'jordan-andy-model', chapterId: 'awakening' },
      { id: 'preethi-lakshmi', chapterId: 'awakening' },
      { id: 'andy-krook-kubesteller', chapterId: 'awakening' },
      { id: 'openssf-reinforcements', chapterId: 'awakening' },
      { id: 'ambers-garage-cloud-native-series', chapterId: 'awakening' },
      { id: 'katie-neomuna', chapterId: 'awakening' },
      { id: 'rafael-bluefin', chapterId: 'awakening' },
    ])
  })

  it('preserves the approved first, middle, and final anchors', () => {
    expect(getNarrativeSlotForTime(0)).toMatchObject({
      artifactId: 'arthur-c-clarke-1',
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

  it('keeps every Track 0 slot at its approved trimmed-body boundaries', () => {
    expect(wolvesNarrativeTimeline.map(slot => [slot.artifactId, slot.startTime, slot.endTime]))
      .toEqual(legacyTrimmedBodyTimeline)
  })

  it('keeps each retimed post-Golden-Era slot between three and eighteen seconds', () => {
    const retimedSlots = wolvesNarrativeTimeline.filter(slot => slot.startTime >= 220 && slot.endTime <= 398)

    for (const slot of retimedSlots) {
      expect(slot.endTime - slot.startTime).toBeGreaterThanOrEqual(3)
      expect(slot.endTime - slot.startTime).toBeLessThanOrEqual(18)
    }
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
