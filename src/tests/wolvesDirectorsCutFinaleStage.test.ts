import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import CinematicStage from '@/components/wolves/cinematic/CinematicStage.vue'
import TheaterExperience from '@/components/wolves/cinematic/TheaterExperience.vue'
import WolvesDirectorFinale from '@/components/wolves/cinematic/WolvesDirectorFinale.vue'
import { loreProsePages, pickPageIndexForElapsed } from '@/components/wolves/lore/lore-pages'
import { companionSourceTimeAt, DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S, DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S, DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S, DIRECTORS_CUT_COMPANION_VIDEO_ID, DIRECTORS_CUT_COVER_FADE_SECONDS, DIRECTORS_CUT_EXTINCTION_FADE_SECONDS, DIRECTORS_CUT_FINALE_ANCHORS } from '@/data/wolves-directors-cut-finale'
import { DIRECTORS_CUT_BULLETIN_ARTIFACT_ID, DIRECTORS_CUT_BULLETIN_END, DIRECTORS_CUT_BULLETIN_START, DIRECTORS_CUT_FINALE_START } from '@/data/wolves-directors-cut-timeline'
import { loadAllLoreRecords } from '@/data/wolves-lore-records'
import { useCinematicStore, WOLVES_DIRECTORS_CUT_EXPERIENCE, WOLVES_EXPERIENCE } from '@/stores/cinematic'

vi.mock('@/composables/useDualBufferPlayer', () => ({
  useDualBufferPlayer: () => ({
    activeSide: ref<'a' | 'b'>('a'),
    prepare: vi.fn(),
    start: vi.fn(),
    togglePlay: vi.fn(),
    seekTo: vi.fn(),
    seekToRatio: vi.fn(),
    skip: vi.fn(),
    destroy: vi.fn(),
    bufferSnapshot: vi.fn(),
  }),
}))

/**
 * The companion player is a real YouTube IFrame API client. These tests are
 * about composition and suppression, so the loader is stubbed with a recording
 * fake: what matters here is that the finale asks for the right video, at the
 * right source second, muted, and only inside its window.
 */
const companionCalls: { method: string, args: unknown[] }[] = []
let constructedPlayers = 0
let capturedConfig: Record<string, any> | null = null
/** Fail the shared API loader, the way a blocked or dead script load does. */
let loaderFails = false
/** Hold `onReady` so a test can unmount while the build is still in flight. */
let deferReady: (() => void) | null = null
/**
 * Make the constructed player report a fatal embed error.
 *
 * `before-assignment` fires `onError` from inside `new PlayerCtor(...)`, before
 * the expression returns — the order a real embed uses when the video itself is
 * undecodable, and the order in which the caller does not yet hold the instance
 * it has to dispose of.
 */
let playerFails: 'before-assignment' | 'after-ready' | null = null
/** Make the fake report a different upload through the runtime's ground-truth API. */
let reportedVideoId: string | null = null

/**
 * When the constructed player reports playback after `playVideo()`.
 *
 * A real embed does not become `PLAYING` the instant it is asked to: it
 * rebuffers after every seek, which is exactly the window in which the corner
 * must not be on stage. `immediate` is the convenient fake; `deferred` holds
 * the report so a test can observe the buffering window; `never` is an embed
 * that was asked to roll and simply never did.
 */
let playbackReports: 'immediate' | 'deferred' | 'never' = 'immediate'
const pendingPlaybackReports: (() => void)[] = []

/** Any plausible source length; only the probe hook reads it. */
const COMPANION_FAKE_DURATION = 262

/** Let every held `PLAYING` report through, the way a decoded embed finally does. */
async function reportPlayback() {
  const reports = pendingPlaybackReports.splice(0, pendingPlaybackReports.length)
  for (const report of reports) {
    report()
  }
  await nextTick()
}

/**
 * Per-instance view of every player the finale constructed. Aggregate call
 * counting cannot tell "two players destroyed once" from "one player destroyed
 * twice", and `YT.Player.destroy()` on an already-destroyed player throws
 * inside the API's own teardown.
 */
interface FakeCompanionPlayer { destroyCalls: number, currentTime: number }
const constructedInstances: FakeCompanionPlayer[] = []

function record(method: string) {
  return (...args: unknown[]) => {
    companionCalls.push({ method, args })
  }
}

vi.mock('@/composables/useYoutubeIframeApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useYoutubeIframeApi')>()
  return {
    ...actual,
    loadYoutubeIframeApi: () => (loaderFails
      ? Promise.reject(new Error('YouTube IFrame API failed to load'))
      : Promise.resolve()),
    getYoutubePlayerConstructor: () => class FakePlayer {
      config: Record<string, any>

      currentTime = 0
      destroyCalls = 0
      constructor(_element: Element, config: Record<string, any>) {
        this.config = config
        constructedPlayers += 1
        constructedInstances.push(this)
        capturedConfig = config
        const ready = () => config.events?.onReady?.({ target: this })
        const fail = () => config.events?.onError?.({ target: this, data: 150 })
        if (playerFails === 'before-assignment') {
          fail()
          return
        }
        if (playerFails === 'after-ready') {
          Promise.resolve().then(() => {
            ready()
            fail()
          })
          return
        }
        if (deferReady === null) {
          Promise.resolve().then(ready)
        }
        else {
          deferReady = ready
        }
      }

      mute = record('mute')
      setVolume = record('setVolume')
      pauseVideo = record('pauseVideo')
      playVideo = (...args: unknown[]) => {
        companionCalls.push({ method: 'playVideo', args })
        const report = () => this.config.events?.onStateChange?.({ data: 1, target: this })
        if (playbackReports === 'immediate') {
          report()
          return
        }
        if (playbackReports === 'deferred') {
          pendingPlaybackReports.push(report)
        }
      }

      destroy = (...args: unknown[]) => {
        this.destroyCalls += 1
        companionCalls.push({ method: 'destroy', args })
      }

      cueVideoById = (...args: unknown[]) => {
        companionCalls.push({ method: 'cueVideoById', args })
      }

      seekTo = (seconds: number, allow: boolean) => {
        this.currentTime = seconds
        companionCalls.push({ method: 'seekTo', args: [seconds, allow] })
      }

      getCurrentTime = () => this.currentTime
      getDuration = () => COMPANION_FAKE_DURATION
      getVolume = () => 0
      isMuted = () => true
      getVideoData = () => ({ video_id: reportedVideoId ?? this.config.videoId })
    },
  }
})

function calls(method: string) {
  return companionCalls.filter(entry => entry.method === method)
}

/**
 * What the corner is doing right now.
 *
 * Three states, not two. `absent` is a companion that never became available —
 * removed from the DOM entirely, because the corner is a lit frame and an empty
 * one on a projector reads as a broken slide. `hidden` is the pre-arm and play
 * lead: rendered, laid out and composited, but transparent and untouchable, so
 * the reveal is a hard cut rather than a first paint. `revealed` is on stage.
 */
function companionState(wrapper: any): 'absent' | 'hidden' | 'revealed' {
  const corner = wrapper.find('[data-director-finale-companion]')
  if (!corner.exists()) {
    return 'absent'
  }
  // A rendered-but-hidden corner must never fall back to `display: none`: that
  // is exactly the composite the play lead is too short to pay for.
  expect(corner.attributes('style') ?? '').not.toContain('display: none')
  return corner.classes().includes('wc-dcf-companion--hidden') ? 'hidden' : 'revealed'
}

const STAGE_STUBS = {
  TheaterExperience: { template: '<div class="theater-experience-stub" />' },
  Nameplate: { template: '<div class="nameplate-stub" />' },
  CinematicCaptions: { template: '<div class="captions-stub" />' },
  CinematicTransition: true,
  WolvesDirectorFinale: { template: '<div class="director-finale-stub" />' },
}

/** Errors Vue routed out of the component, including from its async watcher. */
const handledErrors: unknown[] = []

async function mountFinaleAt(time: number) {
  const store = useCinematicStore()
  store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
  store.enterCinematic()
  store.updateTime(time, 424, time)
  const wrapper = mount(WolvesDirectorFinale, {
    global: {
      config: { errorHandler: (error: unknown) => { handledErrors.push(error) } },
      stubs: { WolvesLoreColumn: { props: ['artifactId', 'duration', 'elapsed'], template: '<div class="lore-stub" :data-artifact="artifactId" :data-duration="duration" :data-elapsed="elapsed" />' } },
    },
  })
  await nextTick()
  await flushPromises()
  await nextTick()
  return { store, wrapper }
}

describe('director\'s cut finale composition', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    companionCalls.length = 0
    constructedPlayers = 0
    constructedInstances.length = 0
    capturedConfig = null
    loaderFails = false
    deferReady = null
    playerFails = null
    reportedVideoId = null
    playbackReports = 'immediate'
    pendingPlaybackReports.length = 0
    handledErrors.length = 0
  })

  afterEach(() => {
    useCinematicStore().loadExperience(WOLVES_EXPERIENCE)
  })

  it('renders nothing at all before the pre-arm anchor', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm - 1)
    expect(wrapper.find('[data-director-finale]').exists()).toBe(false)
    expect(constructedPlayers).toBe(0)
  })

  it('mounts, cues, mutes and parks the companion at the pre-arm anchor, still hidden', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm)
    expect(wrapper.find('[data-director-finale]').exists()).toBe(true)
    expect(wrapper.attributes('data-covering')).toBe('false')
    expect(constructedPlayers).toBe(1)
    expect(capturedConfig?.videoId).toBe('PjryN2F6fF0')
    expect(capturedConfig?.playerVars?.mute).toBe(1)
    expect(capturedConfig?.playerVars?.autoplay).toBe(0)
    expect(calls('mute').length).toBeGreaterThan(0)
    expect(calls('cueVideoById')[0]?.args[0]).toMatchObject({ videoId: 'PjryN2F6fF0' })
    expect(calls('pauseVideo').length).toBeGreaterThan(0)
    expect(calls('playVideo')).toHaveLength(0)
    expect(companionState(wrapper)).toBe('hidden')
    // The host has to exist for the player to be built into, and it has to be
    // in a rendered subtree for the embed to warm up behind the frame.
    expect(wrapper.find('[data-director-finale-companion] .wc-dcf-companion-host').exists()).toBe(true)
    expect(wrapper.find('[data-director-finale-companion]').attributes('aria-hidden')).toBe('true')
  })

  it('takes the frame on the finale beat with the Collapse day plate', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_START)
    expect(wrapper.attributes('data-covering')).toBe('true')
    expect(wrapper.find('[data-director-finale-frame]').attributes('style') ?? '').not.toContain('display: none')
    expect(wrapper.find('[data-director-finale-night]').attributes('data-night-opacity')).toBe('0.000')
  })

  it('dissolves the frame up over the cover beats instead of cutting to it', async () => {
    // The hard cut here was most of "the finale is jarring": the entire stage
    // was replaced between two frames, with nothing carrying across. The
    // dissolve is clock-derived like every other beat, so a backward seek gives
    // the stage back rather than stranding a finished animation on it.
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_START)
    const opacity = () => Number(wrapper.find('[data-director-finale-frame]').attributes('data-cover-opacity'))
    expect(opacity()).toBe(0)

    const half = DIRECTORS_CUT_FINALE_START + DIRECTORS_CUT_COVER_FADE_SECONDS / 2
    store.updateTime(half, 424, half)
    await nextTick()
    expect(opacity()).toBeCloseTo(0.5, 2)

    const done = DIRECTORS_CUT_FINALE_START + DIRECTORS_CUT_COVER_FADE_SECONDS
    store.updateTime(done, 424, done)
    await nextTick()
    expect(opacity()).toBe(1)

    // …and it is still 1 for the rest of the show, not a pulse.
    store.updateTime(420, 424, 420)
    await nextTick()
    expect(opacity()).toBe(1)
  })

  it('carries the opaque backdrop on the dissolving frame, not on the cover class', () => {
    // If the black lives on `.wc-dcf--covering` it arrives a frame ahead of the
    // picture, which reads as a blackout rather than as a transition.
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/wolves/cinematic/WolvesDirectorFinale.vue'),
      'utf8',
    )
    expect(source).toMatch(/\.wc-dcf-frame\s*\{[^}]*background: var\(--wc-bg\)/)
    expect(source).not.toMatch(/\.wc-dcf--covering\s*\{[^}]*background: var\(--wc-bg\)/)
  })

  it('turns the Collapse plate to night by the Become Legend cue', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.collapseNightEnd)
    expect(wrapper.find('[data-director-finale-night]').attributes('data-night-opacity')).toBe('1.000')
  })

  it('carries the missing-scientist bulletin on the lore column\'s own paging window', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_START + 5)
    const bulletin = wrapper.find('[data-director-finale-bulletin] .lore-stub')
    expect(bulletin.exists()).toBe(true)
    expect(bulletin.attributes('data-artifact')).toBe(DIRECTORS_CUT_BULLETIN_ARTIFACT_ID)
    // The paging window is the *lore slot's* window, not the finale's shorter
    // display window. The theater's own column is showing this record with
    // those numbers right up to the cover, so anything else re-paginates the
    // record at the handover and jumps the page in front of the room.
    expect(Number(bulletin.attributes('data-duration'))).toBeCloseTo(
      DIRECTORS_CUT_BULLETIN_END - DIRECTORS_CUT_BULLETIN_START,
      3,
    )
    expect(Number(bulletin.attributes('data-elapsed'))).toBeCloseTo(
      DIRECTORS_CUT_FINALE_START + 5 - DIRECTORS_CUT_BULLETIN_START,
      3,
    )
  })

  it('hands the bulletin over on the exact page the lore column was already showing', async () => {
    const record = loadAllLoreRecords().find(entry => entry.id === DIRECTORS_CUT_BULLETIN_ARTIFACT_ID)!
    const pages = loreProsePages(record.body)
    const slotDuration = DIRECTORS_CUT_BULLETIN_END - DIRECTORS_CUT_BULLETIN_START
    // The lore column paginates from `(duration, elapsed)` alone, so "no
    // re-page" is the claim that the finale hands it the same pair the theater
    // column had a tick earlier — checked at the handover beat itself.
    const handover = DIRECTORS_CUT_FINALE_ANCHORS.coverStart
    const { wrapper } = await mountFinaleAt(handover)
    const bulletin = wrapper.find('[data-director-finale-bulletin] .lore-stub')
    const finalePage = pickPageIndexForElapsed(
      pages,
      Number(bulletin.attributes('data-elapsed')),
      Number(bulletin.attributes('data-duration')),
    )
    const theaterPage = pickPageIndexForElapsed(pages, handover - DIRECTORS_CUT_BULLETIN_START, slotDuration)
    expect(finalePage).toBe(theaterPage)
  })

  it('clears the bulletin a bar before the quote, not in the same repaint', async () => {
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd - 0.01)
    expect(wrapper.find('[data-director-finale-bulletin]').exists()).toBe(true)

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd, 424, DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd)
    await nextTick()
    expect(wrapper.find('[data-director-finale-bulletin]').exists()).toBe(false)

    // …and the frame is still empty when the first clause arrives, rather than
    // the clause landing on top of a dossier that is still leaving.
    const beforeClause = DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart - 0.01
    store.updateTime(beforeClause, 424, beforeClause)
    await nextTick()
    expect(wrapper.find('[data-director-finale-bulletin]').exists()).toBe(false)
    expect(wrapper.find('[data-director-finale-clause="extinction"]').exists()).toBe(false)
  })

  it('starts the companion rolling hidden, then reveals it on the impact beat', async () => {
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart)
    expect(calls('playVideo').length).toBeGreaterThan(0)
    expect(companionState(wrapper)).toBe('hidden')

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal, 424, DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    await nextTick()
    expect(companionState(wrapper)).toBe('revealed')
  })

  it('keeps a cold fast-forward hidden until the companion player is ready', async () => {
    deferReady = () => {}
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    const release = deferReady

    expect(companionState(wrapper)).toBe('hidden')

    release?.()
    await flushPromises()
    await nextTick()

    expect(companionState(wrapper)).toBe('revealed')
    const seeks = calls('seekTo')
    expect(seeks[seeks.length - 1]?.args[0]).toBeCloseTo(
      companionSourceTimeAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal),
      3,
    )
  })

  it('reveals only once the aligned player has reported playback, never on the seek alone', async () => {
    // A built, cued player is not a playing one. The IFrame API documents that
    // a cued video is not even requested until `playVideo()`/`seekTo()`, so
    // "the clock is past the reveal beat and a player exists" is not evidence
    // that there is a decoded frame to cut to — and the corner is a lit box.
    playbackReports = 'deferred'
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    expect(calls('seekTo').length).toBeGreaterThan(0)
    expect(calls('playVideo').length).toBeGreaterThan(0)
    expect(companionState(wrapper)).toBe('hidden')

    await reportPlayback()
    expect(companionState(wrapper)).toBe('revealed')
  })

  it('never shows the rebuffer a drift correction costs', async () => {
    playbackReports = 'deferred'
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    await reportPlayback()
    expect(companionState(wrapper)).toBe('revealed')

    // The fake's clock only moves when it is seeked, so this tick is material
    // drift and must be corrected — and the correction costs a rebuffer. A
    // corner left on stage across it shows the room a spinner on a black box.
    const drifted = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal + 6
    store.updateTime(drifted, 424, drifted)
    await nextTick()
    expect(calls('seekTo').length).toBeGreaterThan(1)
    expect(companionState(wrapper)).toBe('hidden')

    await reportPlayback()
    expect(companionState(wrapper)).toBe('revealed')
  })

  it('gives up on a companion that never reports playback, without lighting an empty corner', async () => {
    playbackReports = 'never'
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    expect(calls('playVideo').length).toBeGreaterThan(0)
    expect(companionState(wrapper)).toBe('hidden')

    // Still only hidden right up to the source's own last cut: a late start is
    // worth showing, and the deadline is that measured frame.
    const nearly = DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S - 0.05
    store.updateTime(nearly, 424, nearly)
    await nextTick()
    expect(companionState(wrapper)).toBe('hidden')

    // Past it there is nothing left of the edit to reveal, so the corner is
    // removed rather than held as a transparent box that might still light up
    // on a black frame halfway through the closing beat.
    const past = DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S + 0.05
    store.updateTime(past, 424, past)
    await nextTick()
    expect(companionState(wrapper)).toBe('absent')

    companionCalls.length = 0
    const later = DIRECTORS_CUT_FINALE_ANCHORS.companionEnd - 1
    store.updateTime(later, 424, later)
    await nextTick()
    expect(calls('seekTo')).toHaveLength(0)
    expect(calls('playVideo')).toHaveLength(0)
    expect(handledErrors).toEqual([])
  })

  it('does not pop the corner in late after the readiness deadline', async () => {
    deferReady = () => {}
    const late = DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S + 0.05
    const { wrapper } = await mountFinaleAt(late)
    const release = deferReady

    expect(companionState(wrapper)).toBe('hidden')
    release?.()
    await flushPromises()
    await nextTick()

    expect(companionState(wrapper)).toBe('absent')
    expect(calls('playVideo')).toHaveLength(0)
    expect(handledErrors).toEqual([])
  })

  it('re-arms a readiness-lost companion after a backward seek', async () => {
    playbackReports = 'never'
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    const late = DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S + 0.05
    store.updateTime(late, 424, late)
    await nextTick()
    expect(companionState(wrapper)).toBe('absent')

    playbackReports = 'immediate'
    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal, 424, DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    await nextTick()
    await flushPromises()
    await nextTick()

    expect(companionState(wrapper)).toBe('revealed')
    expect(constructedPlayers).toBe(2)
    expect(calls('playVideo').length).toBeGreaterThan(0)
    expect(handledErrors).toEqual([])
  })

  it('never reveals a player holding the wrong media id', async () => {
    reportedVideoId = 'wrong-upload'
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)

    expect(companionState(wrapper)).toBe('absent')
    expect(constructedInstances[0]?.destroyCalls).toBe(1)
    expect(calls('playVideo')).toHaveLength(0)
    expect(reportedVideoId).not.toBe(DIRECTORS_CUT_COMPANION_VIDEO_ID)
    expect(handledErrors).toEqual([])
  })

  it('keeps a corner that has already played through a late rebuffer', async () => {
    // The readiness deadline governs the *first* alignment only. Once the
    // corner has genuinely played, a later stall is a hidden corner that can
    // still come back — not a reason to delete a working embed mid-window.
    playbackReports = 'deferred'
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    await reportPlayback()
    expect(companionState(wrapper)).toBe('revealed')

    const late = DIRECTORS_CUT_COMPANION_READINESS_DEADLINE_S + 2
    store.updateTime(late, 424, late)
    await nextTick()
    expect(companionState(wrapper)).toBe('hidden')

    await reportPlayback()
    expect(companionState(wrapper)).toBe('revealed')
  })

  // The hidden play lead is one measured beat — 0.395 s. `display: none` gives
  // a browser licence to skip layout, paint and compositing for the subtree, so
  // a corner hidden that way can be asked for its first composite at the exact
  // frame it is meant to be already playing. It stays rendered instead, and the
  // same DOM node carries through the reveal without re-creating the embed.
  it('keeps the corner rendered and composited across the whole hidden lead', async () => {
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm)
    const hostBeforeReveal = wrapper.find('[data-director-finale-companion] .wc-dcf-companion-host').element

    for (const time of [
      DIRECTORS_CUT_FINALE_ANCHORS.coverStart,
      DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart,
      DIRECTORS_CUT_FINALE_ANCHORS.companionReveal - 0.001,
    ]) {
      store.updateTime(time, 424, time)
      await nextTick()
      expect(companionState(wrapper)).toBe('hidden')
      expect(wrapper.find('[data-director-finale-companion]').element).toBeTruthy()
    }

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal, 424, DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    await nextTick()
    expect(companionState(wrapper)).toBe('revealed')
    // Same host, same player: the reveal is a visibility change, not a remount.
    expect(wrapper.find('[data-director-finale-companion] .wc-dcf-companion-host').element).toBe(hostBeforeReveal)
    expect(constructedPlayers).toBe(1)
  })

  it('seeks the companion to its measured source frame, never to zero', async () => {
    await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart)
    const seeks = calls('seekTo').map(entry => entry.args[0] as number)
    expect(seeks.length).toBeGreaterThan(0)
    expect(seeks.every(seconds => seconds > 240)).toBe(true)
  })

  it('parks the companion once its window closes', async () => {
    const { store } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    companionCalls.length = 0
    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.companionEnd, 424, DIRECTORS_CUT_FINALE_ANCHORS.companionEnd)
    await nextTick()
    expect(calls('pauseVideo').length).toBeGreaterThan(0)
  })

  it('publishes live companion evidence for the browser harness to read', async () => {
    // The harness used to read the corner's source second out of its own mock's
    // call log — bookkeeping, not evidence. Under real media there is no mock,
    // so the one mode that exists to prove real playback proved nothing about
    // it. The hook has to answer from the player itself, so that both modes
    // interrogate the same surface and neither can pass on a stale record.
    const { store } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    const probe = (window as any).__wolvesFinaleCompanion
    expect(typeof probe).toBe('function')

    const now = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal
    const reading = probe()
    expect(reading.built).toBe(true)
    expect(reading.rendered).toBe(true)
    expect(reading.visible).toBe(true)
    expect(reading.muted).toBe(true)
    expect(reading.volume).toBe(0)
    expect(reading.duration).toBe(COMPANION_FAKE_DURATION)
    expect(reading.soundtrackTime).toBeCloseTo(now, 6)
    expect(reading.sourceTime).toBeCloseTo(companionSourceTimeAt(now), 6)
    expect(reading.expectedSourceTime).toBeCloseTo(companionSourceTimeAt(now), 6)

    // Live, not a snapshot taken at mount: advancing the show clock has to move
    // what the hook reports, or the harness is asserting against a fossil.
    const later = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal + 4
    store.updateTime(later, 424, later)
    await nextTick()
    expect(probe().expectedSourceTime).toBeCloseTo(companionSourceTimeAt(later), 6)
    expect(probe().soundtrackTime).toBeCloseTo(later, 6)
  })

  it('takes its evidence hook down with the finale', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    expect((window as any).__wolvesFinaleCompanion).toBeTypeOf('function')
    wrapper.unmount()
    await flushPromises()
    expect((window as any).__wolvesFinaleCompanion).toBeUndefined()
  })

  it('corrects material drift in both directions, and only material drift', async () => {
    const { store } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    const lastSeek = () => {
      const seeks = calls('seekTo')
      return seeks[seeks.length - 1]?.args[0] as number | undefined
    }

    // A frozen companion clock is exactly what a stalled embed looks like: the
    // show moves on, the companion does not, and the correction has to fire.
    const forward = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal + 6
    store.updateTime(forward, 424, forward)
    await nextTick()
    expect(lastSeek()).toBeCloseTo(companionSourceTimeAt(forward), 3)

    // A backward seek is the same correction with the sign flipped. Rate
    // limiting on a raw difference (rather than its magnitude) would silently
    // refuse to correct it and leave the corner ahead of the music.
    const backward = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal + 1
    store.updateTime(backward, 424, backward)
    await nextTick()
    expect(lastSeek()).toBeCloseTo(companionSourceTimeAt(backward), 3)

    // Sub-tolerance drift costs a rebuffer to fix and is invisible from the
    // back row, so it must not produce a seek at all.
    const seeksBefore = calls('seekTo').length
    const nudge = backward + DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S / 2
    store.updateTime(nudge, 424, nudge)
    await nextTick()
    expect(calls('seekTo').length).toBe(seeksBefore)
  })

  it('corrects a backward transport seek immediately, inside the suppression interval', async () => {
    const { store } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    const lastSeek = () => {
      const seeks = calls('seekTo')
      return seeks[seeks.length - 1]?.args[0] as number | undefined
    }

    const forward = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal + 6
    store.updateTime(forward, 424, forward)
    await nextTick()
    const seeksAfterForward = calls('seekTo').length

    // Half a suppression interval later on the *show* clock, but backwards:
    // the operator seeked. A limiter written on the magnitude of the gap reads
    // this as "we corrected a moment ago" and refuses, which strands the
    // corner ahead of the music for the rest of the interval — and the corner
    // is the one surface whose whole point is landing on a measured beat.
    const backward = forward - DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S / 2
    expect(Math.abs(backward - forward)).toBeLessThan(DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S)
    expect(Math.abs(companionSourceTimeAt(backward) - companionSourceTimeAt(forward)))
      .toBeGreaterThan(DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S)
    store.updateTime(backward, 424, backward)
    await nextTick()
    expect(calls('seekTo').length).toBe(seeksAfterForward + 1)
    expect(lastSeek()).toBeCloseTo(companionSourceTimeAt(backward), 3)
  })

  it('rate limits drift corrections to one per suppression interval', async () => {
    const { store } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    const reveal = DIRECTORS_CUT_FINALE_ANCHORS.companionReveal
    const seekTargets = () => calls('seekTo').map(entry => entry.args[0] as number)
    const advance = async (offset: number) => {
      const now = reveal + offset
      store.updateTime(now, 424, now)
      await nextTick()
      return now
    }

    // The fake's own clock only moves when it is seeked, so from here every
    // tick is material drift — a stalled embed, the case the limiter exists
    // for. Without the interval guard each of these polls costs a rebuffer and
    // the corner becomes a stutter loop in front of the room.
    companionCalls.length = 0
    const firstCorrection = await advance(DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S + 0.1)
    expect(seekTargets()).toHaveLength(1)
    expect(seekTargets()[0]).toBeCloseTo(companionSourceTimeAt(firstCorrection), 3)

    // Three more polls, each drifting well past tolerance, all inside the same
    // suppression interval: none of them may seek.
    for (const offset of [0.7, 1.4, DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S - 0.1]) {
      const now = await advance(DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S + 0.1 + offset)
      expect(Math.abs(companionSourceTimeAt(now) - companionSourceTimeAt(firstCorrection)))
        .toBeGreaterThan(DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S)
      expect(seekTargets()).toHaveLength(1)
    }

    // Once the interval has elapsed the next material drift is corrected again.
    const secondCorrection = await advance(2 * DIRECTORS_CUT_COMPANION_DRIFT_INTERVAL_S + 0.2)
    expect(seekTargets()).toHaveLength(2)
    expect(seekTargets()[1]).toBeCloseTo(companionSourceTimeAt(secondCorrection), 3)
  })

  it('shows the two clauses one at a time, never together', async () => {
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart)
    expect(wrapper.find('[data-director-finale-clause="extinction"]').text()).toBe('Extinction is the rule.')
    expect(wrapper.find('[data-director-finale-clause="survival"]').exists()).toBe(false)

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.extinctionEnd, 424, DIRECTORS_CUT_FINALE_ANCHORS.extinctionEnd)
    await nextTick()
    expect(wrapper.find('[data-director-finale-clause="extinction"]').exists()).toBe(false)
    expect(wrapper.find('[data-director-finale-clause="survival"]').exists()).toBe(false)

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.survivalStart, 424, DIRECTORS_CUT_FINALE_ANCHORS.survivalStart)
    await nextTick()
    expect(wrapper.find('[data-director-finale-clause="extinction"]').exists()).toBe(false)
    expect(wrapper.find('[data-director-finale-clause="survival"]').text()).toBe('Survival is the exception.')
    // A memoised REJECTED build is re-awaited by every clock tick, so the
    // failure repeats for the whole finale instead of degrading once.
    expect(handledErrors).toEqual([])
  })

  it('removes the closing clause when terminal black is complete', async () => {
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd - 0.01)
    expect(wrapper.find('[data-director-finale-clause="survival"]').exists()).toBe(true)

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd, 424, DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd)
    await nextTick()
    expect(wrapper.find('[data-director-finale-clause="survival"]').exists()).toBe(false)
  })

  it('publishes the book citation with each clause and never claims Cosmos', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.survivalStart)
    const source = wrapper.find('[data-director-finale-clause="survival"] p').attributes('data-quote-source') ?? ''
    expect(source).toContain('The Varieties of Scientific Experience')
    expect(source).toContain('ch. 3, p. 66')
    expect(source).not.toMatch(/cosmos/i)
  })

  it('runs the clause fade on the derived duration, not a hand-typed CSS time', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart)
    const style = wrapper.find('[data-director-finale-clause="extinction"] p').attributes('style') ?? ''
    expect(style).toContain('--wc-dcf-clause-fade')
    expect(style).toContain(`${DIRECTORS_CUT_EXTINCTION_FADE_SECONDS}s`)
  })

  it('latches the terminal fade once instead of animating from the clock', async () => {
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart - 0.5)
    expect(wrapper.find('[data-director-finale-black]').classes()).not.toContain('wc-dcf-black--fading')

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart, 424, DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart)
    await nextTick()
    expect(wrapper.find('[data-director-finale-black]').classes()).toContain('wc-dcf-black--fading')
  })

  it('completes the fade on Track 0\'s terminal beat, not on a finish that now ends Ghosts', async () => {
    // The fade-complete pin lands on Track 0's clock reaching terminalFadeEnd,
    // authored ahead of the final PRE_END_THRESHOLD_S the transport never
    // publishes — a tick that arrives, not a future one that never does. In the
    // multi-song cut finish() belongs to the end of Ghosts and can no longer
    // stand in for it.
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart)
    expect(wrapper.find('[data-director-finale-black]').classes()).not.toContain('wc-dcf-black--done')
    store.updateTime(
      DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd,
      424,
      DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeEnd,
    )
    await nextTick()
    expect(wrapper.find('[data-director-finale-black]').classes()).toContain('wc-dcf-black--done')
  })

  it('plays the rest of the finale when the shared API loader fails', async () => {
    loaderFails = true
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    expect(wrapper.find('[data-director-finale-frame]').exists()).toBe(true)

    // A rejected memoised build re-thrown on every 100ms clock tick is how a
    // dead script load takes the closing quote down with it. Drive the clock
    // through the rest of the finale and require the quote to still arrive.
    for (const time of [400, 405, DIRECTORS_CUT_FINALE_ANCHORS.extinctionStart, DIRECTORS_CUT_FINALE_ANCHORS.survivalStart]) {
      store.updateTime(time, 424, time)
      await nextTick()
      await Promise.resolve()
    }
    expect(wrapper.find('[data-director-finale-clause="survival"]').text()).toBe('Survival is the exception.')
    // A memoised REJECTED build is re-awaited by every clock tick, so the
    // failure repeats for the whole finale instead of degrading once.
    expect(handledErrors).toEqual([])
  })

  it('paints no corner at all when the companion never became available', async () => {
    loaderFails = true
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    await nextTick()

    // The corner is a lit frame: an opaque black fill, a blue ring and a drop
    // shadow. Rendering an empty one for the whole 17 s reveal window reads
    // from the back row as a broken slide, so an unavailable companion is
    // removed from the DOM — not merely a transparent box with nothing in it.
    expect(companionState(wrapper)).toBe('absent')

    // And it must stay dark for the rest of the window rather than flicker in
    // on the next clock tick.
    for (const time of [DIRECTORS_CUT_FINALE_ANCHORS.companionReveal + 5, DIRECTORS_CUT_FINALE_ANCHORS.companionEnd - 0.1]) {
      store.updateTime(time, 424, time)
      await nextTick()
      await Promise.resolve()
      await nextTick()
      expect(companionState(wrapper)).toBe('absent')
    }
    expect(handledErrors).toEqual([])
    wrapper.unmount()

    // Control at the same anchor with a healthy loader: the corner is on
    // stage, so the assertions above discriminate a dead companion from a
    // corner that is simply never shown.
    loaderFails = false
    const healthy = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    expect(companionState(healthy.wrapper)).toBe('revealed')
    healthy.wrapper.unmount()
  })

  it('destroys a player that fails before the constructor even returns', async () => {
    playerFails = 'before-assignment'
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    await nextTick()

    // `onError` inside `new YT.Player(...)` arrives before the caller holds
    // the instance, but the instance is already real: an iframe, a window
    // message listener and a media element. Discarding it leaks all three.
    expect(constructedPlayers).toBe(1)
    expect(constructedInstances[0]?.destroyCalls).toBe(1)
    expect(companionState(wrapper)).toBe('absent')

    wrapper.unmount()
    await nextTick()
    await Promise.resolve()
    await Promise.resolve()
    expect(constructedInstances[0]?.destroyCalls).toBe(1)
    expect(handledErrors).toEqual([])
  })

  it('clears and disposes a companion that dies after it was handed over', async () => {
    playerFails = 'after-ready'
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    await nextTick()
    await Promise.resolve()
    await nextTick()
    expect(constructedInstances[0]?.destroyCalls).toBe(1)
    expect(companionState(wrapper)).toBe('absent')

    // A dead player must not be driven for the rest of the window, and must
    // not be rebuilt on every tick either.
    companionCalls.length = 0
    for (const time of [DIRECTORS_CUT_FINALE_ANCHORS.companionReveal + 4, DIRECTORS_CUT_FINALE_ANCHORS.companionReveal + 9]) {
      store.updateTime(time, 424, time)
      await nextTick()
      await Promise.resolve()
    }
    expect(constructedPlayers).toBe(1)
    expect(calls('seekTo')).toHaveLength(0)
    expect(calls('playVideo')).toHaveLength(0)
    expect(handledErrors).toEqual([])
  })

  it('destroys the companion exactly once when the finale unmounts', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm)
    expect(constructedPlayers).toBe(1)

    wrapper.unmount()
    await nextTick()
    await Promise.resolve()
    await Promise.resolve()

    // The current player and the memoised build result are the same instance.
    // `YT.Player.destroy()` throws inside the API's own teardown the second
    // time, which on a backward seek is an uncaught error mid-show.
    expect(constructedInstances[0]?.destroyCalls).toBe(1)
    expect(calls('destroy')).toHaveLength(1)
  })

  it('destroys a companion that arrives after the finale was seeked away from', async () => {
    // Hold the build in flight, then unmount, then let the player arrive.
    deferReady = () => {}
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm)
    expect(constructedPlayers).toBe(1)
    const release = deferReady
    wrapper.unmount()
    release?.()
    await nextTick()
    await Promise.resolve()
    await Promise.resolve()
    expect(calls('destroy').length).toBeGreaterThan(0)
    expect(constructedInstances[0]?.destroyCalls).toBe(1)
  })

  it('warms both Collapse plates during the pre-arm window', async () => {
    const requested: string[] = []
    const RealImage = window.Image
    class WarmImage {
      decoding = ''
      #src = ''
      get src(): string {
        return this.#src
      }

      set src(value: string) {
        this.#src = value
        requested.push(value)
      }
    }
    ;(window as any).Image = WarmImage
    try {
      await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPrearm)
    }
    finally {
      ;(window as any).Image = RealImage
    }
    // A `display: none` subtree never fetches its background-image, so without
    // this the day plate would start loading at the instant the finale paints
    // black over the show.
    expect(requested.some(url => url.endsWith('bluefin-collapse-day.webp'))).toBe(true)
    expect(requested.some(url => url.endsWith('bluefin-collapse-night.webp'))).toBe(true)
  })

  it('gives the whole finale back when the transport is seeked before it', async () => {
    const { store, wrapper } = await mountFinaleAt(420)
    expect(wrapper.attributes('data-covering')).toBe('true')
    store.updateTime(120, 424, 120)
    await nextTick()
    expect(wrapper.find('[data-director-finale]').exists()).toBe(false)
  })
})

/**
 * A DOM-less environment resolves no media query and no cascade, so the
 * companion's hiding mechanism and its narrow-viewport treatment are asserted
 * against the component's own stylesheet. `tests/wolves-directors-cut-finale.mjs`
 * measures the resulting bounds in a real browser at both viewports.
 */
describe('director\'s cut finale companion styling', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/components/wolves/cinematic/WolvesDirectorFinale.vue'),
    'utf8',
  )
  const hiddenRule = source.match(/\.wc-dcf-companion--hidden\s*\{[^}]*\}/)?.[0] ?? ''
  const narrowBlock = source.slice(source.indexOf('@media (max-width: 1023px)'))
  const narrowCompanionRule = narrowBlock.match(/\.wc-dcf-companion\s*\{[^}]*\}/)?.[0] ?? ''
  const narrowBulletinRule = narrowBlock.match(/\.wc-dcf-bulletin\s*\{[^}]*\}/)?.[0] ?? ''

  it('hides the warming corner without taking it out of the render tree', () => {
    expect(hiddenRule).toContain('opacity: 0')
    expect(hiddenRule).toContain('pointer-events: none')
    // Either of these would defeat the whole point: a `display: none` subtree
    // may skip layout, paint and compositing, and `visibility: hidden`
    // suppresses paint for the subtree too.
    expect(hiddenRule).not.toContain('display: none')
    expect(hiddenRule).not.toContain('visibility: hidden')
    expect(source).toMatch(/\.wc-dcf-companion\s*\{[^}]*will-change: opacity/)
  })

  it('still re-places the corner on a narrow viewport instead of dropping it', () => {
    expect(narrowCompanionRule).toContain('translateX(-50%)')
    expect(narrowCompanionRule).not.toContain('display: none')
  })

  it('composes the bulletin for a narrow viewport instead of hiding it', () => {
    // Hiding was the easy answer and it silently dropped an authored beat —
    // seven pages of the record the whole finale is about — from every
    // viewport below the theater breakpoint. It gets an explicit composition
    // instead: a full-width band stacked above the companion, sized off the
    // same custom properties the companion band uses so the two can never
    // overlap however the viewport is shaped.
    expect(narrowBulletinRule).not.toContain('display: none')
    expect(narrowBulletinRule).toContain('--wc-dcf-band-height')
    expect(narrowBlock).toMatch(/--wc-dcf-band-height:/)
    expect(narrowCompanionRule).toContain('var(--wc-dcf-band-width)')
  })

  it('derives the clause fade from the anchors rather than hard-coding it', () => {
    const clauseRule = source.match(/\.wc-dcf-clause-text\s*\{[^}]*\}/)?.[0] ?? ''
    expect(clauseRule).toContain('var(--wc-dcf-clause-fade')
  })

  it('sets the closing quote in the prologue\'s type, legibly over artwork', () => {
    // The clause is the prologue's voice arriving at its conclusion, so it is
    // set in the prologue's type rather than a treatment of its own. It shipped
    // as sentence case in a heavy blue neon glow, which read as another show's
    // caption dropped on the last beat.
    const clauseRule = source.match(/\.wc-dcf-clause-text\s*\{[^}]*\}/)?.[0] ?? ''
    const introSource = readFileSync(
      resolve(process.cwd(), 'src/components/wolves/WolvesIntroOverlay.vue'),
      'utf8',
    )
    const introCueRule = introSource.match(/\.wolves-intro-overlay-text\s*\{[^}]*\}/)?.[0] ?? ''
    expect(introCueRule).not.toBe('')

    // Family, weight, case and letter spacing are the prologue cue's, read from
    // the prologue itself so the two cannot drift apart silently.
    for (const declaration of [
      'font-family: var(--wc-font-weyland',
      'font-weight: 400',
      'letter-spacing: 0.05em',
      'text-transform: uppercase',
    ]) {
      expect(introCueRule, `prologue cue lost ${declaration}`).toContain(declaration)
      expect(clauseRule, `clause lost ${declaration}`).toContain(declaration)
    }

    // …and the blue glow is gone.
    expect(clauseRule).not.toMatch(/rgb\(125 211 252/)
    expect(clauseRule).not.toContain('#dbeafe')

    // The prologue cue sits on a black card and needs only a soft shadow. This
    // sits on the Collapse painting, where light-on-mid-grey is the
    // low-contrast defect a projector punishes, so it takes the hard black
    // outline the intro uses for its own type over artwork.
    expect(clauseRule).toContain('-webkit-text-stroke')
    expect(clauseRule).toMatch(/3px 3px 0 #000/)
  })
})

describe('director\'s cut finale chrome suppression', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    useCinematicStore().loadExperience(WOLVES_EXPERIENCE)
  })

  function mountStage() {
    return mount(CinematicStage, { global: { stubs: STAGE_STUBS } })
  }

  it('keeps the surviving chrome up right until the finale beat', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(DIRECTORS_CUT_FINALE_START - 0.01, 424, DIRECTORS_CUT_FINALE_START - 0.01)
    const wrapper = mountStage()
    expect(wrapper.find('.nameplate-stub').exists()).toBe(true)
    expect(wrapper.find('.captions-stub').exists()).toBe(true)
  })

  it('clears the nameplate and captions for the finale', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(DIRECTORS_CUT_FINALE_START, 424, DIRECTORS_CUT_FINALE_START)
    const wrapper = mountStage()
    expect(wrapper.find('.nameplate-stub').exists()).toBe(false)
    expect(wrapper.find('.captions-stub').exists()).toBe(false)
    expect(wrapper.find('.director-finale-stub').exists()).toBe(true)
  })

  it('restores the surviving chrome when the transport is seeked back', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(420, 424, 420)
    const wrapper = mountStage()
    expect(wrapper.find('.nameplate-stub').exists()).toBe(false)

    store.updateTime(100, 424, 100)
    await nextTick()
    expect(wrapper.find('.nameplate-stub').exists()).toBe(true)
    expect(wrapper.find('.captions-stub').exists()).toBe(true)
    expect(wrapper.find('.director-finale-stub').exists()).toBe(false)
  })

  it('leaves the standard show untouched at the same clock', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(420, 424, 420)
    const wrapper = mountStage()
    expect(wrapper.find('.nameplate-stub').exists()).toBe(true)
    expect(wrapper.find('.captions-stub').exists()).toBe(true)
    expect(wrapper.find('.director-finale-stub').exists()).toBe(false)
  })

  it('stops the ordinary grid and its sidecar for the finale, rather than covering a running one', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(DIRECTORS_CUT_FINALE_START, 424, DIRECTORS_CUT_FINALE_START)
    const wrapper = mount(TheaterExperience, {
      global: {
        stubs: {
          WolvesComicReader: { template: '<div class="comic-reader-stub" />' },
          WolvesLoreColumn: { template: '<div class="lore-stub" />' },
        },
      },
    })
    // Covering a still-running slideshow leaves it fetching and decoding
    // full-size photographs, crossfading them, and paging a lore record behind
    // an opaque plate — all of it competing with the companion embed the
    // audience can actually see. The grid is taken down, not painted over.
    //
    // Running it on in a small bottom-left panel through the finale was tried
    // and rejected: beside the Collapse fade and the closing quote it is one
    // moving picture too many, and the deck reads as something that failed to
    // stop rather than something that ended. The pictures finish on this beat
    // and the finale carries the rest of the song by itself.
    expect(wrapper.find('[data-trackzero-grid]').exists()).toBe(false)
    expect(wrapper.find('.comic-reader-stub').exists()).toBe(false)
    expect(wrapper.find('.lore-stub').exists()).toBe(false)
    expect(wrapper.find('[data-trackzero-video-sidecar]').exists()).toBe(false)

    store.updateTime(100, 424, 100)
    await nextTick()
    expect(wrapper.find('[data-trackzero-grid]').exists()).toBe(true)
    expect(wrapper.find('.comic-reader-stub').exists()).toBe(true)
    expect(wrapper.find('.lore-stub').exists()).toBe(true)
  })

  it('leaves the standard show\'s grid mounted at the same clock', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(DIRECTORS_CUT_FINALE_START, 424, DIRECTORS_CUT_FINALE_START)
    const wrapper = mount(TheaterExperience, {
      global: {
        stubs: {
          WolvesComicReader: { template: '<div class="comic-reader-stub" />' },
          WolvesLoreColumn: { template: '<div class="lore-stub" />' },
        },
      },
    })
    expect(wrapper.find('[data-trackzero-grid]').exists()).toBe(true)
    expect(wrapper.find('.comic-reader-stub').exists()).toBe(true)
  })
})
