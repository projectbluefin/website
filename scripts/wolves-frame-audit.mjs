#!/usr/bin/env node
/**
 * Prove a Wolves video's shots reach the screen correctly, in a real browser.
 *
 * The unit suites pin the data. They cannot see the screen, and this show has shipped
 * three defects under a fully green suite: a cascade rule that lost on source order, a
 * caption bound to the previous shot's geometry, and a rule stranded inside a
 * `@media (max-width: 640px)` block. Layout, cascade and paint need a browser.
 *
 * For every cue it checks the things a projected show actually fails on:
 *
 *   - the intended plate is the one on screen, in the intended order
 *   - the painting is full-bleed, so no letterbox bar appears at projector size
 *   - the caption sits inside the painting, clear of the frame edge
 *   - the plate decodes at the geometry the ledger claims
 *   - nothing errored, and nothing 404ed
 *
 * The seek settles on TWO conditions — the intended caption *and* the intended decoded
 * plate. Either alone samples a crossfade mid-transition, where the outgoing shot's
 * words sit over the incoming shot's picture; that has produced both a false collision
 * report and a hidden real one from the same probe.
 *
 *   npm run dev -- --port 5173 --strictPort
 *   node scripts/wolves-frame-audit.mjs
 *   node scripts/wolves-frame-audit.mjs prologue --base http://localhost:5173
 *   node scripts/wolves-frame-audit.mjs prologue --viewport 1280x720 --shots
 *
 * Exits non-zero if anything is wrong, so it can gate a change.
 */

/*
 * innerText, not textContent, throughout the in-page probes below: it is the *rendered*
 * text, carrying the CSS text-transform and line breaking the audience actually sees.
 * textContent would assert the source string, which is not what is on the screen.
 */
/* eslint-disable unicorn/prefer-dom-node-text-content */

import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { isKnownVideo, knownVideoNames, resolveVideo } from './wolves-videos.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Minimum gap between a caption and the frame edge. Below this it reads as a collision. */
const EDGE_CLEARANCE_PX = 24

/** How long to wait for a seek to settle on both conditions before calling it stuck. */
const SETTLE_TIMEOUT_MS = 6000
const SETTLE_ATTEMPTS = 3

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value ?? '')
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}

function flagValue(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? null : args[index + 1] ?? null
}

/** The plate a cue puts on screen. A crossfade shot settles on its night plate. */
function plateFor(cue) {
  const image = cue.backgroundImage ?? cue.backgroundCrossfade?.[0]?.night ?? null
  return image ? image.split('/').pop() : null
}

function normalise(text) {
  return String(text ?? '').replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

function objectPosition(token, free) {
  if (token === 'left' || token === 'top') {
    return 0
  }
  if (token === 'right' || token === 'bottom') {
    return free
  }
  if (token === 'center') {
    return free / 2
  }
  return free * (Number.parseFloat(token) / 100)
}

/** The pixels the image actually paints inside its element box. */
export function paintedBox({ elementBox, naturalWidth, naturalHeight, objectFit, objectPosition: position }) {
  if (!naturalWidth || !naturalHeight || objectFit === 'fill') {
    return elementBox
  }
  const contain = Math.min(elementBox.width / naturalWidth, elementBox.height / naturalHeight)
  const scale = objectFit === 'cover'
    ? Math.max(elementBox.width / naturalWidth, elementBox.height / naturalHeight)
    : objectFit === 'none'
      ? 1
      : objectFit === 'scale-down'
        ? Math.min(1, contain)
        : contain
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  const [x = '50%', y = '50%'] = position.split(/\s+/)
  const left = elementBox.left + objectPosition(x, elementBox.width - width)
  const top = elementBox.top + objectPosition(y, elementBox.height - height)
  return { left, top, right: left + width, bottom: top + height, width, height }
}

function selfTest() {
  const elementBox = { left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720 }
  const contained = paintedBox({ elementBox, naturalWidth: 1024, naturalHeight: 768, objectFit: 'contain', objectPosition: '50% 50%' })
  if (contained.left !== 160 || contained.width !== 960 || contained.height !== 720) {
    throw new Error(`contain self-test failed: ${JSON.stringify(contained)}`)
  }
  const covered = paintedBox({ elementBox, naturalWidth: 1024, naturalHeight: 768, objectFit: 'cover', objectPosition: '50% 50%' })
  if (covered.left !== 0 || covered.top !== -120 || covered.width !== 1280 || covered.height !== 960) {
    throw new Error(`cover self-test failed: ${JSON.stringify(covered)}`)
  }
  console.info('wolves-frame-audit self-test: pass')
}

async function loadCues(videoKey) {
  const server = await createServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  try {
    const { video } = resolveVideo(videoKey)
    const loadModule = specifier => server.ssrLoadModule(specifier)
    const segment = await video.load(loadModule)
    const geometry = video.loadGeometry ? await video.loadGeometry(loadModule) : []
    return { segment, cues: segment.overlays, geometry }
  }
  finally {
    await server.close()
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    selfTest()
    return
  }
  if (args.includes('--help')) {
    console.info('usage: node scripts/wolves-frame-audit.mjs [video] [--base URL] [--viewport WxH] [--shots] [--self-test]')
    console.info(`videos: ${knownVideoNames()} (default: prologue)`)
    process.exit(0)
  }

  const positional = args.filter(arg => !arg.startsWith('-') && arg !== flagValue(args, '--base') && arg !== flagValue(args, '--viewport'))
  const named = positional.find(arg => isKnownVideo(arg)) ?? positional[0]
  const { key, video } = resolveVideo(named)
  if (!video) {
    console.error(`unknown video "${named}". known: ${knownVideoNames()}`)
    process.exit(1)
  }

  const baseUrl = flagValue(args, '--base') ?? 'http://localhost:5173'
  const viewport = parseViewport(flagValue(args, '--viewport')) ?? { width: 1920, height: 1080 }
  const wantsShots = args.includes('--shots')

  const { segment, cues, geometry } = await loadCues(key)
  const expectedGeometry = new Map(geometry.map(record => [record.file, record]))

  // Imported lazily so `--help` and a bad argument do not require a browser.
  const { chromium } = await import('playwright')
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport })

  const consoleErrors = []
  const pageErrors = []
  const badRequests = []
  const appOrigin = new URL(baseUrl).origin
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', error => pageErrors.push(error.message))
  // Only the app's own requests. The embedded player beats its telemetry endpoints
  // constantly and they fail for reasons that have nothing to do with this show.
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(appOrigin)) {
      badRequests.push(`FAILED ${request.url()}`)
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith(appOrigin)) {
      badRequests.push(`${response.status()} ${response.url()}`)
    }
  })

  const problems = []
  try {
    await page.goto(`${baseUrl}/wolves/experience/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.getByRole('button', { name: /DIRECTOR'S CUT/i }).click()
    await page.waitForSelector('.wolves-intro-overlay', { state: 'attached', timeout: 20000 })
    await page.waitForFunction(() => typeof window.__wolvesIntro?.seekTo === 'function', null, { timeout: 20000 })

    console.info(`\nvideo ${video.ordinal}: ${key} — ${video.title}`)
    console.info(`${cues.length} shots at ${viewport.width}x${viewport.height}, against ${baseUrl}\n`)

    for (const [index, cue] of cues.entries()) {
      const label = `${String(index + 1).padStart(2, '0')} @${String(cue.start).padStart(7)}s`
      const wantPlate = plateFor(cue)
      const wantText = normalise(cue.text)
      const mid = cue.start + Math.min(3, (cue.end - cue.start) / 2)

      let shot = null
      for (let attempt = 0; attempt < SETTLE_ATTEMPTS && !shot; attempt += 1) {
        // Re-seek each attempt: a slow settle otherwise lets the show clock run on and
        // hands back a different shot than the one being measured.
        await page.evaluate(seconds => window.__wolvesIntro.seekTo(seconds), mid)
        shot = await page
          .waitForFunction(
            ({ plate, text }) => {
              // rendered text: it carries the CSS text-transform and the line breaking the
              // audience actually sees. textContent would assert the source string instead.
              const strip = value => String(value ?? '').replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
              const root = document.querySelector('.wolves-intro-overlay')
              if (!root) {
                return false
              }
              const image = [...root.querySelectorAll('img.wolves-intro-overlay-background')]
                .find(candidate => candidate.naturalWidth > 0 && Number(getComputedStyle(candidate).opacity) > 0.99)
              if (!image) {
                return false
              }
              if (plate && !decodeURIComponent(image.currentSrc).endsWith(plate)) {
                return false
              }
              const caption = root.querySelector('.wolves-intro-overlay-text')
              const captionText = strip(caption?.innerText)
              const captionOpacity = caption ? Number(getComputedStyle(caption).opacity) : 0
              if (text) {
                if (captionText !== text) {
                  return false
                }
              }
              else {
                // A wordless shot is not "no text on screen": a cue's words outlive its
                // shot by a fade, so the previous line is still clearing here. Require it
                // to be gone or visibly on its way out, not instantly absent — demanding
                // that stalls past the end of a short window and measures the next shot.
                if (captionText && captionOpacity > 0.5) {
                  return false
                }
              }

              // Measure here, inside the predicate, rather than in a second call after
              // it. The show clock keeps running against a live player, so anything
              // measured after the wait resolves is a different frame than the one that
              // satisfied it — which is how a probe reports the shot it did not check.
              const box = (element) => {
                const rect = element.getBoundingClientRect()
                return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
              }
              return {
                image: {
                  src: decodeURIComponent(image.currentSrc).split('/').pop(),
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                  elementBox: box(image),
                  objectFit: getComputedStyle(image).objectFit,
                  objectPosition: getComputedStyle(image).objectPosition,
                },
                // Report and geometry-check the caption whenever this cue has words — the
                // predicate above already proved they are the right ones, even mid fade-in.
                // The opacity tolerance belongs only to a wordless shot, where any text is
                // the previous shot's line on its way out.
                caption: caption && captionText && (text || captionOpacity > 0.5)
                  ? { text: caption.innerText.replace(/\s+/g, ' ').trim(), box: box(caption) }
                  : null,
                frame: { width: window.innerWidth, height: window.innerHeight },
              }
            },
            { plate: wantPlate, text: wantText },
            { timeout: SETTLE_TIMEOUT_MS, polling: 200 },
          )
          .then(handle => handle.jsonValue())
          .catch(() => null)
      }

      if (!shot) {
        // Report what was actually on screen, so a failure names the frame it found.
        const found = await page.evaluate(() => {
          const root = document.querySelector('.wolves-intro-overlay')
          const image = [...root?.querySelectorAll('img.wolves-intro-overlay-background') ?? []]
            .map(candidate => ({ element: candidate, opacity: Number(getComputedStyle(candidate).opacity) }))
            .sort((a, b) => b.opacity - a.opacity)[0]
            ?.element ?? null
          const caption = root?.querySelector('.wolves-intro-overlay-text')
          return {
            plate: image ? decodeURIComponent(image.currentSrc).split('/').pop() : 'none',
            text: caption?.innerText.replace(/\s+/g, ' ').trim() || '(wordless)',
          }
        })
        problems.push(`${label}: never settled on ${wantPlate ?? 'its plate'} — found ${found.plate} / "${found.text}"`)
        if (wantsShots) {
          console.info(`${label}  UNSETTLED, found ${found.plate}`)
        }
        continue
      }

      const painting = paintedBox({
        elementBox: shot.image.elementBox,
        naturalWidth: shot.image.width,
        naturalHeight: shot.image.height,
        objectFit: shot.image.objectFit,
        objectPosition: shot.image.objectPosition,
      })
      const letterboxed = painting.left > 1
        || painting.top > 1
        || painting.right < shot.frame.width - 1
        || painting.bottom < shot.frame.height - 1
      if (letterboxed) {
        problems.push(
          `${label}: painting is not full-bleed `
          + `(${Math.round(painting.left)},${Math.round(painting.top)} ${Math.round(painting.width)}x${Math.round(painting.height)})`,
        )
      }
      const ledger = expectedGeometry.get(shot.image.src)
      if (ledger && (shot.image.width !== ledger.width || shot.image.height !== ledger.height)) {
        problems.push(
          `${label}: decoded geometry ${shot.image.width}x${shot.image.height} `
          + `does not match ledger ${ledger.width}x${ledger.height}`,
        )
      }
      if (shot.caption) {
        const caption = shot.caption.box
        const clearance = Math.min(
          caption.left - painting.left,
          painting.right - caption.right,
          caption.top - painting.top,
          painting.bottom - caption.bottom,
        )
        if (clearance < EDGE_CLEARANCE_PX) {
          problems.push(`${label}: caption is ${Math.round(clearance)}px from the frame edge, wants >=${EDGE_CLEARANCE_PX}px`)
        }
      }

      if (wantsShots) {
        console.info(
          `${label}  ${shot.image.width}x${shot.image.height} ${shot.image.src}`
          + `  |  ${shot.caption?.text || '(wordless)'}`,
        )
      }
    }
  }
  finally {
    await browser.close()
  }

  const unique = list => [...new Set(list)]
  console.info(`\nduration ${segment.duration}s, ${cues.length} shots checked`)
  for (const [heading, list] of [['console errors', consoleErrors], ['page errors', pageErrors], ['bad requests', badRequests], ['problems', problems]]) {
    console.info(`\n${heading}:`)
    console.info(unique(list).length ? unique(list).map(entry => `  ${entry}`).join('\n') : '  (none)')
  }

  process.exit(problems.length || consoleErrors.length || pageErrors.length || badRequests.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
