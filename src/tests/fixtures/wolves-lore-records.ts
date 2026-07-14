import type { LoreFrontmatter, LoreKind, LoreRecord } from '../../data/wolves-lore-records'

function record(
  id: string,
  kind: LoreKind,
  metadata: Record<string, unknown>,
): LoreRecord {
  return {
    id,
    chapterId: 'test',
    relativePath: `./lore/${id}.md`,
    metadata: Object.freeze({ kind, ...metadata } as LoreFrontmatter),
    body: 'Test body.',
    kind,
    diagnostics: Object.freeze([]),
  }
}

export const wolvesLoreRecordFixtures = Object.freeze([
  record('news-record', 'news', {
    title: 'Test bulletin',
    timestamp: '2026-01-01',
    classification: 'Test classification',
  }),
  record('source-record', 'source', {
    title: 'Test source',
    channel: 'TEST//ARCHIVE',
    sender: 'Test source',
  }),
  record('field-report-record', 'field-report', {
    title: 'Test field report',
    sender: 'Test observer',
    location: 'Test location',
    subject: 'Test subject',
  }),
  record('location-record', 'location-dossier', {
    title: 'Test location',
    subject: 'subjectprofile/location-subject',
    location: 'Test location',
    classification: 'Test classification',
  }),
  record('guardian-subject', 'character-sheet', {
    title: 'Test Guardian',
    subject: 'subjectprofile/guardian-subject',
    subject_kind: 'person',
    aliases: ['Test alias'],
    titles: ['Test title'],
    guardian: {
      class: 'titan',
      super: 'Test super',
      specializations: ['controller', 'reconciler'],
    },
    relations: {
      dinosaur: 'subjectprofile/dinosaur-subject',
    },
  }),
  record('dinosaur-subject', 'character-sheet', {
    title: 'Test dinosaur',
    subject: 'subjectprofile/dinosaur-subject',
    subject_kind: 'dinosaur',
    epic_name: 'Test epic name',
    species: 'achillobator',
    relations: {
      riders: ['guardian-dinosaur'],
    },
  }),
  record('guardian-dinosaur', 'guardian-bond', {
    title: 'Test bond',
    relations: {
      guardian: 'subjectprofile/guardian-subject',
      dinosaur: 'subjectprofile/dinosaur-subject',
    },
  }),
])
