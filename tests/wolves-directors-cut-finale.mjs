/**
 * Real-browser probe for the Director's Cut finale.
 *
 * `wolvesDirectorsCutFinale.test.ts` proves the anchors and
 * `wolvesDirectorsCutFinaleStage.test.ts` proves the composition against a
 * fake player. Neither can answer the questions that only a browser can:
 * whether the finale actually covers the running show at every anchor, whether
 * the Collapse plates and the companion iframe really resolve, where the
 * elements land in a projector-sized frame, and whether the chrome is gone
 * from the DOM rather than merely styled away.
 *
 * The probe seeks the real transport to each named anchor (and to both sides
 * of the ones that hand the frame over) and captures, for each: which finale
 * component is on stage, the companion's own source time, the soundtrack time
 * the runtime published, and the element bounds.
 *
 * ## Two evidence modes — read the banner before quoting a result
 *
 * - **mock transport** (default). The YouTube IFrame API is replaced with a
 *   deterministic fake, so the clock only moves when this harness seeks it and
 *   the companion's own clock is frozen. That freeze is deliberate: it is what
 *   a stalled embed looks like, so the drift correction has to fire, and the
 *   seek target it asks for is directly observable. Nothing here is evidence
 *   about YouTube decoding anything.
 * - **real media** (`WOLVES_REAL_MEDIA=1`). No mock at all: the page loads the
 *   real IFrame API and the companion is a real player reporting its own time.
 *   Playwright's bundled Chromium ships without the proprietary codecs YouTube
 *   usually serves, so this mode is opt-in and is the only mode whose companion
 *   timings are evidence about real media.
 *
 * Run against a dev server:
 *   npm run dev -- --host :: --port 5173 --strictPort
 *   node tests/wolves-directors-cut-finale.mjs
 *   WOLVES_VIEWPORT=390x844 node tests/wolves-directors-cut-finale.mjs
 *
 * Real media needs a browser with the proprietary codecs YouTube serves, which
 * Playwright's bundled Chromium does not have. Point the harness at a real
 * Chrome over CDP instead — on this machine Chrome is a Flatpak, so it is
 * launched through `flatpak run` and attached to, rather than spawned by
 * Playwright:
 *
 *   flatpak run --command=chrome com.google.Chrome --headless=new \
 *     --remote-debugging-port=9333 --remote-allow-origins='*' about:blank &
 *   WOLVES_REAL_MEDIA=1 WOLVES_CDP=http://127.0.0.1:9333 \
 *     node tests/wolves-directors-cut-finale.mjs
 */
import process from 'node:process'
import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const WOLVES_URL = `${BASE_URL}/wolves/experience/`
const [width, height] = (process.env.WOLVES_VIEWPORT ?? '1600x900').split('x').map(Number)
const VIEWPORT = { width, height }
const REAL_MEDIA = process.env.WOLVES_REAL_MEDIA === '1'
/**
 * Write a screenshot of every probed anchor to this directory.
 *
 * Off by default: the assertions are the test signal. It exists because the
 * finale is a composition — panels, plates and type sharing a projected frame —
 * and "the corner is 406px wide at the right coordinates" is not the same claim
 * as "a person in the back row can read this".
 *
 *   WOLVES_SHOT_DIR=/var/tmp/website-agent/finale node tests/wolves-directors-cut-finale.mjs
 */
const SHOT_DIR = process.env.WOLVES_SHOT_DIR ?? null
/** Attach to an already-running browser (a real Chrome) instead of spawning Chromium. */
const CDP_ENDPOINT = process.env.WOLVES_CDP ?? null
const NARROW = width < 1024
/** Authored segment duration; the mock transport reports it to the runtime. */
const MOCK_DURATIONS = { LASru9j0oIc: 424, PjryN2F6fF0: 270.458 }

let failures = 0
let skipped = false
const log = (...args) => console.log(...args)

class SkipProbe extends Error {}

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

const browser = CDP_ENDPOINT
  ? await chromium.connectOverCDP(CDP_ENDPOINT)
  : await chromium.launch({ headless: process.env.HEADED !== '1', args: ['--mute-audio', '--no-sandbox'] })
const context = CDP_ENDPOINT
  ? (browser.contexts()[0] ?? await browser.newContext({ viewport: VIEWPORT }))
  : await browser.newContext({ viewport: VIEWPORT })
const page = await context.newPage()
await page.setViewportSize(VIEWPORT)
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))

try {
  if (!REAL_MEDIA) {
    await page.addInitScript((durations) => {
      window.__mockWolvesPlayers = []
      window.YT = {
        Player: class MockPlayer {
          constructor(element, config) {
            this.config = config
            this.videoId = config.videoId ?? null
            this.currentTime = config.playerVars?.start ?? 0
            this.volume = 100
            this.muted = false
            this.calls = []
            this.state = window.YT.PlayerState.CUED
            window.__mockWolvesPlayers.push(this)
            Promise.resolve().then(() => {
              this.config.events?.onReady?.({ target: this })
              // Only the soundtrack transport autoplays. The finale's companion
              // is constructed with autoplay off and must be started by the
              // component, so starting it here would hide exactly the defect
              // this harness exists to catch.
              if (config.playerVars?.autoplay !== 0) {
                this.playVideo()
              }
            })
          }

          record(method, args) {
            this.calls.push({ method, args })
          }

          playVideo() {
            this.record('playVideo', [])
            this.state = window.YT.PlayerState.PLAYING
            this.config.events?.onStateChange?.({ data: this.state, target: this })
          }

          pauseVideo() {
            this.record('pauseVideo', [])
            this.state = window.YT.PlayerState.PAUSED
            this.config.events?.onStateChange?.({ data: this.state, target: this })
          }

          loadVideoById(video) {
            const payload = typeof video === 'string' ? { videoId: video, startSeconds: 0 } : video
            this.videoId = payload.videoId
            this.currentTime = payload.startSeconds ?? 0
            this.record('loadVideoById', [payload])
            this.playVideo()
          }

          cueVideoById(video) {
            const payload = typeof video === 'string' ? { videoId: video, startSeconds: 0 } : video
            this.videoId = payload.videoId
            this.currentTime = payload.startSeconds ?? 0
            this.record('cueVideoById', [payload])
          }

          seekTo(seconds) {
            this.currentTime = seconds
            this.record('seekTo', [seconds])
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
            this.muted = true
            this.volume = 0
            this.record('mute', [])
          }

          unMute() {
            this.muted = false
            this.volume = 100
          }

          isMuted() {
            return this.muted
          }

          getVideoData() {
            return { video_id: this.videoId }
          }

          destroy() {}
        },
        PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
      }
      if (!window.onYouTubeIframeAPIReady) {
        window.onYouTubeIframeAPIReady = () => {}
      }
    }, MOCK_DURATIONS)
  }

  log(`\nDirector's Cut finale probe`)
  log(`  URL:       ${WOLVES_URL}`)
  log(`  viewport:  ${width}x${height}${NARROW ? ' (narrow)' : ''}`)
  log(`  evidence:  ${REAL_MEDIA ? 'REAL MEDIA (live YouTube IFrame API)' : 'MOCK TRANSPORT (deterministic fake player)'}\n`)

  await page.goto(WOLVES_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(500)

  // Anchors and measured source frames come from the module under test through
  // the dev server's own graph, so this harness can never drift away from the
  // values the running show uses — and the module is proved to load in a
  // browser, which a bundler build does not prove.
  const spec = await page.evaluate(async () => {
    const finale = await import('/src/data/wolves-directors-cut-finale.ts')
    return {
      anchors: { ...finale.DIRECTORS_CUT_FINALE_ANCHORS },
      order: [...finale.DIRECTORS_CUT_FINALE_ANCHOR_ORDER],
      videoId: finale.DIRECTORS_CUT_COMPANION_VIDEO_ID,
      park: finale.COMPANION_SOURCE_PARK_SECONDS,
      impact: finale.COMPANION_SOURCE_IMPACT_SECONDS,
      spaceImpact: finale.COMPANION_SOURCE_SPACE_IMPACT_SECONDS,
      black: finale.COMPANION_SOURCE_BLACK_SECONDS,
      runtime: finale.COMPANION_SOURCE_RUNTIME_SECONDS,
      tolerance: finale.DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S,
      extinction: finale.DIRECTORS_CUT_EXTINCTION_CLAUSE,
      survival: finale.DIRECTORS_CUT_SURVIVAL_CLAUSE,
      sourceAt: null,
    }
  })
  assert('the finale module loads in a browser', Object.keys(spec.anchors).length === spec.order.length, spec.order)

  await page.getByRole('button', { name: /DIRECTOR'S CUT/i }).click()
  await page.waitForFunction(() => typeof window.__wolvesDurations?.skipIntro === 'function', null, { timeout: 20_000 })
  await page.evaluate(() => window.__wolvesDurations.skipIntro())
  await page.waitForSelector('.wc-trackzero-grid', { state: 'attached', timeout: 20_000 }).catch((error) => {
    if (REAL_MEDIA) {
      throw new SkipProbe(`the real soundtrack never reached Track 0 (${error.message})`)
    }
    throw error
  })
  await page.waitForFunction(() => typeof window.__wolvesCinematic?.seekTo === 'function', null, { timeout: 20_000 })
  log('  Director\'s Cut stage started\n')

  function readStage() {
    return page.evaluate((videoId) => {
      const box = (selector) => {
        const element = document.querySelector(selector)
        if (!element) {
          return null
        }
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        const laidOut = style.display !== 'none' && rect.width > 0 && rect.height > 0
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          opacity: Number.parseFloat(style.opacity),
          // Rendered but invisible is a real and deliberate state here: the
          // companion is kept in the layout and compositing tree through its
          // hidden play lead and merely made transparent, so `visible` has to
          // read opacity too or a warming corner scores as on stage.
          rendered: laidOut,
          visible: laidOut && style.visibility !== 'hidden' && Number.parseFloat(style.opacity) > 0,
        }
      }
      const finale = document.querySelector('[data-director-finale]')
      const companionPlayer = (window.__mockWolvesPlayers ?? []).find(player => player.videoId === videoId) ?? null
      const liveCompanion = typeof window.__wolvesFinaleCompanion === 'function'
        ? window.__wolvesFinaleCompanion()
        : null
      const grid = document.querySelector('[data-trackzero-grid]')
      const slideLayers = [...document.querySelectorAll('.flickr-photo-layer')].map((layer) => {
        const rect = layer.getBoundingClientRect()
        return {
          opacity: Number.parseFloat(getComputedStyle(layer).opacity) || 0,
          src: layer.querySelector('.flickr-img')?.getAttribute('src') ?? null,
          area: Math.round(rect.width * rect.height),
        }
      })
      return {
        finalePresent: Boolean(finale),
        covering: finale?.getAttribute('data-covering') ?? null,
        nightOpacity: document.querySelector('[data-director-finale-night]')?.getAttribute('data-night-opacity') ?? null,
        frame: box('[data-director-finale-frame]'),
        bulletin: box('[data-director-finale-bulletin]'),
        companion: box('[data-director-finale-companion]'),
        companionIframes: document.querySelectorAll('[data-director-finale-companion] iframe').length,
        companionHostPresent: Boolean(document.querySelector('[data-director-finale-companion] .wc-dcf-companion-host')),
        companionPlayerBuilt: liveCompanion?.built ?? Boolean(companionPlayer),
        companionRendered: liveCompanion?.rendered ?? null,
        companionSynchronized: liveCompanion?.synchronized ?? null,
        companionReadinessLost: liveCompanion?.readinessLost ?? null,
        black: box('[data-director-finale-black]'),
        blackClasses: document.querySelector('[data-director-finale-black]')?.className ?? '',
        extinction: document.querySelector('[data-director-finale-clause="extinction"]')?.textContent?.trim() ?? null,
        survival: document.querySelector('[data-director-finale-clause="survival"]')?.textContent?.trim() ?? null,
        quoteSource: document.querySelector('[data-director-finale-clause] p')?.getAttribute('data-quote-source') ?? null,
        gridVisible: grid ? getComputedStyle(grid).display !== 'none' : false,
        slideLayers,
        thesis: Boolean(document.querySelector('.wc-thesis')),
        nameplate: Boolean(document.querySelector('.wc-stage-nameplate')),
        orgAds: Boolean(document.querySelector('.wc-org-ads')),
        captions: Boolean(document.querySelector('.wc-caption')),
        mediaWidget: Boolean(document.querySelector('.wc-widget')),
        sidecar: Boolean(document.querySelector('[data-trackzero-video-sidecar]')),
        companionSourceTime: liveCompanion?.sourceTime ?? companionPlayer?.getCurrentTime?.() ?? null,
        companionCalls: companionPlayer ? companionPlayer.calls.map(entry => entry.method) : null,
        companionMuted: liveCompanion?.muted ?? companionPlayer?.isMuted?.() ?? null,
        companionVolume: liveCompanion?.volume ?? companionPlayer?.getVolume?.() ?? null,
        companionVideoId: liveCompanion?.videoId ?? companionPlayer?.getVideoData?.()?.video_id ?? null,
        soundtrackTime: window.__wolvesFinaleProbeTime ?? null,
      }
    }, spec.videoId)
  }

  async function at(seconds, label) {
    await page.evaluate((time) => {
      window.__wolvesCinematic.seekTo(time)
    }, seconds)
    // The runtime republishes its clock on a 100ms poll and the finale reacts
    // on the next tick; sampling before that reads the previous anchor's frame.
    await page.waitForFunction(
      target => Math.abs((window.__wolvesProbeStoreTime?.() ?? -1) - target) < 0.75,
      seconds,
      { timeout: 8000 },
    ).catch(() => {})
    await page.waitForTimeout(REAL_MEDIA ? 1200 : 450)
    const stage = await readStage()
    // Optional visual evidence. The measurements above answer "is it in the
    // right place"; only a picture answers "does it read from the back row",
    // which is the standard this presentation is actually held to.
    if (SHOT_DIR) {
      await page.screenshot({ path: `${SHOT_DIR}/${label.replace(/[^a-z0-9]+/gi, '-')}.png` })
    }
    stage.label = label
    stage.at = seconds
    stage.publishedTime = await page.evaluate(() => window.__wolvesProbeStoreTime?.() ?? null)
    return stage
  }

  // A tiny store reader, published from the page rather than guessed at, so the
  // "active soundtrack time" this harness reports is the one the runtime used.
  await page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__
    const pinia = app?.config?.globalProperties?.$pinia
    const store = pinia?.state?.value?.cinematic
    window.__wolvesProbeStoreTime = () => store?.nativeTime ?? null
  })

  const A = spec.anchors
  const sourceAt = time => spec.park + Math.min(Math.max(time, A.companionPlayStart), A.companionEnd) - A.companionPlayStart

  // Real-media mode needs a transport that actually moves. Playwright's bundled
  // Chromium ships without the proprietary codecs YouTube serves, so the
  // soundtrack embed can sit at 0 forever: every anchor would then be sampled
  // at 0s and the run would report a wall of failures that say nothing about
  // this change. Prove the clock moves before claiming any real-media evidence,
  // and stand down loudly rather than fabricating a verdict.
  if (REAL_MEDIA) {
    // Real-media evidence that does not need the show clock: build the
    // companion through the real IFrame API, on the same origin the finale
    // uses, and read back what YouTube says it is holding. This is the part of
    // the finale a mock can never prove — that the id resolves, that the API
    // accepts the measured park second, and that the player reports it.
    const realCompanion = await page.evaluate(async ({ videoId, park }) => {
      // The IFrame API REPLACES the element it is handed, so the element that
      // is counted for an iframe has to be a wrapper that survives the swap.
      const wrapper = document.createElement('div')
      wrapper.style.cssText = 'position:fixed;left:-9999px;width:320px;height:180px'
      const host = document.createElement('div')
      wrapper.appendChild(host)
      document.body.appendChild(wrapper)
      const api = await import('/src/composables/useYoutubeIframeApi.ts')
      await api.loadYoutubeIframeApi()
      const Player = api.getYoutubePlayerConstructor()
      if (!Player) {
        return { built: false }
      }
      const player = await new Promise((resolve) => {
        const created = new Player(host, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: api.getChromeFreeYoutubePlayerVars({ autoplay: 0, mute: 1, start: Math.floor(park) }),
          events: { onReady: () => resolve(created), onError: () => resolve(null) },
        })
        setTimeout(() => resolve(null), 15000)
      })
      if (!player) {
        return { built: false }
      }
      player.mute?.()
      player.seekTo?.(park, true)
      await new Promise(resolve => setTimeout(resolve, 3000))
      const result = {
        built: true,
        videoId: player.getVideoData?.()?.video_id ?? null,
        title: player.getVideoData?.()?.title ?? null,
        duration: player.getDuration?.() ?? null,
        currentTime: player.getCurrentTime?.() ?? null,
        muted: player.isMuted?.() ?? null,
        iframes: wrapper.querySelectorAll('iframe').length,
      }
      player.destroy?.()
      wrapper.remove()
      return result
    }, { videoId: spec.videoId, park: spec.park })

    if (!realCompanion.built) {
      log('  SKIP  real-media companion: the live IFrame API never reported the player ready here.')
    }
    else if (!realCompanion.duration) {
      // The player object exists and knows its id, but YouTube never handed it
      // any media: no duration, no title. Asserting source seconds against that
      // would be asserting against a stub, so it stands down instead.
      log(`  SKIP  real-media companion: the live player loaded no media here (id ${realCompanion.videoId}, duration ${realCompanion.duration}).`)
      log('        Only the id resolution below is real-media evidence on this machine.')
      assert('real media: the companion id resolves to the authored upload', realCompanion.videoId === spec.videoId, realCompanion)
      assert('real media: the companion is muted before anything else', realCompanion.muted !== false, realCompanion)
      assert('real media: the companion rendered a real iframe', realCompanion.iframes === 1, realCompanion)
    }
    else {
      assert('real media: the companion id resolves to the authored upload', realCompanion.videoId === spec.videoId, realCompanion)
      assert(
        `real media: the source runtime matches the measured ${spec.runtime}s`,
        realCompanion.duration !== null && Math.abs(realCompanion.duration - spec.runtime) <= 1,
        realCompanion,
      )
      assert(
        `real media: the live player accepts the measured park second (${spec.park.toFixed(3)})`,
        realCompanion.currentTime !== null && Math.abs(realCompanion.currentTime - spec.park) <= spec.tolerance,
        realCompanion,
      )
      assert('real media: the companion is muted', realCompanion.muted !== false, realCompanion)
      assert('real media: the companion rendered a real iframe', realCompanion.iframes === 1, realCompanion)
    }

    await page.evaluate(target => window.__wolvesCinematic.seekTo(target), A.coverStart + 1)
    const held = []
    for (let sample = 0; sample < 6; sample++) {
      await page.waitForTimeout(1000)
      held.push(await page.evaluate(() => window.__wolvesProbeStoreTime?.() ?? 0))
    }
    // `getCurrentTime()` answers a seek optimistically even when the media
    // never decodes, and then the embed collapses back to 0. One sample would
    // read that optimism as a working transport; the whole run has to hold.
    if (Math.min(...held) < A.coverStart) {
      throw new SkipProbe(`this browser never held the soundtrack clock (samples ${held.join(', ')})`)
    }
  }

  // ---- before the finale: the ordinary show is intact --------------------
  const beforePrearm = await at(A.companionPrearm - 3, 'before pre-arm')
  assert('the finale has not mounted before its pre-arm anchor', beforePrearm.finalePresent === false, beforePrearm)
  assert('the ordinary theater grid is on stage before the finale', beforePrearm.gridVisible === true, beforePrearm)
  assert('the nameplate is up before the finale', beforePrearm.nameplate === true, beforePrearm)

  const prearmed = await at(A.companionPrearm + 1, 'pre-armed')
  assert('the finale mounts at its pre-arm anchor', prearmed.finalePresent === true, prearmed)
  assert('the finale has not taken the frame yet', prearmed.covering === 'false', prearmed)
  assert('the ordinary theater grid is still on stage', prearmed.gridVisible === true, prearmed)
  // The mock `YT.Player` never replaces its host with an iframe, so "an iframe
  // exists" is only real evidence under WOLVES_REAL_MEDIA=1. In mock mode the
  // equivalent claim is that the player was constructed against a mounted host.
  assert(
    'the companion player is built against a mounted host before the audience sees it',
    REAL_MEDIA ? prearmed.companionIframes === 1 : prearmed.companionHostPresent && prearmed.companionPlayerBuilt,
    { iframes: prearmed.companionIframes, host: prearmed.companionHostPresent, built: prearmed.companionPlayerBuilt },
  )
  assert('the companion is hidden while it warms up', prearmed.companion?.visible === false, prearmed.companion)
  // …but hidden is not unrendered. `display: none` licenses a browser to skip
  // layout, paint and compositing for the whole subtree, and the reveal is a
  // hard cut only 0.395 s after the companion starts rolling — far too short to
  // gamble on a first paint in front of the room.
  assert('the companion is rendered and laid out while it warms up',
    prearmed.companion?.rendered === true && prearmed.companion?.display !== 'none' && prearmed.companion?.opacity === 0,
    prearmed.companion)
  if (!REAL_MEDIA) {
    assert('the companion is cued and parked, never played', (prearmed.companionCalls ?? []).includes('cueVideoById') && !(prearmed.companionCalls ?? []).includes('playVideo'), prearmed.companionCalls)
    assert('the companion is muted before it is revealed', prearmed.companionMuted === true, prearmed.companionMuted)
    assert(
      `the companion is parked on its measured lead frame (${spec.park.toFixed(3)}s)`,
      Math.abs((prearmed.companionSourceTime ?? -1) - spec.park) < 0.01,
      { parked: prearmed.companionSourceTime, expected: spec.park },
    )
  }

  const beforeCover = await at(A.coverStart - 0.5, 'last ordinary frame')
  assert('the last ordinary slide is still on stage half a second before the cover', beforeCover.gridVisible === true, beforeCover)

  // ---- the cover: nothing ordinary may be visible again ------------------
  const anchorProbes = [
    ['cover', A.coverStart + 0.2],
    ['mid barrage', (A.coverStart + A.companionPlayStart) / 2],
    ['companion play start', A.companionPlayStart + 0.2],
    ['companion reveal', A.companionReveal + 0.2],
    ['from-space impact', A.companionReveal + (spec.spaceImpact - spec.impact)],
    ['companion black', A.companionReveal + (spec.black - spec.impact)],
    ['become legend cue', A.extinctionStart + 0.2],
    ['extinction fade', A.extinctionFadeStart + 0.2],
    ['clause gap', A.extinctionEnd + 0.2],
    ['survival', A.survivalStart + 0.2],
    ['terminal fade', A.terminalFadeStart + 0.2],
    ['terminal black', A.terminalFadeEnd + 0.2],
  ]

  const samples = []
  for (const [label, seconds] of anchorProbes) {
    const stage = await at(seconds, label)
    samples.push(stage)
    assert(`${label}: the finale covers the frame at ${seconds.toFixed(3)}s`, stage.covering === 'true', stage)
    // The negative that matters. Task 7 left the ordinary schedule frozen on
    // its last slide through the whole finale interval, and a harness that
    // asserted "the same image is still there" scored that freeze as success.
    // A covered slide has no rendered area at all, so this fails if the finale
    // ever stops covering it.
    //
    // Running the schedule on in a bottom-left corner panel through the finale
    // was tried and rejected — beside the Collapse fade and the closing quote
    // it is one moving picture too many — so this is the standing rule again.
    assert(
      `${label}: no ordinary slide is on stage`,
      stage.gridVisible === false && stage.slideLayers.length === 0,
      { gridVisible: stage.gridVisible, layers: stage.slideLayers },
    )
    // The thesis plates are a full-stage beat that lives inside the theater
    // grid, so they go with it.
    assert(`${label}: no thesis plate is running`, stage.thesis === false, stage.thesis)
    // `WolvesOrgAds` and `CinematicCaptions` never render during Track 0 of
    // either cut (the ads are gated to segments after the first, and Track 0
    // ships no caption track), so their absence here is a weak negative and
    // the stage-level gate is proved by `wolvesDirectorsCutFinaleStage.test.ts`
    // instead. The nameplate, media widget and theater grid are the ones this
    // browser can genuinely see appear and disappear.
    assert(`${label}: the nameplate, ads, captions and widget are gone`,
      !stage.nameplate && !stage.orgAds && !stage.captions && !stage.mediaWidget,
      { nameplate: stage.nameplate, orgAds: stage.orgAds, captions: stage.captions, mediaWidget: stage.mediaWidget })
    assert(`${label}: the standard Track 0 sidecar is gone`, stage.sidecar === false, stage.sidecar)
    // The thesis plates are a full-stage beat living inside the viewer the
    // finale insets. Left running they render at corner scale and spill out of
    // the panel — "BECOME LEGEND" laid across a 400px box over the closing
    // quote.
    assert(`${label}: no thesis plate is running inside the corner`, stage.thesis === false, stage.thesis)
    assert(`${label}: the Collapse plate fills the frame`,
      stage.frame?.width === width && stage.frame?.height === height,
      { frame: stage.frame, viewport: VIEWPORT })
  }

  const byLabel = Object.fromEntries(samples.map(sample => [sample.label, sample]))

  // ---- the companion window ---------------------------------------------
  assert('the companion is still hidden while it rolls up to the reveal', byLabel['companion play start'].companion?.visible === false, byLabel['companion play start'].companion)
  assert('the companion is still rendered while it rolls up to the reveal',
    byLabel['companion play start'].companion?.rendered === true
    && byLabel['companion play start'].companion?.width === byLabel['companion reveal'].companion?.width
    && byLabel['companion play start'].companion?.height === byLabel['companion reveal'].companion?.height,
    { lead: byLabel['companion play start'].companion, reveal: byLabel['companion reveal'].companion })
  assert('the companion is on stage from its reveal', byLabel['companion reveal'].companion?.visible === true, byLabel['companion reveal'].companion)
  assert('the revealed companion reports the authored media id',
    byLabel['companion reveal'].companionVideoId === spec.videoId,
    byLabel['companion reveal'].companionVideoId)
  assert('the companion is on stage across the from-space impact', byLabel['from-space impact'].companion?.visible === true, byLabel['from-space impact'].companion)
  assert('the companion is cleared on the Become Legend cue', byLabel['become legend cue'].companion?.visible === false, byLabel['become legend cue'].companion)
  assert('every on-air companion sample reports the authored media id',
    samples
      .filter(sample => sample.companion?.visible)
      .every(sample => sample.companionVideoId === spec.videoId),
    samples.map(sample => [sample.label, sample.companionVideoId, sample.companion?.visible]))

  if (NARROW) {
    const corner = byLabel['companion reveal'].companion
    assert('narrow viewports still get the companion, as a centred band', corner?.visible === true, corner)
    assert('the narrow companion is centred, not cornered', corner && Math.abs((corner.x + corner.width / 2) - width / 2) <= 4, corner)
    const bulletin = byLabel.cover.bulletin
    assert('narrow viewports keep the bulletin in a readable band', bulletin?.visible === true && bulletin.width <= width, bulletin)
    assert('the narrow bulletin is centred above the companion',
      bulletin && Math.abs((bulletin.x + bulletin.width / 2) - width / 2) <= 4
      && corner
      && bulletin.y + bulletin.height <= corner.y,
      { bulletin, companion: corner })
  }
  else {
    const corner = byLabel['companion reveal'].companion
    assert('the companion sits in the lower-right corner on a projector frame',
      corner && corner.x + corner.width <= width && corner.x > width / 2 && corner.y > height / 2,
      corner)
    assert('the bulletin is a minor beat beside the main frame', byLabel.cover.bulletin?.visible === true && byLabel.cover.bulletin.width < width / 2, byLabel.cover.bulletin)
    assert('the bulletin is cleared before the quote', byLabel['become legend cue'].bulletin?.visible !== true, byLabel['become legend cue'].bulletin)
    assert('the corner never overlaps the bulletin', (() => {
      const b = byLabel['companion reveal'].bulletin
      const c = byLabel['companion reveal'].companion
      if (!b || !c) {
        return true
      }
      return b.y + b.height <= c.y || c.y + c.height <= b.y || b.x + b.width <= c.x || c.x + c.width <= b.x
    })(), { bulletin: byLabel['companion reveal'].bulletin, companion: byLabel['companion reveal'].companion })
  }

  assert('the companion stays muted and at zero volume while it is on air',
    samples
      .filter(sample => sample.companion?.visible)
      .every(sample => sample.companionMuted !== false && (sample.companionVolume === null || sample.companionVolume === 0)),
    samples.map(sample => [sample.label, sample.companionMuted, sample.companionVolume]))

  if (!REAL_MEDIA) {
    for (const label of ['companion reveal', 'from-space impact', 'companion black']) {
      const sample = byLabel[label]
      const expected = sourceAt(sample.at)
      assert(
        `${label}: the companion was seeked to its measured source second (${expected.toFixed(3)})`,
        Math.abs((sample.companionSourceTime ?? -1) - expected) <= spec.tolerance,
        { observed: sample.companionSourceTime, expected },
      )
    }
    assert('the companion never runs past its source runtime',
      samples.every(sample => (sample.companionSourceTime ?? 0) < spec.runtime),
      samples.map(sample => [sample.label, sample.companionSourceTime]))
    assert('the companion stayed muted for the whole window',
      samples.every(sample => sample.companionMuted !== false),
      samples.map(sample => [sample.label, sample.companionMuted]))
  }
  else {
    const observed = byLabel['companion reveal'].companionSourceTime
    log(`  NOTE  real-media companion time at reveal: ${observed === null ? 'unavailable (no mock bookkeeping)' : observed}`)
  }

  // ---- the closing quote --------------------------------------------------
  // The direction of the fade is only half the claim. The plates shipped named
  // the wrong way round — the file called "night" was the warm sunset — so the
  // Collapse *brightened* into the closing quote while every clock assertion
  // below still passed. Decode both and compare, which is a question only a
  // browser can answer.
  const plateLuma = await page.evaluate(async ([dayUrl, nightUrl]) => {
    const meanLuma = async (url) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * 160))
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let total = 0
      for (let index = 0; index < data.length; index += 4) {
        total += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]
      }
      return total / (data.length / 4)
    }
    return { day: await meanLuma(dayUrl), night: await meanLuma(nightUrl) }
  }, [`${BASE_URL}/wolves-intro/bluefin-collapse-day.webp`, `${BASE_URL}/wolves-intro/bluefin-collapse-night.webp`])
  assert(
    'the Collapse day plate is genuinely brighter than its night plate',
    plateLuma.day > plateLuma.night,
    plateLuma,
  )

  assert('the Collapse plate is on the day side when the finale opens', Number(byLabel.cover.nightOpacity) < 0.05, byLabel.cover.nightOpacity)
  assert('the Collapse plate has turned to night by the Become Legend cue', Number(byLabel['become legend cue'].nightOpacity) >= 0.999, byLabel['become legend cue'].nightOpacity)

  assert('the first clause is on stage on the cue', byLabel['become legend cue'].extinction === spec.extinction, byLabel['become legend cue'].extinction)
  assert('the second clause is not on stage with the first', byLabel['become legend cue'].survival === null, byLabel['become legend cue'].survival)
  assert('the frame is empty between the two clauses', byLabel['clause gap'].extinction === null && byLabel['clause gap'].survival === null, byLabel['clause gap'])
  assert('the second clause is on stage alone', byLabel.survival.survival === spec.survival && byLabel.survival.extinction === null, byLabel.survival)
  assert('the second clause is still on stage under the terminal fade', byLabel['terminal fade'].survival === spec.survival, byLabel['terminal fade'].survival)
  assert('no closing content remains after terminal black',
    byLabel['terminal black'].survival === null
    && byLabel['terminal black'].extinction === null
    && byLabel['terminal black'].bulletin?.visible !== true,
    byLabel['terminal black'])
  assert('the clause carries its book citation, never Cosmos',
    typeof byLabel.survival.quoteSource === 'string'
    && byLabel.survival.quoteSource.includes('The Varieties of Scientific Experience')
    && !/cosmos/i.test(byLabel.survival.quoteSource),
    byLabel.survival.quoteSource)

  assert('the terminal fade is latched on its beat', byLabel['terminal fade'].blackClasses.includes('wc-dcf-black--fading'), byLabel['terminal fade'].blackClasses)
  assert('the frame is black by the fade end', Number(byLabel['terminal black'].black?.opacity) >= 0.99, byLabel['terminal black'].black)

  // ---- the end of the show ------------------------------------------------
  const ended = await at(423.9, 'end of show')
  assert('the show is black at the end', Number(ended.black?.opacity) >= 0.99, ended.black)
  assert('the finale still owns the frame at the end', ended.covering === 'true', ended)
  const endState = await page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__
    const store = app?.config?.globalProperties?.$pinia?.state?.value?.cinematic
    return { segmentIndex: store?.segmentIndex ?? null, segments: store?.segments?.length ?? null, phase: store?.phase ?? null }
  })
  assert('the Track 0 finale stays in the two-segment fork, with no lobby and no loop',
    endState.segmentIndex === 0 && endState.segments === 2 && endState.phase === 'cinematic',
    endState)

  // ---- seeking backward gives the show back -------------------------------
  const restored = await at(120, 'seeked back')
  assert('seeking back before the finale restores the ordinary grid', restored.gridVisible === true, restored)
  assert('seeking back restores the nameplate and the media widget', restored.nameplate && restored.mediaWidget, restored)
  // The standard sidecar is desktop-only by its own authored rule; below the
  // theater's 1024px breakpoint its absence is correct, not a regression.
  if (!NARROW) {
    assert('seeking back restores the standard Track 0 sidecar', restored.sidecar === true, restored.sidecar)
  }
  assert('seeking back unmounts the finale entirely', restored.finalePresent === false, restored)

  assert('no page errors across the finale probe', pageErrors.length === 0, pageErrors)
}
catch (error) {
  if (error instanceof SkipProbe) {
    skipped = true
    log(`  SKIP  real-media mode: ${error.message}`)
    log('        No real-media evidence is available here. Run mock mode, or attach')
    log('        to a browser that can decode the YouTube source (WOLVES_CDP).')
  }
  else {
    failures += 1
    log(`  FAIL  harness error: ${error.stack ?? error.message}`)
  }
}
finally {
  await browser.close()
}

log(`\n${skipped ? 'SKIPPED (no real media support)' : failures === 0 ? 'PASS' : `FAIL (${failures})`}\n`)
process.exit(skipped || failures === 0 ? 0 : 1)
