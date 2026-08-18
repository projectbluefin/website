/**
 * Real-browser probe for the Director's Cut scored prologue and its Ikora handoff.
 *
 * `wolvesDirectorsCutIntro.test.ts` proves the recut schedule and
 * `wolvesIntroOverlay.test.ts` proves the runtime honours it in a DOM double. Neither can
 * answer the questions that decide whether this works in a theater, because neither runs a
 * layout engine, a media query, or a real image decode:
 *
 * - Is the painting *whole*? `object-fit: cover` and `object-fit: contain` produce the same
 *   markup and the same `src`. Only a laid-out browser can say whether a 2.66:1 canvas is
 *   being shown or being amputated, and only it knows the rendered box.
 * - Does the back row get the words? The narrow-viewport rule is a media query. A jsdom-style
 *   test cannot evaluate one, so the "black frame below 641px" defect was invisible to the
 *   unit suite for as long as it existed.
 * - Is the handoff a cut or a hole? Whether a black frame appears between the last painting
 *   and the trailer is a question about paint, not about state.
 *
 * Deterministic by construction: the YouTube IFrame API is mocked, so the clock only moves
 * when this harness moves it, and every wait is a wait for the target state rather than a
 * sleep. Sleeping through a crossfade samples whichever frame the machine happened to be on.
 *
 * Run against a dev server:
 *   npm run dev -- --host :: --port 5173 --strictPort
 *   node tests/wolves-directors-cut-prologue.mjs
 */
import process from 'node:process'
import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const WOLVES_URL = `${BASE_URL}/wolves/experience/`
/** A projector, and a phone. The prologue has to survive both. */
const PROJECTOR_VIEWPORT = { width: 1280, height: 720 }
const NARROW_VIEWPORT = { width: 390, height: 844 }
const IKORA_VIDEO_ID = 'BKm0TPqeOjY'

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

const MOCK_PLAYERS = () => {
  window.__mockWolvesPlayers = []
  window.YT = {
    Player: class MockPlayer {
      constructor(element, config) {
        this.config = config
        this.videoId = config.videoId ?? null
        this.currentTime = config.playerVars?.start ?? 0
        this.volume = 100
        this.muted = false
        this.autoplay = config.playerVars?.autoplay === 1
        this.playCalls = 0
        this.state = window.YT.PlayerState.CUED
        window.__mockWolvesPlayers.push(this)
        Promise.resolve().then(() => {
          this.config.events?.onReady?.({ target: this })
          if (this.autoplay) {
            this.playVideo()
          }
        })
      }

      playVideo() {
        this.playCalls += 1
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
        this.loadedAt = this.currentTime
        this.playVideo()
      }

      cueVideoById(video) {
        const payload = typeof video === 'string' ? { videoId: video, startSeconds: 0 } : video
        this.videoId = payload.videoId
        this.currentTime = payload.startSeconds ?? 0
        this.cuedAt = this.currentTime
        this.state = window.YT.PlayerState.CUED
        this.config.events?.onStateChange?.({ data: this.state, target: this })
      }

      seekTo(seconds) {
        this.currentTime = seconds
      }

      getCurrentTime() {
        return this.currentTime
      }

      getDuration() {
        return this.videoId === 'EB3IokHelRk' ? 325.6 : 120
      }

      setVolume(volume) {
        this.volume = volume
      }

      getVolume() {
        return this.volume
      }

      mute() {
        this.muted = true
      }

      unMute() {
        this.muted = false
      }

      isMuted() {
        return this.muted
      }

      getVideoData() {
        return { video_id: this.videoId }
      }

      destroy() {
        this.destroyed = true
      }
    },
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  }
  if (!window.onYouTubeIframeAPIReady) {
    window.onYouTubeIframeAPIReady = () => {}
  }
}

const browser = await chromium.launch({ headless: process.env.HEADED !== '1', args: ['--mute-audio', '--no-sandbox'] })
const pageErrors = []

/** Opens the Director's Cut and stops at the first frame of the scored prologue. */
/**
 * Screenshots are namespaced by viewport. Both passes seek the same beats, so a
 * flat filename means the narrow run silently overwrites the projector run —
 * and the projector is the one this show is judged on.
 */
let shotPrefix = 'shot'

async function openPrologue(viewport) {
  shotPrefix = `${viewport.width}x${viewport.height}`
  const page = await browser.newPage({ viewport })
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.addInitScript(MOCK_PLAYERS)
  await page.goto(WOLVES_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.getByRole('button', { name: /DIRECTOR'S CUT/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'attached', timeout: 20_000 })
  await page.waitForFunction(() => typeof window.__wolvesIntro?.seekTo === 'function', null, { timeout: 20_000 })
  return page
}

/**
 * Seeks the prologue and waits for the clock to arrive, then for the stage to settle.
 *
 * "Settled" is two identical readings of a fully-opaque scene, not a fixed sleep: the scene
 * cross-dissolves, so any single sample taken during the dissolve reads the outgoing shot.
 */
/**
 * Write a screenshot of every seeked beat to this directory.
 *
 * Off by default; the assertions are the signal. It exists because this is a
 * projected show and "the cue is present with the right text" is not the same
 * claim as "the back row can read it in the time the music allows".
 *
 *   WOLVES_SHOT_DIR=/var/tmp/website-agent/prologue node tests/wolves-directors-cut-prologue.mjs
 */
const SHOT_DIR = process.env.WOLVES_SHOT_DIR ?? null

async function seekPrologue(page, seconds) {
  await page.evaluate(target => window.__wolvesIntro.seekTo(target), seconds)
  await page.waitForFunction(
    target => Math.abs((window.__wolvesIntro?.getCurrentTime?.() ?? -1) - target) < 0.6,
    seconds,
    { timeout: 10_000 },
  )
  let previous = null
  for (let attempt = 0; attempt < 24; attempt++) {
    await page.waitForTimeout(150)
    const stage = await readStage(page)
    if (previous && stage.src === previous.src && stage.sceneOpacity >= 0.99) {
      if (SHOT_DIR) {
        await page.screenshot({ path: `${SHOT_DIR}/${shotPrefix}-t${String(Math.round(seconds)).padStart(3, '0')}s.png` })
      }
      return stage
    }
    previous = stage
  }
  if (SHOT_DIR) {
    await page.screenshot({ path: `${SHOT_DIR}/${shotPrefix}-t${String(Math.round(seconds)).padStart(3, '0')}s.png` })
  }
  return previous
}

function readStage(page) {
  return page.evaluate(() => {
    const scene = document.querySelector('.wolves-intro-overlay-scene')
    const image = scene?.querySelector('img.wolves-intro-overlay-background')
    const text = document.querySelector('.wolves-intro-overlay-text')
    const host = document.querySelector('.wolves-intro-overlay-player')
    const imageStyle = image ? getComputedStyle(image) : null
    const textStyle = text ? getComputedStyle(text) : null
    const imageRect = image?.getBoundingClientRect()
    // "Rendered" and "visible" are different questions, and conflating them is how a
    // `display: none` caption passes a test that only asked whether the node exists.
    const isVisible = (node, style) => Boolean(
      node
      && style
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number.parseFloat(style.opacity || '1') > 0.01,
    )
    return {
      src: image?.getAttribute('src') ?? null,
      naturalWidth: image?.naturalWidth ?? 0,
      naturalHeight: image?.naturalHeight ?? 0,
      renderedWidth: imageRect ? Math.round(imageRect.width) : 0,
      renderedHeight: imageRect ? Math.round(imageRect.height) : 0,
      renderedLeft: imageRect ? Math.round(imageRect.left) : 0,
      renderedTop: imageRect ? Math.round(imageRect.top) : 0,
      // `getBoundingClientRect()` on an `object-fit: contain` image reports the element
      // box, not the pixels the audience actually sees. Asking it about cropping is how a
      // letterboxed painting and a cropped one give the same answer. Derive the painted
      // content box the way `contain` is defined to compute it, off the browser's own
      // decoded `naturalWidth`/`naturalHeight` — which owes nothing to our artwork ledger,
      // so a wrong ledger entry shows up as a mismatch instead of being assumed away.
      paintedBox: (image && imageRect && image.naturalWidth > 0 && image.naturalHeight > 0)
        ? (() => {
            const scale = Math.min(imageRect.width / image.naturalWidth, imageRect.height / image.naturalHeight)
            return {
              width: Math.round(image.naturalWidth * scale),
              height: Math.round(image.naturalHeight * scale),
              scale,
            }
          })()
        : null,
      maxWidthStyle: imageStyle?.maxWidth ?? null,
      maxHeightStyle: imageStyle?.maxHeight ?? null,
      objectFit: imageStyle?.objectFit ?? null,
      imageOpacity: imageStyle ? Number.parseFloat(imageStyle.opacity) : 0,
      sceneOpacity: scene ? Number.parseFloat(getComputedStyle(scene).opacity) : 0,
      sceneCrossfade: scene ? getComputedStyle(scene).transitionDuration : null,
      hasScrim: Boolean(document.querySelector('.wolves-intro-overlay-scrim')),
      textRendered: Boolean(text),
      textVisible: isVisible(text, textStyle),
      textContent: text?.textContent?.trim() ?? null,
      // Authored newlines survive (`white-space: pre-line`), but a line wider than
      // the box still wraps — and the browser breaks it mid-phrase, which is the
      // one thing the narration's lining exists to prevent. Counting authored
      // `\n` is therefore not a measurement. One client rect per rendered line
      // box is.
      //
      // Two traps are baked into the shape of this function:
      //
      // 1. Do not read the authored count back out of the DOM. The `slim` title
      //    card renders its two authored lines as two sibling `<span>`s and no
      //    newline character, so `textContent.split('\n')` called it one authored
      //    line and the check could never fail. Authored shape is a property of
      //    the cue, so the caller supplies it from `cue.text`.
      // 2. Do not range over an element that has block children. A range yields a
      //    rect for each block child's *box* (always full box width) on top of a
      //    rect per text line, so the two-line title card counted four rows at a
      //    flat 1152px and was reported as catastrophically wrapped when a
      //    screenshot shows it setting cleanly on two lines. Recurse into blocks
      //    and only range over the leaves that actually hold text.
      textLines: text
        ? (() => {
            const rowsOf = (node) => {
              const blocks = [...node.children].filter(child => getComputedStyle(child).display === 'block')
              if (blocks.length > 0) {
                return blocks.flatMap(child => rowsOf(child))
              }
              const range = document.createRange()
              range.selectNodeContents(node)
              const rows = []
              for (const rect of range.getClientRects()) {
                if (rect.width <= 1 || rect.height <= 1) {
                  continue
                }
                const row = rows.find(candidate => Math.abs(candidate.top - rect.top) < 4)
                if (row) {
                  row.right = Math.max(row.right, rect.right)
                  row.left = Math.min(row.left, rect.left)
                }
                else {
                  rows.push({ top: rect.top, left: rect.left, right: rect.right })
                }
              }
              return rows
            }
            const rows = rowsOf(text)
            return {
              rendered: rows.length,
              widest: Math.round(Math.max(0, ...rows.map(row => row.right - row.left))),
              boxWidth: Math.round(text.getBoundingClientRect().width),
            }
          })()
        : null,
      textFontSize: textStyle ? Math.round(Number.parseFloat(textStyle.fontSize)) : 0,
      textRect: text ? (() => {
        const rect = text.getBoundingClientRect()
        return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) }
      })() : null,
      playerHostRendered: Boolean(host),
      playerHostVisible: isVisible(host, host ? getComputedStyle(host) : null),
    }
  })
}

function readPlayers(page) {
  return page.evaluate(() => (window.__mockWolvesPlayers ?? []).map(player => ({
    videoId: player.videoId,
    muted: player.muted,
    state: player.state,
    playCalls: player.playCalls,
    cuedAt: player.cuedAt ?? null,
    loadedAt: player.loadedAt ?? null,
    destroyed: Boolean(player.destroyed),
    volume: player.volume,
  })))
}

try {
  log(`\nDirector's Cut scored prologue probe`)
  log(`  URL: ${WOLVES_URL}\n`)

  const page = await openPrologue(PROJECTOR_VIEWPORT)

  // The recut, resolved through the dev server's own module graph — which also proves the
  // data module loads in a browser, something a bundler build does not.
  const cut = await page.evaluate(async () => {
    const [intro, artwork] = await Promise.all([
      import('/src/data/wolves-directors-cut-intro.ts'),
      import('/src/data/wolves-directors-cut-artwork.ts'),
    ])
    return {
      prewarmSecond: intro.DIRECTORS_CUT_IKORA_PREWARM_SECOND,
      crossfadeSeconds: intro.DIRECTORS_CUT_SCENE_CROSSFADE_SECONDS,
      trackSeconds: intro.TRIBULATION_TRACK_SECONDS,
      sourceVideoId: intro.TRIBULATION_SOURCE_VIDEO_ID,
      artwork: artwork.DIRECTORS_CUT_DESTINY_CONCEPTS.map(record => ({
        id: record.id,
        localPath: record.localPath,
        sourceWidth: record.sourceWidth,
        sourceHeight: record.sourceHeight,
      })),
      cues: intro.buildDirectorsCutPrologueSegment().overlays.map(cue => ({
        text: cue.text,
        start: cue.start,
        end: cue.end,
        textHoldSeconds: cue.textHoldSeconds ?? null,
        backgroundImage: cue.backgroundImage ?? null,
        framed: Boolean(cue.backgroundFraming),
      })),
    }
  })
  assert('the recut loads in a browser and tiles the whole song', cut.cues.length > 10 && cut.cues[cut.cues.length - 1].end === cut.trackSeconds, cut.cues.length)

  log('\n  Paintings — whole, unenlarged, fully lit')
  const firstAppearance = new Map()
  for (const cue of cut.cues) {
    if (cue.backgroundImage?.includes('destiny-concepts/') && !firstAppearance.has(cue.backgroundImage)) {
      firstAppearance.set(cue.backgroundImage, cue)
    }
  }

  for (const record of cut.artwork) {
    const cue = firstAppearance.get(record.localPath)
    if (!cue) {
      assert(`${record.id} appears in the recut`, false)
      continue
    }
    const midpoint = cue.start + (cue.end - cue.start) / 2
    const stage = await seekPrologue(page, midpoint)
    const decoded = decodeURIComponent(stage.src ?? '')
    const aspect = record.sourceWidth / record.sourceHeight
    const painted = stage.paintedBox
    const paintedAspect = painted && painted.height > 0 ? painted.width / painted.height : 0

    assert(`${record.id} is on stage at ${midpoint.toFixed(2)}s`, decoded.endsWith(record.localPath), { expected: record.localPath, observed: decoded })
    assert(`${record.id} decoded`, stage.naturalWidth > 0, stage)
    // The ledger geometry the framing CSS is derived from has to be the real file, or
    // every "shown whole" claim below is measuring our own assumption back at us.
    assert(
      `${record.id} ledger geometry matches the decoded file`,
      stage.naturalWidth === record.sourceWidth && stage.naturalHeight === record.sourceHeight,
      { decoded: [stage.naturalWidth, stage.naturalHeight], ledger: [record.sourceWidth, record.sourceHeight] },
    )
    assert(`${record.id} is letterboxed, not cropped`, stage.objectFit === 'contain', stage.objectFit)
    assert(
      `${record.id} keeps its source aspect ratio (${aspect.toFixed(3)})`,
      painted != null && Math.abs(paintedAspect - aspect) < 0.01,
      { aspect, paintedAspect, painted },
    )
    assert(
      `${record.id} is not enlarged past its source pixels`,
      painted != null && painted.scale <= 1 + 1e-6,
      { scale: painted?.scale, painted, source: [record.sourceWidth, record.sourceHeight] },
    )
    // A painting that fits nowhere near the frame edges is not "framed whole", it is a
    // postage stamp. `contain` must touch one axis of the stage.
    assert(
      `${record.id} fills the frame on its constraining axis`,
      painted != null
      && (Math.abs(painted.width - Math.min(stage.renderedWidth, record.sourceWidth)) <= 2
        || Math.abs(painted.height - Math.min(stage.renderedHeight, record.sourceHeight)) <= 2),
      { painted, elementBox: [stage.renderedWidth, stage.renderedHeight] },
    )
    assert(
      `${record.id} sits inside the frame`,
      painted != null
      && stage.renderedLeft >= -1 && stage.renderedTop >= -1
      && painted.width <= PROJECTOR_VIEWPORT.width + 1
      && painted.height <= PROJECTOR_VIEWPORT.height + 1,
      { rect: [stage.renderedLeft, stage.renderedTop, stage.renderedWidth, stage.renderedHeight], painted },
    )
    assert(`${record.id} is shown at full brightness`, stage.imageOpacity >= 0.99, stage.imageOpacity)
    assert(
      `${record.id} carries a scrim only while it carries words`,
      stage.hasScrim === stage.textRendered,
      stage,
    )
    assert(
      `${record.id} dissolves at the cut's own tempo`,
      stage.sceneCrossfade === `${cut.crossfadeSeconds}s`,
      { observed: stage.sceneCrossfade, expected: `${cut.crossfadeSeconds}s` },
    )
    log(`        painted ${painted?.width}x${painted?.height} (scale ${painted?.scale.toFixed(3)}) in ${PROJECTOR_VIEWPORT.width}x${PROJECTOR_VIEWPORT.height}, source ${record.sourceWidth}x${record.sourceHeight}`)
  }

  log('\n  Line breaks hold — the audience reads the lines that were authored')
  // Every cue that puts words on screen, not just the ones that clear. The
  // closing title card holds its shot to the end (`textHoldSeconds == null`) and
  // was filtered out here — so the last frame the audience sees was the one
  // frame this check never looked at.
  for (const cue of cut.cues.filter(candidate => candidate.text)) {
    const window = cue.textHoldSeconds ?? cue.end - cue.start
    await seekPrologue(page, cue.start + Math.min(2.5, window / 2))
    // `seekPrologue` settles on the *image*. The caption is a separately keyed
    // element with its own 1.6s reveal, so sampling on an image settle reads
    // whichever thought was on screen before this one — every cue "passed" at an
    // identical 1111px until this wait was added.
    // The overlay renders the display type without its punctuation, so compare
    // on letters alone; this is a settle condition, not a provenance check.
    const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const expected = normalize(cue.text)
    const arrived = await page
      .waitForFunction(
        (want) => {
          const node = document.querySelector('.wolves-intro-overlay-text')
          if (!node) {
            return false
          }
          const style = getComputedStyle(node)
          if (style.display === 'none' || Number.parseFloat(style.opacity || '1') < 0.99) {
            return false
          }
          // Two render paths live under this one element. Narration cues emit
          // one `<span>` *per character*, so joining children on a space spells
          // the line out letter by letter. `slim` cues emit one block `<span>`
          // per authored line with no whitespace between them, so *not*
          // separating them welds "BLUEFIN" to "seven". Separate on block
          // display, which is the thing that actually distinguishes them.
          const read = (node) => {
            let out = ''
            for (const child of node.childNodes) {
              if (child.nodeType === Node.ELEMENT_NODE && getComputedStyle(child).display === 'block') {
                out += ` ${child.textContent ?? ''} `
              }
              else {
                out += child.textContent ?? ''
              }
            }
            return out
          }
          return read(node).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === want
        },
        expected,
        { timeout: 8000 },
      )
      .then(() => true, () => false)

    if (!assert(`"${cue.text.split('\n')[0].slice(0, 30)}..." reaches the screen`, arrived, expected)) {
      continue
    }

    const authored = cue.text.split('\n').length
    const lines = (await readStage(page)).textLines
    if (!assert(
      `"${cue.text.split('\n')[0].slice(0, 30)}..." renders the lines it authored`,
      Boolean(lines) && lines.rendered === authored,
      { authored, ...lines },
    )) {
      continue
    }
    log(`        ${authored} lines, widest ${lines.widest}px of ${lines.boxWidth}px box`)
  }

  log('\n  Reading holds — a thought clears, its shot plays on')
  const held = cut.cues.find(cue => cue.textHoldSeconds != null && cue.end - cue.start - cue.textHoldSeconds > 4 && cue.backgroundImage)
  if (held) {
    const during = await seekPrologue(page, held.start + Math.max(held.textHoldSeconds - 1.5, 2))
    assert(`"${held.text.split('\n')[0].slice(0, 34)}..." is readable inside its hold`, during.textVisible && (during.textContent ?? '').length > 0, during)
    const after = await seekPrologue(page, held.start + held.textHoldSeconds + 2.5)
    assert('the thought has cleared once read', !after.textVisible, after)
    assert('its shot is still running', Boolean(after.src) && after.sceneOpacity >= 0.99, after)
  }
  else {
    log('  no cue has more than four seconds of post-reading slack in this recut')
  }

  log('\n  Handoff — warm, silent, and never black')
  await seekPrologue(page, cut.prewarmSecond + 2)
  await page.waitForFunction(
    id => (window.__mockWolvesPlayers ?? []).some(player => player.videoId === id),
    IKORA_VIDEO_ID,
    { timeout: 15_000 },
  )
  const warmedStage = await readStage(page)
  const warmed = (await readPlayers(page)).find(player => player.videoId === IKORA_VIDEO_ID)
  assert('the Ikora player is built during the prologue', Boolean(warmed), warmed)
  assert('it is parked silent', warmed?.muted === true && warmed?.playCalls === 0, warmed)
  assert('it is cued to its authored opening frame', warmed?.cuedAt === 2, warmed)
  assert('its host is mounted but unseen', warmedStage.playerHostRendered && !warmedStage.playerHostVisible, warmedStage)
  assert('the prologue still owns the screen', Boolean(warmedStage.src), warmedStage)

  const lastPainting = await seekPrologue(page, cut.trackSeconds - 6)
  assert('the closing title is over a painting', Boolean(lastPainting.src) && lastPainting.textVisible, lastPainting)

  // Cross the cut and sample immediately: a black frame here is what the audience would see.
  await page.evaluate(target => window.__wolvesIntro.seekTo(target), cut.trackSeconds - 0.2)
  await page.waitForFunction(
    () => (window.__mockWolvesPlayers ?? []).some(player => player.videoId === 'BKm0TPqeOjY' && player.playCalls > 0),
    null,
    { timeout: 15_000 },
  )
  const promoted = await readPlayers(page)
  const ikora = promoted.filter(player => player.videoId === IKORA_VIDEO_ID)
  assert('exactly one Ikora player exists — the warmed one was promoted, not replaced', ikora.length === 1, promoted)
  assert('the promoted player was never re-loaded', ikora[0]?.loadedAt == null, ikora[0])
  assert('the promoted player is audible', ikora[0]?.muted === false, ikora[0])
  const music = promoted.find(player => player.videoId === cut.sourceVideoId)
  assert('the music is gone before the trailer speaks — never both at once', music?.destroyed === true, music)

  await page.waitForFunction(
    () => {
      const host = document.querySelector('.wolves-intro-overlay-player')
      return Boolean(host) && Number.parseFloat(getComputedStyle(host).opacity || '0') > 0.99
    },
    null,
    { timeout: 15_000 },
  )
  const revealed = await readStage(page)
  assert('the trailer is on stage once it is really playing', revealed.playerHostVisible, revealed)

  await page.close()

  log('\n  Narrow viewport — the words survive')
  const narrow = await openPrologue(NARROW_VIEWPORT)
  const narrationCue = cut.cues.find(cue => cue.text && cue.textHoldSeconds != null)
  const narrowStage = await seekPrologue(narrow, narrationCue.start + 2)
  assert('the prologue keeps its narration below 641px', narrowStage.textVisible, narrowStage)
  assert('the narration is rescaled rather than blanked', narrowStage.textFontSize > 10 && narrowStage.textFontSize < 46, narrowStage.textFontSize)
  log(`        measured ${narrowStage.textFontSize}px caption at ${NARROW_VIEWPORT.width}x${NARROW_VIEWPORT.height}`)
  assert(
    'the narration stays inside the frame',
    narrowStage.textRect != null && narrowStage.textRect.top >= 0 && narrowStage.textRect.bottom <= NARROW_VIEWPORT.height + 1,
    narrowStage.textRect,
  )

  const narrowDominant = cut.cues.find(cue => cue.text.startsWith('Now, what\'s left'))
  const narrowDominantStage = await seekPrologue(narrow, narrowDominant.start + 2)
  assert('the dominant crescendo line also survives narrow', narrowDominantStage.textVisible, narrowDominantStage)
  log(`        measured ${narrowDominantStage.textFontSize}px dominant line at ${NARROW_VIEWPORT.width}x${NARROW_VIEWPORT.height}`)
  assert(
    'and still fits the frame',
    narrowDominantStage.textRect != null && narrowDominantStage.textRect.top >= 0 && narrowDominantStage.textRect.bottom <= NARROW_VIEWPORT.height + 1,
    narrowDominantStage.textRect,
  )
  await narrow.close()

  assert('no page errors during the probe', pageErrors.length === 0, pageErrors)
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
