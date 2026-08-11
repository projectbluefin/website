import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BUNGIE_FAN_CONTENT_POLICY_URL,
  BUNGIE_RIGHTS_HOLDER,
  DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT,
  DIRECTORS_CUT_DESTINY_CONCEPT_RETRIEVAL_DATE,
  DIRECTORS_CUT_DESTINY_CONCEPTS,
} from '@/data/wolves-directors-cut-artwork'

function readJpegDimensions(path: string): { width: number, height: number } {
  const buffer = readFileSync(path)
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    throw new Error(`Expected JPEG file: ${path}`)
  }

  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) {
      offset++
      continue
    }

    const marker = buffer[offset + 1]
    const size = buffer.readUInt16BE(offset + 2)
    const isStartOfFrame = [
      0xC0,
      0xC1,
      0xC2,
      0xC3,
      0xC5,
      0xC6,
      0xC7,
      0xC9,
      0xCA,
      0xCB,
      0xCD,
      0xCE,
      0xCF,
    ].includes(marker)

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }

    offset += size + 2
  }

  throw new Error(`Could not find JPEG dimensions in ${path}`)
}

describe('director\'s cut Destiny concept-art registry', () => {
  it('keeps the approved paintings in exact montage order', () => {
    // Registry order *is* the montage order - `painting(index)` in the shot
    // list schedules straight off this array - so this assertion is the running
    // order of Act I, not bookkeeping. Earth devastation first, the Mars ruin
    // to close it out, then Europa as the cold arrival.
    expect(DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.referenceId)).toEqual([
      'SPACE-1',
      'EARTH-GOLD',
      'EARTH-1',
      'EARTH-2',
      'EARTH-3',
      'EARTH-4',
      'EARTH-5',
      'EARTH-6',
      'EARTH-7',
      'EARTH-8',
      'EARTH-9',
      'C2',
      'E1',
    ])
  })

  it('uses stable ids and unique local files for every selected painting', () => {
    const ids = DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.id)
    const paths = DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.localPath)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(paths).size).toBe(paths.length)

    for (const record of DIRECTORS_CUT_DESTINY_CONCEPTS) {
      expect(record.id).toMatch(/^destiny-concepts\//)
      expect(record.localPath).toBe(`wolves-intro/destiny-concepts/${record.filename}`)
    }
  })

  it('carries the complete provenance ledger, shared credit, and accessible figure metadata', () => {
    expect(DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT)
      .toBe('Destiny 2 and related artwork © Bungie, Inc. Environment concept art by the credited artists.')

    for (const record of DIRECTORS_CUT_DESTINY_CONCEPTS) {
      expect(record.workTitle.trim().length).toBeGreaterThan(0)
      expect(record.backgroundFigure.credit).toBe(DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT)
      expect(record.backgroundFigure.label).toContain(record.workTitle)
      // Owner-supplied local art has no upstream page to cite, and the ledger
      // says so rather than inventing one. Everything retrieved from a public
      // source still has to carry a real, re-checkable URL.
      if ('upstreamAssetUrl' in record) {
        expect(record.authoritativeSourceUrl).toMatch(/^https:\/\//)
        expect(record.upstreamAssetUrl).toMatch(/^https:\/\//)
        expect(new URL(record.upstreamAssetUrl).pathname).toMatch(/\.jpg$/)
      }
      else {
        expect(record.provenance).toBe('owner-supplied-local')
        expect(record.provenanceNote.trim().length).toBeGreaterThan(0)
        expect(record.rightsHolder).toBe(BUNGIE_RIGHTS_HOLDER)
      }
      expect(record.retrievalDate).toBe(DIRECTORS_CUT_DESTINY_CONCEPT_RETRIEVAL_DATE)
      expect(record.policyUrl).toBe(BUNGIE_FAN_CONTENT_POLICY_URL)
      expect(record.usageBasis).toBe('non-commercial-fan-content')
    }
  })

  it('requires either an exact artist or an explicit documented uncredited state', () => {
    for (const record of DIRECTORS_CUT_DESTINY_CONCEPTS) {
      if (record.artistCreditState === 'exact') {
        expect(record.artist.trim().length).toBeGreaterThan(0)
        expect(record.backgroundFigure.label).toContain(record.artist)
        continue
      }

      // An owner-supplied file names its artist only as strongly as the
      // evidence allows: `filename-asserted` when the supplied filename says
      // so, `unattributed` when nothing does. Neither may claim `exact`.
      if (record.artistCreditState === 'filename-asserted') {
        expect(record.artist?.trim().length ?? 0).toBeGreaterThan(0)
        expect(record.backgroundFigure.label).toContain(record.artist)
        expect(record.provenanceNote).toMatch(/filename asserts/i)
        continue
      }

      expect(record.artist).toBeNull()

      if (record.artistCreditState !== 'uncredited') {
        expect(record.provenanceNote).toMatch(/not guessed/i)
        expect(record.backgroundFigure.label).toContain('uncredited')
        continue
      }

      expect(record.sourceName).toBe('Bungie Press Room')
      expect(record.rightsHolder).toBe(BUNGIE_RIGHTS_HOLDER)
      expect(record.artistCreditNote).toMatch(/do not attribute this exact press image to a single named artist/i)
      expect(record.backgroundFigure.label).toContain('uncredited')
    }
  })

  it('models E1 as an explicit uncredited Bungie press-room image', () => {
    const europaPressImage = DIRECTORS_CUT_DESTINY_CONCEPTS.find(record => record.referenceId === 'E1')
    if (!europaPressImage || europaPressImage.artistCreditState !== 'uncredited') {
      throw new Error('Expected E1 to be modeled as an explicit uncredited record')
    }

    expect(europaPressImage).toEqual(expect.objectContaining({
      artist: null,
      sourceName: 'Bungie Press Room',
      rightsHolder: BUNGIE_RIGHTS_HOLDER,
      backgroundFigure: {
        label: 'Europa environment concept art from Bungie Press Room, individual artist uncredited',
        credit: DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT,
      },
    }))
  })

  it('keeps gameplay and render picks out of the montage allowlist', () => {
    for (const record of DIRECTORS_CUT_DESTINY_CONCEPTS) {
      expect(record.referenceId).toMatch(/^(E1|C\d+|SPACE-\d+|EARTH-(\d+|GOLD))$/)
      expect(record.referenceId).not.toMatch(/^[GR]/)
      expect(record.id).not.toMatch(/gameplay|render/i)
      expect(record.localPath).not.toMatch(/gameplay|render/i)
    }
  })

  it('references downloaded local JPEGs that exist, are non-empty, and match the ledger\'s recorded source geometry exactly', () => {
    for (const record of DIRECTORS_CUT_DESTINY_CONCEPTS) {
      const absolute = resolve(process.cwd(), 'public', record.localPath)

      expect(existsSync(absolute), `${record.localPath} should exist`).toBe(true)
      expect(statSync(absolute).size, `${record.localPath} should be non-empty`).toBeGreaterThan(0)

      const { width, height } = readJpegDimensions(absolute)
      // Compare against the ledger's expected geometry, not merely "> 0", so a
      // silently truncated or swapped download fails the test even though the
      // file still decodes as a valid nonzero-size JPEG.
      expect(width, `${record.localPath} width should match the recorded source geometry`).toBe(record.sourceWidth)
      expect(height, `${record.localPath} height should match the recorded source geometry`).toBe(record.sourceHeight)
    }
  })

  it('retrieves every upstream-sourced record at a projector-worthy size', () => {
    // This used to pin C9 and C7 to a literal 2200x1123 and 2200x1611 and to an
    // ArtStation `/4k/` path. Both records have since been cut - C7 for showing
    // the threat, C9 in the cityscape pass - and a test written against two
    // specific ids protects nothing once they are gone. The rule underneath it
    // is what mattered: anything pulled from a public page is pulled at the
    // largest variant that page offers, because this is projected.
    const upstream = DIRECTORS_CUT_DESTINY_CONCEPTS.filter(record => 'upstreamAssetUrl' in record)

    expect(upstream.length).toBeGreaterThan(0)
    for (const record of upstream) {
      expect(record.sourceWidth, record.id).toBeGreaterThanOrEqual(1920)
      expect(record.sourceHeight, record.id).toBeGreaterThanOrEqual(1000)
    }
  })

  it('never readmits a record cut for showing the threat', () => {
    // The owner's rule for this montage is that the threat is never seen:
    // no Traveler, no aliens, no alien architecture or ships, nothing an
    // audience can name as Destiny on sight (2026-08-10). These six records
    // were cut under it, and this test is what stops a later session quietly
    // restoring one because it looked good in isolation.
    const cutForShowingTheThreat = [
      'destiny-concepts/c6-fallen-citadel',
      'destiny-concepts/c5-ice-shelf-shapes',
      'destiny-concepts/c10-crash',
      'destiny-concepts/c7-early-throne-world-citadel',
      'destiny-concepts/c4-cryovolcanoes',
      'destiny-concepts/c3-early-europa-concept',
      'destiny-concepts/c9-mars-farm-collapse',
      'destiny-concepts/c1-europa-landscape-v1',
    ]

    for (const id of cutForShowingTheThreat) {
      expect(DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.id)).not.toContain(id)
    }
  })

  it('holds Europa back to the end of the prologue', () => {
    // "save europa for the end except for the bluefin title slide" - owner,
    // 2026-08-10. Europa is the cold arrival after Earth is gone, so its
    // records must be the last ones in registry order; the montage schedules
    // by index, so a Europa record sitting mid-list would put ice back into
    // Act I without anybody editing the shot list.
    const europaIndexes = DIRECTORS_CUT_DESTINY_CONCEPTS
      .map((record, index) => ({ index, europa: /europa/i.test(record.id) }))
      .filter(entry => entry.europa)
      .map(entry => entry.index)

    expect(europaIndexes.length).toBeGreaterThan(0)

    const tail = DIRECTORS_CUT_DESTINY_CONCEPTS.length - europaIndexes.length
    expect(Math.min(...europaIndexes)).toBe(tail)
  })
})
