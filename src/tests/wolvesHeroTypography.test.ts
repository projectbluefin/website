import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import TheaterExperience from '@/components/wolves/cinematic/TheaterExperience.vue'
import { useCinematicStore } from '@/stores/cinematic'

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
    [408, 'legend', 'Become Legend'],
    [425, 'legend', 'Become Legend'],
  ])('renders the exact authored cue at %s seconds', async (time, mode, text) => {
    const wrapper = await renderAt(Number(time))
    expect(wrapper.get(`.wc-thesis--${mode}`).text()).toContain(text)
  })

  it('does not apply the back-treatment to the legend cues', async () => {
    const legend = await renderAt(408)
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
    const wrapper = await renderTrackZeroAt(1280)

    const sidecar = wrapper.find('[data-trackzero-video-sidecar]')
    expect(sidecar.exists()).toBe(true)

    const iframe = sidecar.get('iframe')
    const src = new URL(iframe.attributes('src') ?? '')

    expect(src.origin + src.pathname).toBe(`https://www.youtube.com/embed/${EXPECTED_VIDEO_IDS[0]}`)
    expect(src.searchParams.get('autoplay')).toBe('1')
    expect(src.searchParams.get('mute')).toBe('1')
    expect(src.searchParams.get('loop')).toBe('1')
    expect(src.searchParams.get('controls')).toBe('0')
    expect(src.searchParams.get('playsinline')).toBe('1')
    expect(src.searchParams.get('playlist')?.split(',')).toEqual(EXPECTED_VIDEO_IDS)
    expect(iframe.attributes('title')).toBeTruthy()
    expect(sidecar.get('[data-trackzero-video-chrome-mask]').attributes('aria-hidden')).toBe('true')
  })

  it('renders the sidecar only for Track 0', async () => {
    const wrapper = await renderTrackZeroAt(1280, 1)

    expect(wrapper.find('.wc-trackzero-lore').exists()).toBe(false)
    expect(wrapper.find('[data-trackzero-video-sidecar]').exists()).toBe(false)
    expect(wrapper.find('iframe').exists()).toBe(false)
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
