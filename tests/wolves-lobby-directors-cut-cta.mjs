import { chromium } from 'playwright'

const baseUrl = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'

/**
 * Bounds-check the Director's Cut CTA teaser block at a fixed lobby layout:
 * readable nonzero size, no overlap with Jorge's quote above it or the QR
 * code / back-catalogue stack below it. Follows the convention set by
 * `wolves-immersive-layout.mjs`: launch Chromium headless, land straight on
 * the lobby (`store.phase` defaults to `'lobby'`, so no click is needed to
 * reach the CTA), and read `getBoundingClientRect()` directly.
 */
async function verifyDirectorsCutCtaBounds(viewport) {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))

    await page.goto(`${baseUrl}/wolves/experience/`, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.waitForSelector('.wc-lobby-directors-cut', { state: 'attached', timeout: 30_000 })

    const bounds = await page.evaluate(() => {
      const quote = document.querySelector('.wc-lobby-quote')
      const directorsCut = document.querySelector('.wc-lobby-directors-cut')
      const qrCodes = document.querySelector('.qr-grid')
      if (!quote || !directorsCut || !qrCodes) {
        throw new Error('Expected Jorge\'s quote, the Director\'s Cut teaser, and the QR code grid')
      }

      return {
        quote: quote.getBoundingClientRect().toJSON(),
        directorsCut: directorsCut.getBoundingClientRect().toJSON(),
        qrCodes: qrCodes.getBoundingClientRect().toJSON(),
      }
    })

    const { quote, directorsCut, qrCodes } = bounds

    if (directorsCut.width <= 0 || directorsCut.height <= 0) {
      throw new Error(`Director's Cut teaser has no readable bounds at ${JSON.stringify(viewport)}: ${JSON.stringify(directorsCut)}`)
    }
    if (directorsCut.left < 0 || directorsCut.right > viewport.width) {
      throw new Error(`Director's Cut teaser overflows the ${viewport.width}px viewport: ${JSON.stringify(directorsCut)}`)
    }
    // The three blocks stack vertically in normal document flow; "no overlap"
    // means the quote's bottom edge is at or above the teaser's top edge, and
    // the teaser's bottom edge is at or above the QR grid's top edge.
    if (quote.bottom > directorsCut.top) {
      throw new Error(`Director's Cut teaser overlaps Jorge's quote at ${JSON.stringify(viewport)}: quote=${JSON.stringify(quote)} directorsCut=${JSON.stringify(directorsCut)}`)
    }
    if (directorsCut.bottom > qrCodes.top) {
      throw new Error(`Director's Cut teaser overlaps the QR code grid at ${JSON.stringify(viewport)}: directorsCut=${JSON.stringify(directorsCut)} qrCodes=${JSON.stringify(qrCodes)}`)
    }
    if (pageErrors.length > 0) {
      throw new Error(`Wolves lobby page errors at ${JSON.stringify(viewport)}: ${JSON.stringify(pageErrors)}`)
    }
  }
  finally {
    await browser.close()
  }
}

const checks = [
  verifyDirectorsCutCtaBounds({ width: 1440, height: 900 }),
  verifyDirectorsCutCtaBounds({ width: 390, height: 1000 }),
]

Promise.all(checks).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
