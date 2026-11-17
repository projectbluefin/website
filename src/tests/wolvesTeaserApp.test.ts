import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import MediaWidget from '@/components/wolves/cinematic/MediaWidget.vue'
import { getYoutubePlayerState } from '@/composables/useYoutubeIframeApi'
import {
  TRAILER_DURATION_SECONDS,
  TRAILER_PICTURE_END_SECONDS,
  TRAILER_PICTURE_REVEAL_FADE_SECONDS,
  TRAILER_PICTURE_REVEAL_SECONDS,
} from '@/data/wolves-trailer-plates'
import WolvesTeaserApp from '@/WolvesTeaserApp.vue'

const youtube = vi.hoisted(() => {
  let onReady: ((event: { target: FakePlayer }) => void) | undefined
  let onStateChange: ((event: { data: number }) => void) | undefined

  class FakePlayer {
    static latest: FakePlayer | undefined

    currentTime = 0
    destroy = vi.fn()
    getCurrentTime = vi.fn(() => this.currentTime)
    pauseVideo = vi.fn()
    playVideo = vi.fn()
    seekTo = vi.fn((seconds: number) => { this.currentTime = seconds })

    constructor(
      _element: Element,
      options: { events?: { onReady?: typeof onReady, onStateChange?: typeof onStateChange } },
    ) {
      FakePlayer.latest = this
      onReady = options.events?.onReady
      onStateChange = options.events?.onStateChange
    }
  }

  return {
    Player: FakePlayer,
    load: vi.fn<() => Promise<void>>(),
    latest: () => FakePlayer.latest,
    ready: () => FakePlayer.latest && onReady?.({ target: FakePlayer.latest }),
    stateChange: (data: number) => onStateChange?.({ data }),
    reset: () => {
      FakePlayer.latest = undefined
      onReady = undefined
      onStateChange = undefined
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
  it('holds black over the embed until the authored reveal', async () => {
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

  it('draws no browser plates over the render, covering the endscreen only after the cut ends', async () => {
    vi.useFakeTimers()
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
    youtube.ready()

    const harness = (window as typeof window & { __wolvesTeaser: TeaserHarness }).__wolvesTeaser
    await wrapper.get('.wt-convenience-play').trigger('click')

    // The render carries every plate itself: at no beat — title, book lines,
    // day cards, or the baked end card — may the browser draw its own copy.
    for (const t of [
      TRAILER_PICTURE_REVEAL_SECONDS + 1,
      30,
      TRAILER_PICTURE_END_SECONDS,
      95,
      104,
      108
    ]) {
      harness.seekTo(t)
      await nextTick()
      expect(wrapper.find('.wt-lockup').exists()).toBe(false)
      expect(wrapper.find('.wt-backdrop').exists()).toBe(false)
    }

    youtube.latest()!.currentTime = TRAILER_DURATION_SECONDS - 0.02
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()

    const backdrop = wrapper.get<HTMLElement>('.wt-backdrop')
    expect(backdrop.element.style.opacity).toBe('')
    expect(wrapper.findAll<HTMLElement>('.wt-backdrop-img')).toHaveLength(1)
    expect(wrapper.find('.wt-lockup--poster').exists()).toBe(true)

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

  it('plays the delivered render to its authored end, then holds the URL card', async () => {
    vi.useFakeTimers()
    const wrapper = shallowMount(WolvesTeaserApp)
    await flushPromises()
    youtube.ready()
    await wrapper.get('.wt-convenience-play').trigger('click')

    // The encode ends a hair short of the authored duration; the clock closes
    // out the cut without ever pausing the video for a synthetic hold.
    youtube.latest()!.currentTime = TRAILER_DURATION_SECONDS - 0.02
    await vi.advanceTimersByTimeAsync(100)
    expect(youtube.latest()!.pauseVideo).not.toHaveBeenCalled()
    expect(wrapper.getComponent(MediaWidget).props('duration')).toBe(TRAILER_DURATION_SECONDS)
    expect(wrapper.getComponent(MediaWidget).props('elapsed')).toBe(TRAILER_DURATION_SECONDS)
    expect(wrapper.getComponent(MediaWidget).props('playing')).toBe(false)
    wrapper.unmount()
  })

  it('ends the cut when the player reports ENDED', async () => {
    vi.useFakeTimers()
    const wrapper = shallowMount(WolvesTeaserApp)
    await flushPromises()
    youtube.ready()
    await wrapper.get('.wt-convenience-play').trigger('click')

    youtube.stateChange(getYoutubePlayerState().ENDED)
    await nextTick()

    expect(wrapper.getComponent(MediaWidget).props('elapsed')).toBe(TRAILER_DURATION_SECONDS)
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
