import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLAYLIST_ID = 'PLA78oiE-RGAE'
const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`
const MUSIC_URL = `https://music.youtube.com/playlist?list=${PLAYLIST_ID}`
const MODULE_PATH = import.meta.url.startsWith('file:')
  ? fileURLToPath(import.meta.url)
  : null
const ROOT_DIR = MODULE_PATH ? resolve(dirname(MODULE_PATH), '..') : process.cwd()
const PUBLIC_DIR = join(ROOT_DIR, 'public')

const TEMPO_CONFIGS = {
  'amKIngGUvCk': { bpm: 100, phraseBeats: 32, fadeDuration: 1500 },
  '9skBT5TUqzo': { bpm: 168, phraseBeats: 48, fadeDuration: 1000 },
  'Z--vLaXdlgk': { bpm: 86, phraseBeats: 24, fadeDuration: 2000 },
  '5OFLFVC11Cg': { bpm: 95, phraseBeats: 16, fadeDuration: 800 },
  'san94Q93IcY': { bpm: 124, phraseBeats: 32, fadeDuration: 1200 },
  'rYkYLIYvI18': { bpm: 174, phraseBeats: 64, fadeDuration: 2500 },
}

const ARTIST_OVERRIDES = {
  '9skBT5TUqzo': 'Avatar',
}

// The video id becomes the artwork filename under public/wolves-artwork, so it
// must never carry path separators or dots. Mirrors PLAYLIST_ID_PATTERN in
// update-back-catalogue.js.
const VIDEO_ID_PATTERN = /^[\w-]{1,64}$/

// Thumbnails are fetched and written into public/ as .jpg; only YouTube's
// image hosts over https are acceptable sources.
const THUMBNAIL_HOSTS = new Set(['i.ytimg.com', 'i9.ytimg.com', 'yt3.ggpht.com'])

function requireString(value, fieldName, index) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Malformed yt-dlp entry at index ${index}: expected non-empty ${fieldName}`)
  }

  return value
}

function requireVideoId(value, index) {
  const id = requireString(value, 'id', index)
  if (!VIDEO_ID_PATTERN.test(id)) {
    throw new TypeError(`Malformed yt-dlp entry at index ${index}: id must match ${VIDEO_ID_PATTERN}`)
  }

  return id
}

function readThumbnailUrl(entry, index) {
  let thumbnailUrl = null

  if (typeof entry.thumbnail === 'string' && entry.thumbnail.length > 0) {
    thumbnailUrl = entry.thumbnail
  }
  else if (Array.isArray(entry.thumbnails)) {
    for (const thumbnail of entry.thumbnails) {
      if (thumbnail && typeof thumbnail === 'object' && typeof thumbnail.url === 'string' && thumbnail.url.length > 0) {
        thumbnailUrl = thumbnail.url
        break
      }
    }
  }

  if (!thumbnailUrl) {
    throw new TypeError(`Malformed yt-dlp entry at index ${index}: expected non-empty thumbnail`)
  }

  let url
  try {
    url = new URL(thumbnailUrl)
  }
  catch {
    throw new TypeError(`Malformed yt-dlp entry at index ${index}: thumbnail is not a valid URL`)
  }

  if (url.protocol !== 'https:' || !THUMBNAIL_HOSTS.has(url.hostname)) {
    throw new TypeError(`Malformed yt-dlp entry at index ${index}: thumbnail must be an https URL on a YouTube image host`)
  }

  return `${url.origin}${url.pathname}`
}

export function normalizePlaylistEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new TypeError('Malformed yt-dlp output: expected an entries array')
  }

  return entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new TypeError(`Malformed yt-dlp entry at index ${index}: expected an object`)
    }

    const id = requireVideoId(entry.id, index)
    const title = requireString(entry.title, 'title', index)
    const uploader = requireString(entry.uploader, 'uploader', index)
    const thumbnail = readThumbnailUrl(entry, index)
    const [artistPrefix, ...titleParts] = title.split(' - ')
    const hasArtistPrefix = titleParts.length > 0

    return {
      id,
      title: hasArtistPrefix ? titleParts.join(' - ').trim() : title,
      artist: ARTIST_OVERRIDES[id] ?? (hasArtistPrefix ? artistPrefix.trim() : uploader),
      youtubeVideoId: id,
      artwork: `wolves-artwork/${id}.jpg`,
      thumbnailUrl: thumbnail,
    }
  })
}

function createManifest(tracks) {
  return {
    source: {
      provider: 'youtube',
      playlistId: PLAYLIST_ID,
      playlistUrl: PLAYLIST_URL,
      musicUrl: MUSIC_URL,
      spotifyUri: null,
    },
    tracks: tracks.map((track) => {
      const { thumbnailUrl: _thumbnailUrl, ...manifestTrack } = track
      const tempo = TEMPO_CONFIGS[track.id]
      if (tempo) {
        return { ...manifestTrack, ...tempo }
      }
      return manifestTrack
    }),
  }
}

function readPlaylistEntries() {
  let output

  try {
    output = execFileSync('yt-dlp', ['--flat-playlist', '--dump-single-json', PLAYLIST_URL], {
      encoding: 'utf8',
    })
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error('yt-dlp is required to generate wolves playlist metadata')
    }

    const stderr = error && typeof error === 'object' && 'stderr' in error && typeof error.stderr === 'string'
      ? error.stderr.trim()
      : ''

    throw new Error(stderr
      ? `yt-dlp failed to read the Wolves playlist: ${stderr}`
      : 'yt-dlp failed to read the Wolves playlist')
  }

  let parsed

  try {
    parsed = JSON.parse(output)
  }
  catch {
    throw new Error('Malformed yt-dlp output: expected valid JSON')
  }

  return normalizePlaylistEntries(parsed.entries)
}

// JPEG files begin with the start-of-image marker FF D8 FF. A thumbnail served
// as WebP or any other format would otherwise land on disk named .jpg, so the
// downloaded bytes are verified here rather than trusted from the URL or the
// host allow-list that gates which hosts may be contacted.
export function isJpegBytes(body) {
  return body.length >= 3
    && body[0] === 0xFF
    && body[1] === 0xD8
    && body[2] === 0xFF
}

// Reject a download whose bytes are not a JPEG. Called before the bytes are
// written so a non-JPEG asset is never stored under a .jpg path.
export function assertJpegArtwork(body, source) {
  if (!isJpegBytes(body)) {
    throw new Error(`Artwork from ${source} is not a JPEG and was not written`)
  }
}

export async function downloadArtwork(track) {
  const response = await fetch(track.thumbnailUrl)
  if (!response.ok) {
    throw new Error(`Artwork download failed for ${track.id}: ${response.status}`)
  }

  const body = Buffer.from(await response.arrayBuffer())
  assertJpegArtwork(body, track.thumbnailUrl)

  return {
    path: join(PUBLIC_DIR, track.artwork),
    body,
  }
}

export async function main() {
  const tracks = readPlaylistEntries()
  const downloads = await Promise.all(tracks.map(downloadArtwork))

  await mkdir(join(PUBLIC_DIR, 'wolves-artwork'), { recursive: true })
  await Promise.all(downloads.map(download => writeFile(download.path, download.body)))
  await writeFile(
    join(PUBLIC_DIR, 'wolves-playlist.json'),
    `${JSON.stringify(createManifest(tracks), null, 2)}\n`,
  )
}

if (MODULE_PATH && process.argv[1] && MODULE_PATH === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
