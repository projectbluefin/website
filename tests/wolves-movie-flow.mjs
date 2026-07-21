/**
 * Wolves movie flow browser test — standalone Playwright script
 *
 * Verifies the approved Wolves movie flow using a deterministic mock of the
 * YouTube IFrame Player API so the test does not depend on live YouTube
 * playback, ads, region, or external availability.
 *
 * Flow under test:
 *   1. Enter immersive playback at Track 0 via the test-only progress helper.
 *   2. Advance directly from Part I to Part II.
 *   3. Assert the cinematic resumes at Track 1 ("Ghosts In The Mist").
 *
 * Prerequisites: dev server must be running at http://localhost:5173
 *   just serve   (from repo root)
 *
 * Run:
 *   node tests/wolves-movie-flow.mjs
 */

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const WOLVES_URL = `${BASE_URL}/wolves/`
const [width, height] = (process.env.WOLVES_VIEWPORT ?? '1440x900').split('x').map(Number)
const VIEWPORT = { width, height }
const SCREENSHOT_DIR = process.env.WOLVES_SCREENSHOT_DIR
const JORGE_GHOSTS_QUOTE_PART_ONE = 'Not a Universal Blue ecosystem or a bootc ecosystem. A cloud native ecosystem. In one short weekend you\'ve proven to the world that enthusiasts matter. Happy Fifth Birthday Universal Blue!'
const JORGE_GHOSTS_QUOTE_PART_TWO = 'Thank you to Chainguard, Microsoft, Red Hat, Edera, for sourcing talent from Universal Blue! Need talent? Cloud native projets like ours are focused on sustainability. Judge us by the quality of our people.'
const JORGE_GHOSTS_QUOTE_PART_THREE = 'If you\'re new to cloud native then I hope this small glimpse of the people will inspire to work in your own local communities. Trust me we have work to do! Be the one who moves, not the one who is moved. With you at our side, how can we fail? -- July 21, Ann Arbor, USA'

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
  // deterministic mock Player that the Wolves runtime can drive without making
  // external network requests.
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

  // The same forward/play-pause controls must cover the Destiny intro and cinematic.
  await page.getByRole('button', { name: /JOIN THE EVOLUTION|BEGIN TRANSMISSION|MEET YOUR TEAMMATES/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 10_000 })
  await hasVisibleControl(page, 'Pause')
  await hasVisibleControl(page, 'Next')
  await page.waitForSelector('.wolves-intro-overlay-player', { state: 'visible', timeout: 10_000 })
  await hasVisibleControl(page, 'Pause')
  await hasVisibleControl(page, 'Next')
  assert(
    'Destiny nameplate detail',
    await page.locator('.wc-intro-nameplate .wc-nameplate-detail').textContent(),
    'Meet your Fireteam',
  )
  await captureStage(page, 'destiny-intro')
  assert(
    'Destiny nameplate label',
    await page.locator('.wc-intro-nameplate .wc-nameplate-label').textContent(),
    'fighting for something greater than themselves',
  )
  assert(
    'Destiny media plaque uses the authored title',
    await page.locator('.wc-widget-title').textContent(),
    'The Wolves are Coming',
  )
  const introPlayerIndex = await page.evaluate(() =>
    window.__mockWolvesPlayers.findIndex(player => player.videoId === 'BV3BZKbpBns'),
  )
  await page.evaluate((index) => {
    window.__mockWolvesPlayers[index].seekTo(10, true)
  }, introPlayerIndex)
  await page.waitForSelector('.wolves-guardian-plate-trustee', { state: 'visible', timeout: 5_000 })
  assert(
    'Bob Killen plate carries the trustee label',
    await page.locator('.wolves-guardian-plate-trustee .wolves-guardian-plate-label').textContent(),
    'TRUSTEE // GUARDIAN',
  )
  assert(
    'Bob Killen plate carries the Voidwalker class',
    await page.locator('.wolves-guardian-plate-trustee .wolves-guardian-plate-class').textContent(),
    'Voidwalker Warlock',
  )
  await captureStage(page, 'destiny-bob-trustee')
  await page.evaluate((index) => {
    window.__mockWolvesPlayers[index].seekTo(15, true)
  }, introPlayerIndex)
  await page.waitForTimeout(600)
  assert('Kat Cosgrove plate replaces Bob Killen at 14.5', await page.locator('.wolves-guardian-plate-row:not(.wolves-guardian-plate-swap-leave-active) .wolves-guardian-plate').count(), 1)
  assertTruthy(
    'Kat Cosgrove plate is the one on screen after the swap',
    (await page.locator('.wolves-guardian-plate-row:not(.wolves-guardian-plate-swap-leave-active) .wolves-guardian-plate-name').textContent())?.includes('Kat Cosgrove'),
  )
  assertTruthy(
    'Kat Cosgrove companion plate names Karl',
    (await page.locator('.wolves-guardian-plate-row:not(.wolves-guardian-plate-swap-leave-active) .wolves-companion-plate-name').textContent())?.includes('Karl'),
  )
  await page.evaluate((index) => {
    window.__mockWolvesPlayers[index].seekTo(24.01, true)
  }, introPlayerIndex)
  await page.waitForTimeout(250)
  const comicHeroShotStart = page.locator('[data-comic-hero-shot]')
  assertTruthy('Comic Hero Shots title card starts on the Jorge hero shot', (await comicHeroShotStart.getAttribute('data-comic-hero-shot'))?.includes('youre-holding-it-wrong-post1'))
  await page.evaluate((index) => {
    window.__mockWolvesPlayers[index].seekTo(30.3, true)
  }, introPlayerIndex)
  await page.waitForTimeout(250)
  const comicHeroShotMid = await comicHeroShotStart.getAttribute('data-comic-hero-shot')
  assertTruthy('Comic Hero Shots title card advances to a later slide without repeating', comicHeroShotMid && comicHeroShotMid !== 'youre-holding-it-wrong-post1')
  await page.evaluate((index) => {
    window.__mockWolvesPlayers[index].seekTo(48.01, true)
  }, introPlayerIndex)
  assert(
    'Candle sequence keeps the authored music plaque',
    await page.locator('.wc-widget-title').textContent(),
    'The Wolves are Coming',
  )
  assert(
    'Top status holds the default title at 48 (no standing #nova4ever)',
    await page.locator('.wc-intro-nameplate .wc-nameplate-label').textContent(),
    'fighting for something greater than themselves',
  )
  await page.evaluate((index) => {
    window.__mockWolvesPlayers[index].seekTo(52.2, true)
  }, introPlayerIndex)
  await page.waitForFunction(
    () => document.querySelector('.wc-intro-nameplate .wc-nameplate-label')?.textContent === '#nova4ever',
    null,
    { timeout: 5_000 },
  )
  assert(
    'Nameplate glitches out to #nova4ever during the burst window',
    await page.locator('.wc-intro-nameplate .wc-nameplate').evaluate(node => node.classList.contains('wc-nameplate--glitch')),
    true,
  )
  await page.evaluate((index) => {
    window.__mockWolvesPlayers[index].seekTo(55, true)
  }, introPlayerIndex)
  await page.waitForFunction(
    () => document.querySelector('.wc-intro-nameplate .wc-nameplate-label')?.textContent === 'fighting for something greater than themselves',
    null,
    { timeout: 5_000 },
  )
  assert(
    'Nameplate snaps back after the glitch burst',
    await page.locator('.wc-intro-nameplate .wc-nameplate').evaluate(node => node.classList.contains('wc-nameplate--glitch')),
    false,
  )
  await page.evaluate((index) => {
    window.__mockWolvesPlayers[index].seekTo(87.5, true)
  }, introPlayerIndex)
  await page.waitForSelector('.wolves-guardian-plate', { state: 'visible', timeout: 5_000 })
  assert(
    'Natali guardian plate has the authored title',
    await page.locator('.wolves-guardian-plate-right .wolves-guardian-plate-title').textContent(),
    'Shipwright of Kubernetes',
  )
  await captureStage(page, 'destiny')

  // Complete the remaining intro stages before exercising the playlist handoff.
  await page.getByLabel('Next').click()

  await page.waitForSelector('.wolves-intro-overlay--transparent-handoff', { state: 'visible', timeout: 10_000 })
  await page.waitForTimeout(250)
  const handoffPresentation = await page.evaluate(() => {
    const overlay = document.querySelector('.wolves-intro-overlay')
    const stage = document.querySelector('.wc-stage')
    return {
      opacity: overlay ? getComputedStyle(overlay).opacity : '',
      transitionDuration: overlay ? getComputedStyle(overlay).transitionDuration : '',
      stageVisible: Boolean(stage && getComputedStyle(stage).visibility !== 'hidden'),
    }
  })
  assertTruthy('Intro handoff fades the complete Destiny overlay', Number(handoffPresentation.opacity) < 0.2, handoffPresentation)
  assert('Intro handoff uses the fast presentation dissolve', handoffPresentation.transitionDuration, '0.4s')
  assert('Track 0 stage is present before the intro overlay unmounts', handoffPresentation.stageVisible, true)
  await captureStage(page, 'intro-handoff')

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

  await seekStage(247.592)
  assert('4:08 holds the prior lore record until the slide cut', await page.locator('.conversation-title').textContent(), 'The Artifact')
  const slideBeforeFourOhEight = await page.locator('.flickr-photo-layer').evaluateAll((layers) =>
    layers.find(layer => getComputedStyle(layer).zIndex === '2')?.querySelector('img')?.getAttribute('src'),
  )
  assertTruthy('4:08 has a slide before the synchronized handoff', slideBeforeFourOhEight)
  await seekStage(247.596)
  assert('4:08 switches lore on the slide cut', await page.locator('.conversation-title').last().textContent(), 'The Children')
  assertTruthy(
    '4:08 switches the slideshow with the lore handoff',
    await page.locator('.flickr-photo-layer').evaluateAll(
      (layers, previousSlide) =>
        layers.find(layer => getComputedStyle(layer).zIndex === '2')?.querySelector('img')?.getAttribute('src') !== previousSlide,
      slideBeforeFourOhEight,
    ),
  )
  await captureStage(page, 'track-zero-408-handoff')

  await seekStage(365.05)
  const statusbarBounds = await page.evaluate(() => {
    const stage = document.querySelector('.wc-stage')
    const frame = document.querySelector('.wc-stage-nameplate')
    const nameplate = document.querySelector('.wc-stage-nameplate .wc-nameplate')
    const viewer = document.querySelector('.wc-trackzero-viewer')
    const stageRect = stage?.getBoundingClientRect()
    const frameRect = frame?.getBoundingClientRect()
    const nameplateRect = nameplate?.getBoundingClientRect()
    const viewerRect = viewer?.getBoundingClientRect()
    return {
      stageWidth: stageRect?.width ?? 0,
      frameLeft: frameRect?.left ?? 0,
      nameplateWidth: nameplateRect?.width ?? 0,
      nameplateBottom: nameplateRect?.bottom ?? 0,
      viewerTop: viewerRect?.top ?? 0,
    }
  })
  assertTruthy(
    'Track 0 statusbar spans the viewer width',
    Math.abs(statusbarBounds.nameplateWidth - (statusbarBounds.stageWidth - statusbarBounds.frameLeft * 2)) < 2,
  )
  assert(
    'Track 0 viewer begins below the top status bar',
    statusbarBounds.nameplateBottom <= statusbarBounds.viewerTop,
    true,
  )

  const incomingSignals = readFileSync('src/data/wolves-incoming-signal.txt', 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && line !== '---')
  const signalSlotSeconds = (408 - 365) / incomingSignals.length
  for (const [index, expected] of incomingSignals.entries()) {
    await seekStage(365 + index * signalSlotSeconds + 0.05)
    await page.waitForFunction(
      text => document.querySelector('.wc-stage-nameplate .wc-nameplate-label')?.textContent === text,
      expected,
      { timeout: 5_000 },
    )
    assert(`Finale status ${index + 1} renders in authored order`, await page.locator('.wc-stage-nameplate .wc-nameplate-label').textContent(), expected)
  }
  await captureStage(page, 'finale-interleaved-statuses')

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
    width < 1024 ? 'none' : 'grid',
  )
  assert('Unified lore root uses flex layout', unifiedLoreMetrics.rootDisplay, 'flex')
  assert('Unified lore feed uses flex layout', unifiedLoreMetrics.feedDisplay, 'flex')
  assert('Unified lore feed fills available height', unifiedLoreMetrics.feedFlexGrow, '1')
  assert('Unified lore feed permits shrinking', unifiedLoreMetrics.feedMinHeight, '0px')
  assertTruthy('Unified lore record retains vertical scrolling', ['auto', 'scroll'].includes(unifiedLoreMetrics.recordOverflowY))
  assert('Unified dossier directory stays removed from the selected-record view', unifiedLoreMetrics.directoryDisplay, '')
  assert('Unified lore feed stays inside the lore column', unifiedLoreMetrics.withinColumn, true)
  assert('Legacy split lore tabs are removed', unifiedLoreMetrics.oldTabsPresent, false)

  await seekStage(167.8)
  const trackZeroNameplateLabel = page.locator('.wc-stage-nameplate .wc-nameplate-label')
  const trackZeroSignal = page.locator('.wc-stage-nameplate .wc-nameplate-detail')
  // The plate label slow-fades (1.5s out-in) between authored signal lines, so signal
  // assertions wait for the expected authored text instead of sampling mid-fade.
  const assertSignal = async (label, expected) => {
    const ok = await page.waitForFunction(
      text => document.querySelector('.wc-stage-nameplate .wc-nameplate-label')?.textContent === text,
      expected,
      { timeout: 5_000 },
    ).then(() => true).catch(() => false)
    assert(label, ok ? expected : await trackZeroNameplateLabel.textContent(), expected)
  }
  assert('Track 0 nameplate enables slow signal fades', await page.locator('.wc-stage-nameplate .wc-nameplate').evaluate(node => node.classList.contains('wc-nameplate--slow-fade')), true)
  await assertSignal('Track 0 holds the opening signal line before the hero run', 'Welcome to Indie Cloud Native')
  assert('Track 0 spells the theater title differently from the sound widget', await trackZeroSignal.textContent(), 'Seven Days to the Wolves')
  await seekStage(44.211)
  await assertSignal('Opening line holds through the early stretch without spoilers', 'Welcome to Indie Cloud Native')
  await seekStage(167.8)
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
  await assertSignal('Opening line holds until the Bluefin group', 'Welcome to Indie Cloud Native')
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
  await assertSignal('Bluefin group receives its authored signal', 'The Blue Delivers')
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
  await assertSignal('Ambient signals begin after the Jorge hero window', 'Hikari Protocol: Initialized')
  assert('Lower thesis remains separate after the Bluefin group', await page.locator('.wc-thesis').count(), 0)

  await seekStage(228.9)
  await assertSignal('Post-hero signal run closes on the thriving-community pod', 'pod/thriving-community created')

  await seekStage(229)
  await assertSignal(
    'Chanting bridge reports the ImagePullBackOff warning',
    'Warning: ImagePullBackOff',
  )
  const warningNameplateBounds = await page.locator('.wc-stage-nameplate .wc-nameplate').evaluate((nameplate) => {
    const label = nameplate.querySelector('.wc-nameplate-label')
    const rect = nameplate.getBoundingClientRect()
    const labelRect = label?.getBoundingClientRect()
    return {
      withinViewport: rect.left >= 0 && rect.right <= window.innerWidth,
      labelWithinPlate: Boolean(labelRect && labelRect.right <= rect.right),
      labelOverflow: label ? getComputedStyle(label).overflow : '',
      labelTextOverflow: label ? getComputedStyle(label).textOverflow : '',
    }
  })
  assert('ImagePullBackOff nameplate stays inside the viewport', warningNameplateBounds.withinViewport, true)
  assert('ImagePullBackOff label stays within its status bar', warningNameplateBounds.labelWithinPlate, true)
  assert('ImagePullBackOff label clips within its status bar', warningNameplateBounds.labelOverflow, 'hidden')
  assert('ImagePullBackOff label uses an ellipsis when clipped', warningNameplateBounds.labelTextOverflow, 'ellipsis')
  assert('Lower thesis remains separate during the warning', await page.locator('.wc-thesis').count(), 0)
  await captureStage(page, 'track-zero-community-warning')

  await seekStage(277)
  await assertSignal(
    'Heavy build-up reports the human fallback',
    // The quoted token renders in monospace with the quotes stripped.
    'Falling back to humans/trying-their-best:v1 slowly',
  )
  assertTruthy(
    'Fallback image token renders in the terminal monospace',
    await page.locator('.wc-stage-nameplate .wc-nameplate-label-mono').evaluate(node => node.textContent === 'humans/trying-their-best:v1' && getComputedStyle(node).fontFamily.toLowerCase().includes('mono')),
  )
  assert('Lower thesis remains separate during the fallback', await page.locator('.wc-thesis').count(), 0)
  await captureStage(page, 'track-zero-community-fallback')

  await seekStage(345)
  await page.waitForTimeout(250)
  await assertSignal('Thesis opening leads the top statuses', 'We\'ve got your back.')
  assert('Center overlay stays clear while the thesis lines run in the statuses', await page.locator('.wc-thesis').count(), 0)

  await seekStage(350.5)
  await page.waitForTimeout(250)
  await assertSignal('Universal Blue line follows in the top statuses', 'We are Universal Blue.')
  await captureStage(page, 'track-zero-thesis-status')

  await seekStage(365)
  await page.waitForTimeout(250)
  await assertSignal('Signal messages restart after the thesis lines', 'Welcome to Indie Cloud Native')

  await seekStage(407.5)
  await page.waitForTimeout(250)
  await assertSignal('Compressed signal cycle reaches its final message before Titanfall', 'Software is Supposed to Die')

  await seekStage(408)
  await assertSignal('Titanfall signal remains the locked finale handoff', 'Bazzite Mk6 Units: Prepare for Titanfall')
  assertTruthy('Lower thesis keeps its authored finale text', (await page.locator('.wc-thesis').textContent())?.includes('Become Legend'))
  await captureStage(page, 'track-zero-composites')

  await seekStage(408.137)
  const finaleImage = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Music-authoritative barrage hands off to the Maintainer Summit finale image at 408.137', finaleImage?.includes('kubecon-55164466314.webp'))
  await seekStage(422.99)
  const heldFinaleImage = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Maintainer Summit finale image holds through the Track 0 handoff', heldFinaleImage?.includes('kubecon-55164466314.webp'))
  await captureStage(page, 'track-zero-paced-finale')

  await page.getByLabel('Next').click()
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
  assert('Ghosts opener identifies Jorge Castro', await ghostsCaption.locator('.theater-guardian-name').textContent(), 'Jorge Castro')
  assert('Ghosts opener carries the Harbinger Titan class', await ghostsCaption.locator('.theater-guardian-class').textContent(), 'Harbinger Titan')
  assertTruthy('Ghosts opener carries the guardian titles', (await ghostsCaption.locator('.theater-guardian-title').textContent())?.includes('Upender of Antipatterns'))
  assert('Ghosts opener preserves Jorge quote part one', ghostsCaptionText, JORGE_GHOSTS_QUOTE_PART_ONE)
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

  await seekStage(19.3)
  const ghostsCaptionPartTwo = (await ghostsCaption.locator('.wallpaper-theater-caption-body').allTextContents())
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim())
    .join(' ')
  assert('Ghosts opener advances to Jorge quote part two', ghostsCaptionPartTwo, JORGE_GHOSTS_QUOTE_PART_TWO)
  await captureStage(page, 'ghosts-mn047-jorge-part-two')

  await seekStage(32.3)
  const ghostsCaptionPartThree = (await ghostsCaption.locator('.wallpaper-theater-caption-body').allTextContents())
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim())
    .join(' ')
  assert('Ghosts opener advances to Jorge quote part three', ghostsCaptionPartThree, JORGE_GHOSTS_QUOTE_PART_THREE)

  await seekStage(48.399)
  const ghostsBeforeHandoff = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assertTruthy('Jorge MN047 holds through 48.399 seconds', ghostsBeforeHandoff?.includes('55164222671_32d7ace307_c.jpg'))

  await seekStage(48.4)
  const ghostsAtHandoff = await page.locator('.flickr-photo-layer').evaluateAll((layers) => {
    const activeLayer = layers.find(layer => getComputedStyle(layer).zIndex === '2')
    return activeLayer?.querySelector('img')?.getAttribute('src')
  })
  assert('Jorge MN047 hands off at 48.4 seconds', ghostsAtHandoff?.includes('55164222671_32d7ace307_c.jpg'), false)
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
