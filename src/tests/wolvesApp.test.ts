import { flushPromises, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { useCinematicStore } from '@/stores/cinematic'
import WolvesApp from '@/WolvesApp.vue'

const CinematicLobbyStub = defineComponent({
  name: 'CinematicLobby',
  emits: ['enter'],
  template: '<button class="cinematic-lobby-stub" @click="$emit(\'enter\')" />',
})

const handoffCalls: string[] = []
let introMounts = 0
let introNexts = 0
let setCaptionsEnabled = vi.fn()
let startStage = async () => {
  handoffCalls.push('start')
}

const CinematicStageStub = defineComponent({
  name: 'CinematicStage',
  setup(_, { expose }) {
    expose({
      prepare: vi.fn(async () => handoffCalls.push('prepare')),
      start: () => startStage(),
      releaseHandoff: vi.fn(() => handoffCalls.push('release')),
      destroy: vi.fn(() => handoffCalls.push('destroy')),
      togglePlay: vi.fn(),
      seekTo: vi.fn(),
      seekToRatio: vi.fn(),
      skip: vi.fn(),
    })
    return {}
  },
  template: '<div class="cinematic-stage-stub" />',
})

const WolvesCreatorShortsInterstitialStub = defineComponent({
  name: 'WolvesCreatorShortsInterstitial',
  emits: ['complete'],
  template: '<div class="creator-shorts-stub" />',
})

const WolvesIntroOverlayStub = defineComponent({
  name: 'WolvesIntroOverlay',
  emits: ['status', 'complete'],
  props: {
    holdForHandoff: { type: Boolean, default: false },
    transparentHandoff: { type: Boolean, default: false },
  },
  updated() {
    if (this.transparentHandoff) {
      handoffCalls.push('transparent')
    }
  },
  mounted() {
    introMounts++
  },
  setup(_, { expose }) {
    expose({
      next() {
        introNexts++
      },
      previous: vi.fn(),
      toggle: vi.fn(),
      seekToRatio: vi.fn(),
      setVoiceOverEnabled: vi.fn(),
      setCaptionsEnabled,
    })
    return {}
  },
  template: '<div class="wolves-intro-overlay-stub" />',
})

const MediaWidgetStub = defineComponent({
  name: 'MediaWidget',
  emits: ['seek', 'skip', 'toggleCaptions'],
  props: {
    title: { type: String, default: '' },
    showVoiceOverToggle: { type: Boolean, default: false },
    voiceOverEnabled: { type: Boolean, default: false },
    voiceOverLabel: { type: String, default: '' },
    showCaptionToggle: { type: Boolean, default: false },
    captionsEnabled: { type: Boolean, default: false },
    captionLabel: { type: String, default: '' },
  },
  template: `
    <div class="media-widget-stub">
      {{ showVoiceOverToggle }}|{{ voiceOverEnabled }}|{{ voiceOverLabel }}|{{ showCaptionToggle }}|{{ captionsEnabled }}|{{ captionLabel }}
    </div>
  `,
})

const NameplateStub = defineComponent({
  name: 'Nameplate',
  props: {
    detail: { type: String, default: '' },
    label: { type: String, default: '' },
  },
  template: '<div class="nameplate-stub">{{ detail }}|{{ label }}</div>',
})

describe('wolvesApp intro status handling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    handoffCalls.length = 0
    introMounts = 0
    introNexts = 0
    setCaptionsEnabled = vi.fn()
    startStage = async () => {
      handoffCalls.push('start')
    }
  })

  afterEach(() => {
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: undefined,
    })
  })

  function stubs() {
    return {
      CinematicLobby: CinematicLobbyStub,
      CinematicStage: CinematicStageStub,
      WolvesCreatorShortsInterstitial: WolvesCreatorShortsInterstitialStub,
      MediaWidget: MediaWidgetStub,
      WolvesIntroOverlay: WolvesIntroOverlayStub,
      Nameplate: NameplateStub,
    }
  }

  it('preloads the cinematic stage during the intro and hands off through a supported view transition', async () => {
    const startViewTransition = vi.fn((update: () => Promise<void>) => {
      expect(handoffCalls).toEqual(['prepare', 'start'])
      return { updateCallbackDone: update() }
    })
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    })

    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    await wrapper.get('.cinematic-lobby-stub').trigger('click')
    await nextTick()
    expect(handoffCalls).toEqual(['prepare'])

    wrapper.getComponent(WolvesIntroOverlayStub).vm.$emit('complete')
    await flushPromises()
    await nextTick()

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(handoffCalls).toEqual(['prepare', 'start', 'transparent'])
    expect(useCinematicStore().phase).toBe('cinematic')
    expect(wrapper.find('.wolves-intro-overlay-stub').exists()).toBe(false)
  })

  it('hands off without requesting a view transition when the API is unavailable', async () => {
    const store = useCinematicStore()
    store.enterIntro()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    wrapper.getComponent(WolvesIntroOverlayStub).vm.$emit('complete')
    await flushPromises()
    await nextTick()

    expect(handoffCalls).toEqual(['start', 'transparent'])
    expect(store.phase).toBe('cinematic')
  })

  it('resumes the next cinematic video after Creator Shorts completes', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    store.enterCreatorShorts()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    const shorts = wrapper.getComponent(WolvesCreatorShortsInterstitialStub)
    shorts.vm.$emit('complete')
    await Promise.resolve()
    await nextTick()

    expect(store.phase).toBe('cinematic')
    expect(store.segmentIndex).toBe(1)
    expect(handoffCalls).toEqual(['start'])
    expect(wrapper.find('.cinematic-stage-stub').exists()).toBe(true)
  })

  it('destroys the cinematic stage before seeking back into the intro', async () => {
    const store = useCinematicStore()
    store.enterCinematic()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    wrapper.getComponent(MediaWidgetStub).vm.$emit('seek', 0)
    await flushPromises()
    await nextTick()

    expect(handoffCalls).toEqual(['destroy', 'prepare'])
    expect(store.phase).toBe('intro')
  })

  it('cancels a delayed handoff before remounting the intro for a seek', async () => {
    let resolveStart: (() => void) | undefined
    startStage = () => {
      handoffCalls.push('start')
      return new Promise<void>((resolve) => {
        resolveStart = resolve
      })
    }
    const store = useCinematicStore()
    store.enterIntro()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    wrapper.getComponent(WolvesIntroOverlayStub).vm.$emit('complete')
    await flushPromises()
    expect(store.phase).toBe('cinematic')

    wrapper.getComponent(MediaWidgetStub).vm.$emit('seek', 0)
    await flushPromises()
    await nextTick()

    expect(store.phase).toBe('intro')
    expect(introMounts).toBe(2)

    resolveStart?.()
    await flushPromises()

    expect(handoffCalls).toEqual(['start', 'destroy', 'prepare'])
    expect(wrapper.find('.wolves-intro-overlay-stub').exists()).toBe(true)
  })

  it('cancels a delayed handoff before using a fresh intro overlay for a skip', async () => {
    let resolveStart: (() => void) | undefined
    startStage = () => {
      handoffCalls.push('start')
      return new Promise<void>((resolve) => {
        resolveStart = resolve
      })
    }
    const store = useCinematicStore()
    store.enterIntro()
    const wrapper = shallowMount(WolvesApp, {
      global: { stubs: stubs() },
    })

    wrapper.getComponent(WolvesIntroOverlayStub).vm.$emit('complete')
    await flushPromises()
    wrapper.getComponent(MediaWidgetStub).vm.$emit('skip', 1)
    await flushPromises()
    await nextTick()

    expect(store.phase).toBe('intro')
    expect(introMounts).toBe(2)
    expect(introNexts).toBe(1)

    resolveStart?.()
    await flushPromises()

    expect(handoffCalls).toEqual(['start', 'destroy', 'prepare'])
  })

  it('hides the prologue nameplate absent a cue-level title and shows it only for the authored override', async () => {
    const store = useCinematicStore()
    store.enterIntro()

    const wrapper = shallowMount(WolvesApp, {
      global: {
        stubs: stubs(),
      },
    })

    const intro = wrapper.getComponent(WolvesIntroOverlayStub)

    // Ordinary wolves-prologue status (no cue-level nameplateTitle) must hide the
    // entire top-left nameplate rather than showing the default prologue plate.
    intro.vm.$emit('status', {
      currentTime: 10,
      duration: 94,
      paused: false,
      segmentId: 'wolves-prologue',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.nameplate-stub').exists()).toBe(false)

    intro.vm.$emit('status', {
      currentTime: 50,
      duration: 94,
      paused: false,
      segmentId: 'wolves-prologue',
      canGoPrevious: true,
      nameplateTitle: 'From the Age of Dinosaurs to the Pinnacle of Humanity',
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.nameplate-stub').text()).toBe('PROLOGUE|From the Age of Dinosaurs to the Pinnacle of Humanity')

    intro.vm.$emit('status', {
      currentTime: 65,
      duration: 94,
      paused: false,
      segmentId: 'wolves-prologue',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.nameplate-stub').exists()).toBe(false)
  })

  it('shows the Destiny CC switch off by default and forwards its state to the intro overlay', async () => {
    const store = useCinematicStore()
    store.enterIntro()

    const wrapper = shallowMount(WolvesApp, {
      global: {
        stubs: stubs(),
      },
    })

    const intro = wrapper.getComponent(WolvesIntroOverlayStub)
    const widget = () => wrapper.getComponent(MediaWidgetStub)

    intro.vm.$emit('status', {
      currentTime: 12,
      duration: 94,
      paused: false,
      segmentId: 'wolves-prologue',
      canGoPrevious: true,
      showVoiceOverToggle: false,
      voiceOverEnabled: false,
    })
    await wrapper.vm.$nextTick()

    expect(widget().text()).toBe('false|false|Ikora voice over|false|false|CC')

    intro.vm.$emit('status', {
      currentTime: 18,
      duration: 90,
      paused: true,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
      showVoiceOverToggle: true,
      voiceOverEnabled: true,
      showCaptionToggle: true,
      captionsEnabled: false,
    })
    await wrapper.vm.$nextTick()

    expect(widget().text()).toBe('true|true|Ikora voice over|true|false|CC')

    widget().vm.$emit('toggleCaptions', true)

    expect(setCaptionsEnabled).toHaveBeenCalledWith(true)
  })

  it('shows the Nova tag only in the bottom music plaque during the candle sequence', async () => {
    const store = useCinematicStore()
    store.enterIntro()

    const wrapper = shallowMount(WolvesApp, {
      global: {
        stubs: {
          CinematicLobby: true,
          CinematicStage: true,
          MediaWidget: MediaWidgetStub,
          WolvesIntroOverlay: WolvesIntroOverlayStub,
          Nameplate: NameplateStub,
        },
      },
    })

    const intro = wrapper.getComponent(WolvesIntroOverlayStub)
    intro.vm.$emit('status', {
      currentTime: 5,
      duration: 121.5,
      paused: false,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.nameplate-stub').text()).toBe('Meet your Fireteam|Fighting for something greater than ourselves.')
    expect(wrapper.getComponent(MediaWidgetStub).props('title')).toBe('Destiny 2: Into the Light Cinematic')

    intro.vm.$emit('status', {
      currentTime: 48,
      duration: 121.5,
      paused: false,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
      mediaTitle: '#nova4ever',
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.nameplate-stub').text()).toBe('Meet your Fireteam|Fighting for something greater than ourselves.')
    expect(wrapper.getComponent(MediaWidgetStub).props('title')).toBe('#nova4ever')

    intro.vm.$emit('status', {
      currentTime: 70.5,
      duration: 121.5,
      paused: false,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.getComponent(MediaWidgetStub).props('title')).toBe('Destiny 2: Into the Light Cinematic')
  })

  it('normalizes intro native time into canonical segment/sequence progress and preserves overall continuity on handoff', async () => {
    const store = useCinematicStore()
    store.enterIntro()

    const wrapper = shallowMount(WolvesApp, {
      global: {
        stubs: stubs(),
      },
    })

    const intro = wrapper.getComponent(WolvesIntroOverlayStub)
    intro.vm.$emit('status', {
      currentTime: 62,
      duration: 121.5,
      paused: false,
      segmentId: 'wolves-intro',
      canGoPrevious: true,
    })
    await wrapper.vm.$nextTick()

    expect(store.segmentIndex).toBe(1)
    expect(store.segmentElapsed).toBeCloseTo(60)
    expect(store.segmentDuration).toBeCloseTo(119.5)
    expect(store.nativeTime).toBe(62)
    expect(store.sequenceElapsed).toBeCloseTo(154)
    expect(store.overallElapsed).toBeCloseTo(154)

    intro.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(store.phase).toBe('cinematic')
    expect(store.overallElapsed).toBeCloseTo(213.5)
  })
})
