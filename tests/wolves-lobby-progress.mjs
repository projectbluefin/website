import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const WOLVES_URL = `${BASE_URL}/wolves/`
const [width, height] = (process.env.WOLVES_VIEWPORT ?? '1440x900').split('x').map(Number)
const VIEWPORT = { width, height }
const SCREENSHOT_DIR = process.env.WOLVES_SCREENSHOT_DIR

const INTRO_DURATION = 213.5
const OVERALL_DURATION = 2317.5
const PART_VII_START = 2046.5
const DESTINY_SEEK_ELAPSED = 156

let passed = 0
let failed = 0

function assert(label, actual, expected) {
  const ok = actual === expected
  if (ok) {
    passed++
    console.log(`  PASS  ${label}`)
    console.log(`        got: ${actual}`)
  }
  else {
    failed++
    console.error(`  FAIL  ${label}`)
    console.error(`        expected: ${expected}`)
    console.error(`        got:      ${actual}`)
  }
  return ok
}

function assertTruthy(label, actual) {
  const ok = Boolean(actual)
  if (ok) {
    passed++
    console.log(`  PASS  ${label}`)
  }
  else {
    failed++
    console.error(`  FAIL  ${label}`)
    console.error(`        expected a truthy value, got: ${actual}`)
  }
  return ok
}

function assertWithin(label, actual, min, max) {
  const ok = actual >= min && actual <= max
  if (ok) {
    passed++
    console.log(`  PASS  ${label}`)
    console.log(`        got: ${actual}`)
  }
  else {
    failed++
    console.error(`  FAIL  ${label}`)
    console.error(`        expected: ${min} <= value <= ${max}`)
    console.error(`        got:      ${actual}`)
  }
  return ok
}

async function capture(page, name) {
  if (SCREENSHOT_DIR) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` })
  }
}

async function clickOverallRatio(page, ratio) {
  await page.evaluate((targetRatio) => {
    const progress = document.querySelector('.wc-widget-progress')
    if (!(progress instanceof HTMLElement)) {
      throw new Error('Progress bar unavailable')
    }
    const rect = progress.getBoundingClientRect()
    progress.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width * targetRatio,
      clientY: rect.top + rect.height / 2,
    }))
  }, ratio)
}

const browser = await chromium.launch({ headless: true })
let exitCode = 0

try {
  const page = await browser.newPage({ viewport: VIEWPORT })

  await page.addInitScript(() => {
    const durations = {
      EB3IokHelRk: 94,
      BV3BZKbpBns: 123.221,
      BKm0TPqeOjY: 120.221,
      LASru9j0oIc: 424,
      amKIngGUvCk: 347,
      '9skBT5TUqzo': 251,
      'Z--vLaXdlgk': 384,
      '5OFLFVC11Cg': 193,
      san94Q93IcY: 234,
      rYkYLIYvI18: 271,
    }

    Math.random = () => 0
    window.__mockWolvesPlayers = []
    window.YT = {
      Player: class MockPlayer {
        constructor(element, config) {
          this.config = config
          this.element = element
          this.videoId = config.videoId ?? null
          this.currentTime = config.playerVars?.start ?? 0
          this.volume = 100
          this.state = window.YT.PlayerState.CUED
          this.destroyed = false
          window.__mockWolvesPlayers.push(this)
          Promise.resolve().then(() => {
            this.config.events?.onReady?.({ target: this })
            this.playVideo()
          })
        }

        playVideo() {
          this.state = window.YT.PlayerState.PLAYING
          this.config.events?.onStateChange?.({ data: this.state, target: this })
        }

        pauseVideo() {
          this.state = window.YT.PlayerState.PAUSED
          this.config.events?.onStateChange?.({ data: this.state, target: this })
        }

        loadVideoById(video) {
          const payload = typeof video === 'string' ? { videoId: video, startSeconds: 0 } : video
          this.videoId = payload.videoId
          this.currentTime = payload.startSeconds ?? 0
          this.playVideo()
        }

        cueVideoById(video) {
          const payload = typeof video === 'string' ? { videoId: video, startSeconds: 0 } : video
          this.videoId = payload.videoId
          this.currentTime = payload.startSeconds ?? 0
        }

        seekTo(seconds) {
          this.currentTime = seconds
        }

        getCurrentTime() {
          return this.currentTime
        }

        getDuration() {
          return durations[this.videoId] ?? 500
        }

        setVolume(volume) {
          this.volume = volume
        }

        getVolume() {
          return this.volume
        }

        mute() {
          this.volume = 0
        }

        destroy() {
          this.destroyed = true
        }
      },
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    }

    if (!window.onYouTubeIframeAPIReady) {
      window.onYouTubeIframeAPIReady = () => {}
    }
  })

  console.log(`\nWolves lobby/progress browser test`)
  console.log(`  URL:      ${WOLVES_URL}`)
  console.log(`  Viewport: ${VIEWPORT.width}x${VIEWPORT.height}\n`)

  try {
    await page.goto(WOLVES_URL, { waitUntil: 'networkidle', timeout: 30_000 })
  }
  catch {}
  await page.waitForTimeout(1000)

  const lobbyMetrics = await page.locator('.wc-lobby-frame').evaluate((frame) => {
    const title = frame.querySelector('.wc-lobby-title')
    const brand = frame.querySelector('.wc-lobby-brand')
    const titleRect = title?.getBoundingClientRect()
    const frameRect = frame.getBoundingClientRect()
    return {
      titleFontSize: Number.parseFloat(getComputedStyle(title).fontSize),
      brandFontSize: Number.parseFloat(getComputedStyle(brand).fontSize),
      titleFits: Boolean(titleRect && titleRect.left >= frameRect.left - 2 && titleRect.right <= frameRect.right + 24),
      brandFits: Boolean(brand && brand.scrollWidth <= brand.clientWidth + 1),
    }
  })
  assertWithin('Lobby title uses theater-scale typography', lobbyMetrics.titleFontSize, width < 600 ? 44 : 72, 140)
  assertWithin('Lobby brand label scales up with the title', lobbyMetrics.brandFontSize, width < 600 ? 14 : 15, 24)
  assert('Lobby title fits inside the frame', lobbyMetrics.titleFits, true)
  assert('Lobby brand label fits inside the frame', lobbyMetrics.brandFits, true)
  await capture(page, '01-lobby')

  await page.getByRole('button', { name: /JOIN THE EVOLUTION|BEGIN TRANSMISSION/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 10_000 })

  const introTelemetry = await page.locator('.wc-widget').evaluate((widget) => {
    const telemetry = widget.querySelector('.wc-widget-telemetry')
    return {
      height: widget.getBoundingClientRect().height,
      telemetryVisible: Boolean(telemetry && getComputedStyle(telemetry).display !== 'none'),
      text: widget.textContent ?? '',
    }
  })
  assertWithin('Intro footer stays within the 140px budget', introTelemetry.height, 0, 140)
  assert('Intro telemetry stays visible', introTelemetry.telemetryVisible, true)
  assertTruthy('Intro telemetry shows the deployment label', introTelemetry.text.includes('DEPLOYMENT: wolves-decryption-engine-7'))
  await capture(page, '02-intro-prologue')

  await clickOverallRatio(page, (INTRO_DURATION + 20) / OVERALL_DURATION)
  await page.waitForSelector('.wc-trackzero-grid', { state: 'visible', timeout: 10_000 })
  await page.waitForFunction(
    () => document.querySelector('.wc-widget-title')?.textContent?.includes('7 Days to the Wolves'),
    null,
    { timeout: 10_000 },
  )

  const partIMetrics = await page.locator('.wc-trackzero-grid').evaluate((grid) => {
    const widget = document.querySelector('.wc-widget')
    const viewer = grid.querySelector('.wc-trackzero-viewer')
    const lore = grid.querySelector('.wc-trackzero-lore')
    const viewerRect = viewer?.getBoundingClientRect()
    const loreRect = lore?.getBoundingClientRect()
    return {
      widgetHeight: widget?.getBoundingClientRect().height ?? 0,
      viewerWidth: viewerRect?.width ?? 0,
      loreWidth: loreRect?.width ?? 0,
      templateColumns: getComputedStyle(grid).gridTemplateColumns,
    }
  })
  assertWithin('Part I footer stays within the 140px budget', partIMetrics.widgetHeight, 0, 140)
  if (width >= 1024) {
    assertTruthy(
      'Part I preserves the authored 2fr/1fr split',
      partIMetrics.loreWidth > 0 && partIMetrics.viewerWidth / partIMetrics.loreWidth > 1.8 && partIMetrics.viewerWidth / partIMetrics.loreWidth < 2.2,
    )
  }
  assertTruthy('Part I still renders a grid template', partIMetrics.templateColumns.length > 0)
  const partISeek = await page.evaluate((overallDuration) => {
    const progressRect = document.querySelector('.wc-widget-progress')?.getBoundingClientRect()
    const player = window.__mockWolvesPlayers.find(entry => entry.videoId === 'LASru9j0oIc')
    return {
      currentTime: player?.currentTime ?? 0,
      tolerance: progressRect ? overallDuration / progressRect.width : Infinity,
    }
  }, OVERALL_DURATION)
  assertWithin('Part I overall seek lands near the authored native timestamp', partISeek.currentTime, 20 - partISeek.tolerance, 20 + partISeek.tolerance)
  await capture(page, '03-part-i')

  await clickOverallRatio(page, (PART_VII_START + 10) / OVERALL_DURATION)
  await page.waitForFunction(
    () => document.querySelector('.wc-widget-title')?.textContent?.includes('Last Ride of the Day'),
    null,
    { timeout: 10_000 },
  )
  const partVIISeek = await page.evaluate((overallDuration) => {
    const progressRect = document.querySelector('.wc-widget-progress')?.getBoundingClientRect()
    const player = window.__mockWolvesPlayers.find(entry => entry.videoId === 'rYkYLIYvI18')
    return {
      currentTime: player?.currentTime ?? 0,
      tolerance: progressRect ? overallDuration / progressRect.width : Infinity,
    }
  }, OVERALL_DURATION)
  assertWithin('Part VII overall seek lands near the authored native timestamp', partVIISeek.currentTime, 10 - partVIISeek.tolerance, 10 + partVIISeek.tolerance)

  const partVIITelemetry = await page.locator('.wc-widget').evaluate((widget) => ({
    height: widget.getBoundingClientRect().height,
    text: widget.textContent ?? '',
    valueNow: widget.querySelector('.wc-widget-progress')?.getAttribute('aria-valuenow') ?? '',
  }))
  assertWithin('Part VII footer stays within the 140px budget', partVIITelemetry.height, 0, 140)
  assertTruthy('Part VII telemetry still shows the deployment label', partVIITelemetry.text.includes('DEPLOYMENT: wolves-decryption-engine-7'))
  assert('Part VII deployment percent reflects overall progress', partVIITelemetry.valueNow, '89')
  await capture(page, '04-part-vii')

  await clickOverallRatio(page, DESTINY_SEEK_ELAPSED / OVERALL_DURATION)
  await page.waitForSelector('.wolves-intro-overlay-player', { state: 'visible', timeout: 10_000 })
  assert('Destiny voice-over toggle is visible after seeking back into the intro', await page.getByLabel('Ikora voice over').isVisible(), true)
  const destinySeek = await page.evaluate((overallDuration) => {
    const progressRect = document.querySelector('.wc-widget-progress')?.getBoundingClientRect()
    const player = window.__mockWolvesPlayers.find(entry => entry.videoId === 'BV3BZKbpBns')
    return {
      currentTime: player?.currentTime ?? 0,
      tolerance: progressRect ? overallDuration / progressRect.width : Infinity,
    }
  }, OVERALL_DURATION)
  assertWithin('Destiny overall seek lands near the authored native timestamp', destinySeek.currentTime, 62 - destinySeek.tolerance, 62 + destinySeek.tolerance)
  const destinyTelemetry = await page.locator('.wc-widget').evaluate((widget) => ({
    height: widget.getBoundingClientRect().height,
    valueNow: widget.querySelector('.wc-widget-progress')?.getAttribute('aria-valuenow') ?? '',
    text: widget.textContent ?? '',
  }))
  assertWithin('Destiny intro footer stays within the 140px budget', destinyTelemetry.height, 0, 140)
  assertWithin('Destiny intro deployment percent reflects the overall intro/cinematic timeline', Number(destinyTelemetry.valueNow), 6, 7)
  assertTruthy('Destiny intro telemetry remains visible on the shared widget', destinyTelemetry.text.includes('DEPLOYMENT: wolves-decryption-engine-7'))
  await capture(page, '05-intro-destiny')
}
catch (error) {
  console.error(`\nTest failed with error: ${error.message}`)
  console.error(error.stack || '')
  exitCode = 1
}
finally {
  await browser.close()
}

console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0 || exitCode !== 0) {
  process.exit(1)
}
