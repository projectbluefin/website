import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IMAGE_SBOM_REGISTRY } from '../lib/image-sbom-registry.js'
import { verifyRegistry, writeOutputsAtomically } from '../lib/image-version-audit.js'
import { collectVerifiedImageSbom, ToolingError } from '../lib/verified-image-sbom.js'
import { updateImageVersions } from '../update-image-versions.js'

// Only the two side-effecting audit steps are replaced: verification (network)
// and the atomic write (would overwrite public/). Projection, field-loss and
// last-successful annotation stay real so the orchestrator's wiring is tested.
vi.mock('../lib/image-version-audit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/image-version-audit.js')>()
  return {
    ...actual,
    verifyRegistry: vi.fn(),
    writeOutputsAtomically: vi.fn(),
  }
})

const verifyRegistryMock = vi.mocked(verifyRegistry)
const writeMock = vi.mocked(writeOutputsAtomically)

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const scriptPath = path.join(repoRoot, 'scripts', 'update-image-versions.js')
const STREAMS_PATH = path.join(repoRoot, 'public', 'stream-versions.yml')
const DAKOTA_PATH = path.join(repoRoot, 'public', 'dakota-versions.json')
const AUDIT_PATH = path.join(repoRoot, '.cache', 'website-live-data', 'sbom-audit.json')
const AUDIT_KEY = '.cache/website-live-data/sbom-audit.json'

const CHECKED_AT = '2026-10-05T00:00:00.000Z'
const DIGEST = `sha256:${'a'.repeat(64)}`
const SBOM_DIGEST = `sha256:${'b'.repeat(64)}`

type Image = Record<string, any>

function verifiedImage(record: (typeof IMAGE_SBOM_REGISTRY)[number]): Image {
  const fields = Object.keys(record.packages)
  return {
    id: record.id,
    product: record.product,
    image: record.image,
    required: record.required,
    fields,
    pending: record.pendingSbom === true,
    imageDigest: DIGEST,
    sbomDigest: SBOM_DIGEST,
    sbomSignature: 'verified',
    missingRequired: [],
    missingOptional: [],
    ambiguousRequired: [],
    ambiguousOptional: [],
    rejected: [],
    status: 'verified',
    values: Object.fromEntries(fields.map(field => [field, `1.0-1.fc44`])),
  }
}

function audit(overrides: Record<string, Partial<Image>> = {}) {
  return {
    checkedAt: CHECKED_AT,
    images: IMAGE_SBOM_REGISTRY.map((record) => {
      const image = { ...verifiedImage(record), ...overrides[record.id] }
      if (image.status === 'unavailable') {
        delete image.values
      }
      return image
    }),
  }
}

let previousFiles: Record<string, string | undefined>
let exitSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>

function writtenOutputs() {
  expect(writeMock).toHaveBeenCalledTimes(1)
  const [outputs, root] = writeMock.mock.calls[0] as [Record<string, any>, string]
  expect(root).toBe(repoRoot)
  return outputs
}

function warnings() {
  return warnSpy.mock.calls.map(args => args.join(' ')).join('\n')
}

beforeEach(() => {
  previousFiles = {}
  const realRead = fs.readFileSync
  vi.spyOn(fs, 'readFileSync').mockImplementation(((file: fs.PathOrFileDescriptor, ...rest: any[]) => {
    if (file === STREAMS_PATH || file === DAKOTA_PATH || file === AUDIT_PATH) {
      const content = previousFiles[file]
      if (content === undefined) {
        throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' })
      }
      return content
    }
    return (realRead as any)(file, ...rest)
  }) as typeof fs.readFileSync)
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  verifyRegistryMock.mockResolvedValue(audit())
})

afterEach(() => {
  vi.restoreAllMocks()
  verifyRegistryMock.mockReset()
  writeMock.mockReset()
})

describe('updateImageVersions — write mode', () => {
  it('verifies the real registry once with the real collector', async () => {
    await updateImageVersions()

    expect(verifyRegistryMock).toHaveBeenCalledTimes(1)
    expect(verifyRegistryMock).toHaveBeenCalledWith(IMAGE_SBOM_REGISTRY, { collectVerifiedImageSbom })
  })

  it('writes the three outputs in a single atomic call rooted at the repository', async () => {
    await updateImageVersions()

    const outputs = writtenOutputs()
    expect(Object.keys(outputs).sort()).toEqual([
      AUDIT_KEY,
      'public/dakota-versions.json',
      'public/stream-versions.yml',
    ])
    expect(outputs['public/stream-versions.yml'].stable.status).toBe('verified')
    expect(outputs['public/dakota-versions.json'].status).toBe('verified')
    expect(outputs[AUDIT_KEY].checkedAt).toBe(CHECKED_AT)
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('defaults the Dakota baseline and omits isos when no previous output exists', async () => {
    await updateImageVersions()

    const dakota = writtenOutputs()['public/dakota-versions.json']
    expect(dakota.packages.baseline).toBe('x86-64-v3')
    expect(dakota).not.toHaveProperty('isos')
  })

  it('carries the previous Dakota baseline forward but drops stale cached isos', async () => {
    const isos = [{ label: 'Download ISO', filename: 'dakota-live.iso' }]
    previousFiles[DAKOTA_PATH] = JSON.stringify({
      status: 'verified',
      isos,
      packages: { baseline: 'x86-64-v4' },
    })

    await updateImageVersions()

    const dakota = writtenOutputs()['public/dakota-versions.json']
    expect(dakota).not.toHaveProperty('isos')
    expect(dakota.packages.baseline).toBe('x86-64-v4')
  })

  it('treats an unparseable previous output as absent instead of failing', async () => {
    previousFiles[DAKOTA_PATH] = '{ not json'
    previousFiles[AUDIT_PATH] = '{ not json'
    previousFiles[STREAMS_PATH] = 'stable: [unterminated'

    await updateImageVersions()

    expect(writtenOutputs()['public/dakota-versions.json'].packages.baseline).toBe('x86-64-v3')
  })

  it('stamps lastSuccessfulAt from the previous audit onto a newly failed image', async () => {
    previousFiles[AUDIT_PATH] = JSON.stringify({
      checkedAt: '2026-10-04T00:00:00.000Z',
      images: [{ id: 'dakota-gaming', status: 'verified' }],
    })
    verifyRegistryMock.mockResolvedValue(audit({
      'dakota-gaming': { status: 'unavailable', errorCode: 'missing-sbom', error: 'no referrer' },
    }))

    await updateImageVersions()

    const gaming = writtenOutputs()[AUDIT_KEY].images.find((img: Image) => img.id === 'dakota-gaming')
    expect(gaming.lastSuccessfulAt).toBe('2026-10-04T00:00:00.000Z')
  })

  it('still writes, without exiting, when an image is unavailable', async () => {
    verifyRegistryMock.mockResolvedValue(audit({
      'dakota-gaming': { status: 'unavailable', errorCode: 'missing-sbom', error: 'no referrer' },
    }))

    await updateImageVersions()

    expect(writeMock).toHaveBeenCalledTimes(1)
    expect(exitSpy).not.toHaveBeenCalled()
    expect(warnings()).toContain('dakota-gaming: missing-sbom — no referrer')
  })

  it('warns about degraded images and unsigned SPDX referrers', async () => {
    verifyRegistryMock.mockResolvedValue(audit({
      'bluefin-stable-nvidia': { status: 'degraded', errorCode: 'missing-optional', error: 'no nvidia' },
      'dakota-nvidia': { sbomSignature: 'missing' },
    }))

    await updateImageVersions()

    const text = warnings()
    expect(text).toContain('Degraded images')
    expect(text).toContain('bluefin-stable-nvidia: missing-optional — no nvidia')
    expect(text).toContain('Images with unsigned SPDX referrers:')
    expect(text).toContain('dakota-nvidia: sbomSignature is missing')
  })

  it('warns "unknown" when an unavailable image carries no error code', async () => {
    verifyRegistryMock.mockResolvedValue(audit({ 'dakota-gaming': { status: 'unavailable' } }))

    await updateImageVersions()

    expect(warnings()).toContain('dakota-gaming: unknown — ')
  })
})

describe('updateImageVersions — field-loss guard', () => {
  it('refuses to write when a published Bluefin field vanishes without audit evidence', async () => {
    previousFiles[STREAMS_PATH] = 'stable:\n  status: verified\n  retired: "1.0"\n'

    await expect(updateImageVersions()).rejects.toThrow(
      'unexplained field loss in public/stream-versions.yml stable: retired',
    )
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('refuses to write when a published Dakota package vanishes without audit evidence', async () => {
    previousFiles[DAKOTA_PATH] = JSON.stringify({ packages: { retired: '1.0' } })

    await expect(updateImageVersions()).rejects.toThrow(
      'unexplained field loss in public/dakota-versions.json packages: retired',
    )
    expect(writeMock).not.toHaveBeenCalled()
  })

  // The LTS records are still pendingSbom with no package mapping; these two
  // cases model the mapped state, where lts-hwe declares a kernel field.
  it('accepts losing lts.hwe when the hwe image is unavailable (hwe aliases kernel)', async () => {
    previousFiles[STREAMS_PATH] = 'lts:\n  status: verified\n  hwe: "6.17.0"\n'
    verifyRegistryMock.mockResolvedValue(audit({
      'bluefin-lts': { values: { kernel: '6.12.0-1.el10' } },
      'bluefin-lts-hwe': { fields: ['kernel'], status: 'unavailable', errorCode: 'missing-sbom', error: 'gone' },
    }))

    await updateImageVersions()

    const lts = writtenOutputs()['public/stream-versions.yml'].lts
    expect(lts.status).toBe('verified')
    expect(lts).not.toHaveProperty('hwe')
  })

  it('refuses to drop lts.hwe when the hwe image verified without a kernel value', async () => {
    previousFiles[STREAMS_PATH] = 'lts:\n  status: verified\n  hwe: "6.17.0"\n'
    verifyRegistryMock.mockResolvedValue(audit({
      'bluefin-lts': { values: { kernel: '6.12.0-1.el10' } },
      'bluefin-lts-hwe': { fields: ['kernel'], values: {} },
    }))

    await expect(updateImageVersions()).rejects.toThrow('unexplained field loss in public/stream-versions.yml lts: hwe')
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('publishes an unavailable Dakota block when the base image fails', async () => {
    const isos = [{ label: 'Download ISO', filename: 'dakota-live.iso' }]
    previousFiles[DAKOTA_PATH] = JSON.stringify({ isos, packages: { kernel: '7.2.6' } })
    verifyRegistryMock.mockResolvedValue(audit({
      dakota: { status: 'unavailable', errorCode: 'missing-sbom', error: 'gone' },
    }))

    await updateImageVersions()

    const dakota = writtenOutputs()['public/dakota-versions.json']
    expect(dakota.status).toBe('unavailable')
    expect(dakota.packages).toEqual({})
    expect(dakota).not.toHaveProperty('isos')
  })
})

describe('updateImageVersions — --check-only', () => {
  it('writes nothing and does not exit when every image verified', async () => {
    await updateImageVersions({ checkOnly: true })

    expect(writeMock).not.toHaveBeenCalled()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('exits 1 without writing when any image is unavailable', async () => {
    verifyRegistryMock.mockResolvedValue(audit({
      'dakota-nvidia-gaming': { status: 'unavailable', errorCode: 'pending-mapping', error: 'pending' },
    }))

    await updateImageVersions({ checkOnly: true })

    expect(writeMock).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('exits 1 for the registry\'s own pending-mapping records, even though they are optional', async () => {
    const pending = Object.fromEntries(IMAGE_SBOM_REGISTRY
      .filter(record => record.pendingSbom === true)
      .map(record => [record.id, { status: 'unavailable', errorCode: 'pending-mapping', error: 'pending' }]))
    expect(Object.keys(pending).length).toBeGreaterThan(0)
    verifyRegistryMock.mockResolvedValue(audit(pending))

    await updateImageVersions({ checkOnly: true })

    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('does not exit for degraded-only results', async () => {
    verifyRegistryMock.mockResolvedValue(audit({
      'bluefin-stable-nvidia': { status: 'degraded', errorCode: 'missing-optional', error: 'x' },
    }))

    await updateImageVersions({ checkOnly: true })

    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('skips the field-loss guard, which only protects writes', async () => {
    previousFiles[STREAMS_PATH] = 'stable:\n  status: verified\n  retired: "1.0"\n'

    await expect(updateImageVersions({ checkOnly: true })).resolves.toBeUndefined()
  })
})

describe('updateImageVersions — tooling failure', () => {
  it('propagates a ToolingError before any output is written', async () => {
    verifyRegistryMock.mockRejectedValue(new ToolingError('transport', 'oras', 'unreachable'))

    await expect(updateImageVersions()).rejects.toBeInstanceOf(ToolingError)
    expect(writeMock).not.toHaveBeenCalled()
  })
})

describe('update-image-versions CLI', () => {
  let emptyBin: string

  beforeEach(() => {
    emptyBin = fs.mkdtempSync(path.join(tmpdir(), 'no-oras-'))
  })

  afterEach(() => {
    fs.rmSync(emptyBin, { recursive: true, force: true })
  })

  // With oras absent the real collector raises ToolingError('tool-missing')
  // before touching the network, which exercises the CLI's exit-2 contract.
  it.each([[[]], [['--check-only']]])('exits 2 and reports the block when oras is missing (args %j)', (args) => {
    const before = [STREAMS_PATH, DAKOTA_PATH].map(file => fs.statSync(file).mtimeMs)

    const result = spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { PATH: emptyBin, HOME: emptyBin },
      timeout: 30_000,
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Blocked: oras could not complete verification (tool-missing).')
    expect(result.stderr).toContain('No output file, cache entry, or deployment was updated.')
    expect([STREAMS_PATH, DAKOTA_PATH].map(file => fs.statSync(file).mtimeMs)).toEqual(before)
  })
})
