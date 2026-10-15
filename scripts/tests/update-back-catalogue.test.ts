import type { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import {
  auditExperience,
  buildExperience,
  isPlaylistUrl,
  readPlaylistEntries,
  refreshMetadata,
  shouldIncludeAlbum,
} from '../update-back-catalogue.js'

const album = { id: 'PLtest', title: 'Test Album', description: 'A test album' }

function entry(overrides = {}) {
  return { id: 'vid00000001', title: 'Artist - Song', duration: 200, ...overrides }
}

describe('buildExperience', () => {
  it('applies the artist override for the Voice of Baceprot channel name', () => {
    const experience = buildExperience(album, [
      entry({ id: '4aZX-C8HKJc', title: 'VoB (Voice of Baceprot) - School Revolution' }),
    ])

    expect(experience.segments[0].artist).toBe('Voice of Baceprot')
  })
})

describe('auditExperience', () => {
  it('accepts a well-formed experience', () => {
    const entries = [entry()]
    expect(() => auditExperience(album, entries, buildExperience(album, entries))).not.toThrow()
  })

  it('rejects an empty artist', () => {
    const entries = [entry()]
    const experience = buildExperience(album, entries)
    experience.segments[0].artist = '   '

    expect(() => auditExperience(album, entries, experience)).toThrow(/empty artist/)
  })

  it('rejects an empty title', () => {
    const entries = [entry()]
    const experience = buildExperience(album, entries)
    experience.segments[0].title = ''

    expect(() => auditExperience(album, entries, experience)).toThrow(/empty title/)
  })

  it('rejects an implausible duration', () => {
    const entries = [entry()]
    const experience = buildExperience(album, entries)
    experience.segments[0].durationSeconds = 60 * 60 * 5

    expect(() => auditExperience(album, entries, experience)).toThrow(/implausible duration/)
  })

  it('rejects a non-finite duration', () => {
    const entries = [entry()]
    const experience = buildExperience(album, entries)
    experience.segments[0].durationSeconds = Number.POSITIVE_INFINITY

    expect(() => auditExperience(album, entries, experience)).toThrow(/implausible duration/)
  })

  it('still rejects a zero duration', () => {
    const entries = [entry()]
    const experience = buildExperience(album, entries)
    experience.segments[0].durationSeconds = 0

    expect(() => auditExperience(album, entries, experience)).toThrow(/bad duration/)
  })
})

describe('shouldIncludeAlbum', () => {
  it('accepts a URL-safe YouTube playlist id', () => {
    expect(shouldIncludeAlbum({ id: 'PLtest_1-2', title: 'Album' })).toBe(true)
  })

  it('rejects the featured album', () => {
    expect(shouldIncludeAlbum({ id: 'PLA78oiE-RGAE', title: 'Album' })).toBe(false)
    expect(shouldIncludeAlbum({ id: 'PLother', title: 'Seven Days to the Wolves' })).toBe(false)
  })

  it('rejects ids that could escape the experiences directory or carry URL syntax', () => {
    for (const id of ['../../.github/x', 'a/b', 'a\\b', 'PL.test', 'PL test', 'PL?x=1', '', 42]) {
      expect(shouldIncludeAlbum({ id, title: 'Album' }), String(id)).toBe(false)
    }
  })
})

describe('isPlaylistUrl', () => {
  it('accepts https YouTube playlist URLs', () => {
    expect(isPlaylistUrl('https://www.youtube.com/playlist?list=PLtest')).toBe(true)
    expect(isPlaylistUrl('https://music.youtube.com/playlist?list=PLtest')).toBe(true)
  })

  it('rejects option-like, non-https and non-YouTube values', () => {
    for (const value of ['--exec=id', '-a', 'http://www.youtube.com/playlist?list=PL', 'https://evil.example/playlist', 'not a url', undefined]) {
      expect(isPlaylistUrl(value), String(value)).toBe(false)
    }
  })
})

describe('readPlaylistEntries', () => {
  it('refuses to spawn yt-dlp for a rejected playlist URL', () => {
    expect(() => readPlaylistEntries('--exec=id')).toThrow(/Refusing to pass/)
  })
})

describe('refreshMetadata', () => {
  it('recovers an album from git HEAD when the cached catalogue on disk is missing it', async () => {
    const onDiskCatalogue = {
      experiences: [
        { id: 'PL1', title: 'Album 1', subtitle: 'Old Sub', artwork: 'experiences/PL1.jpg', segments: [] },
      ],
    }
    const gitTrackedCatalogue = {
      experiences: [
        { id: 'PL1', title: 'Album 1', subtitle: 'Old Sub', artwork: 'experiences/PL1.jpg', segments: [] },
        { id: 'PL2', title: 'Album 2', subtitle: 'Sub 2', artwork: 'experiences/PL2.jpg', segments: [] },
      ],
    }
    const upstreamMetadata = [
      { id: 'PL1', title: 'Album 1 New', description: 'New Sub 1' },
      { id: 'PL2', title: 'Album 2', description: 'Sub 2' },
    ]

    const writtenFiles = new Map<string, string>()

    const { missing } = await refreshMetadata({
      fetch: async () => ({
        ok: true,
        json: async () => upstreamMetadata,
        arrayBuffer: async () => new ArrayBuffer(8),
      }),
      readFile: async () => JSON.stringify(onDiskCatalogue),
      writeFile: async (path: string, content: string | Buffer) => {
        writtenFiles.set(path, typeof content === 'string' ? content : 'binary')
      },
      gitShow: () => JSON.stringify(gitTrackedCatalogue),
      cataloguePath: '/fake/catalogue.json',
      experiencesDir: '/fake',
      preferGitEntries: true,
    })

    expect(missing).toHaveLength(0)
    const savedCatalogue = JSON.parse(writtenFiles.get('/fake/catalogue.json')!)
    expect(savedCatalogue.experiences).toHaveLength(2)
    expect(savedCatalogue.experiences.map((e: { id: string }) => e.id)).toEqual(['PL1', 'PL2'])
    expect(savedCatalogue.experiences[0].title).toBe('Album 1 New')
  })

  it('prefers git HEAD entries over stale cached disk entries for existing albums in CI', async () => {
    const onDiskCatalogue = {
      experiences: [
        { id: 'PL1', title: 'Album 1 Stale', subtitle: 'Stale Sub', segments: ['old-seg'] },
      ],
    }
    const gitTrackedCatalogue = {
      experiences: [
        { id: 'PL1', title: 'Album 1 Committed', subtitle: 'Committed Sub', segments: ['fixed-seg-1', 'fixed-seg-2'] },
      ],
    }
    const upstreamMetadata = [
      { id: 'PL1', title: 'Album 1 Committed', description: 'Committed Sub' },
    ]
    const writtenFiles = new Map<string, string>()

    await refreshMetadata({
      fetch: async () => ({
        ok: true,
        json: async () => upstreamMetadata,
        arrayBuffer: async () => new ArrayBuffer(8),
      }),
      readFile: async () => JSON.stringify(onDiskCatalogue),
      writeFile: async (path: string, content: string | Buffer) => {
        writtenFiles.set(path, typeof content === 'string' ? content : 'binary')
      },
      gitShow: () => JSON.stringify(gitTrackedCatalogue),
      cataloguePath: '/fake/catalogue.json',
      experiencesDir: '/fake',
      preferGitEntries: true,
    })

    const savedCatalogue = JSON.parse(writtenFiles.get('/fake/catalogue.json')!)
    expect(savedCatalogue.experiences[0].segments).toEqual(['fixed-seg-1', 'fixed-seg-2'])
  })

  it('keeps uncommitted local edits outside CI while still recovering missing albums', async () => {
    const onDiskCatalogue = {
      experiences: [
        { id: 'PL1', title: 'Album 1', subtitle: 'Sub', segments: ['fresh-ingest-1', 'fresh-ingest-2'] },
      ],
    }
    const gitTrackedCatalogue = {
      experiences: [
        { id: 'PL1', title: 'Album 1', subtitle: 'Sub', segments: [] },
        { id: 'PL2', title: 'Album 2', subtitle: 'Sub 2', segments: ['committed-seg'] },
      ],
    }
    const upstreamMetadata = [
      { id: 'PL1', title: 'Album 1', description: 'Sub' },
      { id: 'PL2', title: 'Album 2', description: 'Sub 2' },
    ]
    const writtenFiles = new Map<string, string>()

    const { missing } = await refreshMetadata({
      fetch: async () => ({
        ok: true,
        json: async () => upstreamMetadata,
        arrayBuffer: async () => new ArrayBuffer(8),
      }),
      readFile: async () => JSON.stringify(onDiskCatalogue),
      writeFile: async (path: string, content: string | Buffer) => {
        writtenFiles.set(path, typeof content === 'string' ? content : 'binary')
      },
      gitShow: () => JSON.stringify(gitTrackedCatalogue),
      cataloguePath: '/fake/catalogue.json',
      experiencesDir: '/fake',
      preferGitEntries: false,
    })

    expect(missing).toHaveLength(0)
    const savedCatalogue = JSON.parse(writtenFiles.get('/fake/catalogue.json')!)
    expect(savedCatalogue.experiences).toHaveLength(2)
    // The uncommitted local ingest survives; git HEAD's empty segments do not clobber it.
    expect(savedCatalogue.experiences[0].segments).toEqual(['fresh-ingest-1', 'fresh-ingest-2'])
    expect(savedCatalogue.experiences[1].id).toBe('PL2')
  })

  it('reports missing albums when absent from both disk and git HEAD', async () => {
    const onDiskCatalogue = { experiences: [] }
    const upstreamMetadata = [
      { id: 'PL_new', title: 'Unpublished Album', description: 'Desc' },
    ]
    const writtenFiles = new Map<string, string>()

    const { missing } = await refreshMetadata({
      fetch: async () => ({
        ok: true,
        json: async () => upstreamMetadata,
        arrayBuffer: async () => new ArrayBuffer(8),
      }),
      readFile: async () => JSON.stringify(onDiskCatalogue),
      writeFile: async (path: string, content: string | Buffer) => {
        writtenFiles.set(path, typeof content === 'string' ? content : 'binary')
      },
      gitShow: () => JSON.stringify({ experiences: [] }),
      cataloguePath: '/fake/catalogue.json',
      experiencesDir: '/fake',
      missingAlbumsFile: '/fake/missing.txt',
    })

    expect(missing).toHaveLength(1)
    expect(missing[0].id).toBe('PL_new')
    expect(writtenFiles.get('/fake/missing.txt')).toContain('Unpublished Album (PL_new)')
  })
})
