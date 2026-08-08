/**
 * Wolves buffer parking browser test — standalone Playwright script
 *
 * The dual-buffer player starts the *next* segment early so YouTube has time to
 * buffer it. If that prewarmed buffer is not parked again, it keeps playing
 * silently underneath the current segment for the whole segment, and the next
 * song is already minutes in by the time the room hears it. The show loses
 * several minutes and the progress bar jumps on every handoff.
 *
 * This cannot be caught by a build, and it cannot be caught by a player double
 * whose clock does not advance: a runaway buffer and a parked one look
 * identical when `getCurrentTime()` always returns 0. So the mock here runs a
 * real clock, driven from the test.
 *
 * Prerequisites: dev server must be running at http://127.0.0.1:5173
 *   npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
 *
 * Run:
 *   node tests/wolves-buffer-parking.mjs
 */

import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const WOLVES_URL = `${BASE_URL}/wolves/`
const SEGMENT_SECONDS = 40

let passed = 0
let failed = 0

function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
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
}

const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] })
let exitCode = 0

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  await page.addInitScript(() => {
    Math.random = () => 0
    window.__mockWolvesPlayers = []
    const PS = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }

    window.YT = {
      PlayerState: PS,
      Player: class MockPlayer {
        constructor(element, config) {
          this.config = config
          this.videoId = config.videoId ?? null
          this.playlistIndex = 0
          this.currentTime = 0
          this.duration = 400
          this.volume = 100
          this.state = PS.CUED
          window.__mockWolvesPlayers.push(this)
          Promise.resolve().then(() => {
            this.config.events?.onReady?.({ target: this })
            this.state = PS.PLAYING
            this.config.events?.onStateChange?.({ data: this.state, target: this })
          })
        }

        /** Only a player whose clock actually runs can expose a runaway buffer. */
        tick(seconds) {
          if (this.state !== PS.PLAYING) {
            return
          }
          this.currentTime = Math.min(this.duration, this.currentTime + seconds)
          if (this.currentTime >= this.duration) {
            this.state = PS.ENDED
            this.config.events?.onStateChange?.({ data: PS.ENDED, target: this })
          }
        }

        playVideo() {
          // YouTube restarts a finished video from the top.
          if (this.state === PS.ENDED) {
            this.currentTime = 0
          }
          this.state = PS.PLAYING
          this.config.events?.onStateChange?.({ data: this.state, target: this })
        }

        pauseVideo() {
          this.state = PS.PAUSED
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

        getPlaylistIndex() { return this.playlistIndex }
        getCurrentTime() { return this.currentTime }
        getDuration() { return this.duration }
        seekTo(seconds) { this.currentTime = seconds }
        setVolume(value) { this.volume = value }
        getVolume() { return this.volume }
        loadVideoById(id) {
          this.videoId = id.videoId ?? id
          this.currentTime = id.startSeconds ?? 0
        }

        cueVideoById(id) { this.videoId = id.videoId ?? id }
        destroy() {}
        mute() {}
        unMute() {}
      },
    }

    if (!window.onYouTubeIframeAPIReady) {
      window.onYouTubeIframeAPIReady = () => {}
    }

    window.__tickAll = (seconds) => {
      window.__mockWolvesPlayers.forEach(player => player.tick(seconds))
    }
  })

  console.log(`\nWolves buffer parking browser test`)
  console.log(`  URL: ${WOLVES_URL}\n`)

  await page.goto(WOLVES_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => typeof window.__wolvesDurations?.skipIntro === 'function',
    { timeout: 15_000 },
  )
  // `skipIntro()` is async; returning its promise to evaluate() hangs the run.
  await page.evaluate(() => { window.__wolvesDurations.skipIntro() })
  await page.waitForFunction(() => window.__mockWolvesPlayers.length >= 2, { timeout: 15_000 })
  await page.waitForTimeout(1500)

  // Run well into the first segment. An unparked prewarm buffer accumulates the
  // same clock as the active one, which is exactly the defect.
  for (let index = 0; index < SEGMENT_SECONDS; index += 1) {
    await page.evaluate(() => window.__tickAll(1))
    await page.waitForTimeout(25)
  }

  const buffers = await page.evaluate(() =>
    window.__mockWolvesPlayers
      .filter(player => !player.config?.playerVars?.listType)
      .map(player => ({
        state: player.state,
        currentTime: Math.round(player.currentTime),
        volume: player.volume,
      })))

  console.log(`  buffers: ${JSON.stringify(buffers)}\n`)

  const playing = buffers.filter(buffer => buffer.state === 1)
  const parked = buffers.filter(buffer => buffer.state === 2)

  assert('exactly one buffer is playing', playing.length, 1)
  assert('the prewarmed buffer is parked, not running away', parked.length >= 1, true)
  assert('every parked buffer sits on its opening frame', parked.every(b => b.currentTime === 0), true)
  assert('every parked buffer is silent', parked.every(b => b.volume === 0), true)
  assert(
    'the active buffer advanced, so the clock really was running',
    playing.every(b => b.currentTime > 0),
    true,
  )
}
catch (error) {
  console.error(`\nTest failed with error: ${error.message}`)
  exitCode = 1
}
finally {
  await browser.close()
}

console.log(`\nResults: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : exitCode)
