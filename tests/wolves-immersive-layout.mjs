import { chromium } from 'playwright'

const baseUrl = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'

async function verifyMobileLoreLayout() {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 } })

    await page.goto(`${baseUrl}/wolves/`, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.getByRole('button', { name: /join the evolution/i }).click()
    await page.waitForTimeout(1_000)

    const bounds = await page.evaluate(() => {
      const column = document.querySelector('.wolves-lore-column')
      const region = document.querySelector('.immersive-col-right')
      if (!column || !region) {
        throw new Error('Expected immersive lore column and region')
      }

      return {
        columnBottom: column.getBoundingClientRect().bottom,
        regionBottom: region.getBoundingClientRect().bottom,
      }
    })

    if (bounds.columnBottom > bounds.regionBottom) {
      throw new Error(`Lore column is clipped: ${JSON.stringify(bounds)}`)
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
    await page.getByRole('button', { name: /join the evolution/i }).click()
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

const checks = [verifyMobileLoreLayout()]
if (process.env.WOLVES_SOURCE_CHECK === '1') {
  checks.push(verifySourceFragmentLayout())
}

Promise.all(checks).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
