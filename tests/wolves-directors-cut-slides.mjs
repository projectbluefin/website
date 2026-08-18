/**
 * Real-browser probe for the Director's Cut Track 0 slide schedule.
 *
 * `wolvesDirectorsCutSlides.test.ts` proves the pure schedule; this proves the
 * running show honours it. A slide window is only real if the browser puts that
 * image on screen while the transport clock is inside it, and the vitest suite
 * cannot see that: it never resolves an asset, never runs the decode gate, and
 * never exercises the Vite `import.meta.glob` loaders the reader's pools come
 * from.
 *
 * The probe seeks the real transport to the inside of an early, middle and late
 * Director cut window, plus both sides of a cut boundary, and asserts the image
 * on stage is the one the schedule allocated. It measures the last pre-finale
 * window twice, warm, so a materially late or skipped final swap fails rather
 * than passing as "the same image is still up". It then seeks into the reserved
 * finale interval and asserts the ordinary schedule is not merely frozen there
 * but genuinely off stage, covered by the Director finale.
 *
 * Deterministic by construction: the YouTube IFrame API is mocked so the clock
 * only moves when this harness seeks it, and the schedule itself is seeded.
 *
 * Run against a dev server:
 *   npm run dev -- --host :: --port 5173 --strictPort
 *   node tests/wolves-directors-cut-slides.mjs
 */
import process from 'node:process'
import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const WOLVES_URL = `${BASE_URL}/wolves/experience/`
const VIEWPORT = { width: 1600, height: 900 }
/** Authored segment durations; the mock player reports these to the runtime. */
const MOCK_DURATIONS = { LASru9j0oIc: 424 }

let failures = 0
const log = (...args) => console.log(...args)

function assert(label, condition, detail) {
  if (condition) {
    log(`  PASS  ${label}`)
    return true
  }
  failures += 1
  log(`  FAIL  ${label}`)
  if (detail !== undefined) {
    log(`        ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
  }
  return false
}

const browser = await chromium.launch({ headless: process.env.HEADED !== '1', args: ['--mute-audio', '--no-sandbox'] })
const page = await browser.newPage({ viewport: VIEWPORT })
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))

try {
  await page.addInitScript((durations) => {
    window.__mockWolvesPlayers = []
    window.YT = {
      Player: class MockPlayer {
        constructor(element, config) {
          this.config = config
          this.videoId = config.videoId ?? null
          this.currentTime = config.playerVars?.start ?? 0
          this.volume = 100
          this.state = window.YT.PlayerState.CUED
          window.__mockWolvesPlayers.push(this)
          Promise.resolve().then(() => {
            this.config.events?.onReady?.({ target: this })
            this.playVideo()
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
          const payload = typeof video === 'string' ? { videoId: video, startSeconds: 0 } : video
          this.videoId = payload.videoId
          this.currentTime = payload.startSeconds ?? 0
          this.playVideo()
        }

        cueVideoById(video) {
          const payload = typeof video === 'string' ? { videoId: video, startSeconds: 0 } : video
          this.videoId = payload.videoId
          this.currentTime = payload.startSeconds ?? 0
        }

        seekTo(seconds) {
          this.currentTime = seconds
        }

        getCurrentTime() {
          return this.currentTime
        }

        getDuration() {
          return durations[this.videoId] ?? 424
        }

        setVolume(volume) {
          this.volume = volume
        }

        getVolume() {
          return this.volume
        }

        mute() {
          this.volume = 0
        }

        unMute() {
          this.volume = 100
        }

        destroy() {}
      },
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    }
    if (!window.onYouTubeIframeAPIReady) {
      window.onYouTubeIframeAPIReady = () => {}
    }
  }, MOCK_DURATIONS)

  log(`\nDirector's Cut Track 0 slide schedule probe`)
  log(`  URL: ${WOLVES_URL}\n`)

  await page.goto(WOLVES_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(500)

  // The schedule the reader will build, resolved through the dev server's own
  // module graph. Fetching it this way also proves the new data module loads in
  // a browser, which a bundler build does not.
  const schedule = await page.evaluate(async () => {
    const [slides, wallpapersModule] = await Promise.all([
      import('/src/data/wolves-directors-cut-slides.ts'),
      import('/src/components/wolves/wallpapers-list.ts'),
    ])
    const feed = await fetch('/flickr-photos.json').then(r => r.json()).catch(() => [])
    const reservedForLater = new Set(['wolves/people/interview-clyde-seepersad-linux-foundation.webp'])
    // Mirror of the reader's `trackZeroFlickrPhotoIds`: feed photos that already
    // play as a curated local copy. The digit-matched ones the builder finds by
    // itself; these two live under hand-written filenames with no id in them.
    const duplicateCncfPhotoIds = new Set(['55164385253', '55164226136'])
    const toSlide = wallpaper => ({
      id: wallpaper.name || wallpaper.dayName || wallpaper.nightName || '',
      isLocal: true,
      path: wallpaper.name,
      title: wallpaper.title,
      type: wallpaper.type,
      dayName: wallpaper.dayName,
      nightName: wallpaper.nightName,
      fit: wallpaper.fit,
      description: wallpaper.description,
      theaterTitleOnly: wallpaper.theaterTitleOnly,
    })
    const isPeople = wallpaper => Boolean(wallpaper.name?.includes('/people/') || wallpaper.dayName?.includes('/people/') || wallpaper.nightName?.includes('/people/'))
    const local = wallpapersModule.wallpapers.filter(wallpaper => !wallpaper.name?.endsWith('.gif'))
    const showcase = local.filter(wallpaper => !isPeople(wallpaper))
    const built = slides.buildDirectorsCutTrackZeroSlides({
      dayNightSlides: showcase.filter(wallpaper => wallpaper.type === 'daynight').map(toSlide),
      showcaseSlides: showcase.filter(wallpaper => wallpaper.type !== 'daynight').map(toSlide),
      peopleSlides: local
        .filter(wallpaper => isPeople(wallpaper)
          && !reservedForLater.has(wallpaper.name ?? wallpaper.dayName ?? wallpaper.nightName ?? ''))
        .map(toSlide),
      cncfSlides: (Array.isArray(feed) ? feed : []).map(photo => ({
        id: photo.id,
        isLocal: false,
        path: `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`,
        title: photo.title,
        type: 'single',
        kind: 'cncf',
      })),
      duplicateCncfPhotoIds,
    })
    return {
      finaleStart: slides.DIRECTORS_CUT_FINALE_START,
      slides: built.map(slide => ({
        id: slide.id,
        path: slide.path,
        dayName: slide.dayName,
        nightName: slide.nightName,
        startTime: slide.startTime,
        endTime: slide.endTime,
      })),
    }
  })

  assert('the Director schedule loads in a browser and fills the song', schedule.slides.length > 100, schedule.slides.length)

  await page.getByRole('button', { name: /DIRECTOR'S CUT/i }).click()
  await page.waitForFunction(() => typeof window.__wolvesDurations?.skipIntro === 'function', null, { timeout: 20_000 })
  await page.evaluate(() => window.__wolvesDurations.skipIntro())
  await page.waitForSelector('.wc-trackzero-grid', { state: 'attached', timeout: 20_000 })
  await page.waitForFunction(() => typeof window.__wolvesCinematic?.seekTo === 'function', null, { timeout: 20_000 })
  log('  Director\'s Cut stage started\n')

  async function slideAt(seconds, expected = []) {
    await page.evaluate(time => window.__wolvesCinematic.seekTo(time), seconds)
    await page.waitForFunction(
      target => Math.abs((window.__wolvesCinematic?.nativeTime?.() ?? -1) - target) < 0.35,
      seconds,
      { timeout: 10_000 },
    )
    // The swap is gated on fetching and decoding a full-size image and then on
    // the crossfade, so a fixed wait either samples the previous frame or wastes
    // time. Poll until the stage settles instead.
    let previous = null
    let settled = null
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(250)
      settled = await readStage()
      // Inside the Director finale the grid is covered and stops changing, so
      // "the same image twice" is not a settle signal there — the finale's own
      // cover is.
      if (settled.finaleCovering === 'true') {
        return settled
      }
      const decoded = decodeURIComponent(settled.src ?? '')
      const expectedOnStage = expected.length === 0 || expected.some(file => decoded.endsWith(file))
      if (expectedOnStage && settled.src && settled.src === previous?.src && settled.opacity >= 0.99) {
        return settled
      }
      previous = settled
    }
    return settled
  }

  function readStage() {
    return page.evaluate(() => {
      const layers = [...document.querySelectorAll('.flickr-photo-layer')]
      // Mid-dissolve both buffers sit above half opacity, so "the first layer
      // over 0.5" returns whichever is earlier in the DOM — often the outgoing
      // one. Take the brightest layer.
      const brightest = layers
        .map(layer => ({ layer, opacity: Number.parseFloat(getComputedStyle(layer).opacity) || 0 }))
        .sort((left, right) => right.opacity - left.opacity)[0]
      const img = brightest?.layer.querySelector('.flickr-img')
      const grid = document.querySelector('[data-trackzero-grid]')
      const finaleFrame = document.querySelector('[data-director-finale-frame]')
      const frameRect = finaleFrame?.getBoundingClientRect()
      return {
        src: img?.getAttribute('src') ?? null,
        naturalWidth: img?.naturalWidth ?? 0,
        opacity: brightest?.opacity ?? 0,
        caption: document.querySelector('.flickr-caption')?.textContent?.trim() ?? null,
        // A covered grid gives every descendant a zero-area rect, which is the
        // only "the audience cannot see this" signal a browser can give.
        gridVisible: grid ? getComputedStyle(grid).display !== 'none' : false,
        layerArea: layers.reduce((total, layer) => {
          const rect = layer.getBoundingClientRect()
          return total + Math.round(rect.width * rect.height)
        }, 0),
        finaleCovering: document.querySelector('[data-director-finale]')?.getAttribute('data-covering') ?? null,
        finaleFrame: frameRect ? { width: Math.round(frameRect.width), height: Math.round(frameRect.height) } : null,
      }
    })
  }

  /**
   * File names the reader may render for a slide. A day/night wallpaper resolves
   * through `dayName`/`nightName`, not through `path`, so comparing against
   * `path` alone reports a false miss on exactly those slides.
   */
  const expectedFiles = slide => [slide.path, slide.dayName, slide.nightName]
    .filter(Boolean)
    .map(name => name.split('/').pop())

  const pick = ratio => schedule.slides[Math.floor(schedule.slides.length * ratio)]
  const probes = [
    ['early', pick(0.05)],
    ['middle', pick(0.45)],
    ['late', pick(0.9)],
    ['final ordinary window', schedule.slides[schedule.slides.length - 1]],
  ]

  const seen = new Map()
  for (const [label, slide] of probes) {
    const midpoint = slide.startTime + (slide.endTime - slide.startTime) / 2
    const observed = await slideAt(midpoint, expectedFiles(slide))
    const decoded = decodeURIComponent(observed.src ?? '')
    assert(
      `${label} cut ${slide.startTime.toFixed(3)}-${slide.endTime.toFixed(3)} shows ${slide.id}`,
      expectedFiles(slide).some(file => decoded.endsWith(file)),
      { expected: expectedFiles(slide), observed: decoded },
    )
    assert(`${label} slide actually decoded`, observed.naturalWidth > 0, observed)
    seen.set(label, observed.src)
  }

  assert('no probe reused an image', new Set(seen.values()).size === seen.size, [...seen])

  // Both sides of one measured cut: the boundary is real, not a rounding artifact.
  const boundary = pick(0.45)
  const before = await slideAt(boundary.endTime - 0.25)
  const after = await slideAt(boundary.endTime + 0.25)
  assert('the image changes across a measured Director cut', before.src !== after.src, { before: before.src, after: after.src })

  // The final pre-finale window, twice, warm.
  //
  // The Director's schedule now keeps a four-measured-beat floor (about 1.58s
  // at the fastest passage), and the reader will not swap a slide until its
  // full-size image has fetched AND decoded. The last window is still the one
  // the finale takes the frame from:
  // if it lands late, or is skipped entirely, the audience sees the previous
  // slide run into the cover.
  //
  // This is deliberately a warm-cache measurement, sampled after a first pass
  // has already fetched and decoded the image, so it measures the runtime's
  // own scheduling rather than the network. It fails if the correct image is
  // not on stage within the window it was allocated.
  const finalWindow = schedule.slides[schedule.slides.length - 1]
  const finalWindowSeconds = finalWindow.endTime - finalWindow.startTime
  const finalWindowFiles = expectedFiles(finalWindow)
  await slideAt(finalWindow.startTime + finalWindowSeconds / 2) // warm the cache

  const warmStart = Date.now()
  await page.evaluate(time => window.__wolvesCinematic.seekTo(time), finalWindow.startTime + 0.05)
  let warmSettleMs = null
  for (let attempt = 0; attempt < 40; attempt++) {
    const observed = await readStage()
    const decoded = decodeURIComponent(observed.src ?? '')
    if (observed.opacity >= 0.99 && finalWindowFiles.some(file => decoded.endsWith(file))) {
      warmSettleMs = Date.now() - warmStart
      break
    }
    await page.waitForTimeout(50)
  }
  assert(
    `the final pre-finale slide lands inside its own ${finalWindowSeconds.toFixed(3)}s window when warm`,
    warmSettleMs !== null && warmSettleMs <= finalWindowSeconds * 1000,
    { warmSettleMs, budgetMs: Math.round(finalWindowSeconds * 1000), expected: finalWindowFiles },
  )
  assert(
    'the final pre-finale slide is never skipped when warm',
    warmSettleMs !== null,
    { expected: finalWindowFiles },
  )

  // The reserved finale interval: nothing ordinary may be on stage there.
  //
  // The ordinary schedule stops at the finale beat and the reader holds its
  // last slide for the rest of the song. Asserting that the held slide is
  // still the same image scores that freeze as success — which it was, before
  // there was a finale — so this now asserts the negative the finale exists to
  // guarantee: the theater grid has no rendered area at all, and the finale's
  // own cover fills the frame.
  const beforeFinale = await slideAt(schedule.finaleStart - 0.2)
  assert(
    'the ordinary theater grid is on stage right up to the finale beat',
    beforeFinale.gridVisible === true && beforeFinale.layerArea > 0,
    beforeFinale,
  )
  for (const time of [schedule.finaleStart, schedule.finaleStart + 1, 380, 408.137, 420, 423.9]) {
    const inFinale = await slideAt(time)
    assert(
      `no ordinary slide is visible at ${time}s inside the reserved finale`,
      inFinale.gridVisible === false && inFinale.layerArea === 0,
      { at: time, gridVisible: inFinale.gridVisible, layerArea: inFinale.layerArea, observed: inFinale.src },
    )
    assert(
      `the Director finale covers the whole frame at ${time}s`,
      inFinale.finaleCovering === 'true' && inFinale.finaleFrame?.width === VIEWPORT.width && inFinale.finaleFrame?.height === VIEWPORT.height,
      { at: time, covering: inFinale.finaleCovering, frame: inFinale.finaleFrame },
    )
  }

  assert('no page errors during the probe', pageErrors.length === 0, pageErrors)

  // Regression guard: the standard show still runs its authored lock schedule
  // through the very same component. Jono owns 167.8-171.88 there and does not
  // in the Director's Cut, which is the cheapest proof the two cuts are separate.
  await page.goto(WOLVES_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /JOIN THE EVOLUTION|BEGIN TRANSMISSION|MEET YOUR TEAMMATES/i }).first().click()
  await page.waitForFunction(() => typeof window.__wolvesDurations?.skipIntro === 'function', null, { timeout: 20_000 })
  await page.evaluate(() => window.__wolvesDurations.skipIntro())
  await page.waitForSelector('.wc-trackzero-grid', { state: 'attached', timeout: 20_000 })
  await page.waitForFunction(() => typeof window.__wolvesCinematic?.seekTo === 'function', null, { timeout: 20_000 })

  const standardHeroLock = await slideAt(169.8, ['interview-jono-bacon-cult-psychology-kubernetes.webp'])
  assert(
    'the standard show still holds Jono Bacon across his authored 167.8-171.88 window',
    decodeURIComponent(standardHeroLock.src ?? '').endsWith('interview-jono-bacon-cult-psychology-kubernetes.webp'),
    standardHeroLock,
  )
  const directorAtSameTime = schedule.slides.find(slide => slide.startTime <= 169.8 && slide.endTime > 169.8)
  assert(
    'the Director\'s Cut plays something else at the same moment',
    directorAtSameTime !== undefined && !directorAtSameTime.id.includes('jono-bacon'),
    directorAtSameTime,
  )

  assert('no page errors across both cuts', pageErrors.length === 0, pageErrors)
}
catch (error) {
  failures += 1
  log(`  FAIL  harness error: ${error.message}`)
}
finally {
  await browser.close()
}

log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`}\n`)
process.exit(failures === 0 ? 0 : 1)
