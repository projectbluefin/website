import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULE_PATH = import.meta.url.startsWith('file:')
  ? fileURLToPath(import.meta.url)
  : null
const ROOT_DIR = MODULE_PATH ? dirname(dirname(MODULE_PATH)) : process.cwd()
const TARGET_PATH = join(ROOT_DIR, 'public', 'flickr-photos.json')

const API_KEY = '49dc70cc62bfcbcde55883993d9121ce'
const USER_ID = '143247548@N03'
const PER_PAGE = 50
const REQUEST_DELAY_MS = 250
const MAX_RETRIES = 4
const MAX_ADDITIONAL_PHOTOS = 100

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

export async function fetchWithRateLimit(url, { retries = MAX_RETRIES, attempt = 0 } = {}) {
  try {
    const res = await fetch(url)

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after')
      const waitSeconds = retryAfter ? Number(retryAfter) : Math.min(2 ** attempt * 2, 60)
      if (attempt < retries) {
        console.warn(`Rate limited (429) for ${url}. Waiting ${waitSeconds}s before retry ${attempt + 1}/${retries}...`)
        await sleep(waitSeconds * 1000)
        return fetchWithRateLimit(url, { retries, attempt: attempt + 1 })
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
      return fetchWithRateLimit(url, { retries, attempt: attempt + 1 })
    }
    throw error
  }
}

function buildFlickrUrl(method, params) {
  const searchParams = new URLSearchParams({
    method,
    api_key: API_KEY,
    user_id: USER_ID,
    format: 'json',
    nojsoncallback: '1',
    ...params,
  })
  return `https://www.flickr.com/services/rest/?${searchParams.toString()}`
}

export async function fetchPhotoPage(method, page, extraParams = {}) {
  const url = buildFlickrUrl(method, {
    per_page: String(PER_PAGE),
    page: String(page),
    ...extraParams,
  })
  const res = await fetchWithRateLimit(url)
  const data = await res.json()
  if (data.stat !== 'ok' || !data.photos || !Array.isArray(data.photos.photo)) {
    throw new Error(`Flickr API error ${method} page ${page}: ${data.message || 'invalid'}`)
  }
  return data.photos
}

export async function loadExistingPhotos() {
  try {
    const raw = await readFile(TARGET_PATH, 'utf8')
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

export function isMainModule() {
  return MODULE_PATH !== null && process.argv[1] === MODULE_PATH
}

async function main() {
  try {
    console.info('Loading existing Flickr photo cache...')
    const existingPhotos = await loadExistingPhotos()
    const existingIds = new Set(existingPhotos.map(p => p.id))
    console.info(`Found ${existingPhotos.length} existing photos.`)

    console.info('Querying CNCF Flickr account metadata...')

    const mMetadata = await fetchPhotoPage('flickr.photos.search', 1, { text: 'Maintainer', per_page: '1' })
    await sleep(REQUEST_DELAY_MS)
    const gMetadata = await fetchPhotoPage('flickr.people.getPublicPhotos', 1, { per_page: '1' })
    await sleep(REQUEST_DELAY_MS)

    const totalMaintainer = Number(mMetadata.total) || 1400
    const totalGeneral = Number(gMetadata.total) || 60000

    console.info(`Found ${totalMaintainer} Maintainer photos and ${totalGeneral} General photos.`)

    const maintainerPages = Math.ceil(totalMaintainer / PER_PAGE)
    const generalPages = Math.ceil(totalGeneral / PER_PAGE)

    // Select extra pages spread across the archive to find up to 100 new unique photos.
    const mTargetPages = selectSpreadPages(maintainerPages, 12)
    const gTargetPages = selectSpreadPages(generalPages, 3)

    console.info(`Fetching Maintainer pages: ${mTargetPages.join(', ')}`)
    console.info(`Fetching General pages: ${gTargetPages.join(', ')}`)

    const newPhotos = []
    const seenIds = new Set(existingIds)

    for (const page of mTargetPages) {
      const data = await fetchPhotoPage('flickr.photos.search', page, { text: 'Maintainer' })
      for (const p of data.photo) {
        if (!seenIds.has(p.id)) {
          newPhotos.push(normalizePhoto(p))
          seenIds.add(p.id)
          if (newPhotos.length >= MAX_ADDITIONAL_PHOTOS) {
            break
          }
        }
      }
      if (newPhotos.length >= MAX_ADDITIONAL_PHOTOS) {
        break
      }
      await sleep(REQUEST_DELAY_MS)
    }

    if (newPhotos.length < MAX_ADDITIONAL_PHOTOS) {
      for (const page of gTargetPages) {
        const data = await fetchPhotoPage('flickr.people.getPublicPhotos', page)
        for (const p of data.photo) {
          if (!seenIds.has(p.id)) {
            newPhotos.push(normalizePhoto(p))
            seenIds.add(p.id)
            if (newPhotos.length >= MAX_ADDITIONAL_PHOTOS) {
              break
            }
          }
        }
        if (newPhotos.length >= MAX_ADDITIONAL_PHOTOS) {
          break
        }
        await sleep(REQUEST_DELAY_MS)
      }
    }

    console.info(`Harvested ${newPhotos.length} new unique photos.`)

    const combinedPhotos = [...existingPhotos, ...newPhotos]
    const shuffledPhotos = shuffleArray(combinedPhotos)

    await writeFile(TARGET_PATH, `${JSON.stringify(shuffledPhotos, null, 2)}\n`)
    console.info(`Successfully updated cache with ${shuffledPhotos.length} photos (${newPhotos.length} new) and saved to public/flickr-photos.json`)
  }
  catch (error) {
    console.error('Error updating Flickr photos:', error)
    try {
      await readFile(TARGET_PATH, 'utf8')
      console.info('Preserving previous cache state of public/flickr-photos.json')
    }
    catch {
      console.info('No previous cache found. Writing empty array to avoid breaking client-side.')
      await writeFile(TARGET_PATH, '[]\n')
    }
  }
}

if (isMainModule()) {
  main()
}
