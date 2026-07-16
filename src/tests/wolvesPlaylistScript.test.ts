import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error script module is intentionally plain Node ESM
import { normalizePlaylistEntries } from '../../scripts/update-wolves-playlist.js'
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
      { id: 'def456', title: 'Instrumental', uploader: 'Bluefin Records', thumbnail: 'https://img.example/2.jpg' },
    ])).toEqual([
      { id: 'abc123', title: '7 Days to the Wolves', artist: 'Nightwish', youtubeVideoId: 'abc123', artwork: 'wolves-artwork/abc123.jpg', thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg' },
      { id: 'def456', title: 'Instrumental', artist: 'Bluefin Records', youtubeVideoId: 'def456', artwork: 'wolves-artwork/def456.jpg', thumbnailUrl: 'https://img.example/2.jpg' },
    ])
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
})
