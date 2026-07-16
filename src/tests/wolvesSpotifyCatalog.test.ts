import type { SpotifyTrackMapping } from '../data/wolves-playback'
import type { WolvesSoundtrackManifest } from '../data/wolves-soundtrack'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  validateSpotifyCatalog,
} from '../data/wolves-playback'
import { wolvesSpotifyCatalog } from '../data/wolves-spotify-catalog'

const soundtrackManifest = JSON.parse(await readFile(
  resolve(process.cwd(), 'public/wolves-playlist.json'),
  'utf8',
)) as WolvesSoundtrackManifest

const syntheticCatalog = [
  {
    youtubeVideoId: 'first-video',
    spotifyUri: 'spotify:track:synthetic-first',
    title: 'First track',
    artist: 'First artist',
  },
  {
    youtubeVideoId: 'second-video',
    spotifyUri: 'spotify:track:synthetic-second',
    title: 'Second track',
    artist: 'Second artist',
  },
] as const

describe('wolves Spotify catalog', () => {
  it('accepts one unique Spotify track per manifest track in playlist order', () => {
    expect(() => validateSpotifyCatalog(
      [{ youtubeVideoId: 'first-video' }, { youtubeVideoId: 'second-video' }],
      syntheticCatalog,
    )).not.toThrow()
  })

  it('keeps the production catalog empty until reviewed mappings are available', () => {
    expect(wolvesSpotifyCatalog).toEqual([])
    expect(() => validateSpotifyCatalog(soundtrackManifest.tracks, wolvesSpotifyCatalog))
      .toThrow(`Spotify catalog is missing mapping for YouTube video "${soundtrackManifest.tracks[0].youtubeVideoId}" at playlist index 0`)
  })

  it('rejects a missing mapping instead of replacing a song', () => {
    expect(() => validateSpotifyCatalog(
      [{ youtubeVideoId: 'first-video' }, { youtubeVideoId: 'second-video' }],
      [syntheticCatalog[0]],
    )).toThrow('Spotify catalog is missing mapping for YouTube video "second-video" at playlist index 1')
  })

  it('rejects a non-track Spotify URI instead of replacing a song', () => {
    expect(() => validateSpotifyCatalog(
      [{ youtubeVideoId: 'first-video' }],
      [{ ...syntheticCatalog[0], spotifyUri: 'spotify:album:not-a-track' }] as unknown as SpotifyTrackMapping[],
    )).toThrow('Spotify catalog mapping for YouTube video "first-video" must use a spotify:track: URI')
  })

  it('rejects duplicate Spotify URIs', () => {
    expect(() => validateSpotifyCatalog(
      [{ youtubeVideoId: 'first-video' }, { youtubeVideoId: 'second-video' }],
      [{ ...syntheticCatalog[0] }, { ...syntheticCatalog[1], spotifyUri: syntheticCatalog[0].spotifyUri }],
    )).toThrow('Spotify catalog has duplicate Spotify URI "spotify:track:synthetic-first"')
  })

  it('rejects mappings that do not match the YouTube playlist order', () => {
    expect(() => validateSpotifyCatalog(
      [{ youtubeVideoId: 'first-video' }, { youtubeVideoId: 'second-video' }],
      [syntheticCatalog[1], syntheticCatalog[0]],
    )).toThrow('Spotify catalog order mismatch at playlist index 0: expected YouTube video "first-video", received "second-video"')
  })
})
