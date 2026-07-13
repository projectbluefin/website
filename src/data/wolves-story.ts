export type WolvesArtifactType = 'transmission' | 'quote' | 'news' | 'source'

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

function parseBody(raw: string) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  return match ? match[2].trim() : raw.trim()
}

const loreFiles = import.meta.glob('./lore/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

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
  artifacts: [
    // --- Prologue: Arthur C. Clarke Quotes ---
    {
      id: 'arthur-c-clarke-4',
      chapterId: 'prologue',
      type: 'quote',
      publishedAt: '1953-07-09',
      title: 'Childhood\'s End',
      body: parseBody(loreFiles['./lore/arthur-c-clarke-4.md'] || ''),
      sourceLabel: 'Arthur C. Clarke — Childhood\'s End',
    },

    {
      id: 'arthur-c-clarke-1',
      chapterId: 'prologue',
      type: 'quote',
      publishedAt: '1953-07-09',
      title: 'Childhood\'s End',
      body: parseBody(loreFiles['./lore/arthur-c-clarke-1.md'] || ''),
      sourceLabel: 'Arthur C. Clarke — Childhood\'s End',
    },
    // --- Prologue: transmissions ---
    {
      id: 'lorem-prologue-1',
      channel: 'EXPLORATION//TEAM-ALPHA',
      chapterId: 'prologue',
      type: 'transmission',
      publishedAt: '2326-06-16',
      title: 'The Artifact',
      body: parseBody(loreFiles['./lore/lorem-prologue-1.md'] || ''),
    },
    {
      id: 'lorem-prologue-2',
      channel: 'EXPLORATION//TEAM-ALPHA',
      chapterId: 'prologue',
      type: 'transmission',
      publishedAt: '2326-06-17',
      title: 'The Children',
      body: parseBody(loreFiles['./lore/lorem-prologue-2.md'] || ''),
    },
    {
      id: 'forbidden-factory',
      channel: 'GNME-3//JORDAN//PRIVATE',
      chapterId: 'prologue',
      type: 'transmission',
      publishedAt: '2326-07-09',
      title: 'Forbidden Factory',
      body: parseBody(loreFiles['./lore/forbidden-factory.md'] || ''),
    },
    {
      id: 'maintenance-window',
      channel: 'RENNER//PRIVATE',
      chapterId: 'prologue',
      type: 'transmission',
      publishedAt: '2326-06-15',
      title: 'Maintenance Window',
      body: parseBody(loreFiles['./lore/maintenance-window.md'] || ''),
    },
    {
      id: 'arthur-c-clarke-2',
      chapterId: 'prologue',
      type: 'quote',
      publishedAt: '1953-07-09',
      title: 'Childhood\'s End',
      body: parseBody(loreFiles['./lore/arthur-c-clarke-2.md'] || ''),
      sourceLabel: 'Arthur C. Clarke — Childhood\'s End',
    },
    // --- Pursuit: transmissions ---
    {
      id: 'lorem-pursuit-1',
      channel: 'ANCIENT//RECORDS',
      chapterId: 'pursuit',
      type: 'transmission',
      publishedAt: '2326-05-26',
      title: 'The Golden Era',
      body: parseBody(loreFiles['./lore/lorem-pursuit-1.md'] || ''),
    },
    {
      id: 'do-not-reply',
      chapterId: 'pursuit',
      type: 'transmission',
      publishedAt: '2326-05-24',
      title: 'Do Not Reply',
      body: parseBody(loreFiles['./lore/do-not-reply.md'] || ''),
    },
    // --- Pursuit: quotes ---
    {
      id: 'quote-natasha-woods',
      chapterId: 'pursuit',
      type: 'quote',
      publishedAt: '2326-07-09',
      title: 'Marketing Material',
      body: parseBody(loreFiles['./lore/quote-natasha-woods.md'] || ''),
      sourceLabel: 'Natasha Woods VI — CNCF Marketing Material, Circa 2349',
    },
    {
      id: 'childhoods-end-wager',
      channel: 'ZONKER//ARCHIVE-033',
      chapterId: 'pursuit',
      type: 'transmission',
      publishedAt: '2326-07-09',
      title: 'The Wager',
      body: parseBody(loreFiles['./lore/childhoods-end-wager.md'] || ''),
    },
    {
      id: 'quote-childhoods-end-future',
      chapterId: 'pursuit',
      type: 'quote',
      publishedAt: '2326-07-09',
      title: 'Childhood\'s End',
      body: parseBody(loreFiles['./lore/quote-childhoods-end-future.md'] || ''),
    },
    {
      id: 'quote-berkus',
      chapterId: 'pursuit',
      type: 'quote',
      publishedAt: '2326-06-15',
      title: 'The Cosmos',
      body: parseBody(loreFiles['./lore/quote-berkus.md'] || ''),
      sourceLabel: 'Berkus the Wise — The Cosmos, Volume 3 (Blue Universal Red Letter Edition)',
    },
    {
      id: 'quote-unmarked-grave',
      chapterId: 'pursuit',
      type: 'quote',
      publishedAt: '2326-05-24',
      title: 'The Horror of Thousands',
      body: parseBody(loreFiles['./lore/quote-unmarked-grave.md'] || ''),
      sourceLabel: 'Unmarked Grave — Eulogy: The Horror of Thousands',
    },
    {
      id: 'quote-third-disciple',
      chapterId: 'pursuit',
      type: 'quote',
      publishedAt: '2326-05-25',
      title: 'The Chronicles of Blue Universal',
      body: parseBody(loreFiles['./lore/quote-third-disciple.md'] || ''),
      sourceLabel: 'Third Disciple of Renner — The Chronicles of Blue Universal',
    },
    {
      id: 'arthur-c-clarke-3',
      chapterId: 'prologue',
      type: 'quote',
      publishedAt: '1953-07-09',
      title: 'Childhood\'s End',
      body: parseBody(loreFiles['./lore/arthur-c-clarke-3.md'] || ''),
      sourceLabel: 'Arthur C. Clarke — Inspired by: Childhood\'s End',
    },
    // --- Awakening: archival transmissions ---
    {
      id: 'lorem-awakening-1',
      channel: 'SECURITY//INCIDENT',
      chapterId: 'awakening',
      type: 'transmission',
      publishedAt: '2326-01-02',
      title: 'Betrayal',
      body: parseBody(loreFiles['./lore/lorem-awakening-1.md'] || ''),
    },
    {
      id: 'glorious-eggroll',
      channel: 'NBR-3/0//GLORIOUS-EGGROLL//PRIVATE-LOG',
      chapterId: 'awakening',
      type: 'transmission',
      publishedAt: '2326-07-12',
      title: 'Glorious Eggroll',
      body: parseBody(loreFiles['./lore/glorious-eggroll.md'] || ''),
    },
    {
      id: 'john-seager',
      channel: 'UBUNTU//SECURE',
      chapterId: 'awakening',
      type: 'transmission',
      publishedAt: '2326-08-01',
      title: 'The Warthog and the Raptor',
      body: parseBody(loreFiles['./lore/john-seager.md'] || ''),
    },
    {
      id: 'reckoning-of-the-three',
      channel: 'HARBRINGER//ARCHIVE-01',
      chapterId: 'awakening',
      type: 'transmission',
      publishedAt: '2326-01-01',
      title: 'Reckoning of the Three',
      body: parseBody(loreFiles['./lore/reckoning-of-the-three.md'] || ''),
    },
    {
      id: 'committee-report-personal-transmission',
      channel: 'TOPH//ARCHIVE-072',
      chapterId: 'awakening',
      type: 'transmission',
      publishedAt: '2326-01-01',
      title: 'COMMITEE REPORT: Personal Transmission',
      body: parseBody(loreFiles['./lore/committee-report-personal-transmission.md'] || ''),
    },
    {
      id: 'john-bazzite-interview',
      channel: 'ZONKER//ARCHIVE-032',
      chapterId: 'awakening',
      type: 'news',
      publishedAt: '2326-01-01',
      title: 'John Bazzite Exclusive Interview',
      body: parseBody(loreFiles['./lore/john-bazzite-interview.md'] || ''),
    },
    // --- Source: Ishtar Collective / Unveiling (archival) ---
    {
      id: 'ishtar-gardener-and-winnower',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'The Garden Before Time',
      body: parseBody(loreFiles['./lore/ishtar-gardener-and-winnower.md'] || ''),
      sourceUrl: 'https://www.ishtar-collective.net/entries/gardener-and-winnower',
    },
    {
      id: 'ishtar-flower-game',
      channel: 'ISHTAR//UNVEILING-02',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'Rules of the Flower Game',
      body: parseBody(loreFiles['./lore/ishtar-flower-game.md'] || ''),
      sourceUrl: 'https://www.ishtar-collective.net/entries/the-flower-game',
    },
    {
      id: 'ishtar-first-knife',
      channel: 'ISHTAR//UNVEILING-03',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'The First Knife',
      body: parseBody(loreFiles['./lore/ishtar-first-knife.md'] || ''),
      sourceUrl: 'https://www.ishtar-collective.net/entries/the-first-knife',
    },
    {
      id: 'ishtar-the-wager',
      channel: 'ISHTAR//UNVEILING-04',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'The Wager',
      body: parseBody(loreFiles['./lore/ishtar-the-wager.md'] || ''),
      sourceUrl: 'https://www.ishtar-collective.net/entries/the-wager',
    },
    {
      id: 'ishtar-patternfall',
      channel: 'ISHTAR//UNVEILING-05',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'Patternfall',
      body: parseBody(loreFiles['./lore/ishtar-patternfall.md'] || ''),
      sourceUrl: 'https://www.ishtar-collective.net/entries/patternfall',

    },
    {
      id: 'ishtar-cambrian-explosion',
      channel: 'ISHTAR//UNVEILING-06',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'The Cambrian Explosion',
      body: parseBody(loreFiles['./lore/ishtar-cambrian-explosion.md'] || ''),
      sourceUrl: 'https://www.ishtar-collective.net/entries/the-cambrian-explosion',
    },
    {
      id: 'ishtar-final-shape',
      channel: 'ISHTAR//UNVEILING-07',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'The Final Shape',
      body: parseBody(loreFiles['./lore/ishtar-final-shape.md'] || ''),
      sourceUrl: 'https://www.ishtar-collective.net/entries/the-final-shape',
    },
    {
      id: 'blue-universal-acquires-wayland-yutani',
      chapterId: 'awakening',
      type: 'news',
      publishedAt: '2326-01-01',
      title: 'Blue Universal to Acquire Wayland-Yutani',
      body: parseBody(loreFiles['./lore/blue-universal-acquires-wayland-yutani.md'] || ''),
    },
  ],
}
