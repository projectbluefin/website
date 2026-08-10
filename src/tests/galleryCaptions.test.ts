import { describe, expect, it } from 'vitest'
import { formatGalleryCaption, getGalleryCaptionLabel } from '@/data/gallery-captions'

describe('formatGalleryCaption', () => {
  it('reads the event, session and date out of a CNCF export filename', () => {
    expect(formatGalleryCaption('KC+CNC_EU_240319_KCS_GroupPhoto_MN_001'))
      .toBe('KubeCon EU · Contributor Summit · Group Photo · March 2024')
  })

  it('splits camel-cased session names', () => {
    expect(formatGalleryCaption('KC+CNC_NA_251109_MaintainerSummitGroupPhoto_ML-MN_008'))
      .toBe('KubeCon NA · Maintainer Summit Group Photo · November 2025')
  })

  it('keeps a city token that is not a region or a counter', () => {
    expect(formatGalleryCaption('KC+CNC_NA_Detroit_221027_SessionTracks-SIGS-MaintainerTracks_121'))
      .toBe('KubeCon NA · Detroit · Session Tracks · SIGS · Maintainer Tracks · October 2022')
  })

  // A bare Flickr id encodes nothing. Rendering it, or guessing at it, are both
  // worse than showing no caption.
  it('suppresses a title-cased Flickr identifier', () => {
    expect(formatGalleryCaption('32433026808 C8529aca08 K')).toBe('')
    expect(formatGalleryCaption('53322730377 Ca5b65a035 K')).toBe('')
  })

  it('suppresses an empty or missing title', () => {
    expect(formatGalleryCaption('')).toBe('')
    expect(formatGalleryCaption(undefined)).toBe('')
  })

  it('reads a leading ISO-style date out of a generated basename', () => {
    expect(formatGalleryCaption('20260709 Osc26 Distrobox 1')).toBe('Osc26 · Distrobox · July 2026')
  })

  it('passes authored titles through untouched', () => {
    expect(formatGalleryCaption('Bluefin Advisor Chris Aniszczyk')).toBe('Bluefin Advisor Chris Aniszczyk')
    expect(formatGalleryCaption('Duality (Day & Night) by Dr. Natalia Jagielska and Delphic Melody (M. Gopal)'))
      .toBe('Duality (Day & Night) by Dr. Natalia Jagielska and Delphic Melody (M. Gopal)')
  })

  it('never returns a raw underscore-delimited export name', () => {
    const captions = [
      'KC+CNC_EU_260322_MaintainerSummitEveningReception_024_MN',
      'KC+CNC_NA_251109_MaintainerSummitBreakoutsB206_ML-MN_029',
    ].map(formatGalleryCaption)

    for (const caption of captions) {
      expect(caption).not.toContain('_')
      expect(caption.length).toBeGreaterThan(0)
    }
  })
})

describe('getGalleryCaptionLabel', () => {
  it('credits the CNCF stream for CNCF-sourced slides', () => {
    expect(getGalleryCaptionLabel({ kind: 'cncf' })).toBe('CNCF STREAM //')
  })

  // 38 CNCF conference photos are mirrored under wolves/people/. Keying the
  // credit on file locality attributed those to Bluefin.
  it('credits the CNCF stream even when the file is stored locally', () => {
    expect(getGalleryCaptionLabel({ kind: 'cncf', isLocal: true })).toBe('CNCF STREAM //')
  })

  it('separates commissioned art from product showcase', () => {
    expect(getGalleryCaptionLabel({ kind: 'showcase' })).toBe('BLUEFIN SHOWCASE //')
    expect(getGalleryCaptionLabel({ kind: 'curated' })).toBe('BLUEFIN SHOWCASE //')
    expect(getGalleryCaptionLabel({ kind: 'mascot' })).toBe('BLUEFIN ORIGINAL //')
    expect(getGalleryCaptionLabel({ kind: 'hero' })).toBe('BLUEFIN ORIGINAL //')
  })

  it('credits the imported artwork registries to their projects', () => {
    expect(getGalleryCaptionLabel({ kind: 'artwork' })).toBe('UNIVERSAL BLUE ARTWORK //')
    expect(getGalleryCaptionLabel({ kind: 'bazzite' })).toBe('BAZZITE ARTWORK //')
  })

  it('keeps the registered artwork titles as captions', () => {
    expect(formatGalleryCaption('Bluefin 01 - January')).toBe('Bluefin 01 - January')
    expect(formatGalleryCaption('Convergence')).toBe('Convergence')
    expect(formatGalleryCaption('Convergence DX')).toBe('Convergence DX')
  })

  it('falls back to locality for slides with no provenance, preserving Wolves behaviour', () => {
    expect(getGalleryCaptionLabel({ isLocal: true })).toBe('BLUEFIN SHOWCASE //')
    expect(getGalleryCaptionLabel({ isLocal: false })).toBe('CNCF STREAM //')
  })
})

describe('formatGalleryCaption against the shipped feeds', () => {
  it('handles the second photographer grammar in the CNCF feed', () => {
    expect(formatGalleryCaption('2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0038'))
      .toBe('OHSNAP · KuberTENes · Birthday Bash · June 2024')
  })

  it('does not split an all-caps run inside a word', () => {
    expect(formatGalleryCaption('KC+CNC_NA_251109_KuberTENes_MN_001'))
      .toBe('KubeCon NA · KuberTENes · November 2025')
  })

  it('splits a trailing room code off a session name', () => {
    expect(formatGalleryCaption('KC+CNC_NA_251109_MaintainerSummitBreakoutsB206_ML-MN_029'))
      .toBe('KubeCon NA · Maintainer Summit Breakouts B206 · November 2025')
  })
})

describe('formatGalleryCaption suppresses file identifiers', () => {
  it('suppresses a phone camera filename even though it encodes a date', () => {
    expect(formatGalleryCaption('PXL 20240720 181225593')).toBe('')
  })

  it('suppresses a scratch export with a uuid', () => {
    expect(formatGalleryCaption('Temp Image 20230915 011731 Aeb0b8f4 E66a 455b Ab39 3122768e6825')).toBe('')
  })

  it('suppresses source-prefixed Flickr ids', () => {
    expect(formatGalleryCaption('Cncf 54927603143')).toBe('')
    expect(formatGalleryCaption('Kubecon 54927705495')).toBe('')
  })

  it('suppresses in-camera filenames', () => {
    expect(formatGalleryCaption('0R0A9083')).toBe('')
    expect(formatGalleryCaption('DSC04181')).toBe('')
    expect(formatGalleryCaption('CRJ07242')).toBe('')
  })

  it('keeps a short authored title that happens to contain a number', () => {
    expect(formatGalleryCaption('Summit 03')).toBe('Summit 03')
    expect(formatGalleryCaption('Erin Boyd')).toBe('Erin Boyd')
  })
})
