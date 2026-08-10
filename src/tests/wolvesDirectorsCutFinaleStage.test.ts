import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import CinematicStage from '@/components/wolves/cinematic/CinematicStage.vue'
import TheaterExperience from '@/components/wolves/cinematic/TheaterExperience.vue'
import WolvesDirectorFinale from '@/components/wolves/cinematic/WolvesDirectorFinale.vue'
import { companionSourceTimeAt, DIRECTORS_CUT_COMPANION_DRIFT_TOLERANCE_S, DIRECTORS_CUT_FINALE_ANCHORS } from '@/data/wolves-directors-cut-finale'
import { DIRECTORS_CUT_BULLETIN_ARTIFACT_ID, DIRECTORS_CUT_FINALE_START } from '@/data/wolves-directors-cut-timeline'
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
      currentTime = 0
      constructor(_element: Element, config: Record<string, any>) {
        constructedPlayers += 1
        capturedConfig = config
        const ready = () => config.events?.onReady?.({ target: this })
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
      playVideo = record('playVideo')
      destroy = record('destroy')
      cueVideoById = (...args: unknown[]) => {
        companionCalls.push({ method: 'cueVideoById', args })
      }

      seekTo = (seconds: number, allow: boolean) => {
        this.currentTime = seconds
        companionCalls.push({ method: 'seekTo', args: [seconds, allow] })
      }

      getCurrentTime = () => this.currentTime
    },
  }
})

function calls(method: string) {
  return companionCalls.filter(entry => entry.method === method)
}

const STAGE_STUBS = {
  TheaterExperience: { template: '<div class="theater-experience-stub" />' },
  WolvesOrgAds: { template: '<div class="org-ads-stub" />' },
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
  await Promise.resolve()
  await nextTick()
  return { store, wrapper }
}

describe('director\'s cut finale composition', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    companionCalls.length = 0
    constructedPlayers = 0
    capturedConfig = null
    loaderFails = false
    deferReady = null
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
    expect(wrapper.find('[data-director-finale-companion]').attributes('style')).toContain('display: none')
  })

  it('takes the frame on the finale beat with the Collapse day plate', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_START)
    expect(wrapper.attributes('data-covering')).toBe('true')
    expect(wrapper.find('[data-director-finale-frame]').attributes('style') ?? '').not.toContain('display: none')
    expect(wrapper.find('[data-director-finale-night]').attributes('data-night-opacity')).toBe('0.000')
  })

  it('turns the Collapse plate to night by the Become Legend cue', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.collapseNightEnd)
    expect(wrapper.find('[data-director-finale-night]').attributes('data-night-opacity')).toBe('1.000')
  })

  it('carries the missing-scientist bulletin on its own authored window', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_START + 5)
    const bulletin = wrapper.find('[data-director-finale-bulletin] .lore-stub')
    expect(bulletin.exists()).toBe(true)
    expect(bulletin.attributes('data-artifact')).toBe(DIRECTORS_CUT_BULLETIN_ARTIFACT_ID)
    expect(Number(bulletin.attributes('data-duration'))).toBeCloseTo(
      DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd - DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart,
      3,
    )
    expect(Number(bulletin.attributes('data-elapsed'))).toBeCloseTo(
      DIRECTORS_CUT_FINALE_START + 5 - DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart,
      3,
    )
  })

  it('clears the bulletin on the Become Legend cue', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd)
    expect(wrapper.find('[data-director-finale-bulletin]').exists()).toBe(false)
  })

  it('starts the companion rolling hidden, then reveals it on the impact beat', async () => {
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.companionPlayStart)
    expect(calls('playVideo').length).toBeGreaterThan(0)
    expect(wrapper.find('[data-director-finale-companion]').attributes('style')).toContain('display: none')

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.companionReveal, 424, DIRECTORS_CUT_FINALE_ANCHORS.companionReveal)
    await nextTick()
    expect(wrapper.find('[data-director-finale-companion]').attributes('style') ?? '').not.toContain('display: none')
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

  it('publishes the book citation with each clause and never claims Cosmos', async () => {
    const { wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.survivalStart)
    const source = wrapper.find('[data-director-finale-clause="survival"] p').attributes('data-quote-source') ?? ''
    expect(source).toContain('The Varieties of Scientific Experience')
    expect(source).toContain('ch. 3, p. 66')
    expect(source).not.toMatch(/cosmos/i)
  })

  it('latches the terminal fade once instead of animating from the clock', async () => {
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart - 0.5)
    expect(wrapper.find('[data-director-finale-black]').classes()).not.toContain('wc-dcf-black--fading')

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart, 424, DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart)
    await nextTick()
    expect(wrapper.find('[data-director-finale-black]').classes()).toContain('wc-dcf-black--fading')
  })

  it('completes the fade from the finished state, not from a future tick', async () => {
    const { store, wrapper } = await mountFinaleAt(DIRECTORS_CUT_FINALE_ANCHORS.terminalFadeStart)
    expect(wrapper.find('[data-director-finale-black]').classes()).not.toContain('wc-dcf-black--done')
    store.finish()
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

  it('keeps every plate up right until the finale beat', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(DIRECTORS_CUT_FINALE_START - 0.01, 424, DIRECTORS_CUT_FINALE_START - 0.01)
    const wrapper = mountStage()
    expect(wrapper.find('.nameplate-stub').exists()).toBe(true)
    expect(wrapper.find('.org-ads-stub').exists()).toBe(true)
    expect(wrapper.find('.captions-stub').exists()).toBe(true)
  })

  it('clears the nameplate, organization ads and captions for the finale', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(DIRECTORS_CUT_FINALE_START, 424, DIRECTORS_CUT_FINALE_START)
    const wrapper = mountStage()
    expect(wrapper.find('.nameplate-stub').exists()).toBe(false)
    expect(wrapper.find('.org-ads-stub').exists()).toBe(false)
    expect(wrapper.find('.captions-stub').exists()).toBe(false)
    expect(wrapper.find('.director-finale-stub').exists()).toBe(true)
  })

  it('restores every plate when the transport is seeked back', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(420, 424, 420)
    const wrapper = mountStage()
    expect(wrapper.find('.nameplate-stub').exists()).toBe(false)

    store.updateTime(100, 424, 100)
    await nextTick()
    expect(wrapper.find('.nameplate-stub').exists()).toBe(true)
    expect(wrapper.find('.org-ads-stub').exists()).toBe(true)
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
    expect(wrapper.find('.org-ads-stub').exists()).toBe(true)
    expect(wrapper.find('.captions-stub').exists()).toBe(true)
    expect(wrapper.find('.director-finale-stub').exists()).toBe(false)
  })

  it('hides the ordinary theater grid and its sidecar for the finale only', async () => {
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
    const grid = wrapper.find('[data-trackzero-grid]')
    expect(grid.exists()).toBe(true)
    expect(grid.attributes('style')).toContain('display: none')
    expect(wrapper.find('[data-trackzero-video-sidecar]').exists()).toBe(false)

    store.updateTime(100, 424, 100)
    await nextTick()
    expect(wrapper.find('[data-trackzero-grid]').attributes('style') ?? '').not.toContain('display: none')
  })
})
