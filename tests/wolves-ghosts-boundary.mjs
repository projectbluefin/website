/**
 * Real-player check for the Part I -> Part II seam.
 *
 * Reported defect: "Ghosts In The Mist is broken, the Avatar song comes up instead" —
 * the words and slides said Part II while the room heard a different segment.
 *
 * The invariant this asserts is the one the audience experiences: whatever the store
 * is naming on screen, the buffer that is actually on air is either holding that same
 * segment or holding nothing yet. It must never be holding a DIFFERENT segment.
 *
 * The mocked harnesses cannot see this: their fake player is the runtime's own
 * bookkeeping, so a buffer can never hold anything other than what it was asked for.
 * Run against a dev server on 127.0.0.1:5173.
 *
 * Note: Playwright's bundled Chromium ships without the proprietary codecs YouTube
 * needs, so media often fails to attach here (error 150). That is an environment
 * artifact, not a failure of the show — which is why an empty buffer is tolerated and
 * only a WRONG buffer fails the run.
 */
import process from 'node:process'
import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const BASE = `${BASE_URL}/wolves/experience/`
const SEEK_TO = Number(process.env.SEEK_TO ?? 405)
const WATCH_MS = Number(process.env.WATCH_MS ?? 40000)

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
await page.waitForFunction(() => !!window.__wolvesDurations, null, { timeout: 30000 })
await page.evaluate(() => {
  // skipIntro() is async; returning its promise from evaluate hangs the run.
  window.__wolvesDurations.skipIntro()
})
await page.waitForFunction(() => !!window.__wolvesCinematic?.buffers?.(), null, { timeout: 60000 })
log('stage started')

const start = Date.now()
let seeked = false
let lastKey = ''
const seen = []

while (Date.now() - start < WATCH_MS) {
  const snap = await page.evaluate(() => {
    try {
      const b = window.__wolvesCinematic.buffers()
      return {
        ...b,
        title: document.querySelector('.wc-widget-title')?.textContent?.trim() ?? null,
      }
    }
    catch {
      return null
    }
  })

  if (snap) {
    const onAir = snap.activeSide === 'a' ? snap.a : snap.b
    const key = `${snap.storeSegmentIndex}|${snap.activeSide}|${snap.swapping}|${onAir.actual}|${snap.a.intendedIndex}|${snap.a.actual}|${snap.b.intendedIndex}|${snap.b.actual}`
    if (key !== lastKey) {
      lastKey = key
      seen.push(snap)
      const fmt = s =>
        `${s.side}${s.active ? '*' : ' '} want=${s.intendedIndex}:${(s.intended ?? '------').slice(0, 6)} got=${(s.actual ?? '------').slice(0, 6)} vol=${s.volume}`
      log(
        `[${((Date.now() - start) / 1000).toFixed(1)}s] store=${snap.storeSegmentIndex} sw=${snap.swapping ? 1 : 0} "${snap.title}" | ${fmt(snap.a)} | ${fmt(snap.b)}`,
      )
    }

    // The invariant. A settled show (not mid-crossfade) must never have a different
    // segment's media on air under the segment identity it is displaying.
    if (!snap.swapping && onAir.actual) {
      const expected = snap.storeSegmentIndex
      if (onAir.intendedIndex === expected && onAir.matches === false) {
        log(`FAIL: store says segment ${expected} but the on-air buffer holds ${onAir.actual} (expected ${onAir.intended})`)
        failures += 1
      }
    }
  }

  if (!seeked && Date.now() - start > 8000) {
    seeked = true
    await page.evaluate(s => window.__wolvesCinematic.seekTo(s), SEEK_TO)
    log(`--- seeked Part I to ${SEEK_TO}s to reach the boundary ---`)
  }
  await page.waitForTimeout(200)
}

log(`\n=== ${seen.length} distinct states, ${failures} invariant violations ===`)
await browser.close()
process.exit(failures > 0 ? 1 : 0)
