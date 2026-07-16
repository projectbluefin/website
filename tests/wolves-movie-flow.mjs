/**
 * Wolves movie flow browser test — standalone Playwright script
 *
 * Verifies the approved Wolves movie flow using a deterministic mock of the
 * YouTube IFrame Player API so the test does not depend on live YouTube
 * playback, ads, region, or external availability.
 *
 * Flow under test:
 *   1. Enter immersive playback at Track 0 via the test-only progress helper.
 *   2. Advance the soundtrack playlist index from 0 to 1.
 *   3. Assert the Creator Shorts interstitial mounts and is visible.
 *   4. Drive the four-video chapter to completion through mock player ENDED
 *      events.
 *   5. Assert the interstitial is removed and the soundtrack resumes at Track 1
 *      ("Ghosts In The Mist").
 *
 * Prerequisites: dev server must be running at http://localhost:5173
 *   just serve   (from repo root)
 *
 * Run:
 *   node tests/wolves-movie-flow.mjs
 */

import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const WOLVES_URL = `${BASE_URL}/wolves/`
const [width, height] = (process.env.WOLVES_VIEWPORT ?? '1440x900').split('x').map(Number)
const VIEWPORT = { width, height }
const SCREENSHOT_DIR = process.env.WOLVES_SCREENSHOT_DIR

// First video IDs from src/data/wolves-creator-shorts.ts.
// These are used to identify the left (Cassidy) and right (Lindsay) mock players.
const CASSIDY_FIRST_VIDEO_ID = 'e6GCa-E75uk'
const LINDSAY_FIRST_VIDEO_ID = 'T8aREn47900'
const TRACK_ONE_TITLE = 'Ghosts In The Mist'
const TRACK_TWO_TITLE = 'Tonight We Must Be Warriors'
const TRACK_TWO_ARTIST = 'Avatar'

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

async function hasVisibleControl(page, label) {
  const control = page.getByLabel(label)
  const count = await control.count()
  const visible = await Promise.all(
    Array.from({ length: count }, (_, index) => control.nth(index).isVisible()),
  ).then(values => values.some(Boolean))
  assert(`Visible ${label} control`, visible, true)
}

async function activeFlickrPhotoSource(page) {
  return page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
}

async function captureStage(page, name) {
  if (SCREENSHOT_DIR) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` })
  }
}

const browser = await chromium.launch({ headless: true })
let exitCode = 0

try {
  const page = await browser.newPage({ viewport: VIEWPORT })

  // Intercept the YouTube IFrame API before any page script runs. Provide a
  // deterministic mock Player that the Wolves soundtrack and Creator Shorts
  // interstitial can drive without making external network requests.
  await page.addInitScript(() => {
    Math.random = () => 0
    window.__mockWolvesPlayers = []
    window.__mockWolvesSoundtrackPlayer = null

    window.YT = {
      Player: class MockPlayer {
        constructor(element, config) {
          this.config = config
          this.videoId = config.videoId ?? null
          this.playlistIndex = 0
          this.currentTime = 0
          this.state = window.YT.PlayerState.CUED
          window.__mockWolvesPlayers.push(this)

          if (config.playerVars?.listType === 'playlist') {
            window.__mockWolvesSoundtrackPlayer = this
          }

          // Fire ready/playing callbacks asynchronously so the component has
          // time to attach its event handlers before they run.
          Promise.resolve().then(() => {
            this.config.events?.onReady?.({ target: this })
            this.state = window.YT.PlayerState.PLAYING
            this.config.events?.onStateChange?.({ data: this.state, target: this })
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

        nextVideo() {
          this.playlistIndex++
          this.config.events?.onPlaylistItem?.({ target: this })
          this.playVideo()
        }

        previousVideo() {
          this.playlistIndex--
          this.config.events?.onPlaylistItem?.({ target: this })
        }

        getPlaylistIndex() {
          return this.playlistIndex
        }

        getCurrentTime() {
          return this.currentTime
        }

        getDuration() {
          return 100
        }

        seekTo(seconds) {
          this.currentTime = seconds
        }

        setVolume() {}

        getVolume() {
          return 100
        }

        loadVideoById(id) {
          this.videoId = id
        }

        cueVideoById(id) {
          this.videoId = id
        }

        destroy() {}

        triggerEnded() {
          this.config.events?.onStateChange?.({ data: window.YT.PlayerState.ENDED, target: this })
        }

        triggerError() {
          this.config.events?.onError?.({ target: this })
        }
      },
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    }

    // Satisfy any code that polls for the global ready callback.
    if (!window.onYouTubeIframeAPIReady) {
      window.onYouTubeIframeAPIReady = () => {}
    }
  })

  console.log(`\nWolves movie flow browser test`)
  console.log(`  URL:      ${WOLVES_URL}`)
  console.log(`  Viewport: ${VIEWPORT.width}x${VIEWPORT.height}\n`)

  // Load the Wolves page. networkidle can time out on animation-heavy pages,
  // so we tolerate that and wait explicitly below.
  try {
    await page.goto(WOLVES_URL, { waitUntil: 'networkidle', timeout: 30_000 })
  }
  catch {
    // Fall through to explicit wait.
  }
  await page.waitForTimeout(1000)

  // The same forward/play-pause controls must cover the complete movie, including
  // the fullscreen prologue and Destiny segments that conceal the soundtrack footer.
  await page.getByRole('button', { name: /JOIN THE EVOLUTION/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 10_000 })
  await hasVisibleControl(page, 'Pause intro')
  await hasVisibleControl(page, 'Next section')
  await captureStage(page, 'prologue')

  await page.getByLabel('Next section').click()
  await page.waitForSelector('.wolves-intro-overlay-player', { state: 'visible', timeout: 10_000 })
  await hasVisibleControl(page, 'Pause intro')
  await hasVisibleControl(page, 'Next section')
  await captureStage(page, 'destiny')

  // Complete the remaining intro stages before exercising the playlist handoff.
  await page.getByLabel('Next section').click()
  await page.getByLabel('Next section').click()

  // Use the existing test-only progress helper to jump straight into Track 0
  // playback without showing the intro overlay. Wait for the Wolves app to mount
  // and expose the helper on window first.
  await page.waitForFunction(
    () => typeof window.simulateWolvesProgress === 'function',
    { timeout: 10_000 },
  )
  await page.evaluate(() => {
    window.simulateWolvesProgress(0, 100, 0)
  })

  // Wait for the soundtrack mock player to be created.
  await page.waitForFunction(
    () => window.__mockWolvesSoundtrackPlayer !== null,
    { timeout: 10_000 },
  )

  await page.evaluate(() => {
    window.__mockWolvesSoundtrackPlayer.seekTo(167.8, true)
  })
  await page.waitForTimeout(150)
  const jonoAtStart = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Jono Bacon slide is active at 2:47.8', jonoAtStart?.includes('interview-jono-bacon-cult-psychology-kubernetes.webp'))

  await page.evaluate(() => {
    window.__mockWolvesSoundtrackPlayer.seekTo(171.879, true)
  })
  await page.waitForTimeout(150)
  const jonoAtEnd = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assert('Jono Bacon slide hands off at 2:51.879', jonoAtEnd?.includes('interview-jono-bacon-cult-psychology-kubernetes.webp'), false)

  // Advance the soundtrack from Track 0 to Track 1. This should trigger the
  // Creator Shorts interstitial via the movie flow state machine.
  await page.evaluate(() => {
    window.__mockWolvesSoundtrackPlayer.nextVideo()
  })

  const interstitialSelector = '.wolves-creator-shorts-interstitial'
  await page.waitForSelector(interstitialSelector, { state: 'visible', timeout: 10_000 })

  const interstitialVisible = await page.isVisible(interstitialSelector)
  assert('Creator Shorts interstitial is visible at Track 0 -> 1', interstitialVisible, true)
  await hasVisibleControl(page, 'Pause video')
  await hasVisibleControl(page, 'Skip video')
  await captureStage(page, 'creator-shorts')

  // Verify both sides of the ping-pong stage mounted with the expected first
  // videos and creator captions.
  const leftCaption = await page.locator('.wolves-creator-shorts-slot').nth(0).locator('.wolves-creator-shorts-caption').textContent()
  const rightCaption = await page.locator('.wolves-creator-shorts-slot').nth(1).locator('.wolves-creator-shorts-caption').textContent()
  assertTruthy('Left slot shows Cassidy Williams caption', leftCaption?.includes('Cassidy Williams'))
  assertTruthy('Right slot shows Lindsay Nikole caption', rightCaption?.includes('Lindsay Nikole'))

  // Drive the four-video chapter to completion: three Cassidy lead turns,
  // then one Lindsay chapter turn.
  await page.evaluate(({ cassidyId, lindsayId }) => {
    const left = window.__mockWolvesPlayers.find(p => p.videoId === cassidyId)
    const right = window.__mockWolvesPlayers.find(p => p.videoId === lindsayId)

    if (!left || !right) {
      throw new Error(`Could not locate mock interstitial players: left=${left}, right=${right}`)
    }

    left.triggerEnded()
    left.triggerEnded()
    left.triggerEnded()
    right.triggerEnded()
  }, { cassidyId: CASSIDY_FIRST_VIDEO_ID, lindsayId: LINDSAY_FIRST_VIDEO_ID })

  // After completion the interstitial should unmount and the soundtrack should
  // resume at the saved playlist index.
  await page.waitForSelector(interstitialSelector, { state: 'hidden', timeout: 10_000 })

  const interstitialHidden = await page.isHidden(interstitialSelector)
  assert('Creator Shorts interstitial is removed after four-video chapter', interstitialHidden, true)

  // Allow the soundtrack resume/fade logic to settle before reading the DOM.
  await page.waitForTimeout(600)

  const trackTitle = await page.textContent('.soundtrack-title')
  assert('Soundtrack resumes at Track 1 (Ghosts In The Mist)', trackTitle?.trim(), TRACK_ONE_TITLE)
  await hasVisibleControl(page, 'Pause soundtrack')
  await hasVisibleControl(page, 'Next track')
  await page.waitForTimeout(1000)
  await page.waitForTimeout(4500)
  assert('Visible Track 1 Flickr caption', await page.locator('.flickr-caption').isVisible(), true)

  await page.evaluate(() => {
    window.__mockWolvesSoundtrackPlayer.seekTo(0, true)
  })
  await page.waitForTimeout(150)
  const firstGalleryCaption = await page.textContent('.flickr-caption')
  const firstGalleryPhoto = await activeFlickrPhotoSource(page)

  await page.evaluate(() => {
    window.__mockWolvesSoundtrackPlayer.seekTo(12, true)
  })
  await page.waitForTimeout(150)
  const secondGalleryCaption = await page.textContent('.flickr-caption')
  const secondGalleryPhoto = await activeFlickrPhotoSource(page)
  assertTruthy('Track 1 starts with a Flickr caption', firstGalleryCaption)
  assertTruthy('Track 1 advances to another Flickr caption', secondGalleryCaption)
  assert('Track 1 does not repeat a gallery photo before exhausting the shuffle', firstGalleryPhoto === secondGalleryPhoto, false)
  await captureStage(page, 'track-one')

  await page.evaluate(() => {
    window.__mockWolvesSoundtrackPlayer.seekTo(0, true)
    window.__mockWolvesSoundtrackPlayer.nextVideo()
  })
  await page.waitForFunction(
    title => document.querySelector('.soundtrack-title')?.textContent?.trim() === title,
    TRACK_TWO_TITLE,
  )
  assert('Track 2 uses its canonical artist name', (await page.textContent('.soundtrack-artist'))?.trim(), TRACK_TWO_ARTIST)
  await page.waitForTimeout(1800)
  const nextTrackGalleryCaption = await page.textContent('.flickr-caption')
  const nextTrackGalleryPhoto = await activeFlickrPhotoSource(page)
  assertTruthy('Track 2 starts with a Flickr caption', nextTrackGalleryCaption)
  assert('Track 2 continues the gallery shuffle without reusing Track 1 photos', [firstGalleryPhoto, secondGalleryPhoto].includes(nextTrackGalleryPhoto), false)

  await page.evaluate(() => {
    window.__mockWolvesSoundtrackPlayer.nextVideo()
  })
  await page.waitForTimeout(150)
  const decemberRotationNightLayer = await page.locator('.wallpaper-buffer-layer:not(.fading-out) .night-layer').getAttribute('style')
  assertTruthy('November night background holds December’s former rotation slot', decemberRotationNightLayer?.includes('bluefin-11-night.webp'))
  await captureStage(page, 'december-slot')
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
