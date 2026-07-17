import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const WOLVES_URL = `${BASE_URL}/wolves/`
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

async function capture(page, name) {
  if (SCREENSHOT_DIR) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: false })
  }
}

const transitions = [
  {
    name: 'transition-1',
    chapter: 'PART II',
    title: 'Ghosts In The Mist',
    texts: [
      'krook:',
      'Ok let\'s do this one by the books, intel in your feeds. Remember, prioritize all Maintainer-Guardian workflows, they\'re depending on us.',
      'sabot-6:',
      'Practioner-Guardian efficiency is — what? Seven percent? That\'s —',
    ],
    selectors: [],
  },
  {
    name: 'transition-2',
    chapter: 'PART III',
    title: 'Tonight We Must Be Warriors',
    texts: [
      'krook:',
      'ok tighten it up folks, ihor bring her in low —',
      'ihord:',
      'locked in the pipe, five by five — good hunting —',
    ],
    selectors: [],
  },
  {
    name: 'transition-3',
    chapter: 'PART IV',
    title: 'Not Your Monster',
    texts: [
      '-- static --',
      'K:',
      'Keep up kids you\'re down three minutes, you\'re not going to keep up with basic maturity guidelines, and you know what they say, trust but verify.',
    ],
    selectors: ['[data-transition-kind="static"]'],
  },
  {
    name: 'transition-4',
    chapter: 'PART V',
    title: 'End of You',
    texts: [
      '* knock the pod door *',
      '[Use one dramatic metal bulkhead knock here.]',
      'sabot-6',
      '* knock * * knock *',
    ],
    selectors: ['[data-transition-effect="bulkhead-knock"]', '[data-transition-effect="bulkhead-response"]'],
  },
  {
    name: 'transition-5',
    chapter: 'PART VI',
    title: 'Soulbound',
    texts: [
      'angie:',
      'AAIF-7 on the net, someone need guidance?',
      '*** explosion sound',
    ],
    selectors: ['[data-transition-effect="explosion"]'],
  },
  {
    name: 'transition-6',
    chapter: 'PART VII',
    title: 'Last Ride of the Day',
    texts: [
      '// CLOUD NATIVE TRANSFORMATION DETECTED',
      '// Deploy CNCF Projects Team, scramble all Guardians.',
    ],
    selectors: ['[data-transition-kind="terminal"]'],
  },
]

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

  await page.getByRole('button', { name: /JOIN THE EVOLUTION|BEGIN TRANSMISSION/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 10_000 })

  for (let click = 0; click < 5; click++) {
    await page.getByLabel('Next').click()
    await page.waitForTimeout(120)
  }

  await page.waitForSelector('.wc-stage', { state: 'visible', timeout: 10_000 })

  for (const transition of transitions) {
    await page.getByLabel('Next').click()
    assertTruthy(`Triggered ${transition.name}`, true)
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
