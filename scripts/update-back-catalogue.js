/**
 * Generates public/experiences/catalogue.json: one experience manifest per
 * album published on music.projectbluefin.io (which serves the documentation
 * repo's music page).
 *
 * Source-of-truth mapping (documentation repo -> manifest):
 * - static/data/playlist-metadata.json, published at
 *   https://docs.projectbluefin.io/data/playlist-metadata.json, is the album
 *   index: { id (YouTube playlist id), title, description, thumbnailUrl,
 *   playlistUrl }.
 * - Album cover: https://docs.projectbluefin.io/img/playlists/<id>.jpg,
 *   downloaded byte-for-byte (no re-encode) to public/experiences/<id>.jpg.
 * - The documentation source currently publishes no track lyrics or timed
 *   text, so generated segments intentionally omit captionsText. Never invent
 *   it; add a direct mapping only when the source gains an authored field.
 * - Per-album tracks come from yt-dlp --flat-playlist against playlistUrl:
 *   entry.id -> youtubeId, entry.title -> "Artist - Title" split (uploader
 *   fallback), entry.duration -> durationSeconds, best entry thumbnail ->
 *   original-resolution track artwork URL (never downscaled). Each generated
 *   segment uses the album title as its chapter/status label; track position
 *   remains visible through the runtime's N/total counter.
 *
 * Follows the scripts/update-wolves-playlist.js convention. Idempotent:
 * re-running rewrites the catalogue from current source data, picking up new
 * albums automatically. Run: npm run update:back-catalogue
 */

import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const METADATA_URL = 'https://docs.projectbluefin.io/data/playlist-metadata.json'
const COVER_URL = id => `https://docs.projectbluefin.io/img/playlists/${id}.jpg`
const MODULE_PATH = import.meta.url.startsWith('file:')
  ? fileURLToPath(import.meta.url)
  : null
const ROOT_DIR = MODULE_PATH ? resolve(dirname(MODULE_PATH), '..') : process.cwd()
const EXPERIENCES_DIR = join(ROOT_DIR, 'public', 'experiences')

function bestThumbnail(entry) {
  if (Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
    const last = entry.thumbnails[entry.thumbnails.length - 1]
    if (last && typeof last.url === 'string' && last.url.length > 0) {
      return last.url.split('?')[0]
    }
  }
  return `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`
}

/** Private/deleted/region-locked playlist remnants must never render a card. */
export function isPlayableEntry(entry) {
  return Boolean(entry && typeof entry.id === 'string' && typeof entry.title === 'string')
    && !/^\[?(?:private|deleted|unavailable) video\]?$/i.test(entry.title.trim())
}

const TITLE_JUNK = /\b(?:official\s*(?:music\s*|lyric\s*)?(?:video|audio|visuali[sz]er)?|(?:\d{4}\s*)?remaster(?:ed)?(?:\s*\d{4})?|album version|explicit|full\s*(?:album|video)|4k|hd|hq)\b/i

export function cleanTitle(raw) {
  let title = raw
  for (const pattern of [/\s*\(([^()]*)\)/g, /\s*\[([^[\]]*)\]/g, /\s*\|([^|]*)\|?/g]) {
    let previous
    do {
      previous = title
      title = title.replace(pattern, (match, inner) =>
        TITLE_JUNK.test(inner) && !/\b(?:feat|from|live|cover|instrumental|intro|part)\b/i.test(inner) ? '' : match)
    } while (title !== previous)
  }
  for (const separator of [' - ', ' | ']) {
    let splitAt = title.lastIndexOf(separator)
    while (splitAt >= 0 && TITLE_JUNK.test(title.slice(splitAt + separator.length))) {
      title = title.slice(0, splitAt)
      splitAt = title.lastIndexOf(separator)
    }
  }
  return title.replace(/\s{2,}/g, ' ').replace(/\s+([)\]])/g, '$1').trim()
}

export function cleanArtist(raw) {
  return raw
    .replace(/^Official\s+/i, '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/(?:\s+|(?<=[a-z]))official$/i, '')
    .trim()
}

const TRACK_METADATA_OVERRIDES = {
  '9skBT5TUqzo': { artist: 'Avatar' },
  'C1PtgOWJvWk': { artist: 'Avatar' },
  'Z--vLaXdlgk': { artist: 'The Dark Element' },
  'liYmtzt1lOE': { artist: 'Metric' },
  'nomxKG2nIZU': { artist: 'Lacuna Coil' },
  'NxhBE5taiIU': { artist: 'Puscifer' },
  'ql3bQXbObks': { artist: 'Puscifer' },
  'kXovV2keBP4': { artist: 'Puscifer' },
  'TBnacM1Tbds': { artist: 'The Cranberries' },
  'lSDfCdycdvk': { artist: 'The Cranberries' },
  'nyuo9-OjNNg': { artist: 'Arctic Monkeys' },
  'IOBYFzxfbU0': { artist: 'Plush' },
  'r6L-GUOAhGo': { artist: 'MAPHRA' },
  '_HGZBLdn9_c': { artist: 'Ice Cube' },
  'Ma440BTErHw': { title: 'I Don\'t Like Mondays', artist: 'Tori Amos' },
  'Z6VpX-feA2M': { title: 'Quad Machine', artist: 'Sonic Mayhem' },
}

export function stripArtistPrefix(title, artist) {
  if (!artist || !title.toLowerCase().startsWith(artist.toLowerCase()) || title.length <= artist.length) {
    return title
  }
  let rest = title.slice(artist.length).replace(/^\s*[-/:—·]\s*/, '').trim()
  rest = rest.replace(/^["“]([^"”]+)["”]/, '$1').replace(/\s{2,}/g, ' ').trim()
  return rest.length > 0 ? rest : title
}

function normalizeIdentity(value) {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function buildSegments(entries, chapter) {
  if (!Array.isArray(entries)) {
    throw new TypeError('Malformed yt-dlp output: expected an entries array')
  }
  if (typeof chapter !== 'string' || chapter.trim().length === 0) {
    throw new TypeError('Malformed playlist metadata: expected a title')
  }
  const seenVideoIds = new Set()
  const seenSongs = new Set()
  const segments = []
  for (const entry of entries) {
    if (!isPlayableEntry(entry)) {
      continue
    }
    const cleanedRawTitle = cleanTitle(entry.title)
    const uploader = cleanArtist(entry.uploader ?? entry.channel ?? '')
    const titleParts = cleanedRawTitle.split(' - ')
    const artistPrefix = titleParts.shift() ?? cleanedRawTitle
    const hasArtistPrefix = titleParts.length > 0
    const reversed = hasArtistPrefix
      && uploader.length > 0
      && cleanArtist(titleParts.join(' - ')).toLowerCase() === uploader.toLowerCase()
    const override = TRACK_METADATA_OVERRIDES[entry.id] ?? {}
    const artist = override.artist ?? (reversed
      ? uploader
      : cleanArtist(hasArtistPrefix ? artistPrefix.trim() : uploader))
    const title = override.title ?? stripArtistPrefix(
      reversed ? artistPrefix.trim() : (hasArtistPrefix ? titleParts.join(' - ').trim() : cleanedRawTitle),
      artist,
    )
    const songKey = `${normalizeIdentity(artist)}::${normalizeIdentity(title)}`
    if (seenVideoIds.has(entry.id) || seenSongs.has(songKey)) {
      continue
    }
    seenVideoIds.add(entry.id)
    seenSongs.add(songKey)
    segments.push({
      id: entry.id,
      kind: 'youtube',
      youtubeId: entry.id,
      chapter,
      title,
      artist,
      artwork: bestThumbnail(entry),
      durationSeconds: Math.round(entry.duration ?? 240),
    })
  }
  return segments
}

export function buildExperience(album, entries) {
  return {
    id: album.id,
    title: album.title,
    subtitle: album.description,
    artwork: `experiences/${album.id}.jpg`,
    segments: buildSegments(entries, album.title),
  }
}

function readPlaylistEntries(playlistUrl) {
  const output = execFileSync('yt-dlp', ['--flat-playlist', '--dump-single-json', playlistUrl], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(output).entries
}

async function download(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed for ${url}: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

export async function main() {
  const albums = await (await fetch(METADATA_URL)).json()
  if (!Array.isArray(albums)) {
    throw new TypeError('Malformed playlist metadata: expected an array')
  }

  await mkdir(EXPERIENCES_DIR, { recursive: true })
  const experiences = []
  for (const album of albums) {
    console.info(`Reading ${album.title} (${album.id})`)
    const entries = readPlaylistEntries(album.playlistUrl)
    experiences.push(buildExperience(album, entries))
    await writeFile(join(EXPERIENCES_DIR, `${album.id}.jpg`), await download(COVER_URL(album.id)))
  }

  await writeFile(
    join(EXPERIENCES_DIR, 'catalogue.json'),
    `${JSON.stringify({ experiences }, null, 2)}\n`,
  )
  console.info(`Wrote ${experiences.length} experiences to public/experiences/catalogue.json`)
}

if (MODULE_PATH && process.argv[1] && MODULE_PATH === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
