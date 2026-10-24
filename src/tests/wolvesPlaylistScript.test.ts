import { Buffer } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error script module is intentionally plain Node ESM
import { downloadArtwork, isJpegBytes, normalizePlaylistEntries } from '../../scripts/update-wolves-playlist.js'
import { loadWolvesSoundtrack } from '../data/wolves-soundtrack'

describe('wolves playlist metadata generator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses the YouTube title as the fallback artist and creates local artwork paths', () => {
    expect(normalizePlaylistEntries([
      {
        id: 'abc123',
        title: 'Nightwish - 7 Days to the Wolves',
        uploader: 'Nightwish',
        thumbnail: null,
        thumbnails: [{ url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg?sqp=query' }],
      },
      { id: 'def456', title: 'Instrumental', uploader: 'Bluefin Records', thumbnail: 'https://yt3.ggpht.com/def456/2.jpg' },
    ])).toEqual([
      { id: 'abc123', title: '7 Days to the Wolves', artist: 'Nightwish', youtubeVideoId: 'abc123', artwork: 'wolves-artwork/abc123.jpg', thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg' },
      { id: 'def456', title: 'Instrumental', artist: 'Bluefin Records', youtubeVideoId: 'def456', artwork: 'wolves-artwork/def456.jpg', thumbnailUrl: 'https://yt3.ggpht.com/def456/2.jpg' },
    ])
  })

  it('rejects video ids that could escape the artwork directory', () => {
    for (const id of ['../../etc/evil', 'a/b', 'abc.123', '', 'x'.repeat(65)]) {
      expect(() => normalizePlaylistEntries([
        { id, title: 'Song', uploader: 'Band', thumbnail: 'https://i.ytimg.com/vi/x/hqdefault.jpg' },
      ])).toThrow(/Malformed yt-dlp entry at index 0/)
    }
  })

  it('rejects thumbnails that are not https URLs on a YouTube image host', () => {
    for (const thumbnail of [
      'http://i.ytimg.com/vi/abc123/hqdefault.jpg',
      'https://img.example/2.jpg',
      'https://i.ytimg.com.evil.example/x.jpg',
      'file:///etc/passwd',
      'not a url',
    ]) {
      expect(() => normalizePlaylistEntries([
        { id: 'abc123', title: 'Song', uploader: 'Band', thumbnail },
      ])).toThrow(/Malformed yt-dlp entry at index 0: thumbnail/)
    }
  })

  it('uses canonical artist overrides instead of YouTube uploader labels', () => {
    expect(normalizePlaylistEntries([
      {
        id: '9skBT5TUqzo',
        title: 'Tonight We Must Be Warriors',
        uploader: 'Avatar Metal',
        thumbnail: 'https://i.ytimg.com/vi/9skBT5TUqzo/hqdefault.jpg',
      },
    ])).toMatchObject([
      {
        id: '9skBT5TUqzo',
        title: 'Tonight We Must Be Warriors',
        artist: 'Avatar',
      },
    ])
  })

  it('loads the soundtrack manifest from the base URL', async () => {
    const manifest = {
      source: {
        provider: 'youtube' as const,
        playlistId: 'PLA78oiE-RGAE',
        playlistUrl: 'https://www.youtube.com/playlist?list=PLA78oiE-RGAE',
        musicUrl: 'https://music.youtube.com/playlist?list=PLA78oiE-RGAE',
        spotifyUri: null,
      },
      tracks: [
        {
          id: 'abc123',
          title: '7 Days to the Wolves',
          artist: 'Nightwish',
          artwork: 'wolves-artwork/abc123.jpg',
          youtubeVideoId: 'abc123',
        },
      ],
    }

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(manifest), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadWolvesSoundtrack()).resolves.toEqual(manifest)
    expect(fetchMock).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}wolves-playlist.json`)
  })

  it('throws when the soundtrack manifest request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })))

    await expect(loadWolvesSoundtrack()).rejects.toThrow('Soundtrack metadata request failed: 503')
  })

  describe('artwork content validation', () => {
    const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46])
    const WEBP = Buffer.from('RIFF????WEBPfake-webp-bytes', 'latin1')

    it('treats the FF D8 FF start marker as JPEG and everything else as not', () => {
      expect(isJpegBytes(JPEG)).toBe(true)
      expect(isJpegBytes(WEBP)).toBe(false)
      expect(isJpegBytes(Buffer.from([0xFF, 0xD8]))).toBe(false)
      expect(isJpegBytes(Buffer.alloc(0))).toBe(false)
    })

    it('writes only bytes that are actually a JPEG', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JPEG, { status: 200 })))

      const result = await downloadArtwork({ id: 'abc123', thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg', artwork: 'wolves-artwork/abc123.jpg' })

      expect(result.body).toEqual(JPEG)
    })

    it('refuses to download a non-JPEG asset even from an allowed host', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(WEBP, { status: 200 })))

      await expect(
        downloadArtwork({ id: 'def456', thumbnailUrl: 'https://yt3.ggpht.com/avatar.webp', artwork: 'wolves-artwork/def456.jpg' }),
      ).rejects.toThrow(/not a JPEG/)
    })
  })
})
