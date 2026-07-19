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

  await page.getByRole('button', { name: /JOIN THE EVOLUTION|BEGIN TRANSMISSION|MEET YOUR TEAMMATES/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 10_000 })

  async function assertNameplate(detail, label) {
    const nameplate = page.locator('.wc-intro-nameplate .wc-nameplate')
    await nameplate.waitFor({ state: 'visible', timeout: 5_000 })
    expectEqual('Nameplate detail', await nameplate.locator('.wc-nameplate-detail').textContent(), detail)
    expectEqual('Nameplate label', await nameplate.locator('.wc-nameplate-label').textContent(), label)
    expectEqual('Nameplate label stays on one line', await nameplate.locator('.wc-nameplate-label').evaluate(element => getComputedStyle(element).whiteSpace), 'nowrap')
    const [plateBox, labelBox] = await Promise.all([
      nameplate.boundingBox(),
      nameplate.locator('.wc-nameplate-label').boundingBox(),
    ])
    expectTruthy('Nameplate bounds', plateBox)
    expectTruthy('Nameplate label bounds', labelBox)
    if (plateBox && labelBox) {
      expectTruthy('Nameplate label remains inside the plate', labelBox.x + labelBox.width <= plateBox.x + plateBox.width + 1)
    }
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

  async function assertGuardianPair({ name, artwork, lowerThird = true, leftAnchored = true }) {
    await page.waitForFunction((expected) => {
      const plate = document.querySelector('.wolves-guardian-plate')
      const art = document.querySelector('.wolves-companion-plate-art')
      const text = plate?.textContent ?? ''
      const src = art?.getAttribute('src') ?? ''
      return text.includes(expected.name)
        && src.includes(expected.artwork)
    }, { name, artwork }, { timeout: 5_000 })

    const box = await page.locator('.wolves-guardian-plate').boundingBox()
    expectTruthy(`${name} guardian plate bounds`, box)
    const companionBox = await page.locator('.wolves-companion-plate').boundingBox()
    expectTruthy(`${name} companion plate bounds`, companionBox)
    if (!box) {
      return
    }
    if (companionBox) {
      expectTruthy(`${name} companion card is independently right anchored`, Math.abs((companionBox.x + companionBox.width) - VIEWPORT.width * 0.95) < 8)
      expectTruthy(`${name} companion card is independently bottom anchored`, Math.abs((companionBox.y + companionBox.height) - VIEWPORT.height * 0.9) < 8)
    }

    if (lowerThird) {
      expectTruthy(`${name} remains in the lower third`, box.y > VIEWPORT.height * 0.4)
    }
    if (leftAnchored) {
      expectTruthy(`${name} remains left anchored`, box.x < VIEWPORT.width * 0.25)
    }
  }

  await page.waitForSelector('.wolves-intro-overlay-player', { state: 'visible', timeout: 10_000 })
  await assertNameplate('Meet your Fireteam', 'fighting for something greater than themselves')
  expectTruthy('Destiny player mounted', await page.locator('.wolves-intro-overlay-player').isVisible())
  await capture(page, '08-destiny-trailer')

  await seekActiveDestinyPlayer(6.2)
  await assertGuardianPair({
    name: 'Bob Killen',
    artwork: 'bob-torosaurus.webp',
  })
  await capture(page, '09-destiny-bob-torosaurus')

  await seekActiveDestinyPlayer(20)
  await assertGuardianPair({
    name: 'Kat Cosgrove',
    artwork: 'karl.webp',
  })
  await capture(page, '10-destiny-karl')

  await seekActiveDestinyPlayer(39)
  await assertGuardianPair({
    name: 'Kaslin Fields',
    artwork: 'header/katharina.webp',
  })
  expectEqual('Kaslin companion name', await page.locator('.wolves-companion-plate-name').textContent(), 'Katerina')
  await capture(page, '10-destiny-kaslin-torosaurus')

  await seekActiveDestinyPlayer(90)
  await page.waitForFunction(() => {
    const plate = [...document.querySelectorAll('.wolves-guardian-plate')]
      .find(node => node.textContent?.includes('Natali Vlatko'))
    const art = document.querySelector('.wolves-companion-plate-art')
    return (plate?.textContent ?? '').includes('Natali Vlatko')
      && (art?.getAttribute('src') ?? '').includes('alamosaurus')
  }, { timeout: 5_000 })
  const natBox = await page.locator('.wolves-guardian-plate').filter({ hasText: 'Natali Vlatko' }).boundingBox()
  const alamoBox = await page.locator('.wolves-companion-plate').boundingBox()
  expectTruthy('Natali Vlatko guardian plate bounds', natBox)
  expectTruthy('Alamo companion plate bounds', alamoBox)
  if (natBox && alamoBox) {
    expectTruthy('Alamo is independently right anchored', Math.abs((alamoBox.x + alamoBox.width) - VIEWPORT.width * 0.95) < 8)
  }
  const christophBox = await page.locator('.wolves-guardian-plate').filter({ hasText: 'Christoph Blecker' }).boundingBox()
  expectTruthy('Christoph Blecker guardian plate bounds', christophBox)
  const christophClasses = await page.locator('.wolves-guardian-plate').filter({ hasText: 'Christoph Blecker' }).getAttribute('class')
  expectTruthy('Christoph Blecker uses the trustee badge', christophClasses?.includes('wolves-guardian-plate-trustee'))
  expectTruthy('Christoph Blecker is classified as a leader', christophClasses?.includes('wolves-guardian-plate-leader'))
  const christophName = page.locator('.wolves-guardian-plate').filter({ hasText: 'Christoph Blecker' })
    .locator('.wolves-guardian-plate-name')
  expectTruthy('Christoph Blecker has the gold name class', await christophName.getAttribute('class').then(classes => classes?.includes('wolves-guardian-plate-name-gold')))
  const christophNameGradient = await christophName.evaluate(element => getComputedStyle(element).backgroundImage)
  expectTruthy('Christoph Blecker keeps a gold name', christophNameGradient.includes('rgb(250, 204, 21)'))
  expectEqual('Christoph Blecker gold name has no blur filter', await christophName.evaluate(element => getComputedStyle(element).filter), 'none')
  if (christophBox && alamoBox) {
    expectTruthy('Alamo shares Christoph Blecker\'s lower baseline', Math.abs((alamoBox.y + alamoBox.height) - (christophBox.y + christophBox.height)) < 8)
  }
  await capture(page, '11-destiny-natali-alamo')
}
finally {
  await browser.close()
}
