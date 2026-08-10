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
  it('keeps the approved ten concept paintings in exact order', () => {
    expect(DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => record.referenceId)).toEqual([
      'E1',
      'C1',
      'C2',
      'C3',
      'C4',
      'C9',
      'C6',
      'C5',
      'C7',
      'C10',
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
      expect(record.authoritativeSourceUrl).toMatch(/^https:\/\//)
      expect(record.upstreamAssetUrl).toMatch(/^https:\/\//)
      expect(new URL(record.upstreamAssetUrl).pathname).toMatch(/\.jpg$/)
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

      expect(record.artist).toBeNull()
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
      expect(record.referenceId).toMatch(/^(E1|C\d+)$/)
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

  it('records the largest approved ArtStation /4k/ source geometry (2200px wide) for C9 and C7', () => {
    const c9 = DIRECTORS_CUT_DESTINY_CONCEPTS.find(record => record.referenceId === 'C9')
    const c7 = DIRECTORS_CUT_DESTINY_CONCEPTS.find(record => record.referenceId === 'C7')

    expect(c9).toMatchObject({ sourceWidth: 2200, sourceHeight: 1123 })
    expect(c7).toMatchObject({ sourceWidth: 2200, sourceHeight: 1611 })
    expect(c9?.upstreamAssetUrl).toMatch(/\/4k\//)
    expect(c7?.upstreamAssetUrl).toMatch(/\/4k\//)
  })
})
