import { describe, expect, it } from 'vitest'
import {
  deriveLoreTelemetry,
  loadAllLoreRecords,
  parseLoreRecord,
  validateGuardianBonds,
} from '../data/wolves-lore-records'
import { wolvesRelease } from '../data/wolves-story'

describe('wolves lore records', () => {
  it('normalizes the legacy transmission kind to chatlog with a diagnostic', () => {
    const record = parseLoreRecord('lorem-prologue-1', 'prologue', './lore/lorem-prologue-1.md', [
      '---',
      'kind: transmission',
      'title: The Artifact',
      '---',
      '',
      '**SENDER**: body',
    ].join('\n'))

    expect(record.kind).toBe('chatlog')
    expect(record.diagnostics).toContain('kind "transmission" is a staged alias for "chatlog"')
  })

  it('keeps an authored body byte-for-byte after frontmatter parsing', () => {
    const raw = '---\ntitle: Record\n---\n\n**SENDER**: Do not rewrite this.'
    expect(parseLoreRecord('record', 'prologue', './lore/record.md', raw).body)
      .toBe('**SENDER**: Do not rewrite this.')
  })

  it('surfaces malformed YAML and non-mapping frontmatter', () => {
    expect(() => parseLoreRecord('invalid', 'prologue', './lore/invalid.md', '---\ntitle: [\n---\nbody'))
      .toThrow()
    expect(() => parseLoreRecord('unterminated', 'prologue', './lore/unterminated.md', '---\ntitle: ['))
      .toThrow('Lore front matter must close with "---"')
    expect(() => parseLoreRecord('list', 'prologue', './lore/list.md', '---\n- not\n- a mapping\n---\nbody'))
      .toThrow('Lore front matter must be a mapping')
  })

  it('rejects bare date scalar frontmatter', () => {
    expect(() => parseLoreRecord('date', 'prologue', './lore/date.md', '---\n2026-07-14\n---\nbody'))
      .toThrow('Lore front matter must be a mapping')
  })

  it('loads every staged record with authored identity taking precedence over its fallback', () => {
    const records = loadAllLoreRecords()
    const artifact = records.find(record => record.id === 'lorem-prologue-1')
    const fallbackRecord = records.find(record => record.id === 'forbidden-factory')

    expect(records).toHaveLength(32)
    expect(artifact).toMatchObject({
      chapterId: 'prologue',
      relativePath: './lore/lorem-prologue-1.md',
      kind: 'chatlog',
      metadata: {
        title: 'The Artifact',
        timestamp: '2326-06-16',
        channel: 'EXPLORATION//TEAM-ALPHA',
      },
    })
    expect(artifact?.diagnostics).toContain('frontmatter is missing kind')
    expect(fallbackRecord).toMatchObject({
      metadata: {
        title: 'Forbidden Factory',
        timestamp: '2326-07-09',
        channel: 'GNME-3//JORDAN//PRIVATE',
      },
    })
    expect(fallbackRecord?.diagnostics).toContain('frontmatter is missing title')
  })

  it('exposes normalized staged record identity through the Wolves release', () => {
    const record = loadAllLoreRecords().find(item => item.id === 'lorem-prologue-1')
    const artifact = wolvesRelease.artifacts.find(item => item.id === 'lorem-prologue-1')

    expect(artifact).toMatchObject({
      type: record?.kind,
      title: record?.metadata.title,
      publishedAt: record?.metadata.timestamp,
      channel: record?.metadata.channel,
      body: record?.body,
    })
  })

  it('derives deterministic FNV-1a telemetry from record identity', () => {
    const record = parseLoreRecord('record', 'prologue', './lore/record.md', 'body')

    expect(deriveLoreTelemetry(record)).toEqual({
      resourceName: 'lore-9e13a7a0',
      namespace: 'wolves-lore',
      controller: 'lore-indexer',
      archiveNode: 'archive-13a7a0',
      observedGeneration: 1,
      phase: 'Indexed',
      recordFingerprint: 'fnv1a:9e13a7a0',
    })
  })

  it('accepts only authored Guardian classes and dinosaur epic names', () => {
    const record = parseLoreRecord('dinosaur', 'chapter', './lore/dinosaur.md', [
      '---',
      'kind: character-sheet',
      'title: Subject',
      'epic_name: Author-provided name',
      'guardian:',
      '  class: titan',
      '  super: Author-provided super',
      '---',
      '',
      'Body',
    ].join('\n'))

    expect(record.metadata.epic_name).toBe('Author-provided name')
    expect(record.metadata.guardian?.class).toBe('titan')
    expect(record.metadata.guardian?.super).toBe('Author-provided super')
    expect(() => parseLoreRecord('invalid', 'chapter', './lore/invalid.md', '---\nkind: character-sheet\nguardian:\n  class: invalid\n---\n\nBody'))
      .toThrow('Lore front matter guardian class must be titan, warlock, or hunter')
    expect(() => parseLoreRecord('invalid-epic-name', 'chapter', './lore/invalid.md', '---\nepic_name: 1\n---\n\nBody'))
      .toThrow('Lore front matter field "epic_name" must be a string')
  })

  it('rejects a bond whose dinosaur does not list that bond as a rider', () => {
    const guardianRecord = parseLoreRecord('subjectprofile/kat-cosgrove', 'awakening', './lore/kat-cosgrove.md', [
      '---',
      'subject_kind: person',
      'relations:',
      '  dinosaur: subjectprofile/karl',
      '---',
      '',
    ].join('\n'))
    const dinosaurRecord = parseLoreRecord('subjectprofile/karl', 'awakening', './lore/karl.md', [
      '---',
      'subject_kind: dinosaur',
      'relations:',
      '  riders: []',
      '---',
      '',
    ].join('\n'))
    const bondRecord = parseLoreRecord('guardian-bond/kat-cosgrove-karl', 'awakening', './lore/kat-cosgrove-karl.md', [
      '---',
      'kind: guardian-bond',
      'relations:',
      '  guardian: subjectprofile/kat-cosgrove',
      '  dinosaur: subjectprofile/karl',
      '---',
      '',
    ].join('\n'))

    expect(() => validateGuardianBonds([guardianRecord, dinosaurRecord, bondRecord]))
      .toThrow('guardian-bond/kat-cosgrove-karl is missing from dinosaur riders')
  })
})
