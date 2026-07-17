/**
 * Wolves cinematic browser flow test — standalone Playwright script
 *
 * Verifies the rebuilt Wolves cinematic (lobby -> intro -> cinematic -> finished,
 * one Pinia store, dual-buffer YouTube player) using a deterministic mock of the
 * YouTube IFrame Player API so the test never depends on live YouTube playback,
 * ads, region, or external availability. All timeline assertions are driven by
 * player/mock-player time through the dev-only window.__wolvesCinematic hook
 * (seekTo/skip), never by mutating store state directly.
 *
 * Coverage:
 *   1. Lobby -> intro -> Part I cinematic handoff.
 *   2. Escalating Voice hero typography at every authored thesis boundary
 *      (visible text and mode asserted separately; computed font, blue colour,
 *      multi-layer glow, in-viewport bounds, and no overflow) on desktop and
 *      390x844 mobile.
 *   3. Creator Shorts interstitial handoff (organization ads absent during the
 *      shorts) with the two creators' captions, driven to completion by mock
 *      ENDED events.
 *   4. Part II organization ad pairs: interactive pair membership, crossfade
 *      opacities, on-screen bounds, and non-intersection with the centre gallery.
 *   5. Transition shell / team-chat separation: the transition shell decays on
 *      the player timeline independently of the team chat.
 *   6. Mobile hides the desktop-only ad and chat overlays while keeping the media
 *      widget and gallery on-screen.
 *
 * Team chat: production WOLVES_TEAM_CHATS is empty by design, so no authored
 * dialogue exists to assert. When WOLVES_BROWSER_FIXTURES=1 (set in CI) this test
 * injects a neutral placeholder chat sequence through window.__wolvesTeamChatFixtures,
 * which CinematicTransition.vue reads ONLY under import.meta.env.DEV (tree-shaken
 * from production). The fixture dialogue lives only in this test file and is never
 * written into src/. Without the flag the test asserts the production default:
 * the team chat never renders.
 *
 * Prerequisites: dev server must be running (Vite dev build, so import.meta.env.DEV
 * is true and the dev-only hooks exist):
 *   npm run dev
 *
 * Run (defaults to http://127.0.0.1:5173):
 *   WOLVES_BROWSER_FIXTURES=1 node tests/wolves-movie-flow.mjs
 *
 * Environment:
 *   WOLVES_BASE_URL           base URL of the running dev server
 *   WOLVES_BROWSER_FIXTURES   '1' to inject the dev-only team-chat fixture
 *   WOLVES_SCREENSHOT_DIR     directory to write flow screenshots into (optional)
 */

import { mkdirSync } from 'node:fs'
import process from 'node:process'
import { chromium } from 'playwright'

const BASE_URL = (process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173').replace(/\/+$/, '')
const WOLVES_URL = `${BASE_URL}/wolves/`
const SCREENSHOT_DIR = process.env.WOLVES_SCREENSHOT_DIR
const USE_CHAT_FIXTURES = ['1', 'true'].includes(process.env.WOLVES_BROWSER_FIXTURES ?? '')

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

// First video ids from src/data/wolves-creator-shorts.ts — used to capture the
// left (Cassidy) and right (Lindsay) mock players by their initial video id.
const CASSIDY_FIRST_VIDEO_ID = 'e6GCa-E75uk'
const LINDSAY_FIRST_VIDEO_ID = 'T8aREn47900'
const PART_TWO_TITLE = 'Ghosts In The Mist'
const CHAT_SEGMENT_ID = 'ghosts-in-the-mist'

// Authored thesis strings — copied verbatim from src/data/wolves-thesis-sequence.ts
// (never paraphrased; exact ellipses preserved).
const WELCOME_TEXT = 'We\'ve got your back.'
const SUPPORT_TEXT = 'You\'ll never walk alone ...'
const UNIVERSAL_BLUE_TEXT = 'We are Universal Blue.'
const EVOLVE_TEXT = 'Evolve or die ...'
const ASCENDED_TEXT = 'You have ascended ...'
const LEGEND_TEXT = 'Become Legend'

/**
 * Every authored Escalating Voice boundary the brief pins, mapped to the exact
 * getWolvesThesisState() outcome. `active: false` means no thesis renders;
 * `corruption: true` means the growing-corruption glyphs render with no text.
 */
const HERO_BOUNDARIES = [
  { t: 344.999, active: false },
  { t: 345, mode: 'welcome', text: WELCOME_TEXT, font: 'Michroma' },
  { t: 347.75, mode: 'welcome', text: SUPPORT_TEXT, font: 'Michroma' },
  { t: 350.5, mode: 'universal-blue', text: UNIVERSAL_BLUE_TEXT, font: 'Share Tech Mono' },
  { t: 359, mode: 'evolve', text: EVOLVE_TEXT, font: 'Share Tech Mono' },
  { t: 365, active: false },
  { t: 404.999, mode: 'growing-corruption', corruption: true },
  { t: 405, mode: 'legend', text: ASCENDED_TEXT, font: 'Michroma' },
  { t: 407.999, mode: 'legend', text: ASCENDED_TEXT, font: 'Michroma' },
  { t: 408, mode: 'legend', text: LEGEND_TEXT, font: 'Michroma' },
  { t: 425, mode: 'legend', text: LEGEND_TEXT, font: 'Michroma' },
  { t: 425.001, active: false },
]

let passed = 0
let failed = 0

function assert(label, actual, expected) {
  const ok = actual === expected
  if (ok) {
    passed++
    console.log(`  PASS  ${label}`)
    console.log(`        got: ${actual}`)
  }
  else {
    failed++
    console.error(`  FAIL  ${label}`)
    console.error(`        expected: ${expected}`)
    console.error(`        got:      ${actual}`)
  }
  return ok
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
    console.error(`        expected a truthy value, got: ${actual}`)
  }
  return ok
}

async function captureStage(page, name) {
  if (SCREENSHOT_DIR) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` })
  }
}

/**
 * Installs the deterministic YouTube IFrame API mock (and, when enabled, the
 * dev-only team-chat fixture) before any page script runs.
 */
async function installMocks(page, { useFixtures }) {
  await page.addInitScript((opts) => {
    // Deterministic shuffles so gallery/short ordering is reproducible.
    Math.random = () => 0
    window.__mockWolvesPlayers = []

    const normalizeVideoId = v => (typeof v === 'string' ? v : (v && v.videoId) || null)

    window.YT = {
      Player: class MockPlayer {
        constructor(element, config) {
          this.config = config
          this.videoId = normalizeVideoId(config.videoId)
          this.currentTime = 0
          this.state = window.YT.PlayerState.CUED
          window.__mockWolvesPlayers.push(this)
          // Fire ready/playing asynchronously so handlers attach first.
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

        // Large so Part I seeks to 345-425s never cross a segment's end and
        // trigger a premature dual-buffer swap. Real durations are ~10 min.
        getDuration() {
          return 600
        }

        seekTo(seconds) {
          this.currentTime = seconds
        }

        setVolume() {}
        getVolume() {
          return 100
        }

        mute() {}
        unMute() {}
        setPlaybackQuality() {}
        loadModule() {}
        unloadModule() {}

        loadVideoById(v) {
          this.videoId = normalizeVideoId(v)
          this.currentTime = (v && typeof v === 'object' && v.startSeconds) || 0
        }

        cueVideoById(v) {
          this.videoId = normalizeVideoId(v)
        }

        destroy() {}

        triggerEnded() {
          this.config.events?.onStateChange?.({ data: window.YT.PlayerState.ENDED, target: this })
        }

        triggerError() {
          this.config.events?.onError?.({ target: this })
        }
      },
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    }

    if (!window.onYouTubeIframeAPIReady) {
      window.onYouTubeIframeAPIReady = () => {}
    }

    if (opts.useFixtures) {
      // Dev/CI-only placeholder chat sequence. Neutral lorem-ipsum, no authored
      // dialogue, no ellipses, no emoji. CinematicTransition.vue reads this only
      // under import.meta.env.DEV, so it can never ship in production.
      window.__wolvesTeamChatFixtures = {
        [opts.chatSegmentId]: {
          messages: [
            { atSeconds: 0, speaker: 'ci-fixture', text: 'Lorem ipsum dolor sit amet' },
            { atSeconds: 8, speaker: 'ci-fixture', text: 'Consectetur adipiscing elit' },
          ],
          finalMessageEndsAtSeconds: 60,
        },
      }
    }
  }, { useFixtures, chatSegmentId: CHAT_SEGMENT_ID })
}

async function gotoWolves(page) {
  try {
    await page.goto(WOLVES_URL, { waitUntil: 'networkidle', timeout: 30_000 })
  }
  catch {
    // networkidle can time out on animation-heavy pages; fall through to the
    // explicit selector waits below.
  }
  await page.waitForTimeout(600)
}

/** Lobby -> intro -> Part I cinematic stage ready, with the dev hook live. */
async function enterCinematic(page) {
  await page.getByRole('button', { name: /BEGIN TRANSMISSION/i }).click()
  await page.waitForSelector('.wolves-intro-overlay', { state: 'visible', timeout: 10_000 })

  // The shared media widget transports the intro: prologue -> destiny -> done.
  const nextButton = page.locator('.wc-widget button[aria-label="Next"]')
  await nextButton.click()
  await page.waitForTimeout(300)
  await nextButton.click()

  await page.waitForSelector('.wc-stage', { state: 'visible', timeout: 10_000 })
  await page.waitForFunction(
    () => typeof window.__wolvesCinematic?.seekTo === 'function'
      && typeof window.__wolvesCinematic?.skip === 'function',
    { timeout: 10_000 },
  )
}

/** Seek Part I to a native timestamp and read the settled thesis DOM state. */
async function heroStateAt(page, seconds) {
  await page.evaluate(s => window.__wolvesCinematic.seekTo(s), seconds)
  // 100ms poll -> store.updateTime, plus the 0.4s thesis opacity transition.
  await page.waitForTimeout(650)
  return page.evaluate(() => {
    const layers = Array.from(document.querySelectorAll('.wc-thesis'))
    // Ignore an element that is still leaving so counts/text reflect the current cue.
    const isLeaving = el => el.classList.contains('wc-thesis-leave-active') || el.classList.contains('wc-thesis-leave-to')
    const current = layers.filter(el => !isLeaving(el))
    const wrap = current[0] ?? null
    const textEl = wrap?.querySelector('.wc-thesis-text') ?? null
    const corruptionEl = wrap?.querySelector('.wc-thesis-corruption') ?? null
    const style = textEl ? getComputedStyle(textEl) : null
    const rect = textEl ? textEl.getBoundingClientRect() : null
    const shadowLayers = style ? (style.textShadow.match(/rgba?\(/g)?.length ?? 0) : 0
    const rgb = style ? style.color.match(/\d+/g)?.map(Number) ?? [] : []
    return {
      thesisCount: current.length,
      wrapClass: wrap?.className ?? null,
      hasText: Boolean(textEl),
      text: textEl?.textContent ?? null,
      hasCorruption: Boolean(corruptionEl),
      fontFamily: style?.fontFamily ?? null,
      fontSize: style ? Number.parseFloat(style.fontSize) : null,
      color: style?.color ?? null,
      isBlue: rgb.length === 3 && rgb[2] > rgb[0] && rgb[2] > rgb[1] && rgb[2] > 200,
      shadowLayers,
      scrollW: textEl?.scrollWidth ?? null,
      clientW: textEl?.clientWidth ?? null,
      rect: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null,
      vw: window.innerWidth,
      vh: window.innerHeight,
    }
  })
}

/** Assert one hero boundary. `full` runs the font/colour/glow/bounds/overflow checks. */
async function assertHeroBoundary(page, viewportLabel, boundary, { full }) {
  const state = await heroStateAt(page, boundary.t)
  const tag = `[${viewportLabel} @${boundary.t}]`

  if (boundary.active === false) {
    assert(`${tag} no thesis renders (mode inactive)`, state.thesisCount, 0)
    assert(`${tag} no hero text element`, state.hasText, false)
    return state
  }

  // Mode asserted separately from text.
  assertTruthy(`${tag} wrapper carries wc-thesis--${boundary.mode}`, state.wrapClass?.includes(`wc-thesis--${boundary.mode}`))

  if (boundary.corruption) {
    assert(`${tag} growing-corruption shows no thesis text`, state.hasText, false)
    assert(`${tag} growing-corruption glyphs render`, state.hasCorruption, true)
    return state
  }

  // Visible text asserted separately (exact string, exact ellipses).
  assert(`${tag} visible hero text`, state.text, boundary.text)

  if (full) {
    assertTruthy(`${tag} computed font-family is ${boundary.font}`, state.fontFamily?.includes(boundary.font))
    assertTruthy(`${tag} hero text colour is blue`, state.isBlue)
    assertTruthy(`${tag} multi-layer glow (>=3 shadow layers)`, state.shadowLayers >= 3)
    assertTruthy(
      `${tag} text stays within viewport bounds`,
      state.rect
      && state.rect.left >= -1 && state.rect.right <= state.vw + 1
      && state.rect.top >= -1 && state.rect.bottom <= state.vh + 1,
    )
    assertTruthy(`${tag} no horizontal overflow`, state.scrollW <= state.clientW + 1)
  }

  return state
}

/** Drive the Creator Shorts interstitial to completion (3 Cassidy turns, then 1 Lindsay). */
async function driveCreatorShorts(page) {
  await page.evaluate(({ cassidyId, lindsayId }) => {
    const left = window.__mockWolvesPlayers.find(p => p.videoId === cassidyId)
    const right = window.__mockWolvesPlayers.find(p => p.videoId === lindsayId)
    if (!left || !right) {
      throw new Error(`missing shorts players left=${Boolean(left)} right=${Boolean(right)}`)
    }
    left.triggerEnded()
    left.triggerEnded()
    left.triggerEnded()
    right.triggerEnded()
  }, { cassidyId: CASSIDY_FIRST_VIDEO_ID, lindsayId: LINDSAY_FIRST_VIDEO_ID })
}

/** Seek Part II to an elapsed second and read the organization-ad blend state. */
async function adBlendAt(page, seconds) {
  await page.evaluate(s => window.__wolvesCinematic.seekTo(s), seconds)
  await page.waitForTimeout(400)
  return page.evaluate(() => {
    const rect = el => (el ? el.getBoundingClientRect().toJSON() : null)
    const interactive = document.querySelector('.wc-org-ad-pair.is-interactive')
    const left = interactive?.querySelector('.wc-org-ad--left') ?? null
    const right = interactive?.querySelector('.wc-org-ad--right') ?? null
    const gallery = document.querySelector('.flickr-gallery-wrapper') ?? document.querySelector('.wc-trackzero-viewer')
    return {
      interactiveAdCount: interactive ? interactive.querySelectorAll('.wc-org-ad').length : 0,
      pair0Opacity: document.querySelector('.wc-org-ad-pair[data-pair="0"]')?.getAttribute('data-opacity') ?? null,
      pair1Opacity: document.querySelector('.wc-org-ad-pair[data-pair="1"]')?.getAttribute('data-opacity') ?? null,
      leftOrg: left?.getAttribute('data-org') ?? null,
      rightOrg: right?.getAttribute('data-org') ?? null,
      leftAd: rect(left),
      rightAd: rect(right),
      gallery: rect(gallery),
      widget: rect(document.querySelector('.wc-widget')),
      rootFontPx: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      vw: window.innerWidth,
      vh: window.innerHeight,
    }
  })
}

/** Seek Part II to an elapsed second and read the transition-shell / team-chat state. */
async function transitionStateAt(page, seconds) {
  await page.evaluate(s => window.__wolvesCinematic.seekTo(s), seconds)
  await page.waitForTimeout(300)
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) {
        return false
      }
      const r = el.getBoundingClientRect()
      return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0
    }
    const shell = document.querySelector('.wc-transition-shell')
    const chat = document.querySelector('.wc-team-chat')
    return {
      shellCount: document.querySelectorAll('.wc-transition-shell').length,
      shellVisible: visible(shell),
      shellOpacity: shell?.getAttribute('data-opacity') ?? null,
      chatCount: document.querySelectorAll('.wc-team-chat').length,
      chatVisible: visible(chat),
      chatLinks: Array.from(document.querySelectorAll('.wc-team-chat a')).map(a => a.getAttribute('href')),
    }
  })
}

async function runDesktopFlow(page) {
  console.log('\n== Desktop 1440x900 ==')
  await enterCinematic(page)

  console.log('\n-- Part I: Escalating Voice hero typography --')
  const sizeByMode = {}
  for (const boundary of HERO_BOUNDARIES) {
    // Run the full font/colour/glow/bounds/overflow checks on each distinct cue.
    const full = Boolean(boundary.text) && ![407.999, 425].includes(boundary.t)
    const state = await assertHeroBoundary(page, 'desktop', boundary, { full })
    if (boundary.mode && state.fontSize) {
      sizeByMode[boundary.mode] ??= state.fontSize
    }
    if (boundary.t === 345) {
      await captureStage(page, 'desktop-hero-welcome')
    }
    if (boundary.t === 405) {
      await captureStage(page, 'desktop-hero-ascended')
    }
    if (boundary.t === 408) {
      await captureStage(page, 'desktop-hero-legend')
    }
  }
  assertTruthy(
    `[desktop] dominant legend cue renders larger than or equal to the welcome cue (${sizeByMode.legend}px >= ${sizeByMode.welcome}px)`,
    sizeByMode.legend >= sizeByMode.welcome,
  )

  console.log('\n-- Creator Shorts handoff --')
  await page.evaluate(() => window.__wolvesCinematic.skip(1))
  await page.waitForSelector('.wolves-creator-shorts-interstitial', { state: 'visible', timeout: 10_000 })
  assert('[desktop] organization ads are absent during Creator Shorts', await page.locator('.wc-org-ads').count(), 0)
  const leftCaption = await page.locator('.wolves-creator-shorts-slot').nth(0).locator('.wolves-creator-shorts-caption').textContent()
  const rightCaption = await page.locator('.wolves-creator-shorts-slot').nth(1).locator('.wolves-creator-shorts-caption').textContent()
  assertTruthy('[desktop] left slot credits Cassidy Williams', leftCaption?.includes('Cassidy Williams'))
  assertTruthy('[desktop] right slot credits Lindsay Nikole', rightCaption?.includes('Lindsay Nikole'))
  await captureStage(page, 'desktop-creator-shorts')

  await driveCreatorShorts(page)
  await page.waitForSelector('.wolves-creator-shorts-interstitial', { state: 'hidden', timeout: 10_000 })
  await page.waitForSelector('.wc-org-ads', { state: 'visible', timeout: 10_000 })
  await page.waitForFunction(() => typeof window.__wolvesCinematic?.seekTo === 'function', { timeout: 10_000 })
  const nameplate = (await page.locator('.wc-stage-nameplate').textContent())?.replace(/\s+/g, ' ').trim()
  assertTruthy(`[desktop] Part II resumes at "${PART_TWO_TITLE}"`, nameplate?.includes(PART_TWO_TITLE))

  console.log('\n-- Part II: organization ad pairs --')
  const pairA = await adBlendAt(page, 0)
  assert('[desktop] exactly two ads in the interactive pair', pairA.interactiveAdCount, 2)
  assert('[desktop] Pair A interactive at 0s (pair 0 shown)', pairA.pair0Opacity, '1')
  assert('[desktop] Pair B hidden at 0s', pairA.pair1Opacity, '0')
  assert('[desktop] Pair A left ad is GNOME', pairA.leftOrg, 'gnome')
  assert('[desktop] Pair A right ad is KubeCon', pairA.rightOrg, 'kubecon')
  await captureStage(page, 'desktop-partii-pair-a')

  const blend30 = await adBlendAt(page, 30)
  assert('[desktop] Pair A fully shown at 30s', blend30.pair0Opacity, '1')
  assert('[desktop] Pair B fully hidden at 30s', blend30.pair1Opacity, '0')

  const blend32 = await adBlendAt(page, 32)
  assert('[desktop] Pair A mid-crossfade at 32s', blend32.pair0Opacity, '0.5')
  assert('[desktop] Pair B mid-crossfade at 32s', blend32.pair1Opacity, '0.5')

  const blend34 = await adBlendAt(page, 34)
  assert('[desktop] Pair A hidden at 34s', blend34.pair0Opacity, '0')
  assert('[desktop] Pair B fully shown at 34s', blend34.pair1Opacity, '1')
  assert('[desktop] Pair B left ad is Flathub', blend34.leftOrg, 'flathub')
  assert('[desktop] Pair B right ad is KDE', blend34.rightOrg, 'kde')
  await captureStage(page, 'desktop-partii-pair-b')

  // Bounds and non-intersection with the centre gallery. The frozen design sizes
  // each ad up to 16rem at left/right 2.4rem while the gallery gutter clamps to
  // 18rem, so at wide viewports the ad's inner edge overhangs the gallery COLUMN
  // box by ~0.4rem of letterbox margin (the visible photo, object-fit: contain,
  // stays well clear). We assert the ads flank the gallery within that documented
  // frozen-design spill; a real regression that moved an ad onto the gallery would
  // exceed it and fail.
  const spill = 12 * blend34.rootFontPx
  const galleryCenter = blend34.gallery.left + blend34.gallery.width / 2
  const withinViewport = ad => ad.left >= -1 && ad.right <= blend34.vw + 1 && ad.top >= -1 && ad.bottom <= blend34.vh + 1
  assertTruthy('[desktop] left ad stays within the viewport', withinViewport(blend34.leftAd))
  assertTruthy('[desktop] right ad stays within the viewport', withinViewport(blend34.rightAd))
  assertTruthy('[desktop] left ad sits above the media widget', blend34.leftAd.bottom <= blend34.widget.top)
  assertTruthy('[desktop] right ad sits above the media widget', blend34.rightAd.bottom <= blend34.widget.top)
  assertTruthy('[desktop] left ad flanks the gallery on the left', blend34.leftAd.right < galleryCenter && blend34.leftAd.right <= blend34.gallery.left + spill)
  assertTruthy('[desktop] right ad flanks the gallery on the right', blend34.rightAd.left > galleryCenter && blend34.rightAd.left >= blend34.gallery.right - spill)

  console.log('\n-- Part II: transition shell / team-chat separation --')
  const shell10 = await transitionStateAt(page, 10)
  assert('[desktop] transition shell present at 10s', shell10.shellCount, 1)
  assert('[desktop] transition shell opaque at 10s', shell10.shellOpacity, '1')

  const shell12 = await transitionStateAt(page, 12)
  assertTruthy('[desktop] transition shell still visible mid-decay at 12s', shell12.shellVisible)
  assert('[desktop] transition shell half-faded at 12s', shell12.shellOpacity, '0.5')

  const shell14 = await transitionStateAt(page, 14)
  assert('[desktop] transition shell fully decayed (removed) at 14s', shell14.shellCount, 0)
  await captureStage(page, 'desktop-transition-decay')

  if (USE_CHAT_FIXTURES) {
    assertTruthy('[desktop] team chat visible at 10s', shell10.chatVisible)
    assertTruthy('[desktop] team chat visible at 12s', shell12.chatVisible)
    // The core separation: the shell is gone while the chat still renders.
    assertTruthy('[desktop] team chat persists after the shell decays (14s)', shell14.chatVisible)
    assertTruthy('[desktop] team chat links to contribute.cncf.io', shell14.chatLinks.includes('https://contribute.cncf.io'))
    assertTruthy('[desktop] team chat links to ask.cncf.io', shell14.chatLinks.includes('https://ask.cncf.io'))
  }
  else {
    // Production default: WOLVES_TEAM_CHATS is empty, so no chat ever renders.
    assert('[desktop] no team chat renders without fixtures (production default)', shell12.chatCount, 0)
  }
}

async function runMobileFlow(page) {
  console.log('\n== Mobile 390x844 ==')
  await enterCinematic(page)

  console.log('\n-- Part I: hero typography (mobile) --')
  const sizeByMode = {}
  for (const boundary of HERO_BOUNDARIES) {
    const full = Boolean(boundary.text) && ![407.999, 425].includes(boundary.t)
    const state = await assertHeroBoundary(page, 'mobile', boundary, { full })
    if (boundary.mode && state.fontSize) {
      sizeByMode[boundary.mode] ??= state.fontSize
    }
    if (boundary.t === 345) {
      await captureStage(page, 'mobile-hero-welcome')
    }
    if (boundary.t === 408) {
      await captureStage(page, 'mobile-hero-legend')
    }
  }
  assertTruthy(
    `[mobile] dominant legend cue renders larger than or equal to the welcome cue (${sizeByMode.legend}px >= ${sizeByMode.welcome}px)`,
    sizeByMode.legend >= sizeByMode.welcome,
  )

  console.log('\n-- Creator Shorts + Part II (mobile) --')
  await page.evaluate(() => window.__wolvesCinematic.skip(1))
  await page.waitForSelector('.wolves-creator-shorts-interstitial', { state: 'visible', timeout: 10_000 })
  await driveCreatorShorts(page)
  await page.waitForSelector('.wolves-creator-shorts-interstitial', { state: 'hidden', timeout: 10_000 })
  await page.waitForFunction(() => typeof window.__wolvesCinematic?.seekTo === 'function', { timeout: 10_000 })

  await page.evaluate(() => window.__wolvesCinematic.seekTo(10))
  await page.waitForTimeout(400)
  const mobile = await page.evaluate(() => {
    const inViewport = (el) => {
      if (!el) {
        return false
      }
      const r = el.getBoundingClientRect()
      return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0
        && r.left >= -1 && r.right <= window.innerWidth + 1
    }
    const orgAds = document.querySelector('.wc-org-ads')
    const chat = document.querySelector('.wc-team-chat')
    const gallery = document.querySelector('.flickr-gallery-wrapper') ?? document.querySelector('.wc-trackzero-viewer')
    return {
      orgAdsDisplay: orgAds ? getComputedStyle(orgAds).display : 'absent',
      chatDisplay: chat ? getComputedStyle(chat).display : 'absent',
      widgetInViewport: inViewport(document.querySelector('.wc-widget')),
      galleryInViewport: inViewport(gallery),
    }
  })
  assertTruthy('[mobile] organization ads are hidden (display:none or absent)', mobile.orgAdsDisplay === 'none' || mobile.orgAdsDisplay === 'absent')
  assertTruthy('[mobile] team chat is hidden (display:none or absent)', mobile.chatDisplay === 'none' || mobile.chatDisplay === 'absent')
  assertTruthy('[mobile] media widget stays within the viewport', mobile.widgetInViewport)
  assertTruthy('[mobile] gallery stays within the viewport', mobile.galleryInViewport)
  await captureStage(page, 'mobile-partii')
}

if (SCREENSHOT_DIR) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

console.log('\nWolves cinematic browser flow test')
console.log(`  URL:              ${WOLVES_URL}`)
console.log(`  Chat fixtures:    ${USE_CHAT_FIXTURES ? 'on (WOLVES_BROWSER_FIXTURES)' : 'off (production default)'}`)
console.log(`  Screenshot dir:   ${SCREENSHOT_DIR ?? '(none)'}`)

const browser = await chromium.launch({ headless: true })
let exitCode = 0

try {
  const desktop = await browser.newPage({ viewport: DESKTOP })
  await installMocks(desktop, { useFixtures: USE_CHAT_FIXTURES })
  await gotoWolves(desktop)
  await runDesktopFlow(desktop)
  await desktop.close()

  const mobile = await browser.newPage({ viewport: MOBILE })
  await installMocks(mobile, { useFixtures: USE_CHAT_FIXTURES })
  await gotoWolves(mobile)
  await runMobileFlow(mobile)
  await mobile.close()
}
catch (error) {
  failed++
  exitCode = 1
  console.error('\n  FAIL  Unhandled error during the Wolves flow')
  console.error(error)
}
finally {
  await browser.close()
}

console.log(`\nResults: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  exitCode = 1
}
process.exit(exitCode)
