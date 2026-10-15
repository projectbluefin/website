import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { IMAGE_SBOM_REGISTRY, validateImageSbomRegistry } from '../lib/image-sbom-registry.js'
import { extractMappedVersions } from '../lib/spdx-version-extractor.js'

const record = {
  id: 'bluefin-stable',
  product: 'bluefin',
  required: true,
  image: 'ghcr.io/ublue-os/bluefin:stable',
  certificateIdentityRegexp: '^https://github.com/ublue-os/bluefin/.github/workflows/[^@]+@refs/.+$',
  certificateOidcIssuer: 'https://token.actions.githubusercontent.com',
  packages: {
    base: { name: 'kernel-core', type: 'rpm', required: true },
  },
}

describe('validateImageSbomRegistry', () => {
  it('rejects duplicate image registry ids', () => {
    expect(() => validateImageSbomRegistry([
      record,
      { ...record, image: 'ghcr.io/ublue-os/bluefin-nvidia-open:stable' },
    ])).toThrow('duplicate image registry id "bluefin-stable"')
  })

  it('rejects image references without a tag or digest', () => {
    expect(() => validateImageSbomRegistry([
      { ...record, image: 'ghcr.io/ublue-os/bluefin' },
    ])).toThrow('image registry id "bluefin-stable" must use a tagged image reference')
  })

  it('rejects empty certificate identity constraints', () => {
    expect(() => validateImageSbomRegistry([
      { ...record, certificateIdentityRegexp: '' },
    ])).toThrow('image registry id "bluefin-stable" must define certificateIdentityRegexp')

    expect(() => validateImageSbomRegistry([
      { ...record, certificateOidcIssuer: ' ' },
    ])).toThrow('image registry id "bluefin-stable" must define certificateOidcIssuer')
  })

  it('rejects package mappings without a name', () => {
    expect(() => validateImageSbomRegistry([
      {
        ...record,
        packages: {
          base: { required: true },
        },
      },
    ])).toThrow('image registry id "bluefin-stable" package "base" must define name')
  })

  it('rejects package mappings without a required flag', () => {
    expect(() => validateImageSbomRegistry([
      {
        ...record,
        packages: {
          base: { name: 'kernel-core' },
        },
      },
    ])).toThrow('image registry id "bluefin-stable" package "base" must define required as a boolean')
  })

  it('rejects package mappings with non-boolean required flags', () => {
    expect(() => validateImageSbomRegistry([
      {
        ...record,
        packages: {
          base: { name: 'kernel-core', required: 'yes' as unknown as boolean },
        },
      },
    ])).toThrow('image registry id "bluefin-stable" package "base" must define required as a boolean')
  })

  it('rejects an empty packages object unless pendingSbom is true', () => {
    expect(() => validateImageSbomRegistry([
      { ...record, packages: {} },
    ])).toThrow('image registry id "bluefin-stable" must define packages unless pendingSbom is true')
  })

  it('allows empty packages when pendingSbom is true', () => {
    expect(() => validateImageSbomRegistry([
      {
        ...record,
        pendingSbom: true,
        packages: {},
      },
    ])).not.toThrow()
  })

  it('rejects a non-boolean requireSbomSignature', () => {
    expect(() => validateImageSbomRegistry([
      { ...record, requireSbomSignature: 'yes' as unknown as boolean },
    ])).toThrow('image registry id "bluefin-stable" must define requireSbomSignature as a boolean')
  })
})

// ---------------------------------------------------------------------------
// Live-evidence selectors
//
// These fixtures are trimmed copies of the published SBOMs. They exist so the
// selectors that disambiguate a real package name stay pinned to the evidence
// that justified them, and so a regression is a test failure rather than a
// silently omitted version on the website.
// ---------------------------------------------------------------------------

const dakotaElements = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures/dakota-mesa-systemd-elements.spdx.json'), 'utf8'),
)
const bluefinCatalogers = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures/bluefin-stable-catalogers.syft.json'), 'utf8'),
)
const dakotaLinuxElements = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures/dakota-stable-linux-elements.spdx.json'), 'utf8'),
)
const dakotaNvidiaDrivers = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures/dakota-nvidia-drivers.spdx.json'), 'utf8'),
)

function recordFor(id: string) {
  const record = IMAGE_SBOM_REGISTRY.find(r => r.id === id)
  expect(record, `registry record ${id} not found`).toBeDefined()
  return record!
}

describe('registry selectors resolve known live ambiguities', () => {
  it('pins Dakota kernel to the core linux element', () => {
    const { packages } = recordFor('dakota')
    expect(packages.kernel.element).toBe('core/linux-fdsdk.bst')

    const result = extractMappedVersions(dakotaLinuxElements, { kernel: packages.kernel })
    expect(result.ambiguous).toEqual([])
    expect(result.values.kernel).toBe('7.2.6')
  })

  it('is ambiguous for Dakota kernel without the element pin', () => {
    const result = extractMappedVersions(dakotaLinuxElements, {
      kernel: { name: 'linux', required: true },
    })
    expect(result.ambiguous).toEqual(['kernel'])
  })

  it('pins Dakota mesa to the mesa extension element', () => {
    const { packages } = recordFor('dakota')
    expect(packages.mesa.element).toBe('freedesktop-sdk.bst:extensions/mesa/mesa-extra.bst')

    const result = extractMappedVersions(dakotaElements, { mesa: packages.mesa })
    expect(result.ambiguous).toEqual([])
    expect(result.values.mesa).toBe('26.0.6')
  })
  it('pins Dakota systemd to the gnome-build-meta systemd-base element', () => {
    const { packages } = recordFor('dakota')
    expect(packages.systemd.element).toBe('gnome-build-meta.bst:core-deps/systemd-base.bst')

    const result = extractMappedVersions(dakotaElements, { systemd: packages.systemd })
    expect(result.ambiguous).toEqual([])
    expect(result.values.systemd).toBe('260.2')
  })

  it('is ambiguous for Dakota mesa and systemd without the element pins', () => {
    const result = extractMappedVersions(dakotaElements, {
      mesa: { name: 'mesa', required: true },
      systemd: { name: 'systemd', required: false },
    })
    expect(result.ambiguous.sort()).toEqual(['mesa', 'systemd'])
  })

  it('pins Bluefin podman to the RPM database cataloger', () => {
    const { packages } = recordFor('bluefin-stable')
    expect(packages.podman.foundBy).toBe('rpm-db-cataloger')

    const result = extractMappedVersions(bluefinCatalogers, { podman: packages.podman })
    expect(result.ambiguous).toEqual([])
    // Raw RPM evidence keeps its epoch; the projection strips it for display.
    expect(result.values.podman).toBe('5:5.8.4-1.fc44')
  })

  it('pins Bluefin mesa to the installed RPM database package', () => {
    const { packages } = recordFor('bluefin-stable')
    expect(packages.mesa.required).toBe(false)
    expect(packages.mesa).toMatchObject({
      name: 'mesa-dri-drivers',
      type: 'rpm',
      foundBy: 'rpm-db-cataloger',
    })

    const result = extractMappedVersions(bluefinCatalogers, { mesa: packages.mesa })
    expect(result.ambiguous).toEqual([])
    expect(result.values.mesa).toBe('1:26.1.4-4.fc44')
  })

  it('resolves Bluefin kernel-core unambiguously', () => {
    const { packages } = recordFor('bluefin-stable')
    const result = extractMappedVersions(bluefinCatalogers, {
      kernel: packages.kernel,
    })
    expect(result.ambiguous).toEqual([])
    expect(result.values.kernel).toBe('7.1.6-201.fc44')
  })

  it('pins Bluefin systemd to the installed RPM database package', () => {
    const { packages } = recordFor('bluefin-stable')
    expect(packages.systemd.required).toBe(false)
    expect(packages.systemd).toMatchObject({
      name: 'systemd',
      type: 'rpm',
      foundBy: 'rpm-db-cataloger',
    })

    const result = extractMappedVersions(bluefinCatalogers, { systemd: packages.systemd })
    expect(result.ambiguous).toEqual([])
    expect(result.values.systemd).toBe('259.9-1.fc44')
  })

  it('is ambiguous for Bluefin systemd without the cataloger pin', () => {
    const result = extractMappedVersions(bluefinCatalogers, {
      systemd: { name: 'systemd', required: false },
    })
    expect(result.ambiguous).toEqual(['systemd'])
  })
})

describe('dakota image references name tags the publisher actually publishes', () => {
  // Both base dakota and its variant repositories publish `testing`/`stable`.
  // Tracking `:stable` provides verified production builds across all images.
  const dakotaImages = IMAGE_SBOM_REGISTRY.filter(
    entry => entry.product === 'dakota',
  )

  it('covers every dakota image', () => {
    expect(dakotaImages.map(entry => entry.id).sort()).toEqual([
      'dakota',
      'dakota-gaming',
      'dakota-nvidia',
      'dakota-nvidia-gaming',
    ])
  })

  it.each(dakotaImages.map(entry => entry.id))('%s tracks the :stable tag', (id) => {
    const { image } = recordFor(id)
    expect(image).toMatch(/:stable$/)
  })

  // The dakota publisher signs its SPDX referrers, so an unsigned one must
  // sanitize rather than warn: otherwise the signature check is bypassable by
  // simply not signing.
  it.each(dakotaImages.map(entry => entry.id))('%s requires a signed SPDX referrer', (id) => {
    expect(recordFor(id).requireSbomSignature).toBe(true)
  })

  it('carries a reviewed dakota-nvidia mapping now that the image publishes an SBOM', () => {
    const entry = recordFor('dakota-nvidia')
    expect(entry.image).toBe('ghcr.io/projectbluefin/dakota-nvidia:stable')
    // The mapping was reviewed against the published SPDX, so the record no
    // longer short-circuits to `pending-mapping`.
    expect(entry.pendingSbom).toBeUndefined()
    expect(Object.keys(entry.packages)).toEqual(['nvidia'])
  })

  it('resolves the reviewed dakota-nvidia mapping unambiguously', () => {
    const { packages } = recordFor('dakota-nvidia')
    const result = extractMappedVersions(dakotaNvidiaDrivers, packages)

    expect(result.ambiguous).toEqual([])
    expect(result.missingRequired).toEqual([])
    expect(result.values.nvidia).toBe('615.71.09')
  })

  it('pins base dakota to :stable', () => {
    expect(recordFor('dakota').image).toBe('ghcr.io/projectbluefin/dakota:stable')
  })
})
