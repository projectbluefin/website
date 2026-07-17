import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const WOLVES_URL = `${BASE_URL}/wolves/`
const [width, height] = (process.env.WOLVES_VIEWPORT ?? '1440x900').split('x').map(Number)
const VIEWPORT = { width, height }
const SCREENSHOT_DIR = process.env.WOLVES_SCREENSHOT_DIR

if (SCREENSHOT_DIR) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

function expectTruthy(label, value) {
  if (!value) {
    throw new Error(`${label}: expected a truthy value`)
  }
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`)
  }
}

function expectClose(label, actual, expected, tolerance) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${actual} to be within ${tolerance}s of ${expected}`)
  }
}

function expectContained(label, rect, viewport) {
  if (!rect) {
    throw new Error(`${label}: expected bounds`)
  }
  if (rect.left < 0 || rect.top < 0 || rect.right > viewport.width || rect.bottom > viewport.height) {
    throw new Error(`${label}: out of viewport bounds ${JSON.stringify({ rect, viewport })}`)
  }
}

function expectNoOverlap(label, first, second) {
  if (!first || !second) {
    throw new Error(`${label}: expected bounds`)
  }
  const overlaps = !(first.right <= second.left || second.right <= first.left || first.bottom <= second.top || second.bottom <= first.top)
  if (overlaps) {
    throw new Error(`${label}: elements overlap ${JSON.stringify({ first, second })}`)
  }
}

async function capture(page, name) {
  if (!SCREENSHOT_DIR) {
    return
  }
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` })
}

async function nextSegment(page) {
  await page.getByLabel('Next').click()
  await page.waitForTimeout(700)
}

async function readIntroState(page) {
  return page.evaluate(() => ({
    currentTime: window.__wolvesIntro.getCurrentTime(),
    duration: window.__wolvesIntro.getDuration(),
    playerDuration: window.__wolvesIntro.getPlayerDuration(),
    videoId: window.__wolvesIntro.getVideoId(),
    paused: window.__wolvesIntro.isPaused(),
  }))
}

async function assertBounds(page, pausedExpected) {
  const bounds = await page.evaluate(() => {
    const toRect = element => {
      if (!element) {
        return null
      }
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      }
    }

    const mask = document.querySelector('.wolves-intro-overlay-top-left-mask')
    const veil = document.querySelector('.wolves-intro-overlay-pause-veil')
    const toggle = document.querySelector('.wc-widget-toggle')
    const widget = document.querySelector('.wc-widget')

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      mask: toRect(mask),
      veil: toRect(veil),
      toggle: toRect(toggle),
      widget: toRect(widget),
      veilActive: veil?.classList.contains('wolves-intro-overlay-pause-veil-active') ?? false,
      veilDisplay: veil ? getComputedStyle(veil).display : '',
      toggleDisplay: toggle ? getComputedStyle(toggle).display : '',
    }
  })

  expectContained('Top-left mask', bounds.mask, bounds.viewport)
  expectContained('Pause veil', bounds.veil, bounds.viewport)
  expectContained('Voice toggle', bounds.toggle, bounds.viewport)
  expectContained('Widget', bounds.widget, bounds.viewport)
  if (bounds.toggle.left < bounds.widget.left || bounds.toggle.right > bounds.widget.right
    || bounds.toggle.top < bounds.widget.top || bounds.toggle.bottom > bounds.widget.bottom) {
    throw new Error(`Voice toggle escaped widget bounds: ${JSON.stringify(bounds)}`)
  }
  expectEqual('Pause veil display', bounds.veilDisplay, 'block')
  expectEqual('Voice toggle display', bounds.toggleDisplay, 'flex')
  expectEqual('Pause veil active state', bounds.veilActive, pausedExpected)
}

async function assertComicHeroQrLayout(page) {
  const layout = await page.evaluate(() => {
    const toRect = element => {
      if (!element) {
        return null
      }
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      }
    }

    const titleCard = document.querySelector('.wolves-intro-overlay-title-card')
    const heroShot = document.querySelector('[data-comic-hero-shot]')
    const qrCard = document.querySelector('[data-comic-hero-qr-card]')
    const qrLink = document.querySelector('[data-comic-hero-qr-link]')
    const qrImage = document.querySelector('[data-comic-hero-qr-image]')
    const qrDialogue = document.querySelector('[data-comic-hero-qr-dialogue]')
    const qrDomain = document.querySelector('[data-comic-hero-qr-domain]')
    const caption = document.querySelector('.wolves-intro-overlay-burned-caption')
    const widget = document.querySelector('.wc-widget')
    const paidArtists = document.querySelector('[data-comic-hero-paid-artists]')

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      titleCard: toRect(titleCard),
      heroShot: toRect(heroShot),
      qrCard: toRect(qrCard),
      qrLink: toRect(qrLink),
      qrImage: toRect(qrImage),
      qrDialogue: toRect(qrDialogue),
      qrDomain: toRect(qrDomain),
      caption: toRect(caption),
      widget: toRect(widget),
      paidArtists: toRect(paidArtists),
      qrHref: qrLink?.getAttribute('href') ?? '',
      qrLabel: qrLink?.getAttribute('aria-label') ?? '',
      qrAlt: qrImage?.getAttribute('alt') ?? '',
      qrSrc: qrImage?.getAttribute('src') ?? '',
      domainText: qrDomain?.textContent?.trim() ?? '',
      dialogueText: qrDialogue?.textContent?.trim() ?? '',
      paidArtistsText: paidArtists?.textContent?.trim() ?? '',
      qrCardDisplay: qrCard ? getComputedStyle(qrCard).display : '',
      qrLinkDisplay: qrLink ? getComputedStyle(qrLink).display : '',
      qrLinkRadius: qrLink ? getComputedStyle(qrLink).borderRadius : '',
      qrCardRadius: qrCard ? getComputedStyle(qrCard).borderRadius : '',
      paidArtistsTextStrokeWidth: paidArtists ? getComputedStyle(paidArtists).webkitTextStrokeWidth : '',
      paidArtistsFontSize: paidArtists ? getComputedStyle(paidArtists).fontSize : '',
      paidArtistsTextShadow: paidArtists ? getComputedStyle(paidArtists).textShadow : '',
    }
  })

  expectContained('Title card', layout.titleCard, layout.viewport)
  expectContained('Comic hero shot', layout.heroShot, layout.viewport)
  expectContained('Comic hero QR card', layout.qrCard, layout.viewport)
  expectContained('Comic hero QR link', layout.qrLink, layout.viewport)
  expectContained('Comic hero QR image', layout.qrImage, layout.viewport)
  expectContained('Comic hero QR dialogue', layout.qrDialogue, layout.viewport)
  expectContained('Comic hero QR domain', layout.qrDomain, layout.viewport)
  expectEqual('Comic hero QR href', layout.qrHref, 'https://makemeacomic.com')
  expectEqual('Comic hero QR aria label', layout.qrLabel, 'Open makemeacomic.com')
  expectEqual('Comic hero QR alt text', layout.qrAlt, 'QR code linking to makemeacomic.com')
  expectEqual('Comic hero QR domain text', layout.domainText, 'makemeacomic.com')
  expectEqual('Comic hero QR dialogue text', layout.dialogueText, 'Immortalize a Maintainer')
  expectEqual('Comic hero QR card display', layout.qrCardDisplay, 'block')
  expectEqual('Comic hero QR link display', layout.qrLinkDisplay, 'flex')
  expectTruthy(
    'Comic hero QR src is rendered from the SVG import',
    layout.qrSrc.includes('qr-makemeacomic')
    || layout.qrSrc.startsWith('data:image/svg+xml'),
  )
  expectTruthy('Comic hero QR remains large enough to scan', layout.qrImage.width >= (VIEWPORT.width <= 600 ? 150 : 200))
  expectTruthy('Comic hero monitor has rounded corners', Number.parseFloat(layout.qrLinkRadius) >= 20)
  expectTruthy('Comic hero QR screen has rounded corners', Number.parseFloat(layout.qrCardRadius) >= 12)
  expectNoOverlap('Comic hero QR does not cover the Chonky hero shot', layout.heroShot, layout.qrCard)
  expectNoOverlap('Comic hero monitor does not cover the canonical caption', layout.qrLink, layout.caption)
  expectNoOverlap('Comic hero monitor stays above the footer widget', layout.qrLink, layout.widget)
  expectContained('Paid-artists pill', layout.paidArtists, layout.viewport)
  expectEqual('Paid-artists pill text', layout.paidArtistsText, 'Made by Paid Artists')
  expectTruthy(
    `Paid-artists pill must not use the oversized hero-title outline at its own font size (stroke ${layout.paidArtistsTextStrokeWidth} would occlude ${layout.paidArtistsFontSize} glyphs)`,
    Number.parseFloat(layout.paidArtistsTextStrokeWidth) <= 1,
  )
  expectEqual('Paid-artists pill must not carry the hero-title drop shadow', layout.paidArtistsTextShadow, 'none')
}

const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: VIEWPORT })
  await page.goto(WOLVES_URL, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.getByRole('button', { name: /JOIN THE EVOLUTION|BEGIN TRANSMISSION/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 30_000 })

  expectEqual('Voice toggle hidden before Destiny', await page.locator('.wc-widget-toggle').count(), 0)

  await nextSegment(page)
  await page.waitForFunction(() => window.__wolvesIntro?.getVideoId?.() === 'BV3BZKbpBns', null, { timeout: 30_000 })
  await page.waitForFunction(() => window.__wolvesIntro?.getPlayerDuration?.() > 0, null, { timeout: 30_000 })

  const initialState = await readIntroState(page)
  expectEqual('Default Destiny source', initialState.videoId, 'BV3BZKbpBns')
  expectEqual('Default authored cutoff', initialState.duration, 121.5)
  expectEqual('Voice toggle visible on Destiny', await page.locator('.wc-widget-toggle').count(), 1)
  await assertBounds(page, false)

  await page.evaluate(() => window.__wolvesIntro.seekTo(24.2))
  await page.waitForTimeout(900)
  await page.waitForFunction(() => {
    const title = document.querySelector('.wolves-intro-overlay-title-card')
    const caption = document.querySelector('.wolves-intro-overlay-burned-caption')
    return title?.textContent?.includes('Comic Hero Shots of YOU')
      && caption?.textContent?.includes('We know intimately their life spans their mortality despite their resilience')
  }, null, { timeout: 10_000 })
  await assertComicHeroQrLayout(page)
  await capture(page, 'destiny-title-card-qr')

  const beforeVoiceWhilePlaying = await readIntroState(page)
  await page.getByLabel('Ikora voice over').check()
  await page.waitForFunction(() => window.__wolvesIntro?.getVideoId?.() === 'BKm0TPqeOjY', null, { timeout: 30_000 })
  await page.waitForTimeout(1200)
  const afterVoiceWhilePlaying = await readIntroState(page)
  expectEqual('Ikora voiced source enabled', afterVoiceWhilePlaying.videoId, 'BKm0TPqeOjY')
  expectEqual('Voice switch while playing stays playing', afterVoiceWhilePlaying.paused, false)
  expectClose('Voice switch while playing preserves time', afterVoiceWhilePlaying.currentTime, beforeVoiceWhilePlaying.currentTime, 2.0)

  // The voiced BKm0TPqeOjY source is already playing from the assertions above, and the local
  // caption track is authored against its transcript, so verify every retimed tail cue now
  // rather than switching sources again later.
  const retimedTailCues = [
    { at: 66.24, text: 'Now across Last City territory the forces of the Witness search' },
    { at: 72.68, text: 'Our borders are under siege' },
    { at: 75.52, text: 'Does that make us soldiers?' },
    { at: 79.76, text: 'Pushing back buys us only time but the alternative is unthinkable' },
    { at: 86.88, text: 'We built the city none of us dared to dream of with allies from unlikely places' },
    { at: 93.52, text: 'We\'ve never had more to lose' },
    { at: 96.88, text: 'I turn the question to you on the eve of our darkest hour' },
    { at: 103.56, text: 'What is a guardian?' },
    { at: 107.40, text: 'Define us in this moment for all time' },
  ]

  for (const cue of retimedTailCues) {
    await page.evaluate(seconds => window.__wolvesIntro.seekTo(seconds), cue.at + 0.3)
    // Allow settle time for the 200ms getCurrentTime() poll on the real, live player.
    await page.waitForFunction(expected => {
      const caption = document.querySelector('.wolves-intro-overlay-burned-caption')
      return caption?.textContent?.includes(expected)
    }, cue.text, { timeout: 10_000 })
  }
  await capture(page, 'destiny-closing-dialogue')

  // The retimed final cue carries an explicit 112.60s end; past that boundary the closing
  // line must clear rather than holding on the old fabricated 119.0s black-frame caption.
  await page.evaluate(() => window.__wolvesIntro.seekTo(113.2))
  await page.waitForFunction(() => {
    const caption = document.querySelector('.wolves-intro-overlay-burned-caption')
    return !caption?.textContent?.includes('Define us in this moment for all time')
  }, null, { timeout: 10_000 })

  await page.getByLabel('Pause').click()
  await page.waitForFunction(() => window.__wolvesIntro?.isPaused?.() === true, null, { timeout: 10_000 })
  await assertBounds(page, true)
  await capture(page, 'destiny-paused-voice-mask')

  const beforeUnvoiceWhilePaused = await readIntroState(page)
  await page.getByLabel('Ikora voice over').uncheck()
  await page.waitForFunction(() => window.__wolvesIntro?.getVideoId?.() === 'BV3BZKbpBns', null, { timeout: 30_000 })
  await page.waitForFunction(() => window.__wolvesIntro?.isPaused?.() === true, null, { timeout: 10_000 })
  await page.waitForTimeout(500)
  const afterUnvoiceWhilePaused = await readIntroState(page)
  expectEqual('Default source restored', afterUnvoiceWhilePaused.videoId, 'BV3BZKbpBns')
  expectEqual('Voice switch while paused stays paused', afterUnvoiceWhilePaused.paused, true)
  expectClose('Voice switch while paused preserves time', afterUnvoiceWhilePaused.currentTime, beforeUnvoiceWhilePaused.currentTime, 0.5)
}
finally {
  await browser.close()
}
