/**
 * Wolves Track 0 video sidecar browser oracle — standalone Playwright script
 *
 * Verifies the Track 0 ("7 Days to the Wolves") desktop lore/video sidecar
 * split, and that the sidecar never mounts on narrow viewports. Uses a
 * deterministic mock of the YouTube IFrame Player API (same pattern as
 * tests/wolves-lobby-progress.mjs) so the test does not depend on live
 * YouTube playback, ads, region, or external availability. The sidecar
 * itself is a plain native <iframe> (no IFrame Player API), so its contract
 * is verified directly against its rendered `src` URL and DOM attributes.
 *
 * Contract under test (source: src/components/wolves/cinematic/TheaterExperience.vue):
 *   - Desktop (>=1024px): `.wc-trackzero-lore` (the `immersive-col-right`
 *     aside) renders two stacked rows — `.wc-trackzero-lore-row` (top) and
 *     `[data-trackzero-video-sidecar]` (bottom, tagged
 *     `.wc-trackzero-video-row`) — inside `.wc-trackzero-grid`'s 2fr/1fr
 *     split alongside `.wc-trackzero-viewer`.
 *   - The sidecar's `.wc-trackzero-video-frame` holds one native <iframe>
 *     with a non-empty `title`, `src` host `www.youtube.com`, path
 *     `/embed/xu_yE8h3jT8` and query params `autoplay=1`, `mute=1`,
 *     `loop=1`, `controls=0`, `playsinline=1`, and `playlist` equal to the
 *     exact seven-id CSV `xu_yE8h3jT8,PjryN2F6fF0,jRXB67fcXZA,tcj7O-hsCN0,
 *     -lo2IXn9RK4,_4SQ2mWxnEc,bCA6l-VlpAY`. The iframe is `pointer-events:
 *     none` (non-interactive background loop). An app-owned edge mask sits
 *     above it to conceal YouTube-native title, action, and branding chrome.
 *   - The sidecar must stay clear of the bottom `.wc-widget` footer HUD and
 *     the top `.wc-stage-nameplate` plate.
 *   - Mobile (<1024px): the sidecar is gated by a reactive `matchMedia`
 *     guard (not CSS alone), so `[data-trackzero-video-sidecar]` and its
 *     iframe must be entirely absent from the DOM (not merely hidden), and
 *     `.wc-trackzero-viewer` must fill the full grid width.
 *
 * If any of the selectors/attributes above have not landed yet, this script
 * documents the exact contract the implementer should match; rerun it once
 * the sidecar ships.
 *
 * Prerequisites: dev server must be running at http://localhost:5173
 *   just serve   (from repo root)
 *
 * Run (desktop):
 *   node tests/wolves-trackzero-sidecar-real-player.mjs
 * Run (mobile):
 *   WOLVES_VIEWPORT=390x844 node tests/wolves-trackzero-sidecar-real-player.mjs
 */

import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://localhost:5173'
const WOLVES_URL = `${BASE_URL}/wolves/`
const [width, height] = (process.env.WOLVES_VIEWPORT ?? '1440x900').split('x').map(Number)
const VIEWPORT = { width, height }
const SCREENSHOT_DIR = process.env.WOLVES_SCREENSHOT_DIR

// Mirrors tests/wolves-lobby-progress.mjs: per-video mock durations so the
// overall progress bar ratio lands reliably inside Part I ("7 Days to the
// Wolves", Track 0) without walking through the full Destiny intro.
const MOCK_DURATIONS = {
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
const INTRO_DURATION = 119.5
const OVERALL_DURATION = 1952.5
const TRACK_ZERO_SEEK_SECONDS = 300
const EXPECTED_VIDEO_IDS = [
  'xu_yE8h3jT8',
  'PjryN2F6fF0',
  'jRXB67fcXZA',
  'tcj7O-hsCN0',
  '-lo2IXn9RK4',
  '_4SQ2mWxnEc',
  'bCA6l-VlpAY',
]
const EXPECTED_PLAYLIST = EXPECTED_VIDEO_IDS.join(',')
const EXPECTED_FIRST_VIDEO_ID = EXPECTED_VIDEO_IDS[0]

let passed = 0
let failed = 0

function assert(label, actual, expected) {
  const ok = actual === expected
  if (ok) {
    passed++
    console.log(`  PASS  ${label}`)
  }
  else {
    failed++
    console.error(`  FAIL  ${label}`)
    console.error(`        expected: ${JSON.stringify(expected)}`)
    console.error(`        got:      ${JSON.stringify(actual)}`)
  }
  return ok
}

function assertTruthy(label, actual, details) {
  const ok = Boolean(actual)
  if (ok) {
    passed++
    console.log(`  PASS  ${label}`)
  }
  else {
    failed++
    console.error(`  FAIL  ${label}`)
    console.error(`        expected a truthy value, got: ${actual}`)
    if (details !== undefined) {
      console.error(`        details: ${JSON.stringify(details)}`)
    }
  }
  return ok
}

function assertWithin(label, actual, min, max) {
  const ok = actual >= min && actual <= max
  if (ok) {
    passed++
    console.log(`  PASS  ${label}`)
  }
  else {
    failed++
    console.error(`  FAIL  ${label}`)
    console.error(`        expected: ${min} <= value <= ${max}`)
    console.error(`        got:      ${actual}`)
  }
  return ok
}

function assertNoOverlap(label, first, second) {
  if (!first || !second) {
    failed++
    console.error(`  FAIL  ${label}`)
    console.error(`        expected both elements to have bounds, got: ${JSON.stringify({ first, second })}`)
    return false
  }
  const overlaps = !(
    first.right <= second.left
    || second.right <= first.left
    || first.bottom <= second.top
    || second.bottom <= first.top
  )
  return assert(label, overlaps, false)
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

async function seekStage(page, seconds) {
  await page.evaluate(time => window.__wolvesCinematic.seekTo(time), seconds)
  await page.waitForTimeout(300)
}

const browser = await chromium.launch({ headless: true })
let exitCode = 0

try {
  const page = await browser.newPage({ viewport: VIEWPORT })

  // Intercept the YouTube IFrame API before any page script runs, matching
  // the mock in tests/wolves-lobby-progress.mjs. This drives the Destiny
  // intro/soundtrack player only; the Track 0 sidecar under test is a plain
  // native <iframe>, not an IFrame Player instance, so it needs no mock.
  await page.addInitScript((durations) => {
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
  }, MOCK_DURATIONS)

  console.log(`\nWolves Track 0 video sidecar browser test`)
  console.log(`  URL:      ${WOLVES_URL}`)
  console.log(`  Viewport: ${VIEWPORT.width}x${VIEWPORT.height}\n`)

  try {
    await page.goto(WOLVES_URL, { waitUntil: 'networkidle', timeout: 30_000 })
  }
  catch {
    // Fall through to explicit wait below; networkidle can time out on
    // animation-heavy pages.
  }
  await page.waitForTimeout(1000)

  await page.getByRole('button', { name: /JOIN THE EVOLUTION|BEGIN TRANSMISSION|MEET YOUR TEAMMATES/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 10_000 })

  // Skip past the Destiny intro directly into Part I ("7 Days to the
  // Wolves") via the overall progress bar, exactly as
  // tests/wolves-lobby-progress.mjs does.
  await clickOverallRatio(page, (INTRO_DURATION + 20) / OVERALL_DURATION)
  await page.waitForSelector('.wc-trackzero-grid', { state: 'visible', timeout: 10_000 })
  await page.waitForFunction(
    () => typeof window.__wolvesCinematic?.seekTo === 'function',
    null,
    { timeout: 10_000 },
  )

  await seekStage(page, TRACK_ZERO_SEEK_SECONDS)

  if (width >= 1024) {
    await page.waitForSelector('[data-trackzero-video-sidecar] iframe', { state: 'visible', timeout: 10_000 })

    const layout = await page.evaluate(() => {
      const grid = document.querySelector('.wc-trackzero-grid')
      const viewer = document.querySelector('.wc-trackzero-viewer')
      const lore = document.querySelector('.wc-trackzero-lore')
      const loreRow = document.querySelector('.wc-trackzero-lore-row')
      const videoRow = document.querySelector('[data-trackzero-video-sidecar]')
      const videoFrame = videoRow?.querySelector('.wc-trackzero-video-frame')
      const iframe = videoRow?.querySelector('iframe')
      const chromeMask = videoRow?.querySelector('[data-trackzero-video-chrome-mask]')
      const footer = document.querySelector('.wc-widget')
      const nameplateFrame = document.querySelector('.wc-stage-nameplate')

      if (!grid || !viewer || !lore || !loreRow || !videoRow || !videoFrame || !iframe || !chromeMask || !footer) {
        return { missing: true }
      }

      const gridRect = grid.getBoundingClientRect()
      const viewerRect = viewer.getBoundingClientRect()
      const loreRect = lore.getBoundingClientRect()
      const loreRowRect = loreRow.getBoundingClientRect()
      const videoRowRect = videoRow.getBoundingClientRect()
      const frameRect = videoFrame.getBoundingClientRect()
      const iframeRect = iframe.getBoundingClientRect()
      const chromeMaskRect = chromeMask.getBoundingClientRect()
      const footerRect = footer.getBoundingClientRect()
      const nameplateRect = nameplateFrame?.getBoundingClientRect() ?? null
      const iframeUrl = new URL(iframe.getAttribute('src') ?? '', window.location.href)

      return {
        missing: false,
        gridRect,
        viewerRect,
        loreRect,
        videoRowRect,
        footerRect,
        nameplateRect,
        outerRatio: viewerRect.width / loreRect.width,
        loreDisplay: getComputedStyle(lore).display,
        rowRatio: loreRowRect.height / videoRowRect.height,
        frameAspectRatio: frameRect.width / frameRect.height,
        iframeAspectRatio: iframeRect.width / iframeRect.height,
        frameWithinRow: frameRect.top >= videoRowRect.top - 1
          && frameRect.right <= videoRowRect.right + 1
          && frameRect.bottom <= videoRowRect.bottom + 1
          && frameRect.left >= videoRowRect.left - 1,
        iframeWithinFrame: iframeRect.top >= frameRect.top - 1
          && iframeRect.right <= frameRect.right + 1
          && iframeRect.bottom <= frameRect.bottom + 1
          && iframeRect.left >= frameRect.left - 1,
        videoRowWithinViewport: videoRowRect.top >= 0
          && videoRowRect.left >= 0
          && videoRowRect.right <= window.innerWidth
          && videoRowRect.bottom <= window.innerHeight,
        iframeVisibleSize: iframeRect.width > 0 && iframeRect.height > 0,
        iframeTitle: iframe.getAttribute('title') ?? '',
        iframePointerEvents: getComputedStyle(iframe).pointerEvents,
        chromeMaskAriaHidden: chromeMask.getAttribute('aria-hidden'),
        chromeMaskPointerEvents: getComputedStyle(chromeMask).pointerEvents,
        chromeMaskPosition: getComputedStyle(chromeMask).position,
        chromeMaskCoversFrame: chromeMaskRect.top <= frameRect.top + 1
          && chromeMaskRect.right >= frameRect.right - 1
          && chromeMaskRect.bottom >= frameRect.bottom - 1
          && chromeMaskRect.left <= frameRect.left + 1,
        iframeHost: iframeUrl.hostname,
        iframePath: iframeUrl.pathname,
        iframeAutoplay: iframeUrl.searchParams.get('autoplay'),
        iframeMute: iframeUrl.searchParams.get('mute'),
        iframeLoop: iframeUrl.searchParams.get('loop'),
        iframeControls: iframeUrl.searchParams.get('controls'),
        iframePlaysinline: iframeUrl.searchParams.get('playsinline'),
        iframePlaylist: iframeUrl.searchParams.get('playlist'),
      }
    })

    if (assertTruthy('Track 0 desktop sidecar/lore split is present after the seek', !layout.missing, layout)) {
      assertWithin('Track 0 grid keeps the authored 2fr/1fr viewer/lore split', layout.outerRatio, 1.7, 2.3)
      assert('Track 0 lore column renders as a grid', layout.loreDisplay, 'grid')
      assertWithin('Track 0 lore column keeps its 50/50 lore/video row split', layout.rowRatio, 0.8, 1.25)
      assertTruthy('Track 0 sidecar iframe has a nonzero rendered size', layout.iframeVisibleSize, layout)
      // The media frame's height comes from a flex split of the lore column
      // rather than a fixed aspect box, so only landscape orientation (not an
      // exact 16:9 ratio) is guaranteed across viewport heights.
      assertTruthy('Track 0 sidecar media frame renders landscape (wider than tall)', layout.frameAspectRatio > 1, layout.frameAspectRatio)
      assertTruthy('Track 0 sidecar iframe renders landscape (wider than tall)', layout.iframeAspectRatio > 1, layout.iframeAspectRatio)
      assertTruthy('Track 0 sidecar media frame stays inside its row', layout.frameWithinRow, layout)
      assertTruthy('Track 0 sidecar iframe stays inside its media frame', layout.iframeWithinFrame, layout)
      assertTruthy('Track 0 sidecar row stays within the viewport bounds', layout.videoRowWithinViewport, layout)
      assertTruthy('Track 0 sidecar iframe has a non-empty accessible title', layout.iframeTitle.trim().length > 0, layout.iframeTitle)
      assert('Track 0 sidecar iframe stays non-interactive', layout.iframePointerEvents, 'none')
      assert('Track 0 sidecar chrome mask is hidden from assistive technology', layout.chromeMaskAriaHidden, 'true')
      assert('Track 0 sidecar chrome mask stays non-interactive', layout.chromeMaskPointerEvents, 'none')
      assert('Track 0 sidecar chrome mask overlays the video frame', layout.chromeMaskPosition, 'absolute')
      assertTruthy('Track 0 sidecar chrome mask covers the video frame', layout.chromeMaskCoversFrame, layout)
      assert('Track 0 sidecar iframe embeds from youtube.com', layout.iframeHost, 'www.youtube.com')
      assert('Track 0 sidecar iframe keeps the authored lead video id', layout.iframePath, `/embed/${EXPECTED_FIRST_VIDEO_ID}`)
      assert('Track 0 sidecar keeps autoplay enabled', layout.iframeAutoplay, '1')
      assert('Track 0 sidecar keeps audio muted', layout.iframeMute, '1')
      assert('Track 0 sidecar keeps looping enabled', layout.iframeLoop, '1')
      assert('Track 0 sidecar keeps controls disabled', layout.iframeControls, '0')
      assert('Track 0 sidecar keeps inline playback enabled', layout.iframePlaysinline, '1')
      assert('Track 0 sidecar keeps the exact seven-id playlist order', layout.iframePlaylist, EXPECTED_PLAYLIST)
      assertNoOverlap('Track 0 sidecar stays clear of the footer HUD widget', layout.footerRect, layout.videoRowRect)
      if (layout.nameplateRect) {
        assertNoOverlap('Track 0 sidecar stays clear of the top nameplate HUD', layout.nameplateRect, layout.videoRowRect)
      }
    }

    await capture(page, 'track-zero-sidecar-desktop')
  }
  else {
    const mobileLayout = await page.evaluate(() => {
      const grid = document.querySelector('.wc-trackzero-grid')
      const viewer = document.querySelector('.wc-trackzero-viewer')
      const sidecarCount = document.querySelectorAll('[data-trackzero-video-sidecar]').length
      const sidecarIframeCount = document.querySelectorAll('[data-trackzero-video-sidecar] iframe').length
      const gridRect = grid?.getBoundingClientRect()
      const viewerRect = viewer?.getBoundingClientRect()
      const gridStyle = grid ? getComputedStyle(grid) : null
      // Compare against the grid's content box (its own left/right padding
      // excluded), not its border box, so the authored stage padding is not
      // mistaken for a collapsed viewer column.
      const gridContentWidth = gridRect && gridStyle
        ? gridRect.width - Number.parseFloat(gridStyle.paddingLeft) - Number.parseFloat(gridStyle.paddingRight)
        : 0
      return {
        sidecarCount,
        sidecarIframeCount,
        gridColumns: gridStyle?.gridTemplateColumns ?? '',
        gridContentWidth,
        viewerWidth: viewerRect?.width ?? 0,
      }
    })

    assert('Mobile Track 0 sidecar section is absent from the DOM', mobileLayout.sidecarCount, 0)
    assert('Mobile Track 0 sidecar iframe is absent from the DOM', mobileLayout.sidecarIframeCount, 0)
    assertTruthy('Mobile Track 0 grid reports a rendered width', mobileLayout.gridContentWidth > 0, mobileLayout)
    assertTruthy('Mobile Track 0 grid collapses to a single column', !mobileLayout.gridColumns.trim().includes(' '), mobileLayout.gridColumns)
    assertWithin(
      'Mobile Track 0 comic viewer fills the full theater width',
      mobileLayout.viewerWidth / mobileLayout.gridContentWidth,
      0.97,
      1.01,
    )

    await capture(page, 'track-zero-sidecar-mobile')
  }

  console.log(`\n${passed} passed, ${failed} failed\n`)
  exitCode = failed > 0 ? 1 : 0
}
catch (error) {
  console.error(`\nTest failed with error: ${error.message}`)
  console.error(error.stack || '')
  exitCode = 1
}
finally {
  await browser.close()
}

process.exit(exitCode)
