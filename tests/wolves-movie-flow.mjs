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
const JORGE_GHOSTS_QUOTE = 'These people inspire me to no end, and a bunch of unknowns created Aurora, Bazzite, Bluefin, Bluebuild, Secureblue, and others. Not a Universal Blue ecosystem, not a bootc ecosystem. A cloud native ecosystem. Sorry about my Titan manners sometimes. In one short weekend you\'ve proven to the world that enthusiasts matter. Thank you to Chainguard, Microsoft, Red Hat, Edera, for investing in the unknowns from Universal Blue! Need talent? Go cloud native, we\'re a proven Guardian Academy.'

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
          return 500
        }

        seekTo(seconds) {
          this.currentTime = seconds
        }

        setVolume() {}

        getVolume() {
          return 100
        }

        loadVideoById(id) {
          this.videoId = id.videoId ?? id
        }

        cueVideoById(id) {
          this.videoId = id.videoId ?? id
        }

        destroy() {}

        mute() {}
        unMute() {}

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
  await page.getByRole('button', { name: /JOIN THE EVOLUTION|BEGIN TRANSMISSION/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 10_000 })
  await hasVisibleControl(page, 'Pause')
  await hasVisibleControl(page, 'Next')
  await captureStage(page, 'prologue')

  await page.getByLabel('Next').click()
  await page.waitForTimeout(250)

  await page.waitForSelector('.wolves-intro-overlay-player', { state: 'visible', timeout: 10_000 })
  await hasVisibleControl(page, 'Pause')
  await hasVisibleControl(page, 'Next')
  assert(
    'Destiny nameplate detail',
    await page.locator('.wc-intro-nameplate .wc-nameplate-detail').textContent(),
    'Meet your Fireteam',
  )
  assert(
    'Destiny nameplate label',
    await page.locator('.wc-intro-nameplate .wc-nameplate-label').textContent(),
    'We fight for something bigger than ourselves.',
  )
  const introPlayerIndex = await page.evaluate(() =>
    window.__mockWolvesPlayers.findIndex(player => player.videoId === 'BV3BZKbpBns'),
  )
  await page.evaluate((index) => {
    window.__mockWolvesPlayers[index].seekTo(24.01, true)
  }, introPlayerIndex)
  await page.waitForTimeout(250)
  const comicHeroShotStart = page.locator('[data-comic-hero-shot]')
  assertTruthy('Comic Hero Shots title card starts on the first Chonky slide', (await comicHeroShotStart.getAttribute('data-comic-hero-shot'))?.includes('chonky-achillibator-pose1-post'))
  await page.evaluate((index) => {
    window.__mockWolvesPlayers[index].seekTo(30.3, true)
  }, introPlayerIndex)
  await page.waitForTimeout(250)
  const comicHeroShotMid = await comicHeroShotStart.getAttribute('data-comic-hero-shot')
  assertTruthy('Comic Hero Shots title card advances to a later Chonky slide without repeating', comicHeroShotMid && comicHeroShotMid !== 'chonky-achillibator-pose1-post')
  await captureStage(page, 'destiny')

  // Complete the remaining intro stages before exercising the playlist handoff.
  await page.getByLabel('Next').click()

  // Wait for the intro overlay to disappear and the cinematic stage's dev-only
  // seek hook to become available before exercising the Track 0 locks.
  await page.waitForSelector('.wolves-intro-overlay', { state: 'hidden', timeout: 10_000 })
  await page.waitForFunction(
    () => typeof window.__wolvesCinematic?.seekTo === 'function',
    null,
    { timeout: 10_000 },
  )

  const seekStage = async (seconds) => {
    await page.evaluate(time => window.__wolvesCinematic.seekTo(time), seconds)
    await page.waitForTimeout(250)
  }

  await seekStage(310.4)
  await page.waitForFunction(() =>
    document.querySelector('[data-lore-view-kind="chatlog"]')?.textContent?.includes('Sherman'),
  )
  const unifiedLoreMetrics = await page.evaluate(() => {
    const column = document.querySelector('.immersive-col-right')
    const root = document.querySelector('.wolves-lore-column')
    const feed = document.querySelector('[data-unified-lore-feed]')
    const directory = document.querySelector('[data-dossier-directory]')
    const recordViewport = document.querySelector('[data-lore-view-kind="chatlog"] .quote-viewport')
    const columnRect = column?.getBoundingClientRect()
    const feedRect = feed?.getBoundingClientRect()
    return {
      columnDisplay: column ? getComputedStyle(column).display : '',
      rootDisplay: root ? getComputedStyle(root).display : '',
      feedDisplay: feed ? getComputedStyle(feed).display : '',
      feedFlexGrow: feed ? getComputedStyle(feed).flexGrow : '',
      feedMinHeight: feed ? getComputedStyle(feed).minHeight : '',
      recordOverflowY: recordViewport ? getComputedStyle(recordViewport).overflowY : '',
      directoryDisplay: directory ? getComputedStyle(directory).display : '',
      withinColumn: Boolean(columnRect && feedRect
        && feedRect.left >= columnRect.left
        && feedRect.right <= columnRect.right
        && feedRect.top >= columnRect.top
        && feedRect.bottom <= columnRect.bottom),
      oldTabsPresent: document.body.textContent?.includes('[ NARRATIVE FEED ]')
        || document.body.textContent?.includes('[ DOSSIER ARCHIVE ]'),
    }
  })
  assert(
    'Unified lore column follows the authored viewport state',
    unifiedLoreMetrics.columnDisplay,
    width < 1024 ? 'none' : 'block',
  )
  assert('Unified lore root uses flex layout', unifiedLoreMetrics.rootDisplay, 'flex')
  assert('Unified lore feed uses flex layout', unifiedLoreMetrics.feedDisplay, 'flex')
  assert('Unified lore feed fills available height', unifiedLoreMetrics.feedFlexGrow, '1')
  assert('Unified lore feed permits shrinking', unifiedLoreMetrics.feedMinHeight, '0px')
  assertTruthy('Unified lore record retains vertical scrolling', ['auto', 'scroll'].includes(unifiedLoreMetrics.recordOverflowY))
  assert('Unified dossier index stays in the column flow', unifiedLoreMetrics.directoryDisplay, 'flex')
  assert('Unified lore feed stays inside the lore column', unifiedLoreMetrics.withinColumn, true)
  assert('Legacy split lore tabs are removed', unifiedLoreMetrics.oldTabsPresent, false)

  await seekStage(167.8)
  const trackZeroNameplateLabel = page.locator('.wc-stage-nameplate .wc-nameplate-label')
  const trackZeroSignal = page.locator('.wc-stage-nameplate .wc-nameplate-detail')
  assert('Track 0 nameplate enables slow signal fades', await page.locator('.wc-stage-nameplate .wc-nameplate').evaluate(node => node.classList.contains('wc-nameplate--slow-fade')), true)
  assert('Track 0 keeps its static command label', await trackZeroNameplateLabel.textContent(), 'kubectl apply -f ublue.yaml -n k8s-community')
  assert('Track 0 opens with the colon-free signal detail', await trackZeroSignal.textContent(), 'Incoming Signal')
  const jonoAtStart = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Jono Bacon slide is active at 2:47.8', jonoAtStart?.includes('interview-jono-bacon-cult-psychology-kubernetes.webp'))
  const jonoBanner = page.locator('.wallpaper-theater-caption.is-title-only')
  assert('Jono Cult Psychology banner is visible', await jonoBanner.isVisible(), true)
  assertTruthy('Jono Cult Psychology banner preserves its exact title', (await jonoBanner.textContent())?.includes('The Cult Psychology of Kubernetes'))
  const jonoBannerMetrics = await jonoBanner.evaluate((banner) => {
    const title = banner.querySelector('.wallpaper-theater-caption-title')
    const viewer = document.querySelector('.flickr-gallery-wrapper')
    const bannerRect = banner.getBoundingClientRect()
    const viewerRect = viewer?.getBoundingClientRect()
    return {
      display: getComputedStyle(banner).display,
      fontSize: Number.parseFloat(getComputedStyle(title).fontSize),
      scrolls: banner.scrollHeight > banner.clientHeight + 1,
      withinViewer: Boolean(viewerRect
        && bannerRect.left >= viewerRect.left
        && bannerRect.right <= viewerRect.right
        && bannerRect.top >= viewerRect.top
        && bannerRect.bottom <= viewerRect.bottom),
    }
  })
  assert('Jono Cult Psychology banner uses a block theater layout', jonoBannerMetrics.display, 'block')
  assertTruthy('Jono Cult Psychology banner uses 10-foot typography', jonoBannerMetrics.fontSize >= (width < 600 ? 30 : 48))
  assert('Jono Cult Psychology banner does not scroll', jonoBannerMetrics.scrolls, false)
  assert('Jono Cult Psychology banner fits the viewer', jonoBannerMetrics.withinViewer, true)
  assert('Track 0 stage nameplate remains visible during Jono', await page.locator('.wc-stage-nameplate .wc-nameplate').isVisible(), true)
  assert('Track 0 lower thesis overlay remains inactive during Jono', await page.locator('.wc-thesis').count(), 0)

  await seekStage(171.878)
  assert('Jono Cult Psychology banner persists through 2:51.878', await jonoBanner.isVisible(), true)

  await seekStage(171.879)
  const marinaAtStart = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Marina Moore slide starts at 2:51.879', marinaAtStart?.includes('kubecon-55168684055.webp'))
  assert('Jono Cult Psychology banner hands off at 2:51.879', await jonoBanner.count(), 0)
  const marinaCaption = await page.locator('.flickr-caption').textContent()
  assertTruthy('Marina Moore caption is visible', marinaCaption?.includes('Marina Moore'))
  assert('Track 0 stage nameplate remains visible during Marina Moore', await page.locator('.wc-stage-nameplate .wc-nameplate').isVisible(), true)
  assert('Track 0 lower thesis overlay remains inactive during Marina Moore', await page.locator('.wc-thesis').count(), 0)

  await seekStage(175.958)
  assert('Incoming Signal holds until the Bluefin group', await trackZeroSignal.textContent(), 'Incoming Signal')
  const marinaBeforeComposite = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Marina Moore still holds immediately before the Sherman + m2 composite', marinaBeforeComposite?.includes('kubecon-55168684055.webp'))

  await seekStage(175.959)
  const shermanAtStart = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Sherman + m2 composite starts at 2:55.959', shermanAtStart?.includes('sherman-m2.webp'))

  await seekStage(175.97)
  assert('Bluefin group receives its authored signal', await trackZeroSignal.textContent(), 'The Blue Delivers')
  await captureStage(page, 'track-zero-bluefin-signal')

  await seekStage(184.118)
  const compositeBeforeHandoff = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Sherman + m2 composite remains active immediately before its handoff', compositeBeforeHandoff?.includes('sherman-m2.webp'))
  assert('Track 0 stage nameplate remains visible during Sherman + m2', await page.locator('.wc-stage-nameplate .wc-nameplate').isVisible(), true)
  assert('Track 0 lower thesis overlay remains inactive during Sherman + m2', await page.locator('.wc-thesis').count(), 0)

  await seekStage(184.119)
  const compositeAtHandoff = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assert('Sherman + m2 composite hands off at 3:04.119', compositeAtHandoff?.includes('sherman-m2.webp'), false)

  await seekStage(188.198)
  const kyleBeforeHikari = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Kyle still holds immediately before the first Hikari slide', kyleBeforeHikari?.includes('kyle.jpg'))

  await seekStage(188.199)
  const hikariAtStart = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('First Hikari slide starts at 3:08.199', hikariAtStart?.includes('hikari.JPG'))

  await seekStage(190.238)
  const hikariBeforeSecond = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('First Hikari slide remains active immediately before its handoff', hikariBeforeSecond?.includes('hikari.JPG'))

  await seekStage(190.239)
  const hikariSecondAtStart = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Second Hikari slide starts at 3:10.239', hikariSecondAtStart?.includes('hikari2.JPG'))

  await seekStage(192.278)
  const hikariBeforeHandoff = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Second Hikari slide remains active immediately before its handoff', hikariBeforeHandoff?.includes('hikari2.JPG'))

  await seekStage(192.279)
  const hikariAtHandoff = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assert('Second Hikari slide hands off at 3:12.279', hikariAtHandoff?.includes('hikari2.JPG'), false)

  await seekStage(196.36)
  assert('Post-Bluefin signal reports the thriving-community pod', await trackZeroSignal.textContent(), 'pod/thriving-community created')
  assert('Lower thesis remains separate after the Bluefin group', await page.locator('.wc-thesis').count(), 0)

  await seekStage(229)
  assert(
    'Chanting bridge reports the experimental collaboration image',
    await trackZeroSignal.textContent(),
    'Warning: ImagePullBackOff - "humans/collaboration:latest" is currently experimental.',
  )
  const warningNameplateBounds = await page.locator('.wc-stage-nameplate .wc-nameplate').evaluate((nameplate) => {
    const label = nameplate.querySelector('.wc-nameplate-label')
    const rect = nameplate.getBoundingClientRect()
    return {
      withinViewport: rect.left >= 0 && rect.right <= window.innerWidth,
      labelWraps: Boolean(label && label.scrollWidth <= label.clientWidth + 1),
    }
  })
  assert('ImagePullBackOff nameplate stays inside the viewport', warningNameplateBounds.withinViewport, true)
  assert('ImagePullBackOff label wraps instead of overflowing', warningNameplateBounds.labelWraps, true)
  assert('Lower thesis remains separate during the warning', await page.locator('.wc-thesis').count(), 0)
  await captureStage(page, 'track-zero-community-warning')

  await seekStage(277)
  assert(
    'Heavy build-up reports the human fallback',
    await trackZeroSignal.textContent(),
    'Falling back to "humans/trying-their-best:v1"',
  )
  assert('Lower thesis remains separate during the fallback', await page.locator('.wc-thesis').count(), 0)
  await captureStage(page, 'track-zero-community-fallback')

  await seekStage(345)
  await page.waitForTimeout(250)
  assert('Fallback signal remains through the thesis opening', await trackZeroSignal.textContent(), 'Falling back to "humans/trying-their-best:v1"')
  assertTruthy('Lower thesis keeps its authored opening text', (await page.locator('.wc-thesis').textContent())?.includes('We\'ve got your back.'))

  await seekStage(408)
  assert('Titanfall signal remains the locked finale handoff', await trackZeroSignal.textContent(), 'Bazzite Mk6 Units: Prepare for Titanfall.')
  assertTruthy('Lower thesis keeps its authored finale text', (await page.locator('.wc-thesis').textContent())?.includes('Become Legend'))
  await captureStage(page, 'track-zero-composites')

  await page.getByLabel('Next').click()
  await page.waitForSelector('.wolves-creator-shorts-interstitial', { state: 'visible', timeout: 10_000 })
  await page.getByRole('button', { name: /\[ START SHORTS \]/ }).click()
  for (let index = 0; index < 4; index++) {
    await page.getByLabel('Skip video').click()
  }
  await page.waitForSelector('.wolves-creator-shorts-interstitial', { state: 'hidden', timeout: 10_000 })
  await page.waitForFunction(() =>
    document.querySelector('.wc-stage-nameplate')?.textContent?.includes('Ghosts In The Mist'),
  )

  await seekStage(0)
  const ghostsOpeningImage = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Ghosts In The Mist opens on Jorge MN047', ghostsOpeningImage?.includes('55164222671_32d7ace307_c.jpg'))
  const ghostsCaption = page.locator('.wallpaper-theater-caption')
  const ghostsCaptionText = (await ghostsCaption.locator('.wallpaper-theater-caption-body').allTextContents())
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim())
    .join(' ')
  assert('Ghosts opener identifies Jorge Castro', await ghostsCaption.locator('.wallpaper-theater-caption-title').textContent(), 'Jorge Castro')
  assert('Ghosts opener preserves Jorge quote', ghostsCaptionText, JORGE_GHOSTS_QUOTE)
  const ghostsCaptionMetrics = await ghostsCaption.evaluate((caption) => {
    const viewer = document.querySelector('.flickr-gallery-wrapper')
    const captionRect = caption.getBoundingClientRect()
    const viewerRect = viewer?.getBoundingClientRect()
    return {
      scrolls: caption.scrollHeight > caption.clientHeight + 1,
      withinViewer: Boolean(viewerRect
        && captionRect.left >= viewerRect.left
        && captionRect.right <= viewerRect.right
        && captionRect.top >= viewerRect.top
        && captionRect.bottom <= viewerRect.bottom),
    }
  })
  assert('Ghosts opener quote does not scroll', ghostsCaptionMetrics.scrolls, false)
  assert('Ghosts opener quote stays inside the viewer', ghostsCaptionMetrics.withinViewer, true)
  await captureStage(page, 'ghosts-mn047-jorge')

  await seekStage(38.399)
  const ghostsBeforeHandoff = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Jorge MN047 holds through 38.399 seconds', ghostsBeforeHandoff?.includes('55164222671_32d7ace307_c.jpg'))

  await seekStage(38.4)
  const ghostsAtHandoff = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assert('Jorge MN047 hands off at 38.4 seconds', ghostsAtHandoff?.includes('55164222671_32d7ace307_c.jpg'), false)
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
