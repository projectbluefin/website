import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAlbumPageUrl,
  computeTitleFamily,
  countAlbumPages,
  diversifyByTitleFamily,
  extractPhotosFromAlbumHtml,
  fetchWithRateLimit,
  isPeopleFirstPhoto,
  loadCurationConfig,
  loadExistingPhotos,
  normalizePhoto,
  scrapeAlbum,
  selectFreshPhotos,
  selectSpreadPages,
  shuffleArray,
} from '../update-flickr-photos.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8')

describe('update-flickr-photos helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shuffles arrays without losing items', () => {
    const input = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
    const shuffled = shuffleArray(input)
    expect(shuffled).toHaveLength(input.length)
    expect(shuffled.every(item => input.includes(item))).toBe(true)
  })

  it('selects spread pages across a range', () => {
    expect(selectSpreadPages(100, 5)).toEqual([1, 25, 50, 75, 100])
    expect(selectSpreadPages(10, 1)).toEqual([1])
    expect(selectSpreadPages(10, 0)).toEqual([])
    expect(selectSpreadPages(1, 5)).toEqual([1])
  })

  it('normalizes Flickr photo objects', () => {
    expect(normalizePhoto({ id: '123', server: '456', secret: 'abc', title: 'Photo' })).toEqual({
      id: '123',
      server: '456',
      secret: 'abc',
      title: 'Photo',
    })
  })

  it('builds a fresh, deduplicated cache without retaining stale entries', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const photos = selectFreshPhotos([
      { id: 'current-japan', server: '1', secret: 'a', title: 'Japan contributor summit' },
      { id: 'current-japan', server: '1', secret: 'a', title: 'Duplicate' },
      { id: 'current-europe', server: '2', secret: 'b', title: 'Europe maintainer summit' },
    ], 2)

    expect(photos.map(photo => photo.id).sort()).toEqual(['current-europe', 'current-japan'])
  })

  it('retries on 429 and respects Retry-After', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(new Response('{"ok": true}', { status: 200 }))

    const res = await fetchWithRateLimit('https://example.com/test')

    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.unstubAllGlobals()
  })

  it('retries on network errors with exponential backoff', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response('{"ok": true}', { status: 200 }))

    const res = await fetchWithRateLimit('https://example.com/test')

    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.unstubAllGlobals()
  })

  it('gives up after exhausting retries', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockRejectedValue(new Error('Persistent network error'))

    await expect(fetchWithRateLimit('https://example.com/test', { retries: 2 })).rejects.toThrow('Persistent network error')
    expect(fetchMock).toHaveBeenCalledTimes(3)

    vi.unstubAllGlobals()
  })

  it('loads existing photos from a cache file', async () => {
    const tmpPath = join(__dirname, 'fixtures', 'flickr-photos-tmp.json')
    writeFileSync(tmpPath, '[{"id":"cached-1"}]')
    try {
      const photos = await loadExistingPhotos(tmpPath)
      expect(photos).toEqual([{ id: 'cached-1' }])
    }
    finally {
      try {
        unlinkSync(tmpPath)
      }
      catch {
        // ignore cleanup failure
      }
    }
  })

  it('returns an empty array when the cache file is missing', async () => {
    const photos = await loadExistingPhotos(join(__dirname, 'fixtures', 'does-not-exist.json'))
    expect(photos).toEqual([])
  })
})

describe('curated album config', () => {
  it('loads curation config and merges defaults', async () => {
    const configPath = join(__dirname, '..', 'flickr-curation.json')
    const config = await loadCurationConfig(configPath)
    expect(config.userId).toBe('143247548@N03')
    expect(config.albums.length).toBeGreaterThan(0)
    expect(config.peopleFirst.allowPatterns.length).toBeGreaterThan(0)
    expect(config.peopleFirst.blockPatterns.length).toBeGreaterThan(0)
  })

  it('falls back to defaults when config file is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const config = await loadCurationConfig(join(__dirname, 'fixtures', 'does-not-exist.json'))
    expect(config.userId).toBe('143247548@N03')
    expect(config.albums).toEqual([])

    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('album URL building', () => {
  it('builds a Flickr album page URL', () => {
    expect(buildAlbumPageUrl('72177720316310566', '143247548@N03')).toBe('https://www.flickr.com/photos/143247548@N03/albums/72177720316310566')
    expect(buildAlbumPageUrl('72177720316310566', '143247548@N03', 3)).toBe('https://www.flickr.com/photos/143247548@N03/albums/72177720316310566/page3')
    expect(buildAlbumPageUrl('72177720316310566', 'custom-user')).toBe('https://www.flickr.com/photos/custom-user/albums/72177720316310566')
  })
})

describe('album HTML parsing', () => {
  it('extracts photo ids, servers, secrets, and titles from album cards', () => {
    const html = fixture('flickr-album.html')
    const photos = extractPhotosFromAlbumHtml(html)

    expect(photos).toEqual([
      { id: '11111111111', server: '65535', secret: 'abc123def0', title: 'Maintainer Summit group photo' },
      { id: '22222222222', server: '65535', secret: 'bcd234efa1', title: 'Keynote speaker' },
      { id: '33333333333', server: '65535', secret: 'cde345fab2', title: 'Contributor signing the wall' },
      { id: '44444444444', server: '65535', secret: 'def456abc3', title: 'Hallway track crowd' },
      { id: '55555555555', server: '65535', secret: 'efg567bcd4', title: 'Sponsor booth signage' },
    ])
  })

  it('returns an empty array for albums with no photo cards', () => {
    const html = fixture('flickr-album-empty.html')
    expect(extractPhotosFromAlbumHtml(html)).toEqual([])
  })

  it('returns an empty array for non-string input', () => {
    expect(extractPhotosFromAlbumHtml(null as any)).toEqual([])
    expect(extractPhotosFromAlbumHtml(undefined as any)).toEqual([])
    expect(extractPhotosFromAlbumHtml(123 as any)).toEqual([])
  })
})

describe('album pagination counting', () => {
  it('counts the maximum page number from album pagination links', () => {
    const html = fixture('flickr-album.html')
    expect(countAlbumPages(html)).toBe(4)
  })

  it('returns 1 when there are no pagination links', () => {
    const html = fixture('flickr-album-empty.html')
    expect(countAlbumPages(html)).toBe(1)
  })

  it('returns 1 for non-string input', () => {
    expect(countAlbumPages(null as any)).toBe(1)
    expect(countAlbumPages(undefined as any)).toBe(1)
  })
})

describe('people-first filtering', () => {
  const config = {
    userId: '143247548@N03',
    userAgent: 'test',
    requestDelayMs: 0,
    maxRetries: 0,
    maxPagesPerAlbum: 1,
    maxPhotosPerAlbum: 10,
    maxPhotosPerTitleFamily: 2,
    targetTotalPhotos: 10,
    albums: [],
    peopleFirst: {
      allowPatterns: ['maintainer', 'contributor', 'people', 'group', 'crowd'],
      blockPatterns: ['sponsor', 'banner', 'stage', 'booth'],
    },
  }

  it('allows photos matching allow patterns', () => {
    expect(isPeopleFirstPhoto({ id: '1', title: 'Maintainer group photo' }, config)).toBe(true)
    expect(isPeopleFirstPhoto({ id: '2', title: 'Contributor crowd' }, config)).toBe(true)
  })

  it('blocks photos matching block patterns even if they also match allow patterns', () => {
    expect(isPeopleFirstPhoto({ id: '3', title: 'Sponsor booth group' }, config)).toBe(false)
    expect(isPeopleFirstPhoto({ id: '4', title: 'Banner with people' }, config)).toBe(false)
  })

  it('rejects photos that match neither allow nor block patterns', () => {
    expect(isPeopleFirstPhoto({ id: '5', title: 'Random architecture' }, config)).toBe(false)
  })

  it('matches patterns case-insensitively', () => {
    expect(isPeopleFirstPhoto({ id: '6', title: 'MAINTAINER SUMMIT' }, config)).toBe(true)
    expect(isPeopleFirstPhoto({ id: '7', title: 'SPONSOR BOOTH' }, config)).toBe(false)
  })

  it('returns false for empty allow patterns', () => {
    const emptyConfig = { ...config, peopleFirst: { allowPatterns: [], blockPatterns: [] } }
    expect(isPeopleFirstPhoto({ id: '8', title: 'Maintainer group photo' }, emptyConfig)).toBe(false)
  })
})

describe('title family computation', () => {
  it('strips sequence suffixes and location codes', () => {
    expect(computeTitleFamily('KubeCon Group Photo_12')).toBe('KubeCon Group Photo')
    expect(computeTitleFamily('Summit Headshot_US')).toBe('Summit Headshot')
    expect(computeTitleFamily('Group Photo 5')).toBe('Group Photo')
  })

  it('trims whitespace from titles', () => {
    expect(computeTitleFamily('  Maintainer Summit  ')).toBe('Maintainer Summit')
  })

  it('falls back to the original title when stripping leaves nothing', () => {
    expect(computeTitleFamily('12')).toBe('12')
  })
})

describe('title-family diversification', () => {
  it('caps the number of photos per title family', () => {
    const photos = [
      { id: '1', title: 'Group Photo 1' },
      { id: '2', title: 'Group Photo 2' },
      { id: '3', title: 'Group Photo 3' },
      { id: '4', title: 'Keynote 1' },
      { id: '5', title: 'Keynote 2' },
    ]

    const diversified = diversifyByTitleFamily(photos, 2)
    expect(diversified).toHaveLength(4)
    expect(diversified.map(p => p.id)).toEqual(['1', '2', '4', '5'])
  })

  it('returns the input unchanged when maxPerFamily is zero or negative', () => {
    const photos = [{ id: '1', title: 'Photo' }, { id: '2', title: 'Photo' }]
    expect(diversifyByTitleFamily(photos, 0)).toEqual(photos)
    expect(diversifyByTitleFamily(photos, -1)).toEqual(photos)
  })

  it('is deterministic for identical input', () => {
    const photos = [
      { id: '1', title: 'A' },
      { id: '2', title: 'A' },
      { id: '3', title: 'B' },
    ]

    const first = diversifyByTitleFamily(photos, 1)
    const second = diversifyByTitleFamily(photos, 1)
    expect(first).toEqual(second)
  })
})

describe('scrapeAlbum', () => {
  it('scrapes a single album page and attaches album metadata', async () => {
    const html = fixture('flickr-album.html')
    const fetcher = vi.fn().mockImplementation(() => new Response(html, { status: 200 }))

    const photos = await scrapeAlbum({ id: '72177720316310566', title: 'Summit' }, {
      userId: '143247548@N03',
      userAgent: 'test',
      requestDelayMs: 0,
      maxRetries: 0,
      maxPagesPerAlbum: 1,
      maxPhotosPerAlbum: 40,
      maxPhotosPerTitleFamily: 8,
      targetTotalPhotos: 200,
      albums: [],
      peopleFirst: { allowPatterns: [], blockPatterns: [] },
    }, fetcher)

    expect(fetcher).toHaveBeenCalledWith(
      'https://www.flickr.com/photos/143247548@N03/albums/72177720316310566',
      { userAgent: 'test' },
    )
    expect(photos).toHaveLength(5)
    expect(photos[0]).toEqual({
      id: '11111111111',
      server: '65535',
      secret: 'abc123def0',
      title: 'Maintainer Summit group photo',
      albumId: '72177720316310566',
      albumTitle: 'Summit',
    })
  })

  it('throws when the album page request fails', async () => {
    const fetcher = vi.fn().mockImplementation(() => new Response('Not found', { status: 404 }))

    await expect(scrapeAlbum({ id: 'bad', title: 'Bad' }, {
      userId: '143247548@N03',
      userAgent: 'test',
      requestDelayMs: 0,
      maxRetries: 0,
      maxPagesPerAlbum: 1,
      maxPhotosPerAlbum: 40,
      maxPhotosPerTitleFamily: 8,
      targetTotalPhotos: 200,
      albums: [],
      peopleFirst: { allowPatterns: [], blockPatterns: [] },
    }, fetcher)).rejects.toThrow('HTTP error 404')
  })
})
