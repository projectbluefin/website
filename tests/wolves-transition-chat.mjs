import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const WOLVES_URL = `${BASE_URL}/wolves/experience/`
const [width, height] = (process.env.WOLVES_VIEWPORT ?? '1440x900').split('x').map(Number)
const VIEWPORT = { width, height }
const SCREENSHOT_DIR = process.env.WOLVES_SCREENSHOT_DIR

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
    console.error(`        expected: ${expected}`)
    console.error(`        got:      ${actual}`)
  }
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
    console.error(`        got: ${actual}`)
  }
}

async function assertVisibleText(page, label, text) {
  const locator = page.locator('.wc-transition-overlay').getByText(text, { exact: true })
  const count = await locator.count()
  const visible = count > 0 && await locator.first().isVisible().catch(() => false)
  assert(label, visible, true)
}

async function clickControl(page, label) {
  // The transport widget auto-hides without pointer input, and scripted seeks do
  // not count as input. Nudge the pointer, then click the *visible* match: the
  // overlay and the transport both expose a control with this label, and a raw
  // getByLabel intermittently resolves to the off-screen one.
  await page.mouse.move(720, 450)
  await page.mouse.move(722, 452)
  await page.waitForTimeout(800)
  const control = page.getByLabel(label)
  const count = await control.count()
  for (let index = 0; index < count; index += 1) {
    const candidate = control.nth(index)
    if (await candidate.isVisible()) {
      await candidate.click()
      return
    }
  }
  throw new Error(`No visible "${label}" control to click`)
}

async function capture(page, name) {
  if (SCREENSHOT_DIR) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: false })
  }
}

const TERMINAL_TEXTS = [
  '// CLOUD NATIVE TRANSFORMATION DETECTED',
  '// Deploy CNCF Projects Team, scramble all Guardians.',
]

// The authored lore conversations are hidden from the overlay; every
// transition renders the terminal block instead.
const transitions = [
  // Ghosts In The Mist opens on the Jorge Castro guardian plate, so
  // CinematicTransition deliberately renders no terminal card for this handoff.
  { name: 'transition-1', chapter: 'PART II', title: 'Ghosts In The Mist', skipsOverlay: true },
  { name: 'transition-2', chapter: 'PART III', title: 'Tonight We Must Be Warriors' },
  { name: 'transition-3', chapter: 'PART IV', title: 'Not Your Monster' },
  { name: 'transition-4', chapter: 'PART V', title: 'End of You' },
  { name: 'transition-5', chapter: 'PART VI', title: 'Soulbound' },
  { name: 'transition-6', chapter: 'PART VII', title: 'Last Ride of the Day' },
].map(transition => ({
  ...transition,
  texts: TERMINAL_TEXTS,
  selectors: ['[data-transition-kind="terminal"]'],
}))

const browser = await chromium.launch({ headless: true })
let exitCode = 0

try {
  const page = await browser.newPage({ viewport: VIEWPORT })

  await page.addInitScript(() => {
    Math.random = () => 0
    window.__mockWolvesPlayers = []

    window.YT = {
      Player: class MockPlayer {
        constructor(element, config) {
          this.config = config
          this.element = element
          this.loadedId = config.videoId ?? ''
          this.cuedId = ''
          this.currentTime = 0
          this.duration = 500
          this.volume = 100
          this.state = window.YT.PlayerState.CUED
          this.kind = element.closest('.wc-stage') ? 'stage' : (element.closest('.wolves-intro-overlay') ? 'intro' : 'other')
          window.__mockWolvesPlayers.push(this)

          Promise.resolve().then(() => {
            this.config.events?.onReady?.({ target: this })
            if (this.loadedId) {
              this.playVideo()
            }
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
          this.loadedId = typeof video === 'string' ? video : video.videoId
          this.currentTime = typeof video === 'string' ? 0 : (video.startSeconds ?? 0)
          this.playVideo()
        }

        cueVideoById(video) {
          this.cuedId = typeof video === 'string' ? video : video.videoId
        }

        getCurrentTime() {
          return this.currentTime
        }

        getDuration() {
          return this.duration
        }

        getVolume() {
          return this.volume
        }

        setVolume(volume) {
          this.volume = volume
        }

        seekTo(seconds) {
          this.currentTime = seconds
        }

        destroy() {}
        mute() {}
        unMute() {}

        triggerEnded() {
          this.state = window.YT.PlayerState.ENDED
          this.config.events?.onStateChange?.({ data: this.state, target: this })
        }
      },
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    }

    window.__triggerActiveStageEnded = () => {
      const active = window.__mockWolvesPlayers
        .filter(player => player.kind === 'stage')
        .find(player => player.state === window.YT.PlayerState.PLAYING)

      if (!active) {
        return false
      }

      active.triggerEnded()
      return true
    }

    if (!window.onYouTubeIframeAPIReady) {
      window.onYouTubeIframeAPIReady = () => {}
    }
  })

  console.log(`\nWolves transition chat browser test`)
  console.log(`  URL:      ${WOLVES_URL}`)
  console.log(`  Viewport: ${VIEWPORT.width}x${VIEWPORT.height}\n`)

  try {
    await page.goto(WOLVES_URL, { waitUntil: 'networkidle', timeout: 30_000 })
  }
  catch {
    await page.goto(WOLVES_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  }

  await page.getByRole('button', { name: /JOIN THE EVOLUTION|BEGIN TRANSMISSION|MEET YOUR TEAMMATES/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 10_000 })

  // The show opens on the silent welcome title card, which runs for the best part
  // of a minute before the Destiny trailer mounts its player. Step past it rather
  // than waiting it out — a harness that waits on the player first dies here with
  // zero assertions run, which reads as a hang rather than a stale selector.
  await page.waitForSelector('.wolves-intro-title-card-plate', { state: 'visible', timeout: 10_000 })
  await clickControl(page, 'Next')

  await page.waitForSelector('.wolves-intro-overlay-player', { state: 'visible', timeout: 15_000 })
  await clickControl(page, 'Next')
  await page.waitForSelector('.wolves-intro-overlay', { state: 'hidden', timeout: 15_000 })

  await page.waitForSelector('.wc-stage', { state: 'visible', timeout: 10_000 })
  const compactPlayerBounds = await page.locator('.wc-stage .wc-layer').evaluateAll(layers =>
    layers.map(layer => {
      const rect = layer.getBoundingClientRect()
      return { width: rect.width, height: rect.height, opacity: getComputedStyle(layer).opacity }
    }),
  )
  assertTruthy(
    'Cinematic YouTube buffers stay compact and invisible while the theater owns presentation',
    compactPlayerBounds.length === 2
      && compactPlayerBounds.every(bounds => bounds.width <= 2 && bounds.height <= 2 && bounds.opacity === '0'),
  )

  for (const transition of transitions) {
    await clickControl(page, 'Next')
    assertTruthy(`Triggered ${transition.name}`, true)

    if (transition.skipsOverlay) {
      // Assert the deliberate absence rather than stepping over it, so losing the
      // skip shows up here instead of in front of an audience.
      await page.waitForTimeout(1500)
      assert(
        `${transition.name} renders no terminal card by design`,
        await page.locator('.wc-transition-overlay').isVisible().catch(() => false),
        false,
      )
      continue
    }

    await page.waitForSelector('.wc-transition-overlay', { state: 'visible', timeout: 10_000 })

    assert(`${transition.name} chapter`, await page.locator('.wc-transition-overlay .wc-label').textContent(), transition.chapter)
    assert(`${transition.name} title`, await page.locator('.wc-transition-overlay .wc-transition-title').textContent(), transition.title)

    for (const text of transition.texts) {
      await assertVisibleText(page, `${transition.name} text ${text}`, text)
    }
    for (const selector of transition.selectors) {
      const locator = page.locator('.wc-transition-overlay').locator(selector)
      const count = await locator.count()
      assertTruthy(`${transition.name} selector ${selector}`, count > 0 && await locator.first().isVisible().catch(() => false))
    }
    assert(`${transition.name} hides the lore conversation`, await page.locator('.wc-transition-overlay [data-transition-kind="speaker"]').count(), 0)

    await capture(page, transition.name)
    await page.waitForSelector('.wc-transition-overlay', { state: 'hidden', timeout: 10_000 })
  }
}
catch (error) {
  console.error(`\nTest failed with error: ${error.message}`)
  console.error(error.stack || '')
  exitCode = 1
}
finally {
  await browser.close()
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  exitCode = 1
}
process.exit(exitCode)
