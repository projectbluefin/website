import type { LoreKind, LoreRecord } from './wolves-lore-records'
import { loadAllLoreRecords } from './wolves-lore-records'

export type WolvesArtifactType = LoreKind

export interface WolvesChapter {
  id: string
  title: string
  description: string
  pageStart: number
  pageEnd: number
  soundtrackLabel: string
}

export interface WolvesArtifact {
  id: string
  chapterId: string
  type: WolvesArtifactType
  publishedAt: string
  title: string
  body: string
  sourceUrl?: string
  sourceLabel?: string
  channel?: string
}

export interface WolvesRelease {
  id: string
  publishedAt: string
  chapters: WolvesChapter[]
  artifacts: WolvesArtifact[]
}

interface ArtifactSource {
  sourceLabel?: string
  sourceUrl?: string
}

const artifactSources: Readonly<Record<string, ArtifactSource>> = {
  'arthur-c-clarke-4': { sourceLabel: 'Arthur C. Clarke — Childhood\'s End' },
  'arthur-c-clarke-1': { sourceLabel: 'Arthur C. Clarke — Childhood\'s End' },
  'arthur-c-clarke-3': { sourceLabel: 'Arthur C. Clarke — Inspired by: Childhood\'s End' },
  'quote-natasha-woods': { sourceLabel: 'Natasha Woods VI — CNCF Marketing Material, Circa 2349' },
  'quote-berkus': { sourceLabel: 'Berkus the Wise — The Cosmos, Volume 3 (Blue Universal Red Letter Edition)' },
  'quote-unmarked-grave': { sourceLabel: 'Unmarked Grave — Eulogy: The Horror of Thousands' },
  'quote-third-disciple': { sourceLabel: 'Third Disciple of Renner — The Chronicles of Blue Universal' },
  'ishtar-gardener-and-winnower': { sourceUrl: 'https://www.ishtar-collective.net/entries/gardener-and-winnower' },
  'ishtar-flower-game': { sourceUrl: 'https://www.ishtar-collective.net/entries/the-flower-game' },
  'ishtar-first-knife': { sourceUrl: 'https://www.ishtar-collective.net/entries/the-first-knife' },
  'ishtar-the-wager': { sourceUrl: 'https://www.ishtar-collective.net/entries/the-wager' },
  'ishtar-patternfall': { sourceUrl: 'https://www.ishtar-collective.net/entries/patternfall' },
  'ishtar-cambrian-explosion': { sourceUrl: 'https://www.ishtar-collective.net/entries/the-cambrian-explosion' },
  'ishtar-final-shape': { sourceUrl: 'https://www.ishtar-collective.net/entries/the-final-shape' },
}

function requiredMetadata(record: LoreRecord, field: 'title' | 'timestamp'): string {
  const value = record.metadata[field]
  if (value === undefined) {
    throw new TypeError(`Lore record "${record.id}" is missing ${field}`)
  }
  return value
}

function loadArtifact(record: LoreRecord): WolvesArtifact {
  return {
    id: record.id,
    chapterId: record.chapterId,
    type: record.kind,
    publishedAt: requiredMetadata(record, 'timestamp'),
    title: requiredMetadata(record, 'title'),
    body: record.body,
    channel: record.metadata.channel,
    ...artifactSources[record.id],
  }
}

export const wolvesRelease: WolvesRelease = {
  id: '2026-07-11-r1',
  publishedAt: '2026-07-11',
  chapters: [
    {
      id: 'prologue',
      title: 'The Kube',
      description: 'Who left this here?',
      pageStart: 1,
      pageEnd: 7,
      soundtrackLabel: 'The Kube',
    },
    {
      id: 'pursuit',
      title: 'The Illustrius',
      description: 'The maintainers are gods.',
      pageStart: 8,
      pageEnd: 14,
      soundtrackLabel: 'Pressure',
    },
    {
      id: 'awakening',
      title: 'The Wolves',
      description: 'The maintainers are the hunted.',
      pageStart: 15,
      pageEnd: 20,
      soundtrackLabel: 'Resistance',
    },
  ],
  artifacts: loadAllLoreRecords().map(loadArtifact),
}
