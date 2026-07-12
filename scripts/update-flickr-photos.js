import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULE_PATH = import.meta.url.startsWith('file:')
  ? fileURLToPath(import.meta.url)
  : null
const ROOT_DIR = MODULE_PATH ? dirname(dirname(MODULE_PATH)) : process.cwd()
const TARGET_PATH = join(ROOT_DIR, 'public', 'flickr-photos.json')

function shuffleArray(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

async function main() {
  const apiKey = 'af8e5133eba9983c235490e3799abe1f'
  const userId = '143247548@N03'

  try {
    console.info('Querying CNCF Flickr account metadata...')

    // 1. Get total count of Maintainer photos (from flickr.photos.search)
    const mSearchUrl = `https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${apiKey}&user_id=${userId}&text=Maintainer&per_page=1&format=json&nojsoncallback=1`
    const mRes = await fetch(mSearchUrl)
    if (!mRes.ok)
      throw new Error(`Flickr Maintainer metadata error: ${mRes.status}`)
    const mData = await mRes.json()
    if (mData.stat !== 'ok' || !mData.photos) {
      throw new Error(`Flickr Maintainer API error: ${mData.message || 'invalid response'}`)
    }
    const totalMaintainer = Number(mData.photos.total) || 1400

    // 2. Get total count of General public photos
    const gSearchUrl = `https://www.flickr.com/services/rest/?method=flickr.people.getPublicPhotos&api_key=${apiKey}&user_id=${userId}&per_page=1&format=json&nojsoncallback=1`
    const gRes = await fetch(gSearchUrl)
    if (!gRes.ok)
      throw new Error(`Flickr General metadata error: ${gRes.status}`)
    const gData = await gRes.json()
    if (gData.stat !== 'ok' || !gData.photos) {
      throw new Error(`Flickr General API error: ${gData.message || 'invalid response'}`)
    }
    const totalGeneral = Number(gData.photos.total) || 60000

    console.info(`Found ${totalMaintainer} Maintainer photos and ${totalGeneral} General photos.`)

    const perPage = 50
    const maintainerPages = Math.ceil(totalMaintainer / perPage)
    const generalPages = Math.ceil(totalGeneral / perPage)

    // Select 8 Maintainer pages spread evenly to fetch ~400 maintainer photos (the bulk!)
    const mTargetPages = []
    const numMPages = 8
    for (let i = 0; i < numMPages; i++) {
      const pageNum = Math.max(1, Math.floor(1 + (i * (maintainerPages - 1)) / (numMPages - 1)))
      if (!mTargetPages.includes(pageNum)) {
        mTargetPages.push(pageNum)
      }
    }

    // Select 2 General pages spread evenly to fetch ~100 general/community/showcase photos
    const gTargetPages = []
    const numGPages = 2
    for (let i = 0; i < numGPages; i++) {
      const pageNum = Math.max(1, Math.floor(1 + (generalPages - 1) * (i / (numGPages - 1))))
      if (!gTargetPages.includes(pageNum)) {
        gTargetPages.push(pageNum)
      }
    }

    console.info(`Fetching Maintainer pages: ${mTargetPages.join(', ')}`)
    console.info(`Fetching General pages: ${gTargetPages.join(', ')}`)

    // Build parallel promises
    const promises = [
      ...mTargetPages.map(async (page) => {
        const url = `https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${apiKey}&user_id=${userId}&text=Maintainer&per_page=${perPage}&page=${page}&format=json&nojsoncallback=1`
        const res = await fetch(url)
        if (!res.ok)
          throw new Error(`HTTP error Maintainer page ${page}: ${res.status}`)
        const data = await res.json()
        if (data.stat !== 'ok' || !data.photos || !Array.isArray(data.photos.photo)) {
          throw new Error(`Flickr API error Maintainer page ${page}: ${data.message || 'invalid'}`)
        }
        return data.photos.photo
      }),
      ...gTargetPages.map(async (page) => {
        const url = `https://www.flickr.com/services/rest/?method=flickr.people.getPublicPhotos&api_key=${apiKey}&user_id=${userId}&per_page=${perPage}&page=${page}&format=json&nojsoncallback=1`
        const res = await fetch(url)
        if (!res.ok)
          throw new Error(`HTTP error General page ${page}: ${res.status}`)
        const data = await res.json()
        if (data.stat !== 'ok' || !data.photos || !Array.isArray(data.photos.photo)) {
          throw new Error(`Flickr API error General page ${page}: ${data.message || 'invalid'}`)
        }
        return data.photos.photo
      })
    ]

    const pageResults = await Promise.all(promises)
    const rawPhotos = pageResults.flat()

    const photos = rawPhotos.map(p => ({
      id: p.id,
      server: p.server,
      secret: p.secret,
      title: p.title,
    }))

    // Remove duplicates if any (by id)
    const uniquePhotosMap = new Map()
    for (const photo of photos) {
      uniquePhotosMap.set(photo.id, photo)
    }
    const uniquePhotos = Array.from(uniquePhotosMap.values())

    // Shuffle the final list to guarantee rich diversity in the cached file
    const shuffledPhotos = shuffleArray(uniquePhotos)

    await writeFile(TARGET_PATH, `${JSON.stringify(shuffledPhotos, null, 2)}\n`)
    console.info(`Successfully harvested and shuffled ${shuffledPhotos.length} highly diverse, maintainer-focused photos and saved to public/flickr-photos.json`)
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

main()
