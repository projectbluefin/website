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
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const METADATA_URL = 'https://docs.projectbluefin.io/data/playlist-metadata.json'
const COVER_URL = id => `https://docs.projectbluefin.io/img/playlists/${id}.jpg`
/** Longest plausible track. Guards against a malformed duration reaching the timeline. */
const MAX_SEGMENT_SECONDS = 60 * 60
const FEATURED_ALBUM_IDS = new Set(['PLA78oiE-RGAE'])
const FEATURED_ALBUM_TITLES = new Set(['Seven Days to the Wolves'])
/**
 * YouTube playlist ids are URL-safe base64. The id is spliced into a cover
 * filename under public/experiences and a cover URL, so anything outside this
 * alphabet (path separators, dots, whitespace) is rejected before either use.
 */
const PLAYLIST_ID_PATTERN = /^[\w-]{1,64}$/
const PLAYLIST_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'music.youtube.com'])
const MODULE_PATH = import.meta.url.startsWith('file:')
  ? fileURLToPath(import.meta.url)
  : null
const ROOT_DIR = MODULE_PATH ? resolve(dirname(MODULE_PATH), '..') : process.cwd()
const EXPERIENCES_DIR = join(ROOT_DIR, 'public', 'experiences')

/**
 * True on a CI runner, where the working tree is a clean checkout plus a restored
 * cache and so can never hold an uncommitted local ingest.
 */
function isCi() {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
}

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
  // The band's own channel name carries the expansion in parentheses; the
  // nameplate has room for the performing name only.
  '4aZX-C8HKJc': { artist: 'Voice of Baceprot' },
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

export function shouldIncludeAlbum(album) {
  if (!album || typeof album !== 'object') {
    return false
  }
  const id = typeof album.id === 'string' ? album.id : ''
  const title = typeof album.title === 'string' ? album.title : ''
  return PLAYLIST_ID_PATTERN.test(id) && !FEATURED_ALBUM_IDS.has(id) && !FEATURED_ALBUM_TITLES.has(title)
}

/**
 * The playlist URL is handed to yt-dlp as a positional argument. yt-dlp parses
 * any argument beginning with `-` as an option, so only an https YouTube URL is
 * accepted; anything else is refused before the process is spawned.
 */
export function isPlaylistUrl(value) {
  if (typeof value !== 'string' || value.startsWith('-')) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && PLAYLIST_HOSTS.has(url.hostname)
  }
  catch {
    return false
  }
}

export function readPlaylistEntries(playlistUrl) {
  if (!isPlaylistUrl(playlistUrl)) {
    throw new TypeError(`Refusing to pass non-YouTube playlist URL to yt-dlp: ${String(playlistUrl)}`)
  }
  const output = execFileSync('yt-dlp', ['--flat-playlist', '--dump-single-json', '--', playlistUrl], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(output).entries
}

export function auditExperience(album, entries, experience) {
  const playableEntries = (Array.isArray(entries) ? entries : []).filter(isPlayableEntry)
  const generatedSegments = Array.isArray(experience?.segments) ? experience.segments : []

  if (playableEntries.length === 0) {
    throw new Error(`Back catalogue audit failed for ${album.title}: no playable entries found`)
  }

  if (generatedSegments.length !== playableEntries.length) {
    throw new Error(`Back catalogue audit failed for ${album.title}: expected ${playableEntries.length} segments, got ${generatedSegments.length}`)
  }

  const expectedIds = playableEntries.map(entry => entry.id)
  const actualIds = generatedSegments.map(segment => segment.id)

  for (const [index, expectedId] of expectedIds.entries()) {
    if (actualIds[index] !== expectedId) {
      throw new Error(`Back catalogue audit failed for ${album.title}: expected ${expectedId} at index ${index}, got ${actualIds[index] ?? 'missing'}`)
    }
  }

  for (const segment of generatedSegments) {
    if (typeof segment.durationSeconds !== 'number' || segment.durationSeconds <= 0) {
      throw new Error(`Back catalogue audit failed for ${album.title}: bad duration for ${segment.id}`)
    }
    if (!Number.isFinite(segment.durationSeconds) || segment.durationSeconds > MAX_SEGMENT_SECONDS) {
      throw new Error(`Back catalogue audit failed for ${album.title}: implausible duration ${segment.durationSeconds}s for ${segment.id}`)
    }
    if (typeof segment.youtubeId !== 'string' || segment.youtubeId.trim().length === 0) {
      throw new Error(`Back catalogue audit failed for ${album.title}: bad youtubeId for ${segment.id}`)
    }
    if (typeof segment.title !== 'string' || segment.title.trim().length === 0) {
      throw new Error(`Back catalogue audit failed for ${album.title}: empty title for ${segment.id}`)
    }
    if (typeof segment.artist !== 'string' || segment.artist.trim().length === 0) {
      throw new Error(`Back catalogue audit failed for ${album.title}: empty artist for ${segment.id}`)
    }
  }
}

export async function download(url, fetchImpl = fetch) {
  const response = await fetchImpl(url)
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
    if (!shouldIncludeAlbum(album)) {
      console.info(`Skipping album ${album?.title} (${album?.id}): featured or malformed id`)
      continue
    }
    console.info(`Reading ${album.title} (${album.id})`)
    const entries = readPlaylistEntries(album.playlistUrl)
    const experience = buildExperience(album, entries)
    auditExperience(album, entries, experience)
    experiences.push(experience)
    await writeFile(join(EXPERIENCES_DIR, `${album.id}.jpg`), await download(COVER_URL(album.id)))
  }

  await writeFile(
    join(EXPERIENCES_DIR, 'catalogue.json'),
    `${JSON.stringify({ experiences }, null, 2)}\n`,
  )
  console.info(`Wrote ${experiences.length} experiences to public/experiences/catalogue.json`)
}

/**
 * Weekly refresh that needs no `yt-dlp`.
 *
 * Reports missing albums rather than failing. A new album published upstream is
 * routine, and this step runs before the cache save and the deploy trigger — so
 * throwing here would discard that week's stream versions, Dakota versions,
 * growth chart and Flickr refresh over a cosmetic gap in one grid. The caller
 * escalates afterwards, via MISSING_ALBUMS_FILE, once the pipeline has run.
 *
 * Album prose (title, subtitle) and cover art change upstream far more often
 * than tracklists do, and refreshing them is a plain `fetch`. Track ingestion
 * scrapes YouTube, which is rate-limited and unreliable from CI, so it stays a
 * deliberate manual step.
 *
 * An album published upstream but absent from the catalogue cannot be filled in
 * without that scrape, so this exits non-zero and names the command to run. The
 * caller's failure handler turns that into an issue rather than letting the
 * grid quietly go stale — which is exactly what happened before this existed.
 */
export async function refreshMetadata(options = {}) {
  const fetchImpl = options.fetch ?? fetch
  const readFileImpl = options.readFile ?? readFile
  const writeFileImpl = options.writeFile ?? writeFile
  const experiencesDir = options.experiencesDir ?? EXPERIENCES_DIR
  const cataloguePath = options.cataloguePath ?? join(experiencesDir, 'catalogue.json')
  const metadataUrl = options.metadataUrl ?? METADATA_URL

  const albums = await (await fetchImpl(metadataUrl)).json()
  if (!Array.isArray(albums)) {
    throw new TypeError('Malformed playlist metadata: expected an array')
  }

  const existing = JSON.parse(await readFileImpl(cataloguePath, 'utf8'))
  if (!Array.isArray(existing?.experiences)) {
    throw new TypeError('Malformed catalogue.json: expected an experiences array')
  }

  // If a restored cache or dirty state lacks albums or committed edits that exist in git HEAD,
  // recover/prefer them from the repository so a stale cache never causes an ingest failure
  // or clobbers committed tracklist/segment edits.
  //
  // Overwriting an on-disk entry with the git HEAD copy is only safe in CI, where the working
  // tree is a clean checkout plus a restored cache, so any divergence is stale cache data.
  // Locally the working tree may hold an uncommitted ingest (a freshly scraped album with new
  // segments), and clobbering it with HEAD would silently discard that manual scrape. Outside
  // CI we therefore only add albums missing from disk and never replace existing entries.
  const preferGitEntries = options.preferGitEntries ?? isCi()
  try {
    let gitOutput = null
    try {
      gitOutput = typeof options.gitShow === 'function'
        ? options.gitShow()
        : execFileSync('git', ['show', 'HEAD:public/experiences/catalogue.json'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
          })
    }
    catch {
      // Non-git environment or git show failed; rely on disk.
    }
    if (gitOutput) {
      const gitCatalogue = JSON.parse(gitOutput)
      if (Array.isArray(gitCatalogue?.experiences)) {
        const diskIndices = new Map(existing.experiences.map((experience, idx) => [experience.id, idx]))
        for (const exp of gitCatalogue.experiences) {
          if (diskIndices.has(exp.id)) {
            // Prefer the git HEAD entry so committed edits (segments, tracklist) are preserved,
            // but only in CI: locally the on-disk entry may be an uncommitted fresh ingest.
            if (preferGitEntries) {
              const idx = diskIndices.get(exp.id)
              existing.experiences[idx] = exp
            }
          }
          else {
            existing.experiences.push(exp)
            diskIndices.set(exp.id, existing.experiences.length - 1)
          }
        }
      }
    }
  }
  catch (error) {
    console.warn(`[refreshMetadata] Failed to parse or recover catalogue from git HEAD: ${error?.message || error}`)
  }

  const byId = new Map(existing.experiences.map(experience => [experience.id, experience]))
  const missing = []
  let updated = 0

  for (const album of albums) {
    if (!shouldIncludeAlbum(album)) {
      continue
    }
    const experience = byId.get(album.id)
    if (!experience) {
      missing.push(album)
      continue
    }
    if (experience.title !== album.title || experience.subtitle !== album.description) {
      console.info(`Updating prose for ${album.title} (${album.id})`)
      experience.title = album.title
      experience.subtitle = album.description
      updated++
    }
    await writeFileImpl(join(experiencesDir, `${album.id}.jpg`), await download(COVER_URL(album.id), fetchImpl))
  }

  await writeFileImpl(cataloguePath, `${JSON.stringify(existing, null, 2)}\n`)
  console.info(`Refreshed ${byId.size} album covers; ${updated} prose updates.`)

  if (missing.length > 0) {
    for (const album of missing) {
      console.warn(`Album not in the catalogue: ${album.title} (${album.id})`)
    }
    console.warn(`${missing.length} album(s) need a full ingest: run "npm run update:back-catalogue" locally with yt-dlp installed.`)
    const missingAlbumsFile = options.missingAlbumsFile ?? process.env.MISSING_ALBUMS_FILE
    if (missingAlbumsFile) {
      await writeFileImpl(
        missingAlbumsFile,
        `${missing.map(album => `${album.title} (${album.id})`).join('\n')}\n`,
      )
    }
  }

  return { missing }
}

if (MODULE_PATH && process.argv[1] && MODULE_PATH === resolve(process.argv[1])) {
  const run = process.argv.includes('--metadata-only') ? refreshMetadata : main
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
