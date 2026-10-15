import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULE_PATH = import.meta.url.startsWith('file:')
  ? fileURLToPath(import.meta.url)
  : null
const ROOT_DIR = MODULE_PATH ? dirname(dirname(MODULE_PATH)) : process.cwd()
const TARGET_PATH = join(ROOT_DIR, 'public', 'flickr-photos.json')
const CONFIG_PATH = join(ROOT_DIR, 'scripts', 'flickr-curation.json')

const DEFAULT_CONFIG = {
  userId: '143247548@N03',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  requestDelayMs: 250,
  maxRetries: 4,
  maxPagesPerAlbum: 4,
  maxPhotosPerAlbum: 40,
  maxPhotosPerTitleFamily: 8,
  targetTotalPhotos: 200,
  albums: [],
  peopleFirst: {
    allowPatterns: [],
    blockPatterns: [],
  },
}

export function shuffleArray(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchWithRateLimit(url, { retries = DEFAULT_CONFIG.maxRetries, attempt = 0, userAgent = DEFAULT_CONFIG.userAgent } = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after')
      const waitSeconds = retryAfter ? Number(retryAfter) : Math.min(2 ** attempt * 2, 60)
      if (attempt < retries) {
        console.warn(`Rate limited (429) for ${url}. Waiting ${waitSeconds}s before retry ${attempt + 1}/${retries}...`)
        await sleep(waitSeconds * 1000)
        return fetchWithRateLimit(url, { retries, attempt: attempt + 1, userAgent })
      }
      throw new Error(`HTTP error 429 after ${retries} retries: ${url}`)
    }

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${url}`)
    }

    return res
  }
  catch (error) {
    if (attempt < retries) {
      const backoffMs = Math.min(2 ** attempt * 1000, 30000)
      console.warn(`Fetch failed for ${url}, retrying in ${backoffMs}ms...`, error.message)
      await sleep(backoffMs)
      return fetchWithRateLimit(url, { retries, attempt: attempt + 1, userAgent })
    }
    throw error
  }
}

export async function loadCurationConfig(configPath = CONFIG_PATH) {
  try {
    const raw = await readFile(configPath, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      peopleFirst: {
        ...DEFAULT_CONFIG.peopleFirst,
        ...(parsed.peopleFirst || {}),
      },
    }
  }
  catch (error) {
    console.warn(`Failed to load curation config at ${configPath}: ${error.message}. Using defaults.`)
    return { ...DEFAULT_CONFIG }
  }
}

export async function loadExistingPhotos(targetPath = TARGET_PATH) {
  try {
    const raw = await readFile(targetPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
  }
  catch {
    console.info('No existing flickr-photos.json found or invalid, starting fresh.')
  }
  return []
}

export function selectSpreadPages(totalPages, count) {
  const pages = []
  if (count <= 0) {
    return pages
  }
  if (count === 1) {
    return [1]
  }
  for (let i = 0; i < count; i++) {
    const pageNum = Math.max(1, Math.floor(1 + (i * (totalPages - 1)) / (count - 1)))
    if (!pages.includes(pageNum)) {
      pages.push(pageNum)
    }
  }
  return pages
}

export function normalizePhoto(p) {
  return {
    id: p.id,
    server: p.server,
    secret: p.secret,
    title: p.title,
  }
}

/**
 * Builds a fresh gallery cache from the current album scrape. No prior cache
 * entries survive, so the weekly job rotates in newly published summit photos.
 */
export function selectFreshPhotos(candidates, targetTotalPhotos) {
  const seenIds = new Set()
  const photos = []
  for (const candidate of candidates) {
    if (seenIds.has(candidate.id)) {
      continue
    }
    seenIds.add(candidate.id)
    photos.push(normalizePhoto(candidate))
    if (photos.length >= targetTotalPhotos) {
      break
    }
  }
  return shuffleArray(photos)
}

export function buildAlbumPageUrl(albumId, userId, page = 1) {
  const base = `https://www.flickr.com/photos/${userId}/albums/${albumId}`
  return page > 1 ? `${base}/page${page}` : base
}

export function extractPhotosFromAlbumHtml(html) {
  if (typeof html !== 'string') {
    return []
  }

  const photos = []
  const seen = new Set()

  // Each photo card contains an img whose src is:
  // //live.staticflickr.com/{server}/{id}_{secret}.jpg
  // and a nearby title link/photo-link with the title text.
  const cardPattern = /<div[^>]*class="view photo-card-view[^"]*"[^>]*>/gi

  let cardMatch = cardPattern.exec(html)
  while (cardMatch !== null) {
    const start = cardMatch.index
    // Approximate the card block by scanning to the next photo-card-view or a safe limit.
    let end = html.indexOf('<div  class="view photo-card-view', start + 1)
    if (end === -1) {
      end = start + 4000
    }
    const block = html.slice(start, end)

    const srcMatch = block.match(/<img[^>]+src="(?:https?:)?\/\/live\.staticflickr\.com\/(\d+)\/(\d+)_(.+?)\.jpg"/i)
    const titleMatch = block.match(/<a[^>]*class="title"[^>]*>([^<]*)<\/a>/i)
      || block.match(/<a[^>]*class="photo-link"[^>]*title="([^"]*)"/i)

    if (srcMatch) {
      const server = srcMatch[1]
      const id = srcMatch[2]
      const secret = srcMatch[3]
      const title = titleMatch ? titleMatch[1].trim() : ''

      if (!seen.has(id)) {
        seen.add(id)
        photos.push({ id, server, secret, title })
      }
    }

    cardMatch = cardPattern.exec(html)
  }

  return photos
}

export function countAlbumPages(html) {
  if (typeof html !== 'string') {
    return 1
  }
  const matches = html.match(/href="[^"]*\/albums\/\d+\/page(\d+)"/g)
  if (!matches) {
    return 1
  }
  let maxPage = 1
  for (const match of matches) {
    const pageMatch = match.match(/page(\d+)/)
    if (pageMatch) {
      maxPage = Math.max(maxPage, Number(pageMatch[1]))
    }
  }
  return maxPage
}

export function isPeopleFirstPhoto(photo, config) {
  const title = String(photo.title || '').toLowerCase()
  const blockPatterns = (config.peopleFirst?.blockPatterns || []).map(p => p.toLowerCase())
  for (const pattern of blockPatterns) {
    if (pattern && title.includes(pattern)) {
      return false
    }
  }
  const allowPatterns = (config.peopleFirst?.allowPatterns || []).map(p => p.toLowerCase())
  for (const pattern of allowPatterns) {
    if (pattern && title.includes(pattern)) {
      return true
    }
  }
  return false
}

export function computeTitleFamily(title) {
  let family = String(title || '').trim()
  let previous
  do {
    previous = family
    family = family
      .replace(/_\d+$/g, '')
      .replace(/_[A-Z]{2,}(?:-[A-Z]{2,})?$/g, '')
      .replace(/\s+\d+$/g, '')
      .trim()
  } while (family !== previous)
  return family || title
}

export function diversifyByTitleFamily(photos, maxPerFamily) {
  if (maxPerFamily <= 0) {
    return photos
  }
  const familyCounts = new Map()
  const result = []
  for (const photo of photos) {
    const family = computeTitleFamily(photo.title)
    const count = familyCounts.get(family) || 0
    if (count < maxPerFamily) {
      result.push(photo)
      familyCounts.set(family, count + 1)
    }
  }
  return result
}

export function isMainModule() {
  return MODULE_PATH !== null && process.argv[1] === MODULE_PATH
}

export async function scrapeAlbum(album, config, fetcher = fetchWithRateLimit) {
  const photos = []
  const seenIds = new Set()
  const userId = config.userId || DEFAULT_CONFIG.userId

  const firstPageUrl = buildAlbumPageUrl(album.id, userId, 1)
  const firstRes = await fetcher(firstPageUrl, { userAgent: config.userAgent })
  if (!firstRes.ok) {
    throw new Error(`HTTP error ${firstRes.status}: ${firstPageUrl}`)
  }
  const firstHtml = await firstRes.text()
  const totalPages = countAlbumPages(firstHtml)
  const targetPages = selectSpreadPages(totalPages, config.maxPagesPerAlbum)
  const pageHtmlCache = new Map([[1, firstHtml]])

  for (const page of targetPages) {
    let html = pageHtmlCache.get(page)
    if (!html) {
      const url = buildAlbumPageUrl(album.id, userId, page)
      const res = await fetcher(url, { userAgent: config.userAgent })
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${url}`)
      }
      html = await res.text()
    }
    const pagePhotos = extractPhotosFromAlbumHtml(html)
    for (const p of pagePhotos) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id)
        photos.push({ ...p, albumId: album.id, albumTitle: album.title })
      }
    }
    if (page !== targetPages[targetPages.length - 1]) {
      await sleep(config.requestDelayMs)
    }
  }

  return photos
}

/**
 * Rebuilds the gallery cache. A run that collects no photos at all (every
 * album failed, or Flickr's markup stopped matching) is a failed refresh, not
 * an empty gallery: the previous cache is kept rather than replaced with [].
 */
export async function updateFlickrPhotos({
  configPath = CONFIG_PATH,
  targetPath = TARGET_PATH,
  fetcher = fetchWithRateLimit,
} = {}) {
  try {
    const config = await loadCurationConfig(configPath)

    if (!config.albums || config.albums.length === 0) {
      throw new Error('No curated albums configured in scripts/flickr-curation.json')
    }

    console.info(`Scraping ${config.albums.length} curated album(s)...`)
    const allCandidates = []

    for (const album of config.albums) {
      console.info(`Album: ${album.title || album.id}`)
      try {
        const albumPhotos = await scrapeAlbum(album, config, fetcher)
        console.info(`  ${albumPhotos.length} raw photos scraped`)
        const peopleFirstPhotos = albumPhotos.filter(p => isPeopleFirstPhoto(p, config))
        console.info(`  ${peopleFirstPhotos.length} passed people-first filter`)
        const diversified = diversifyByTitleFamily(peopleFirstPhotos, config.maxPhotosPerTitleFamily)
        console.info(`  ${diversified.length} after title-family diversification`)
        const capped = diversified.slice(0, config.maxPhotosPerAlbum)
        allCandidates.push(...capped)
      }
      catch (error) {
        console.warn(`  Failed to scrape album ${album.title || album.id}:`, error.message)
      }
    }

    const shuffledPhotos = selectFreshPhotos(allCandidates, config.targetTotalPhotos)
    if (shuffledPhotos.length === 0) {
      throw new Error('No photos collected from any curated album')
    }
    console.info(`Selected ${shuffledPhotos.length} fresh unique photos from curated albums.`)

    await writeFile(targetPath, `${JSON.stringify(shuffledPhotos, null, 2)}\n`)
    console.info(`Successfully rebuilt cache with ${shuffledPhotos.length} photos and saved to public/flickr-photos.json`)
  }
  catch (error) {
    console.error('Error updating Flickr photos:', error)
    try {
      await readFile(targetPath, 'utf8')
      console.info('Preserving previous cache state of public/flickr-photos.json')
    }
    catch {
      console.info('No previous cache found. Writing empty array to avoid breaking client-side.')
      await writeFile(targetPath, '[]\n')
    }
  }
}

if (isMainModule()) {
  updateFlickrPhotos()
}
