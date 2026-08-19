import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import {
  TRAILER_DURATION_SECONDS,
  TRAILER_MUSIC_END_SECONDS,
  TRAILER_PICTURE_END_SECONDS,
  TRAILER_PICTURE_REVEAL_FADE_SECONDS,
  TRAILER_PICTURE_REVEAL_SECONDS,
} from '@/data/wolves-trailer-plates'
import WolvesTeaserApp from '@/WolvesTeaserApp.vue'

const youtube = vi.hoisted(() => {
  let onReady: ((event: { target: FakePlayer }) => void) | undefined

  class FakePlayer {
    static latest: FakePlayer | undefined

    currentTime = 0
    destroy = vi.fn()
    getCurrentTime = vi.fn(() => this.currentTime)
    pauseVideo = vi.fn()
    playVideo = vi.fn()
    seekTo = vi.fn((seconds: number) => { this.currentTime = seconds })

    constructor(_element: Element, options: { events?: { onReady?: typeof onReady } }) {
      FakePlayer.latest = this
      onReady = options.events?.onReady
    }
  }

  return {
    Player: FakePlayer,
    load: vi.fn<() => Promise<void>>(),
    latest: () => FakePlayer.latest,
    ready: () => FakePlayer.latest && onReady?.({ target: FakePlayer.latest }),
    reset: () => {
      FakePlayer.latest = undefined
      onReady = undefined
    },
  }
})

vi.mock('@/composables/useYoutubeIframeApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useYoutubeIframeApi')>()
  return {
    ...actual,
    getYoutubePlayerConstructor: () => youtube.Player,
    loadYoutubeIframeApi: youtube.load,
  }
})

interface TeaserHarness {
  seekTo: (seconds: number) => void
}

beforeEach(() => {
  youtube.reset()
  youtube.load.mockReset()
  youtube.load.mockResolvedValue()
})

afterEach(() => {
  vi.useRealTimers()
  delete (window as typeof window & { __wolvesTeaser?: TeaserHarness }).__wolvesTeaser
})

describe('wolves teaser bridge', () => {
  it('covers Nightwish with black until the authored explosion bloom', async () => {
    const wrapper = mount(WolvesTeaserApp, {
      global: {
        stubs: {
          MediaWidget: true,
          WolvesBackCatalogue: true,
          WolvesTrailerLine: true,
        },
      },
    })
    await flushPromises()
    const harness = (window as typeof window & { __wolvesTeaser: TeaserHarness }).__wolvesTeaser

    harness.seekTo(TRAILER_PICTURE_REVEAL_SECONDS - 0.01)
    await nextTick()
    expect(wrapper.get<HTMLElement>('.wt-opening-black').element.style.opacity).toBe('1')

    harness.seekTo(TRAILER_PICTURE_REVEAL_SECONDS + TRAILER_PICTURE_REVEAL_FADE_SECONDS / 2)
    await nextTick()
    expect(Number(wrapper.get<HTMLElement>('.wt-opening-black').element.style.opacity)).toBeCloseTo(0.5, 5)

    harness.seekTo(TRAILER_PICTURE_REVEAL_SECONDS + TRAILER_PICTURE_REVEAL_FADE_SECONDS)
    await nextTick()
    expect(wrapper.find('.wt-opening-black').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps an opaque black backing over the YouTube picture while the wolf-day wallpaper rises', async () => {
    const wrapper = mount(WolvesTeaserApp, {
      global: {
        stubs: {
          MediaWidget: true,
          WolvesBackCatalogue: true,
          WolvesTrailerLine: true,
        },
      },
    })
    await flushPromises()

    const harness = (window as typeof window & { __wolvesTeaser: TeaserHarness }).__wolvesTeaser
    harness.seekTo(TRAILER_PICTURE_END_SECONDS - 0.01)
    await nextTick()
    expect(wrapper.find('.wt-backdrop').exists()).toBe(false)

    harness.seekTo(TRAILER_PICTURE_END_SECONDS)
    await nextTick()

    const backdrop = wrapper.get<HTMLElement>('.wt-backdrop')
    const wallpaperGroup = wrapper.get<HTMLElement>('.wt-backdrop-images')
    const [day, night] = wrapper.findAll<HTMLElement>('.wt-backdrop-img')
    expect(backdrop.element.style.opacity).toBe('')
    expect(wallpaperGroup.element.style.opacity).toBe('0')
    expect(day.element.style.opacity).toBe('')
    expect(night.element.style.opacity).toBe('0')

    harness.seekTo(TRAILER_PICTURE_END_SECONDS + 0.6)
    await nextTick()

    expect(Number(wallpaperGroup.element.style.opacity)).toBeCloseTo(0.6 / 1.4, 5)
    expect(night.element.style.opacity).toBe('0')

    harness.seekTo(TRAILER_PICTURE_END_SECONDS + 4.6)
    await nextTick()

    expect(wallpaperGroup.element.style.opacity).toBe('1')
    expect(Number(night.element.style.opacity)).toBeCloseTo(0.5, 5)

    harness.seekTo(TRAILER_PICTURE_END_SECONDS + 11.1)
    await nextTick()

    expect(Number(wallpaperGroup.element.style.opacity)).toBeCloseTo(0.5, 5)
    expect(night.element.style.opacity).toBe('1')

    wrapper.unmount()
  })
})

describe('wolves teaser transport', () => {
  it('honours Play when the YouTube player becomes ready after the click', async () => {
    let finishLoading!: () => void
    youtube.load.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishLoading = resolve
    }))
    const wrapper = shallowMount(WolvesTeaserApp)

    await wrapper.get('.wt-convenience-play').trigger('click')
    expect(youtube.latest()).toBeUndefined()

    finishLoading()
    await flushPromises()
    expect(youtube.latest()!.playVideo).not.toHaveBeenCalled()

    youtube.ready()
    await nextTick()

    expect(youtube.latest()!.playVideo).toHaveBeenCalledOnce()
    expect(wrapper.find('.wt-poster').exists()).toBe(false)
    wrapper.unmount()
  })

  it('reveals an idle seek and applies it when the player becomes ready', async () => {
    const wrapper = shallowMount(WolvesTeaserApp)
    await flushPromises()

    wrapper.getComponent(MediaWidget).vm.$emit('seek', 0.5)
    await nextTick()
    expect(wrapper.find('.wt-poster').exists()).toBe(false)

    youtube.ready()
    expect(youtube.latest()!.seekTo).toHaveBeenCalledWith(TRAILER_DURATION_SECONDS / 2, true)
    expect(youtube.latest()!.playVideo).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('plays through the howl, then advances a silent five-second URL hold', async () => {
    vi.useFakeTimers()
    const wrapper = shallowMount(WolvesTeaserApp)
    await flushPromises()
    youtube.ready()
    await wrapper.get('.wt-convenience-play').trigger('click')

    youtube.latest()!.currentTime = TRAILER_MUSIC_END_SECONDS
    await vi.advanceTimersByTimeAsync(100)
    expect(youtube.latest()!.pauseVideo).toHaveBeenCalled()
    expect(wrapper.getComponent(MediaWidget).props('duration')).toBe(TRAILER_DURATION_SECONDS)
    expect(wrapper.getComponent(MediaWidget).props('elapsed')).toBeCloseTo(TRAILER_MUSIC_END_SECONDS, 2)

    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.getComponent(MediaWidget).props('elapsed')).toBeCloseTo(TRAILER_DURATION_SECONDS, 2)
    expect(wrapper.getComponent(MediaWidget).props('playing')).toBe(false)
    wrapper.unmount()
  })

  it('ignores a late player-ready event after unmount', async () => {
    const wrapper = shallowMount(WolvesTeaserApp)
    await flushPromises()
    await wrapper.get('.wt-convenience-play').trigger('click')

    wrapper.unmount()
    youtube.ready()

    expect(youtube.latest()!.destroy).toHaveBeenCalledOnce()
    expect(youtube.latest()!.playVideo).not.toHaveBeenCalled()
  })

  it('keeps the video visible while playing, seeking, and paused', async () => {
    const wrapper = shallowMount(WolvesTeaserApp)
    await flushPromises()
    youtube.ready()

    expect(wrapper.find('.wt-poster').exists()).toBe(true)

    await wrapper.get('.wt-convenience-play').trigger('click')
    expect(wrapper.find('.wt-poster').exists()).toBe(false)

    wrapper.getComponent(MediaWidget).vm.$emit('seek', 0.5)
    await nextTick()
    expect(wrapper.find('.wt-poster').exists()).toBe(false)

    wrapper.getComponent(MediaWidget).vm.$emit('togglePlay')
    await nextTick()
    expect(wrapper.find('.wt-poster').exists()).toBe(false)
    wrapper.unmount()
  })
})
