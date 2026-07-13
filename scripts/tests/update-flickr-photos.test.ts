import { readFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithRateLimit, loadExistingPhotos, normalizePhoto, selectSpreadPages, shuffleArray } from '../update-flickr-photos.js'

vi.mock('node:fs/promises', () => ({
  default: {},
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

describe('update-flickr-photos helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('returns an empty array when the cache file is missing', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT'))
    const photos = await loadExistingPhotos()
    expect(photos).toEqual([])
    vi.restoreAllMocks()
  })
})
