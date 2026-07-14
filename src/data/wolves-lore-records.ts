import { load as loadYaml } from 'js-yaml'

export type LoreKind
  = | 'chatlog'
    | 'character-sheet'
    | 'field-report'
    | 'location-dossier'
    | 'guardian-bond'
    | 'news'
    | 'source'
    | 'quote'

export type GuardianSpecialization = 'controller' | 'operator' | 'reconciler'

export interface LoreFrontmatter {
  kind?: LoreKind | 'transmission'
  title?: string
  timestamp?: string
  channel?: string
  classification?: string
  sender?: string
  recipient?: string
  location?: string
  subject?: string
  subject_kind?: 'person' | 'dinosaur' | 'location' | 'record'
  affiliation?: string
  aliases?: readonly string[]
  titles?: readonly string[]
  species?: string
  guardian?: {
    public_designation?: 'Guardian'
    internal_designation?: 'Maintainer'
    specializations?: readonly GuardianSpecialization[]
  }
  relations?: {
    dinosaur?: string
    riders?: readonly string[]
    guardian?: string
  }
  _editor_prompt?: string
}

export interface LoreRecord {
  id: string
  chapterId: string
  relativePath: string
  metadata: Readonly<LoreFrontmatter>
  body: string
  kind: LoreKind
  diagnostics: readonly string[]
}

export interface LegacyLoreIdentity {
  kind: LoreKind
  title: string
  timestamp?: string
  channel?: string
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringField(metadata: Record<string, unknown>, field: string): string | undefined {
  const value = metadata[field]
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new TypeError(`Lore front matter field "${field}" must be a string`)
  }
  return value
}

function stringArrayField(metadata: Record<string, unknown>, field: 'aliases' | 'titles'): readonly string[] | undefined {
  const value = metadata[field]
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new TypeError(`Lore front matter field "${field}" must be an array of strings`)
  }
  return Object.freeze([...value])
}

function parseGuardian(value: unknown): LoreFrontmatter['guardian'] {
  if (value === undefined) {
    return undefined
  }
  if (!isMapping(value)) {
    throw new TypeError('Lore front matter field "guardian" must be a mapping')
  }

  const publicDesignation = value.public_designation
  const internalDesignation = value.internal_designation
  const specializations = value.specializations
  if (publicDesignation !== undefined && publicDesignation !== 'Guardian') {
    throw new TypeError('Lore front matter guardian.public_designation must be "Guardian"')
  }
  if (internalDesignation !== undefined && internalDesignation !== 'Maintainer') {
    throw new TypeError('Lore front matter guardian.internal_designation must be "Maintainer"')
  }
  if (
    specializations !== undefined
    && (!Array.isArray(specializations)
      || specializations.some(item => item !== 'controller' && item !== 'operator' && item !== 'reconciler'))
  ) {
    throw new TypeError('Lore front matter guardian.specializations must be valid specializations')
  }

  return Object.freeze({
    public_designation: publicDesignation,
    internal_designation: internalDesignation,
    specializations: specializations === undefined ? undefined : Object.freeze([...specializations]),
  })
}

function parseRelations(value: unknown): LoreFrontmatter['relations'] {
  if (value === undefined) {
    return undefined
  }
  if (!isMapping(value)) {
    throw new TypeError('Lore front matter field "relations" must be a mapping')
  }

  const dinosaur = value.dinosaur
  const riders = value.riders
  const guardian = value.guardian
  if (dinosaur !== undefined && typeof dinosaur !== 'string') {
    throw new TypeError('Lore front matter relations.dinosaur must be a string')
  }
  if (!Array.isArray(riders) && riders !== undefined) {
    throw new TypeError('Lore front matter relations.riders must be an array of strings')
  }
  if (Array.isArray(riders) && riders.some(item => typeof item !== 'string')) {
    throw new TypeError('Lore front matter relations.riders must be an array of strings')
  }
  if (guardian !== undefined && typeof guardian !== 'string') {
    throw new TypeError('Lore front matter relations.guardian must be a string')
  }

  return Object.freeze({
    dinosaur,
    riders: riders === undefined ? undefined : Object.freeze([...riders]),
    guardian,
  })
}

function parseFrontmatter(relativePath: string, raw: string): { metadata: LoreFrontmatter, body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/)
  if (!match) {
    if (raw.startsWith('---\n') || raw.startsWith('---\r\n')) {
      throw new TypeError('Lore front matter must close with "---"')
    }
    return { metadata: {}, body: raw }
  }

  const loaded = loadYaml(match[1], { filename: relativePath })
  if (!isMapping(loaded)) {
    throw new TypeError('Lore front matter must be a mapping')
  }

  const kind = loaded.kind
  if (
    kind !== undefined
    && kind !== 'transmission'
    && kind !== 'chatlog'
    && kind !== 'character-sheet'
    && kind !== 'field-report'
    && kind !== 'location-dossier'
    && kind !== 'guardian-bond'
    && kind !== 'news'
    && kind !== 'source'
    && kind !== 'quote'
  ) {
    throw new TypeError('Lore front matter field "kind" must be a valid lore kind')
  }

  const subjectKind = loaded.subject_kind
  if (
    subjectKind !== undefined
    && subjectKind !== 'person'
    && subjectKind !== 'dinosaur'
    && subjectKind !== 'location'
    && subjectKind !== 'record'
  ) {
    throw new TypeError('Lore front matter field "subject_kind" must be a valid subject kind')
  }

  return {
    metadata: {
      kind,
      title: stringField(loaded, 'title'),
      timestamp: stringField(loaded, 'timestamp') ?? stringField(loaded, 'date'),
      channel: stringField(loaded, 'channel'),
      classification: stringField(loaded, 'classification'),
      sender: stringField(loaded, 'sender'),
      recipient: stringField(loaded, 'recipient'),
      location: stringField(loaded, 'location'),
      subject: stringField(loaded, 'subject'),
      subject_kind: subjectKind,
      affiliation: stringField(loaded, 'affiliation'),
      aliases: stringArrayField(loaded, 'aliases'),
      titles: stringArrayField(loaded, 'titles'),
      species: stringField(loaded, 'species'),
      guardian: parseGuardian(loaded.guardian),
      relations: parseRelations(loaded.relations),
      _editor_prompt: stringField(loaded, '_editor_prompt'),
    },
    body: match[2].replace(/^\r?\n/, ''),
  }
}

export function parseLoreRecord(
  id: string,
  chapterId: string,
  relativePath: string,
  raw: string,
  legacyFallback?: Readonly<LegacyLoreIdentity>,
): LoreRecord {
  const { metadata: authoredMetadata, body } = parseFrontmatter(relativePath, raw)
  const metadata = {
    ...legacyFallback,
    ...Object.fromEntries(Object.entries(authoredMetadata).filter(([, value]) => value !== undefined)),
  }
  const diagnostics = [
    ...(authoredMetadata.kind === undefined ? ['frontmatter is missing kind'] : []),
    ...(authoredMetadata.title === undefined ? ['frontmatter is missing title'] : []),
    ...(legacyFallback?.timestamp !== undefined && authoredMetadata.timestamp === undefined
      ? ['frontmatter is missing timestamp']
      : []),
    ...(legacyFallback?.channel !== undefined && authoredMetadata.channel === undefined
      ? ['frontmatter is missing channel']
      : []),
    ...(authoredMetadata.kind === 'transmission'
      ? ['kind "transmission" is a staged alias for "chatlog"']
      : []),
  ]
  const kind = authoredMetadata.kind === 'transmission' ? 'chatlog' : metadata.kind

  return {
    id,
    chapterId,
    relativePath,
    metadata: Object.freeze(metadata),
    body,
    kind: kind ?? 'chatlog',
    diagnostics: Object.freeze(diagnostics),
  }
}

interface LoreManifestEntry {
  id: string
  chapterId: string
  relativePath: string
  legacyFallback: LegacyLoreIdentity
}

const loreManifest = [
  { id: 'arthur-c-clarke-4', chapterId: 'prologue', relativePath: './lore/arthur-c-clarke-4.md', legacyFallback: { kind: 'quote', title: 'Childhood\'s End', timestamp: '1953-07-09' } },
  { id: 'lorem-prologue-1', chapterId: 'prologue', relativePath: './lore/lorem-prologue-1.md', legacyFallback: { kind: 'chatlog', title: 'The Artifact', timestamp: '2326-06-16', channel: 'EXPLORATION//TEAM-ALPHA' } },
  { id: 'arthur-c-clarke-1', chapterId: 'prologue', relativePath: './lore/arthur-c-clarke-1.md', legacyFallback: { kind: 'quote', title: 'Childhood\'s End', timestamp: '1953-07-09' } },
  { id: 'lorem-prologue-2', chapterId: 'prologue', relativePath: './lore/lorem-prologue-2.md', legacyFallback: { kind: 'chatlog', title: 'The Children', timestamp: '2326-06-17', channel: 'EXPLORATION//TEAM-ALPHA' } },
  { id: 'arthur-c-clarke-2', chapterId: 'prologue', relativePath: './lore/arthur-c-clarke-2.md', legacyFallback: { kind: 'quote', title: 'Childhood\'s End', timestamp: '1953-07-09' } },
  { id: 'forbidden-factory', chapterId: 'prologue', relativePath: './lore/forbidden-factory.md', legacyFallback: { kind: 'chatlog', title: 'Forbidden Factory', timestamp: '2326-07-09', channel: 'GNME-3//JORDAN//PRIVATE' } },
  { id: 'jordan-adrian', chapterId: 'prologue', relativePath: './lore/sidebar-comm-forbidden-factory-14.md', legacyFallback: { kind: 'chatlog', title: 'Forbidden Factory', timestamp: '2326-07-09', channel: 'GNME-3//JORDAN//PRIVATE' } },
  { id: 'arthur-c-clarke-3', chapterId: 'prologue', relativePath: './lore/arthur-c-clarke-3.md', legacyFallback: { kind: 'quote', title: 'Childhood\'s End', timestamp: '1953-07-09' } },
  { id: 'maintenance-window', chapterId: 'prologue', relativePath: './lore/maintenance-window.md', legacyFallback: { kind: 'chatlog', title: 'Maintenance Window', timestamp: '2326-06-15', channel: 'RENNER//PRIVATE' } },
  { id: 'quote-childhoods-end-future', chapterId: 'pursuit', relativePath: './lore/quote-childhoods-end-future.md', legacyFallback: { kind: 'quote', title: 'Childhood\'s End', timestamp: '2326-07-09' } },
  { id: 'lorem-pursuit-1', chapterId: 'pursuit', relativePath: './lore/lorem-pursuit-1.md', legacyFallback: { kind: 'chatlog', title: 'The Golden Era', timestamp: '2326-05-26', channel: 'ANCIENT//RECORDS' } },
  { id: 'quote-natasha-woods', chapterId: 'pursuit', relativePath: './lore/quote-natasha-woods.md', legacyFallback: { kind: 'quote', title: 'Marketing Material', timestamp: '2326-07-09' } },
  { id: 'do-not-reply', chapterId: 'pursuit', relativePath: './lore/do-not-reply.md', legacyFallback: { kind: 'chatlog', title: 'Do Not Reply', timestamp: '2326-05-24' } },
  { id: 'quote-berkus', chapterId: 'pursuit', relativePath: './lore/quote-berkus.md', legacyFallback: { kind: 'quote', title: 'The Cosmos', timestamp: '2326-06-15' } },
  { id: 'childhoods-end-wager', chapterId: 'pursuit', relativePath: './lore/childhoods-end-wager.md', legacyFallback: { kind: 'chatlog', title: 'The Wager', timestamp: '2326-07-09', channel: 'ZONKER//ARCHIVE-033' } },
  { id: 'quote-unmarked-grave', chapterId: 'pursuit', relativePath: './lore/quote-unmarked-grave.md', legacyFallback: { kind: 'quote', title: 'The Horror of Thousands', timestamp: '2326-05-24' } },
  { id: 'quote-third-disciple', chapterId: 'pursuit', relativePath: './lore/quote-third-disciple.md', legacyFallback: { kind: 'quote', title: 'The Chronicles of Blue Universal', timestamp: '2326-05-25' } },
  { id: 'lorem-awakening-1', chapterId: 'awakening', relativePath: './lore/lorem-awakening-1.md', legacyFallback: { kind: 'chatlog', title: 'Betrayal', timestamp: '2326-01-02', channel: 'SECURITY//INCIDENT' } },
  { id: 'ishtar-gardener-and-winnower', chapterId: 'awakening', relativePath: './lore/ishtar-gardener-and-winnower.md', legacyFallback: { kind: 'source', title: 'The Garden Before Time', timestamp: '2326-01-01' } },
  { id: 'glorious-eggroll', chapterId: 'awakening', relativePath: './lore/glorious-eggroll.md', legacyFallback: { kind: 'chatlog', title: 'Glorious Eggroll', timestamp: '2326-07-12', channel: 'NBR-3/0//GLORIOUS-EGGROLL//PRIVATE-LOG' } },
  { id: 'ishtar-flower-game', chapterId: 'awakening', relativePath: './lore/ishtar-flower-game.md', legacyFallback: { kind: 'source', title: 'Rules of the Flower Game', timestamp: '2326-01-01', channel: 'ISHTAR//UNVEILING-02' } },
  { id: 'project-neptune', chapterId: 'awakening', relativePath: './lore/project-neptune.md', legacyFallback: { kind: 'chatlog', title: 'Project Neptune', timestamp: '2326-07-15', channel: 'BLUE-UNIVERSAL//PRJ-TM//DIRECTIVE' } },
  { id: 'ishtar-first-knife', chapterId: 'awakening', relativePath: './lore/ishtar-first-knife.md', legacyFallback: { kind: 'source', title: 'The First Knife', timestamp: '2326-01-01', channel: 'ISHTAR//UNVEILING-03' } },
  { id: 'john-seager', chapterId: 'awakening', relativePath: './lore/john-seager.md', legacyFallback: { kind: 'chatlog', title: 'The Warthog and the Raptor', timestamp: '2326-08-01', channel: 'UBUNTU//SECURE' } },
  { id: 'ishtar-the-wager', chapterId: 'awakening', relativePath: './lore/ishtar-the-wager.md', legacyFallback: { kind: 'source', title: 'The Wager', timestamp: '2326-01-01', channel: 'ISHTAR//UNVEILING-04' } },
  { id: 'reckoning-of-the-three', chapterId: 'awakening', relativePath: './lore/reckoning-of-the-three.md', legacyFallback: { kind: 'chatlog', title: 'Reckoning of the Three', timestamp: '2326-01-01', channel: 'HARBRINGER//ARCHIVE-01' } },
  { id: 'ishtar-patternfall', chapterId: 'awakening', relativePath: './lore/ishtar-patternfall.md', legacyFallback: { kind: 'source', title: 'Patternfall', timestamp: '2326-01-01', channel: 'ISHTAR//UNVEILING-05' } },
  { id: 'committee-report-personal-transmission', chapterId: 'awakening', relativePath: './lore/committee-report-personal-transmission.md', legacyFallback: { kind: 'chatlog', title: 'COMMITEE REPORT: Personal Transmission', timestamp: '2326-01-01', channel: 'TOPH//ARCHIVE-072' } },
  { id: 'ishtar-cambrian-explosion', chapterId: 'awakening', relativePath: './lore/ishtar-cambrian-explosion.md', legacyFallback: { kind: 'source', title: 'The Cambrian Explosion', timestamp: '2326-01-01', channel: 'ISHTAR//UNVEILING-06' } },
  { id: 'john-bazzite-interview', chapterId: 'awakening', relativePath: './lore/john-bazzite-interview.md', legacyFallback: { kind: 'news', title: 'John Bazzite Exclusive Interview', timestamp: '2326-01-01', channel: 'ZONKER//ARCHIVE-032' } },
  { id: 'ishtar-final-shape', chapterId: 'awakening', relativePath: './lore/ishtar-final-shape.md', legacyFallback: { kind: 'source', title: 'The Final Shape', timestamp: '2326-01-01', channel: 'ISHTAR//UNVEILING-07' } },
  { id: 'blue-universal-acquires-wayland-yutani', chapterId: 'awakening', relativePath: './lore/blue-universal-acquires-wayland-yutani.md', legacyFallback: { kind: 'news', title: 'Blue Universal to Acquire Wayland-Yutani', timestamp: '2326-01-01' } },
] as const satisfies readonly LoreManifestEntry[]

const loreFiles = import.meta.glob('./lore/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export function loadAllLoreRecords(): readonly LoreRecord[] {
  return Object.freeze(loreManifest.map(({ id, chapterId, relativePath, legacyFallback }) => {
    const raw = loreFiles[relativePath]
    if (raw === undefined) {
      throw new Error(`Missing staged lore file "${relativePath}"`)
    }
    return parseLoreRecord(id, chapterId, relativePath, raw, legacyFallback)
  }))
}
