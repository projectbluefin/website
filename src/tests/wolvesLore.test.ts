import { describe, expect, it } from 'vitest'
import { getChatlogLore, loreRecords } from '../components/wolves/lore'
import { wolvesRelease } from '../data/wolves-story'

describe('wolves Lore Parser', () => {
  it('should parse legacy single-newline speaker blocks correctly (The Garden Before Time)', () => {
    const record = loreRecords.find(record => record.id === 'ishtar-gardener-and-winnower')

    expect(record?.kind).toBe('source')
    if (record) {
      const ishtar = getChatlogLore(record)
      // It should have multiple messages, not just 1 monolithic block
      expect(ishtar.messages.length).toBeGreaterThan(1)
      expect(ishtar.messages[0].speaker).toBe('THE GARDENER')
      expect(ishtar.messages[0].text).toBe('I plant possibilities and watch what they become.')
      expect(ishtar.messages[1].speaker).toBe('THE WINNOWER')
      expect(ishtar.messages[1].text).toBe('I separate what can endure from what cannot.')
    }
  })

  it('should correctly parse <SFX> single-newline blocks', () => {
    const record = loreRecords.find(record => record.id === 'lorem-prologue-2')

    expect(record?.kind).toBe('chatlog')
    if (record) {
      const theChildren = getChatlogLore(record)
      // Check that SFX are present somewhere
      const hasSfx = theChildren.messages.some(m => m.isSfx)
      expect(hasSfx).toBe(true)
    }
  })

  it('keeps LoreRecord bodies byte-for-byte while adapting transcripts', () => {
    const record = loreRecords.find(record => record.id === 'lorem-prologue-1')
    const artifact = wolvesRelease.artifacts.find(artifact => artifact.id === 'lorem-prologue-1')

    expect(record?.body).toBe(artifact?.body)
  })

  it('parses speaker-only knocks and linked project tabs on the authored deployment chat', () => {
    const record = loreRecords.find(item => item.id === 'insertion-approved')
    const projectRecord = loreRecords.find(item => item.id === 'openssf-reinforcements')
    const kubestellerRecord = loreRecords.find(item => item.id === 'andy-krook-kubesteller')

    expect(record?.kind).toBe('chatlog')
    expect(projectRecord?.kind).toBe('chatlog')
    expect(kubestellerRecord?.kind).toBe('chatlog')
    if (!record || !projectRecord || !kubestellerRecord) {
      throw new Error('Expected authored deployment chats')
    }

    const insertion = getChatlogLore(record)
    const reinforcement = getChatlogLore(projectRecord)
    const kubesteller = getChatlogLore(kubestellerRecord)

    expect(insertion.messages).toContainEqual({
      speaker: 'sabot-6',
      text: '',
      timestamp: undefined,
      isSfx: undefined,
    })
    expect(insertion.messages.filter(message => message.isSfx).map(message => message.text)).toEqual([
      'knock the pod door',
      'agent, use a knocking on metal bulkhead sound here dramatically',
      'knock * * knock *',
      'agent, use a knocking on metal bulkhead sound here dramatically but twice',
    ])
    expect(kubesteller.projects).toBeUndefined()
    expect(reinforcement.projects?.map(project => project.id)).toEqual(['kubestellar', 'kubernetes'])
    expect(kubesteller.messages[1]?.text).toBe('I know it works you\'re complaining to the wrong guy. But man we gotta get moving. Projects team loves Kubesteller but there are over 240 of you —')
  })

  it('ingests the missing authored side conversations exactly, except ellipsis normalization', () => {
    const natali = loreRecords.find(item => item.id === 'natali-kat-mario')
    const jordan = loreRecords.find(item => item.id === 'jordan-andy-model')
    const amber = loreRecords.find(item => item.id === 'ambers-garage-cloud-native-series')
    const preethi = loreRecords.find(item => item.id === 'preethi-lakshmi')
    const fyre = loreRecords.find(item => item.id === 'fyra-fyre-redactions')

    expect(natali?.body).toContain('Look at how badass all these — sauropods are!')
    expect(natali?.body).toContain('these magnificent — CHONKERS.')
    expect(jordan?.body).toContain('It wasn\'t just Linux. Or buildstream It\'s —')
    expect(jordan?.body).toContain('she\'s acting like she runs the place — like she\'s —')
    expect(amber?.body).toContain('so how\'s this new — "cloud native series" gonna work?')
    expect(preethi?.body).toContain('Hah yes excellent, you are quite young, and the way you handled —')
    expect(fyre?.body.split('\n').filter(line => line.startsWith('**')).length).toBe(6)
  })
})
