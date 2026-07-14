import { describe, expect, it } from 'vitest'
import { loadAllLoreRecords, parseLoreRecord } from '../data/wolves-lore-records'
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
})
