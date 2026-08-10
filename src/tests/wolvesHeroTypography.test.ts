import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import TheaterExperience from '@/components/wolves/cinematic/TheaterExperience.vue'
import { DIRECTORS_CUT_FINALE_ANCHORS } from '@/data/wolves-directors-cut-finale'
import {
  DIRECTORS_CUT_BULLETIN_ARTIFACT_ID,
  getDirectorsCutNarrativeSlotForTime,
} from '@/data/wolves-directors-cut-timeline'
import { getNarrativeSlotForTime } from '@/data/wolves-narrative-timeline'
import { TRACK_ZERO_SECTIONS } from '@/data/wolves-track-zero-beats'
import { useCinematicStore, WOLVES_DIRECTORS_CUT_EXPERIENCE, WOLVES_EXPERIENCE } from '@/stores/cinematic'

describe('wolves hero typography timeline', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  async function renderAt(nativeTime: number) {
    const store = useCinematicStore()
    store.segmentIndex = 0
    store.updateTime(nativeTime, 425, nativeTime)
    const wrapper = mount(TheaterExperience, {
      global: {
        stubs: {
          WolvesComicReader: true,
          WolvesLoreColumn: true,
        },
      },
    })
    await nextTick()
    return wrapper
  }

  it.each([
    [405, 'legend', 'You have ascended ...'],
    [TRACK_ZERO_SECTIONS.finaleStart, 'legend', 'Become Legend'],
    [425, 'legend', 'Become Legend'],
  ])('renders the exact authored cue at %s seconds', async (time, mode, text) => {
    const wrapper = await renderAt(Number(time))
    expect(wrapper.get(`.wc-thesis--${mode}`).text()).toContain(text)
  })

  it('does not apply the back-treatment to the legend cues', async () => {
    const legend = await renderAt(TRACK_ZERO_SECTIONS.finaleStart)
    expect(legend.get('.wc-thesis').classes()).not.toContain('wc-thesis--welcome-back')
  })

  it.each([344.999, 345, 347.75, 350.5, 359, 365, 404.999, 425.001])(
    'does not render readable hero text outside authored cue windows at %s',
    async (time) => {
      const wrapper = await renderAt(time)
      expect(wrapper.find('.wc-thesis-text').exists()).toBe(false)
    },
  )
})

describe('wolves track zero video sidecar', () => {
  const EXPECTED_VIDEO_IDS = [
    'xu_yE8h3jT8',
    'PjryN2F6fF0',
    'jRXB67fcXZA',
    'tcj7O-hsCN0',
    '-lo2IXn9RK4',
    '_4SQ2mWxnEc',
    'bCA6l-VlpAY',
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    // happy-dom's real window instance (not the Vitest global proxy) drives
    // matchMedia, so the viewport must be restored through its own API too.
    ;(window as any).happyDOM.setViewport({ width: 1024 })
    vi.restoreAllMocks()
  })

  async function renderTrackZeroAt(viewportWidth: number, segmentIndex = 0) {
    ;(window as any).happyDOM.setViewport({ width: viewportWidth })
    const store = useCinematicStore()
    store.enterCinematic()
    store.segmentIndex = segmentIndex
    store.updateTime(10, 425, 10)
    const wrapper = mount(TheaterExperience, {
      global: {
        stubs: {
          WolvesComicReader: true,
          WolvesLoreColumn: true,
        },
      },
    })
    await nextTick()
    return wrapper
  }

  it('mounts a chrome-masked, static, titled, muted, autoplaying, looping, controls-free 16:9 iframe with the exact ordered video IDs on desktop Track 0', async () => {
    vi.useFakeTimers()
    const wrapper = await renderTrackZeroAt(1280)
    await vi.advanceTimersByTimeAsync(1100)

    const sidecar = wrapper.find('[data-trackzero-video-sidecar]')
    expect(sidecar.exists()).toBe(true)

    const iframe = sidecar.get('iframe')
    const src = new URL(iframe.attributes('src') ?? '')

    expect(src.origin + src.pathname).toBe(`https://www.youtube.com/embed/${EXPECTED_VIDEO_IDS[0]}`)
    expect(src.searchParams.get('autoplay')).toBe('1')
    expect(src.searchParams.get('mute')).toBe('1')
    expect(src.searchParams.get('loop')).toBe('1')
    expect(src.searchParams.get('index')).toBe('0')
    expect(src.searchParams.get('controls')).toBe('0')
    expect(src.searchParams.get('cc_load_policy')).toBe('0')
    expect(src.searchParams.get('disablekb')).toBe('1')
    expect(src.searchParams.get('playsinline')).toBe('1')
    expect(src.searchParams.get('rel')).toBe('0')
    expect(src.searchParams.get('iv_load_policy')).toBe('3')
    expect(src.searchParams.get('fs')).toBe('0')
    expect(src.searchParams.get('origin')).toBe(window.location.origin)
    expect(src.searchParams.get('playlist')?.split(',')).toEqual(EXPECTED_VIDEO_IDS)
    expect(iframe.attributes('title')).toBeTruthy()
    vi.useRealTimers()
  })

  it('builds an embed URL with the supported chrome-reduction parameters', async () => {
    vi.useFakeTimers()
    const wrapper = await renderTrackZeroAt(1280)
    await vi.advanceTimersByTimeAsync(1100)
    const iframe = wrapper.get('iframe')
    const src = new URL(iframe.attributes('src') ?? '')

    expect(src.searchParams.get('controls')).toBe('0')
    expect(src.searchParams.get('cc_load_policy')).toBe('0')
    expect(src.searchParams.get('iv_load_policy')).toBe('3')
    expect(src.searchParams.get('rel')).toBe('0')
    expect(src.searchParams.get('origin')).toBe(window.location.origin)
    vi.useRealTimers()
  })

  it('renders the sidecar only for Track 0', async () => {
    const wrapper = await renderTrackZeroAt(1280, 1)

    expect(wrapper.find('.wc-trackzero-lore').exists()).toBe(false)
    expect(wrapper.find('[data-trackzero-video-sidecar]').exists()).toBe(false)
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('does not mount the sidecar during the intro phase', async () => {
    vi.useFakeTimers()
    ;(window as any).happyDOM.setViewport({ width: 1280 })
    const store = useCinematicStore()
    store.enterIntro()
    store.updateTime(10, 425, 10)
    const wrapper = mount(TheaterExperience, {
      global: {
        stubs: {
          WolvesComicReader: true,
          WolvesLoreColumn: true,
        },
      },
    })
    await vi.advanceTimersByTimeAsync(1100)

    expect(wrapper.find('[data-trackzero-video-sidecar]').exists()).toBe(false)
    expect(wrapper.find('iframe').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('does not mount or render the iframe beneath 1024px, even for Track 0', async () => {
    const wrapper = await renderTrackZeroAt(900)

    expect(wrapper.find('[data-trackzero-video-sidecar]').exists()).toBe(false)
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('cleans up the desktop media query listener on unmount', async () => {
    const listeners = new Set<() => void>()
    const mediaQueryList = {
      matches: true,
      media: '(min-width: 1024px)',
      addEventListener: vi.fn((_event: string, callback: () => void) => listeners.add(callback)),
      removeEventListener: vi.fn((_event: string, callback: () => void) => listeners.delete(callback)),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQueryList as unknown as MediaQueryList)

    const store = useCinematicStore()
    store.enterCinematic()
    store.segmentIndex = 0
    store.updateTime(10, 425, 10)
    const wrapper = mount(TheaterExperience, {
      global: {
        stubs: {
          WolvesComicReader: true,
          WolvesLoreColumn: true,
        },
      },
    })
    await nextTick()

    expect(mediaQueryList.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    wrapper.unmount()

    expect(mediaQueryList.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})

describe('cinematic wallpaper transitions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function mountTheater() {
    return mount(TheaterExperience, {
      global: {
        stubs: {
          WolvesComicReader: true,
          WolvesLoreColumn: true,
        },
      },
    })
  }

  it('keeps the decorative wallpaper static for back-catalogue albums', async () => {
    const store = useCinematicStore()
    store.loadExperience({
      id: 'album-test',
      title: 'Album Test',
      artwork: 'album.jpg',
      segments: [
        {
          id: 'track-one',
          kind: 'youtube',
          youtubeId: 'track-one',
          chapter: 'Album Test',
          title: 'Track One',
          artist: 'Artist',
          artwork: 'track-one.jpg',
          durationSeconds: 323,
        },
        {
          id: 'track-two',
          kind: 'youtube',
          youtubeId: 'track-two',
          chapter: 'Album Test',
          title: 'Track Two',
          artist: 'Artist',
          artwork: 'track-two.jpg',
          durationSeconds: 280,
        },
      ],
    })
    store.enterCinematic()
    store.jumpToSegment(1)
    store.updateTime(207, 280, 207)
    const wrapper = mountTheater()

    store.updateTime(213, 280, 213)
    await nextTick()

    expect(wrapper.find('.wc-wallpaper-buffer.fading-out').exists()).toBe(false)
    expect(wrapper.find('.wc-wallpaper-buffer.is-transitioning').exists()).toBe(false)
  })

  it('preserves authored wallpaper transitions for Wolves', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_EXPERIENCE)
    store.enterCinematic()
    store.jumpToSegment(1)
    store.updateTime(258, 347, 258)
    const wrapper = mountTheater()

    // One scene per song: the wallpaper changes on the segment boundary, not at
    // a twelfth of overall progress. Advancing inside a song must not swap it.
    store.updateTime(262, 347, 262)
    await nextTick()

    expect(wrapper.find('.wc-wallpaper-buffer.fading-out').exists()).toBe(false)
    expect(wrapper.find('.wc-wallpaper-buffer.is-transitioning').exists()).toBe(false)

    store.jumpToSegment(2)
    store.updateTime(0, 347, 0)
    await nextTick()

    expect(wrapper.find('.wc-wallpaper-buffer.fading-out').exists()).toBe(true)
    expect(wrapper.find('.wc-wallpaper-buffer.is-transitioning').exists()).toBe(true)
  })

  it('ramps each song from full day to full night exactly once', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_EXPERIENCE)
    store.enterCinematic()
    store.jumpToSegment(0)
    store.updateTime(0, 400, 0)
    const wrapper = mountTheater()
    await nextTick()

    const nightOpacityAt = async (elapsed: number) => {
      store.updateTime(elapsed, 400, elapsed)
      await nextTick()
      const night = wrapper.find('[data-wallpaper-night]')
      return Number.parseFloat((night.attributes('style') ?? '').match(/opacity:\s*([\d.]+)/)?.[1] ?? 'NaN')
    }

    // Monotonic dawn-to-dusk across the song. The old sine returned to day at
    // the end of every slot, which read as a pulse rather than as nightfall.
    const opening = await nightOpacityAt(0)
    const middle = await nightOpacityAt(200)
    const close = await nightOpacityAt(400)

    expect(opening).toBeCloseTo(0, 5)
    expect(middle).toBeGreaterThan(opening)
    expect(close).toBeGreaterThan(middle)
    expect(close).toBeCloseTo(1, 5)
  })
})

describe('theater experience wolves-experience prop wiring', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    // `activeSegments` is module-level state (see cinematic.ts); restore the
    // standard show so a Director's Cut test cannot leak into the next one.
    useCinematicStore().loadExperience(WOLVES_EXPERIENCE)
  })

  const WolvesComicReaderProbe = {
    props: {
      wolvesExperience: { type: Boolean, default: false },
      experienceId: { type: String, default: '' },
    },
    template: '<div class="wolves-comic-reader-probe" :data-wolves-experience="wolvesExperience" :data-experience-id="experienceId" />',
  }

  function mountTheater() {
    return mount(TheaterExperience, {
      global: {
        stubs: {
          WolvesComicReader: WolvesComicReaderProbe,
          WolvesLoreColumn: true,
        },
      },
    })
  }

  // The template used to carry a second, separate `experienceId === WOLVES_EXPERIENCE.id`
  // check inline for this one prop, duplicating (and briefly diverging from) the
  // component's own `isWolvesExperience` computed. That duplicate read the Director's
  // Cut as a generic album — losing the beat-synced `timelineSlides` gallery for
  // generic back-catalogue photos — even after the computed itself was fixed.
  it('passes wolves-experience true for the standard show', () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_EXPERIENCE)
    store.enterCinematic()

    const probe = mountTheater().get('.wolves-comic-reader-probe')

    expect(probe.attributes('data-wolves-experience')).toBe('true')
    expect(probe.attributes('data-experience-id')).toBe(WOLVES_EXPERIENCE.id)
  })

  it('passes wolves-experience true for the Director\'s Cut, not the generic default', () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()

    const probe = mountTheater().get('.wolves-comic-reader-probe')

    expect(probe.attributes('data-wolves-experience')).toBe('true')
    expect(probe.attributes('data-experience-id')).toBe(WOLVES_DIRECTORS_CUT_EXPERIENCE.id)
  })

  it('passes wolves-experience false for a generic back-catalogue album', () => {
    const store = useCinematicStore()
    store.loadExperience({
      id: 'album-test',
      title: 'Album Test',
      artwork: 'album.jpg',
      segments: [{
        id: 'track-one',
        kind: 'youtube',
        youtubeId: 'track-one',
        chapter: 'Album Test',
        title: 'Track One',
        artist: 'Artist',
        artwork: 'track.jpg',
        durationSeconds: 200,
      }],
    })
    store.enterCinematic()

    const probe = mountTheater().get('.wolves-comic-reader-probe')

    expect(probe.attributes('data-wolves-experience')).toBe('false')
    expect(probe.attributes('data-experience-id')).toBe('album-test')
  })
})

describe('theater experience lore column narrative timeline wiring', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    // `activeSegments` is module-level state (see cinematic.ts); restore the
    // standard show so a Director's Cut test cannot leak into the next one.
    useCinematicStore().loadExperience(WOLVES_EXPERIENCE)
  })

  const WolvesLoreColumnProbe = {
    props: {
      artifactId: { type: String, default: '' },
    },
    template: '<div class="wolves-lore-column-probe" :data-artifact-id="artifactId" />',
  }

  function mountTheaterWithLoreProbe() {
    return mount(TheaterExperience, {
      global: {
        stubs: {
          WolvesComicReader: true,
          WolvesLoreColumn: WolvesLoreColumnProbe,
        },
      },
    })
  }

  // The lore column's `artifact-id` binding read `getNarrativeSlotForTime()` — the
  // standard show's own timeline — unconditionally, with no `presentationProfile`
  // branch. The Director's Cut's nine registered science/humanity quotes and its
  // missing-scientist bulletin (`wolves-directors-cut-timeline.ts`) were fully built,
  // scheduled and tested at the data layer, but a live Director's Cut run never
  // reached them: it showed whatever the standard show's Jono/Marina/Hikari/Bluefin
  // timeline resolves to at that same clock reading instead.
  //
  // t=100 is deliberately not the shared closing bulletin both timelines fall back to
  // once their own schedule runs out (a fallback both cuts happen to share, which would
  // make the two expectations coincide and pass either way): it is inside both cuts'
  // authored schedules, where the two resolve to genuinely different artifacts.
  it('reads the Director\'s Cut narrative timeline for its own lore column, not the standard show\'s', () => {
    const directorSlot = getDirectorsCutNarrativeSlotForTime(100)
    if (!directorSlot) {
      throw new Error('Director slot missing at 100s')
    }
    expect(directorSlot.artifactId).not.toBe(getNarrativeSlotForTime(100).artifactId)

    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(100, 425, 100)

    const probe = mountTheaterWithLoreProbe().get('.wolves-lore-column-probe')

    expect(probe.attributes('data-artifact-id')).toBe(directorSlot.artifactId)
  })

  it('still reads the standard show\'s own timeline at the same clock reading', () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(100, 425, 100)

    const probe = mountTheaterWithLoreProbe().get('.wolves-lore-column-probe')

    expect(probe.attributes('data-artifact-id')).toBe(getNarrativeSlotForTime(100).artifactId)
  })

  it('clears Director lore during image-only gaps and after the bulletin handoff', async () => {
    const store = useCinematicStore()
    store.loadExperience(WOLVES_DIRECTORS_CUT_EXPERIENCE)
    store.enterCinematic()
    store.updateTime(0, 425, 0)

    const wrapper = mountTheaterWithLoreProbe()
    const probe = () => wrapper.get('.wolves-lore-column-probe')

    const firstQuote = getDirectorsCutNarrativeSlotForTime(0)!
    store.updateTime(firstQuote.endTime + 1, 425, firstQuote.endTime + 1)
    await nextTick()
    expect(probe().attributes('data-artifact-id')).toBe('')

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart, 425, DIRECTORS_CUT_FINALE_ANCHORS.bulletinStart)
    await nextTick()
    expect(probe().attributes('data-artifact-id')).toBe(DIRECTORS_CUT_BULLETIN_ARTIFACT_ID)

    store.updateTime(DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd, 425, DIRECTORS_CUT_FINALE_ANCHORS.bulletinEnd)
    await nextTick()
    // The bulletin's end *is* the finale's start — `bulletinEnd` and `finaleStart` are the same
    // beat — and the finale unmounts the ordinary grid rather than covering it. So the handoff
    // clears the bulletin by taking the whole lore column off the stage, which is a stronger
    // guarantee than blanking its id: nothing is left mounted to keep running behind the frame.
    // Asserting an empty id here instead would demand the column survive its own handoff.
    expect(wrapper.find('.wolves-lore-column-probe').exists()).toBe(false)
  })
})
