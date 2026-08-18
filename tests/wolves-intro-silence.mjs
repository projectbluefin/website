/**
 * Real-player check that the cinematic stays silent through the Destiny intro.
 *
 * The seven cinematic buffers are built and prewarmed while the intro is on screen,
 * minutes before the audience is meant to hear anything from them. A buffer that is
 * playing, unmuted, at a non-zero volume in that window is a song playing over the
 * whole opening — reported from a build as "there's a song playing in my intro".
 *
 * Run against a dev server on 127.0.0.1:5173.
 */
import process from 'node:process'
import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const BASE = `${BASE_URL}/wolves/experience/`
const WATCH_MS = Number(process.env.WATCH_MS ?? 45000)

const log = (...args) => console.log(...args)
let failures = 0

const browser = await chromium.launch({
  headless: process.env.HEADED !== '1',
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-sandbox'],
})
const page = await browser.newPage()
page.on('pageerror', e => log('PAGEERROR:', e.message))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.locator('.wc-lobby-enter').first().click({ timeout: 30000 })
await page.waitForFunction(() => !!window.__wolvesDurations?.buffers?.(), null, { timeout: 30000 })
log('intro running; watching the cinematic buffers underneath it')

const start = Date.now()
let lastKey = ''

while (Date.now() - start < WATCH_MS) {
  const snap = await page.evaluate(() => {
    try {
      const b = window.__wolvesDurations.buffers()
      return {
        ...b,
        phase: document.querySelector('.wolves-intro-overlay') ? 'intro' : 'cinematic',
      }
    }
    catch {
      return null
    }
  })

  if (!snap) {
    await page.waitForTimeout(250)
    continue
  }

  // Once the intro has handed off, this harness's job is done.
  if (snap.phase !== 'intro') {
    log(`[${((Date.now() - start) / 1000).toFixed(1)}s] intro handed off to the cinematic; stopping`)
    break
  }

  const key = `${snap.a.audible}|${snap.b.audible}|${snap.a.actual}|${snap.b.actual}`
  if (key !== lastKey) {
    lastKey = key
    const fmt = s => `${s.side} got=${(s.actual ?? '------').slice(0, 6)} vol=${s.volume} muted=${s.muted} audible=${s.audible}`
    log(`[${((Date.now() - start) / 1000).toFixed(1)}s] ${fmt(snap.a)} | ${fmt(snap.b)}`)
  }

  for (const side of [snap.a, snap.b]) {
    // A buffer with no media attached cannot be heard whatever its volume says.
    if (side.actual && side.audible > 0) {
      log(`FAIL: buffer ${side.side} is audible during the intro (volume ${side.volume}, muted ${side.muted}, holding ${side.actual})`)
      failures += 1
    }
  }

  await page.waitForTimeout(250)
}

log(`\n=== ${failures} moments of audible cinematic audio during the intro ===`)
await browser.close()
process.exit(failures > 0 ? 1 : 0)
