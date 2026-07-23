import { chromium } from 'playwright'

const baseUrl = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'

async function verifyMobileSoundtrackProgress() {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 } })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))

    await page.goto(`${baseUrl}/wolves/`, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.getByRole('button', { name: /meet your teammates/i }).click()
    await page.waitForSelector('.wc-widget-progress')

    const bounds = await page.evaluate(() => {
      const progress = document.querySelector('.wc-widget-progress')
      const panel = document.querySelector('.wc-widget')
      const controls = document.querySelector('.wc-widget-controls')
      if (!progress || !panel || !controls) {
        throw new Error('Expected media widget, progress bar, and controls')
      }

      return {
        progress: progress.getBoundingClientRect().toJSON(),
        panel: panel.getBoundingClientRect().toJSON(),
        controls: controls.getBoundingClientRect().toJSON(),
      }
    })

    if (bounds.progress.width < bounds.panel.width * 0.8 || bounds.progress.left < 0 || bounds.progress.right > 390) {
      throw new Error(`Mobile soundtrack progress bar is not usable: ${JSON.stringify(bounds.progress)}`)
    }
    if (bounds.controls.left < 0 || bounds.controls.right > 390) {
      throw new Error(`Mobile soundtrack controls are outside the viewport: ${JSON.stringify(bounds.controls)}`)
    }
    if (pageErrors.length > 0) {
      throw new Error(`Mobile Wolves page errors: ${JSON.stringify(pageErrors)}`)
    }
  }
  finally {
    await browser.close()
  }
}

async function verifySourceFragmentLayout() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

    await page.goto(`${baseUrl}/wolves/`, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.getByRole('button', { name: /join the evolution|begin transmission/i }).click()
    await page.waitForTimeout(1_000)
    await page.evaluate(() => {
      document.querySelector('iframe[src*="youtube"]')?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [29.1, true] }),
        '*',
      )
    })
    await page.waitForTimeout(1_000)

    const layout = await page.evaluate(() => {
      const fragment = document.querySelector('[data-lore-view="source-fragment"]')
      const region = document.querySelector('.immersive-col-right')
      if (!fragment || !region) {
        throw new Error('Expected source fragment and immersive lore region')
      }

      return {
        display: getComputedStyle(fragment).display,
        fragmentBottom: fragment.getBoundingClientRect().bottom,
        regionBottom: region.getBoundingClientRect().bottom,
      }
    })

    if (layout.display !== 'flex' || layout.fragmentBottom !== layout.regionBottom) {
      throw new Error(`Source fragment does not fill its lore region: ${JSON.stringify(layout)}`)
    }
  }
  finally {
    await browser.close()
  }
}

async function verifyNewsBulletinLayout() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

    await page.goto(`${baseUrl}/wolves/`, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.getByRole('button', { name: /join the evolution|begin transmission/i }).click()
    await page.waitForTimeout(1_000)
    await page.evaluate(() => {
      document.querySelector('iframe[src*="youtube"]')?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [398, true] }),
        '*',
      )
    })
    await page.waitForTimeout(1_000)

    const layout = await page.evaluate(() => {
      const bulletin = document.querySelector('[data-lore-view="news-bulletin"]')
      const region = document.querySelector('.immersive-col-right')
      if (!bulletin || !region) {
        throw new Error('Expected news bulletin and immersive lore region')
      }

      return {
        display: getComputedStyle(bulletin).display,
        bulletinBottom: bulletin.getBoundingClientRect().bottom,
        regionBottom: region.getBoundingClientRect().bottom,
      }
    })

    if (layout.display !== 'flex' || layout.bulletinBottom !== layout.regionBottom) {
      throw new Error(`News bulletin does not fill its lore region: ${JSON.stringify(layout)}`)
    }
  }
  finally {
    await browser.close()
  }
}

const checks = [verifyMobileSoundtrackProgress()]
if (process.env.WOLVES_SOURCE_CHECK === '1') {
  checks.push(verifySourceFragmentLayout())
  checks.push(verifyNewsBulletinLayout())
}

Promise.all(checks).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
