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

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`)
  }
}

function expectTruthy(label, value) {
  if (!value) {
    throw new Error(`${label}: expected a truthy value`)
  }
}

async function capture(page, name) {
  if (!SCREENSHOT_DIR) {
    return
  }
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` })
}

const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: VIEWPORT })

  await page.addInitScript(() => {
    window.__mockWolvesPlayers = []

    window.YT = {
      Player: class MockPlayer {
        constructor(element, config) {
          this.config = config
          this.videoId = config.videoId ?? null
          this.currentTime = 0
          this.state = window.YT.PlayerState.CUED
          window.__mockWolvesPlayers.push(this)

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
        getVolume() { return 100 }
        loadVideoById(id) { this.videoId = id.videoId ?? id }
        cueVideoById(id) { this.videoId = id.videoId ?? id }
        destroy() {}
        mute() {}
        unMute() {}
      },
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    }

    if (!window.onYouTubeIframeAPIReady) {
      window.onYouTubeIframeAPIReady = () => {}
    }
  })

  try {
    await page.goto(WOLVES_URL, { waitUntil: 'networkidle', timeout: 30_000 })
  }
  catch {
    await page.goto(WOLVES_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  }

  await page.getByRole('button', { name: /JOIN THE EVOLUTION|BEGIN TRANSMISSION/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 10_000 })

  async function assertNameplate(detail, label) {
    await page.waitForSelector('.wc-nameplate', { state: 'visible', timeout: 5_000 })
    expectEqual('Nameplate detail', await page.locator('.wc-nameplate-detail').textContent(), detail)
    expectEqual('Nameplate label', await page.locator('.wc-nameplate-label').textContent(), label)
  }

  async function assertNoNameplate() {
    await page.waitForFunction(() => !document.querySelector('.wc-nameplate'), null, { timeout: 5_000 })
    expectTruthy('Nameplate absent', !(await page.locator('.wc-nameplate').count()))
  }

  async function assertOverlayContains(text) {
    await page.waitForFunction(expected => {
      const overlay = document.querySelector('.wolves-intro-overlay-text')
      return overlay?.textContent?.includes(expected)
    }, text, { timeout: 5_000 })
  }

  async function seekIntro(seconds, duration) {
    void duration
    await page.evaluate(targetSeconds => window.__wolvesIntro.seekTo(targetSeconds), seconds)
    await page.waitForTimeout(250)
  }

  async function seekMockPlayer(videoId, seconds) {
    await page.evaluate(({ activeVideoId, targetSeconds }) => {
      const player = window.__mockWolvesPlayers.find(entry => entry.videoId === activeVideoId)
      player?.seekTo(targetSeconds, true)
    }, { activeVideoId: videoId, targetSeconds: seconds })
    await page.waitForTimeout(250)
  }

  async function seekActiveDestinyPlayer(seconds) {
    const videoId = await page.evaluate(() => {
      const destinyIds = ['BV3BZKbpBns', 'BKm0TPqeOjY']
      const player = [...window.__mockWolvesPlayers].reverse().find(entry => destinyIds.includes(entry.videoId))
      return player?.videoId ?? ''
    })
    expectTruthy('Active Destiny player id', videoId)
    await seekMockPlayer(videoId, seconds)
  }

  async function assertGuardianPair({ name, label, scientificName, artwork, lowerThird = true, leftAnchored = true }) {
    await page.waitForFunction((expected) => {
      const plate = document.querySelector('.wolves-guardian-plate')
      const art = document.querySelector('.wolves-guardian-plate-dinosaur-art')
      const text = plate?.textContent ?? ''
      const src = art?.getAttribute('src') ?? ''
      return text.includes(expected.name)
        && text.includes(expected.label)
        && text.includes(expected.scientificName)
        && src.includes(expected.artwork)
    }, { name, label, scientificName, artwork }, { timeout: 5_000 })

    const box = await page.locator('.wolves-guardian-plate').boundingBox()
    expectTruthy(`${name} guardian plate bounds`, box)
    if (!box) {
      return
    }

    if (lowerThird) {
      expectTruthy(`${name} remains in the lower third`, box.y > VIEWPORT.height * 0.4)
    }
    if (leftAnchored) {
      expectTruthy(`${name} remains left anchored`, box.x < VIEWPORT.width * 0.25)
    }
  }

  await assertNoNameplate()
  await page.waitForFunction(() => window.__mockWolvesPlayers.some(player => player.videoId === 'EB3IokHelRk'), null, { timeout: 5_000 })
  await assertOverlayContains('A Gardener and a Winnower walked among the stars')
  await seekMockPlayer('EB3IokHelRk', 5.1)
  await assertOverlayContains('One to spread life')
  const prologueHighlights = await page.locator('.wolves-intro-letter-highlight').allTextContents()
  expectEqual('Prologue highlighted words', prologueHighlights.join(''), 'lifedrossGarden')
  await assertNoNameplate()
  await capture(page, '03-prologue-life-dross-garden')

  await seekMockPlayer('EB3IokHelRk', 50.2)
  await assertOverlayContains('In the space of a few days')
  await assertNameplate('PROLOGUE', 'From the Age of Dinosaurs to the Pinnacle of Humanity')
  await capture(page, '04-prologue-nameplate-override')

  await page.getByLabel('Next').click()
  await page.waitForSelector('.wolves-intro-overlay-player', { state: 'visible', timeout: 10_000 })
  await assertNameplate('UNIVERSAL BLUE BRIEFING', 'Destiny 2: Into the Light Cinematic')
  expectTruthy('Destiny player mounted', await page.locator('.wolves-intro-overlay-player').isVisible())
  await capture(page, '08-destiny-trailer')

  await seekActiveDestinyPlayer(6.2)
  await assertGuardianPair({
    name: 'Bob Killen',
    label: 'TOROSAURUS',
    scientificName: 'Torosaurus latus',
    artwork: 'bob-torosaurus.webp',
  })
  await capture(page, '09-destiny-bob-torosaurus')

  await seekActiveDestinyPlayer(39)
  await assertGuardianPair({
    name: 'Kaslin Fields',
    label: 'TOROSAURUS',
    scientificName: 'Torosaurus latus',
    artwork: 'kaslin-torosaurus.webp',
  })
  await capture(page, '10-destiny-kaslin-torosaurus')
}
finally {
  await browser.close()
}
