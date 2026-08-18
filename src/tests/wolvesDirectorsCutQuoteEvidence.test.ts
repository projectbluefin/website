import { describe, expect, it } from 'vitest'
import {
  DIRECTORS_CUT_QUOTE_EVIDENCE,
  findDirectorsCutQuoteEvidence,
} from '@/data/wolves-directors-cut-quote-evidence'
import { loadAllLoreRecords } from '@/data/wolves-lore-records'
import { wolvesRelease } from '@/data/wolves-story'

describe('director\'s cut quote-evidence ledger', () => {
  it('carries exactly the nine Director panel quotes in their registered order, matching the lore chapter', () => {
    const directorsCutQuoteIds = loadAllLoreRecords()
      .filter(record => record.chapterId === 'directors-cut')
      .map(record => record.id)

    expect(DIRECTORS_CUT_QUOTE_EVIDENCE).toHaveLength(9)
    expect(DIRECTORS_CUT_QUOTE_EVIDENCE.map(evidence => evidence.id)).toEqual(directorsCutQuoteIds)
    expect(new Set(DIRECTORS_CUT_QUOTE_EVIDENCE.map(evidence => evidence.id)).size).toBe(9)
  })

  it('records complete, non-empty evidence for every quote: work, edition/publication, locator, source URL, copyright status, and confidence', () => {
    for (const evidence of DIRECTORS_CUT_QUOTE_EVIDENCE) {
      expect(evidence.attribution.trim().length, evidence.id).toBeGreaterThan(0)
      expect(evidence.work.trim().length, evidence.id).toBeGreaterThan(0)
      expect(evidence.editionOrPublication.trim().length, evidence.id).toBeGreaterThan(0)
      expect(evidence.locator.trim().length, evidence.id).toBeGreaterThan(0)
      expect(evidence.sourceUrl, evidence.id).toMatch(/^https:\/\//)
      expect(evidence.copyrightStatus.trim().length, evidence.id).toBeGreaterThan(0)
      expect(['primary-print-scan', 'primary-web-publication', 'official-secondary-reproduction'], evidence.id)
        .toContain(evidence.verificationConfidence)
    }
  })

  it('matches the attribution and body of its own lore record exactly', () => {
    const records = loadAllLoreRecords()

    for (const evidence of DIRECTORS_CUT_QUOTE_EVIDENCE) {
      const record = records.find(item => item.id === evidence.id)
      if (!record) {
        throw new Error(`Expected a lore record for ${evidence.id}`)
      }

      expect(record.metadata.attribution, evidence.id).toBe(evidence.attribution)
      // The lore record's `context` field already carries "work, locator" as one
      // authored string (with its own quoting/punctuation choices). The
      // ledger's separated `work` field, and the trailing page/date marker of
      // its `locator` field, must both still appear inside that same authored
      // string (ignoring quote-mark punctuation) so the two surfaces cannot
      // silently drift onto different evidence.
      const stripQuotes = (value: string) => value.replace(/["']/g, '')
      const context = stripQuotes(record.metadata.context ?? '')
      const trailingLocatorMarker = stripQuotes(evidence.locator).split(',').pop()?.trim() ?? ''
      expect(context, evidence.id).toContain(stripQuotes(evidence.work))
      expect(context, evidence.id).toContain(trailingLocatorMarker)
    }
  })

  it('publishes the exact evidence source URL through the Wolves release artifact for every Director panel quote', () => {
    for (const evidence of DIRECTORS_CUT_QUOTE_EVIDENCE) {
      const artifact = wolvesRelease.artifacts.find(item => item.id === evidence.id)
      expect(artifact?.sourceUrl, evidence.id).toBe(evidence.sourceUrl)
    }
  })

  it('looks up a single quote\'s evidence by id and returns undefined for an unregistered id', () => {
    expect(findDirectorsCutQuoteEvidence('quote-sagan-extinction-forever')).toMatchObject({
      attribution: 'Carl Sagan',
      sourceUrl: 'https://books.google.com/books?id=a2iouZybD8sC&pg=PA204&dq=%22Extinction+is+forever%22',
    })
    expect(findDirectorsCutQuoteEvidence('quote-not-registered')).toBeUndefined()
  })

  it('keeps the excluded Dune and Tolkien research candidates out of the approved ledger', () => {
    const attributions = DIRECTORS_CUT_QUOTE_EVIDENCE.map(evidence => evidence.attribution)
    expect(attributions).not.toContain('Frank Herbert')
    expect(attributions).not.toContain('J.R.R. Tolkien')
  })
})
